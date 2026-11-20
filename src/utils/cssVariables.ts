import type { CssVariableEntry } from '../types/editor';

export function classifyCssVariableKind(
  name: string,
  value: string
): CssVariableEntry['kind'] {
  const lowerVal = value.trim().toLowerCase();
  const lowerName = name.toLowerCase();

  if (
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(lowerVal) ||
    lowerVal.startsWith('rgb(') ||
    lowerVal.startsWith('rgba(') ||
    lowerVal.startsWith('hsl(') ||
    lowerVal.startsWith('hsla(') ||
    lowerName.includes('color') ||
    lowerName.includes('bg') ||
    lowerName.includes('surface')
  ) {
    return 'color';
  }

  if (/^-?\d*\.?\d+(px|rem|em|%|vw|vh|pt)$/.test(lowerVal)) {
    return 'length';
  }

  if (lowerName.includes('font') || lowerVal.includes('sans-serif') || lowerVal.includes('serif') || lowerVal.includes('mono')) {
    return 'font';
  }

  return 'other';
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function parseRootCssVariables(css: string): CssVariableEntry[] {
  const cleaned = stripCssComments(css);
  const rootRegex = /:root\s*\{([\s\S]*?)\}/g;
  const seen = new Map<string, CssVariableEntry>();

  let match: RegExpExecArray | null;
  while ((match = rootRegex.exec(cleaned)) !== null) {
    const body = match[1];
    const declRegex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);?/g;
    let decl: RegExpExecArray | null;
    while ((decl = declRegex.exec(body)) !== null) {
      const name = decl[1].trim();
      const value = decl[2].trim();
      seen.set(name, {
        name,
        value,
        kind: classifyCssVariableKind(name, value),
      });
    }
  }

  return Array.from(seen.values());
}

export function updateRootCssVariable(
  css: string,
  varName: string,
  nextValue: string
): string {
  const normalizedName = varName.startsWith('--') ? varName.trim() : `--${varName.trim()}`;
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rootRegex = /(:root\s*\{)([\s\S]*?)(\})/;
  const rootMatch = rootRegex.exec(css);

  if (!rootMatch) {
    const newBlock = `:root {\n  ${normalizedName}: ${nextValue.trim()};\n}\n`;
    return css.trim() ? `${newBlock}\n${css}` : newBlock;
  }

  const open = rootMatch[1];
  let body = rootMatch[2];
  const close = rootMatch[3];

  const varRegex = new RegExp(`([ \\t]*)${escapedName}\\s*:\\s*[^;\\n}]+;?`);
  if (varRegex.test(body)) {
    body = body.replace(varRegex, `$1${normalizedName}: ${nextValue.trim()};`);
  } else {
    body = `${body.trimEnd()}\n  ${normalizedName}: ${nextValue.trim()};\n`;
  }

  return (
    css.slice(0, rootMatch.index) +
    `${open}${body}${close}` +
    css.slice(rootMatch.index + rootMatch[0].length)
  );
}

export function deleteRootCssVariable(css: string, varName: string): string {
  const normalizedName = varName.startsWith('--') ? varName.trim() : `--${varName.trim()}`;
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rootRegex = /(:root\s*\{)([\s\S]*?)(\})/;
  const rootMatch = rootRegex.exec(css);
  if (!rootMatch) return css;

  const lineRegex = new RegExp(`[ \\t]*${escapedName}\\s*:\\s*[^;\\n}]+;?\\r?\\n?`, 'g');
  const nextBody = rootMatch[2].replace(lineRegex, '');
  return (
    css.slice(0, rootMatch.index) +
    `${rootMatch[1]}${nextBody}${rootMatch[3]}` +
    css.slice(rootMatch.index + rootMatch[0].length)
  );
}
