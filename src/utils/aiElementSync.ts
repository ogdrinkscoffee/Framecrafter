import type {
  HistoryState,
  ProjectFile,
  SelectedElementInfo,
} from '../types/editor';
import { findElementSourceLocation } from './codeSync';
import { parseRootCssVariables } from './cssVariables';
import { pushHistoryState } from './historyManager';
import { scanHtmlElements } from './htmlSync';
import { isNonRuntimeBundleFile, needsModuleBundling } from './projectBundler';
import type { AiEditFileType } from './serverValidation';

export type ElementSliceMatchStrategy =
  | 've-id'
  | 'jsx-id'
  | 'jsx-text'
  | 'jsx-class'
  | 'jsx-source-loc'
  | 'jsx-tag';

export interface ExtractedElementSlice {
  filePath: string;
  fileType: AiEditFileType;
  tagName: string;
  startOffset: number;
  endOffset: number;
  targetCode: string;
  surroundingContext: string;
  matchStrategy: ElementSliceMatchStrategy;
}

export interface IndexedJsxElement {
  tagName: string;
  openStart: number;
  openEnd: number;
  closeStart: number;
  closeEnd: number;
  isSelfClosing: boolean;
}

export type SyntaxValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export type ApplyAiElementPatchResult =
  | {
      ok: true;
      nextFiles: ProjectFile[];
      updatedFilePath: string;
      sanitizedCode: string;
    }
  | {
      ok: false;
      error: string;
    };

export type CommitAiElementPatchResult =
  | {
      ok: true;
      nextHistory: HistoryState;
      nextFiles: ProjectFile[];
      updatedFilePath: string;
      sanitizedCode: string;
      needsPreviewRebuild: boolean;
    }
  | {
      ok: false;
      error: string;
    };

const HTML_VOID_TAGS = new Set([
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

const HTML_OPTIONAL_CLOSE_TAGS = new Set([
  'li',
  'dt',
  'dd',
  'p',
  'rt',
  'rp',
  'optgroup',
  'option',
  'colgroup',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
]);

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return',
  'throw',
  'case',
  'default',
  'delete',
  'void',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'await',
  'yield',
  'else',
  'do',
]);

const JSX_PRECEDING_KEYWORDS = new Set([
  'return',
  'yield',
  'await',
  'throw',
  'case',
  'default',
  'export',
  'else',
  'typeof',
  'void',
  'delete',
]);

function canPrecedeRegex(prevToken: string): boolean {
  if (!prevToken) return true;
  if (REGEX_PRECEDING_KEYWORDS.has(prevToken)) return true;
  return /^[=([,{;:?!&|^~+\-*%<>]$/.test(prevToken) || prevToken === '=>';
}

function canPrecedeJsx(prevToken: string): boolean {
  if (!prevToken) return true;
  if (JSX_PRECEDING_KEYWORDS.has(prevToken)) return true;
  return (
    prevToken === '=>' ||
    prevToken === '&&' ||
    prevToken === '||' ||
    prevToken === '??' ||
    /^[=([,{;:?!>+\-*%]$/.test(prevToken)
  );
}

function readPreviousSignificantToken(source: string, index: number): string {
  let i = index - 1;
  while (i >= 0) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i--;
      continue;
    }
    // Skip backwards over /* ... */ comments
    if (ch === '/' && i > 0 && source[i - 1] === '*') {
      const commentStart = source.lastIndexOf('/*', i - 2);
      if (commentStart === -1) return '';
      i = commentStart - 1;
      continue;
    }
    break;
  }
  if (i < 0) return '';

  // Two-character tokens
  if (i >= 1) {
    const pair = source.slice(i - 1, i + 1);
    if (pair === '=>' || pair === '&&' || pair === '||' || pair === '??') {
      return pair;
    }
  }

  // Identifier word
  if (/[A-Za-z0-9_$]/.test(source[i])) {
    let start = i;
    while (start > 0 && /[A-Za-z0-9_$]/.test(source[start - 1])) {
      start--;
    }
    return source.slice(start, i + 1);
  }

  return source[i];
}

function skipStringLiteral(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) {
      return i + 1;
    }
    i++;
  }
  return source.length;
}

function skipRegexLiteral(source: string, start: number): number {
  let i = start + 1;
  let inCharClass = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') {
      inCharClass = true;
      i++;
      continue;
    }
    if (ch === ']' && inCharClass) {
      inCharClass = false;
      i++;
      continue;
    }
    if (ch === '/' && !inCharClass) {
      i++;
      while (i < source.length && /[a-zA-Z]/.test(source[i])) {
        i++;
      }
      return i;
    }
    if (ch === '\n' || ch === '\r') {
      // Unterminated regex on line; stop cleanly
      return start + 1;
    }
    i++;
  }
  return source.length;
}

type JsxScannerContextEntry =
  | { kind: 'delim'; value: '(' | '[' | '{' | '${' }
  | { kind: 'jsx'; tagName: string; elementIndex: number };

