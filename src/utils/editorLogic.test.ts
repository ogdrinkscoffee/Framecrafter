import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendTableColumnInHtml,
  appendTableRowInHtml,
  applyElementPatchToHtml,
  buildTableHtml,
  createPageHtmlTemplate,
  cssColorToHex,
  duplicateElementInHtml,
  ensureElementNodeAttr,
  ensureStylesheetLinkInHtml,
  extractElementHtmlByVeId,
  getTableMetricsInHtml,
  insertHtmlSnippet,
  listHtmlElementIds,
  moveElementSiblingInHtml,
  parseInlineStyleString,
  removeLastTableColumnInHtml,
  removeLastTableRowInHtml,
  replaceTextInHtmlBody,
  scanHtmlElements,
  serializeInlineStyleMap,
  tagHtmlWithVeIds,
  toggleTableStripedRowsInHtml,
  updateSvgShapeInHtml,
  updateTableCellsStyleInHtml,
} from './htmlSync';
import {
  createHistoryState,
  pushHistoryState,
  redoHistoryState,
  undoHistoryState,
} from './historyManager';
import {
  buildProjectAssetUrlMap,
  buildSrcDoc,
  detectFileType,
  detectProjectTitleFromUpload,
  extractHotPatchPayload,
  findEntryHtmlPath,
  isNonRuntimeBundleFile,
  needsModuleBundling,
  normalizeUploadedFiles,
  rewriteCssAssetUrls,
  rewriteHtmlAssetRefs,
  shouldIgnoreUploadPath,
} from './projectBundler';
import {
  buildGoogleFontsHref,
  collectUsedGoogleFonts,
  ensureGoogleFontInHtml,
  matchStudioFontOption,
  STUDIO_FONT_CATALOG,
} from './fontLibrary';
import { bundleProjectInBrowser } from './browserBundler';
import { buildProjectFileTree, getFileBadgeStyle } from './fileTree';
import { writeProjectFilesToDirectory } from './fileSystemSync';
import {
  computeFilesFingerprint,
  decodeGitHubBlobToProjectContent,
  encodeProjectFileForGitHubBlob,
  mergeUpstreamFilesWithWorkspace,
  parseGitHubRepoUrl,
} from './githubSync';
import {
  applyRuntimeAttrPatchToFiles,
  applyRuntimeStylePatchToFiles,
  applyRuntimeTextPatchToFiles,
} from './reactVisualSync';
import { SAMPLE_TEMPLATES } from './sampleTemplates';
import { searchProjectFiles } from './fileSearch';
import { DRAGGABLE_COMPONENTS, SVG_SHAPE_TOOL_ITEMS } from './componentCatalog';
import {
  getNodeDeviceVisibility,
  getResponsiveNodeStyles,
  parseResponsiveCssStore,
  upsertResponsiveStylesInCss,
} from './responsiveCss';
import { parseHeadSeoMeta, updateHeadSeoMeta } from './seoMeta';
import {
  deleteRootCssVariable,
  parseRootCssVariables,
  updateRootCssVariable,
} from './cssVariables';
import { buildIframeBridgeMarkup } from './iframeBridge';
import {
  classifyViewportPresetFromWidth,
  isShortcutTypingTarget,
  matchShortcutAction,
} from './shortcuts';
import { findElementSourceLocation, insertQuickComponentInProject } from './codeSync';
import {
  createSlidingWindowRateLimiter,
  validateBundleProjectPayload,
  validateGithubPullPayload,
  validateGithubPushPayload,
} from './serverValidation';
import type { SelectedElementInfo } from '../types/editor';

test('scanHtmlElements indexes body elements and skips head/script/style', () => {
  const html = `<!doctype html>
<html>
  <head><title>Test</title><link rel="stylesheet" href="a.css" /></head>
  <body>
    <header id="top"><h1>Hello</h1></header>
    <main><p>World</p><img src="x.png" /></main>
    <script>const a = 1 < 2;</script>
  </body>
</html>`;
  const elements = scanHtmlElements(html);
  assert.deepEqual(
    elements.map((e) => [e.veId, e.tagName]),
    [
      ['ve-0', 'header'],
      ['ve-1', 'h1'],
      ['ve-2', 'main'],
      ['ve-3', 'p'],
      ['ve-4', 'img'],
    ]
  );
});

test('tagHtmlWithVeIds adds deterministic data-ve-id attributes without breaking self-closing tags', () => {
  const html = `<body><div class="box"><img src="a.png" /><span>Hi</span></div></body>`;
  const tagged = tagHtmlWithVeIds(html);
  assert.ok(tagged.includes('<div class="box" data-ve-id="ve-0">'));
  assert.ok(tagged.includes('<img src="a.png"  data-ve-id="ve-1"/>') || tagged.includes('<img src="a.png" data-ve-id="ve-1"/>') || tagged.includes('data-ve-id="ve-1"'));
  assert.ok(tagged.includes('<span data-ve-id="ve-2">Hi</span>'));
});

test('applyElementPatchToHtml updates inline styles, attributes, text content, and removes elements cleanly', () => {
  const base = `<body><h1 id="title" style="color: #111111; font-size: 20px">Old Title</h1><a href="#">Go</a></body>`;

  const styled = applyElementPatchToHtml(base, 've-0', {
    styles: { color: '#ff0000', 'background-color': '#000000', 'font-size': null },
  });
  assert.ok(styled.includes('color: #ff0000'));
  assert.ok(styled.includes('background-color: #000000'));
  assert.ok(!styled.includes('font-size'));

  const attributed = applyElementPatchToHtml(styled, 've-1', {
    attributes: { href: 'about.html', 'data-ve-action': 'page', 'data-ve-value': 'about.html' },
  });
  assert.ok(attributed.includes('href="about.html"'));
  assert.ok(attributed.includes('data-ve-action="page"'));
  assert.ok(attributed.includes('data-ve-value="about.html"'));

  const clearedAttr = applyElementPatchToHtml(attributed, 've-1', {
    attributes: { 'data-ve-action': null, 'data-ve-value': null },
  });
  assert.ok(!clearedAttr.includes('data-ve-action'));

  const textUpdated = applyElementPatchToHtml(clearedAttr, 've-0', {
    textContent: 'New <Hero> Title',
  });
  assert.ok(textUpdated.includes('>New &lt;Hero&gt; Title</h1>'));

  const removed = applyElementPatchToHtml(textUpdated, 've-0', { remove: true });
  assert.ok(!removed.includes('New &lt;Hero&gt; Title'));
});

test('parseInlineStyleString & serializeInlineStyleMap handle rgb/functions', () => {
  const parsed = parseInlineStyleString('color: rgb(15, 23, 42); width: 240px; padding: 12px 16px;');
  assert.deepEqual(parsed, {
    color: 'rgb(15, 23, 42)',
    width: '240px',
    padding: '12px 16px',
  });
  assert.equal(
    serializeInlineStyleMap(parsed),
    'color: rgb(15, 23, 42); width: 240px; padding: 12px 16px'
  );
  assert.equal(cssColorToHex('rgb(37, 99, 235)'), '#2563eb');
  assert.equal(cssColorToHex('rgba(0, 0, 0, 0)'), '');
});

test('historyManager supports push, undo, redo, and deduplication', () => {
  const initial = [{ path: 'index.html', name: 'index.html', type: 'html' as const, content: '<h1>1</h1>' }];
  let state = createHistoryState(initial);
  assert.equal(state.past.length, 0);

  state = pushHistoryState(state, initial, 'No-op');
  assert.equal(state.past.length, 0);

  const edit1 = [{ ...initial[0], content: '<h1>2</h1>' }];
  state = pushHistoryState(state, edit1, 'Edit title');
  assert.equal(state.past.length, 1);
  assert.equal(state.present.files[0].content, '<h1>2</h1>');

  state = undoHistoryState(state);
  assert.equal(state.present.files[0].content, '<h1>1</h1>');
  assert.equal(state.future.length, 1);

  state = redoHistoryState(state);
  assert.equal(state.present.files[0].content, '<h1>2</h1>');
  assert.equal(state.future.length, 0);
});

