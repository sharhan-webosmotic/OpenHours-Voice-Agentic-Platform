# Reference only. The rules in this directory do not apply.

This is the ClinicFlow interactive prototype, a Figma Make export. It is the source the
design tokens were extracted from, kept so that every value in `docs/design-system.md` can be
checked against where it came from.

**It is not product code.** It is not linted, type-checked, built, tested or shipped, and
`eslint.config.mjs` ignores this whole directory.

**Do not change anything here**, and do not copy code out of it. Take values, not
implementation: the product is on a different router, a different state library and a
different set of pinned versions, and the prototype stores its session in `sessionStorage`,
which `docs/DECISIONS.md` D-002 forbids.

The real rules are in the repository root `CLAUDE.md`. This file replaced the export's own,
which was a single line importing `AGENTS.md`, the Figma Make agent guide. That guide
describes a dev server on port 8443 and tells you to start work in `src/App.tsx`, neither of
which is true of this repository, and it would have been loaded by anything working in this
directory. `AGENTS.md` is left in place as part of the artefact.
