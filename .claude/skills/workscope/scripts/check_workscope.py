"""Check a work scope Markdown against the house rules before it is rendered.

Usage:
  python3 check_workscope.py <workscope.md> [--variant ballpark|final]
                             [--resource-based] [--estimate <estimation.json>]

The variant comes from --variant, else the frontmatter key "variant:", else final.

Final variant formatting checks (template rules 4 to 8), each problem printed as FAIL:
  emphasis    every list item in Sections 3, 5, 8, 9, 10, 11, 12 (assumptions and
              open questions included) opens with a bold lead phrase that does not
              end on a preposition or article
  qualifier   phase and release tags "(from Phase N)", "(optional)", "(client supplies)" are italic
  payments    the payment table sums to 100, kick-off at least 10, milestone shares equal and round
  style       no em or en dashes, no semicolons in prose
  team        no Team Composition / team plan section unless --resource-based
  acceptance  every "## Milestone N:" block in Section 5 carries an "**Accepted when:**" line
  layout      a page-break token (\\newpage or \\pagebreak) stands alone on its line

Ballpark variant checks (BALLPARK-TEMPLATE.md):
  FAIL  a payment table or a payment schedule exists
  FAIL  a technical challenges, hidden challenges or risks section exists
  FAIL  the fixed ballpark note is missing
  FAIL  emphasis, qualifier, style and layout as above, emphasis on every list
  WARN  a question in "Questions for You" names build technology

Both variants:
  WARN  a future phase block ("Phase N", "Release N") carries no tentative label
  WARN  layout reminders: frontmatter 'closing:' key, no body **THANK YOU** line,
        and (final only) a standalone \\newpage before "# 4." and "# 5."

Estimate cross-check (only with --estimate, estimation contract schemaVersion 3,
release-aware for v6.1 milestones with "release" and "commitment"), each mismatch
printed as REVIEW, never as FAIL:
  - every committed feature in the document (final: Section 3, ballpark: the MVP or
    Full scope block of "What We Will Build") matches an Included estimate feature
    in a Committed milestone, and every such estimate feature appears there
  - every future phase feature in the document (final: Section 10 phase blocks,
    ballpark: the phase blocks) matches an Included estimate feature in a
    Tentative milestone, and every such estimate feature appears there
  - no Excluded, Deferred or Pending feature, and no Tentative feature, is
    promised in the committed part of the document
  - an hours figure stated on a committed or MVP line never equals the committed
    plus tentative total (committed totals never include tentative hours)
  - a milestone without a commitment is reported as defaulted to Committed when
    other milestones carry one

Exit code 1 when any FAIL is printed. REVIEW and WARN lines never change the exit code.
"""
import json
import re
import sys
from pathlib import Path

DANGLING = {"a", "an", "the", "of", "to", "for", "with", "by", "on", "in", "at", "from", "through",
            "and", "or", "as", "into", "per", "over", "across", "that", "which", "is", "are"}
LIST_SECTIONS = {"3", "5", "8", "9", "10", "11", "12"}
PROMISE_SECTIONS = {"3", "5", "8"}
QUALIFIER = re.compile(r"(?<!\*)\((from Phase \d+|from Release \d+|optional|client supplies)\)(?!\*)", re.I)
DASHES = (chr(0x2014), chr(0x2013))
PAGE_BREAKS = ("\\newpage", "\\pagebreak")
STANDALONE_BREAKS = PAGE_BREAKS + ("<!-- pagebreak -->",)
BREAK_BEFORE = {"4", "5"}
BALLPARK_NOTE = ("This is a ballpark figure. The final scope, timeline and cost are confirmed "
                 "once the discovery phase has covered every feature and challenge.")
FUTURE_HEADING = re.compile(r"\b(phase\s*\d+|release\s*[2-9]|future phase)", re.I)
RISK_HEADING = re.compile(r"^#+ .*\b(technical challenges?|hidden challenges?|risks?)\b", re.I | re.M)
TECH_CI = re.compile(r"\b(framework|database|react|react native|flutter|node(?:\.js)?|next\.js|angular|vue|"
                     r"django|laravel|nestjs|fastapi|spring boot|postgres(?:ql)?|mysql|mongodb|redis|firebase|"
                     r"supabase|graphql|grpc|microservices?|kubernetes|docker|serverless|lambda|dynamodb|"
                     r"azure|backend|frontend|websockets?)\b", re.I)
