import type { BreakpointScope, ResponsiveScope } from '../types/editor';
import { camelToKebab, parseInlineStyleString, serializeInlineStyleMap } from './htmlSync';

const START_MARKER = '/* === FRAMECRAFT RESPONSIVE START === */';
const END_MARKER = '/* === FRAMECRAFT RESPONSIVE END === */';

export type ResponsiveRuleStore = Record<
  ResponsiveScope,
  Record<string, Record<string, string>>
>;

/** A single min/max px window. Missing bounds mean "unbounded". */
export interface BreakpointRange {
  minWidth?: number;
  maxWidth?: number;
}

/** One parsed `@media` block from the managed responsive section. */
export interface ScopedMediaBlock {
  range: BreakpointRange;
  rules: Record<string, Record<string, string>>;
}

const PRESET_RANGES: Record<Exclude<ResponsiveScope, 'all'>, BreakpointRange> = {
  desktop: { minWidth: 769 },
  tablet: { minWidth: 481, maxWidth: 768 },
  mobile: { maxWidth: 480 },
};

const PRESET_SCOPE_BY_KEY: Record<string, Exclude<ResponsiveScope, 'all'>> = {
  'min:769': 'desktop',
  'min:481|max:768': 'tablet',
  'max:480': 'mobile',
};

function rangeKey(range: BreakpointRange): string {
  const parts: string[] = [];
  if (range.minWidth !== undefined) parts.push(`min:${range.minWidth}`);
  if (range.maxWidth !== undefined) parts.push(`max:${range.maxWidth}`);
  return parts.join('|');
}

function createEmptyStore(): ResponsiveRuleStore {
  return {
    all: {},
    desktop: {},
    tablet: {},
    mobile: {},
  };
}

function splitManagedSection(css: string): { baseCss: string; managedBody: string } {
  const startIdx = css.indexOf(START_MARKER);
  const endIdx = css.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { baseCss: css, managedBody: '' };
  }
  const before = css.slice(0, startIdx).trimEnd();
  const after = css.slice(endIdx + END_MARKER.length).trimStart();
  const baseCss = [before, after].filter(Boolean).join('\n\n');
  const managedBody = css.slice(startIdx + START_MARKER.length, endIdx).trim();
  return { baseCss, managedBody };
}

/** Returns the managed responsive section verbatim (markers included), or ''. */
export function extractManagedSection(css: string): string {
  const startIdx = css.indexOf(START_MARKER);
  const endIdx = css.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return '';
  return css.slice(startIdx, endIdx + END_MARKER.length);
}

function parseRulesFromBlock(blockCss: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  const ruleRegex = /\[data-ve-node="([^"]+)"\]\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRegex.exec(blockCss)) !== null) {
    const nodeId = match[1];
    // Strip !important for clean editing in UI, re-applied on media serialization
    const cleanedDecls = match[2].replace(/\s*!important\b/gi, '');
    const parsed = parseInlineStyleString(cleanedDecls);
    if (Object.keys(parsed).length > 0) {
      result[nodeId] = { ...(result[nodeId] || {}), ...parsed };
    }
  }
  return result;
}

function parseMediaCondition(condition: string): BreakpointRange {
  const range: BreakpointRange = {};
  const minMatch = /min-width\s*:\s*([\d.]+)px/i.exec(condition);
  const maxMatch = /max-width\s*:\s*([\d.]+)px/i.exec(condition);
  if (minMatch) range.minWidth = Math.round(parseFloat(minMatch[1]));
  if (maxMatch) range.maxWidth = Math.round(parseFloat(maxMatch[1]));
  return range;
}

/**
 * Extracts every `@media` block (including nested-brace-safe bodies) from the managed
 * responsive section, leaving the top-level base rules separate.
 */
