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
  [data-ve-selected="true"]:not([data-ve-editing="true"]) {
    cursor: grab !important;
  }
  [data-ve-dragging="true"] {
    cursor: grabbing !important;
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
</style>
<style data-ve-internal="live-responsive-css"></style>
<style data-ve-internal="layout-outlines"></style>
<div id="__ve_hover_badge" data-ve-internal="badge"></div>
<div id="__ve_action_toast" data-ve-internal="action-toast" role="status"></div>
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
  var actionToastTimer = null;
  var domTreeTimer = null;
  var outlinesEnabled = false;
  var liveResponsiveStyleEl = document.querySelector('style[data-ve-internal="live-responsive-css"]');
  var outlinesStyleEl = document.querySelector('style[data-ve-internal="layout-outlines"]');
  var moveDrag = null;
  var suppressNextClick = false;

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
    if (el.id === '__ve_hover_badge' || el.id === '__ve_action_toast' || el.getAttribute('data-ve-internal')) return true;
    if (el.closest && el.closest('[data-ve-internal]')) return true;
    var tag = el.tagName.toLowerCase();
    return tag === 'html' || tag === 'head' || tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link';
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
        if (sib.tagName === cur.tagName) index++;
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
        zIndex: el.style.zIndex || (computed.zIndex === 'auto' ? '0' : computed.zIndex),
        display: computed.display,
        flexDirection: computed.flexDirection,
        gap: computed.gap
      },
      inlineStyles: parseInlineStyle(el)
    };
  }

  function postToParent(type, data) {
    window.parent.postMessage(Object.assign({ source: 've-iframe', type: type }, data), '*');
  }

  function clearHover() {
    if (hoveredEl) {
      hoveredEl.removeAttribute('data-ve-hovered');
      hoveredEl = null;
    }
    if (badge) badge.style.display = 'none';
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
      clearHover();
      return;
    }
    if (hoveredEl && hoveredEl !== target) {
      hoveredEl.removeAttribute('data-ve-hovered');
    }
    hoveredEl = target;
    if (hoveredEl !== selectedEl) {
      hoveredEl.setAttribute('data-ve-hovered', 'true');
    }
    positionBadge(hoveredEl);
  }, true);

  document.addEventListener('mouseleave', function() {
    clearHover();
  }, true);

  document.addEventListener('mousedown', function(e) {
    if (mode !== 'edit' || e.button !== 0 || editingEl) return;
    var target = resolveEditableTarget(e.target);
    if (!target || isInternalEl(target) || target === document.body) return;
    var computed = window.getComputedStyle(target);
    var parsedLeft = parseFloat(target.style.left || computed.left);
    var parsedTop = parseFloat(target.style.top || computed.top);
    moveDrag = {
      el: target,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: Number.isFinite(parsedLeft) ? parsedLeft : 0,
      startTop: Number.isFinite(parsedTop) ? parsedTop : 0,
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
    }
    var nextLeft = Math.round(moveDrag.startLeft + dx);
    var nextTop = Math.round(moveDrag.startTop + dy);
    moveDrag.el.style.left = nextLeft + 'px';
    moveDrag.el.style.top = nextTop + 'px';
    positionBadge(moveDrag.el, 'Move · x: ' + nextLeft + 'px, y: ' + nextTop + 'px', '#3b82f6');
    notifyRectChange();
  }, true);

  window.addEventListener('mouseup', function() {
    if (!moveDrag) return;
    var drag = moveDrag;
    moveDrag = null;
    if (drag.dragging) {
      drag.el.removeAttribute('data-ve-dragging');
      if (badge) badge.style.display = 'none';
      suppressNextClick = true;
      window.setTimeout(function() { suppressNextClick = false; }, 80);
      postToParent('POSITION_COMMITTED', {
        veId: drag.el.getAttribute('data-ve-id') || null,
        runtimeId: getRuntimeId(drag.el),
        styles: {
          position: drag.el.style.position || drag.targetPosition,
          left: drag.el.style.left,
          top: drag.el.style.top
        },
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
    var isShortcut =
      e.key === 'Escape' ||
      e.key === '?' ||
      (e.key === 'Delete' && mode === 'edit') ||
      (e.key === 'Backspace' && mode === 'edit') ||
      (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) ||
      (!hasMod && !e.altKey && (e.key === '1' || e.key === '2' || e.key === '3')) ||
      (hasMod && ['z', 'y', 's', 'e', 'b', 'i', 'd'].indexOf(lower) !== -1);

    if (isShortcut) {
      e.preventDefault();
      postToParent('IFRAME_KEYDOWN', {
        key: e.key,
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

  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || msg.target !== 've-iframe') return;

    if (msg.type === 'SET_MODE') {
      mode = msg.mode;
      if (mode !== 'edit') {
        clearHover();
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
      return;
    }

    if (msg.type === 'SET_OUTLINES') {
      outlinesEnabled = Boolean(msg.enabled);
      applyOutlinesCss();
      return;
    }

    if (msg.type === 'SELECT_VE_ID' || msg.type === 'SELECT_NODE_ID') {
      var targetId = msg.nodeId || msg.veId || null;
      var found = findNodeById(targetId);
      if (found && msg.scrollIntoView !== false && found.scrollIntoView) {
        found.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      selectElement(found, true);
      window.requestAnimationFrame(notifyRectChange);
      return;
    }

    if (msg.type === 'HOVER_NODE_ID') {
      clearHover();
      if (mode === 'edit' && msg.nodeId) {
        var hov = findNodeById(msg.nodeId);
        if (hov && !isInternalEl(hov) && hov !== document.body) {
          hoveredEl = hov;
          if (hoveredEl !== selectedEl) {
            hoveredEl.setAttribute('data-ve-hovered', 'true');
          }
          positionBadge(hoveredEl);
        }
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

    if (msg.type === 'UPDATE_ROOT_VAR' && msg.name) {
      if (msg.value === null || msg.value === '') {
        document.documentElement.style.removeProperty(msg.name);
      } else {
        document.documentElement.style.setProperty(msg.name, msg.value);
      }
      window.requestAnimationFrame(notifyRectChange);
      return;
    }

    if (msg.type === 'UPDATE_ATTRS' && selectedEl && msg.attributes) {
      Object.keys(msg.attributes).forEach(function(attr) {
        var val = msg.attributes[attr];
        if (val === null || val === '') {
          selectedEl.removeAttribute(attr);
        } else {
          selectedEl.setAttribute(attr, val);
        }
      });
      notifyRectChange();
      scheduleDomTreeEmit();
      return;
    }

    if (msg.type === 'PREVIEW_STYLE' && selectedEl) {
      var styles = msg.styles || {};
      Object.keys(styles).forEach(function(prop) {
        var val = styles[prop];
        if (val === null || val === '') {
          selectedEl.style.removeProperty(prop);
        } else {
          selectedEl.style.setProperty(prop, val);
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

    if (msg.type === 'REQUEST_RECT') {
      notifyRectChange();
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

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var domObserver = new MutationObserver(function(mutations) {
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
        if (!didNotifyMount) {
          syncMountedDom();
        }
      }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
</script>`;
}

