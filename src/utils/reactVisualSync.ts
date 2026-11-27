import type { ProjectFile, ResponsiveScope } from '../types/editor';
import { isNonRuntimeBundleFile } from './projectBundler';

const OVERRIDE_CSS_CANDIDATES = ['src/framecraft-edits.css', 'framecraft-edits.css'];
const OVERRIDE_JS_CANDIDATES = ['src/framecraft-edits.js', 'framecraft-edits.js'];

const SCOPE_MEDIA_QUERY: Record<Exclude<ResponsiveScope, 'all'>, string> = {
  desktop: '@media (min-width: 769px)',
  tablet: '@media (max-width: 768px) and (min-width: 481px)',
  mobile: '@media (max-width: 480px)',
};

const SCOPE_ORDER: Record<ResponsiveScope, number> = {
  all: 0,
  desktop: 1,
  tablet: 2,
  mobile: 3,
};

function makeOverrideBlockKey(selector: string, scope: ResponsiveScope = 'all'): string {
  return scope === 'all' ? selector : `${scope}::${selector}`;
}

function parseOverrideBlockKey(rawKey: string): { scope: ResponsiveScope; selector: string } {
  const trimmed = rawKey.trim();
  for (const sc of ['desktop', 'tablet', 'mobile'] as const) {
    const prefix = `${sc}::`;
    if (trimmed.startsWith(prefix)) {
      return { scope: sc, selector: trimmed.slice(prefix.length).trim() };
    }
  }
  return { scope: 'all', selector: trimmed };
}

function getPreferredOverrideCssPath(files: ProjectFile[]): string {
  const existing = files.find((f) => OVERRIDE_CSS_CANDIDATES.includes(f.path));
  if (existing) return existing.path;
  const hasSrc = files.some((f) => f.path.startsWith('src/'));
  return hasSrc ? 'src/framecraft-edits.css' : 'framecraft-edits.css';
}

function getPreferredOverrideJsPath(files: ProjectFile[]): string {
  const existing = files.find((f) => OVERRIDE_JS_CANDIDATES.includes(f.path));
  if (existing) return existing.path;
  const hasSrc = files.some((f) => f.path.startsWith('src/'));
  return hasSrc ? 'src/framecraft-edits.js' : 'framecraft-edits.js';
}

function parseOverrideCssBlocks(cssContent: string): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  const blockRe =
    /\/\*\s*@framecraft-selector:([^\n*]+?)\s*\*\/\s*([\s\S]*?)\/\*\s*\/@framecraft-selector\s*\*\//g;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(cssContent)) !== null) {
    const key = match[1].trim();
    const ruleBody = match[2];
    const openBrace = ruleBody.lastIndexOf('{');
    if (openBrace === -1) continue;
    const closeBrace = ruleBody.indexOf('}', openBrace);
    if (closeBrace <= openBrace) continue;
    const declsText = ruleBody.slice(openBrace + 1, closeBrace);
    const props: Record<string, string> = {};
    for (const rawDecl of declsText.split(';')) {
      const trimmed = rawDecl.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(':');
      if (colon === -1) continue;
      const prop = trimmed.slice(0, colon).trim().toLowerCase();
      const val = trimmed.slice(colon + 1).trim();
      if (prop && val) props[prop] = val;
    }
    if (Object.keys(props).length > 0) {
      map.set(key, props);
    }
  }
  return map;
}

