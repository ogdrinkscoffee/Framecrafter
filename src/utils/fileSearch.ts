import type { FileSearchLineMatch, FileSearchResult, ProjectFile } from '../types/editor';

export function searchProjectFiles(
  files: ProjectFile[],
  rawQuery: string,
  maxLineMatchesPerFile = 4
): FileSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return files.map((file) => ({
      file,
      filenameMatch: true,
      lineMatches: [],
      totalLineMatches: 0,
    }));
  }

  const results: FileSearchResult[] = [];

  for (const file of files) {
    const filenameMatch =
      file.path.toLowerCase().includes(query) || file.name.toLowerCase().includes(query);

    const lines = file.content.split(/\r?\n/);
    const lineMatches: FileSearchLineMatch[] = [];
    let totalLineMatches = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query)) {
        totalLineMatches++;
        if (lineMatches.length < maxLineMatchesPerFile) {
          lineMatches.push({
            lineNumber: i + 1,
            lineText: lines[i].trim(),
          });
        }
      }
    }

    if (filenameMatch || totalLineMatches > 0) {
      results.push({
        file,
        filenameMatch,
        lineMatches,
        totalLineMatches,
      });
    }
  }

  // Prioritize filename matches first, then higher content match counts
  return results.sort((a, b) => {
    if (a.filenameMatch !== b.filenameMatch) return a.filenameMatch ? -1 : 1;
    if (a.totalLineMatches !== b.totalLineMatches) {
      return b.totalLineMatches - a.totalLineMatches;
    }
    return a.file.path.localeCompare(b.file.path);
  });
}
