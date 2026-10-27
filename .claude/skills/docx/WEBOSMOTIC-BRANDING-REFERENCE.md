# WebOsmotic Branding Reference (Cover Page, Watermark, Captions)

> Extracted from [SKILL.md](SKILL.md) WebOsmotic Project Rules: the branded cover-page reuse procedure, the watermark injection procedure, and the redundant-caption example.

---

### Cover Page: Reuse Reference Template (WebOsmotic Template only)
docx-js cannot reproduce the complex `<wp:anchor>` drawing groups and VML shapes on the branded cover.
Use the **unpack → edit text → pack** strategy instead:

1. Unpack the reference DOCX (`RideIt-Architecture.docx`).
2. Edit only the text runs on the cover page in `word/document.xml` (title, "Presented to", date, from).
3. Keep all `<wp:anchor>` drawing groups and image relationship IDs intact.
4. Replace body content (after the cover `<w:sectPr>`) with new document paragraphs.
5. Pack with `--original RideIt-Architecture.docx` to validate.

**"Presented to" line break:** Use `<w:br/>` inside the paragraph — not a new paragraph — to place the client name on a second line under the label:
```xml
<w:p>
  <w:r><w:t>Presented to</w:t></w:r>
  <w:r><w:br/></w:r>
  <w:r><w:t xml:space="preserve">Ray Johnson, Founder &#x2014; RideIt</w:t></w:r>
</w:p>
```

### Watermark Injection (WebOsmotic Template only)
After generating a DOCX (or when using the template-clone strategy), inject the WebOsmotic watermark:

1. Unpack the generated DOCX.
2. Copy watermark assets from reference DOCX into the unpacked directory:
   - `word/media/image12.png` (165 KB — the 468 pt × 468 pt circular watermark)
   - `word/media/image13.png` (30 KB — fallback badge)
3. Replace `word/header1.xml` with the watermark header from the reference (contains both VML and DrawingML blocks).
4. Add relationships to `word/_rels/header1.xml.rels`: `rId1 → ../media/image12.png`, `rId2 → ../media/image13.png`.
5. Pack with auto-repair.

## No Redundant Image Captions: Example

```js
// WRONG — heading and caption both say "System Architecture"
new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("System Architecture")] }),
new Paragraph({ children: [new ImageRun({ ... })] }),
new Paragraph({ children: [new TextRun({ text: "Figure 1: System Architecture", bold: true })] }), // ← REMOVE

// RIGHT — heading is sufficient; no caption needed
new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("System Architecture")] }),
new Paragraph({ children: [new ImageRun({ ... })] }),
```
