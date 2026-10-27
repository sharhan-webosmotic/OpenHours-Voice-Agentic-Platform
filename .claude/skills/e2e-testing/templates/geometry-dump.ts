/**
 * In-page geometry collection + mechanical responsive audit.
 *
 * Used by `responsive-sweep.spec.ts` (same folder). The exported
 * `collectResponsiveAudit` function is serialized into the browser via
 * `page.evaluate`, so its body MUST stay fully self-contained: no imports,
 * no references to anything outside its own scope.
 *
 * It produces two things per screen per viewport width:
 *  1. `nodes`: a bounded geometry dump of meaningful rendered elements
 *     (rect + role + a computed-style subset). Merged per width by
 *     `responsive-report.mjs` into `AI_DOCS/quality/mavs/geometry.<width>.json`,
 *     the ground truth `principal-designer` and the `ui`/`fidelity`
 *     validators read.
 *  2. `violations`: the mechanical responsive battery. Severity `crit`/`high`
 *     findings are functional (a user cannot see or operate something) and
 *     fail the sweep. `med`/`low` are reported but do not fail.
 *
 * Check catalogue (id, severity, what it proves):
 *  RSP-01 crit  page overflows horizontally (document wider than viewport)
 *  RSP-02 high  visible element exceeds the viewport and no scroll container owns it
 *               (crit when the element is interactive)
 *  RSP-03 crit  interactive element covered at its center by a fixed/sticky
 *               overlay that is not its own ancestor (unreachable control)
 *  RSP-04 crit  interactive element rendered at zero size (invisible control)
 *  RSP-05 high  touch target under 44x44 CSS px at mobile widths (<768)
 *  RSP-06 crit  a table wider than its box with no scrollable ancestor, so the
 *               PAGE becomes the scroller (tables must scroll in their own container)
 *  RSP-07 high  image overflows its container / med: image aspect distorted
 *  RSP-08 med   text clipped (scrollWidth > clientWidth) with no ellipsis intent
 *  RSP-09 med   content starts underneath a fixed top bar
 */

/** One rendered element in the geometry dump. */
export interface GeometryNode {
  /** Short locator: data-testid when present, else a tag/class path. */
  sel: string;
  tag: string;
  role: string | null;
  testid: string | null;
  /** Rounded bounding rect: x, y, width, height. */
  rect: [number, number, number, number];
  styles: {
    display: string;
    position: string;
    fontSize: string;
    fontWeight: string;
    overflowX: string;
    textAlign: string;
  };
}

/** One mechanical audit finding. */
export interface ResponsiveViolation {
  id: string;
  severity: 'crit' | 'high' | 'med' | 'low';
  check: string;
  detail: string;
  selector: string;
}

/** The full result returned from the page for one screen at one width. */
export interface ViewportAudit {
  width: number;
  url: string;
  nodes: GeometryNode[];
  violations: ResponsiveViolation[];
}

/**
 * Runs inside the browser (via `page.evaluate`). Walks the rendered DOM,
 * collects the geometry dump, and runs every mechanical responsive check.
 * Fully self-contained by contract (see file header).
 */
