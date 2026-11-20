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
  getTableMetricsInHtml,
  insertHtmlSnippet,
  listHtmlElementIds,
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
  buildSrcDoc,
  detectFileType,
  findEntryHtmlPath,
  normalizeUploadedFiles,
} from './projectBundler';
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



