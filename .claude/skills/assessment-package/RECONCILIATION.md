# Reconciliation Protocol

> Run this in full before writing any deliverable content. It is the single highest-value step in the
> `assessment-package` skill, and it is the step most likely to be skipped under time pressure.

---

## Why this exists

On a real engagement, a findings workbook stated:

```
Total items: 199
By severity:  Critical 10 | High 40 | Medium 65 | Low 17     <- sums to 132
By type:      16 categories                                   <- sums to 132
```

The total was correct. The blocks beneath it were written at one point and never refreshed as findings
were appended, while the total **was** refreshed. The shortfall was **67 findings**, a third of the
register.

The type block was worse than a stale subset. It **omitted two categories entirely** and **overstated a
third** (7 against an actual 6), so no simple "it is an earlier snapshot" explanation held.

Every headline number in four client documents would have been wrong. The client spotted it, which is the
worst way for it to be found.

**The lesson is not "check the maths". It is: a human-maintained summary sitting beside
machine-maintained data will drift, and you must assume it already has.**

---

## Step 1: Read the detail, never the summary

Load the detailed findings sheet. Treat every summary sheet, dashboard, README figure, and prior report
as an unverified claim.

Extract per row: ID, severity, type, area, status, effort, evidence grade, and whether each required
field is populated.

## Step 2: Recompute every total

```python
sev   = Counter(r["Severity"] for r in rows)
typ   = Counter(r["Type"]     for r in rows)
area  = Counter(r["Area"]     for r in rows)
stat  = Counter(r["Status"]   for r in rows)
eff   = Counter(r["Effort"]   for r in rows)
total = len(rows)
```

Then assert each distribution sums to the total. A distribution that does not sum to the row count means
blank values exist, which is itself a finding about the register.

## Step 3: Diff against every stated figure

For each summary figure the source claims, record: stated value, computed value, delta, and verdict.

| Verdict | Meaning |
|---|---|
| MATCH | Stated equals computed |
| DISCREPANCY | They differ. Use computed, document the delta and the likely cause |
| ABSENT | The source omits a category or band that exists in the data |

**Absent bands are the easiest to miss.** In the real case, the summary carried no band at all for
findings blocked by missing access, so four findings were invisible in every rollup.

## Step 4: Integrity checks

| Check | Failure means |
|---|---|
| Duplicate IDs | Two findings share an identifier. Traceability is broken |
| Gaps in the ID sequence | A finding was deleted. Confirm it was deliberate |
| Blank severity | It cannot be prioritised or counted |
| Blank type or area | It cannot be grouped or filtered |
| Blank evidence grade | Its trustworthiness is unknown, which is worse than a low grade |
| Blank file location | It is not actionable |
| Blank recommendation | The reader cannot tell what "fixed" looks like |
| Status values outside the expected set | The tracking column is unreliable |

Report counts, not just a pass or fail, and name the offending IDs where few enough to list.

## Step 5: Derived-figure checks

Beyond the register, recompute anything the reports will quote:

- Codebase size, route count, table count, test file and case counts. Measure them; do not inherit them
  from documentation. In the real case, internal documentation understated tables by 28% and scheduled
  jobs by 27%.
- Coverage. If it cannot be measured, that is the finding. Never estimate.
- Any percentage: recompute from the counts rather than carrying it forward.

## Step 6: Write the reconciliation record

Produce a dedicated sheet or section with one row per check:

```
| Check | Stated / Prior | Computed | Verdict | Note |
```

The Note column carries the explanation, including the probable mechanism. "The block was written at an
earlier point and not refreshed when later findings were appended, while the total was refreshed" is a
useful note. "Numbers differ" is not.

## Step 7: Propagate

Every downstream document quotes the **computed** figures. After drafting, grep every deliverable for the
stale numbers to confirm none survived, except where they appear deliberately inside the reconciliation
narrative itself.

```bash
grep -n "132" deliverables/*.md   # expect hits ONLY in the reconciliation discussion
```

---

## What to tell the client

State the discrepancy plainly, in the report and in the workbook. Suggested framing:

> The workbook's own summary tab carried stale severity and type blocks totalling 132, while its total
> showed 199. Every figure in this package is derived from the detailed findings sheet, which is the
> authoritative source. The discrepancy is documented in full under Data Quality and Reconciliation.

Do not apologise for it and do not bury it. Documenting it is evidence the method works.

---

## The structural fix

Once reconciled, **generate the workbook with a script** so every summary is computed at build time.
A hand-maintained summary block will drift again the moment a finding is added. A computed one cannot.

This is the difference between fixing an instance and fixing the class, and it is the same distinction the
assessment itself draws about the client's codebase.