export function collectResponsiveAudit(): ViewportAudit {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const MAX_NODES = 1500;
  const nodes: GeometryNode[] = [];
  const violations: ResponsiveViolation[] = [];

  /** True when the element or an ancestor scrolls horizontally on purpose. */
  function inScrollContainer(el: Element): boolean {
    let cur: Element | null = el.parentElement;
    while (cur && cur !== document.body) {
      const ox = getComputedStyle(cur).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
      cur = cur.parentElement;
    }
    return false;
  }

  /** True when the element takes clicks/taps. */
  function isInteractive(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    if (['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(tag)) return true;
    const role = el.getAttribute('role');
    if (role && ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch', 'combobox', 'option'].includes(role)) return true;
    return el.hasAttribute('onclick') || (el as HTMLElement).tabIndex >= 0 && tag !== 'body';
  }

  /** True when the element is rendered (not display:none / detached). */
  function isRendered(el: Element): boolean {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0 || el.childElementCount > 0;
  }

  /** Short, stable-ish locator for reports. */
  function selectorFor(el: Element): string {
    const t = el.getAttribute('data-testid');
    if (t) return `[data-testid="${t}"]`;
    const id = el.getAttribute('id');
    if (id) return `#${id}`;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).slice(0, 2).join('.');
    const tag = el.tagName.toLowerCase();
    const parent = el.parentElement ? el.parentElement.tagName.toLowerCase() : '';
    return `${parent ? parent + '>' : ''}${tag}${cls ? '.' + cls : ''}`;
  }

  function push(id: string, severity: 'crit' | 'high' | 'med' | 'low', check: string, detail: string, el: Element | null): void {
    violations.push({ id, severity, check, detail, selector: el ? selectorFor(el) : 'page' });
  }

  // RSP-01: the page itself must never scroll horizontally.
  if (doc.scrollWidth > vw + 1) {
    push('RSP-01', 'crit', 'page-overflow', `document.scrollWidth ${doc.scrollWidth} exceeds viewport ${vw}`, null);
  }

  const all = Array.from(document.querySelectorAll('body *'));
  const fixedBars: DOMRect[] = [];

  for (const el of all) {
    if (!isRendered(el)) continue;
    // Skip intentionally hidden subtrees (closed drawers/menus carry aria-hidden;
    // the mobile interaction lane audits them OPEN instead).
    if (el.closest('[aria-hidden="true"]')) continue;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const interactive = isInteractive(el);
    // Fully off-canvas elements (closed off-screen drawer pattern) are skipped:
    // the defect class this audit hunts is content STRADDLING the viewport edge.
    const fullyOffCanvas = rect.right <= 0 || rect.left >= vw;

    // Geometry dump: meaningful nodes only, bounded.
    const meaningful = interactive || el.getAttribute('role') !== null ||
      ['nav', 'header', 'main', 'aside', 'footer', 'table', 'form', 'section', 'img', 'h1', 'h2', 'h3', 'th', 'td', 'label'].includes(el.tagName.toLowerCase()) ||
      (rect.width >= 24 && rect.height >= 24);
    if (meaningful && nodes.length < MAX_NODES) {
      nodes.push({
        sel: selectorFor(el),
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        testid: el.getAttribute('data-testid'),
        rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
        styles: {
          display: style.display,
          position: style.position,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          overflowX: style.overflowX,
          textAlign: style.textAlign,
        },
      });
    }

    if ((style.position === 'fixed' || style.position === 'sticky') && rect.top <= 1 && rect.width >= vw * 0.8 && rect.height > 0 && rect.height < 200) {
      fixedBars.push(rect);
    }

    // RSP-02: element straddling the viewport edge with no owning scroll container.
    if (!fullyOffCanvas && (rect.right > vw + 1 || rect.left < -1) && rect.width > 0 && !inScrollContainer(el)) {
      push('RSP-02', interactive ? 'crit' : 'high', 'exceeds-viewport',
        `rect [${Math.round(rect.left)}, ${Math.round(rect.right)}] outside viewport 0..${vw}`, el);
    }

    if (interactive && !fullyOffCanvas && rect.width > 0 && rect.height > 0) {
      // RSP-03: covered control. The topmost element at the center must be
      // the element itself, one of its descendants, or one of its ancestors.
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (cx >= 0 && cx <= vw && cy >= 0 && cy <= window.innerHeight) {
        const top = document.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) {
          const topStyle = getComputedStyle(top);
          const overlay = topStyle.position === 'fixed' || topStyle.position === 'sticky';
          if (overlay) {
            push('RSP-03', 'crit', 'covered-control',
              `center covered by ${selectorFor(top)} (position: ${topStyle.position})`, el);
          }
        }
      }
      // RSP-05: touch targets at mobile widths.
      if (vw < 768 && (rect.width < 44 || rect.height < 44)) {
        const inlineTextLink = el.tagName.toLowerCase() === 'a' && el.parentElement !== null &&
          ['p', 'li', 'td', 'span'].includes(el.parentElement.tagName.toLowerCase());
        if (!inlineTextLink) {
          push('RSP-05', 'high', 'touch-target',
            `${Math.round(rect.width)}x${Math.round(rect.height)}px, minimum is 44x44`, el);
        }
      }
    }

    // RSP-04: zero-size interactive element in a rendered branch. Skips
    // opacity-0 elements (the overlaid-file-input pattern is intentional).
    if (interactive && (rect.width === 0 || rect.height === 0) && style.display !== 'none' && parseFloat(style.opacity) > 0) {
      push('RSP-04', 'crit', 'zero-size-control', 'interactive element renders at zero size', el);
    }

    // RSP-06: table wider than its box with nothing scrolling it.
    if (el.tagName.toLowerCase() === 'table' && el.scrollWidth > el.clientWidth + 2 && !inScrollContainer(el)) {
      push('RSP-06', 'crit', 'table-page-scroll',
        `table scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth} and no ancestor scrolls it`, el);
    }

    // RSP-07: images that overflow or distort.
    if (el.tagName.toLowerCase() === 'img') {
      const img = el as HTMLImageElement;
      const parent = img.parentElement;
      if (parent && rect.width > parent.getBoundingClientRect().width + 1) {
        push('RSP-07', 'high', 'image-overflow', 'image wider than its container (missing max-width: 100%)', el);
      }
      if (img.naturalWidth > 0 && img.naturalHeight > 0 && rect.width > 0 && rect.height > 0) {
        const naturalRatio = img.naturalWidth / img.naturalHeight;
        const renderedRatio = rect.width / rect.height;
        if (Math.abs(naturalRatio - renderedRatio) / naturalRatio > 0.05) {
          push('RSP-07', 'med', 'image-distortion',
            `aspect ratio rendered ${renderedRatio.toFixed(2)} vs natural ${naturalRatio.toFixed(2)}`, el);
        }
      }
    }

    // RSP-08: clipped text with no ellipsis intent.
    const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0);
    if (hasOwnText && el.scrollWidth > el.clientWidth + 2 && !inScrollContainer(el)) {
      if (style.overflowX === 'hidden' && style.textOverflow !== 'ellipsis') {
        push('RSP-08', 'med', 'clipped-text',
          `text clipped (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}) without ellipsis`, el);
      }
    }
  }

  // RSP-09: first content element starting underneath a fixed top bar.
  if (fixedBars.length > 0) {
    const barBottom = Math.max(...fixedBars.map((r) => r.bottom));
    const main = document.querySelector('main') || document.body;
    const firstContent = Array.from(main.children).find((c) => isRendered(c) && getComputedStyle(c).position === 'static');
    if (firstContent) {
      const r = firstContent.getBoundingClientRect();
      if (window.scrollY === 0 && r.top < barBottom - 4 && r.height > 0) {
        push('RSP-09', 'med', 'under-fixed-bar',
          `content top ${Math.round(r.top)} starts under the fixed bar bottom ${Math.round(barBottom)}`, firstContent);
      }
    }
  }

  return { width: vw, url: location.pathname + location.search, nodes, violations };
}