interface AnalyzedJsxSource {
  elements: IndexedJsxElement[];
  validation: SyntaxValidationResult;
}

function skipBalancedBracesForAttribute(source: string, openBraceIdx: number): number {
  // Attribute expressions can themselves contain JSX tags like prop={<div>It's ok</div>}
  let depth = 0;
  let i = openBraceIdx;
  const ctxStack: JsxScannerContextEntry[] = [];
  let prevToken = '{';

  while (i < source.length) {
    const ch = source[i];
    const top = ctxStack[ctxStack.length - 1];
    const inJsxText = top?.kind === 'jsx';

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (!inJsxText) {
      if (ch === '/' && source[i + 1] === '/') {
        const nl = source.indexOf('\n', i + 2);
        i = nl === -1 ? source.length : nl + 1;
        continue;
      }
      if (ch === '/' && source[i + 1] === '*') {
        const end = source.indexOf('*/', i + 2);
        i = end === -1 ? source.length : end + 2;
        continue;
      }
      if (ch === '/' && source[i - 1] !== '<' && canPrecedeRegex(prevToken)) {
        i = skipRegexLiteral(source, i);
        prevToken = ')';
        continue;
      }
      if (ch === '"' || ch === "'") {
        i = skipStringLiteral(source, i);
        prevToken = 'string';
        continue;
      }
      if (ch === '`') {
        i = skipTemplateLiteral(source, i);
        prevToken = 'string';
        continue;
      }
    }

    if (ch === '{') {
      depth++;
      ctxStack.push({ kind: 'delim', value: '{' });
      prevToken = '{';
      i++;
      continue;
    }

    if (ch === '}') {
      if (top?.kind === 'delim' && top.value === '{') {
        ctxStack.pop();
      }
      depth--;
      prevToken = '}';
      i++;
      if (depth <= 0) {
        return i;
      }
      continue;
    }

    if (ch === '<' && source[i + 1] === '/') {
      const closeMatch = /^<\/([A-Za-z_$][A-Za-z0-9_$.-]*)?\s*>/.exec(source.slice(i));
      if (closeMatch) {
        const closeName = closeMatch[1] ?? '#fragment';
        if (top?.kind === 'jsx' && top.tagName === closeName) {
          ctxStack.pop();
        }
        prevToken = '>';
        i += closeMatch[0].length;
        continue;
      }
    }

    if (ch === '<' && source[i + 1] === '>') {
      if (inJsxText || canPrecedeJsx(prevToken)) {
        ctxStack.push({ kind: 'jsx', tagName: '#fragment', elementIndex: -1 });
        prevToken = '>';
        i += 2;
        continue;
      }
    }

    if (ch === '<') {
      const sliceFromI = source.slice(i);
      const openMatch = /^<([A-Za-z_$][A-Za-z0-9_$.-]*)(?=[\s/>])/.exec(sliceFromI);
      if (openMatch && !/^<[A-Za-z_$][A-Za-z0-9_$]*\s+extends\b/.test(sliceFromI)) {
        if (inJsxText || canPrecedeJsx(prevToken)) {
          const openInfo = findJsxOpeningTagEnd(source, i, openMatch[1].length);
          if (openInfo) {
            if (!openInfo.isSelfClosing) {
              ctxStack.push({ kind: 'jsx', tagName: openMatch[1], elementIndex: -1 });
            }
            prevToken = '>';
            i = openInfo.tagEnd;
            continue;
          }
        }
      }
    }

    if (!inJsxText) {
      if (/[A-Za-z0-9_$]/.test(ch)) {
        let end = i + 1;
        while (end < source.length && /[A-Za-z0-9_$]/.test(source[end])) {
          end++;
        }
        prevToken = source.slice(i, end);
        i = end;
        continue;
      }
      if (ch === '=' && source[i + 1] === '>') {
        prevToken = '=>';
        i += 2;
        continue;
      }
      prevToken = ch;
    }

    i++;
  }

  return source.length;
}

function skipTemplateLiteral(source: string, start: number): number {
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '`') {
      return i + 1;
    }
    if (ch === '$' && source[i + 1] === '{') {
      i = skipBalancedBracesForAttribute(source, i + 1);
      continue;
    }
    i++;
  }
  return source.length;
}

function findJsxOpeningTagEnd(
  source: string,
  tagStart: number,
  nameLength: number
): { tagEnd: number; isSelfClosing: boolean } | null {
  let i = tagStart + 1 + nameLength;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      i = skipStringLiteral(source, i);
      continue;
    }
    if (ch === '`') {
      i = skipTemplateLiteral(source, i);
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i + 2);
      i = nl === -1 ? source.length : nl + 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (ch === '{') {
      i = skipBalancedBracesForAttribute(source, i);
      continue;
    }
    if (ch === '/' && source[i + 1] === '>') {
      return { tagEnd: i + 2, isSelfClosing: true };
    }
    if (ch === '>') {
      return { tagEnd: i + 1, isSelfClosing: false };
    }
    i++;
  }
  return null;
}

