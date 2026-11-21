import type { HtmlElementPatch } from '../types/editor';

export interface IndexedHtmlElement {
  veId: string;
  tagName: string;
  openStart: number;
  openEnd: number;
  closeStart: number;
  closeEnd: number;
  isVoid: boolean;
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const SKIP_INDEXING_TAGS = new Set([
  'html',
  'head',
  'meta',
  'link',
  'title',
  'script',
  'style',
  'base',
  'noscript',
]);

const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

function findTagEnd(html: string, startIndex: number): number {
  let quote: '"' | "'" | null = null;
  for (let i = startIndex; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i + 1;
    }
  }
  return html.length;
}

function findRawTextClose(html: string, fromIndex: number, tagName: string): number {
  const lowerHtml = html.toLowerCase();
  const closePattern = `</${tagName}`;
  let searchPos = fromIndex;
  while (searchPos < lowerHtml.length) {
    const idx = lowerHtml.indexOf(closePattern, searchPos);
    if (idx === -1) return html.length;
    const afterName = lowerHtml[idx + closePattern.length];
    if (afterName === '>' || (afterName !== undefined && /\s/.test(afterName))) {
      return idx;
    }
    searchPos = idx + closePattern.length;
  }
  return html.length;
}

export function scanHtmlElements(html: string): IndexedHtmlElement[] {
  const elements: IndexedHtmlElement[] = [];
  const stack: Array<{
    tagName: string;
    elementIndex: number | null;
  }> = [];

  const lowerHtml = html.toLowerCase();
  const bodyOpenIdx = lowerHtml.indexOf('<body');
  let insideBody = bodyOpenIdx === -1;
  let counter = 0;
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;

    // HTML comments
    if (html.startsWith('<!--', lt)) {
      const commentEnd = html.indexOf('-->', lt + 4);
      i = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    // Doctype / declarations
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      i = findTagEnd(html, lt + 2);
      continue;
    }

    // Closing tag
    if (html[lt + 1] === '/') {
      const closeEnd = findTagEnd(html, lt + 2);
      const rawName = html.slice(lt + 2, closeEnd - 1).trim();
      const closeTagName = rawName.split(/\s/)[0]?.toLowerCase() ?? '';

      if (closeTagName === 'body') {
        insideBody = false;
      }

      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].tagName === closeTagName) {
          const popped = stack.splice(s);
          for (const entry of popped) {
            if (entry.elementIndex !== null) {
              elements[entry.elementIndex].closeStart =
                entry.tagName === closeTagName ? lt : lt;
              elements[entry.elementIndex].closeEnd =
                entry.tagName === closeTagName ? closeEnd : lt;
            }
          }
          break;
        }
      }
      i = closeEnd;
      continue;
    }

    // Opening tag
    const nameMatch = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt));
    if (!nameMatch) {
      i = lt + 1;
      continue;
    }

    const tagName = nameMatch[1].toLowerCase();
    const openEnd = findTagEnd(html, lt + 1 + nameMatch[1].length);
    const rawTag = html.slice(lt, openEnd);
    const isSelfClosing = rawTag.endsWith('/>') || VOID_TAGS.has(tagName);

    if (tagName === 'body') {
      insideBody = true;
      stack.push({ tagName, elementIndex: null });
      i = openEnd;
      continue;
    }

    let assignedIndex: number | null = null;
    if (insideBody && !SKIP_INDEXING_TAGS.has(tagName)) {
      assignedIndex = elements.length;
      elements.push({
        veId: `ve-${counter++}`,
        tagName,
        openStart: lt,
        openEnd,
        closeStart: openEnd,
        closeEnd: openEnd,
        isVoid: isSelfClosing,
      });
    }

    if (RAW_TEXT_TAGS.has(tagName) && !isSelfClosing) {
      const rawCloseStart = findRawTextClose(html, openEnd, tagName);
      const rawCloseEnd =
        rawCloseStart < html.length ? findTagEnd(html, rawCloseStart + 2) : html.length;
      if (assignedIndex !== null) {
        elements[assignedIndex].closeStart = rawCloseStart;
        elements[assignedIndex].closeEnd = rawCloseEnd;
      }
      i = rawCloseEnd;
      continue;
    }

    if (!isSelfClosing) {
      stack.push({ tagName, elementIndex: assignedIndex });
    }

    i = openEnd;
  }

  return elements;
}