function serializeOverrideCssBlocks(map: Map<string, Record<string, string>>): string {
  const orderedEntries = Array.from(map.entries()).sort((a, b) => {
    const sa = parseOverrideBlockKey(a[0]).scope;
    const sb = parseOverrideBlockKey(b[0]).scope;
    return SCOPE_ORDER[sa] - SCOPE_ORDER[sb];
  });

  const blocks: string[] = [];
  for (const [key, props] of orderedEntries) {
    const entries = Object.entries(props).filter(([, v]) => Boolean(v));
    if (entries.length === 0) continue;
    const { scope, selector } = parseOverrideBlockKey(key);
    const indent = scope === 'all' ? '  ' : '    ';
    const decls = entries
      .map(([prop, rawVal]) => {
        const val = /\!important\s*$/i.test(rawVal) ? rawVal : `${rawVal} !important`;
        return `${indent}${prop}: ${val};`;
      })
      .join('\n');

    if (scope === 'all') {
      blocks.push(
        `/* @framecraft-selector:${key} */\n${selector} {\n${decls}\n}\n/* /@framecraft-selector */`
      );
    } else {
      const mq = SCOPE_MEDIA_QUERY[scope];
      blocks.push(
        `/* @framecraft-selector:${key} */\n${mq} {\n  ${selector} {\n${decls}\n  }\n}\n/* /@framecraft-selector */`
      );
    }
  }
  return blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}

function ensureCssImportedInEntry(files: ProjectFile[], assetPath: string): ProjectFile[] {
  const fileName = assetPath.split('/').pop() || assetPath;
  const entryCandidates = assetPath.startsWith('src/')
    ? ['src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js', 'src/index.tsx', 'src/index.ts', 'src/index.jsx', 'src/index.js']
    : ['main.tsx', 'main.ts', 'main.jsx', 'main.js', 'index.tsx', 'index.ts', 'index.jsx', 'index.js'];

  const entryFile = files.find((f) => entryCandidates.includes(f.path));
  if (!entryFile) return files;
  if (entryFile.content.includes(fileName)) return files;

  const importLine = `import './${fileName}';\n`;
  return files.map((f) =>
    f.path === entryFile.path ? { ...f, content: `${f.content.trimEnd()}\n${importLine}` } : f
  );
}

export function getRuntimeStyleOverridesFromCss(
  cssContent: string,
  selector: string,
  scope: ResponsiveScope = 'all'
): Record<string, string> {
  if (!cssContent || !selector.trim()) return {};
  const map = parseOverrideCssBlocks(cssContent);
  const raw = map.get(makeOverrideBlockKey(selector, scope)) ?? {};
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    cleaned[k] = v.replace(/\s*!important\s*$/i, '').trim();
  }
  return cleaned;
}

export function getRuntimeDeviceVisibilityFromCss(
  cssContent: string,
  selector: string
): { desktop: boolean; tablet: boolean; mobile: boolean } {
  if (!cssContent || !selector.trim()) {
    return { desktop: true, tablet: true, mobile: true };
  }
  return {
    desktop: getRuntimeStyleOverridesFromCss(cssContent, selector, 'desktop').display !== 'none',
    tablet: getRuntimeStyleOverridesFromCss(cssContent, selector, 'tablet').display !== 'none',
    mobile: getRuntimeStyleOverridesFromCss(cssContent, selector, 'mobile').display !== 'none',
  };
}