TECH_CS = re.compile(r"\b(REST|API|APIs|AWS|GCP|EC2|S3|RDS)\b")
HOURS = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*hours", re.I)


def normalize(name):
    """Return a comparable form of a feature name: lowercase words, no punctuation."""
    text = name.lower().replace("&", " and ")
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def names_match(a, b):
    """Return True when two normalized names are equal or one contains the other as whole words."""
    if not a or not b:
        return False
    if a == b:
        return True
    short, long_ = (a, b) if len(a) <= len(b) else (b, a)
    return len(short.split()) >= 2 and (" " + short + " ") in (" " + long_ + " ")


def frontmatter_value(text, key):
    """Return the unquoted value of a frontmatter key, or None."""
    fm = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n", text, flags=re.S)
    if not fm:
        return None
    m = re.search(r"^" + re.escape(key) + r":\s*(.+?)\s*(?:#.*)?$", fm.group(1), flags=re.M)
    return m.group(1).strip().strip("\"'") if m else None


def is_future(heading):
    """Return True when an H2 heading names a future phase rather than the committed release."""
    return bool(FUTURE_HEADING.search(heading)) and "not yet planned" not in heading.lower()


def check_lead(n, item, sub, fails, warns):
    """Apply the bold-lead emphasis rule to one list item."""
    if not item.startswith("**"):
        fails.append("{0}: emphasis: list item without a bold lead: {1}".format(n, item[:70]))
        return
    lead = re.match(r"^\*\*(.+?)\*\*", item)
    if lead:
        words = lead.group(1).rstrip(":.,").split()
        if words and words[-1].lower() in DANGLING:
            fails.append("{0}: emphasis: bold lead ends on '{1}': {2}".format(n, words[-1], lead.group(1)))
        if len(words) > 12 and not sub.startswith("assumptions"):
            warns.append("{0}: emphasis: long bold lead ({1} words): {2}".format(n, len(words), lead.group(1)[:60]))


