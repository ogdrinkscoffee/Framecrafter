import type { ProjectFile, QuickInsertKind, SelectedElementInfo } from '../types/editor';
import { insertHtmlSnippet, scanHtmlElements } from './htmlSync';
import { isNonRuntimeBundleFile, needsModuleBundling } from './projectBundler';

export interface QuickInsertItemDef {
  kind: QuickInsertKind;
  label: string;
  jsx: string;
  html: string;
}

export const QUICK_INSERT_ITEMS: QuickInsertItemDef[] = [
  {
    kind: 'container',
    label: 'Container / Div',
    jsx: '<div className="p-4 rounded-xl border border-slate-700/60 bg-slate-900/50 space-y-2">\n  <p className="text-sm text-slate-300">Container block</p>\n</div>',
    html: '<div class="p-4 rounded-xl border border-slate-300/30" style="padding: 16px; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.35);">Container block</div>',
  },
  {
    kind: 'heading',
    label: 'Heading',
    jsx: '<h2 className="text-2xl font-bold tracking-tight text-slate-100">Section Heading</h2>',
    html: '<h2 class="text-2xl font-bold tracking-tight" style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">Section Heading</h2>',
  },
  {
    kind: 'paragraph',
    label: 'Paragraph',
    jsx: '<p className="text-sm text-slate-300 leading-relaxed">Write descriptive copy or supporting details here.</p>',
    html: '<p class="text-sm leading-relaxed" style="font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">Write descriptive copy or supporting details here.</p>',
  },
  {
    kind: 'button',
    label: 'Button',
    jsx: '<button type="button" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">Action Button</button>',
    html: '<button type="button" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold" style="padding: 9px 16px; border-radius: 8px; background: #2563eb; color: #ffffff; border: 0; font-weight: 600; cursor: pointer;">Action Button</button>',
  },
  {
    kind: 'image',
    label: 'Image',
    jsx: '<img src="https://placehold.co/480x260/1e293b/94a3b8?text=Visual+Asset" alt="Visual asset" className="rounded-xl w-full max-w-md object-cover border border-slate-700/60" />',
    html: '<img src="https://placehold.co/480x260/1e293b/94a3b8?text=Visual+Asset" alt="Visual asset" style="display: block; max-width: 100%; width: 320px; border-radius: 10px;" />',
  },
  {
    kind: 'card',
    label: 'Card',
    jsx: '<article className="p-5 rounded-xl border border-slate-700/70 bg-slate-800/70 shadow-sm space-y-2">\n  <h3 className="text-lg font-semibold text-slate-100">Feature Card</h3>\n  <p className="text-sm text-slate-300">Modular card layout with title and summary text.</p>\n</article>',
    html: '<article style="padding: 20px; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.3); background: rgba(15, 23, 42, 0.04);"><h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 600;">Feature Card</h3><p style="margin: 0; font-size: 14px;">Modular card layout with title and summary text.</p></article>',
  },
  {
    kind: 'input',
    label: 'Input',
    jsx: '<input type="text" placeholder="Enter value..." className="w-full max-w-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500" />',
    html: '<input type="text" placeholder="Enter value..." style="padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.45); font-size: 14px; min-width: 220px;" />',
  },
];

function offsetToLine(content: string, offset: number): number {
  if (offset <= 0) return 1;
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

export interface SourceLocationMatch {
  path: string;
  line: number;
  endLine: number;
}

export function findElementSourceLocation(
  files: ProjectFile[],
  entryHtmlPath: string | null,
  element: SelectedElementInfo | null
): SourceLocationMatch | null {
  if (!element) return null;

  // 1. Static HTML element with data-ve-id
  if (element.veId && entryHtmlPath) {
    const htmlFile = files.find((f) => f.path === entryHtmlPath);
    if (htmlFile) {
      const scanned = scanHtmlElements(htmlFile.content);
      const target = scanned.find((el) => el.veId === element.veId);
      if (target) {
        return {
          path: htmlFile.path,
          line: offsetToLine(htmlFile.content, target.openStart),
          endLine: offsetToLine(htmlFile.content, target.closeEnd),
        };
      }
    }
  }

  // 2. React / TSX / JSX runtime element matching
  const jsxFiles = files.filter(
    (f) => f.type === 'js' && /\.(tsx|jsx)$/i.test(f.path) && !isNonRuntimeBundleFile(f.path)
  );
  const tag = element.tagName.toLowerCase();
  const trimmedText = element.textContent.trim();
  const primaryClasses = element.className
    .split(/\s+/)
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith('data-ve'));

  // Strategy A: Match unique id attribute in JSX
  if (element.id) {
    const idRe = new RegExp(`<${tag}\\b[^>]*\\bid=["'\`]${escapeRegex(element.id)}["'\`]`);
    for (const file of jsxFiles) {
      const m = idRe.exec(file.content);
      if (m) {
        const line = offsetToLine(file.content, m.index);
        return { path: file.path, line, endLine: line };
      }
    }
  }

  // Strategy B: Match exact JSX text child <tag ...>text</tag>
  if (trimmedText && trimmedText.length <= 160) {
    const safeText = escapeRegex(trimmedText);
    const taggedRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\r\\n]*${safeText}[\\s\\r\\n]*</${tag}>`);
    for (const file of jsxFiles) {
      const m = taggedRe.exec(file.content);
      if (m) {
        const startLine = offsetToLine(file.content, m.index);
        const endLine = offsetToLine(file.content, m.index + m[0].length);
        return { path: file.path, line: startLine, endLine };
      }
    }
  }

  // Strategy C: Match JSX tag with matching primary class token
  if (primaryClasses.length > 0) {
    const clsToken = escapeRegex(primaryClasses[0]);
    const clsRe = new RegExp(`<${tag}\\b[^>]*className=["'\`][^"'\`]*\\b${clsToken}\\b`);
    for (const file of jsxFiles) {
      const m = clsRe.exec(file.content);
      if (m) {
        const line = offsetToLine(file.content, m.index);
        return { path: file.path, line, endLine: line };
      }
    }
  }

  // Strategy D: Any occurrence of the JSX tag in App.tsx / App.jsx or first JSX component
  const sortedJsx = [...jsxFiles].sort((a, b) => {
    const aApp = /(^|\/)app\.[jt]sx$/i.test(a.path) ? 0 : 1;
    const bApp = /(^|\/)app\.[jt]sx$/i.test(b.path) ? 0 : 1;
    return aApp - bApp || a.path.localeCompare(b.path);
  });
  const tagRe = new RegExp(`<${tag}\\b`);
  for (const file of sortedJsx) {
    const m = tagRe.exec(file.content);
    if (m) {
      const line = offsetToLine(file.content, m.index);
      return { path: file.path, line, endLine: line };
    }
  }

  return null;
}