function analyzeJsxSource(source: string): AnalyzedJsxSource {
  const elements: IndexedJsxElement[] = [];
  const ctxStack: JsxScannerContextEntry[] = [];
  let syntaxError: string | null = null;
  let i = 0;
  let prevToken = '';

  const recordError = (msg: string) => {
    if (!syntaxError) syntaxError = msg;
  };

  const scanTemplate = (start: number): string | null => {
    let idx = start + 1;
    while (idx < source.length) {
      const ch = source[idx];
      if (ch === '\\') {
        idx += 2;
        continue;
      }
      if (ch === '`') {
        i = idx + 1;
        return null;
      }
      if (ch === '$' && source[idx + 1] === '{') {
        ctxStack.push({ kind: 'delim', value: '${' });
        prevToken = '{';
        i = idx + 2;
        return 'ENTER_EXPR';
      }
      idx++;
    }
    return 'Unterminated template literal.';
  };

  while (i < source.length) {
    const ch = source[i];
    const top = ctxStack[ctxStack.length - 1];
    const inJsxText = top?.kind === 'jsx';

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (!inJsxText && ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i + 2);
      i = nl === -1 ? source.length : nl + 1;
      continue;
    }
    if (!inJsxText && ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) {
        recordError('Unterminated block comment /* ... */.');
        break;
      }
      i = end + 2;
      continue;
    }

    if (!inJsxText) {
      if (ch === '/' && source[i - 1] !== '<' && canPrecedeRegex(prevToken)) {
        i = skipRegexLiteral(source, i);
        prevToken = ')';
        continue;
      }
      if (ch === '"' || ch === "'") {
        const end = skipStringLiteral(source, i);
        if (end >= source.length && source[source.length - 1] !== ch) {
          recordError('Unterminated string literal.');
        }
        i = end;
        prevToken = 'string';
        continue;
      }
      if (ch === '`') {
        const tmplErr = scanTemplate(i);
        if (tmplErr === 'ENTER_EXPR') {
          continue;
        }
        if (tmplErr) {
          recordError(tmplErr);
          break;
        }
        prevToken = 'string';
        continue;
      }
    }

    if (ch === '}' && top?.kind === 'delim' && top.value === '${') {
      ctxStack.pop();
      const tmplErr = scanTemplate(i);
      if (tmplErr === 'ENTER_EXPR') {
        continue;
      }
      if (tmplErr) {
        recordError(tmplErr);
        break;
      }
      prevToken = 'string';
      continue;
    }

    if (ch === '{') {
      ctxStack.push({ kind: 'delim', value: '{' });
      prevToken = '{';
      i++;
      continue;
    }

    if (!inJsxText && (ch === '(' || ch === '[')) {
      ctxStack.push({ kind: 'delim', value: ch });
      prevToken = ch;
      i++;
      continue;
    }

    if (ch === '}' || (!inJsxText && (ch === ')' || ch === ']'))) {
      const expected = ch === ')' ? '(' : ch === ']' ? '[' : '{';
      const popped = ctxStack.pop();
      if (!popped || popped.kind !== 'delim' || popped.value !== expected) {
        recordError(`Unbalanced delimiter "${ch}".`);
        break;
      }
      prevToken = ch;
      i++;
      continue;
    }

    // JSX Closing tag `</Tag>` or `</>`
    if (ch === '<' && source[i + 1] === '/') {
      const closeMatch = /^<\/([A-Za-z_$][A-Za-z0-9_$.-]*)?\s*>/.exec(source.slice(i));
      if (closeMatch) {
        const closeName = closeMatch[1] ?? '#fragment';
        const closeEnd = i + closeMatch[0].length;
        const popped = ctxStack.pop();
        if (!popped || popped.kind !== 'jsx' || popped.tagName !== closeName) {
          const expectedMsg =
            popped?.kind === 'jsx' ? ` (expected </${popped.tagName}>)` : '';
          recordError(
            `Mismatched JSX closing tag </${closeName === '#fragment' ? '' : closeName}>${expectedMsg}.`
          );
          break;
        }
        if (popped.elementIndex >= 0) {
          elements[popped.elementIndex].closeStart = i;
          elements[popped.elementIndex].closeEnd = closeEnd;
        }
        prevToken = '>';
        i = closeEnd;
        continue;
      }
    }

    // JSX Fragment opening `<>`
    if (ch === '<' && source[i + 1] === '>') {
      const tokenBefore = inJsxText ? '>' : prevToken || readPreviousSignificantToken(source, i);
      if (inJsxText || canPrecedeJsx(tokenBefore)) {
        const idx = elements.length;
        elements.push({
          tagName: '#fragment',
          openStart: i,
          openEnd: i + 2,
          closeStart: i + 2,
          closeEnd: i + 2,
          isSelfClosing: false,
        });
        ctxStack.push({ kind: 'jsx', tagName: '#fragment', elementIndex: idx });
        prevToken = '>';
        i += 2;
        continue;
      }
    }

    // JSX Opening tag `<Tag ...>` or `<Tag ... />`
    if (ch === '<') {
      const sliceFromI = source.slice(i);
      const openMatch = /^<([A-Za-z_$][A-Za-z0-9_$.-]*)(?=[\s/>])/.exec(sliceFromI);
      if (openMatch && !/^<[A-Za-z_$][A-Za-z0-9_$]*\s+extends\b/.test(sliceFromI)) {
        const tokenBefore = inJsxText ? '>' : prevToken || readPreviousSignificantToken(source, i);
        if (inJsxText || canPrecedeJsx(tokenBefore)) {
          const tagName = openMatch[1];
          const openInfo = findJsxOpeningTagEnd(source, i, tagName.length);
          if (!openInfo) {
            recordError(`Unterminated JSX opening tag <${tagName}>.`);
            break;
          }
          const attrRegion = source.slice(
            i + 1 + tagName.length,
            openInfo.tagEnd - (openInfo.isSelfClosing ? 2 : 1)
          );
          const braceBalanced = validateBalancedDelimitersInSnippet(attrRegion);
          if (!braceBalanced.ok) {
            recordError(braceBalanced.error);
            break;
          }
          const idx = elements.length;
          elements.push({
            tagName,
            openStart: i,
            openEnd: openInfo.tagEnd,
            closeStart: openInfo.tagEnd,
            closeEnd: openInfo.tagEnd,
            isSelfClosing: openInfo.isSelfClosing,
          });
          if (!openInfo.isSelfClosing) {
            ctxStack.push({ kind: 'jsx', tagName, elementIndex: idx });
          }
          // Recursively index any JSX elements embedded inside prop `{ ... }` expressions (e.g. icon={<Icon />})
          const propJsxMatches = analyzeAttributeEmbeddedJsx(
            source,
            i + 1 + tagName.length,
            openInfo.tagEnd - (openInfo.isSelfClosing ? 2 : 1)
          );
          for (const nested of propJsxMatches) {
            elements.push(nested);
          }

          prevToken = '>';
          i = openInfo.tagEnd;
          continue;
        }
      }
    }

    if (!inJsxText) {
      if (/[A-Za-z0-9_$]/.test(ch)) {
        let end = i + 1;
        while (end < source.length && /[A-Za-z0-9_$]/.test(source[end])) {
          end++;
        }
        prevToken = source.slice(i, end);
        i = end;
        continue;
      }
      if (
        (ch === '=' && source[i + 1] === '>') ||
        (ch === '&' && source[i + 1] === '&') ||
        (ch === '|' && source[i + 1] === '|') ||
        (ch === '?' && source[i + 1] === '?')
      ) {
        prevToken = source.slice(i, i + 2);
        i += 2;
        continue;
      }
      prevToken = ch;
    }

    i++;
  }

  if (!syntaxError && ctxStack.length > 0) {
    const unclosed = ctxStack[ctxStack.length - 1];
    if (unclosed.kind === 'jsx') {
      syntaxError = `Unclosed JSX element <${unclosed.tagName === '#fragment' ? '' : unclosed.tagName}>.`;
    } else {
      syntaxError = `Unclosed "${unclosed.value}" delimiter.`;
    }
  }

  return {
    elements: elements.sort((a, b) => a.openStart - b.openStart),
    validation: syntaxError ? { ok: false, error: syntaxError } : { ok: true },
  };
}