def scan(text, resource_based, variant="final"):
    """Run the formatting checks and collect the document's release features.

    Returns (fails, warns, doc) where doc holds "committed" and "future" lists of
    (line number, module title, release), "promise" (normalized committed text),
    and "hours_lines" (text of committed or MVP lines in the investment section).
    """
    ballpark = variant == "ballpark"
    body = re.sub(r"^---\r?\n.*?\r?\n---\r?\n", "", text, count=1, flags=re.S)
    fails, warns = [], []
    doc = {"committed": [], "future": [], "promise": [], "hours_lines": []}
    section, title, sub, in_code = "", "", "", False
    milestones, milestone, accepted = [], None, False
    future_blocks, block = [], None
    if not frontmatter_value(text, "closing"):
        warns.append("layout: frontmatter has no 'closing:' key (house closing line is closing: \"THANK YOU\")")
    prev = ""

    def close_milestone():
        if milestone is not None and not accepted:
            fails.append("{0}: acceptance: milestone has no '**Accepted when:**' line: {1}".format(*milestone))

    def close_block():
        if block is not None:
            future_blocks.append(block)

    for n, line in enumerate(text.split("\n"), start=1):
        line = line.rstrip("\r")
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        stripped = line.strip()
        if any(t in stripped for t in PAGE_BREAKS) and stripped not in PAGE_BREAKS:
            fails.append("{0}: layout: page-break token inside a line prints as literal text".format(n))
        if re.match(r"^\*\*THANK YOU\*\*$", stripped, flags=re.I):
            warns.append("{0}: layout: closing line belongs in the frontmatter 'closing:' key, not the body".format(n))
        m = re.match(r"^# (\d+)\.\s*(.*)$", line)
        if m and not ballpark and m.group(1) in BREAK_BEFORE and prev not in STANDALONE_BREAKS:
            warns.append("{0}: layout: no standalone \\newpage line before '# {1}.'".format(n, m.group(1)))
        if stripped:
            prev = stripped
        if m:
            if section == "5" and not ballpark:
                close_milestone()
                milestone, accepted = None, False
            close_block()
            block = None
            section, title, sub = m.group(1), m.group(2).lower(), ""
        build_section = ("what we will build" in title) if ballpark else (section == "3")
        future_section = ("what we will build" in title) if ballpark else (section == "10")
        invest_section = ("investment" in title) if ballpark else (section == "6")
        if line.startswith("## "):
            sub = line[3:].lower()
            close_block()
            block = [n, line[3:].strip(), line] if future_section and is_future(sub) else None
            if section == "5" and not ballpark:
                close_milestone()
                mm = re.match(r"^## (Milestone \d+.*)$", line)
                milestone, accepted = ((n, mm.group(1)) if mm else None), False
                if mm:
                    milestones.append(mm.group(1))
        elif block is not None:
            block[2] += "\n" + line
        if section == "5" and line.lstrip().startswith("**Accepted when:**"):
            accepted = True
        in_future = block is not None
        committed_area = (section in PROMISE_SECTIONS) if not ballpark else (build_section and not in_future)
        if committed_area:
            doc["promise"].append(line)
        mod = re.match(r"^\d+\.\s+\*\*(.+?)\*\*", line)
        if mod and (build_section or in_future):
            entry = (n, mod.group(1).rstrip(":. "), block[1] if in_future else "committed")
            doc["future" if in_future else "committed"].append(entry)
        if invest_section and re.search(r"committed|\bmvp\b|full scope", line, re.I):
            doc["hours_lines"].append((n, line))
        if ballpark or section in LIST_SECTIONS:
            lm = re.match(r"^\s*(?:\d+\.|-)\s+(.*)$", line)
            if lm and not line.lstrip().startswith("|"):
                check_lead(n, lm.group(1), sub, fails, warns)
        if ballpark and "question" in title and stripped and not stripped.startswith("#"):
            hits = sorted(set(h.lower() for h in TECH_CI.findall(line)) | set(TECH_CS.findall(line)))
            if hits:
                warns.append("{0}: question: names build technology ({1}), ask about their users, devices, "
                             "data or rules instead".format(n, ", ".join(hits)))
        for q in QUALIFIER.finditer(line):
            fails.append("{0}: qualifier not italic: ({1})".format(n, q.group(1)))
        if any(d in line for d in DASHES):
            fails.append("{0}: style: em or en dash".format(n))
        if ";" in line and not line.lstrip().startswith(("|", "<!--", "!")):
            fails.append("{0}: style: semicolon in prose".format(n))
    if section == "5" and not ballpark:
        close_milestone()
    close_block()
    for start, heading, block_text in future_blocks:
        if "tentative" not in block_text.lower():
            warns.append("{0}: release: future phase '{1}' carries no tentative label".format(start, heading))

    if ballpark:
        if re.search(r"^\|\s*Payment\s+\d+\s*\|", body, flags=re.M) or re.search(r"payment schedule", body, re.I):
            fails.append("ballpark: a payment table or payment schedule belongs in the final variant, "
                         "the ballpark carries a one or two line payment note")
        for rm in RISK_HEADING.finditer(body):
            fails.append("ballpark: section '{0}' is not allowed, rewrite each risk as a client question".format(
                rm.group(0).lstrip("# ").strip()))
        if BALLPARK_NOTE not in " ".join(body.split()):
            fails.append("ballpark: the fixed ballpark note is missing: " + BALLPARK_NOTE)
    else:
        if not milestones:
            warns.append("acceptance: no '## Milestone N:' blocks found in Section 5")
        rows = re.findall(r"^\| Payment \d+ \| (.+?) \| (\d+)% \|", body, flags=re.M)
        if rows:
            shares = [int(s) for _, s in rows]
            if sum(shares) != 100:
                fails.append("payments: shares add to {0}, not 100".format(sum(shares)))
            if shares[0] < 10:
                fails.append("payments: kick-off share {0}% is below 10%".format(shares[0]))
            rest = shares[1:]
            if rest and len(set(rest)) != 1:
                fails.append("payments: milestone shares are not equal: {0}".format(rest))
            if rest and rest[0] % 5:
                fails.append("payments: milestone share {0}% is not a round number".format(rest[0]))
        else:
            warns.append("payments: no payment table found")

    if not resource_based and re.search(r"^#+ .*(Team Composition|Team Plan|Engagement Model and Team)", body, flags=re.M | re.I):
        fails.append("team: a fixed-scope work scope carries no team plan (pass --resource-based for a resource engagement)")

    doc["promise"] = " " + normalize(" ".join(doc["promise"])) + " "
    return fails, warns, doc