const CONTAINER_HTML_TAGS = new Set([
  'div',
  'section',
  'main',
  'article',
  'aside',
  'header',
  'footer',
  'nav',
  'form',
  'ul',
  'ol',
  'body',
]);

export function insertQuickComponentInProject(
  files: ProjectFile[],
  entryHtmlPath: string | null,
  kind: QuickInsertKind,
  selectedElement: SelectedElementInfo | null
): { files: ProjectFile[]; targetPath: string | null; insertedVeId: string | null; line?: number } {
  const def = QUICK_INSERT_ITEMS.find((i) => i.kind === kind);
  if (!def) {
    return { files, targetPath: null, insertedVeId: null };
  }

  const isBundledSpa = needsModuleBundling(files, entryHtmlPath);
  const preferJsx =
    isBundledSpa &&
    (!selectedElement || !selectedElement.veId) &&
    files.some((f) => f.type === 'js' && /\.(tsx|jsx)$/i.test(f.path) && !isNonRuntimeBundleFile(f.path));

  if (preferJsx) {
    const jsxFiles = files.filter(
      (f) => f.type === 'js' && /\.(tsx|jsx)$/i.test(f.path) && !isNonRuntimeBundleFile(f.path)
    );
    const sourceLoc = findElementSourceLocation(files, entryHtmlPath, selectedElement);
    const targetFile =
      (sourceLoc ? jsxFiles.find((f) => f.path === sourceLoc.path) : null) ??
      jsxFiles.find((f) => /(^|\/)app\.(tsx|jsx)$/i.test(f.path)) ??
      jsxFiles[0];

    if (targetFile) {
      const indented = def.jsx
        .split('\n')
        .map((l) => `      ${l}`)
        .join('\n');
      let nextContent = targetFile.content;
      let insertOffset = -1;

      if (selectedElement && sourceLoc && sourceLoc.path === targetFile.path) {
        const lines = targetFile.content.split(/\r?\n/);
        const isContainer = CONTAINER_HTML_TAGS.has(selectedElement.tagName.toLowerCase());
        const targetLineIdx = Math.max(0, Math.min(lines.length - 1, sourceLoc.endLine - 1));
        if (isContainer) {
          // Insert before closing tag line if found
          const closingTag = `</${selectedElement.tagName.toLowerCase()}>`;
          const closeIdx = lines[targetLineIdx].lastIndexOf(closingTag);
          if (closeIdx !== -1) {
            let offset = 0;
            for (let i = 0; i < targetLineIdx; i++) offset += lines[i].length + 1;
            insertOffset = offset + closeIdx;
          }
        }
        if (insertOffset === -1) {
          let offset = 0;
          for (let i = 0; i <= targetLineIdx; i++) offset += lines[i].length + 1;
          insertOffset = Math.min(targetFile.content.length, offset);
        }
      }

      if (insertOffset === -1) {
        const closingMatch = /<\/(main|div|section|article|>\s*\)|fragment)>\s*(?:\)|;|\s|$)/gi;
        let lastMatch: RegExpExecArray | null = null;
        let m: RegExpExecArray | null;
        while ((m = closingMatch.exec(targetFile.content)) !== null) {
          lastMatch = m;
        }
        if (lastMatch) {
          insertOffset = lastMatch.index;
        }
      }

      if (insertOffset !== -1) {
        nextContent =
          targetFile.content.slice(0, insertOffset) +
          `\n${indented}\n` +
          targetFile.content.slice(insertOffset);
        const line = offsetToLine(nextContent, insertOffset + 1);
        return {
          files: files.map((f) => (f.path === targetFile.path ? { ...f, content: nextContent } : f)),
          targetPath: targetFile.path,
          insertedVeId: null,
          line,
        };
      }
    }
  }

  // Fallback / Static HTML insertion
  if (!entryHtmlPath) {
    return { files, targetPath: null, insertedVeId: null };
  }
  const htmlFile = files.find((f) => f.path === entryHtmlPath);
  if (!htmlFile) {
    return { files, targetPath: null, insertedVeId: null };
  }

  const isContainer = selectedElement
    ? CONTAINER_HTML_TAGS.has(selectedElement.tagName.toLowerCase())
    : false;
  const placement = selectedElement?.veId ? (isContainer ? 'inside' : 'after') : 'inside';
  const result = insertHtmlSnippet(
    htmlFile.content,
    selectedElement?.veId ?? null,
    placement,
    def.html
  );

  return {
    files: files.map((f) => (f.path === entryHtmlPath ? { ...f, content: result.html } : f)),
    targetPath: entryHtmlPath,
    insertedVeId: result.insertedVeId,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
