import type { ProjectFile } from '../types/editor';
import { isNonRuntimeBundleFile } from './projectBundler';

const OVERRIDE_CSS_CANDIDATES = ['src/framecraft-edits.css', 'framecraft-edits.css'];
const OVERRIDE_JS_CANDIDATES = ['src/framecraft-edits.js', 'framecraft-edits.js'];

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
    const selector = match[1].trim();
    const ruleBody = match[2];
    const openBrace = ruleBody.indexOf('{');
    const closeBrace = ruleBody.lastIndexOf('}');
    if (openBrace === -1 || closeBrace <= openBrace) continue;
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
      map.set(selector, props);
    }
  }
  return map;
}

function serializeOverrideCssBlocks(map: Map<string, Record<string, string>>): string {
  const blocks: string[] = [];
  for (const [selector, props] of map.entries()) {
    const entries = Object.entries(props).filter(([, v]) => Boolean(v));
    if (entries.length === 0) continue;
    const decls = entries
      .map(([prop, rawVal]) => {
        const val = /\!important\s*$/i.test(rawVal) ? rawVal : `${rawVal} !important`;
        return `  ${prop}: ${val};`;
      })
      .join('\n');
    blocks.push(
      `/* @framecraft-selector:${selector} */\n${selector} {\n${decls}\n}\n/* /@framecraft-selector */`
    );
  }
  return blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}

function ensureCssImportedInEntry(files: ProjectFile[], cssPath: string): ProjectFile[] {
  const cssFileName = cssPath.split('/').pop() || cssPath;
  const entryCandidates = cssPath.startsWith('src/')
    ? ['src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js', 'src/index.tsx', 'src/index.ts', 'src/index.jsx', 'src/index.js']
    : ['main.tsx', 'main.ts', 'main.jsx', 'main.js', 'index.tsx', 'index.ts', 'index.jsx', 'index.js'];

  const entryFile = files.find((f) => entryCandidates.includes(f.path));
  if (!entryFile) return files;
  if (entryFile.content.includes(cssFileName)) return files;

  const importLine = `import './${cssFileName}';\n`;
  return files.map((f) =>
    f.path === entryFile.path ? { ...f, content: `${f.content.trimEnd()}\n${importLine}` } : f
  );
}

export function applyRuntimeStylePatchToFiles(
  files: ProjectFile[],
  selector: string,
  styles: Record<string, string | null>
): ProjectFile[] {
  if (!selector.trim()) return files;
  const cssPath = getPreferredOverrideCssPath(files);
  const existing = files.find((f) => f.path === cssPath);
  const map = parseOverrideCssBlocks(existing?.content ?? '');
  const current = { ...(map.get(selector) ?? {}) };

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
    map.delete(selector);
  } else {
    map.set(selector, current);
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

function serializeRuntimeTextScript(map: Record<string, string>): string {
  const cleanJson = JSON.stringify(map, null, 2);
  return `/* Framecraft Visual Text Overrides */
const FRAMECRAFT_TEXT_OVERRIDES = /* @framecraft-text-map */ ${cleanJson} /* /@framecraft-text-map */;

function applyFramecraftTextOverrides() {
  for (const [selector, text] of Object.entries(FRAMECRAFT_TEXT_OVERRIDES)) {
    try {
      const el = document.querySelector(selector);
      if (el && el.textContent !== text) {
        el.textContent = text;
      }
    } catch {}
  }
}

if (typeof document !== 'undefined') {
  applyFramecraftTextOverrides();
  const observer = new MutationObserver(applyFramecraftTextOverrides);
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
  const map = parseRuntimeTextMap(existing?.content ?? '');
  map[options.selector] = options.nextText;
  const nextJsContent = serializeRuntimeTextScript(map);

  const nextFiles = files.map((f) =>
    f.path === jsPath ? { ...f, content: nextJsContent } : f
  );
  if (!existing) {
    nextFiles.push({
      path: jsPath,
      name: jsPath.split('/').pop() || jsPath,
      type: 'js',
      content: nextJsContent,
    });
    nextFiles.sort((a, b) => a.path.localeCompare(b.path));
  }
  return nextFiles;
}