test('projectBundler normalizes folder uploads and inlines local CSS/JS into srcdoc', () => {
  const uploaded = normalizeUploadedFiles([
    { path: 'my-app/index.html', name: 'index.html', content: '<html><head><link rel="stylesheet" href="css/main.css"></head><body><h1>App</h1><script src="js/app.js"></script></body></html>' },
    { path: 'my-app/css/main.css', name: 'main.css', type: 'css', content: 'body { color: red; }' } as never,
    { path: 'my-app/js/app.js', name: 'app.js', content: 'console.log("hi");' },
  ]);

  assert.equal(detectFileType('main.css'), 'css');
  assert.equal(findEntryHtmlPath(uploaded), 'index.html');

  const srcDoc = buildSrcDoc(uploaded, 'index.html');
  assert.ok(srcDoc.includes('<style data-ve-source="css/main.css">'));
  assert.ok(srcDoc.includes('body { color: red; }'));
  assert.ok(srcDoc.includes('<script data-ve-source="js/app.js">'));
  assert.ok(srcDoc.includes('data-ve-id="ve-0"'));
});

test('sample templates have valid entry HTML, :root variables, SEO meta, and bundle cleanly', () => {
  for (const tpl of SAMPLE_TEMPLATES) {
    const entry = findEntryHtmlPath(tpl.files);
    assert.ok(entry, `Template ${tpl.id} should have entry HTML`);
    const doc = buildSrcDoc(tpl.files, entry!);
    assert.ok(doc.includes('data-ve-id='));
    const cssFile = tpl.files.find((f) => f.type === 'css');
    assert.ok(cssFile && parseRootCssVariables(cssFile.content).length >= 5);
    const vfStart = doc.indexOf('<script data-ve-internal="virtual-fetch">');
    const vfEnd = doc.indexOf('</script>', vfStart);
    assert.ok(vfStart !== -1 && vfEnd !== -1);
    const vfBody = doc.slice(vfStart + 40, vfEnd);
    assert.ok(!vfBody.includes('</script'), 'virtual-fetch must not contain raw </script');
    assert.ok(!vfBody.includes('<body'), 'virtual-fetch must not contain raw <body');
  }
});

test('searchProjectFiles finds matches by filename and file content with line numbers', () => {
  const files = SAMPLE_TEMPLATES[0].files;
  const byName = searchProjectFiles(files, 'styles.css');
  assert.equal(byName.length, 2);
  assert.equal(byName[0].file.path, 'styles.css');
  assert.equal(byName[0].filenameMatch, true);
  assert.equal(byName[1].file.path, 'index.html');
  assert.equal(byName[1].filenameMatch, false);

  const byContent = searchProjectFiles(files, 'Monthly Recurring Revenue');
  assert.equal(byContent.length, 1);
  assert.equal(byContent[0].file.path, 'index.html');
  assert.equal(byContent[0].totalLineMatches, 1);
  assert.ok(byContent[0].lineMatches[0].lineNumber > 1);
  assert.ok(byContent[0].lineMatches[0].lineText.includes('Monthly Recurring Revenue'));
});

test('insertHtmlSnippet inserts components inside containers or after siblings cleanly', () => {
  const html = `<body><section class="box"><h1>Title</h1></section></body>`;
  const buttonSnippet = DRAGGABLE_COMPONENTS[0].html;

  const inside = insertHtmlSnippet(html, 've-0', 'inside', buttonSnippet);
  assert.ok(inside.html.includes('<h1>Title</h1>\n<button'));
  assert.ok(inside.insertedVeId);

  const afterSibling = insertHtmlSnippet(html, 've-1', 'after', '<p>Sub</p>');
  assert.ok(afterSibling.html.includes('<h1>Title</h1>\n<p>Sub</p>\n</section>'));
});

test('ensureElementNodeAttr and responsiveCss store desktop/tablet/mobile rules cleanly', () => {
  const html = `<html><head></head><body><h1>Headline</h1></body></html>`;
  const tagged = ensureElementNodeAttr(html, 've-0');
  assert.equal(tagged.nodeId, 'n-1');
  assert.ok(tagged.html.includes('data-ve-node="n-1"'));

  const linked = ensureStylesheetLinkInHtml(tagged.html, 'styles.css');
  assert.ok(linked.includes('<link rel="stylesheet" href="styles.css" />'));

  let css = 'body { color: #111; }\n';
  css = upsertResponsiveStylesInCss(css, 'n-1', 'desktop', { 'font-size': '36px' });
  css = upsertResponsiveStylesInCss(css, 'n-1', 'mobile', {
    'font-size': '22px',
    display: 'none',
  });

  assert.ok(css.includes('body { color: #111; }'));
  assert.ok(css.includes('@media (min-width: 769px)'));
  assert.ok(css.includes('@media (max-width: 480px)'));

  const store = parseResponsiveCssStore(css);
  assert.equal(store.desktop['n-1']['font-size'], '36px');
  assert.equal(store.mobile['n-1']['font-size'], '22px');
  assert.deepEqual(getResponsiveNodeStyles(css, 'n-1', 'mobile'), {
    'font-size': '22px',
    display: 'none',
  });

  const visibility = getNodeDeviceVisibility(css, 'n-1');
  assert.deepEqual(visibility, { desktop: true, tablet: true, mobile: false });
});

test('seoMeta parses and updates document head title, description, and OpenGraph tags', () => {
  const html = `<!doctype html><html><head><title>Old App</title></head><body><h1>Hi</h1></body></html>`;
  const initial = parseHeadSeoMeta(html);
  assert.equal(initial.title, 'Old App');
  assert.equal(initial.description, '');

  const updated = updateHeadSeoMeta(html, {
    title: 'Launch Studio',
    description: 'Build apps visually',
    ogTitle: 'Launch Studio OG',
    ogDescription: 'Visual IDE',
    ogImage: 'https://example.com/og.png',
  });

  const reparsed = parseHeadSeoMeta(updated);
  assert.equal(reparsed.title, 'Launch Studio');
  assert.equal(reparsed.description, 'Build apps visually');
  assert.equal(reparsed.ogTitle, 'Launch Studio OG');
  assert.equal(reparsed.ogDescription, 'Visual IDE');
  assert.equal(reparsed.ogImage, 'https://example.com/og.png');
});

test('cssVariables parses, updates, adds, and deletes :root custom properties', () => {
  const css = `:root {\n  --accent-color: #2563eb;\n  --radius-card: 14px;\n}\nbody { color: var(--accent-color); }`;
  const vars = parseRootCssVariables(css);
  assert.equal(vars.length, 2);
  assert.equal(vars[0].kind, 'color');
  assert.equal(vars[1].kind, 'length');

  const updated = updateRootCssVariable(css, '--accent-color', '#10b981');
  assert.ok(updated.includes('--accent-color: #10b981;'));

  const added = updateRootCssVariable(updated, 'brand-gold', '#f59e0b');
  assert.ok(added.includes('--brand-gold: #f59e0b;'));

  const deleted = deleteRootCssVariable(added, '--radius-card');
  assert.ok(!deleted.includes('--radius-card'));
});

test('listHtmlElementIds, createPageHtmlTemplate, and MS 365 shapes catalog work cleanly', () => {
  const html = `<body><section id="overview"><h2>Overview</h2></section></body>`;
  assert.deepEqual(listHtmlElementIds(html), [
    { id: 'overview', tagName: 'section', label: '<section> #overview' },
  ]);

  const pageHtml = createPageHtmlTemplate('About Us', 'styles.css');
  assert.ok(pageHtml.includes('<title>About Us</title>'));
  assert.ok(pageHtml.includes('href="styles.css"'));
  assert.ok(pageHtml.includes('data-ve-action="page"'));

  const shapeIds = new Set(DRAGGABLE_COMPONENTS.map((c) => c.id));
  assert.ok(shapeIds.has('shape-triangle'));
  assert.ok(shapeIds.has('shape-diamond'));
  assert.ok(shapeIds.has('shape-star'));
  assert.ok(shapeIds.has('shape-hexagon'));
  assert.ok(shapeIds.has('shape-arrow-right'));
});

