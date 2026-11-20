import type { ResponsiveScope } from '../types/editor';
import { camelToKebab, parseInlineStyleString, serializeInlineStyleMap } from './htmlSync';

const START_MARKER = '/* === FRAMECRAFT RESPONSIVE START === */';
const END_MARKER = '/* === FRAMECRAFT RESPONSIVE END === */';

export type ResponsiveRuleStore = Record<
  ResponsiveScope,
  Record<string, Record<string, string>>
>;

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

export function parseResponsiveCssStore(css: string): ResponsiveRuleStore {
  const store = createEmptyStore();
  const { managedBody } = splitManagedSection(css);
  if (!managedBody) return store;

  // Match @media sections and top-level rules
  const mediaRegex = /@media\s*\(([^)]+)\)\s*\{([\s\S]*?\}\s*)\}/g;
  let strippedBody = managedBody;
  let match: RegExpExecArray | null;

  while ((match = mediaRegex.exec(managedBody)) !== null) {
    const condition = match[1].toLowerCase();
    const inner = match[2];
    strippedBody = strippedBody.replace(match[0], '');

    if (condition.includes('min-width: 769px')) {
      Object.assign(store.desktop, parseRulesFromBlock(inner));
    } else if (condition.includes('max-width: 768px')) {
      Object.assign(store.tablet, parseRulesFromBlock(inner));
    } else if (condition.includes('max-width: 480px')) {
      Object.assign(store.mobile, parseRulesFromBlock(inner));
    }
  }

  Object.assign(store.all, parseRulesFromBlock(strippedBody));
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

export function serializeResponsiveCssStore(store: ResponsiveRuleStore): string {
  const parts: string[] = [];

  const allCss = serializeRulesMap(store.all, false);
  if (allCss) parts.push(allCss);

  const desktopCss = serializeRulesMap(store.desktop, true, '  ');
  if (desktopCss) {
    parts.push(`@media (min-width: 769px) {\n${desktopCss}\n}`);
  }

  const tabletCss = serializeRulesMap(store.tablet, true, '  ');
  if (tabletCss) {
    parts.push(`@media (max-width: 768px) and (min-width: 481px) {\n${tabletCss}\n}`);
  }

  const mobileCss = serializeRulesMap(store.mobile, true, '  ');
  if (mobileCss) {
    parts.push(`@media (max-width: 480px) {\n${mobileCss}\n}`);
  }

  if (parts.length === 0) return '';
  return `${START_MARKER}\n${parts.join('\n\n')}\n${END_MARKER}`;
}

export function upsertResponsiveStylesInCss(
  css: string,
  nodeId: string,
  scope: ResponsiveScope,
  patch: Record<string, string | null>
): string {
  const { baseCss } = splitManagedSection(css);
  const store = parseResponsiveCssStore(css);

  const currentMap = { ...(store[scope][nodeId] || {}) };
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
    delete store[scope][nodeId];
  } else {
    store[scope][nodeId] = currentMap;
  }

  const serializedManaged = serializeResponsiveCssStore(store);
  if (!serializedManaged) {
    return baseCss ? `${baseCss}\n` : '';
  }
  return baseCss ? `${baseCss}\n\n${serializedManaged}\n` : `${serializedManaged}\n`;
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
