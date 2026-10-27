# Figma Design Analysis (Phase 1.5 Detail)

> Extracted from [SKILL.md](SKILL.md) Phase 1.5, run only when the user provided a Figma link in Batch 5 Q25: the connection config, the metadata/design-context calls, and the summary and gap-analysis output formats.

---

## Phase 1.5: Figma Design Analysis (skip if no Figma link provided)

> [!IMPORTANT]
> Only run this phase if the user provided at least one Figma file link in Batch 5, Q25.
> Requires the **Figma MCP server** to be connected. If it is not available, skip this phase and note it.

### Step 1 — Connect & Authenticate
Ensure the Figma MCP server is active. It is accessible at `https://mcp.figma.com/mcp`.

For Antigravity / local setup, add server config if not already present:
```json
{
  "mcpServers": {
    "figma": { "url": "https://mcp.figma.com/mcp" }
  }
}
```

### Step 2 — Read File Structure
For each Figma link provided:
1. Use `get_metadata` to retrieve the full page/frame tree from the file.
2. List all **pages** found in the file.
3. For each page, list all **top-level frames** (these represent screens or views).

Present a summary:
```
Figma Analysis — [File Name]

Pages found: [N]
  • [Page 1 name] — [X frames/screens]
  • [Page 2 name] — [Y frames/screens]
  ...

Total screens identified: [N]
```

### Step 3 — Extract Design Context per Page
For pages that contain UI screens (not cover/notes pages), use `get_design_context` on key frames to understand:
- What user flows are covered
- What roles / user types the screens are for
- What feature areas are represented (e.g., Auth, Dashboard, Booking, Profile, Settings)

### Step 4 — Cross-Reference: Figma vs Stated Features

Compare the screens found in Figma against the features collected in Batch 3 (Q12 Core Features).

Produce a gap analysis table:

```markdown
## Figma ↔ Workscope Gap Analysis

### ✅ Features with Figma coverage
| Feature Area | Figma Screens Found |
|---|---|
| [Feature] | [Screen names] |

### ⚠️ Features in brief but NOT in Figma
| Feature Area | Status |
|---|---|
| [Feature] | No screens found — design needed or to be confirmed |

### 🔍 Screens in Figma NOT mentioned in brief
| Screen / Frame | Observation |
|---|---|
| [Screen name] | Found in Figma but not discussed — confirm if in scope |
```

> [!WARNING]
> Always surface gaps to the user before proceeding. Ask:
> - "These screens were found in Figma but not mentioned — should they be added to scope?"
> - "These features were discussed but have no screens — confirm whether design is pending or out of scope."

### Step 5 — Update Feature List
After the user confirms, update the combined feature list to reflect:
- Any screens from Figma added to scope
- Any features de-confirmed as out of scope

Store the confirmed Figma links in the workscope document under 4.1 In Scope (as the design baseline) and 11 Assumptions & Dependencies.