def hour_sums(data, commitment_of_milestone):
    """Return {"Committed": [min, max, mid], "Tentative": [...]} task hour sums from an estimate."""
    feature_ms = {f.get("id"): f.get("milestone") for f in data.get("features", []) if isinstance(f, dict)}
    included = {f.get("id") for f in data.get("features", []) if isinstance(f, dict) and f.get("scopeStatus") == "Included"}
    sums = {"Committed": [0.0, 0.0], "Tentative": [0.0, 0.0]}
    for t in data.get("tasks", []):
        if not isinstance(t, dict):
            continue
        fid = t.get("feature")
        if fid != "SHARED" and fid not in included:
            continue
        ms = t.get("milestone") if fid == "SHARED" else feature_ms.get(fid)
        bucket = commitment_of_milestone.get(ms, "Committed")
        lo = float(t.get("minHours") or 0)
        hi = float(t.get("maxHours") or lo)
        sums[bucket][0] += lo
        sums[bucket][1] += hi
    return {k: [v[0], v[1], (v[0] + v[1]) / 2] for k, v in sums.items()}


def cross_check(doc, estimate_path, variant="final"):
    """Compare the document's release features with an estimation.json. Returns REVIEW lines."""
    reviews = []
    try:
        data = json.loads(Path(estimate_path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return ["estimate: cannot read {0}: {1}".format(estimate_path, exc)]
    if data.get("schemaVersion") != 3:
        reviews.append("estimate: schemaVersion is {0!r}, expected 3".format(data.get("schemaVersion")))
    milestones = [m for m in data.get("milestones", []) if isinstance(m, dict)]
    explicit = any("commitment" in m for m in milestones)
    commitment = {}
    for m in milestones:
        value = m.get("commitment") or "Committed"
        commitment[m.get("id")] = "Tentative" if value == "Tentative" else "Committed"
        if explicit and ("commitment" not in m or "release" not in m):
            reviews.append("estimate: milestone {0} has no release or commitment, defaulted to Committed".format(m.get("id")))
    features = [f for f in data.get("features", []) if isinstance(f, dict) and f.get("name")]

    def bucket(f):
        return commitment.get(f.get("milestone"), "Committed")

    included = [f for f in features if f.get("scopeStatus") == "Included"]
    not_promised = [f for f in features if f.get("scopeStatus") in ("Excluded", "Deferred", "Pending")]
    where_committed = "the MVP block" if variant == "ballpark" else "Section 3"
    where_future = "the future phase blocks" if variant == "ballpark" else "the Section 10 phase blocks"

    for kind, entries, want in (("committed", doc["committed"], "Committed"), ("future", doc["future"], "Tentative")):
        label = where_committed if kind == "committed" else where_future
        for n, title, _release in entries:
            key = normalize(title)
            hits = [f for f in features if names_match(key, normalize(f["name"]))]
            inc = [f for f in hits if f.get("scopeStatus") == "Included"]
            if not hits:
                reviews.append("{0}: estimate: {1} feature '{2}' has no matching estimate feature".format(n, label, title))
            elif not inc:
                statuses = ", ".join("{0} {1}".format(f.get("id", "?"), f.get("scopeStatus", "?")) for f in hits)
                reviews.append("{0}: estimate: {1} feature '{2}' matches only non-Included estimate features ({3})".format(
                    n, label, title, statuses))
            elif not any(bucket(f) == want for f in inc):
                ids = ", ".join("{0} in {1}".format(f.get("id", "?"), f.get("milestone", "?")) for f in inc)
                reviews.append("{0}: estimate: {1} feature '{2}' sits in a {3} milestone in the estimate ({4})".format(
                    n, label, title, "Tentative" if want == "Committed" else "Committed", ids))

    committed_keys = [normalize(t) for _, t, _ in doc["committed"]]
    future_keys = [normalize(t) for _, t, _ in doc["future"]]
    for f in included:
        key = normalize(f["name"])
        if bucket(f) == "Committed":
            if not any(names_match(key, mk) for mk in committed_keys) and (" " + key + " ") not in doc["promise"]:
                reviews.append("estimate: Included feature {0} '{1}' does not appear in {2}".format(
                    f.get("id", "?"), f["name"], where_committed))
        else:
            if not any(names_match(key, mk) for mk in future_keys):
                reviews.append("estimate: Tentative feature {0} '{1}' does not appear in {2}".format(
                    f.get("id", "?"), f["name"], where_future))
            if any(names_match(key, mk) for mk in committed_keys):
                reviews.append("estimate: Tentative feature {0} '{1}' is promised in {2}".format(
                    f.get("id", "?"), f["name"], where_committed))

    for f in not_promised:
        key = normalize(f["name"])
        if key and (" " + key + " ") in doc["promise"]:
            where = where_committed if variant == "ballpark" else "Section 3, 5 or 8"
            reviews.append("estimate: {0} feature {1} '{2}' is promised in {3}".format(
                f.get("scopeStatus"), f.get("id", "?"), f["name"], where))

    sums = hour_sums(data, commitment)
    if sums["Tentative"][1] > 0:
        combined = {round(c + t, 2) for c, t in zip(sums["Committed"], sums["Tentative"])}
        committed = {round(c, 2) for c in sums["Committed"]}
        for n, line in doc["hours_lines"]:
            for h in HOURS.findall(line):
                value = round(float(h.replace(",", "")), 2)
                if value in combined and value not in committed:
                    reviews.append("{0}: estimate: committed figure of {1} hours includes tentative hours "
                                   "(committed total is {2:g} to {3:g})".format(
                                       n, h, sums["Committed"][0], sums["Committed"][1]))
    return reviews


def check(path, resource_based=False, estimate=None, variant=None):
    """Run every check on one work scope file, print the findings, and return the exit code."""
    text = Path(path).read_text(encoding="utf-8")
    declared = frontmatter_value(text, "variant")
    pre = []
    if variant and declared and declared != variant:
        pre.append("variant: --variant {0} overrides frontmatter variant: {1}".format(variant, declared))
    chosen = variant or declared or "final"
    if chosen not in ("ballpark", "final"):
        sys.exit("variant must be ballpark or final, got {0!r}".format(chosen))
    fails, warns, doc = scan(text, resource_based, chosen)
    reviews = cross_check(doc, estimate, chosen) if estimate else []
    for w in pre + warns:
        print("WARN", w)
    for r in reviews:
        print("REVIEW", r)
    for f in fails:
        print("FAIL", f)
    tail = ", {0} REVIEW".format(len(reviews)) if estimate else ""
    print("check_workscope ({0}): {1}{2}".format(chosen, "PASS" if not fails else "{0} FAIL".format(len(fails)), tail))
    return 1 if fails else 0


def main(argv):
    """Parse the command line and run the checks."""
    args = list(argv)
    opts = {}
    for flag in ("--estimate", "--variant"):
        if flag in args:
            i = args.index(flag)
            if i + 1 >= len(args):
                sys.exit("{0} needs a value".format(flag))
            opts[flag] = args[i + 1]
            del args[i:i + 2]
    resource_based = "--resource-based" in args
    paths = [a for a in args if not a.startswith("--")]
    if not paths:
        sys.exit(__doc__)
    return check(paths[0], resource_based, opts.get("--estimate"), opts.get("--variant"))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