export function tagHtmlWithVeIds(html: string): string {
  const elements = scanHtmlElements(html);
  if (elements.length === 0) return html;

  let result = html;
  // Insert from end to start so indices remain valid
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const openTag = result.slice(el.openStart, el.openEnd);
    if (/\bdata-ve-id\s*=/.test(openTag)) continue;

    const insertOffset = openTag.endsWith('/>') ? el.openEnd - 2 : el.openEnd - 1;
    result =
      result.slice(0, insertOffset) +
      ` data-ve-id="${el.veId}"` +
      result.slice(insertOffset);
  }
  return result;
}

export function parseInlineStyleString(styleAttr: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!styleAttr.trim()) return result;

  // Split by semicolons not inside parentheses or quotes
  const declarations: string[] = [];
  let current = '';
  let parenDepth = 0;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < styleAttr.length; i++) {
    const ch = styleAttr[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') parenDepth++;
    if (ch === ')' && parenDepth > 0) parenDepth--;
    if (ch === ';' && parenDepth === 0) {
      if (current.trim()) declarations.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) declarations.push(current.trim());

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = camelToKebab(decl.slice(0, colonIdx).trim());
    const val = decl.slice(colonIdx + 1).trim();
    if (prop && val) {
      result[prop] = val;
    }
  }
  return result;
}

export function serializeInlineStyleMap(styles: Record<string, string>): string {
  const entries = Object.entries(styles).filter(
    ([, value]) => value !== undefined && value !== null && value.trim() !== ''
  );
  return entries.map(([prop, value]) => `${prop}: ${value}`).join('; ');
}