test('table manipulation utilities add/remove rows & columns, style cells, and toggle striped rows', () => {
  const initial = `<body>${buildTableHtml(3, 2)}</body>`;
  const m0 = getTableMetricsInHtml(initial, 've-0');
  assert.ok(m0);
  assert.equal(m0!.rows, 3);
  assert.equal(m0!.cols, 2);

  const withCol = appendTableColumnInHtml(initial, 've-0');
  const m1 = getTableMetricsInHtml(withCol, 've-0');
  assert.equal(m1!.rows, 3);
  assert.equal(m1!.cols, 3);

  const withRow = appendTableRowInHtml(withCol, 've-0');
  const m2 = getTableMetricsInHtml(withRow, 've-0');
  assert.equal(m2!.rows, 4);
  assert.equal(m2!.cols, 3);

  const lessRow = removeLastTableRowInHtml(withRow, 've-0');
  assert.equal(getTableMetricsInHtml(lessRow, 've-0')!.rows, 3);

  const lessCol = removeLastTableColumnInHtml(lessRow, 've-0');
  assert.equal(getTableMetricsInHtml(lessCol, 've-0')!.cols, 2);

  const padded = updateTableCellsStyleInHtml(lessCol, 've-0', {
    padding: '14px 18px',
    'text-align': 'center',
    'vertical-align': 'top',
  });
  const mStyled = getTableMetricsInHtml(padded, 've-0');
  assert.equal(mStyled!.cellPadding, '14px 18px');
  assert.equal(mStyled!.cellAlign, 'center');
  assert.equal(mStyled!.cellVAlign, 'top');

  const striped = toggleTableStripedRowsInHtml(padded, 've-0', true);
  assert.equal(getTableMetricsInHtml(striped, 've-0')!.isStriped, true);
});

test('duplicateElementInHtml clones element with collision-safe ID and returns new veId', () => {
  const html = `<body><div id="hero" data-ve-node="n-1"><p>Hello</p></div></body>`;
  const dup = duplicateElementInHtml(html, 've-0');
  assert.ok(dup.duplicatedVeId);
  assert.ok(dup.html.includes('id="hero-copy"'));
  assert.equal(scanHtmlElements(dup.html).filter((e) => e.tagName === 'div').length, 2);
});

test('buildIframeBridgeMarkup produces syntactically valid JavaScript', () => {
  const markup = buildIframeBridgeMarkup('edit', null);
  const start = markup.indexOf('<script data-ve-internal="bridge-script">');
  const end = markup.lastIndexOf('</script>');
  assert.ok(start !== -1 && end !== -1);
  const jsBody = markup.slice(start + '<script data-ve-internal="bridge-script">'.length, end);
  assert.doesNotThrow(() => new Function(jsBody));
  assert.ok(jsBody.includes('/^[mM]\\s*[-\\d.]/'));
});

test('SVG Shapes Tool & catalog include Circle, Triangle, and Polygon SVGs with aspect lock', () => {
  const toolIds = new Set(SVG_SHAPE_TOOL_ITEMS.map((t) => t.id));
  assert.ok(toolIds.has('shape-circle'));
  assert.ok(toolIds.has('shape-triangle'));
  assert.ok(toolIds.has('shape-polygon'));

  for (const id of ['shape-circle', 'shape-triangle', 'shape-polygon']) {
    const def = DRAGGABLE_COMPONENTS.find((c) => c.id === id);
    assert.ok(def, `Missing component ${id}`);
    assert.ok(def!.html.includes('<svg'), `${id} should be SVG-based`);
    assert.ok(def!.html.includes('data-ve-aspect-lock="true"'), `${id} should default aspect lock true`);
  }
});

test('updateSvgShapeInHtml updates fill, stroke, stroke-width, points, viewBox, and converts to <path>', () => {
  const circleDef = DRAGGABLE_COMPONENTS.find((c) => c.id === 'shape-circle')!;
  const base = `<body>${circleDef.html}</body>`;

  const restyled = updateSvgShapeInHtml(base, 've-0', {
    fill: '#ec4899',
    stroke: '#831843',
    strokeWidth: '6',
    pathData: '50, 50, 38',
  });
  assert.ok(restyled.includes('fill="#ec4899"'));
  assert.ok(restyled.includes('stroke="#831843"'));
  assert.ok(restyled.includes('stroke-width="6"'));
  assert.ok(restyled.includes('r="38"'));

  const converted = updateSvgShapeInHtml(restyled, 've-0', {
    pathData: 'M25,6 L75,6 L96,50 L75,94 L25,94 L4,50 Z',
    viewBox: '0 0 100 100',
  });
  assert.ok(converted.includes('<path'));
  assert.ok(converted.includes('d="M25,6 L75,6 L96,50 L75,94 L25,94 L4,50 Z"'));
  assert.ok(!converted.includes(' r="38"'));
});

test('replaceTextInHtmlBody replaces visible body text without corrupting tags, head, or scripts', () => {
  const html = `<html><head><title>Acme App</title></head><body data-brand="Acme"><h1>Acme Dashboard</h1><p>Welcome to acme studio.</p><script>const name = "Acme";</script></body></html>`;

  const ci = replaceTextInHtmlBody(html, 'Acme', 'Nova <HQ>', false);
  assert.equal(ci.count, 2);
  assert.ok(ci.html.includes('<title>Acme App</title>'));
  assert.ok(ci.html.includes('data-brand="Acme"'));
  assert.ok(ci.html.includes('<h1>Nova &lt;HQ&gt; Dashboard</h1>'));
  assert.ok(ci.html.includes('<p>Welcome to Nova &lt;HQ&gt; studio.</p>'));
  assert.ok(ci.html.includes('const name = "Acme";'));

  const cs = replaceTextInHtmlBody(html, 'Acme', 'Nova', true);
  assert.equal(cs.count, 1);
  assert.ok(cs.html.includes('<h1>Nova Dashboard</h1>'));
  assert.ok(cs.html.includes('<p>Welcome to acme studio.</p>'));
});

test('normalizeUploadedFiles skips node_modules/git, strips multi-level wrappers, and detects nested app root', () => {
  assert.equal(shouldIgnoreUploadPath('my-app/node_modules/react/index.html'), true);
  assert.equal(shouldIgnoreUploadPath('my-app/.git/HEAD'), true);
  assert.equal(shouldIgnoreUploadPath('my-app/.DS_Store'), true);
  assert.equal(shouldIgnoreUploadPath('my-app/src/App.tsx'), false);

  // Case 1: Multi-level wrapper + node_modules junk
  const multiWrapper = normalizeUploadedFiles([
    { path: 'downloads/repo-main/node_modules/pkg/index.html', name: 'index.html', content: '<h1>BAD</h1>' },
    { path: 'downloads/repo-main/.git/config', name: 'config', content: '' },
    { path: 'downloads/repo-main/index.html', name: 'index.html', content: '<h1>GOOD</h1>' },
    { path: 'downloads/repo-main/styles.css', name: 'styles.css', content: 'body {}' },
  ]);
  assert.deepEqual(
    multiWrapper.map((f) => f.path),
    ['index.html', 'styles.css']
  );
  assert.equal(findEntryHtmlPath(multiWrapper), 'index.html');

  // Case 2: Sibling README/.gitignore alongside nested frontend/ app folder
  const nestedWebApp = normalizeUploadedFiles([
    { path: 'workspace/README.md', name: 'README.md', content: '# Workspace' },
    { path: 'workspace/.gitignore', name: '.gitignore', content: 'node_modules' },
    { path: 'workspace/frontend/package.json', name: 'package.json', content: '{"name":"cool-app"}' },
    { path: 'workspace/frontend/index.html', name: 'index.html', content: '<div id="root"></div>' },
    { path: 'workspace/frontend/src/App.tsx', name: 'App.tsx', content: 'export default () => null;' },
  ]);
  assert.deepEqual(
    nestedWebApp.map((f) => f.path),
    ['index.html', 'package.json', 'src/App.tsx']
  );
  assert.equal(findEntryHtmlPath(nestedWebApp), 'index.html');
  assert.equal(detectProjectTitleFromUpload([], nestedWebApp), 'cool-app');

  // Case 3: CRA layout (public/index.html + src/index.tsx) preserves both folders
  const craApp = normalizeUploadedFiles([
    { path: 'my-cra/package.json', name: 'package.json', content: '{"name":"cra-demo"}' },
    { path: 'my-cra/public/index.html', name: 'index.html', content: '<div id="root"></div>' },
    { path: 'my-cra/src/index.tsx', name: 'index.tsx', content: 'console.log(1);' },
  ]);
  assert.deepEqual(
    craApp.map((f) => f.path),
    ['package.json', 'public/index.html', 'src/index.tsx']
  );
  assert.equal(findEntryHtmlPath(craApp), 'public/index.html');
  assert.equal(needsModuleBundling(craApp, 'public/index.html'), true);
});

test('findEntryHtmlPath ranks root index.html ahead of dist/tests HTML files', () => {
  const files = normalizeUploadedFiles([
    { path: 'app/tests/fixture/index.html', name: 'index.html', content: '<h1>Test</h1>' },
    { path: 'app/dist/index.html', name: 'index.html', content: '<h1>Dist</h1>' },
    { path: 'app/index.html', name: 'index.html', content: '<h1>Main</h1>' },
  ]);
  assert.equal(findEntryHtmlPath(files), 'index.html');
});