function analyzeAttributeEmbeddedJsx(
  source: string,
  attrStart: number,
  attrEnd: number
): IndexedJsxElement[] {
  const results: IndexedJsxElement[] = [];
  let i = attrStart;
  while (i < attrEnd) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      i = skipStringLiteral(source, i);
      continue;
    }
    if (ch === '`') {
      i = skipTemplateLiteral(source, i);
      continue;
    }
    if (ch === '{') {
      const exprStart = i + 1;
      const exprEnd = skipBalancedBracesForAttribute(source, i);
      const inner = source.slice(exprStart, Math.max(exprStart, exprEnd - 1));
      if (inner.includes('<')) {
        const innerAnalyzed = analyzeJsxSource(inner);
        for (const item of innerAnalyzed.elements) {
          results.push({
            tagName: item.tagName,
            openStart: exprStart + item.openStart,
            openEnd: exprStart + item.openEnd,
            closeStart: exprStart + item.closeStart,
            closeEnd: exprStart + item.closeEnd,
            isSelfClosing: item.isSelfClosing,
          });
        }
      }
      i = exprEnd;
      continue;
    }
    i++;
  }
  return results;
}

/**
 * Scans TSX/JSX source code and extracts exact character offsets for JSX elements.
 * Properly ignores strings, template literals, comments, regexes, TypeScript generics,
 * and nested `{ ... }` expressions.
 */
export function scanJsxElements(source: string): IndexedJsxElement[] {
  return analyzeJsxSource(source).elements;
}

/**
 * Collects `:root` CSS custom properties across project stylesheets.
 */
