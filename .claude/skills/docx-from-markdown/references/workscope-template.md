# Workscope Proposal Structure Reference

> **Role since 2026-10-14:** the 13-section proposal variant was retired. This file is now the source of WebOsmotic's FIXED copy (Why WebOsmotic, the case-study table format, Next Steps, the Acceptance block), which both workscope versions (ballpark and final) include when the workscope intake asks for them. Document structure lives in the `workscope` skill's `BALLPARK-TEMPLATE.md` and `WORKSCOPE-TEMPLATE.md`.

> Canonical source: `templates/webosmotic-master.docx` (pristine copy of the
> official "Sample document formate.docx", registered 2026-06-05). This file
> documents the official 12-section proposal structure, the fixed company
> copy, and how a workscope markdown maps onto the generated DOCX. Read this
> BEFORE generating any workscope or budget proposal DOCX.

## How a workscope DOCX is produced (v3 flow)

The proposal body is written as **markdown** (by `/workscope` or by hand)
following the section skeleton below, then converted:

```bash
python scripts/md_to_docx.py workscope.md <Client>-Workscope-Proposal.docx --mode cover
```

The converter fills the branded cover from frontmatter, pre-renders the TOC,
and renders the markdown body in the master's styles. There is no XML
hand-editing anymore. The old fill-in flow
(`webosmotic-workscope-template.docx` + unpack/pack) is retired.

Markdown produced by `/workscope` v2 arrives pre-aligned to this skeleton
(same section numbering and headings), so conversion is mechanical: no
reshaping, no section mapping.

## Cover frontmatter

```yaml
---
title: "<Project Name>: Workscope & Budget Proposal"
subtitle: "One-line engagement descriptor"        # optional
presented_to: "<Client name, role, company>"
presented_by: "WebOsmotic Private Limited"        # default; override with a person if preferred
date: "5th June 2026"                             # auto-stamps today if omitted
validity_days: 30
---
```

## Document skeleton (keep order and numbering exactly)

| # | Section | Contents |
|---|---|---|
| Cover | (from frontmatter) | Title, optional subtitle, company band, Presented to / Presented By, date |
| TOC | Table of Contents | Real Word TOC field, auto-updates on open |
| 1 | Executive Summary | 2 to 3 short paragraphs |
| 2 | Understanding Your Requirements | 2.1 Background & Context (paragraph), 2.2 Goals & Success Criteria (3+ bullets) |
| 3 | Proposed Solution | 3.1 Solution Overview, 3.2 Key Capabilities (3+ bullets), 3.3 Architecture & Approach (+ diagram), optional 3.4 Non-Functional Requirements |
| 4 | Scope of Work | 4.1 In Scope table (Workstream / Deliverables / Outcome) + per-application feature modules, 4.2 Out of Scope bullets, optional 4.3 Future Scope |
| 5 | Project Plan & Timeline | Phase table (Phase / Activities / Duration) or per-milestone blocks with acceptance-criteria sublists + total duration line |
| 6 | Technology Stack | Layer table (Layer / Tools & Frameworks), trimmed to project-relevant rows |
| 7 | Why WebOsmotic | FIXED copy, reproduce verbatim (below) |
| 8 | Relevant Experience | 2 to 4 case studies (Challenge / Solution / Result tables) |
| 9 | Engagement Model & Team | 9.1 model paragraph, 9.2 team table (Role / Responsibility / Allocation) |
| 10 | Investment | Pricing table (Item / Basis / Amount) + payment terms + currency lines |
| 11 | Assumptions & Dependencies | 4+ rows; workscope v2 sources emit a table (Assumption / Status / Impact if wrong), plain bullets also accepted |
| 12 | Terms & Next Steps | 12.1 Validity, 12.2 Next Steps (fixed bullets + CTA) |
| 13 | Acceptance | OPTIONAL for fixed-scope engagements: signature table (below) |

Use markdown headings: `# 1. Executive Summary`, `## 2.1 Background & Context`.
Section numbers live in the heading text.

## Content guidance per section

- **1 Executive Summary**: open with the client's goal in their own words, in
  2 to 3 sentences restate the objective and the outcome they want. Close with
  the headline of the proposed engagement: what you will build, the rough
  timeline, the engagement model.
- **2.1**: summarize the client's current situation, the problem they raised,
  and any constraints.
- **2.2 bullets**: primary goal, secondary goal, and how success will be
  measured (a KPI the client can track in 90 days or less).
- **3.1**: describe the proposed system end to end, framed around the outcome
  rather than the tech. **3.2 bullets**: what the user gets and the problem
  each capability removes. **3.3**: integrations, data sources, model or
  framework choices, security controls. Generate an Architecture diagram with
  the `diagram-design` plugin, export it to PNG, and embed it here.
- **5**: open with the kept lead-in "WebOsmotic runs two-week sprints with
  weekly demos so you can course-correct early." Durations written as
  "Week 1 to 2" (never "Week 1-2" with a dash). Close with
  `**Total estimated duration:** [N] weeks` plus the note "Indicative
  timeline; final dates confirmed after discovery."