export function parseScopedMediaBlocks(css: string): {
  base: Record<string, Record<string, string>>;
  blocks: ScopedMediaBlock[];
} {
  const { managedBody } = splitManagedSection(css);
  if (!managedBody) return { base: {}, blocks: [] };

  let stripped = managedBody;
  const blocks: ScopedMediaBlock[] = [];
  let cursor = 0;

  while (cursor < stripped.length) {
    const atIdx = stripped.indexOf('@media', cursor);
    if (atIdx === -1) break;
    const openIdx = stripped.indexOf('{', atIdx);
    if (openIdx === -1) break;

    let depth = 0;
    let closeIdx = -1;
    for (let i = openIdx; i < stripped.length; i++) {
      const ch = stripped[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          closeIdx = i;
          break;
        }
      }
    }
    if (closeIdx === -1) break;

    const condition = stripped.slice(atIdx + '@media'.length, openIdx);
    const inner = stripped.slice(openIdx + 1, closeIdx);
    const range = parseMediaCondition(condition);
    if (range.minWidth !== undefined || range.maxWidth !== undefined) {
      blocks.push({ range, rules: parseRulesFromBlock(inner) });
    }
    cursor = closeIdx + 1;
  }

  // Remove every media block so only the base rules remain.
  stripped = stripped.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');

  return { base: parseRulesFromBlock(stripped), blocks };
}

/** Maps a breakpoint scope onto an explicit px window (null for base/all-screens). */
export function breakpointScopeToRange(scope: BreakpointScope): BreakpointRange | null {
  if (scope.mode === 'all') return null;
  const range: BreakpointRange = {};
  if (typeof scope.minWidth === 'number' && Number.isFinite(scope.minWidth)) {
    range.minWidth = Math.round(scope.minWidth);
  }
  if (typeof scope.maxWidth === 'number' && Number.isFinite(scope.maxWidth)) {
    range.maxWidth = Math.round(scope.maxWidth);
  }
  if (range.minWidth === undefined && range.maxWidth === undefined) return null;
  return range;
}

export function breakpointRangeToLabel(range: BreakpointRange | null): string {
  if (!range) return 'All Screens';
  const { minWidth, maxWidth } = range;
  if (minWidth !== undefined && maxWidth !== undefined) return `${minWidth}–${maxWidth}px`;
  if (minWidth !== undefined) return `≥ ${minWidth}px`;
  return `≤ ${maxWidth}px`;
}

export function breakpointRangeToMediaQuery(range: BreakpointRange): string {
  const { minWidth, maxWidth } = range;
  if (minWidth !== undefined && maxWidth !== undefined) {
    // Preset order matches the legacy serializer so existing files round-trip untouched.
    if (minWidth === 481 && maxWidth === 768) return '(max-width: 768px) and (min-width: 481px)';
    return `(min-width: ${minWidth}px) and (max-width: ${maxWidth}px)`;
  }
  if (minWidth !== undefined) return `(min-width: ${minWidth}px)`;
  return `(max-width: ${maxWidth}px)`;
}

export function rangeMatchesWidth(range: BreakpointRange, widthPx: number): boolean {
  if (range.minWidth !== undefined && widthPx < range.minWidth) return false;
  if (range.maxWidth !== undefined && widthPx > range.maxWidth) return false;
  return true;
}

function rangesEqual(a: BreakpointRange, b: BreakpointRange): boolean {
  return a.minWidth === b.minWidth && a.maxWidth === b.maxWidth;
}

export function isPresetRange(range: BreakpointRange): boolean {
  return Boolean(PRESET_SCOPE_BY_KEY[rangeKey(range)]);
}

export function presetScopeFromRange(range: BreakpointRange): ResponsiveScope | null {
  return PRESET_SCOPE_BY_KEY[rangeKey(range)] ?? null;
}

export function rangeForPresetScope(scope: Exclude<ResponsiveScope, 'all'>): BreakpointRange {
  return { ...PRESET_RANGES[scope] };
}