export function extractDesignTokensMap(
  files: ProjectFile[],
  maxTokens = 60
): Record<string, string> {
  const cssFiles = files
    .filter((f) => f.type === 'css' && !isNonRuntimeBundleFile(f.path))
    .sort((a, b) => {
      const rank = (p: string) => {
        const lower = p.toLowerCase();
        if (/(^|\/)(tokens|variables|theme)\.css$/.test(lower)) return 0;
        if (/(^|\/)(styles|index|globals|main|app)\.css$/.test(lower)) return 1;
        return 2;
      };
      return rank(a.path) - rank(b.path) || a.path.localeCompare(b.path);
    });

  const tokens: Record<string, string> = {};
  let count = 0;

  for (const file of cssFiles) {
    const entries = parseRootCssVariables(file.content);
    for (const entry of entries) {
      if (!(entry.name in tokens) && count >= maxTokens) {
        return tokens;
      }
      if (!(entry.name in tokens)) {
        count++;
      }
      tokens[entry.name] = entry.value;
    }
  }

  return tokens;
}

function buildSurroundingContext(
  filePath: string,
  content: string,
  startOffset: number,
  endOffset: number
): string {
  const beforeBudget = 1100;
  const afterBudget = 1100;
  const beforeStart = Math.max(0, startOffset - beforeBudget);
  const afterEnd = Math.min(content.length, endOffset + afterBudget);

  const before = content.slice(beforeStart, startOffset).trimStart();
  const after = content.slice(endOffset, afterEnd).trimEnd();

  return [
    `File: ${filePath}`,
    before ? `--- BEFORE TARGET ---\n${before}` : '',
    '--- [TARGET ELEMENT] ---',
    after ? `--- AFTER TARGET ---\n${after}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 3800);
}

function extractStaticIdFromOpeningTag(openTag: string): string {
  const m = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|\{["'`]([^"'`]+)["'`]\})/.exec(openTag);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim();
}

function extractStaticClassesFromOpeningTag(openTag: string): Set<string> {
  const out = new Set<string>();
  const attrRe = /\b(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(openTag)) !== null) {
    const raw = m[1] ?? m[2] ?? m[3] ?? '';
    for (const token of raw.split(/\s+/)) {
      const cleaned = token.replace(/\$\{[^}]*\}/g, '').trim();
      if (cleaned) out.add(cleaned);
    }
  }
  return out;
}

