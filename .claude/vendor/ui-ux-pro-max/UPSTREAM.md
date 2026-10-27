# Upstream: ui-ux-pro-max

- Repo: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Pinned commit: `623a9a9037d006ea727f8213f084d02a6b6f11b5` (2026-10-22 snapshot, upstream release v2.15.0)
- Source path in upstream: `src/ui-ux-pro-max/` (`data/` and four scripts, see `sync-spec.sh`)
- Vendored on: 2026-10-22
- License: MIT (see LICENSE, Copyright 2024 Next Level Builder)

## Included

- `data/`: every knowledge file (styles, products, ui-reasoning, colors, typography, google-fonts, ux-guidelines, landing, charts, app-interface, icons, motion, react-performance, `stacks/*.csv`, `data-provenance.json`, `google-font-licenses.json`, `phosphor-icons-upstream.json`, `catalog-summary.json`).
- `scripts/`: only the offline search path: `search.py`, `core.py`, `design_system.py`, `reasoning_contract.py`. Python stdlib only, no network.

## Excluded, and why

- Logo, CIP and banner generators, `fetch-background.py`, anything calling Gemini, Atlas, MuAPI or Pexels: network or paid APIs.
- The banner-design, slides, brand, design, design-system and ui-styling skills: out of scope, overlap ADF's own design skills.
- Node CLI, docs site, gallery, images, templates, upstream tests and fixtures: not needed for lookup.

Verified: the vendored scripts contain no `urllib.request`, `requests`, `http`, `socket`, `subprocess` or `os.system`.

## Third-party notices

- Google Fonts data: families are licensed OFL (and similar), per-family detail in `data/google-font-licenses.json`. Font files are not vendored, only metadata.
- Icon data derives from Phosphor Icons (MIT), provenance in `data/phosphor-icons-upstream.json` and `data/data-provenance.json`.

## Rules

- Never auto-update. Bump via `scripts/sync-vendor.sh ui-ux-pro-max` after reviewing the diff.
- Never use `--persist`. It writes a MASTER.md that would compete with `design-system/tokens.json`. `scripts/design-lookup.sh` refuses it.
- Run only through `scripts/design-lookup.sh`, which uses `python -I` from a neutral cwd.
- The dataset seeds options and never decides. See `rules/design-rules.md`.