export function scopeToBreakpointScope(scope: ResponsiveScope): BreakpointScope {
  if (scope === 'all') return { mode: 'all', label: 'All Screens' };
  const range = rangeForPresetScope(scope);
  return {
    mode: 'preset',
    ...range,
    label: breakpointRangeToLabel(range),
  };
}

export function normalizeBreakpointScope(
  scope: ResponsiveScope | BreakpointScope
): BreakpointScope {
  return typeof scope === 'string' ? scopeToBreakpointScope(scope) : scope;
}

export function parseResponsiveCssStore(css: string): ResponsiveRuleStore {
  const store = createEmptyStore();
  const { base, blocks } = parseScopedMediaBlocks(css);
  Object.assign(store.all, base);
  for (const block of blocks) {
    const preset = presetScopeFromRange(block.range);
    if (!preset) continue;
    for (const [nodeId, decls] of Object.entries(block.rules)) {
      store[preset][nodeId] = { ...(store[preset][nodeId] || {}), ...decls };
    }
  }
  return store;
}

function serializeRulesMap(
  rulesMap: Record<string, Record<string, string>>,
  useImportant: boolean,
  indent = ''
): string {
  const blocks: string[] = [];
  for (const [nodeId, styles] of Object.entries(rulesMap)) {
    const entries = Object.entries(styles).filter(([, val]) => val && val.trim() !== '');
    if (entries.length === 0) continue;
    const decls = entries
      .map(([prop, val]) => `${indent}  ${prop}: ${val}${useImportant ? ' !important' : ''};`)
      .join('\n');
    blocks.push(`${indent}[data-ve-node="${nodeId}"] {\n${decls}\n${indent}}`);
  }
  return blocks.join('\n');
}

function sortBlocks(blocks: ScopedMediaBlock[]): ScopedMediaBlock[] {
  return [...blocks].sort((a, b) => {
    const aMax = a.range.maxWidth ?? Number.POSITIVE_INFINITY;
    const bMax = b.range.maxWidth ?? Number.POSITIVE_INFINITY;
    if (aMax !== bMax) return bMax - aMax;
    return (a.range.minWidth ?? 0) - (b.range.minWidth ?? 0);
  });
}

function serializeManagedSection(
  baseRules: Record<string, Record<string, string>>,
  blocks: ScopedMediaBlock[]
): string {
  const parts: string[] = [];

  const baseCss = serializeRulesMap(baseRules, false);
  if (baseCss) parts.push(baseCss);

  for (const block of sortBlocks(blocks)) {
    const inner = serializeRulesMap(block.rules, true, '  ');
    if (!inner) continue;
    parts.push(`@media ${breakpointRangeToMediaQuery(block.range)} {\n${inner}\n}`);
  }

  if (parts.length === 0) return '';
  return `${START_MARKER}\n${parts.join('\n\n')}\n${END_MARKER}`;
}

export function serializeResponsiveCssStore(store: ResponsiveRuleStore): string {
  const { base, blocks } = parseStoreToBlocks(store);
  return serializeManagedSection(base, blocks);
}

function parseStoreToBlocks(store: ResponsiveRuleStore): {
  base: Record<string, Record<string, string>>;
  blocks: ScopedMediaBlock[];
} {
  const blocks: ScopedMediaBlock[] = [];
  (['desktop', 'tablet', 'mobile'] as const).forEach((preset) => {
    if (Object.keys(store[preset]).length > 0) {
      blocks.push({ range: rangeForPresetScope(preset), rules: store[preset] });
    }
  });
  return { base: store.all, blocks };
}