function stripTagsAndNormalizeText(markup: string): string {
  return markup
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function offsetToLineNumber(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function extractHtmlElementSlice(
  files: ProjectFile[],
  entryHtmlPath: string | null,
  selectedElement: SelectedElementInfo
): ExtractedElementSlice | null {
  if (!entryHtmlPath || !selectedElement.veId) return null;
  const htmlFile = files.find((f) => f.path === entryHtmlPath && f.type === 'html');
  if (!htmlFile) return null;

  const elements = scanHtmlElements(htmlFile.content);
  const target = elements.find((el) => el.veId === selectedElement.veId);
  if (!target) return null;

  const targetCode = htmlFile.content.slice(target.openStart, target.closeEnd);
  if (!targetCode.trim()) return null;

  return {
    filePath: htmlFile.path,
    fileType: 'html',
    tagName: target.tagName,
    startOffset: target.openStart,
    endOffset: target.closeEnd,
    targetCode,
    surroundingContext: buildSurroundingContext(
      htmlFile.path,
      htmlFile.content,
      target.openStart,
      target.closeEnd
    ),
    matchStrategy: 've-id',
  };
}

function extractJsxElementSlice(
  files: ProjectFile[],
  entryHtmlPath: string | null,
  selectedElement: SelectedElementInfo
): ExtractedElementSlice | null {
  const jsxFiles = files
    .filter(
      (f) =>
        f.type === 'js' &&
        /\.(tsx|jsx)$/i.test(f.path) &&
        !isNonRuntimeBundleFile(f.path)
    )
    .sort((a, b) => {
      const aApp = /(^|\/)app\.[jt]sx$/i.test(a.path) ? 0 : 1;
      const bApp = /(^|\/)app\.[jt]sx$/i.test(b.path) ? 0 : 1;
      return aApp - bApp || a.path.localeCompare(b.path);
    });

  if (jsxFiles.length === 0) return null;

  const targetTag = selectedElement.tagName.toLowerCase();
  const targetId = selectedElement.id.trim();
  const trimmedText = selectedElement.textContent.replace(/\s+/g, ' ').trim();
  const targetClasses = selectedElement.className
    .split(/\s+/)
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith('data-ve'));

  const sourceLoc = findElementSourceLocation(files, entryHtmlPath, selectedElement);

  let bestCandidate: {
    file: ProjectFile;
    node: IndexedJsxElement;
    score: number;
    strategy: ElementSliceMatchStrategy;
  } | null = null;

  for (const file of jsxFiles) {
    const scanned = scanJsxElements(file.content);
    for (const node of scanned) {
      if (node.tagName === '#fragment') continue;
      if (node.tagName.toLowerCase() !== targetTag) continue;

      const openTag = file.content.slice(node.openStart, node.openEnd);
      const fullSlice = file.content.slice(node.openStart, node.closeEnd);
      let score = 0;
      let strategy: ElementSliceMatchStrategy = 'jsx-tag';

      const nodeId = extractStaticIdFromOpeningTag(openTag);
      if (targetId && nodeId === targetId) {
        score += 10000;
        strategy = 'jsx-id';
      }

      if (trimmedText && trimmedText.length <= 200) {
        const innerRaw = node.isSelfClosing
          ? ''
          : file.content.slice(node.openEnd, node.closeStart);
        const normalizedInner = stripTagsAndNormalizeText(innerRaw);
        if (normalizedInner && normalizedInner === trimmedText) {
          const isLeaf = !/<[A-Za-z]/.test(innerRaw);
          score += isLeaf ? 5000 : 2500;
          if (strategy === 'jsx-tag') strategy = 'jsx-text';
        }
      }

      if (targetClasses.length > 0) {
        const nodeClasses = extractStaticClassesFromOpeningTag(openTag);
        let overlap = 0;
        for (const cls of targetClasses) {
          if (nodeClasses.has(cls)) overlap++;
        }
        if (overlap > 0) {
          score += overlap * 120 + (nodeClasses.has(targetClasses[0]) ? 200 : 0);
          if (strategy === 'jsx-tag') strategy = 'jsx-class';
        }
      }

      if (sourceLoc && sourceLoc.path === file.path) {
        const startLine = offsetToLineNumber(file.content, node.openStart);
        if (startLine === sourceLoc.line) {
          score += 80;
          if (strategy === 'jsx-tag') strategy = 'jsx-source-loc';
        }
      }

      // Minor preference for App.tsx/App.jsx on ties, and deterministic size preference
      if (/(^|\/)app\.[jt]sx$/i.test(file.path)) {
        score += 10;
      }

      if (
        !bestCandidate ||
        score > bestCandidate.score ||
        (score === bestCandidate.score && fullSlice.length < (bestCandidate.node.closeEnd - bestCandidate.node.openStart))
      ) {
        bestCandidate = { file, node, score, strategy };
      }
    }
  }

  if (!bestCandidate) return null;

  const { file, node, strategy } = bestCandidate;
  const targetCode = file.content.slice(node.openStart, node.closeEnd);
  if (!targetCode.trim()) return null;

  const fileType: AiEditFileType = /\.jsx$/i.test(file.path) ? 'jsx' : 'tsx';

  return {
    filePath: file.path,
    fileType,
    tagName: node.tagName,
    startOffset: node.openStart,
    endOffset: node.closeEnd,
    targetCode,
    surroundingContext: buildSurroundingContext(
      file.path,
      file.content,
      node.openStart,
      node.closeEnd
    ),
    matchStrategy: strategy,
  };
}

/**
 * Extracts the exact HTML node or JSX element source slice for the currently selected canvas element.
 */
export function extractElementSourceSlice(
  files: ProjectFile[],
  entryHtmlPath: string | null,
  selectedElement: SelectedElementInfo | null
): ExtractedElementSlice | null {
  if (!selectedElement) return null;

  const isBundledSpa = needsModuleBundling(files, entryHtmlPath);
  const hasJsxFiles = files.some(
    (f) =>
      f.type === 'js' &&
      /\.(tsx|jsx)$/i.test(f.path) &&
      !isNonRuntimeBundleFile(f.path)
  );

  // In React/TSX SPAs, prefer JSX source extraction unless the user specifically selected a raw static HTML node outside #root
  if (isBundledSpa && hasJsxFiles) {
    const jsxSlice = extractJsxElementSlice(files, entryHtmlPath, selectedElement);
    if (jsxSlice) {
      return jsxSlice;
    }
  }

  const htmlSlice = extractHtmlElementSlice(files, entryHtmlPath, selectedElement);
  if (htmlSlice) {
    return htmlSlice;
  }

  if (hasJsxFiles) {
    return extractJsxElementSlice(files, entryHtmlPath, selectedElement);
  }

  return null;
}

/**
 * Cleans markdown code fences and runtime-only visual-editor attributes from AI-returned snippets.
 */
export function sanitizeAiUpdatedCode(
  rawCode: string,
  fileType: AiEditFileType
): string {
  let cleaned = rawCode.trim();

  const fenceMatch = /^```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```$/i.exec(cleaned);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  if (fileType === 'html') {
    cleaned = cleaned.replace(/\sdata-ve-id\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  }

  return cleaned;
}

function validateCssSyntax(css: string): SyntaxValidationResult {
  let braceDepth = 0;
  let parenDepth = 0;
  let quote: '"' | "'" | null = null;
  let i = 0;

  while (i < css.length) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      i++;
      continue;
    }

    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) {
        return { ok: false, error: 'Unterminated CSS comment block.' };
      }
      i = end + 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === '{') braceDepth++;
    if (ch === '}') {
      braceDepth--;
      if (braceDepth < 0) {
        return { ok: false, error: 'Unexpected closing "}" in CSS.' };
      }
    }
    if (ch === '(') parenDepth++;
    if (ch === ')') {
      parenDepth--;
      if (parenDepth < 0) {
        return { ok: false, error: 'Unexpected closing ")" in CSS.' };
      }
    }
    i++;
  }

  if (quote) return { ok: false, error: 'Unterminated string literal in CSS.' };
  if (braceDepth !== 0) return { ok: false, error: 'Unbalanced "{" / "}" braces in CSS.' };
  if (parenDepth !== 0) return { ok: false, error: 'Unbalanced "(" / ")" parentheses in CSS.' };
  return { ok: true };
}

