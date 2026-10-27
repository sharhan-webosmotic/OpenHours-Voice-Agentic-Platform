# Delivered Workscope Reference Library

> The workscopes WebOsmotic has actually sent to clients. Read them before
> writing a new one: they are the source of the house pattern, and they settle
> questions the template alone leaves open (what a Deliverables line looks like,
> how short Out of Scope really is, whether the cover carries a person or a
> company).
>
> Internal Google Docs. This file lives in a private repo, so the links are
> recorded here rather than being rediscovered each time.

---

## The current reference: ZENi5 MVP Work Scope (approved)

The approved ZENi5 MVP work scope (8 September 2026, version 36, 22 pages) is
the shape every new workscope follows, and `WORKSCOPE-TEMPLATE.md` is written
from it. Where it differs from the five older documents below, it wins. On the
operator's machine its source lives in the sales workspace at
`D:\Requirement\clients\zeni5\Outcome\` (`ZENi5-Workscope.md`, the rendered
`.docx` and `.pdf`, and its images under `images/`), outside this repo. If that
path is not present, ask the operator for the location. It is client material:
read it in place, never copy it into this repo or into a project's `AI_DOCS/`.

---

## How to read them

Google Docs renders its editor to a canvas, so a normal page fetch returns the
UI chrome and none of the document body. Two consequences:

- `WebFetch` fails outright: these are authenticated documents, and it returns
  HTTP 401.
- The Claude-in-Chrome tools reach them through the operator's own logged-in
  session, but `get_page_text` on the `/edit` URL returns menus and ruler
  numbers, not content.

**Use the `mobilebasic` view.** Swap the URL tail for `/mobilebasic` and the
same document renders as plain HTML that extracts cleanly:

```
https://docs.google.com/document/d/<DOC_ID>/edit          <- canvas, unreadable
https://docs.google.com/document/d/<DOC_ID>/mobilebasic   <- plain HTML, readable
```

Then `mcp__claude-in-chrome__get_page_text` returns the full body. Close the tab
when finished.

---

## The library

| Document | Read it for |
|---|---|
| **Resolve IQ, Production v1** ([doc](https://docs.google.com/document/d/1F1UvcDbgJ5fV5NQsREnqIIYeceA3hwqqDW0YXS2JT4w/edit)) | The most complete recent example. Cover with people's names, lane-grouped milestones with relative durations, the **Milestone and Payment** hours/cost table, a short nine-bullet Out of Scope, a two-bullet Client Responsibilities |
| **QRSound** ([doc](https://docs.google.com/document/d/1CHbpiLoTIrrTSmIQcW1HbMkxevjQDIyUtAlXtDZBScQ/edit)) | Features Breakdown split **by component** (Mobile App / Web App / Backend), Deliverables as component-plus-purpose one-liners, and a **Research and Development** section carving research items out of the quotation |
| **Progress Dialog AI Agent** ([doc](https://docs.google.com/document/d/1rHNWE_fFauQoVMsB5kq4FEifmnAmJ9GLp3N8zpVsCOk/edit)) | The **Future Scope** pattern (named capability plus a one-line description) and the one-line Out of Scope that defers to it: "the scope is limited to the tasks outlined above, except for future scope" |
| **Meeting Bot, Treta Info** ([doc](https://docs.google.com/document/d/1K65PIlrrK0Y0CbjF7CrefYWeUh3u_-jSEV9CZy7iAsw/edit)) | Deliverables by codebase (Bot / Backend System / Documentation), a Client Responsibilities list that is purely third-party account access, and a **Deployment Consideration** section when DevOps is a named line item |
| **Nichiren Chatbot** ([doc](https://docs.google.com/document/d/1j0noyyI564sgoxfWJqXDhrcGhrty93C9k8Bo-chAoVM/edit)) | A **Notes** section carrying technology intentions as "we are considering X or similar", and the closing line "the above estimation is only based on the details mentioned in the document" |

---

## What they establish, and what they do not

These five agree on the following, and `WORKSCOPE-TEMPLATE.md` encodes it:

- The cover names **people** on both sides, never the company on the client side.
- **Out of Scope is short.** One to nine bullets, always closing with a catch-all
  that anything not explicitly described is excluded.
- **Deliverables are components with a purpose**, never a restatement of features.
- **Milestones carry a duration and lane-grouped work.** The five used
  durations relative to commencement. ZENi5 dates them from the tentative
  kick-off, and the template follows ZENi5.
- Cost lives in its own table, never inside the milestone narrative.

They do NOT settle everything, and the template goes beyond them in three places:

- **Future Scope** appears only in Progress Dialog. The template makes it standard
  because it is what keeps Out of Scope honest: without it, deferred work gets
  filed as refused work.
- **General Notes plus Assumptions Made for This Scope** comes from ZENi5, not
  from the five. Assumptions carry the commercial protection, and a
  recommendation the requirement does not state (an accessibility target, a
  compliance posture) is written as an assumption awaiting the client's
  agreement rather than asserted in the document's own voice. Unresolved
  questions stay in the draft review note until answered.
- **Per-milestone acceptance lines** appear in none of them. The template adds
  one `Accepted when` line per milestone so each payment rests on a condition
  the client can check.

When a new delivered workscope introduces a pattern worth keeping, add it here
and reconcile `WORKSCOPE-TEMPLATE.md` in the same change.

<!-- Version: 2026-10-05 | Added the approved ZENi5 MVP work scope as the current reference, read in place in the sales workspace and never copied into this repo. -->
<!-- Version: 2026-10-14 | Ported into ADF: the approved ZENi5 MVP work scope v36 is the current reference, read in place in the operator's sales workspace and never copied in. Reconciled the "what they establish" list with the ZENi5 template (dated milestones, General Notes plus Assumptions, Accepted when lines). Merge with origin/main restored the known sales-workspace location of the ZENi5 source, with an ask-the-operator fallback. -->