function mergeRulesIntoBlocks(
  base: Record<string, Record<string, string>>,
  blocks: ScopedMediaBlock[],
  nodeId: string,
  range: BreakpointRange,
  patch: Record<string, string | null>
): { base: Record<string, Record<string, string>>; blocks: ScopedMediaBlock[] } {
  let target = blocks.find((block) => rangesEqual(block.range, range));
  if (!target) {
    target = { range: { ...range }, rules: {} };
    blocks.push(target);
  }
  const currentMap = { ...(target.rules[nodeId] || {}) };
  for (const [rawKey, val] of Object.entries(patch)) {
    const key = camelToKebab(rawKey.trim());
    if (!key) continue;
    if (val === null || val.trim() === '') {
      delete currentMap[key];
    } else {
      currentMap[key] = val.trim();
    }
  }
  if (Object.keys(currentMap).length === 0) {
    delete target.rules[nodeId];
  } else {
    target.rules[nodeId] = currentMap;
  }
  return { base, blocks: blocks.filter((block) => Object.keys(block.rules).length > 0) };
}

export function upsertResponsiveStylesInCss(
  css: string,
  nodeId: string,
  scope: ResponsiveScope,
  patch: Record<string, string | null>
): string {
  return upsertScopedStylesInCss(css, nodeId, scopeToBreakpointScope(scope), patch);
}

/**
 * Writes a patch into the media block matching `scope`, merging with existing
 * declarations. Preset scopes delegate to the legacy store so existing files keep
 * their exact serialization; custom ranges append/merge their own `@media` block.
 */
export function upsertScopedStylesInCss(
  css: string,
  nodeId: string,
  scope: ResponsiveScope | BreakpointScope,
  patch: Record<string, string | null>
): string {
  const normalized = normalizeBreakpointScope(scope);
  const range = breakpointScopeToRange(normalized);
  const { baseCss } = splitManagedSection(css);

  let nextManaged: string;
  if (!range) {
    const store = parseResponsiveCssStore(css);
    const currentMap = { ...(store.all[nodeId] || {}) };
    for (const [rawKey, val] of Object.entries(patch)) {
      const key = camelToKebab(rawKey.trim());
      if (!key) continue;
      if (val === null || val.trim() === '') delete currentMap[key];
      else currentMap[key] = val.trim();
    }
    if (Object.keys(currentMap).length === 0) delete store.all[nodeId];
    else store.all[nodeId] = currentMap;
    nextManaged = serializeResponsiveCssStore(store);
  } else {
    const parsed = parseScopedMediaBlocks(css);
    const merged = mergeRulesIntoBlocks(parsed.base, parsed.blocks, nodeId, range, patch);
    nextManaged = serializeManagedSection(merged.base, merged.blocks);
  }

  if (!nextManaged) return baseCss ? `${baseCss}\n` : '';
  return baseCss ? `${baseCss}\n\n${nextManaged}\n` : `${nextManaged}\n`;
}

/**
 * Removes only the declarations belonging to the given scope. Passing no property
 * list drops the element from that media block entirely.
 */
export function removeScopedDeclarations(
  css: string,
  nodeId: string,
  scope: ResponsiveScope | BreakpointScope,
  properties?: string[]
): string {
  const normalized = normalizeBreakpointScope(scope);
  const range = breakpointScopeToRange(normalized);
  const { baseCss } = splitManagedSection(css);

  if (!range) {
    const store = parseResponsiveCssStore(css);
    const current = { ...(store.all[nodeId] || {}) };
    if (!properties) {
      delete store.all[nodeId];
    } else {
      for (const prop of properties) delete current[camelToKebab(prop)];
      if (Object.keys(current).length === 0) delete store.all[nodeId];
      else store.all[nodeId] = current;
    }
    const next = serializeResponsiveCssStore(store);
    if (!next) return baseCss ? `${baseCss}\n` : '';
    return baseCss ? `${baseCss}\n\n${next}\n` : `${next}\n`;
  }

  const parsed = parseScopedMediaBlocks(css);
  const target = parsed.blocks.find((block) => rangesEqual(block.range, range));
  if (target) {
    if (!properties) {
      delete target.rules[nodeId];
    } else {
      const current = { ...(target.rules[nodeId] || {}) };
      for (const prop of properties) delete current[camelToKebab(prop)];
      if (Object.keys(current).length === 0) delete target.rules[nodeId];
      else target.rules[nodeId] = current;
    }
  }
  const blocks = parsed.blocks.filter((block) => Object.keys(block.rules).length > 0);
  const next = serializeManagedSection(parsed.base, blocks);
  if (!next) return baseCss ? `${baseCss}\n` : '';
  return baseCss ? `${baseCss}\n\n${next}\n` : `${next}\n`;
}