function validateHtmlSyntax(html: string): SyntaxValidationResult {
  const stack: string[] = [];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end === -1) {
        return { ok: false, error: 'Unterminated HTML comment.' };
      }
      i = end + 3;
      continue;
    }

    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const gt = html.indexOf('>', lt + 2);
      if (gt === -1) {
        return { ok: false, error: 'Malformed HTML declaration tag.' };
      }
      i = gt + 1;
      continue;
    }

    if (html[lt + 1] === '/') {
      const closeMatch = /^<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>/.exec(html.slice(lt));
      if (!closeMatch) {
        return { ok: false, error: 'Malformed closing HTML tag.' };
      }
      const closeName = closeMatch[1].toLowerCase();
      if (stack.length > 0 && stack[stack.length - 1] === closeName) {
        stack.pop();
      } else {
        // Pop optional unclosed ancestors (like <li> or <p>) if closing an outer container
        let foundIdx = -1;
        for (let s = stack.length - 1; s >= 0; s--) {
          if (stack[s] === closeName) {
            foundIdx = s;
            break;
          }
          if (!HTML_OPTIONAL_CLOSE_TAGS.has(stack[s])) {
            break;
          }
        }
        if (foundIdx === -1) {
          return {
            ok: false,
            error: `Mismatched HTML closing tag </${closeName}>.`,
          };
        }
        stack.splice(foundIdx);
      }
      i = lt + closeMatch[0].length;
      continue;
    }

    const openMatch = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt));
    if (!openMatch) {
      i = lt + 1;
      continue;
    }
    const tagName = openMatch[1].toLowerCase();

    // Find end of opening tag respecting attribute quotes
    let quote: '"' | "'" | null = null;
    let tagEnd = -1;
    for (let j = lt + 1 + openMatch[1].length; j < html.length; j++) {
      const ch = html[j];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        tagEnd = j + 1;
        break;
      }
    }
    if (quote || tagEnd === -1) {
      return { ok: false, error: `Unterminated opening tag <${tagName}>.` };
    }

    const rawOpen = html.slice(lt, tagEnd);
    const isSelfClosing = rawOpen.endsWith('/>') || HTML_VOID_TAGS.has(tagName);

    if ((tagName === 'script' || tagName === 'style' || tagName === 'textarea' || tagName === 'title') && !isSelfClosing) {
      const lowerRest = html.toLowerCase();
      const closePattern = `</${tagName}`;
      const closeIdx = lowerRest.indexOf(closePattern, tagEnd);
      if (closeIdx === -1) {
        return { ok: false, error: `Unclosed <${tagName}> tag.` };
      }
      const closeGt = html.indexOf('>', closeIdx);
      if (closeGt === -1) {
        return { ok: false, error: `Malformed closing </${tagName}> tag.` };
      }
      i = closeGt + 1;
      continue;
    }

    if (!isSelfClosing) {
      stack.push(tagName);
    }

    i = tagEnd;
  }

  const unclosedStrict = stack.filter((t) => !HTML_OPTIONAL_CLOSE_TAGS.has(t));
  if (unclosedStrict.length > 0) {
    return {
      ok: false,
      error: `Unclosed HTML tag <${unclosedStrict[unclosedStrict.length - 1]}>.`,
    };
  }

  return { ok: true };
}

function validateJsxSyntax(source: string): SyntaxValidationResult {
  return analyzeJsxSource(source).validation;
}

function validateBalancedDelimitersInSnippet(snippet: string): SyntaxValidationResult {
  const stack: string[] = [];
  let i = 0;
  while (i < snippet.length) {
    const ch = snippet[i];
    if (ch === '"' || ch === "'") {
      const end = skipStringLiteral(snippet, i);
      if (end >= snippet.length && snippet[snippet.length - 1] !== ch) {
        return { ok: false, error: 'Unterminated attribute string literal.' };
      }
      i = end;
      continue;
    }
    if (ch === '`') {
      i = skipTemplateLiteral(snippet, i);
      continue;
    }
    if (ch === '/' && snippet[i + 1] === '/') {
      const nl = snippet.indexOf('\n', i + 2);
      i = nl === -1 ? snippet.length : nl + 1;
      continue;
    }
    if (ch === '/' && snippet[i + 1] === '*') {
      const end = snippet.indexOf('*/', i + 2);
      if (end === -1) return { ok: false, error: 'Unterminated comment in JSX props.' };
      i = end + 2;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch);
    } else if (ch === ')' || ch === ']' || ch === '}') {
      const expected = ch === ')' ? '(' : ch === ']' ? '[' : '{';
      if (stack.pop() !== expected) {
        return { ok: false, error: `Unbalanced "${ch}" in JSX props.` };
      }
    }
    i++;
  }
  if (stack.length > 0) {
    return { ok: false, error: `Unclosed "${stack[stack.length - 1]}" in JSX props.` };
  }
  return { ok: true };
}