export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttrValue(value: string): string {
  return value.replace(/"/g, '&quot;');
}

function updateOpeningTagStyle(
  openTag: string,
  stylePatch: Record<string, string | null>
): string {
  const styleAttrRegex = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
  const match = styleAttrRegex.exec(openTag);
  const existingMap = match
    ? parseInlineStyleString(match[1] ?? match[2] ?? '')
    : {};

  for (const [rawKey, val] of Object.entries(stylePatch)) {
    const key = camelToKebab(rawKey.trim());
    if (!key) continue;
    if (val === null || val.trim() === '') {
      delete existingMap[key];
    } else {
      existingMap[key] = val.trim();
    }
  }

  const serialized = serializeInlineStyleMap(existingMap);

  if (match) {
    if (!serialized) {
      return openTag.slice(0, match.index) + openTag.slice(match.index + match[0].length);
    }
    return (
      openTag.slice(0, match.index) +
      ` style="${escapeAttrValue(serialized)}"` +
      openTag.slice(match.index + match[0].length)
    );
  }

  if (!serialized) return openTag;

  const insertAt = openTag.endsWith('/>') ? openTag.length - 2 : openTag.length - 1;
  return (
    openTag.slice(0, insertAt) +
    ` style="${escapeAttrValue(serialized)}"` +
    openTag.slice(insertAt)
  );
}

function updateOpeningTagAttributes(
  openTag: string,
  attrsPatch: Record<string, string | null>
): string {
  let result = openTag;

  for (const [rawKey, rawVal] of Object.entries(attrsPatch)) {
    const key = rawKey.trim();
    if (!key || key.toLowerCase() === 'style') continue;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const attrRegex = new RegExp(`\\s${escapedKey}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, 'i');

    if (rawVal === null || rawVal === '') {
      result = result.replace(attrRegex, '');
      continue;
    }

    const encodedAttr = ` ${key}="${escapeAttrValue(rawVal)}"`;
    if (attrRegex.test(result)) {
      result = result.replace(attrRegex, encodedAttr);
    } else {
      const insertAt = result.endsWith('/>') ? result.length - 2 : result.length - 1;
      result = result.slice(0, insertAt) + encodedAttr + result.slice(insertAt);
    }
  }

  return result;
}

export function applyElementPatchToHtml(
  html: string,
  veId: string,
  patch: HtmlElementPatch
): string {
  const elements = scanHtmlElements(html);
  const target = elements.find((el) => el.veId === veId);
  if (!target) return html;

  if (patch.remove) {
    return html.slice(0, target.openStart) + html.slice(target.closeEnd);
  }

  let updatedOpenTag = html.slice(target.openStart, target.openEnd);
  if (patch.attributes) {
    updatedOpenTag = updateOpeningTagAttributes(updatedOpenTag, patch.attributes);
  }
  if (patch.styles) {
    updatedOpenTag = updateOpeningTagStyle(updatedOpenTag, patch.styles);
  }

  if (patch.textContent !== undefined && !target.isVoid) {
    return (
      html.slice(0, target.openStart) +
      updatedOpenTag +
      escapeHtmlText(patch.textContent) +
      html.slice(target.closeStart)
    );
  }

  return (
    html.slice(0, target.openStart) +
    updatedOpenTag +
    html.slice(target.openEnd)
  );
}

export function cssColorToHex(color: string): string {
  const trimmed = color.trim().toLowerCase();
  if (!trimmed || trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)') {
    return '';
  }
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return (
      '#' +
      trimmed[1] +
      trimmed[1] +
      trimmed[2] +
      trimmed[2] +
      trimmed[3] +
      trimmed[3]
    );
  }
  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(trimmed);
  if (!rgbMatch) return '';
  const toHex = (n: string) =>
    Math.max(0, Math.min(255, Number(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
}

export function generateNextNodeId(html: string): string {
  const existing = new Set<number>();
  const regex = /\bdata-ve-node=["']n-(\d+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    existing.add(Number(match[1]));
  }
  let counter = 1;
  while (existing.has(counter)) {
    counter++;
  }
  return `n-${counter}`;
}

export function ensureElementNodeAttr(
  html: string,
  veId: string,
  preferredNodeId?: string
): { html: string; nodeId: string | null } {
  const elements = scanHtmlElements(html);
  const target = elements.find((el) => el.veId === veId);
  if (!target) return { html, nodeId: null };

  const openTag = html.slice(target.openStart, target.openEnd);
  const existingMatch = /\bdata-ve-node=["']([^"']+)["']/i.exec(openTag);
  if (existingMatch) {
    return { html, nodeId: existingMatch[1] };
  }

  const nodeId = preferredNodeId || generateNextNodeId(html);
  const insertAt = openTag.endsWith('/>') ? target.openEnd - 2 : target.openEnd - 1;
  const updatedHtml =
    html.slice(0, insertAt) + ` data-ve-node="${nodeId}"` + html.slice(insertAt);
  return { html: updatedHtml, nodeId };
}

export function insertHtmlSnippet(
  html: string,
  targetVeId: string | null,
  placement: 'inside' | 'after' | 'before',
  snippet: string
): { html: string; insertedVeId: string | null } {
  const elements = scanHtmlElements(html);
  const target = targetVeId ? elements.find((el) => el.veId === targetVeId) : null;

  let insertPos = -1;
  if (target) {
    if (placement === 'inside' && !target.isVoid) {
      insertPos = target.closeStart;
    } else if (placement === 'before') {
      insertPos = target.openStart;
    } else {
      insertPos = target.closeEnd;
    }
  } else {
    const bodyCloseIdx = html.toLowerCase().lastIndexOf('</body>');
    insertPos = bodyCloseIdx !== -1 ? bodyCloseIdx : html.length;
  }

  const formattedSnippet = `\n${snippet}\n`;
  const nextHtml = html.slice(0, insertPos) + formattedSnippet + html.slice(insertPos);

  // Determine the veId of the newly inserted root element
  const updatedElements = scanHtmlElements(nextHtml);
  const insertedEl = updatedElements.find((el) => el.openStart >= insertPos);
  return {
    html: nextHtml,
    insertedVeId: insertedEl ? insertedEl.veId : null,
  };
}

export function ensureStylesheetLinkInHtml(html: string, cssPath: string): string {
  const escaped = cssPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkRegex = new RegExp(`<link\\b[^>]*href=["'](?:\\.\\/)?${escaped}["'][^>]*>`, 'i');
  if (linkRegex.test(html)) return html;

  const linkTag = `    <link rel="stylesheet" href="${cssPath}" />`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${linkTag}\n  </head>`);
  }
  return `${linkTag}\n${html}`;
}

export function listHtmlElementIds(
  html: string
): Array<{ id: string; tagName: string; label: string }> {
  const elements = scanHtmlElements(html);
  const results: Array<{ id: string; tagName: string; label: string }> = [];
  const seen = new Set<string>();

  for (const el of elements) {
    const openTag = html.slice(el.openStart, el.openEnd);
    const idMatch = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(openTag);
    const id = (idMatch?.[1] ?? idMatch?.[2] ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    results.push({
      id,
      tagName: el.tagName,
      label: `<${el.tagName}> #${id}`,
    });
  }

  return results;
}

function findEnclosingTableContext(elements: IndexedHtmlElement[], veId: string) {
  const target = elements.find((el) => el.veId === veId);
  if (!target) return null;

  let tableEl = target.tagName === 'table' ? target : null;
  if (!tableEl) {
    for (let i = elements.length - 1; i >= 0; i--) {
      const candidate = elements[i];
      if (
        candidate.tagName === 'table' &&
        candidate.openStart <= target.openStart &&
        candidate.closeEnd >= target.closeEnd
      ) {
        tableEl = candidate;
        break;
      }
    }
  }
  if (!tableEl) return null;

  const rowsInTable = elements.filter(
    (el) =>
      el.tagName === 'tr' &&
      el.openStart >= tableEl!.openEnd &&
      el.closeEnd <= tableEl!.closeStart
  );
  const cellsInTable = elements.filter(
    (el) =>
      (el.tagName === 'td' || el.tagName === 'th') &&
      el.openStart >= tableEl!.openEnd &&
      el.closeEnd <= tableEl!.closeStart
  );

  return { tableEl, rowsInTable, cellsInTable };
}

export function getTableMetricsInHtml(
  html: string,
  veId: string
): {
  rows: number;
  cols: number;
  cellPadding: string;
  cellAlign: string;
  cellVAlign: string;
  isStriped: boolean;
} | null {
  const elements = scanHtmlElements(html);
  const ctx = findEnclosingTableContext(elements, veId);
  if (!ctx) return null;

  const { rowsInTable, cellsInTable } = ctx;
  const firstRow = rowsInTable[0];
  let cols = 0;
  if (firstRow) {
    cols = cellsInTable.filter(
      (c) => c.openStart >= firstRow.openEnd && c.closeEnd <= firstRow.closeStart
    ).length;
  }

  let cellPadding = '10px 12px';
  let cellAlign = 'left';
  let cellVAlign = 'middle';

  const sampleCell = cellsInTable.find((c) => c.tagName === 'td') || cellsInTable[0];
  if (sampleCell) {
    const openTag = html.slice(sampleCell.openStart, sampleCell.openEnd);
    const styleMatch = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(openTag);
    if (styleMatch) {
      const parsed = parseInlineStyleString(styleMatch[1] ?? styleMatch[2] ?? '');
      if (parsed.padding) cellPadding = parsed.padding;
      if (parsed['text-align']) cellAlign = parsed['text-align'];
      if (parsed['vertical-align']) cellVAlign = parsed['vertical-align'];
    }
  }

  const isStriped = rowsInTable.some((row) => {
    const openTag = html.slice(row.openStart, row.openEnd);
    return /data-ve-striped=["']true["']/i.test(openTag);
  });

  return {
    rows: rowsInTable.length,
    cols,
    cellPadding,
    cellAlign,
    cellVAlign,
    isStriped,
  };
}

export function appendTableRowInHtml(html: string, veId: string): string {
  const elements = scanHtmlElements(html);
  const ctx = findEnclosingTableContext(elements, veId);
  if (!ctx) return html;

  const { tableEl, rowsInTable, cellsInTable } = ctx;
  const firstRow = rowsInTable[0];
  let colCount = 3;
  if (firstRow) {
    const cells = cellsInTable.filter(
      (el) => el.openStart >= firstRow.openEnd && el.closeEnd <= firstRow.closeStart
    );
    if (cells.length > 0) colCount = cells.length;
  }

  const metrics = getTableMetricsInHtml(html, veId);
  const pad = metrics?.cellPadding || '10px 12px';
  const align = metrics?.cellAlign || 'left';
  const valign = metrics?.cellVAlign || 'middle';

  const cellsMarkup = Array.from({ length: colCount }, (_, idx) => {
    return `<td style="padding: ${pad}; border: 1px solid #cbd5e1; color: #334155; text-align: ${align}; vertical-align: ${valign};">Cell ${idx + 1}</td>`;
  }).join('');
  const rowMarkup = `\n  <tr>${cellsMarkup}</tr>`;

  const tbody = elements.find(
    (el) =>
      el.tagName === 'tbody' &&
      el.openStart >= tableEl.openEnd &&
      el.closeEnd <= tableEl.closeStart
  );
  const insertPos = tbody ? tbody.closeStart : tableEl.closeStart;
  return html.slice(0, insertPos) + rowMarkup + '\n' + html.slice(insertPos);
}

export function removeLastTableRowInHtml(html: string, veId: string): string {
  const elements = scanHtmlElements(html);
  const ctx = findEnclosingTableContext(elements, veId);
  if (!ctx || ctx.rowsInTable.length <= 1) return html;

  const tbody = elements.find(
    (el) =>
      el.tagName === 'tbody' &&
      el.openStart >= ctx.tableEl.openEnd &&
      el.closeEnd <= ctx.tableEl.closeStart
  );
  const bodyRows = tbody
    ? ctx.rowsInTable.filter((r) => r.openStart >= tbody.openEnd && r.closeEnd <= tbody.closeStart)
    : ctx.rowsInTable;

  const rowToRemove =
    bodyRows.length > 1 || (tbody && bodyRows.length >= 1 && ctx.rowsInTable.length > bodyRows.length)
      ? bodyRows[bodyRows.length - 1]
      : ctx.rowsInTable[ctx.rowsInTable.length - 1];

  if (!rowToRemove) return html;
  return html.slice(0, rowToRemove.openStart) + html.slice(rowToRemove.closeEnd);
}

export function appendTableColumnInHtml(html: string, veId: string): string {
  const elements = scanHtmlElements(html);
  const ctx = findEnclosingTableContext(elements, veId);
  if (!ctx || ctx.rowsInTable.length === 0) return html;

  const metrics = getTableMetricsInHtml(html, veId);
  const pad = metrics?.cellPadding || '10px 12px';
  const align = metrics?.cellAlign || 'left';
  const valign = metrics?.cellVAlign || 'middle';
  const nextColNum = (metrics?.cols ?? 0) + 1;

  const thead = elements.find(
    (el) =>
      el.tagName === 'thead' &&
      el.openStart >= ctx.tableEl.openEnd &&
      el.closeEnd <= ctx.tableEl.closeStart
  );

  let result = html;
  // Insert from last row to first so character offsets remain valid
  for (let i = ctx.rowsInTable.length - 1; i >= 0; i--) {
    const row = ctx.rowsInTable[i];
    const rowCells = ctx.cellsInTable.filter(
      (c) => c.openStart >= row.openEnd && c.closeEnd <= row.closeStart
    );
    const inThead = thead ? row.openStart >= thead.openEnd && row.closeEnd <= thead.closeStart : false;
    const isHeaderRow = inThead || (rowCells.length > 0 && rowCells.every((c) => c.tagName === 'th'));

    const newCell = isHeaderRow
      ? `<th style="padding: ${pad}; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #0f172a; text-align: ${align}; vertical-align: ${valign}; font-weight: 600;">Column ${nextColNum}</th>`
      : `<td style="padding: ${pad}; border: 1px solid #cbd5e1; color: #334155; text-align: ${align}; vertical-align: ${valign};">Item</td>`;

    result = result.slice(0, row.closeStart) + newCell + result.slice(row.closeStart);
  }

  return result;
}

export function removeLastTableColumnInHtml(html: string, veId: string): string {
  const elements = scanHtmlElements(html);
  const ctx = findEnclosingTableContext(elements, veId);
  if (!ctx || ctx.rowsInTable.length === 0) return html;

  const firstRowCells = ctx.cellsInTable.filter(
    (c) =>
      c.openStart >= ctx.rowsInTable[0].openEnd &&
      c.closeEnd <= ctx.rowsInTable[0].closeStart
  );
  if (firstRowCells.length <= 1) return html;

  let result = html;
  for (let i = ctx.rowsInTable.length - 1; i >= 0; i--) {
    const row = ctx.rowsInTable[i];
    const rowCells = ctx.cellsInTable.filter(
      (c) => c.openStart >= row.openEnd && c.closeEnd <= row.closeStart
    );
    if (rowCells.length <= 1) continue;
    const lastCell = rowCells[rowCells.length - 1];
    result = result.slice(0, lastCell.openStart) + result.slice(lastCell.closeEnd);
  }

  return result;
}

export function updateTableCellsStyleInHtml(
  html: string,
  veId: string,
  cellStyles: Record<string, string | null>
): string {
  const elements = scanHtmlElements(html);
  const ctx = findEnclosingTableContext(elements, veId);
  if (!ctx || ctx.cellsInTable.length === 0) return html;

  let result = html;
  for (let i = ctx.cellsInTable.length - 1; i >= 0; i--) {
    const cell = ctx.cellsInTable[i];
    const openTag = result.slice(cell.openStart, cell.openEnd);
    const updatedTag = updateOpeningTagStyle(openTag, cellStyles);
    result = result.slice(0, cell.openStart) + updatedTag + result.slice(cell.openEnd);
  }
  return result;
}

export function toggleTableStripedRowsInHtml(
  html: string,
  veId: string,
  striped: boolean
): string {
  const elements = scanHtmlElements(html);
  const ctx = findEnclosingTableContext(elements, veId);
  if (!ctx) return html;

  const tbody = elements.find(
    (el) =>
      el.tagName === 'tbody' &&
      el.openStart >= ctx.tableEl.openEnd &&
      el.closeEnd <= ctx.tableEl.closeStart
  );
  const bodyRows = tbody
    ? ctx.rowsInTable.filter((r) => r.openStart >= tbody.openEnd && r.closeEnd <= tbody.closeStart)
    : ctx.rowsInTable.slice(1);

  let result = html;
  for (let i = bodyRows.length - 1; i >= 0; i--) {
    const row = bodyRows[i];
    let openTag = result.slice(row.openStart, row.openEnd);
    const isAltRow = i % 2 === 1;
    openTag = updateOpeningTagStyle(openTag, {
      'background-color': striped && isAltRow ? '#f8fafc' : null,
    });
    openTag = updateOpeningTagAttributes(openTag, {
      'data-ve-striped': striped ? 'true' : null,
    });
    result = result.slice(0, row.openStart) + openTag + result.slice(row.openEnd);
  }
  return result;
}

export function buildTableHtml(rows: number, cols: number): string {
  const safeRows = Math.max(1, Math.min(10, Math.round(rows)));
  const safeCols = Math.max(1, Math.min(10, Math.round(cols)));

  const headerCells = Array.from({ length: safeCols }, (_, c) => {
    return `<th style="padding: 10px 12px; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #0f172a; text-align: left; font-weight: 600;">Column ${c + 1}</th>`;
  }).join('');

  const bodyRowCount = Math.max(1, safeRows - 1);
  const bodyRows = Array.from({ length: bodyRowCount }, (_, r) => {
    const tds = Array.from({ length: safeCols }, (_, c) => {
      return `<td style="padding: 10px 12px; border: 1px solid #cbd5e1; color: #334155;">R${r + 1}C${c + 1}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  return `<table style="width: 100%; border-collapse: collapse; margin: 14px 0; background-color: #ffffff; font-size: 13px;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

export function duplicateElementInHtml(
  html: string,
  veId: string
): { html: string; duplicatedVeId: string | null } {
  const elements = scanHtmlElements(html);
  const target = elements.find((el) => el.veId === veId);
  if (!target) return { html, duplicatedVeId: null };

  let snippet = html.slice(target.openStart, target.closeEnd);
  // Remove data-ve-node / id collisions cleanly on the duplicate
  snippet = snippet
    .replace(/\sdata-ve-node\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (_m, d, s) => {
      const orig = d ?? s ?? '';
      return orig ? ` id="${orig}-copy"` : '';
    });

  const insertPos = target.closeEnd;
  const nextHtml = html.slice(0, insertPos) + '\n' + snippet + html.slice(insertPos);
  const updated = scanHtmlElements(nextHtml);
  const clonedEl = updated.find((el) => el.openStart >= insertPos);
  return {
    html: nextHtml,
    duplicatedVeId: clonedEl ? clonedEl.veId : null,
  };
}

export function createPageHtmlTemplate(
  pageTitle: string,
  cssPath?: string | null
): string {
  const safeTitle = escapeHtmlText(pageTitle.trim() || 'New Page');
  const stylesheetTag = cssPath
    ? `\n    <link rel="stylesheet" href="${escapeAttrValue(cssPath)}" />`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeTitle} page" />${stylesheetTag}
  </head>
  <body>
    <main style="max-width: 960px; margin: 0 auto; padding: 48px 24px;">
      <p style="font-size: 13px; font-weight: 600; color: var(--accent-color, #2563eb); margin-bottom: 8px;">${safeTitle}</p>
      <h1 style="font-size: 32px; font-weight: 700; margin-bottom: 12px;">Welcome to ${safeTitle}</h1>
      <p style="font-size: 15px; opacity: 0.85; margin-bottom: 24px;">Customize this page in Framecraft or link back to your home view.</p>
      <a href="index.html" data-ve-action="page" data-ve-value="index.html" style="display: inline-block; background-color: var(--accent-color, #2563eb); color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;">Back to Home</a>
    </main>
  </body>
</html>
`;
}

export interface SvgShapeHtmlPatch {
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: string | null;
  pathData?: string | null;
  viewBox?: string | null;
}

const SVG_PRIMITIVE_TAGS = new Set([
  'path',
  'polygon',
  'polyline',
  'circle',
  'ellipse',
  'rect',
]);

export function updateSvgShapeInHtml(
  html: string,
  veId: string,
  patch: SvgShapeHtmlPatch
): string {
  const elements = scanHtmlElements(html);
  const target = elements.find((el) => el.veId === veId);
  if (!target) return html;

  let svgEl = target.tagName === 'svg' ? target : null;
  if (!svgEl) {
    for (let i = elements.length - 1; i >= 0; i--) {
      const candidate = elements[i];
      if (
        candidate.tagName === 'svg' &&
        candidate.openStart <= target.openStart &&
        candidate.closeEnd >= target.closeEnd
      ) {
        svgEl = candidate;
        break;
      }
    }
  }
  if (!svgEl) return html;

  const childPrimitive = elements.find(
    (el) =>
      SVG_PRIMITIVE_TAGS.has(el.tagName) &&
      el.openStart >= svgEl!.openEnd &&
      el.closeEnd <= svgEl!.closeStart
  );

  let result = html;

  if (childPrimitive) {
    let childOpen = result.slice(childPrimitive.openStart, childPrimitive.openEnd);
    let nextTagName = childPrimitive.tagName;
    const attrPatch: Record<string, string | null> = {};

    if (patch.fill !== undefined) {
      attrPatch.fill = patch.fill === null || patch.fill === '' ? 'none' : patch.fill;
    }
    if (patch.stroke !== undefined) {
      attrPatch.stroke = patch.stroke === null || patch.stroke === '' ? 'none' : patch.stroke;
    }
    if (patch.strokeWidth !== undefined) {
      attrPatch['stroke-width'] =
        patch.strokeWidth === null || patch.strokeWidth === '' ? null : patch.strokeWidth;
    }

    if (patch.pathData !== undefined && patch.pathData !== null) {
      const trimmedPath = patch.pathData.trim();
      if (/^[mM]\s*[-\d.]/.test(trimmedPath)) {
        if (nextTagName !== 'path') {
          nextTagName = 'path';
          childOpen = childOpen.replace(
            new RegExp(`^<${childPrimitive.tagName}\\b`, 'i'),
            '<path'
          );
          attrPatch.points = null;
          attrPatch.cx = null;
          attrPatch.cy = null;
          attrPatch.r = null;
          attrPatch.rx = null;
          attrPatch.ry = null;
          attrPatch.x = null;
          attrPatch.y = null;
          attrPatch.width = null;
          attrPatch.height = null;
        }
        attrPatch.d = trimmedPath;
      } else if (nextTagName === 'path') {
        attrPatch.d = trimmedPath || null;
      } else if (nextTagName === 'polygon' || nextTagName === 'polyline') {
        attrPatch.points = trimmedPath || null;
      } else if (nextTagName === 'circle') {
        const nums = trimmedPath.match(/-?\d+(?:\.\d+)?/g);
        if (nums && nums.length >= 3) {
          attrPatch.cx = nums[0];
          attrPatch.cy = nums[1];
          attrPatch.r = nums[2];
        }
      } else if (nextTagName === 'rect') {
        const nums = trimmedPath.match(/-?\d+(?:\.\d+)?/g);
        if (nums && nums.length >= 4) {
          attrPatch.x = nums[0];
          attrPatch.y = nums[1];
          attrPatch.width = nums[2];
          attrPatch.height = nums[3];
        }
      }
    }

    childOpen = updateOpeningTagAttributes(childOpen, attrPatch);

    if (!childPrimitive.isVoid && nextTagName !== childPrimitive.tagName) {
      const closeTagText = `</${nextTagName}>`;
      result =
        result.slice(0, childPrimitive.openStart) +
        childOpen +
        result.slice(childPrimitive.openEnd, childPrimitive.closeStart) +
        closeTagText +
        result.slice(childPrimitive.closeEnd);
    } else {
      result =
        result.slice(0, childPrimitive.openStart) +
        childOpen +
        result.slice(childPrimitive.openEnd);
    }
  }

  if (patch.viewBox !== undefined) {
    let svgOpen = result.slice(svgEl.openStart, svgEl.openEnd);
    svgOpen = updateOpeningTagAttributes(svgOpen, { viewBox: patch.viewBox || null });
    result = result.slice(0, svgEl.openStart) + svgOpen + result.slice(svgEl.openEnd);
  }

  return result;
}

export function replaceTextInHtmlBody(
  html: string,
  findText: string,
  replaceText: string,
  matchCase = false
): { html: string; count: number } {
  if (!findText) return { html, count: 0 };

  const escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedFind, matchCase ? 'g' : 'gi');

  const lower = html.toLowerCase();
  const bodyIdx = lower.indexOf('<body');
  let i = bodyIdx !== -1 ? findTagEnd(html, bodyIdx + 5) : 0;
  let out = html.slice(0, i);
  let totalCount = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    const textChunkEnd = lt === -1 ? html.length : lt;

    if (textChunkEnd > i) {
      const chunk = html.slice(i, textChunkEnd);
      const replaced = chunk.replace(regex, () => {
        totalCount++;
        return escapeHtmlText(replaceText);
      });
      out += replaced;
    }

    if (lt === -1) break;

    if (html.startsWith('<!--', lt)) {
      const commentEnd = html.indexOf('-->', lt + 4);
      const end = commentEnd === -1 ? html.length : commentEnd + 3;
      out += html.slice(lt, end);
      i = end;
      continue;
    }

    const tagNameMatch = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt));
    const tagEnd = findTagEnd(html, lt + 1);
    const tagName = tagNameMatch?.[1].toLowerCase() ?? '';

    if (tagName === 'script' || tagName === 'style' || tagName === 'textarea') {
      const rawCloseStart = findRawTextClose(html, tagEnd, tagName);
      const rawCloseEnd =
        rawCloseStart < html.length ? findTagEnd(html, rawCloseStart + 2) : html.length;
      out += html.slice(lt, rawCloseEnd);
      i = rawCloseEnd;
      continue;
    }

    out += html.slice(lt, tagEnd);
    i = tagEnd;
  }

  return { html: out, count: totalCount };
}

export function moveElementSiblingInHtml(
  html: string,
  veId: string,
  direction: 'up' | 'down'
): { html: string; moved: boolean; nextVeId: string | null } {
  const elements = scanHtmlElements(html);
  const escapedId = veId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const attrRegex = new RegExp(`\\bdata-ve-id\\s*=\\s*["']${escapedId}["']`, 'i');
  const targetByAttr = elements.find((el) => attrRegex.test(html.slice(el.openStart, el.openEnd)));
  const target = targetByAttr ?? elements.find((el) => el.veId === veId);
  if (!target) return { html, moved: false, nextVeId: null };

  // Find direct parent element containing target (smallest span enclosing target.openStart..closeEnd)
  let parent: IndexedHtmlElement | null = null;
  for (const el of elements) {
    if (el === target) continue;
    if (el.openEnd <= target.openStart && el.closeStart >= target.closeEnd) {
      if (!parent || el.openStart > parent.openStart) {
        parent = el;
      }
    }
  }

  // Direct children of parent (elements enclosed directly inside parent without another ancestor between them)
  const parentOpenEnd = parent ? parent.openEnd : 0;
  const parentCloseStart = parent ? parent.closeStart : html.length;
  const siblings: IndexedHtmlElement[] = [];

  for (const el of elements) {
    if (el.openStart < parentOpenEnd || el.closeEnd > parentCloseStart) continue;
    if (parent && el === parent) continue;
    // Check if any other element encloses el strictly within parent
    const hasIntermediateAncestor = elements.some(
      (other) =>
        other !== el &&
        other !== parent &&
        other.openStart >= parentOpenEnd &&
        other.closeEnd <= parentCloseStart &&
        other.openEnd <= el.openStart &&
        other.closeStart >= el.closeEnd
    );
    if (!hasIntermediateAncestor) {
      siblings.push(el);
    }
  }

  const idx = siblings.indexOf(target);
  if (idx === -1) return { html, moved: false, nextVeId: null };
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return { html, moved: false, nextVeId: null };
  }

  const first = idx < swapIdx ? siblings[idx] : siblings[swapIdx];
  const second = idx < swapIdx ? siblings[swapIdx] : siblings[idx];

  const firstRaw = html.slice(first.openStart, first.closeEnd);
  const middleGap = html.slice(first.closeEnd, second.openStart);
  const secondRaw = html.slice(second.openStart, second.closeEnd);

  const nextHtml =
    html.slice(0, first.openStart) +
    secondRaw +
    middleGap +
    firstRaw +
    html.slice(second.closeEnd);

  const movedTargetOffset =
    target === first ? first.openStart + secondRaw.length + middleGap.length : first.openStart;
  const updatedElements = scanHtmlElements(nextHtml);
  const movedEl = updatedElements.find((el) => el.openStart === movedTargetOffset);

  return {
    html: nextHtml,
    moved: true,
    nextVeId: movedEl ? movedEl.veId : null,
  };
}




