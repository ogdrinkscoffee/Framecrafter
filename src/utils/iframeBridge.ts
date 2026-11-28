import type { EditorMode } from '../types/editor';

export function buildIframeBridgeMarkup(initialMode: EditorMode, selectedVeId: string | null): string {
  const serializedMode = JSON.stringify(initialMode);
  const serializedSelected = JSON.stringify(selectedVeId);

  return `
<style data-ve-internal="bridge-styles">
  [data-ve-hovered="true"] {
    outline: 1.5px dashed #38bdf8 !important;
    outline-offset: 2px !important;
  }
  [data-ve-selected="true"] {
    outline: 2px solid #14a392 !important;
    outline-offset: -1px !important;
  }
  [data-ve-selected="true"]:not([data-ve-editing="true"]) {
    cursor: grab !important;
  }
  [data-ve-dragging="true"] {
    cursor: grabbing !important;
  }
  [data-ve-overlap="true"] {
    outline: 2px solid rgba(244, 63, 94, 0.95) !important;
    outline-offset: 1px !important;
  }
  [data-ve-overflow="true"] {
    outline: 2px dashed rgba(245, 158, 11, 0.95) !important;
    outline-offset: 1px !important;
  }
  [data-ve-editing="true"] {
    outline: 2px solid #f59e0b !important;
    outline-offset: 2px !important;
    cursor: text !important;
  }
  [data-ve-drop-target="inside"] {
    outline: 2px dashed #10b981 !important;
    outline-offset: -2px !important;
    background-color: rgba(16, 185, 129, 0.06) !important;
  }
  [data-ve-drop-target="after"] {
    box-shadow: 0 3px 0 0 #10b981 !important;
  }
  #__ve_hover_badge {
    position: fixed;
    z-index: 2147483647;
    pointer-events: none;
    background: #0f172a;
    color: #e2e8f0;
    border: 1px solid #38bdf8;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
    line-height: 1;
    padding: 4px 6px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    display: none;
    white-space: nowrap;
  }
  #__ve_action_toast {
    position: fixed;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    background: #0f172a;
    color: #f8fafc;
    border: 1px solid #3b82f6;
    padding: 9px 14px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
    display: none;
  }
  #__ve_snap_x {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 1px;
    z-index: 2147483646;
    pointer-events: none;
    background: rgba(236, 72, 153, 0.9);
    display: none;
  }
  #__ve_snap_y {
    position: fixed;
    left: 0;
    right: 0;
    height: 1px;
    z-index: 2147483646;
    pointer-events: none;
    background: rgba(236, 72, 153, 0.9);
    display: none;
  }
</style>
<style data-ve-internal="live-responsive-css"></style>
<style data-ve-internal="preview-responsive-css"></style>
<style data-ve-internal="layout-outlines"></style>
<div id="__ve_hover_badge" data-ve-internal="badge"></div>
<div id="__ve_action_toast" data-ve-internal="action-toast" role="status"></div>
<div id="__ve_snap_x" data-ve-internal="snap-x"></div>
<div id="__ve_snap_y" data-ve-internal="snap-y"></div>
<script data-ve-internal="bridge-script">
(function() {
  var mode = ${serializedMode};
  var selectedEl = null;
  var hoveredEl = null;
  var dropTargetEl = null;
  var editingEl = null;
  var originalEditText = '';
  var runtimeCounter = 0;
  var runtimeMap = new WeakMap();
  var badge = document.getElementById('__ve_hover_badge');
  var actionToast = document.getElementById('__ve_action_toast');
  var snapXLine = document.getElementById('__ve_snap_x');
  var snapYLine = document.getElementById('__ve_snap_y');
  var actionToastTimer = null;
  var domTreeTimer = null;
  var outlinesEnabled = false;
  var xrayEnabled = false;
  var xrayTimer = null;
  var liveResponsiveStyleEl = document.querySelector('style[data-ve-internal="live-responsive-css"]');
  var previewResponsiveStyleEl = document.querySelector('style[data-ve-internal="preview-responsive-css"]');
  var livePositionFrame = 0;
  var outlinesStyleEl = document.querySelector('style[data-ve-internal="layout-outlines"]');
  var moveDrag = null;
  var suppressNextClick = false;
  var artboardId = (function() {
    try {
      if (typeof window.name === 'string' && window.name.indexOf('ve-artboard:') === 0) {
        var namedId = window.name.slice('ve-artboard:'.length);
        if (namedId === 'desktop' || namedId === 'tablet' || namedId === 'mobile') {
          return namedId;
        }
      }
    } catch (err) {}
    var w = window.innerWidth || 1440;
    if (w < 560) return 'mobile';
    if (w < 992) return 'tablet';
    return 'desktop';
  })();

  var CONTAINER_TAGS = new Set([
    'div', 'section', 'main', 'article', 'aside', 'header', 'footer', 'nav', 'form', 'ul', 'ol', 'body'
  ]);

  var SVG_INNER_TAGS = new Set([
    'path', 'polygon', 'polyline', 'circle', 'ellipse', 'rect', 'line', 'g', 'text', 'tspan', 'defs', 'use'
  ]);

  function applyOutlinesCss() {
    if (!outlinesStyleEl) return;
    if (!outlinesEnabled || mode !== 'edit') {
      outlinesStyleEl.textContent = '';
      return;
    }
    outlinesStyleEl.textContent =
      'body [data-ve-id]:not([data-ve-selected="true"]):not([data-ve-hovered="true"]),' +
      'body [data-ve-rt]:not([data-ve-selected="true"]):not([data-ve-hovered="true"]) {' +
      '  outline: 1px dashed rgba(56, 189, 248, 0.42) !important;' +
      '  outline-offset: -1px !important;' +
      '}';
  }

  function clearXrayMarks() {
    var marked = document.querySelectorAll('[data-ve-overlap="true"], [data-ve-overflow="true"]');
    for (var xi = 0; xi < marked.length; xi++) {
      marked[xi].removeAttribute('data-ve-overlap');
      marked[xi].removeAttribute('data-ve-overflow');
    }
  }

  function describeIssueElement(el) {
    var rect = el.getBoundingClientRect();
    var parent = el.parentElement;
    return {
      veId: el.getAttribute('data-ve-id') || null,
      rtId: el.getAttribute('data-ve-rt') || null,
      uniqueSelector: buildUniqueCssSelector(el),
      label: buildElementLabel(el),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      parentDisplay: parent ? window.getComputedStyle(parent).display : ''
    };
  }

  // Sibling collision + horizontal overflow detection for the active viewport.
  function scanLayoutIssues() {
    clearXrayMarks();
    if (!xrayEnabled || mode !== 'edit' || !document.body) return [];

    var issues = [];
    var seen = {};
    var maxIssues = 40;

    function pushIssue(el, kind, detail) {
      if (issues.length >= maxIssues) return;
      var payload = describeIssueElement(el);
      var key = kind + '|' + (payload.veId || payload.rtId || payload.uniqueSelector);
      if (seen[key]) return;
      seen[key] = true;
      el.setAttribute(kind === 'overlap' ? 'data-ve-overlap' : 'data-ve-overflow', 'true');
      issues.push({
        kind: kind,
        detail: detail,
        veId: payload.veId,
        rtId: payload.rtId,
        uniqueSelector: payload.uniqueSelector,
        label: payload.label,
        width: payload.width,
        height: payload.height,
        parentDisplay: payload.parentDisplay
      });
    }

    var elements = document.body.querySelectorAll('*');
    for (var i = 0; i < elements.length && issues.length < maxIssues; i++) {
      var el = elements[i];
      if (!el || el.nodeType !== 1 || isInternalEl(el)) continue;
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
        pushIssue(
          el,
          'overflow',
          'Content is ' + (el.scrollWidth - el.clientWidth) + 'px wider than its own box at ' + Math.round(window.innerWidth) + 'px.'
        );
      }
    }

    for (var p = 0; p < elements.length && issues.length < maxIssues; p++) {
      var parent = elements[p];
      if (!parent || isInternalEl(parent) || !parent.children || parent.children.length < 2) continue;
      var kids = [];
      for (var k = 0; k < parent.children.length; k++) {
        var kid = parent.children[k];
        if (!kid || isInternalEl(kid)) continue;
        var kidStyle = window.getComputedStyle(kid);
        if (kidStyle.display === 'none' || kidStyle.visibility === 'hidden') continue;
        var kidRect = kid.getBoundingClientRect();
        if (kidRect.width < 2 || kidRect.height < 2) continue;
        kids.push({ el: kid, rect: kidRect });
      }
      for (var a = 0; a < kids.length && issues.length < maxIssues; a++) {
        for (var b = a + 1; b < kids.length && issues.length < maxIssues; b++) {
          var first = kids[a];
          var second = kids[b];
          if (first.el.contains(second.el) || second.el.contains(first.el)) continue;
          var overlapW =
            Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left);
          var overlapH =
            Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top);
          if (overlapW > 8 && overlapH > 8) {
            pushIssue(
              second.el,
              'overlap',
              'Collides with ' + buildElementLabel(first.el) + ' across ' + Math.round(overlapW) + '×' + Math.round(overlapH) + 'px.'
            );
          }
        }
      }
    }

    return issues;
  }

  function emitLayoutIssues() {
    postToParent('OVERLAP_REPORT', {
      issues: scanLayoutIssues(),
      width: Math.round(window.innerWidth)
    });
  }

  function scheduleXrayScan() {
    if (!xrayEnabled) return;
    if (xrayTimer) window.clearTimeout(xrayTimer);
    xrayTimer = window.setTimeout(function() {
      xrayTimer = null;
      emitLayoutIssues();
    }, 140);
  }

  function resolveEditableTarget(rawTarget) {
    if (!rawTarget || rawTarget.nodeType !== 1) return null;
    var cur = rawTarget;
    if (SVG_INNER_TAGS.has(cur.tagName.toLowerCase()) && cur.closest) {
      var shapeParent = cur.closest('[data-ve-shape], svg');
      if (shapeParent) return shapeParent;
    }
    return cur;
  }

  function showActionToast(text) {
    if (!actionToast) return;
    actionToast.textContent = text;
    actionToast.style.display = 'block';
    if (actionToastTimer) window.clearTimeout(actionToastTimer);
    actionToastTimer = window.setTimeout(function() {
      actionToast.style.display = 'none';
    }, 2800);
  }

  function getRuntimeId(el) {
    if (!runtimeMap.has(el)) {
      var existingRt = el.getAttribute && el.getAttribute('data-ve-rt');
      var id = existingRt || ('rt-' + (++runtimeCounter));
      runtimeMap.set(el, id);
      if (!existingRt && el.setAttribute && !el.getAttribute('data-ve-id')) {
        el.setAttribute('data-ve-rt', id);
      }
    }
    return runtimeMap.get(el);
  }

  function isInternalEl(el) {
    if (!el || el.nodeType !== 1) return true;
    if (
      el.id === '__ve_hover_badge' ||
      el.id === '__ve_action_toast' ||
      el.id === '__ve_snap_x' ||
      el.id === '__ve_snap_y' ||
      el.getAttribute('data-ve-internal')
    ) return true;
    if (el.closest && el.closest('[data-ve-internal]')) return true;
    var tag = el.tagName.toLowerCase();
    return tag === 'html' || tag === 'head' || tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link';
  }

  function clearSnapGuides() {
    if (snapXLine) snapXLine.style.display = 'none';
    if (snapYLine) snapYLine.style.display = 'none';
  }

  function updateSnapGuides(el) {
    if (!el || !el.parentElement) {
      clearSnapGuides();
      return;
    }
    var r = el.getBoundingClientRect();
    var rMidX = r.left + r.width / 2;
    var rMidY = r.top + r.height / 2;
    var snapXPos = null;
    var snapYPos = null;
    var parentRect = el.parentElement.getBoundingClientRect();
    if (parentRect.width > 0 && Math.abs(rMidX - (parentRect.left + parentRect.width / 2)) <= 4) {
      snapXPos = parentRect.left + parentRect.width / 2;
    }
    if (parentRect.height > 0 && Math.abs(rMidY - (parentRect.top + parentRect.height / 2)) <= 4) {
      snapYPos = parentRect.top + parentRect.height / 2;
    }
    var siblings = el.parentElement.children;
    for (var i = 0; i < siblings.length; i++) {
      var sib = siblings[i];
      if (!sib || sib === el || isInternalEl(sib)) continue;
      var sr = sib.getBoundingClientRect();
      if (sr.width === 0 && sr.height === 0) continue;
      var sMidX = sr.left + sr.width / 2;
      var sMidY = sr.top + sr.height / 2;
      if (snapXPos === null) {
        if (Math.abs(r.left - sr.left) <= 4) snapXPos = sr.left;
        else if (Math.abs(r.right - sr.right) <= 4) snapXPos = sr.right;
        else if (Math.abs(rMidX - sMidX) <= 4) snapXPos = sMidX;
      }
      if (snapYPos === null) {
        if (Math.abs(r.top - sr.top) <= 4) snapYPos = sr.top;
        else if (Math.abs(r.bottom - sr.bottom) <= 4) snapYPos = sr.bottom;
        else if (Math.abs(rMidY - sMidY) <= 4) snapYPos = sMidY;
      }
      if (snapXPos !== null && snapYPos !== null) break;
    }
    if (snapXLine) {
      if (snapXPos !== null) {
        snapXLine.style.left = Math.round(snapXPos) + 'px';
        snapXLine.style.display = 'block';
      } else {
        snapXLine.style.display = 'none';
      }
    }
    if (snapYLine) {
      if (snapYPos !== null) {
        snapYLine.style.top = Math.round(snapYPos) + 'px';
        snapYLine.style.display = 'block';
      } else {
        snapYLine.style.display = 'none';
      }
    }
  }

  function tagMountedElements(rootNode) {
    if (!rootNode || rootNode.nodeType !== 1) return 0;
    var tagged = 0;
    var stack = [rootNode];
    while (stack.length > 0) {
      var cur = stack.pop();
      if (!cur || cur.nodeType !== 1 || isInternalEl(cur)) continue;
      if (cur !== document.body && !cur.getAttribute('data-ve-id') && !cur.getAttribute('data-ve-rt')) {
        getRuntimeId(cur);
        tagged++;
      }
      var children = cur.children;
      if (children && children.length) {
        for (var i = children.length - 1; i >= 0; i--) {
          stack.push(children[i]);
        }
      }
    }
    return tagged;
  }

  function buildDomTree(rootNode, depth) {
    if (!rootNode || rootNode.nodeType !== 1 || depth > 12) return [];
    var result = [];
    var children = rootNode.children;
    if (!children) return result;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (!child || child.nodeType !== 1 || isInternalEl(child)) continue;
      var veId = child.getAttribute('data-ve-id') || null;
      var rtId = veId ? null : getRuntimeId(child);
      var clsRaw = typeof child.className === 'string' ? child.className.trim() : '';
      var clsPreview = clsRaw ? clsRaw.split(/\\s+/).filter(Boolean).slice(0, 2).join('.') : '';
      var directText = '';
      if (child.children.length === 0) {
        directText = (child.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 34);
      }
      result.push({
        nodeKey: veId || rtId || ('node-' + depth + '-' + i),
        veId: veId,
        rtId: rtId,
        tagName: child.tagName.toLowerCase(),
        idAttr: child.id || '',
        classPreview: clsPreview,
        textPreview: directText,
        children: buildDomTree(child, depth + 1)
      });
    }
    return result;
  }

  function emitDomTree() {
    if (!document.body) return;
    tagMountedElements(document.body);
    postToParent('DOM_TREE_UPDATE', { nodes: buildDomTree(document.body, 0) });
  }

  function scheduleDomTreeEmit() {
    if (domTreeTimer) window.clearTimeout(domTreeTimer);
    domTreeTimer = window.setTimeout(function() {
      domTreeTimer = null;
      emitDomTree();
    }, 80);
  }

  function buildSelectorPath(el) {
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && cur.nodeType === 1 && cur.tagName.toLowerCase() !== 'html' && depth < 4) {
      var tag = cur.tagName.toLowerCase();
      var part = tag;
      if (cur.id) {
        part += '#' + cur.id;
      } else if (cur.className && typeof cur.className === 'string') {
        var cls = cur.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) part += '.' + cls.join('.');
      }
      parts.unshift(part);
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function buildUniqueCssSelector(el) {
    var parts = [];
    var cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && cur !== document.documentElement) {
      var tag = cur.tagName.toLowerCase();
      if (cur.id && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(cur.id)) {
        parts.unshift('#' + cur.id);
        break;
      }
      var parent = cur.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      var index = 1;
      var sib = cur.previousElementSibling;
      while (sib) {
        if (!isInternalEl(sib) && sib.tagName === cur.tagName) index++;
        sib = sib.previousElementSibling;
      }
      parts.unshift(tag + ':nth-of-type(' + index + ')');
      cur = parent;
    }
    if (parts.length && !parts[0].startsWith('#')) {
      parts.unshift('body');
    }
    return parts.join(' > ');
  }

  function buildElementLabel(el) {
    var tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      var cls = el.className.trim().split(/\\s+/).filter(Boolean)[0];
      if (cls) return tag + '.' + cls;
    }
    return tag;
  }

  function parseInlineStyle(el) {
    var result = {};
    var style = el.style;
    for (var i = 0; i < style.length; i++) {
      var prop = style[i];
      result[prop] = style.getPropertyValue(prop);
    }
    return result;
  }

  function isTextEditableElement(el) {
    if (!el) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === 'img' || tag === 'input' || tag === 'select' || tag === 'svg' || tag === 'path' || tag === 'hr' || tag === 'br') {
      return false;
    }
    return el.children.length === 0;
  }

  function extractSvgShapePayload(el, computed) {
    if (!el || el.tagName.toLowerCase() !== 'svg') return null;
    var child = el.querySelector('path, polygon, polyline, circle, ellipse, rect');
    if (!child) return null;
    var childTag = child.tagName.toLowerCase();
    var rawFill = child.getAttribute('fill') || '';
    var fill = rawFill === 'currentColor' || !rawFill ? computed.color : rawFill;
    var stroke = child.getAttribute('stroke') || 'none';
    var strokeWidth = child.getAttribute('stroke-width') || '0';
    var dataMode = 'd';
    var pathData = '';
    if (childTag === 'path') {
      dataMode = 'd';
      pathData = child.getAttribute('d') || '';
    } else if (childTag === 'polygon' || childTag === 'polyline') {
      dataMode = 'points';
      pathData = child.getAttribute('points') || '';
    } else if (childTag === 'circle') {
      dataMode = 'circle';
      pathData = (child.getAttribute('cx') || '50') + ', ' + (child.getAttribute('cy') || '50') + ', ' + (child.getAttribute('r') || '45');
    } else if (childTag === 'rect') {
      dataMode = 'rect';
      pathData = (child.getAttribute('x') || '0') + ', ' + (child.getAttribute('y') || '0') + ', ' + (child.getAttribute('width') || '100') + ', ' + (child.getAttribute('height') || '100');
    }
    return {
      childTag: childTag,
      fill: fill,
      stroke: stroke,
      strokeWidth: strokeWidth,
      pathData: pathData,
      dataMode: dataMode,
      viewBox: el.getAttribute('viewBox') || '0 0 100 100'
    };
  }

  function parsePxFloat(v) {
    var n = parseFloat(v);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }

  function resolveOffsetCoord(el, axis, computed) {
    var inlineVal = el.style[axis];
    if (inlineVal && inlineVal !== 'auto') {
      var parsedInline = parseFloat(inlineVal);
      if (Number.isFinite(parsedInline)) return Math.round(parsedInline);
    }
    var computedVal = computed[axis];
    if (computedVal && computedVal !== 'auto') {
      var parsedComp = parseFloat(computedVal);
      if (Number.isFinite(parsedComp)) return Math.round(parsedComp);
    }
    if (computed.position === 'absolute' || computed.position === 'fixed') {
      return Math.round(axis === 'left' ? el.offsetLeft : el.offsetTop);
    }
    return 0;
  }

  function getElementPayload(el) {
    var rect = el.getBoundingClientRect();
    var computed = window.getComputedStyle(el);
    return {
      veId: el.getAttribute('data-ve-id') || null,
      veNode: el.getAttribute('data-ve-node') || null,
      veShape: el.getAttribute('data-ve-shape') || null,
      aspectLockedAttr: el.getAttribute('data-ve-aspect-lock') || null,
      svgShape: extractSvgShapePayload(el, computed),
      runtimeId: getRuntimeId(el),
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      className: typeof el.className === 'string' ? el.className : '',
      href: el.getAttribute('href') || '',
      target: el.getAttribute('target') || '',
      imgSrc: el.getAttribute('data-ve-raw-src') || el.getAttribute('src') || '',
      imgAlt: el.getAttribute('alt') || '',
      onclickAttr: el.getAttribute('onclick') || '',
      actionType: el.getAttribute('data-ve-action') || '',
      actionValue: el.getAttribute('data-ve-value') || '',
      selectorPath: buildSelectorPath(el),
      uniqueSelector: buildUniqueCssSelector(el),
      textContent: el.textContent || '',
      hasElementChildren: el.children.length > 0,
      isTextEditable: isTextEditableElement(el),
      isHidden: computed.display === 'none' || el.style.display === 'none',
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      },
      offsetLeft: resolveOffsetCoord(el, 'left', computed),
      offsetTop: resolveOffsetCoord(el, 'top', computed),
      boxModel: {
        margin: {
          top: parsePxFloat(computed.marginTop),
          right: parsePxFloat(computed.marginRight),
          bottom: parsePxFloat(computed.marginBottom),
          left: parsePxFloat(computed.marginLeft)
        },
        padding: {
          top: parsePxFloat(computed.paddingTop),
          right: parsePxFloat(computed.paddingRight),
          bottom: parsePxFloat(computed.paddingBottom),
          left: parsePxFloat(computed.paddingLeft)
        }
      },
      styles: {
        fontFamily: el.style.fontFamily || computed.fontFamily,
        fontSize: el.style.fontSize || computed.fontSize,
        fontWeight: el.style.fontWeight || computed.fontWeight,
        fontStyle: el.style.fontStyle || computed.fontStyle,
        textDecoration: el.style.textDecoration || computed.textDecorationLine || computed.textDecoration,
        textTransform: el.style.textTransform || computed.textTransform || 'none',
        verticalAlign: el.style.verticalAlign || computed.verticalAlign || 'baseline',
        textAlign: el.style.textAlign || computed.textAlign,
        lineHeight: el.style.lineHeight || computed.lineHeight,
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        opacity: el.style.opacity || computed.opacity || '1',
        boxShadow: el.style.boxShadow || computed.boxShadow || 'none',
        transform: el.style.transform || 'none',
        borderWidth: computed.borderTopWidth,
        borderStyle: computed.borderTopStyle,
        borderColor: computed.borderTopColor,
        borderRadius: computed.borderTopLeftRadius,
        padding: computed.padding,
        margin: computed.margin,
        width: el.style.width || Math.round(rect.width) + 'px',
        height: el.style.height || Math.round(rect.height) + 'px',
        position: computed.position,
        top: el.style.top || 'auto',
        left: el.style.left || 'auto',
        right: el.style.right || computed.right,
        bottom: el.style.bottom || computed.bottom,
        zIndex: el.style.zIndex || (computed.zIndex === 'auto' ? '0' : computed.zIndex),
        display: computed.display,
        flexDirection: computed.flexDirection,
        justifyContent: el.style.justifyContent || computed.justifyContent || 'normal',
        alignItems: el.style.alignItems || computed.alignItems || 'normal',
        flexWrap: el.style.flexWrap || computed.flexWrap || 'nowrap',
        gridTemplateColumns: el.style.gridTemplateColumns || (computed.gridTemplateColumns === 'none' ? '' : computed.gridTemplateColumns),
        gap: computed.gap,
        maxWidth: el.style.maxWidth || (computed.maxWidth === 'none' ? 'none' : computed.maxWidth),
        overflow: el.style.overflow || computed.overflow || 'visible',
        objectFit: el.style.objectFit || computed.objectFit || 'fill'
      },
      inlineStyles: parseInlineStyle(el)
    };
  }

  function postToParent(type, data) {
    window.parent.postMessage(
      Object.assign({ source: 've-iframe', artboardId: artboardId, type: type }, data || {}),
      '*'
    );
  }

  function clearHover(notifyParent) {
    var hadHovered = Boolean(hoveredEl);
    if (hoveredEl) {
      hoveredEl.removeAttribute('data-ve-hovered');
      hoveredEl = null;
    }
    if (badge) badge.style.display = 'none';
    if (notifyParent && hadHovered) {
      postToParent('ELEMENT_HOVERED', {
        nodeKey: null,
        veId: null,
        rtId: null,
        uniqueSelector: null
      });
    }
  }

  function clearDropTarget() {
    if (dropTargetEl) {
      dropTargetEl.removeAttribute('data-ve-drop-target');
      dropTargetEl = null;
    }
    if (badge) {
      badge.style.borderColor = '#38bdf8';
      badge.style.display = 'none';
    }
  }

  function positionBadge(el, customText, borderColor) {
    if (!badge || !el) return;
    var rect = el.getBoundingClientRect();
    badge.textContent = customText || (buildElementLabel(el) + ' · ' + Math.round(rect.width) + '×' + Math.round(rect.height));
    badge.style.borderColor = borderColor || '#38bdf8';
    badge.style.display = 'block';
    var top = rect.top - 24;
    if (top < 4) top = rect.bottom + 4;
    var left = Math.max(4, Math.min(rect.left, window.innerWidth - 220));
    badge.style.top = top + 'px';
    badge.style.left = left + 'px';
  }

  function toKebabProp(prop) {
    return String(prop || '').replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  // Live @media preview: applies the in-progress override as a real media rule in
  // every artboard, so each frame evaluates it against its own viewport width.
  function applyResponsivePreviewCss(selector, scope, styles, breakpoint) {
    if (!previewResponsiveStyleEl) return;
    if (!selector) {
      previewResponsiveStyleEl.textContent = '';
      return;
    }
    var decls = [];
    Object.keys(styles || {}).forEach(function(prop) {
      var val = styles[prop];
      if (val === null || val === undefined || val === '') return;
      decls.push('  ' + toKebabProp(prop) + ': ' + val + ' !important;');
    });
    if (!decls.length) {
      previewResponsiveStyleEl.textContent = '';
      return;
    }
    var rule = selector + ' {\\n' + decls.join('\\n') + '\\n}';
    var condition = '';
    if (
      breakpoint &&
      (typeof breakpoint.minWidth === 'number' || typeof breakpoint.maxWidth === 'number')
    ) {
      var conditions = [];
      if (typeof breakpoint.minWidth === 'number') {
        conditions.push('(min-width: ' + breakpoint.minWidth + 'px)');
      }
      if (typeof breakpoint.maxWidth === 'number') {
        conditions.push('(max-width: ' + breakpoint.maxWidth + 'px)');
      }
      condition = conditions.join(' and ');
    } else if (scope === 'desktop') {
      condition = '(min-width: 769px)';
    } else if (scope === 'tablet') {
      condition = '(max-width: 768px) and (min-width: 481px)';
    } else if (scope === 'mobile') {
      condition = '(max-width: 480px)';
    }
    if (condition) {
      rule = '@media ' + condition + ' {\\n' + rule + '\\n}';
    }
    previewResponsiveStyleEl.textContent = rule;
  }

  function clearResponsivePreview() {
    if (previewResponsiveStyleEl) previewResponsiveStyleEl.textContent = '';
  }

  // Streams the in-flight drag position to the sibling artboards on the next frame.
  function broadcastLivePosition() {
    if (livePositionFrame) return;
    livePositionFrame = window.requestAnimationFrame(function() {
      livePositionFrame = 0;
      if (!moveDrag || !moveDrag.dragging || !moveDrag.el) return;
      var el = moveDrag.el;
      postToParent('POSITION_PREVIEW', {
        veId: el.getAttribute('data-ve-id') || null,
        runtimeId: getRuntimeId(el),
        uniqueSelector: buildUniqueCssSelector(el),
        styles: {
          position: el.style.position,
          left: el.style.left,
          top: el.style.top,
          right: el.style.right,
          bottom: el.style.bottom
        }
      });
    });
  }

  function selectElement(el, notifyParent) {
    if (selectedEl && selectedEl !== el) {
      selectedEl.removeAttribute('data-ve-selected');
    }
    selectedEl = el || null;
    if (selectedEl) {
      selectedEl.setAttribute('data-ve-selected', 'true');
      if (notifyParent) {
        postToParent('ELEMENT_SELECTED', { element: getElementPayload(selectedEl) });
      }
    } else if (notifyParent) {
      postToParent('ELEMENT_CLEARED', {});
    }
  }

  function findNodeById(nodeId) {
    if (!nodeId) return null;
    return (
      document.querySelector('[data-ve-id="' + nodeId + '"]') ||
      document.querySelector('[data-ve-rt="' + nodeId + '"]')
    );
  }

  function findNodeBySyncPayload(msg) {
    if (!msg) return null;
    if (msg.veId) {
      var byVe = document.querySelector('[data-ve-id="' + msg.veId + '"]');
      if (byVe) return byVe;
    }
    var targetId = msg.nodeId || msg.rtId || null;
    if (targetId) {
      var byId = findNodeById(targetId);
      if (byId) return byId;
    }
    if (msg.uniqueSelector && typeof msg.uniqueSelector === 'string') {
      try {
        var bySel = document.querySelector(msg.uniqueSelector);
        if (bySel && !isInternalEl(bySel)) return bySel;
      } catch (err) {}
    }
    return null;
  }

  function commitInlineEdit() {
    if (!editingEl) return;
    var target = editingEl;
    editingEl = null;
    target.removeAttribute('contenteditable');
    target.removeAttribute('data-ve-editing');
    var nextText = target.textContent || '';
    if (nextText !== originalEditText) {
      postToParent('TEXT_COMMITTED', {
        veId: target.getAttribute('data-ve-id') || null,
        runtimeId: getRuntimeId(target),
        previousText: originalEditText,
        textContent: nextText,
        element: getElementPayload(target)
      });
      scheduleDomTreeEmit();
    } else {
      postToParent('RECT_UPDATE', { element: getElementPayload(target) });
    }
  }

  function cancelInlineEdit() {
    if (!editingEl) return;
    var target = editingEl;
    editingEl = null;
    target.textContent = originalEditText;
    target.removeAttribute('contenteditable');
    target.removeAttribute('data-ve-editing');
    postToParent('RECT_UPDATE', { element: getElementPayload(target) });
  }

  document.addEventListener('mouseover', function(e) {
    if (mode !== 'edit' || editingEl || (moveDrag && moveDrag.dragging)) return;
    var target = resolveEditableTarget(e.target);
    if (!target || isInternalEl(target) || target === document.body) {
      clearHover(true);
      return;
    }
    var changed = hoveredEl !== target;
    if (hoveredEl && hoveredEl !== target) {
      hoveredEl.removeAttribute('data-ve-hovered');
    }
    hoveredEl = target;
    if (hoveredEl !== selectedEl) {
      hoveredEl.setAttribute('data-ve-hovered', 'true');
    }
    positionBadge(hoveredEl);
    if (changed) {
      var hovVeId = hoveredEl.getAttribute('data-ve-id') || null;
      var hovRtId = hovVeId ? null : getRuntimeId(hoveredEl);
      postToParent('ELEMENT_HOVERED', {
        nodeKey: hovVeId || hovRtId,
        veId: hovVeId,
        rtId: hovRtId,
        uniqueSelector: buildUniqueCssSelector(hoveredEl)
      });
    }
  }, true);

  document.addEventListener('mouseleave', function() {
    clearHover(true);
  }, true);

  document.addEventListener('mousedown', function(e) {
    if (mode !== 'edit' || e.button !== 0 || editingEl) return;
    var target = resolveEditableTarget(e.target);
    if (!target || isInternalEl(target) || target === document.body) return;
    var computed = window.getComputedStyle(target);
    var startLeft = resolveOffsetCoord(target, 'left', computed);
    var startTop = resolveOffsetCoord(target, 'top', computed);
    var isOutOfFlow = computed.position === 'absolute' || computed.position === 'fixed';
    moveDrag = {
      el: target,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: startLeft,
      startTop: startTop,
      clearRight: isOutOfFlow && (target.style.right && target.style.right !== 'auto' || computed.right !== 'auto'),
      clearBottom: isOutOfFlow && (target.style.bottom && target.style.bottom !== 'auto' || computed.bottom !== 'auto'),
      targetPosition: computed.position === 'static' ? 'relative' : computed.position,
      dragging: false
    };
  }, true);

  window.addEventListener('mousemove', function(e) {
    if (!moveDrag) return;
    var dx = e.clientX - moveDrag.startX;
    var dy = e.clientY - moveDrag.startY;
    if (!moveDrag.dragging) {
      if (Math.hypot(dx, dy) < 5) return;
      moveDrag.dragging = true;
      clearHover();
      selectElement(moveDrag.el, true);
      moveDrag.el.setAttribute('data-ve-dragging', 'true');
      if (window.getComputedStyle(moveDrag.el).position === 'static') {
        moveDrag.el.style.position = moveDrag.targetPosition;
      }
      if (moveDrag.clearRight) moveDrag.el.style.right = 'auto';
      if (moveDrag.clearBottom) moveDrag.el.style.bottom = 'auto';
    }
    var nextLeft = Math.round(moveDrag.startLeft + dx);
    var nextTop = Math.round(moveDrag.startTop + dy);
    moveDrag.el.style.left = nextLeft + 'px';
    moveDrag.el.style.top = nextTop + 'px';
    updateSnapGuides(moveDrag.el);
    positionBadge(moveDrag.el, 'Move · x: ' + nextLeft + 'px, y: ' + nextTop + 'px', '#3b82f6');
    notifyRectChange();
    broadcastLivePosition();
  }, true);

  window.addEventListener('mouseup', function() {
    if (!moveDrag) return;
    var drag = moveDrag;
    moveDrag = null;
    clearSnapGuides();
    if (drag.dragging) {
      drag.el.removeAttribute('data-ve-dragging');
      if (badge) badge.style.display = 'none';
      suppressNextClick = true;
      window.setTimeout(function() { suppressNextClick = false; }, 80);
      var committedStyles = {
        position: drag.el.style.position || drag.targetPosition,
        left: drag.el.style.left,
        top: drag.el.style.top
      };
      if (drag.clearRight) committedStyles.right = 'auto';
      if (drag.clearBottom) committedStyles.bottom = 'auto';
      postToParent('POSITION_COMMITTED', {
        veId: drag.el.getAttribute('data-ve-id') || null,
        runtimeId: getRuntimeId(drag.el),
        styles: committedStyles,
        element: getElementPayload(drag.el)
      });
    }
  }, true);

  document.addEventListener('click', function(e) {
    if (suppressNextClick) {
      suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (mode === 'interact') {
      var actionEl = e.target && e.target.closest ? e.target.closest('[data-ve-action], a[href]') : null;
      if (!actionEl) return;
      var actType = actionEl.getAttribute('data-ve-action') || '';
      var actVal = actionEl.getAttribute('data-ve-value') || '';
      var href = actionEl.getAttribute('href') || '';

      if (!actType && href) {
        if (href.startsWith('#') && href.length > 1) {
          actType = 'scroll';
          actVal = href;
        } else if (/\\.html?($|[?#])/i.test(href) && !/^https?:\\/\\//i.test(href)) {
          actType = 'page';
          actVal = href;
        }
      }

      if (actType === 'page' && actVal) {
        e.preventDefault();
        e.stopPropagation();
        var cleanPage = actVal.split('#')[0].split('?')[0].replace(/^\\.\\//, '').replace(/^\\/+/, '');
        postToParent('NAVIGATE_PAGE', { page: cleanPage });
        return;
      }

      if (actType === 'scroll' && actVal) {
        var targetId = actVal.replace(/^#/, '');
        var dest = targetId ? document.getElementById(targetId) : null;
        if (dest) {
          e.preventDefault();
          dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      if (actType === 'toggle' && actVal) {
        e.preventDefault();
        var togId = actVal.replace(/^#/, '');
        var togEl = togId ? document.getElementById(togId) : null;
        if (togEl) {
          var isHiddenNow = window.getComputedStyle(togEl).display === 'none';
          togEl.style.display = isHiddenNow ? '' : 'none';
        }
        return;
      }

      if (actType === 'alert') {
        e.preventDefault();
        showActionToast(actVal || 'Button action triggered');
        return;
      }

      if (actType === 'url' && actVal && actionEl.tagName.toLowerCase() !== 'a') {
        e.preventDefault();
        var targetWin = actionEl.getAttribute('target') || '_blank';
        window.open(actVal, targetWin, 'noopener,noreferrer');
      }
      return;
    }

    if (mode !== 'edit') return;
    if (editingEl && (e.target === editingEl || editingEl.contains(e.target))) {
      return;
    }
    if (editingEl) {
      commitInlineEdit();
    }
    var target = resolveEditableTarget(e.target);
    if (!target || isInternalEl(target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (target === document.body) {
      selectElement(null, true);
      return;
    }
    clearHover();
    selectElement(target, true);
  }, true);

  document.addEventListener('dblclick', function(e) {
    if (mode !== 'edit') return;
    var target = resolveEditableTarget(e.target);
    if (!target || isInternalEl(target) || target === document.body) return;
    if (!isTextEditableElement(target)) return;
    e.preventDefault();
    e.stopPropagation();
    clearHover();
    selectElement(target, true);
    editingEl = target;
    originalEditText = target.textContent || '';
    target.setAttribute('data-ve-editing', 'true');
    target.setAttribute('contenteditable', 'true');
    target.focus();
  }, true);

  document.addEventListener('keydown', function(e) {
    if (editingEl) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelInlineEdit();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        var tag = editingEl.tagName.toLowerCase();
        if (tag !== 'p' && tag !== 'div') {
          e.preventDefault();
          commitInlineEdit();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        postToParent('IFRAME_KEYDOWN', {
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey
        });
      }
      return;
    }

    var active = document.activeElement;
    var activeTag = active && active.tagName ? active.tagName.toUpperCase() : '';
    var isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' || (active && active.isContentEditable);
    if (isInput && e.key !== 'Escape' && !((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
      return;
    }

    var hasMod = e.ctrlKey || e.metaKey;
    var lower = e.key.toLowerCase();
    var hasTextSel = Boolean(window.getSelection && window.getSelection().toString().length > 0);
    var isArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    var isZoomKey = hasMod && (lower === '=' || lower === '+' || lower === '-' || lower === '0' || e.code === 'Equal' || e.code === 'Minus' || e.code === 'Digit0');
    var isModEditKey = hasMod && (
      ['z', 'y', 's', 'e', 'b', 'i', 'd', 'k', 'x', 'v', 'u', 'l', 'r', 'h', '\\\\', ']', '['].indexOf(lower) !== -1 ||
      (lower === 'c' && (!hasTextSel || e.shiftKey || e.altKey)) ||
      e.code === 'Backslash' ||
      e.code === 'BracketLeft' ||
      e.code === 'BracketRight'
    );
    var isShortcut =
      e.key === 'Escape' ||
      e.key === '?' ||
      (e.shiftKey && (e.code === 'Digit1' || e.key === '!')) ||
      (mode === 'edit' && (
        e.key === 'Delete' ||
        e.key === 'Backspace' ||
        e.key === 'Enter' ||
        e.key === '\\\\' ||
        isArrow
      )) ||
      (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) ||
      (!hasMod && !e.altKey && !e.shiftKey && ['1', '2', '3', 'v', 'g'].indexOf(lower) !== -1) ||
      isZoomKey ||
      isModEditKey;

    if (isShortcut) {
      e.preventDefault();
      postToParent('IFRAME_KEYDOWN', {
        key: e.key,
        code: e.code || '',
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      });
    }
  }, true);

  document.addEventListener('focusout', function(e) {
    if (editingEl && e.target === editingEl) {
      commitInlineEdit();
    }
  }, true);

  function notifyRectChange() {
    if (mode !== 'edit' || !selectedEl || !document.body.contains(selectedEl)) return;
    postToParent('RECT_UPDATE', { element: getElementPayload(selectedEl) });
  }

  window.addEventListener('scroll', notifyRectChange, true);
  window.addEventListener('resize', notifyRectChange, true);
  window.addEventListener('resize', scheduleXrayScan, true);

  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || msg.target !== 've-iframe') return;

    if (msg.type === 'SET_ARTBOARD_ID' && (msg.artboardId === 'desktop' || msg.artboardId === 'tablet' || msg.artboardId === 'mobile')) {
      artboardId = msg.artboardId;
      return;
    }

    if (msg.type === 'SET_MODE') {
      mode = msg.mode;
      if (mode !== 'edit') {
        clearHover(false);
        clearDropTarget();
        if (editingEl) commitInlineEdit();
        if (selectedEl) {
          selectedEl.removeAttribute('data-ve-selected');
        }
      } else {
        tagMountedElements(document.body);
        if (selectedEl && document.body.contains(selectedEl)) {
          selectedEl.setAttribute('data-ve-selected', 'true');
          notifyRectChange();
        }
      }
      applyOutlinesCss();
      scheduleXrayScan();
      return;
    }

    if (msg.type === 'SET_OUTLINES') {
      outlinesEnabled = Boolean(msg.enabled);
      applyOutlinesCss();
      return;
    }

    if (msg.type === 'SET_OVERLAP_XRAY') {
      xrayEnabled = Boolean(msg.enabled);
      if (!xrayEnabled) clearXrayMarks();
      emitLayoutIssues();
      return;
    }

    if (msg.type === 'RUN_OVERLAP_SCAN') {
      emitLayoutIssues();
      return;
    }

    if (msg.type === 'SELECT_VE_ID' || msg.type === 'SELECT_NODE_ID') {
      var found = findNodeBySyncPayload(msg);
      if (found && msg.scrollIntoView !== false && found.scrollIntoView) {
        found.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      var notifySelection = msg.notifyParent !== false && msg.silent !== true;
      selectElement(found, notifySelection);
      if (notifySelection) {
        window.requestAnimationFrame(notifyRectChange);
      }
      return;
    }

    if (msg.type === 'HOVER_NODE_ID') {
      clearHover(false);
      if (mode === 'edit' && (msg.nodeId || msg.veId || msg.rtId || msg.uniqueSelector)) {
        var hov = findNodeBySyncPayload(msg);
        if (hov && !isInternalEl(hov) && hov !== document.body) {
          hoveredEl = hov;
          if (hoveredEl !== selectedEl) {
            hoveredEl.setAttribute('data-ve-hovered', 'true');
          }
          if (msg.silentBadge === true) {
            if (badge) badge.style.display = 'none';
          } else {
            positionBadge(hoveredEl);
          }
        }
      }
      return;
    }

    if (msg.type === 'SYNC_NODE_TEXT') {
      var textTarget = findNodeBySyncPayload(msg) || selectedEl;
      if (textTarget && typeof msg.textContent === 'string') {
        textTarget.textContent = msg.textContent;
      }
      return;
    }

    if (msg.type === 'SYNC_NODE_STYLE') {
      var styleTarget = findNodeBySyncPayload(msg) || selectedEl;
      if (styleTarget && msg.styles) {
        Object.keys(msg.styles).forEach(function(prop) {
          var val = msg.styles[prop];
          if (val === null || val === '') {
            styleTarget.style.removeProperty(prop);
          } else {
            styleTarget.style.setProperty(prop, val);
          }
        });
      }
      return;
    }

    if (msg.type === 'SELECT_PARENT') {
      if (!selectedEl) return;
      var parentEl = selectedEl.parentElement;
      if (parentEl && !isInternalEl(parentEl) && parentEl !== document.body && parentEl !== document.documentElement) {
        if (parentEl.scrollIntoView) {
          parentEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        selectElement(parentEl, true);
        window.requestAnimationFrame(notifyRectChange);
      }
      return;
    }

    if (msg.type === 'MOVE_SIBLING' && selectedEl && selectedEl.parentElement) {
      var dir = msg.direction === 'up' ? 'up' : 'down';
      var parent = selectedEl.parentElement;
      if (dir === 'up') {
        var prev = selectedEl.previousElementSibling;
        while (prev && isInternalEl(prev)) prev = prev.previousElementSibling;
        if (prev) {
          parent.insertBefore(selectedEl, prev);
        }
      } else {
        var next = selectedEl.nextElementSibling;
        while (next && isInternalEl(next)) next = next.nextElementSibling;
        if (next) {
          parent.insertBefore(next, selectedEl);
        }
      }
      if (selectedEl.scrollIntoView) {
        selectedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      notifyRectChange();
      emitDomTree();
      return;
    }

    if (msg.type === 'REQUEST_DOM_TREE') {
      emitDomTree();
      return;
    }

    if (msg.type === 'ASSIGN_VE_NODE' && selectedEl && msg.nodeId) {
      selectedEl.setAttribute('data-ve-node', msg.nodeId);
      notifyRectChange();
      return;
    }

    if (msg.type === 'LIVE_CSS_OVERRIDE' && liveResponsiveStyleEl) {
      liveResponsiveStyleEl.textContent = msg.cssText || '';
      window.requestAnimationFrame(notifyRectChange);
      return;
    }

    if (msg.type === 'PREVIEW_RESPONSIVE_STYLE') {
      applyResponsivePreviewCss(msg.selector, msg.scope, msg.styles || {}, msg.breakpoint || null);
      window.requestAnimationFrame(notifyRectChange);
      return;
    }

    if (msg.type === 'CLEAR_RESPONSIVE_PREVIEW') {
      clearResponsivePreview();
      window.requestAnimationFrame(notifyRectChange);
      return;
    }

    if (msg.type === 'UPDATE_ROOT_VAR' && msg.name) {
      if (msg.value === null || msg.value === '') {
        document.documentElement.style.removeProperty(msg.name);
      } else {
        document.documentElement.style.setProperty(msg.name, msg.value);
      }
      window.requestAnimationFrame(notifyRectChange);
      return;
    }

    if (msg.type === 'REGISTER_PROJECT_ASSET' && Array.isArray(msg.keys) && msg.url) {
      if (!window.__PROJECT_ASSETS__) window.__PROJECT_ASSETS__ = {};
      msg.keys.forEach(function(k) {
        if (k) {
          window.__PROJECT_ASSETS__[k] = msg.url;
          window.__PROJECT_ASSETS__[String(k).toLowerCase()] = msg.url;
        }
      });
      return;
    }

    if (msg.type === 'UPDATE_ATTRS' && selectedEl && msg.attributes) {
      Object.keys(msg.attributes).forEach(function(attr) {
        var val = msg.attributes[attr];
        if (val === null || val === '') {
          selectedEl.removeAttribute(attr);
          if (attr === 'src') {
            selectedEl.removeAttribute('data-ve-raw-src');
          }
        } else {
          if (attr === 'src' && typeof window.__resolveProjectAsset__ === 'function') {
            var resolvedAsset = window.__resolveProjectAsset__(val);
            if (resolvedAsset) {
              selectedEl.setAttribute('data-ve-raw-src', val);
              selectedEl.setAttribute('src', resolvedAsset);
              return;
            }
            selectedEl.removeAttribute('data-ve-raw-src');
          }
          selectedEl.setAttribute(attr, val);
        }
      });
      notifyRectChange();
      scheduleDomTreeEmit();
      return;
    }

    if (msg.type === 'PREVIEW_STYLE' && selectedEl) {
      var styles = msg.styles || {};
      var priority = msg.important ? 'important' : '';
      Object.keys(styles).forEach(function(prop) {
        var val = styles[prop];
        if (val === null || val === '') {
          selectedEl.style.removeProperty(prop);
        } else {
          selectedEl.style.setProperty(prop, val, priority);
        }
      });
      notifyRectChange();
      return;
    }

    if (msg.type === 'PREVIEW_SVG_SHAPE' && selectedEl && selectedEl.tagName.toLowerCase() === 'svg' && msg.patch) {
      var patch = msg.patch;
      if (patch.viewBox !== undefined) {
        if (patch.viewBox) selectedEl.setAttribute('viewBox', patch.viewBox);
        else selectedEl.removeAttribute('viewBox');
      }
      var child = selectedEl.querySelector('path, polygon, polyline, circle, ellipse, rect');
      if (child) {
        if (patch.fill !== undefined) child.setAttribute('fill', patch.fill || 'none');
        if (patch.stroke !== undefined) child.setAttribute('stroke', patch.stroke || 'none');
        if (patch.strokeWidth !== undefined) {
          if (patch.strokeWidth === null || patch.strokeWidth === '') child.removeAttribute('stroke-width');
          else child.setAttribute('stroke-width', patch.strokeWidth);
        }
        if (patch.pathData !== undefined && patch.pathData !== null) {
          var trimmedPath = String(patch.pathData).trim();
          var childTag = child.tagName.toLowerCase();
          if (/^[mM]\\s*[-\\d.]/.test(trimmedPath)) {
            if (childTag !== 'path') {
              var newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              newPath.setAttribute('pointer-events', 'none');
              newPath.setAttribute('vector-effect', 'non-scaling-stroke');
              newPath.setAttribute('fill', child.getAttribute('fill') || '#3b82f6');
              newPath.setAttribute('stroke', child.getAttribute('stroke') || 'none');
              if (child.getAttribute('stroke-width')) {
                newPath.setAttribute('stroke-width', child.getAttribute('stroke-width'));
              }
              newPath.setAttribute('d', trimmedPath);
              child.replaceWith(newPath);
            } else {
              child.setAttribute('d', trimmedPath);
            }
          } else if (childTag === 'path') {
            child.setAttribute('d', trimmedPath);
          } else if (childTag === 'polygon' || childTag === 'polyline') {
            child.setAttribute('points', trimmedPath);
          } else if (childTag === 'circle') {
            var cNums = trimmedPath.match(/-?\\d+(?:\\.\\d+)?/g);
            if (cNums && cNums.length >= 3) {
              child.setAttribute('cx', cNums[0]);
              child.setAttribute('cy', cNums[1]);
              child.setAttribute('r', cNums[2]);
            }
          }
        }
      }
      notifyRectChange();
      return;
    }

    if (msg.type === 'PREVIEW_TEXT' && selectedEl) {
      selectedEl.textContent = msg.textContent || '';
      notifyRectChange();
      scheduleDomTreeEmit();
      return;
    }

    if (msg.type === 'REMOVE_SELECTED' && selectedEl) {
      var toRemove = selectedEl;
      selectElement(null, true);
      toRemove.remove();
      scheduleDomTreeEmit();
      return;
    }

    if (msg.type === 'HIGHLIGHT_DROP_TARGET') {
      var hit = document.elementFromPoint(msg.x, msg.y);
      while (hit && isInternalEl(hit) && hit !== document.body) {
        hit = hit.parentElement;
      }
      if (!hit || hit === document.documentElement) hit = document.body;
      var tag = hit.tagName.toLowerCase();
      var placement = CONTAINER_TAGS.has(tag) ? 'inside' : 'after';

      var anchor = hit;
      while (
        anchor &&
        anchor !== document.body &&
        !anchor.getAttribute('data-ve-id') &&
        !anchor.getAttribute('data-ve-rt')
      ) {
        anchor = anchor.parentElement;
        placement = 'inside';
      }
      if (dropTargetEl && dropTargetEl !== anchor) {
        dropTargetEl.removeAttribute('data-ve-drop-target');
      }
      dropTargetEl = anchor;
      if (dropTargetEl && dropTargetEl !== document.body) {
        dropTargetEl.setAttribute('data-ve-drop-target', placement);
        positionBadge(
          dropTargetEl,
          (placement === 'inside' ? 'Drop inside ' : 'Insert after ') + buildElementLabel(dropTargetEl),
          '#10b981'
        );
      } else {
        if (badge) badge.style.display = 'none';
      }
      postToParent('DROP_TARGET_RESOLVED', {
        targetVeId: anchor && anchor !== document.body ? anchor.getAttribute('data-ve-id') : null,
        placement: placement,
        label: anchor ? buildElementLabel(anchor) : 'body'
      });
      return;
    }

    if (msg.type === 'CLEAR_DROP_TARGET') {
      clearDropTarget();
      return;
    }

    if (msg.type === 'START_INLINE_EDIT' && mode === 'edit' && selectedEl) {
      if (isTextEditableElement(selectedEl)) {
        clearHover();
        editingEl = selectedEl;
        originalEditText = selectedEl.textContent || '';
        selectedEl.setAttribute('data-ve-editing', 'true');
        selectedEl.setAttribute('contenteditable', 'true');
        selectedEl.focus();
      }
      return;
    }

    if (msg.type === 'HOT_PATCH_CSS' || msg.type === 'HOT_PATCH_HTML') {
      if (msg.googleFontHref) {
        var fontLink = document.querySelector('link[data-ve-font="auto-fonts"]');
        if (fontLink) {
          if (fontLink.getAttribute('href') !== msg.googleFontHref) {
            fontLink.setAttribute('href', msg.googleFontHref);
          }
        } else if (document.head) {
          var newFontLink = document.createElement('link');
          newFontLink.setAttribute('rel', 'stylesheet');
          newFontLink.setAttribute('href', msg.googleFontHref);
          newFontLink.setAttribute('data-ve-font', 'auto-fonts');
          document.head.appendChild(newFontLink);
        }
      }

      if (msg.cssSources && typeof msg.cssSources === 'object') {
        var sourceStyles = document.querySelectorAll('style[data-ve-source]');
        var existingMap = {};
        for (var si = 0; si < sourceStyles.length; si++) {
          var srcKey = sourceStyles[si].getAttribute('data-ve-source');
          if (srcKey) existingMap[srcKey] = sourceStyles[si];
          if (srcKey && typeof msg.cssSources[srcKey] === 'string') {
            sourceStyles[si].textContent = msg.cssSources[srcKey];
          }
        }
        var incomingCssKeys = Object.keys(msg.cssSources);
        for (var ici = 0; ici < incomingCssKeys.length; ici++) {
          var ck = incomingCssKeys[ici];
          if (!existingMap[ck] && document.head && typeof msg.cssSources[ck] === 'string') {
            var createdStyle = document.createElement('style');
            createdStyle.setAttribute('data-ve-source', ck);
            createdStyle.textContent = msg.cssSources[ck];
            document.head.appendChild(createdStyle);
          }
        }
      }

      if (msg.type === 'HOT_PATCH_HTML' && liveResponsiveStyleEl) {
        liveResponsiveStyleEl.textContent = typeof msg.liveResponsiveCss === 'string' ? msg.liveResponsiveCss : '';
      }

      if (typeof msg.overrideCss === 'string') {
        var overrideEl = document.querySelector('style[data-ve-source="src/framecraft-edits.css"], style[data-ve-source="framecraft-edits.css"]');
        if (!overrideEl && document.head && msg.overrideCss) {
          overrideEl = document.createElement('style');
          overrideEl.setAttribute('data-ve-source', 'src/framecraft-edits.css');
          document.head.appendChild(overrideEl);
        }
        if (overrideEl) {
          overrideEl.textContent = msg.overrideCss;
        }
      }

      if (msg.type === 'HOT_PATCH_HTML' && typeof msg.bodyHtml === 'string' && document.body) {
        var savedX = window.scrollX;
        var savedY = window.scrollY;
        var prevSelectedVeId = msg.selectVeId !== undefined
          ? msg.selectVeId
          : (selectedEl ? selectedEl.getAttribute('data-ve-id') : null);

        if (editingEl) {
          editingEl.removeAttribute('contenteditable');
          editingEl.removeAttribute('data-ve-editing');
          editingEl = null;
        }
        clearHover();
        clearDropTarget();

        // Preserve JS-rendered runtime children (e.g. #task-list) inside empty template containers
        var preservedById = {};
        var runtimeEls = document.querySelectorAll('[data-ve-rt]');
        for (var ri = 0; ri < runtimeEls.length; ri++) {
          var rtParent = runtimeEls[ri].parentElement;
          if (rtParent && rtParent.id && !rtParent.hasAttribute('data-ve-rt')) {
            if (!preservedById[rtParent.id]) preservedById[rtParent.id] = [];
            preservedById[rtParent.id].push(runtimeEls[ri]);
          }
        }

        // Detach internal bridge nodes cleanly before replacing body markup
        var internalNodes = [];
        var bodyChildren = Array.prototype.slice.call(document.body.children);
        for (var bi = 0; bi < bodyChildren.length; bi++) {
          if (isInternalEl(bodyChildren[bi])) {
            internalNodes.push(bodyChildren[bi]);
          }
        }

        var tmp = document.createElement('div');
        tmp.innerHTML = msg.bodyHtml;
        var incomingNodes = Array.prototype.slice.call(tmp.childNodes);

        // Remove all non-internal nodes in body
        var curChild = document.body.firstChild;
        while (curChild) {
          var nextSibling = curChild.nextSibling;
          if (curChild.nodeType !== 1 || !isInternalEl(curChild)) {
            document.body.removeChild(curChild);
          }
          curChild = nextSibling;
        }

        var firstInternal = internalNodes[0] || null;
        for (var ii = 0; ii < incomingNodes.length; ii++) {
          var node = incomingNodes[ii];
          if (node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === 'script') {
            continue;
          }
          if (firstInternal && firstInternal.parentNode === document.body) {
            document.body.insertBefore(node, firstInternal);
          } else {
            document.body.appendChild(node);
          }
        }

        // Re-insert captured runtime nodes if the matching container is empty in the HTML source
        var preservedIds = Object.keys(preservedById);
        for (var pi = 0; pi < preservedIds.length; pi++) {
          var pid = preservedIds[pi];
          var host = document.getElementById(pid);
          if (host && host.children.length === 0) {
            var list = preservedById[pid];
            for (var li = 0; li < list.length; li++) {
              host.appendChild(list[li]);
            }
          }
        }

        tagMountedElements(document.body);
        applyOutlinesCss();

        selectedEl = null;
        var shouldNotifyRestore = !msg.primaryArtboardId || msg.primaryArtboardId === artboardId;
        if (mode === 'edit' && prevSelectedVeId) {
          var restored = findNodeById(prevSelectedVeId);
          if (restored) {
            selectElement(restored, shouldNotifyRestore);
          } else if (shouldNotifyRestore) {
            postToParent('ELEMENT_CLEARED', {});
          }
        } else if (prevSelectedVeId === null && shouldNotifyRestore) {
          postToParent('ELEMENT_CLEARED', {});
        }

        window.scrollTo(savedX, savedY);
        emitDomTree();
      }

      window.requestAnimationFrame(notifyRectChange);
      return;
    }

    if (msg.type === 'REQUEST_RECT') {
      notifyRectChange();
      return;
    }

    if (msg.type === 'REQUEST_SNAPSHOT_HTML' && document.body) {
      var snapStyles = [];
      var styleNodes = document.querySelectorAll('style');
      for (var si = 0; si < styleNodes.length; si++) {
        var st = styleNodes[si];
        if (!isInternalEl(st) && st.textContent) {
          snapStyles.push(st.textContent);
        }
      }
      var bodyClone = document.body.cloneNode(true);
      var internalInClone = bodyClone.querySelectorAll('[data-ve-internal], script, iframe');
      for (var ci = 0; ci < internalInClone.length; ci++) {
        var rm = internalInClone[ci];
        if (rm && rm.parentNode) rm.parentNode.removeChild(rm);
      }
      bodyClone.removeAttribute('data-ve-outlines');
      var compBody = window.getComputedStyle(document.body);
      var docEl = document.documentElement;
      var snapW = Math.max(window.innerWidth || 0, docEl ? docEl.scrollWidth : 0, 1024);
      var snapH = Math.max(window.innerHeight || 0, docEl ? docEl.scrollHeight : 0, 680);
      postToParent('SNAPSHOT_HTML_RESPONSE', {
        requestId: msg.requestId || '',
        cssText: snapStyles.join('\\n'),
        bodyHtml: bodyClone.innerHTML,
        width: snapW,
        height: snapH,
        bodyBg: compBody && compBody.backgroundColor ? compBody.backgroundColor : '#ffffff'
      });
    }
  });

  // Tag rendered DOM elements inside #root / #app / body after React mounts asynchronously
  var initialSelected = ${serializedSelected};
  var restoredInitial = false;
  var didNotifyMount = false;

  function tryRestoreInitialSelection() {
    if (restoredInitial || !initialSelected || mode !== 'edit') return;
    var restoreEl = findNodeById(initialSelected);
    if (restoreEl) {
      restoredInitial = true;
      if (restoreEl.scrollIntoView) {
        restoreEl.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
      selectElement(restoreEl, true);
      window.requestAnimationFrame(notifyRectChange);
    }
  }

  function syncMountedDom() {
    var appRoot = document.getElementById('root') || document.getElementById('app') || document.body;
    tagMountedElements(document.body);
    tryRestoreInitialSelection();
    emitDomTree();
    if (!didNotifyMount && appRoot && appRoot.children && appRoot.children.length > 0) {
      didNotifyMount = true;
      postToParent('DOM_MOUNTED', {
        taggedCount: document.querySelectorAll('[data-ve-rt], [data-ve-id]').length
      });
    }
  }

  syncMountedDom();

  var domObserver = null;
  if (typeof MutationObserver !== 'undefined' && document.body) {
    domObserver = new MutationObserver(function(mutations) {
      var needsTag = false;
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        var removed = mutations[i].removedNodes;
        if (removed && removed.length > 0) {
          needsTag = true;
        }
        if (added && added.length > 0) {
          for (var j = 0; j < added.length; j++) {
            if (added[j].nodeType === 1 && !isInternalEl(added[j])) {
              tagMountedElements(added[j]);
              needsTag = true;
            }
          }
        }
      }
      if (needsTag) {
        tryRestoreInitialSelection();
        scheduleDomTreeEmit();
        scheduleXrayScan();
        if (!didNotifyMount) {
          syncMountedDom();
        }
      }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Disconnect observers and clear timers when the iframe document is torn down,
  // so a reused iframe (navigation without reload) does not accumulate stale listeners.
  window.addEventListener('beforeunload', function() {
    if (domObserver) domObserver.disconnect();
    if (actionToastTimer) window.clearTimeout(actionToastTimer);
    if (domTreeTimer) window.clearTimeout(domTreeTimer);
    if (xrayTimer) window.clearTimeout(xrayTimer);
  }, { once: true });
})();
</script>`;
}