/**
 * Validates HTML, CSS, or TSX/JSX syntax synchronously before committing a patch.
 */
export function validateSourceSyntax(
  code: string,
  fileType: AiEditFileType
): SyntaxValidationResult {
  if (!code || !code.trim()) {
    return { ok: false, error: 'Resulting source cannot be empty.' };
  }
  if (/^\s*```/m.test(code)) {
    return { ok: false, error: 'Code contains raw markdown code fences.' };
  }

  if (fileType === 'css') {
    return validateCssSyntax(code);
  }
  if (fileType === 'html') {
    return validateHtmlSyntax(code);
  }
  return validateJsxSyntax(code);
}

/**
 * Applies a targeted AI element replacement ONLY at the extracted node boundaries
 * and validates both the snippet and the resulting file before returning `nextFiles`.
 */
export function applyAiElementPatch(params: {
  files: ProjectFile[];
  slice: ExtractedElementSlice;
  updatedCode: string;
}): ApplyAiElementPatchResult {
  const { files, slice, updatedCode } = params;
  const targetFile = files.find((f) => f.path === slice.filePath);
  if (!targetFile) {
    return {
      ok: false,
      error: `Target file "${slice.filePath}" no longer exists in the project.`,
    };
  }

  const sanitizedCode = sanitizeAiUpdatedCode(updatedCode, slice.fileType);
  if (!sanitizedCode) {
    return {
      ok: false,
      error: 'AI returned empty replacement code.',
    };
  }

  const snippetCheck = validateSourceSyntax(sanitizedCode, slice.fileType);
  if (!snippetCheck.ok) {
    return {
      ok: false,
      error: `Invalid replacement snippet: ${snippetCheck.error}`,
    };
  }

  let start = slice.startOffset;
  let end = slice.endOffset;
  const currentAtOffsets = targetFile.content.slice(start, end);

  if (currentAtOffsets !== slice.targetCode) {
    // Fallback if minor whitespace/edits occurred elsewhere: match exact targetCode only when unique
    const firstIdx = targetFile.content.indexOf(slice.targetCode);
    const lastIdx = targetFile.content.lastIndexOf(slice.targetCode);
    if (firstIdx !== -1 && firstIdx === lastIdx) {
      start = firstIdx;
      end = firstIdx + slice.targetCode.length;
    } else {
      return {
        ok: false,
        error: 'Target element changed before the AI edit could be applied. Please re-select the element.',
      };
    }
  }

  const nextFileContent =
    targetFile.content.slice(0, start) +
    sanitizedCode +
    targetFile.content.slice(end);

  const fullFileCheck = validateSourceSyntax(nextFileContent, slice.fileType);
  if (!fullFileCheck.ok) {
    return {
      ok: false,
      error: `Patched file failed syntax validation: ${fullFileCheck.error}`,
    };
  }

  const nextFiles = files.map((file) =>
    file.path === slice.filePath
      ? { ...file, content: nextFileContent }
      : file
  );

  return {
    ok: true,
    nextFiles,
    updatedFilePath: slice.filePath,
    sanitizedCode,
  };
}

/**
 * Safely applies an AI element patch, records a snapshot on `historyManager`
 * for full Undo/Redo support, and reports whether live preview re-bundling is required.
 */
export function commitAiElementPatchWithHistory(params: {
  history: HistoryState;
  entryHtmlPath: string | null;
  slice: ExtractedElementSlice;
  updatedCode: string;
  label?: string;
}): CommitAiElementPatchResult {
  const { history, entryHtmlPath, slice, updatedCode, label } = params;
  const patchResult = applyAiElementPatch({
    files: history.present.files,
    slice,
    updatedCode,
  });

  if (!patchResult.ok) {
    return patchResult;
  }

  const historyLabel =
    label?.trim() || `AI edit <${slice.tagName}> in ${slice.filePath}`;
  const nextHistory = pushHistoryState(
    history,
    patchResult.nextFiles,
    historyLabel
  );

  const needsPreviewRebuild =
    slice.fileType === 'tsx' ||
    slice.fileType === 'jsx' ||
    needsModuleBundling(patchResult.nextFiles, entryHtmlPath) ||
    /<(?:script|style|link)\b/i.test(patchResult.sanitizedCode);

  return {
    ok: true,
    nextHistory,
    nextFiles: patchResult.nextFiles,
    updatedFilePath: patchResult.updatedFilePath,
    sanitizedCode: patchResult.sanitizedCode,
    needsPreviewRebuild,
  };
}