test('bundleProjectInBrowser compiles 55-file Vite/React/TSX project, ignores non-runtime files, shims node:crypto, and emits safe Blob + esm.sh importmap srcdoc', async () => {
  const rawEntries = [
    {
      path: 'big-app/node_modules/bad/index.html',
      name: 'index.html',
      content: '<h1>VENDOR</h1>',
    },
    {
      path: 'big-app/android/app/src/main/MainActivity.kt',
      name: 'MainActivity.kt',
      content: 'class MainActivity {}',
    },
    {
      path: 'big-app/src/App.test.tsx',
      name: 'App.test.tsx',
      content: 'describe("broken test syntax", ( => { UNVALID SYNTAX ));',
    },
    {
      path: 'big-app/src/utils/helper.spec.ts',
      name: 'helper.spec.ts',
      content: 'test("unclosed", ( => { ))',
    },
    {
      path: 'big-app/server.ts',
      name: 'server.ts',
      content: 'const x = fs.readFileSync("x"); broken(((',
    },
    {
      path: 'big-app/vite.config.ts',
      name: 'vite.config.ts',
      content: 'export default (() => {{{;',
    },
    {
      path: 'big-app/tsconfig.json',
      name: 'tsconfig.json',
      content: JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
    },
    {
      path: 'big-app/package.json',
      name: 'package.json',
      content: JSON.stringify({
        name: 'big-react-app',
        dependencies: {
          react: '^19.0.1',
          'react-dom': '^19.0.1',
          'lucide-react': '^0.546.0',
          firebase: '^11.0.0',
        },
      }),
    },
    {
      path: 'big-app/index.html',
      name: 'index.html',
      content:
        '<!doctype html><html><head><title>Big App</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    },
    {
      path: 'big-app/src/index.css',
      name: 'index.css',
      content: '@import "tailwindcss";\n.hero-title { color: #38bdf8; }',
    },
    {
      path: 'big-app/src/utils/id.ts',
      name: 'id.ts',
      content:
        'import { randomUUID, createHash } from "node:crypto";\nexport function makeId() { return randomUUID() + ":" + createHash("sha256").update("ok").digest("hex").slice(0, 6); }',
    },
  ];

  // Add 46 modular components/widgets to verify 55+ file scale
  for (let i = 1; i <= 46; i++) {
    rawEntries.push({
      path: `big-app/src/components/Widget${i}.tsx`,
      name: `Widget${i}.tsx`,
      content: `import React from "react";\nexport function Widget${i}() { return <span data-w="${i}">W${i}</span>; }`,
    });
  }

  rawEntries.push({
    path: 'big-app/src/App.tsx',
    name: 'App.tsx',
    content: [
      'import React from "react";',
      'import { Sparkles } from "lucide-react";',
      'import { initializeApp } from "firebase/app";',
      'import { makeId } from "@/utils/id";',
      'import { Widget1 } from "./components/Widget1";',
      'import { Widget46 } from "../src/components/Widget46";',
      'export function App() {',
      '  const code = "</script>";',
      '  return <main data-f={typeof initializeApp}><Sparkles size={16} /><h1 className="hero-title">Loaded {makeId()} {code}</h1><Widget1 /><Widget46 /></main>;',
      '}',
    ].join('\n'),
  });

  rawEntries.push({
    path: 'big-app/src/main.tsx',
    name: 'main.tsx',
    content:
      'import { createRoot } from "react-dom/client";\nimport { App } from "./App";\nimport "./index.css";\ncreateRoot(document.getElementById("root")!).render(<App />);',
  });

  assert.equal(isNonRuntimeBundleFile('src/App.test.tsx'), true);
  assert.equal(isNonRuntimeBundleFile('src/utils/helper.spec.ts'), true);
  assert.equal(isNonRuntimeBundleFile('server.ts'), true);
  assert.equal(isNonRuntimeBundleFile('vite.config.ts'), true);
  assert.equal(isNonRuntimeBundleFile('tsconfig.json'), true);
  assert.equal(isNonRuntimeBundleFile('package.json'), true);
  assert.equal(isNonRuntimeBundleFile('android/app/Main.kt'), true);
  assert.equal(isNonRuntimeBundleFile('src/App.tsx'), false);

  const uploaded = normalizeUploadedFiles(rawEntries);
  assert.ok(!uploaded.some((f) => f.path.includes('node_modules/')));
  assert.ok(uploaded.some((f) => f.path.includes('android/app/src/main/MainActivity.kt')));

  const entry = findEntryHtmlPath(uploaded)!;
  assert.equal(entry, 'index.html');
  assert.equal(needsModuleBundling(uploaded, entry), true);

  const bundle = await bundleProjectInBrowser(uploaded, entry);
  assert.equal(bundle.error, undefined);
  assert.ok(bundle.js && bundle.js.includes('Widget46'));
  assert.ok(bundle.js && bundle.js.includes('randomUUID'));
  assert.ok(bundle.css && bundle.css.includes('.hero-title'));
  assert.equal(bundle.usesTailwind, true);
  assert.ok(bundle.importMap);
  assert.equal(bundle.importMap!['react'], 'https://esm.sh/react@19.0.1');
  assert.equal(bundle.importMap!['lucide-react'], 'https://esm.sh/lucide-react@0.546.0?external=react,react-dom');
  assert.equal(bundle.importMap!['firebase/app'], 'https://esm.sh/firebase@11.0.0/app?external=react,react-dom');

  const srcDoc = buildSrcDoc(uploaded, entry, '', bundle);
  assert.ok(srcDoc.includes('<script type="importmap"'));
  assert.ok(srcDoc.includes('id="__ve_bundle_payload__"'));
  assert.ok(srcDoc.includes('URL.createObjectURL'));
  assert.ok(srcDoc.includes('<style data-ve-bundled="true">'));
  assert.ok(!srcDoc.includes('UNVALID SYNTAX'));
  // Ensure JSON payload escaped </script> inside user code so it cannot break script parsing
  assert.ok(!srcDoc.split('id="__ve_bundle_payload__"')[1].split('</script>')[0].includes('"</script>"'));
});

test('bundleProjectInBrowser reports exact filename and line number on syntax error', async () => {
  const uploaded = normalizeUploadedFiles([
    {
      path: 'err-app/index.html',
      name: 'index.html',
      content: '<html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    },
    {
      path: 'err-app/src/Broken.tsx',
      name: 'Broken.tsx',
      content: 'export function Broken() {\n  const ok = 1;\n  const broken = (;\n  return <div>{ok}</div>;\n}',
    },
    {
      path: 'err-app/src/main.tsx',
      name: 'main.tsx',
      content: 'import { Broken } from "./Broken";\nconsole.log(Broken);',
    },
  ]);

  const bundle = await bundleProjectInBrowser(uploaded, 'index.html');
  assert.ok(bundle.error);
  assert.ok(bundle.errorDetails && bundle.errorDetails.length >= 1);
  assert.equal(bundle.errorDetails![0].file, 'src/Broken.tsx');
  assert.equal(bundle.errorDetails![0].line, 3);

  const srcDoc = buildSrcDoc(uploaded, 'index.html', '', bundle);
  assert.ok(srcDoc.includes('Project Build Error'));
  assert.ok(srcDoc.includes('src/Broken.tsx'));
  assert.ok(srcDoc.includes('Line 3'));
});

test('reactVisualSync persists runtime React style and JSX text edits for ZIP export', () => {
  const files = normalizeUploadedFiles([
    {
      path: 'app/index.html',
      name: 'index.html',
      content: '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
    },
    {
      path: 'app/src/App.tsx',
      name: 'App.tsx',
      content: 'export function App() {\n  return <h1 className="title">Old Headline</h1>;\n}',
    },
    {
      path: 'app/src/main.tsx',
      name: 'main.tsx',
      content: 'import { App } from "./App";\nconsole.log(App);',
    },
  ]);

  const restyled = applyRuntimeStylePatchToFiles(files, '#root > h1:nth-of-type(1)', {
    color: '#ef4444',
    'font-size': '32px',
  });
  const overrideCss = restyled.find((f) => f.path === 'src/framecraft-edits.css');
  assert.ok(overrideCss);
  assert.ok(overrideCss!.content.includes('color: #ef4444 !important;'));
  assert.ok(restyled.find((f) => f.path === 'src/main.tsx')!.content.includes("./framecraft-edits.css"));

  const textEdited = applyRuntimeTextPatchToFiles(restyled, {
    selector: '#root > h1:nth-of-type(1)',
    tagName: 'h1',
    previousText: 'Old Headline',
    nextText: 'New Edited Headline',
  });
  assert.ok(textEdited.find((f) => f.path === 'src/App.tsx')!.content.includes('New Edited Headline'));
});

test('bundleProjectInBrowser supports multi-language repos, android-kiosk-launcher, ?raw, ?url, static assets, and preserves all files for ZIP', async () => {
  const rawEntries = [
    {
      path: 'kiosk-repo/index.html',
      name: 'index.html',
      content:
        '<!doctype html><html><head><title>Kiosk</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    },
    {
      path: 'kiosk-repo/package.json',
      name: 'package.json',
      content: JSON.stringify({ name: 'kiosk-suite', dependencies: { react: '^19.0.1', 'react-dom': '^19.0.1' } }),
    },
    {
      path: 'kiosk-repo/README.md',
      name: 'README.md',
      content: '# Kiosk Suite\n```bash\nbroken syntax {{{(\n```',
    },
    {
      path: 'kiosk-repo/.github/workflows/build.yml',
      name: 'build.yml',
      content: 'name: Build\non: [push]\njobs:\n  apk:\n    runs-on: ubuntu-latest\n',
    },
    {
      path: 'kiosk-repo/android-kiosk-launcher/build.gradle.kts',
      name: 'build.gradle.kts',
      content: 'plugins { id("com.android.application") }',
    },
    {
      path: 'kiosk-repo/android-kiosk-launcher/gradle.properties',
      name: 'gradle.properties',
      content: 'org.gradle.jvmargs=-Xmx2048m',
    },
    {
      path: 'kiosk-repo/android-kiosk-launcher/proguard-rules.pro',
      name: 'proguard-rules.pro',
      content: '-keep class com.kiosk.** { *; }',
    },
    {
      path: 'kiosk-repo/android-kiosk-launcher/scripts/build.sh',
      name: 'build.sh',
      content: '#!/usr/bin/env bash\n./gradlew assembleRelease',
    },
    {
      path: 'kiosk-repo/android-kiosk-launcher/app/src/main/AndroidManifest.xml',
      name: 'AndroidManifest.xml',
      content: '<manifest package="com.kiosk.launcher"><application android:label="Kiosk" /></manifest>',
    },
    {
      path: 'kiosk-repo/android-kiosk-launcher/app/src/main/java/MainActivity.kt',
      name: 'MainActivity.kt',
      content: 'package com.kiosk.launcher\nclass MainActivity : Activity() { /* Kotlin */ }',
    },
    {
      path: 'kiosk-repo/android-kiosk-launcher/dist/kiosk-release.apk',
      name: 'kiosk-release.apk',
      content: 'data:application/vnd.android.package-archive;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
    },
    {
      path: 'kiosk-repo/src/assets/logo.png',
      name: 'logo.png',
      content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    },
    {
      path: 'kiosk-repo/src/assets/badge.svg',
      name: 'badge.svg',
      content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    },
    {
      path: 'kiosk-repo/src/assets/font.woff2',
      name: 'font.woff2',
      content: 'data:font/woff2;base64,d09GMgABAAAAAA==',
    },
    {
      path: 'kiosk-repo/src/styles/theme.css',
      name: 'theme.css',
      content: '.kiosk-shell { background: #0f172a; }',
    },
    {
      path: 'kiosk-repo/src/styles/app.css',
      name: 'app.css',
      content: '@import "./theme.css";\n.kiosk-title { color: #38bdf8; }',
    },
    {
      path: 'kiosk-repo/src/config.json',
      name: 'config.json',
      content: JSON.stringify({ appVersion: '2.4.0' }),
    },
    {
      path: 'kiosk-repo/src/App.jsx',
      name: 'App.jsx',
      content: [
        'import React from "react";',
        'import mainKt from "../android-kiosk-launcher/app/src/main/java/MainActivity.kt?raw";',
        'import manifestXml from "../android-kiosk-launcher/app/src/main/AndroidManifest.xml?raw";',
        'import apkUrl from "../android-kiosk-launcher/dist/kiosk-release.apk?url";',
        'import logoUrl from "./assets/logo.png";',
        'import badgeSvg from "./assets/badge.svg";',
        'import fontUrl from "./assets/font.woff2?url";',
        'import cfg from "./config.json";',
        'export function App() {',
        '  return React.createElement("div", { "data-ver": cfg.appVersion, "data-apk": apkUrl, "data-font": fontUrl }, mainKt + manifestXml + logoUrl + badgeSvg);',
        '}',
      ].join('\n'),
    },
    {
      path: 'kiosk-repo/src/main.tsx',
      name: 'main.tsx',
      content: 'import { createRoot } from "react-dom/client";\nimport "./styles/app.css";\nimport { App } from "./App";\ncreateRoot(document.getElementById("root")!).render(<App />);',
    },
  ];

  assert.equal(isNonRuntimeBundleFile('android-kiosk-launcher/app/src/main/java/MainActivity.kt'), true);
  assert.equal(isNonRuntimeBundleFile('android-kiosk-launcher/build.gradle.kts'), true);
  assert.equal(isNonRuntimeBundleFile('.github/workflows/build.yml'), true);
  assert.equal(isNonRuntimeBundleFile('README.md'), true);

  const uploaded = normalizeUploadedFiles(rawEntries);
  assert.equal(uploaded.length, rawEntries.length);
  assert.ok(uploaded.some((f) => f.path === 'android-kiosk-launcher/app/src/main/java/MainActivity.kt'));
  assert.ok(uploaded.some((f) => f.path === 'android-kiosk-launcher/dist/kiosk-release.apk'));

  const bundle = await bundleProjectInBrowser(uploaded, 'index.html');
  assert.equal(bundle.error, undefined);
  assert.ok(bundle.js && bundle.js.includes('class MainActivity : Activity()'));
  assert.ok(bundle.js && bundle.js.includes('com.kiosk.launcher'));
  assert.ok(bundle.js && bundle.js.includes('data:image/png;base64,'));
  assert.ok(bundle.js && bundle.js.includes('data:image/svg+xml'));
  assert.ok(bundle.js && bundle.js.includes('data:application/vnd.android.package-archive;base64,'));
  assert.ok(bundle.js && bundle.js.includes('data:font/woff2;base64,'));
  assert.ok(bundle.js && bundle.js.includes('2.4.0'));
  assert.ok(bundle.css && bundle.css.includes('.kiosk-shell') && bundle.css.includes('.kiosk-title'));

  const srcDoc = buildSrcDoc(uploaded, 'index.html', buildIframeBridgeMarkup('edit', null), bundle);
  assert.ok(srcDoc.includes('<style data-ve-bundled="true">'));
  assert.ok(srcDoc.includes('MutationObserver'));
  assert.ok(srcDoc.includes('data-ve-rt'));
});

test('matchShortcutAction supports Ctrl/Cmd keybinds and respects typing context except Escape & Save', () => {
  const base = {
    editorMode: 'edit' as const,
    hasSelectedElement: true,
    hasOpenModal: false,
    isTyping: false,
  };

  assert.equal(matchShortcutAction({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'undo');
  assert.equal(matchShortcutAction({ key: 'z', ctrlKey: false, metaKey: true, shiftKey: true, altKey: false }, base), 'redo');
  assert.equal(matchShortcutAction({ key: 'y', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'redo');
  assert.equal(matchShortcutAction({ key: 's', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'save');
  assert.equal(matchShortcutAction({ key: 'e', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'toggle-mode');
  assert.equal(matchShortcutAction({ key: 'b', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'toggle-left-sidebar');
  assert.equal(matchShortcutAction({ key: 'i', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'toggle-right-sidebar');
  assert.equal(matchShortcutAction({ key: 'd', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'duplicate');
  assert.equal(matchShortcutAction({ key: 'Delete', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'delete');
  assert.equal(matchShortcutAction({ key: 'ArrowUp', ctrlKey: false, metaKey: false, shiftKey: false, altKey: true }, base), 'move-up');
  assert.equal(matchShortcutAction({ key: 'ArrowDown', ctrlKey: false, metaKey: false, shiftKey: false, altKey: true }, base), 'move-down');
  assert.equal(matchShortcutAction({ key: '1', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'viewport-desktop');
  assert.equal(matchShortcutAction({ key: '2', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'viewport-tablet');
  assert.equal(matchShortcutAction({ key: '3', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'viewport-mobile');
  assert.equal(matchShortcutAction({ key: '?', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'open-shortcuts');

  // Typing guard ignores Delete/1/Undo, but keeps Escape & Ctrl/Cmd+S active
  const typingCtx = { ...base, isTyping: true };
  assert.equal(matchShortcutAction({ key: 'Delete', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, typingCtx), null);
  assert.equal(matchShortcutAction({ key: '1', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, typingCtx), null);
  assert.equal(matchShortcutAction({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, typingCtx), null);
  assert.equal(matchShortcutAction({ key: 'Escape', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, typingCtx), 'escape');
  assert.equal(matchShortcutAction({ key: 's', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, typingCtx), 'save');

  assert.equal(isShortcutTypingTarget({ tagName: 'INPUT' }), true);
  assert.equal(isShortcutTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isShortcutTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isShortcutTypingTarget({ tagName: 'DIV', closest: () => ({}) }), true);
  assert.equal(isShortcutTypingTarget({ tagName: 'BUTTON', isContentEditable: false }), false);

  assert.equal(classifyViewportPresetFromWidth(390), 'mobile');
  assert.equal(classifyViewportPresetFromWidth(768), 'tablet');
  assert.equal(classifyViewportPresetFromWidth(1180), 'desktop');
});

test('moveElementSiblingInHtml reorders sibling elements up and down cleanly', () => {
  const html = tagHtmlWithVeIds(
    '<!doctype html><html><body><section id="wrap"><h1>First</h1><p>Second</p><button>Third</button></section></body></html>'
  );
  const scanned = scanHtmlElements(html);
  const pEl = scanned.find((el) => el.tagName === 'p')!;

  const movedUp = moveElementSiblingInHtml(html, pEl.veId, 'up');
  assert.equal(movedUp.moved, true);
  assert.ok(movedUp.html.indexOf('<p') < movedUp.html.indexOf('<h1'));

  const movedDown = moveElementSiblingInHtml(movedUp.html, pEl.veId, 'down');
  assert.equal(movedDown.moved, true);
  assert.ok(movedDown.html.indexOf('<h1') < movedDown.html.indexOf('<p'));

  const btnEl = scanned.find((el) => el.tagName === 'button')!;
  const boundaryDown = moveElementSiblingInHtml(html, btnEl.veId, 'down');
  assert.equal(boundaryDown.moved, false);
});

test('findElementSourceLocation and insertQuickComponentInProject locate and insert across HTML and TSX', () => {
  // Static HTML case
  const staticHtml = tagHtmlWithVeIds('<html><body><section><h2 id="hero">Hello World</h2></section></body></html>');
  const h2Id = scanHtmlElements(staticHtml).find((el) => el.tagName === 'h2')!.veId;
  const staticFiles = [
    { path: 'index.html', name: 'index.html', type: 'html' as const, content: staticHtml },
  ];
  const mockSelectedHtml = {
    veId: h2Id,
    runtimeId: 'rt-1',
    tagName: 'h2',
    id: 'hero',
    className: '',
    textContent: 'Hello World',
  } as SelectedElementInfo;

  const htmlLoc = findElementSourceLocation(staticFiles, 'index.html', mockSelectedHtml);
  assert.equal(htmlLoc?.path, 'index.html');
  assert.equal(htmlLoc?.line, 1);

  const insertedStatic = insertQuickComponentInProject(staticFiles, 'index.html', 'button', mockSelectedHtml);
  assert.equal(insertedStatic.targetPath, 'index.html');
  assert.ok(insertedStatic.insertedVeId);
  assert.ok(insertedStatic.files[0].content.includes('Action Button'));

  // React / TSX SPA case
  const reactFiles = normalizeUploadedFiles([
    { path: 'app/index.html', name: 'index.html', content: '<div id="root"></div><script type="module" src="/src/main.tsx"></script>' },
    {
      path: 'app/src/App.tsx',
      name: 'App.tsx',
      content: 'export function App() {\n  return (\n    <main className="shell">\n      <h1>Studio Title</h1>\n    </main>\n  );\n}',
    },
    { path: 'app/src/main.tsx', name: 'main.tsx', content: 'import { App } from "./App"; console.log(App);' },
  ]);
  const mockSelectedReact = {
    veId: null,
    runtimeId: 'rt-2',
    tagName: 'h1',
    id: '',
    className: '',
    textContent: 'Studio Title',
  } as SelectedElementInfo;

  const jsxLoc = findElementSourceLocation(reactFiles, 'index.html', mockSelectedReact);
  assert.equal(jsxLoc?.path, 'src/App.tsx');
  assert.equal(jsxLoc?.line, 4);

  const insertedJsx = insertQuickComponentInProject(reactFiles, 'index.html', 'card', mockSelectedReact);
  assert.equal(insertedJsx.targetPath, 'src/App.tsx');
  assert.ok(insertedJsx.files.find((f) => f.path === 'src/App.tsx')!.content.includes('Feature Card'));
});

test('getFileBadgeStyle color-codes project extensions and buildProjectFileTree nests folders deterministically', () => {
  assert.equal(getFileBadgeStyle('src/App.tsx').category, 'react');
  assert.equal(getFileBadgeStyle('src/Widget.jsx').shortLabel, 'JSX');
  assert.equal(getFileBadgeStyle('src/main.ts').category, 'script');
  assert.equal(getFileBadgeStyle('src/styles.css').category, 'style');
  assert.equal(getFileBadgeStyle('package.json').category, 'json');
  assert.equal(getFileBadgeStyle('index.html').category, 'html');
  assert.equal(getFileBadgeStyle('android/MainActivity.kt').category, 'native');

  const tree = buildProjectFileTree([
    { path: 'index.html', name: 'index.html', content: '<html/>', type: 'html' },
    { path: 'src/components/Button.tsx', name: 'Button.tsx', content: '<button/>', type: 'js' },
    { path: 'src/App.tsx', name: 'App.tsx', content: '<div/>', type: 'js' },
    { path: 'android/app/Main.kt', name: 'Main.kt', content: 'class Main', type: 'other' },
  ]);

  assert.equal(tree[0].kind, 'folder');
  assert.equal(tree[0].name, 'android');
  assert.equal(tree[1].kind, 'folder');
  assert.equal(tree[1].name, 'src');
  assert.equal(tree[2].kind, 'file');
  assert.equal(tree[2].name, 'index.html');
  if (tree[1].kind === 'folder') {
    assert.equal(tree[1].children[0].kind, 'folder');
    assert.equal(tree[1].children[0].name, 'components');
    assert.equal(tree[1].children[1].kind, 'file');
    assert.equal(tree[1].children[1].name, 'App.tsx');
  }
});

test('local/public images, SVGs, CSS background urls, and React runtime img attrs resolve inside preview', () => {
  const pngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const files = normalizeUploadedFiles([
    {
      path: 'my-site/index.html',
      name: 'index.html',
      content:
        '<!doctype html><html><head><link rel="icon" href="/favicon.png" /><link rel="stylesheet" href="styles.css" /></head><body><img src="/hero.png" alt="Hero" /><img src="./assets/mark.svg" alt="Mark" /></body></html>',
    },
    {
      path: 'my-site/styles.css',
      name: 'styles.css',
      content: '.banner { background-image: url("./assets/mark.svg"); }',
    },
    {
      path: 'my-site/public/hero.png',
      name: 'hero.png',
      content: pngDataUrl,
      blobUrl: 'blob:http://localhost:3000/hero',
    },
    {
      path: 'my-site/public/favicon.png',
      name: 'favicon.png',
      content: pngDataUrl,
    },
    {
      path: 'my-site/assets/mark.svg',
      name: 'mark.svg',
      content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
    },
  ]);

  const assetMap = buildProjectAssetUrlMap(files, 'index.html');
  assert.equal(assetMap['/hero.png'], pngDataUrl);
  assert.ok(assetMap['assets/mark.svg'].startsWith('data:image/svg+xml'));

  const rewrittenCss = rewriteCssAssetUrls(
    '.banner { background-image: url("./assets/mark.svg"); }',
    'styles.css',
    assetMap,
    'index.html'
  );
  assert.ok(rewrittenCss.includes('data:image/svg+xml'));

  const rewrittenHtml = rewriteHtmlAssetRefs(
    '<img src="/hero.png" alt="Hero" />',
    'index.html',
    assetMap
  );
  assert.ok(rewrittenHtml.includes(pngDataUrl));
  assert.ok(rewrittenHtml.includes('data-ve-raw-src="/hero.png"'));

  const srcDoc = buildSrcDoc(files, 'index.html', buildIframeBridgeMarkup('edit', null));
  assert.ok(srcDoc.includes('window.__PROJECT_ASSETS__'));
  assert.ok(srcDoc.includes('window.__resolveProjectAsset__'));
  assert.ok(srcDoc.includes(pngDataUrl));

  // React runtime attribute patching persists image src/alt updates
  const reactFiles = [
    { path: 'src/main.tsx', name: 'main.tsx', type: 'js' as const, content: 'console.log("app");' },
  ];
  const patchedReact = applyRuntimeAttrPatchToFiles(reactFiles, '#hero-img', {
    src: '/hero.png',
    alt: 'Updated Banner',
  });
  const runtimeOverrideFile = patchedReact.find((f) =>
    f.content.includes('@framecraft-attr-map')
  );
  assert.ok(runtimeOverrideFile);
  assert.ok(runtimeOverrideFile.content.includes('Updated Banner'));
});

test('writeProjectFilesToDirectory decodes binary base64 assets back into Uint8Array', async () => {
  const written: Array<{ path: string; data: unknown }> = [];
  const makeDirHandle = (prefix: string) => ({
    name: prefix,
    async getDirectoryHandle(name: string) {
      return makeDirHandle(`${prefix}/${name}`);
    },
    async getFileHandle(name: string) {
      return {
        async createWritable() {
          return {
            async write(data: unknown) {
              written.push({ path: `${prefix}/${name}`, data });
            },
            async close() {},
          };
        },
      };
    },
  });

  const pngBase64 = 'data:image/png;base64,iVBORw0KGgo=';
  const res = await writeProjectFilesToDirectory(makeDirHandle('root'), [
    { path: 'public/logo.png', name: 'logo.png', type: 'other', content: pngBase64 },
    { path: 'index.html', name: 'index.html', type: 'html', content: '<html></html>' },
  ]);

  assert.equal(res.ok, true);
  const logoWrite = written.find((w) => w.path.endsWith('/logo.png'));
  assert.ok(logoWrite?.data instanceof Uint8Array);
  assert.equal(written.find((w) => w.path.endsWith('/index.html'))?.data, '<html></html>');
});

test('parseGitHubRepoUrl, GitHub blob encoding/decoding, and computeFilesFingerprint work without keys', () => {
  const fullUrl = parseGitHubRepoUrl('https://github.com/acme-org/studio-app.git');
  assert.equal(fullUrl.ok, true);
  if (fullUrl.ok) {
    assert.equal(fullUrl.data.owner, 'acme-org');
    assert.equal(fullUrl.data.repo, 'studio-app');
    assert.equal(fullUrl.data.repoFullName, 'acme-org/studio-app');
  }

  const branchUrl = parseGitHubRepoUrl('https://github.com/acme-org/studio-app/tree/feature/ui');
  assert.equal(branchUrl.ok, true);
  if (branchUrl.ok) {
    assert.equal(branchUrl.data.branch, 'feature/ui');
  }

  const shortUrl = parseGitHubRepoUrl('acme-org/studio-app');
  assert.equal(shortUrl.ok, true);

  const nonGithub = parseGitHubRepoUrl('https://evil.example.com/owner/repo');
  assert.equal(nonGithub.ok, false);

  const encodedPng = encodeProjectFileForGitHubBlob({
    path: 'public/hero.png',
    name: 'hero.png',
    type: 'other',
    content: 'data:image/png;base64,AQID',
  });
  assert.equal(encodedPng.encoding, 'base64');
  assert.equal(encodedPng.content, 'AQID');
  assert.equal(
    decodeGitHubBlobToProjectContent('public/hero.png', 'AQID'),
    'data:image/png;base64,AQID'
  );

  const encodedHtml = encodeProjectFileForGitHubBlob({
    path: 'index.html',
    name: 'index.html',
    type: 'html',
    content: '<h1>Hello</h1>',
  });
  assert.equal(encodedHtml.encoding, 'utf-8');

  const fp1 = computeFilesFingerprint([
    { path: 'index.html', name: 'index.html', type: 'html', content: '<h1>A</h1>' },
  ]);
  const fp2 = computeFilesFingerprint([
    { path: 'index.html', name: 'index.html', type: 'html', content: '<h1>B</h1>' },
  ]);
  assert.notEqual(fp1, fp2);
});

test('serverValidation enforces payload schemas and sliding-window rate limits', () => {
  assert.equal(validateBundleProjectPayload(null).ok, false);
  assert.equal(validateBundleProjectPayload({ entryPath: '', files: [] }).ok, false);
  const validBundle = validateBundleProjectPayload({
    entryPath: 'index.html',
    files: [{ path: 'index.html', content: '<h1>Hi</h1>', type: 'html' }],
  });
  assert.equal(validBundle.ok, true);

  assert.equal(
    validateGithubPullPayload({ repoUrl: 'https://github.com/a/b', branch: '../bad' }).ok,
    false
  );
  assert.equal(
    validateGithubPullPayload({ repoUrl: 'https://github.com/a/b', branch: 'main' }).ok,
    true
  );

  assert.equal(
    validateGithubPushPayload({
      repoUrl: 'https://github.com/a/b',
      commitMessage: 'x'.repeat(501),
      files: [{ path: 'a.html', content: '<p>ok</p>' }],
    }).ok,
    false
  );
  assert.equal(
    validateGithubPushPayload({
      repoUrl: 'https://github.com/a/b',
      commitMessage: 'Update index',
      files: [{ path: 'index.html', name: 'index.html', type: 'html', content: '<p>ok</p>' }],
    }).ok,
    true
  );

  const limiter = createSlidingWindowRateLimiter({ maxRequests: 2, windowMs: 1000 });
  assert.equal(limiter.check('127.0.0.1', 100).allowed, true);
  assert.equal(limiter.check('127.0.0.1', 200).allowed, true);
  const blocked = limiter.check('127.0.0.1', 300);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(limiter.check('127.0.0.1', 1300).allowed, true);
});

test('mergeUpstreamFilesWithWorkspace applies upstream changes while preserving extra local files', () => {
  const localFiles = [
    { path: 'index.html', name: 'index.html', type: 'html' as const, content: '<h1>Local Old</h1>' },
    { path: 'src/local-notes.md', name: 'local-notes.md', type: 'other' as const, content: 'Keep me' },
  ];
  const upstreamFiles = [
    { path: 'index.html', name: 'index.html', type: 'html' as const, content: '<h1>Upstream New</h1>' },
    { path: 'styles.css', name: 'styles.css', type: 'css' as const, content: 'body { color: #111; }' },
  ];

  const outcome = mergeUpstreamFilesWithWorkspace(localFiles, upstreamFiles);
  assert.equal(outcome.updatedCount, 2);
  assert.equal(outcome.preservedLocalCount, 1);
  assert.deepEqual(
    outcome.merged.map((f) => f.path),
    ['index.html', 'src/local-notes.md', 'styles.css']
  );
  assert.equal(outcome.merged.find((f) => f.path === 'index.html')?.content, '<h1>Upstream New</h1>');
  assert.equal(outcome.merged.find((f) => f.path === 'src/local-notes.md')?.content, 'Keep me');
});

test('fontLibrary catalogs 25+ fonts, matches CSS families, and injects Google Fonts links safely', () => {
  assert.ok(STUDIO_FONT_CATALOG.length >= 25);
  const fraunces = matchStudioFontOption('"Fraunces", Georgia, serif');
  assert.equal(fraunces?.id, 'fraunces');
  assert.equal(fraunces?.category, 'Editorial Serif');

  const used = collectUsedGoogleFonts([
    '<h1 style="font-family: \'Playfair Display\', serif">Hello</h1>',
    'body { font-family: "DM Sans", sans-serif; }',
  ]);
  assert.ok(used.some((f) => f.includes('Playfair+Display')));
  assert.ok(used.some((f) => f.includes('DM+Sans')));

  const href = buildGoogleFontsHref(used);
  assert.ok(href && href.startsWith('https://fonts.googleapis.com/css2?'));

  const baseHtml = '<!doctype html><html><head><title>App</title></head><body><h1>Hi</h1></body></html>';
  const withFont = ensureGoogleFontInHtml(baseHtml, '"Syne", sans-serif');
  assert.ok(withFont.includes('family=Syne'));
  assert.equal(ensureGoogleFontInHtml(withFont, '"Syne", sans-serif'), withFont);
});

test('matchShortcutAction supports Adobe/MS365/Figma editing shortcuts including arrows, clipboard, layers, zoom, and command palette', () => {
  const base = {
    editorMode: 'edit' as const,
    hasSelectedElement: true,
    hasOpenModal: false,
    isTyping: false,
  };

  assert.equal(matchShortcutAction({ key: 'k', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'open-command-palette');
  assert.equal(matchShortcutAction({ key: 'ArrowRight', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'nudge-right');
  assert.equal(matchShortcutAction({ key: 'ArrowLeft', ctrlKey: false, metaKey: false, shiftKey: true, altKey: false }, base), 'nudge-left-10');
  assert.equal(matchShortcutAction({ key: 'ArrowUp', ctrlKey: false, metaKey: false, shiftKey: true, altKey: false }, base), 'nudge-up-10');
  assert.equal(matchShortcutAction({ key: 'ArrowDown', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'nudge-down');
  assert.equal(matchShortcutAction({ key: 'c', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'copy-element');
  assert.equal(matchShortcutAction({ key: 'x', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'cut-element');
  assert.equal(matchShortcutAction({ key: 'v', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'paste-element');
  assert.equal(matchShortcutAction({ key: 'c', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false }, base), 'copy-style');
  assert.equal(matchShortcutAction({ key: 'v', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false }, base), 'paste-style');
  assert.equal(matchShortcutAction({ key: ']', code: 'BracketRight', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'bring-forward');
  assert.equal(matchShortcutAction({ key: '[', code: 'BracketLeft', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'send-backward');
  assert.equal(matchShortcutAction({ key: '\\', code: 'Backslash', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'toggle-zen');
  assert.equal(matchShortcutAction({ key: 'h', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false }, base), 'toggle-visibility');
  assert.equal(matchShortcutAction({ key: 'l', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'toggle-aspect-lock');
  assert.equal(matchShortcutAction({ key: 'e', ctrlKey: true, metaKey: false, shiftKey: true, altKey: false }, base), 'align-center');
  assert.equal(matchShortcutAction({ key: 'u', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'format-underline');
  assert.equal(matchShortcutAction({ key: '!', code: 'Digit1', ctrlKey: false, metaKey: false, shiftKey: true, altKey: false }, base), 'zoom-fit');
  assert.equal(matchShortcutAction({ key: '0', code: 'Digit0', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'zoom-100');
  assert.equal(matchShortcutAction({ key: '=', code: 'Equal', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'zoom-in');
  assert.equal(matchShortcutAction({ key: '-', code: 'Minus', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, base), 'zoom-out');
  assert.equal(matchShortcutAction({ key: 'v', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'mode-edit');
  assert.equal(matchShortcutAction({ key: 'g', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'toggle-outlines');
  assert.equal(matchShortcutAction({ key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, base), 'edit-text');
  assert.equal(matchShortcutAction({ key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: true, altKey: false }, base), 'select-parent');
});

test('extractElementHtmlByVeId, extractHotPatchPayload, and 6 categorized starter templates work cleanly', () => {
  assert.equal(SAMPLE_TEMPLATES.length, 6);
  for (const tpl of SAMPLE_TEMPLATES) {
    assert.ok(tpl.category, `Template ${tpl.id} should have a category`);
  }

  const html = '<!doctype html><html><head><title>Demo</title><link rel="stylesheet" href="styles.css"></head><body><section id="card" data-ve-node="n-1"><h2>Card</h2></section></body></html>';
  const copied = extractElementHtmlByVeId(html, 've-0');
  assert.ok(copied);
  assert.ok(copied!.includes('id="card-copy"'));
  assert.ok(!copied!.includes('data-ve-node'));

  const payload = extractHotPatchPayload(SAMPLE_TEMPLATES[2].files, 'index.html');
  assert.ok(payload);
  assert.ok(payload!.bodyHtml.includes('data-ve-id='));
  assert.ok(payload!.cssSources['styles.css'] !== undefined);
  assert.ok(payload!.googleFontHref && payload!.googleFontHref.includes('https://fonts.googleapis.com'));
});

test('bundleProjectInBrowser handles external package CSS, CSS modules, tsconfig.app.json baseUrl, virtual/vite shims, and importmap merging', async () => {
  const files = normalizeUploadedFiles([
    {
      path: 'mantine-app/index.html',
      name: 'index.html',
      content:
        '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \'self\'"><script type="importmap">{"imports":{"custom-pkg":"https://esm.sh/custom-pkg@1.0.0"}}</script><title>App</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    },
    {
      path: 'mantine-app/package.json',
      name: 'package.json',
      content: JSON.stringify({
        name: 'mantine-app',
        dependencies: {
          react: '^19.2.0',
          'react-dom': '^19.2.0',
          '@mantine/core': '9.8.1',
          swiper: '^11.0.0',
        },
      }),
    },
    {
      path: 'mantine-app/tsconfig.json',
      name: 'tsconfig.json',
      content: JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }] }),
    },
    {
      path: 'mantine-app/tsconfig.app.json',
      name: 'tsconfig.app.json',
      content: JSON.stringify({
        compilerOptions: {
          baseUrl: 'src',
          paths: { '@/*': ['./*'] },
        },
      }),
    },
    {
      path: 'mantine-app/src/components/Welcome.module.css',
      name: 'Welcome.module.css',
      content: '.title { color: #38bdf8; } .hero-badge { font-weight: 700; }',
    },
    {
      path: 'mantine-app/src/utils/env.ts',
      name: 'env.ts',
      content: 'import "vite/client";\nimport "virtual:pwa-register";\nimport fs from "node:fs";\nexport const hasFs = typeof fs.existsSync === "function";',
    },
    {
      path: 'mantine-app/src/App.tsx',
      name: 'App.tsx',
      content: [
        'import "@mantine/core/styles.css";',
        'import "swiper/css";',
        'import { MantineProvider } from "@mantine/core";',
        'import classes from "components/Welcome.module.css";',
        'import { hasFs } from "@/utils/env";',
        'export default function App() {',
        '  return <MantineProvider><h1 className={classes.title} data-fs={String(hasFs)}>Hi</h1></MantineProvider>;',
        '}',
      ].join('\n'),
    },
    {
      path: 'mantine-app/src/main.tsx',
      name: 'main.tsx',
      content: 'import ReactDOM from "react-dom/client";\nimport App from "./App";\nReactDOM.createRoot(document.getElementById("root")!).render(<App />);',
    },
  ]);

  const bundle = await bundleProjectInBrowser(files, 'index.html');
  assert.equal(bundle.error, undefined);
  assert.ok(bundle.importMap);
  // Stylesheets must NEVER enter importMap as ES module imports (causes strict MIME text/css error)
  assert.equal(bundle.importMap!['@mantine/core/styles.css'], undefined);
  assert.equal(bundle.importMap!['swiper/css'], undefined);
  assert.equal(bundle.importMap!['vite/client'], undefined);
  assert.equal(bundle.importMap!['virtual:pwa-register'], undefined);
  assert.equal(bundle.importMap!['node:fs'], undefined);
  assert.equal(bundle.importMap!['components/Welcome.module.css'], undefined);
  assert.equal(bundle.importMap!['@mantine/core'], 'https://esm.sh/@mantine/core@9.8.1?external=react,react-dom');

  assert.ok(bundle.externalCssUrls && bundle.externalCssUrls.includes('https://esm.sh/@mantine/core@9.8.1/styles.css'));
  assert.ok(bundle.externalCssUrls!.includes('https://esm.sh/swiper@11.0.0/css'));
  assert.ok(bundle.js && !bundle.js.includes('@mantine/core/styles.css'));
  assert.ok(bundle.js && bundle.js.includes('"title"'));

  const srcDoc = buildSrcDoc(files, 'index.html', '', bundle);
  assert.ok(!/<meta\b[^>]*Content-Security-Policy/i.test(srcDoc));
  assert.equal((srcDoc.match(/<script type="importmap"/g) ?? []).length, 1);
  assert.ok(srcDoc.includes('https://esm.sh/custom-pkg@1.0.0'));
  assert.ok(srcDoc.includes('<link rel="stylesheet" href="https://esm.sh/@mantine/core@9.8.1/styles.css" data-ve-internal="external-css" />'));
  assert.ok(srcDoc.includes('<link rel="stylesheet" href="https://esm.sh/swiper@11.0.0/css" data-ve-internal="external-css" />'));
  assert.ok(srcDoc.includes('diagnoseFailureAndReport'));
});