- **6**: open with the kept lead-in "WebOsmotic works across 50+ modern AI
  and software stacks, testing and benchmarking new models continuously."
  Delete table rows for layers the project does not use.
- **8**: choose 2 to 4 past projects closest to the client's industry,
  problem, or tech. Keep Call2Kitchen when relevant. Never list a project not
  actually delivered. Each case study: `## Case Study: <Name> (<Industry>)`
  heading + a HEADERLESS 2-column table (all-empty header row `| | |`) with
  bold `**Challenge**` / `**Solution**` / `**Result**` labels. The converter
  renders no dark band and tints the label column `#EEF3F8` (master look).
- **10**: close with `**Payment terms:** ...` and `**Currency & taxes:** ...`
  bold-label lines.
- **12.1**: "This proposal is valid for [N] days from the date on the cover
  page." (match `validity_days`).

## Fixed copy (reproduce VERBATIM in the markdown)

### Section 7: Why WebOsmotic

Intro paragraph:

> A custom AI development company with 15+ years of experience and 1000+
> solutions delivered for clients across India and the USA. Rated 4.8 by
> clients, with 5.0 on both Clutch and Google.

Four `##` sub-blocks (heading + paragraph each):

1. **Senior ownership on every build:** "Senior leads own delivery end to
   end — no juniors running a project unsupervised. Risks are flagged early,
   blockers are solved directly, and stakeholders are updated each sprint."
2. **Partnerships built to last:** "Most clients stay with WebOsmotic for
   two or more years. Scope, timelines, and cost are kept transparent, and
   the team works alongside yours through discovery, build, and post-launch
   support."
3. **Production systems, mapped to a KPI:** "Every AI build is tied to a
   measurable outcome you can track in 90 days or less, built on secure SDLC
   practices and NIST-based security standards rather than one-off demos."
4. **Security and quality as standard:** "Engagements are delivered with
   SOC 2, HIPAA, GDPR, ISO 27001, and PCI DSS readiness as applicable, with
   architecture reviews, VAPT, and performance audits run before production
   for stable, secure releases."

Template fixed copy keeps its own punctuation verbatim (including its
existing dashes). The no-dash writing rules apply to content YOU write, not
to the approved company text.

### Section 8: Call2Kitchen case study (worked example)

`## Case Study: Call2Kitchen (Food & Beverage, USA)`

| | |
|---|---|
| **Challenge** | A multi-location U.S. café chain was losing staff hours to manual order handling across sites. |
| **Solution** | An AI-powered order management system that automated intake and coordination across locations. |
| **Result** | Saved 80+ staff hours, freeing the team for higher-value work. |

### Section 12.2: Next Steps (fixed bullets + CTA)

1. Review this proposal and share any questions or adjustments.
2. Align on scope, timeline, and commercials.
3. Sign off to kick off discovery.

Closing line (after the list):
`[Book a free consultation](https://calendly.com/webosmotic/book-free-consultation) or write to [sales@webosmotic.com](mailto:sales@webosmotic.com)`

## Section 13: Acceptance (optional, fixed-scope engagements)

```markdown
# 13. Acceptance

Signing below confirms acceptance of the scope, timeline, and commercial
terms described in this proposal.

| For WebOsmotic Private Limited | For [Client Company] |
|---|---|
| Name: | Name: |
| Title: | Title: |
| Signature: | Signature: |
| Date: | Date: |
```

## Style facts the converter applies (for awareness, not action)

| Element | Value |
|---|---|
| Page | US Letter, margins 0.5 in all sides, page 1 chrome-free |
| Fonts | Calibri only (Symbol bullets and Consolas code blocks excepted) |
| Body | Calibri 11pt `#44515E` |
| Heading 1 | Calibri 15pt bold `#0F2A43` |
| Heading 2 | Calibri 12pt bold `#2E75B6` |
| Bold labels | `#0F2A43` |
| Tables | full-width, hairline `#C9D4DF` grid, header fill `#0F2A43` white bold 10pt |
| Bullets | List Paragraph + brand Symbol bullet |
| Chrome | LOGO watermark, header banner, "© <year> WebOsmotic. All rights reserved." footer |

## Final verification (all must pass before delivery)

```bash
python -c "
import zipfile, re
z = zipfile.ZipFile('<output>.docx')
xml = z.read('word/document.xml').decode('utf-8')
print('yellow highlights:', xml.count('w:val=\"yellow\"'))     # must be 0
texts = ' '.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', xml))
print('bracket placeholders:', len(re.findall(r'\[[A-Za-z]', texts)))  # must be 0
print('updateFields:', '<w:updateFields' in z.read('word/settings.xml').decode())
"
```

- [ ] Zero yellow highlights, zero `[bracketed]` placeholder text.
- [ ] Cover shows the real title, client name, presenter, and date.
- [ ] Section 7 and 12.2 fixed copy reproduced verbatim.
- [ ] New content uses "Week 1 to 2" style ranges, no en or em dashes.
- [ ] Durations, totals, and investment numbers are internally consistent
      (phase durations sum to the stated total).
- [ ] The TOC updates itself when the file opens in Word.
