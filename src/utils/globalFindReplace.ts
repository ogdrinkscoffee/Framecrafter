import type { ProjectFile, ProjectFileType } from '../types/editor';
import { isBinaryDataUrl } from './projectStats';

export type FindReplaceScopeFilter = 'all' | 'html' | 'css' | 'js' | 'other';

export interface FindReplaceOptions {
  matchCase: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  scope?: FindReplaceScopeFilter;
}

export interface GlobalSearchSegment {
  text: string;
  isMatch: boolean;
}

export interface GlobalSearchLineMatch {
  lineNumber: number;
  lineText: string;
  matchCount: number;
  segments: GlobalSearchSegment[];
}

export interface GlobalSearchFileMatch {
  file: ProjectFile;
  totalMatches: number;
  lineMatches: GlobalSearchLineMatch[];
}

export interface GlobalSearchResult {
  fileMatches: GlobalSearchFileMatch[];
  totalMatches: number;
  totalFilesMatched: number;
  error: string | null;
}

export interface GlobalReplaceResult {
  files: ProjectFile[];
  replacedCount: number;
  modifiedFilePaths: string[];
  error: string | null;
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchesScopeFilter(
  fileType: ProjectFileType,
  scope: FindReplaceScopeFilter = 'all'
): boolean {
  if (scope === 'all') return true;
  if (scope === 'html') return fileType === 'html';
  if (scope === 'css') return fileType === 'css';
  if (scope === 'js') return fileType === 'js';
  return fileType === 'json' || fileType === 'other';
}

export function buildSearchRegExp(
  query: string,
  options: Pick<FindReplaceOptions, 'matchCase' | 'wholeWord' | 'useRegex'>
): { regex: RegExp | null; error: string | null } {
  if (!query) {
    return { regex: null, error: null };
  }

  let pattern = options.useRegex ? query : escapeRegExp(query);
  if (options.wholeWord) {
    pattern = `\\b(?:${pattern})\\b`;
  }

  const flags = options.matchCase ? 'g' : 'gi';
  try {
    const regex = new RegExp(pattern, flags);
    return { regex, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid regular expression';
    return { regex: null, error: msg };
  }
}

function buildHighlightedSegments(line: string, lineRegex: RegExp): {
  matchCount: number;
  segments: GlobalSearchSegment[];
} {
  lineRegex.lastIndex = 0;
  const segments: GlobalSearchSegment[] = [];
  let lastIndex = 0;
  let matchCount = 0;
  let match: RegExpExecArray | null;

  while ((match = lineRegex.exec(line)) !== null) {
    const matchedText = match[0];
    if (matchedText.length === 0) {
      lineRegex.lastIndex += 1;
      continue;
    }
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index), isMatch: false });
    }
    segments.push({ text: matchedText, isMatch: true });
    matchCount += 1;
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), isMatch: false });
  }

  return { matchCount, segments };
}

export function searchAllProjectFiles(
  files: ProjectFile[],
  query: string,
  options: FindReplaceOptions,
  maxLineMatchesPerFile = 30
): GlobalSearchResult {
  if (!query) {
    return { fileMatches: [], totalMatches: 0, totalFilesMatched: 0, error: null };
  }

  const { regex, error } = buildSearchRegExp(query, options);
  if (error || !regex) {
    return { fileMatches: [], totalMatches: 0, totalFilesMatched: 0, error };
  }

  const scope = options.scope ?? 'all';
  const fileMatches: GlobalSearchFileMatch[] = [];
  let totalMatches = 0;

  for (const file of files) {
    if (isBinaryDataUrl(file.content)) continue;
    if (!matchesScopeFilter(file.type, scope)) continue;

    const lines = file.content.split(/\r?\n/);
    const lineMatches: GlobalSearchLineMatch[] = [];
    let fileTotalMatches = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineRegex = new RegExp(regex.source, regex.flags);
      const { matchCount, segments } = buildHighlightedSegments(lines[i], lineRegex);
      if (matchCount > 0) {
        fileTotalMatches += matchCount;
        if (lineMatches.length < maxLineMatchesPerFile) {
          lineMatches.push({
            lineNumber: i + 1,
            lineText: lines[i],
            matchCount,
            segments,
          });
        }
      }
    }

    if (fileTotalMatches > 0) {
      totalMatches += fileTotalMatches;
      fileMatches.push({
        file,
        totalMatches: fileTotalMatches,
        lineMatches,
      });
    }
  }

  fileMatches.sort(
    (a, b) => b.totalMatches - a.totalMatches || a.file.path.localeCompare(b.file.path)
  );

  return {
    fileMatches,
    totalMatches,
    totalFilesMatched: fileMatches.length,
    error: null,
  };
}

export function replaceAcrossProjectFiles(
  files: ProjectFile[],
  query: string,
  replacement: string,
  options: FindReplaceOptions,
  targetPaths?: Set<string>
): GlobalReplaceResult {
  if (!query) {
    return { files, replacedCount: 0, modifiedFilePaths: [], error: null };
  }

  const { regex, error } = buildSearchRegExp(query, options);
  if (error || !regex) {
    return { files, replacedCount: 0, modifiedFilePaths: [], error };
  }

  const scope = options.scope ?? 'all';
  let replacedCount = 0;
  const modifiedFilePaths: string[] = [];

  const nextFiles = files.map((file) => {
    if (isBinaryDataUrl(file.content)) return file;
    if (!matchesScopeFilter(file.type, scope)) return file;
    if (targetPaths && !targetPaths.has(file.path)) return file;

    const fileRegex = new RegExp(regex.source, regex.flags);
    let fileCount = 0;

    const updatedContent = options.useRegex
      ? file.content.replace(fileRegex, (...args) => {
          const fullMatch = args[0] as string;
          if (fullMatch.length === 0) return fullMatch;
          fileCount += 1;
          // Evaluate standard regex capture replacements ($1, $&, $$) cleanly
          return fullMatch.replace(new RegExp(regex.source, regex.flags.replace('g', '')), replacement);
        })
      : file.content.replace(fileRegex, (matched) => {
          if (matched.length === 0) return matched;
          fileCount += 1;
          return replacement;
        });

    if (fileCount > 0 && updatedContent !== file.content) {
      replacedCount += fileCount;
      modifiedFilePaths.push(file.path);
      return { ...file, content: updatedContent };
    }

    return file;
  });

  return {
    files: nextFiles,
    replacedCount,
    modifiedFilePaths,
    error: null,
  };
}