/** Base rules followed by every matching media block, in source (precedence) order. */
export function resolveScopedStyles(
  css: string,
  nodeId: string | null,
  viewportWidth: number
): Record<string, string> {
  if (!nodeId) return {};
  const { base, blocks } = parseScopedMediaBlocks(css);
  const resolved: Record<string, string> = { ...(base[nodeId] || {}) };
  for (const block of blocks) {
    if (!rangeMatchesWidth(block.range, viewportWidth)) continue;
    Object.assign(resolved, block.rules[nodeId] || {});
  }
  return resolved;
}

/**
 * Resolves one property for a viewport width. `source` reports whether the value
 * came from a scoped override, the base CSS, or the caller-supplied fallback.
 */
export function resolveScopedProperty(
  css: string,
  nodeId: string | null,
  property: string,
  viewportWidth: number,
  baseValue?: string | null
): { value: string | null; source: 'scoped' | 'base' | 'inline' | 'none' } {
  if (nodeId) {
    const key = camelToKebab(property);
    const { base, blocks } = parseScopedMediaBlocks(css);
    const resolved: Record<string, string> = { ...(base[nodeId] || {}) };
    let scopedValue: string | undefined;
    for (const block of blocks) {
      if (!rangeMatchesWidth(block.range, viewportWidth)) continue;
      const decls = block.rules[nodeId];
      if (!decls) continue;
      Object.assign(resolved, decls);
      if (decls[key] !== undefined) scopedValue = decls[key];
    }
    if (scopedValue !== undefined) return { value: scopedValue, source: 'scoped' };
    if (resolved[key] !== undefined) return { value: resolved[key], source: 'base' };
  }
  if (baseValue !== undefined && baseValue !== null) return { value: baseValue, source: 'inline' };
  return { value: null, source: 'none' };
}

export function getResponsiveNodeStyles(
  css: string,
  nodeId: string | null,
  scope: ResponsiveScope
): Record<string, string> {
  if (!nodeId) return {};
  const store = parseResponsiveCssStore(css);
  return store[scope][nodeId] || {};
}

/** Overrides for any scope shape, including custom min/max ranges. */
export function getScopedNodeStyles(
  css: string,
  nodeId: string | null,
  scope: ResponsiveScope | BreakpointScope
): Record<string, string> {
  if (!nodeId) return {};
  const normalized = normalizeBreakpointScope(scope);
  const range = breakpointScopeToRange(normalized);
  if (!range) return getResponsiveNodeStyles(css, nodeId, 'all');
  const { blocks } = parseScopedMediaBlocks(css);
  const matching = blocks.filter((block) => rangesEqual(block.range, range));
  const merged: Record<string, string> = {};
  for (const block of matching) Object.assign(merged, block.rules[nodeId] || {});
  return merged;
}

export function getNodeDeviceVisibility(
  css: string,
  nodeId: string | null
): { desktop: boolean; tablet: boolean; mobile: boolean } {
  if (!nodeId) return { desktop: true, tablet: true, mobile: true };
  const store = parseResponsiveCssStore(css);
  return {
    desktop: store.desktop[nodeId]?.display !== 'none',
    tablet: store.tablet[nodeId]?.display !== 'none',
    mobile: store.mobile[nodeId]?.display !== 'none',
  };
}

export function previewScopeStylesString(styles: Record<string, string>): string {
  return serializeInlineStyleMap(styles);
}