export function applyRuntimeStylePatchToFiles(
  files: ProjectFile[],
  selector: string,
  styles: Record<string, string | null>,
  scope: ResponsiveScope = 'all'
): ProjectFile[] {
  if (!selector.trim()) return files;
  const cssPath = getPreferredOverrideCssPath(files);
  const existing = files.find((f) => f.path === cssPath);
  const map = parseOverrideCssBlocks(existing?.content ?? '');
  const blockKey = makeOverrideBlockKey(selector, scope);
  const current = { ...(map.get(blockKey) ?? {}) };

  for (const [prop, val] of Object.entries(styles)) {
    const normProp = prop.trim().toLowerCase();
    if (!normProp) continue;
    if (val === null || val === '') {
      delete current[normProp];
    } else {
      current[normProp] = val.trim();
    }
  }

  if (Object.keys(current).length === 0) {
    map.delete(blockKey);
  } else {
    map.set(blockKey, current);
  }

  const nextCssContent = serializeOverrideCssBlocks(map);
  let nextFiles = files.map((f) =>
    f.path === cssPath ? { ...f, content: nextCssContent } : f
  );

  if (!existing && nextCssContent.trim()) {
    nextFiles.push({
      path: cssPath,
      name: cssPath.split('/').pop() || cssPath,
      type: 'css',
      content: nextCssContent,
    });
    nextFiles = ensureCssImportedInEntry(nextFiles, cssPath);
    nextFiles.sort((a, b) => a.path.localeCompare(b.path));
  }

  return nextFiles;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeJsxText(str: string): string {
  return str
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function replaceUniqueJsxTextInFiles(
  files: ProjectFile[],
  tagName: string,
  previousText: string,
  nextText: string
): { files: ProjectFile[]; matchedInSource: boolean } {
  const trimmedOld = previousText.trim();
  if (!trimmedOld || trimmedOld === nextText.trim()) {
    return { files, matchedInSource: false };
  }

  const jsxFiles = files.filter(
    (f) =>
      f.type === 'js' &&
      /\.(tsx|jsx)$/i.test(f.path) &&
      !isNonRuntimeBundleFile(f.path)
  );

  const safeTag = escapeRegExp(tagName.toLowerCase());
  const safeOld = escapeRegExp(trimmedOld);

  // Match exact text child inside opening/closing JSX tag or >text< boundaries
  const taggedRe = new RegExp(
    `(<${safeTag}\\b[^>]*>\\s*)${safeOld}(\\s*</${safeTag}>)`,
    'g'
  );
  const directRe = new RegExp(`(>\\s*)${safeOld}(\\s*<)`, 'g');

  const tryMatchPattern = (re: RegExp) => {
    const matches: Array<{ path: string; count: number }> = [];
    for (const file of jsxFiles) {
      re.lastIndex = 0;
      let count = 0;
      while (re.exec(file.content) !== null) {
        count++;
      }
      if (count > 0) matches.push({ path: file.path, count });
    }
    return matches;
  };

  let chosenRe = taggedRe;
  let matches = tryMatchPattern(taggedRe);

  if (matches.length !== 1 || matches[0].count !== 1) {
    chosenRe = directRe;
    matches = tryMatchPattern(directRe);
  }

  if (matches.length !== 1 || matches[0].count !== 1) {
    return { files, matchedInSource: false };
  }

  const targetPath = matches[0].path;
  const replacementText = escapeJsxText(nextText);
  chosenRe.lastIndex = 0;

  const updatedFiles = files.map((file) => {
    if (file.path !== targetPath) return file;
    return {
      ...file,
      content: file.content.replace(chosenRe, (_full, before: string, after: string) => {
        return `${before}${replacementText}${after}`;
      }),
    };
  });

  return { files: updatedFiles, matchedInSource: true };
}

function parseRuntimeTextMap(jsContent: string): Record<string, string> {
  const marker = '/* @framecraft-text-map */';
  const idx = jsContent.indexOf(marker);
  if (idx === -1) return {};
  const endMarker = '/* /@framecraft-text-map */';
  const endIdx = jsContent.indexOf(endMarker, idx);
  if (endIdx === -1) return {};
  const jsonText = jsContent.slice(idx + marker.length, endIdx).trim();
  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function parseRuntimeAttrMap(jsContent: string): Record<string, Record<string, string | null>> {
  const marker = '/* @framecraft-attr-map */';
  const idx = jsContent.indexOf(marker);
  if (idx === -1) return {};
  const endMarker = '/* /@framecraft-attr-map */';
  const endIdx = jsContent.indexOf(endMarker, idx);
  if (endIdx === -1) return {};
  const jsonText = jsContent.slice(idx + marker.length, endIdx).trim();
  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, Record<string, string | null>>)
      : {};
  } catch {
    return {};
  }
}

function serializeRuntimeOverrideScript(
  textMap: Record<string, string>,
  attrMap: Record<string, Record<string, string | null>>
): string {
  const cleanTextJson = JSON.stringify(textMap, null, 2);
  const cleanAttrJson = JSON.stringify(attrMap, null, 2);
  return `/* Framecraft Visual Text & Attribute Overrides */
const FRAMECRAFT_TEXT_OVERRIDES = /* @framecraft-text-map */ ${cleanTextJson} /* /@framecraft-text-map */;
const FRAMECRAFT_ATTR_OVERRIDES = /* @framecraft-attr-map */ ${cleanAttrJson} /* /@framecraft-attr-map */;

function applyFramecraftOverrides() {
  for (const [selector, text] of Object.entries(FRAMECRAFT_TEXT_OVERRIDES)) {
    try {
      const el = document.querySelector(selector);
      if (el && el.textContent !== text) {
        el.textContent = text;
      }
    } catch {}
  }
  for (const [selector, attrs] of Object.entries(FRAMECRAFT_ATTR_OVERRIDES)) {
    try {
      const el = document.querySelector(selector);
      if (!el || !attrs) continue;
      for (const [key, rawVal] of Object.entries(attrs)) {
        if (rawVal === null || rawVal === '') {
          if (el.hasAttribute(key)) el.removeAttribute(key);
        } else {
          const resolvedVal =
            key === 'src' && typeof window.__resolveProjectAsset__ === 'function'
              ? window.__resolveProjectAsset__(rawVal) || rawVal
              : rawVal;
          if (el.getAttribute(key) !== resolvedVal) {
            el.setAttribute(key, resolvedVal);
          }
        }
      }
    } catch {}
  }
}

if (typeof document !== 'undefined') {
  applyFramecraftOverrides();
  const observer = new MutationObserver(applyFramecraftOverrides);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
`;
}

export function applyRuntimeTextPatchToFiles(
  files: ProjectFile[],
  options: {
    selector: string;
    tagName: string;
    previousText: string;
    nextText: string;
  }
): ProjectFile[] {
  const jsxAttempt = replaceUniqueJsxTextInFiles(
    files,
    options.tagName,
    options.previousText,
    options.nextText
  );

  // If safely updated directly in JSX source, no duplicate script override needed
  if (jsxAttempt.matchedInSource) {
    return jsxAttempt.files;
  }

  if (!options.selector.trim()) return files;
  const jsPath = getPreferredOverrideJsPath(files);
  const existing = files.find((f) => f.path === jsPath);
  const textMap = parseRuntimeTextMap(existing?.content ?? '');
  const attrMap = parseRuntimeAttrMap(existing?.content ?? '');
  textMap[options.selector] = options.nextText;
  const nextJsContent = serializeRuntimeOverrideScript(textMap, attrMap);

  let nextFiles = files.map((f) =>
    f.path === jsPath ? { ...f, content: nextJsContent } : f
  );
  if (!existing) {
    nextFiles.push({
      path: jsPath,
      name: jsPath.split('/').pop() || jsPath,
      type: 'js',
      content: nextJsContent,
    });
    nextFiles = ensureCssImportedInEntry(nextFiles, jsPath);
    nextFiles.sort((a, b) => a.path.localeCompare(b.path));
  }
  return nextFiles;
}

export function applyRuntimeAttrPatchToFiles(
  files: ProjectFile[],
  selector: string,
  attributes: Record<string, string | null>
): ProjectFile[] {
  if (!selector.trim()) return files;
  const jsPath = getPreferredOverrideJsPath(files);
  const existing = files.find((f) => f.path === jsPath);
  const textMap = parseRuntimeTextMap(existing?.content ?? '');
  const attrMap = parseRuntimeAttrMap(existing?.content ?? '');
  const current = { ...(attrMap[selector] ?? {}) };
  for (const [k, v] of Object.entries(attributes)) {
    current[k] = v;
  }
  attrMap[selector] = current;
  const nextJsContent = serializeRuntimeOverrideScript(textMap, attrMap);

  let nextFiles = files.map((f) =>
    f.path === jsPath ? { ...f, content: nextJsContent } : f
  );
  if (!existing) {
    nextFiles.push({
      path: jsPath,
      name: jsPath.split('/').pop() || jsPath,
      type: 'js',
      content: nextJsContent,
    });
    nextFiles = ensureCssImportedInEntry(nextFiles, jsPath);
    nextFiles.sort((a, b) => a.path.localeCompare(b.path));
  }
  return nextFiles;
}
