/**
 * UI-only battle gestures. This module never imports or writes game/save state.
 *
 * attachBattleGestures({ root, getIntent, begin, getDropAction, commit, cancel,
 *   onDrag, allowRevealedTarget, document, threshold = 10, clickSuppressionMs = 750 })
 *
 * getIntent(element, event) returns null or an opaque intent. Optional
 * intent.sourceElement identifies the entire source card/unit; intent.label
 * supplies accessible ghost text. getDropAction(intent, hitElement, event)
 * returns null/undefined/false for an illegal drop, otherwise an opaque action.
 * begin(intent, event) only selects/renders UI and may return false to abort.
 * commit(action, event, intent) is called once, only for a legal pointerup.
 * cancel(intent, reason, event) runs only if begin was called.
 * onDrag(active, intent) brackets an actual drag, never a tap.
 * allowRevealedTarget(intent, hit, legalAction, event) may opt in to a legal
 * entity revealed where a collapsed hand used to be; defaults false.
 *
 * Keep root stable when rendering. Draggable elements must have touch-action:
 * none in CSS before pointerdown. Mark intended hover outlines with
 * data-gesture-target (optional). Returns { cancel(reason), destroy() }.
 */

export function hasDragThreshold(start, point, threshold = 10) {
  const dx = Number(point.clientX) - Number(start.clientX);
  const dy = Number(point.clientY) - Number(start.clientY);
  return Number.isFinite(dx) && Number.isFinite(dy)
    && dx * dx + dy * dy >= Math.max(0, threshold) ** 2;
}

export function isPointInRect(point, rect) {
  return !!rect && rect.right > rect.left && rect.bottom > rect.top
    && point.clientX >= rect.left && point.clientX <= rect.right
    && point.clientY >= rect.top && point.clientY <= rect.bottom;
}

export function isLegalDropAction(action) {
  return action !== null && action !== undefined && action !== false;
}

/** A detail=0 keyboard/assistive activation must always remain available. */
export function shouldSuppressClick(event, suppression, now = Date.now()) {
  if (!suppression || event.detail === 0 || now > suppression.expiresAt) return false;
  // Older browsers expose a MouseEvent rather than a PointerEvent for click.
  if (!Number.isFinite(event.pointerId) || event.pointerId <= 0) return true;
  return suppression.pointerIds.includes(event.pointerId);
}

export function attachBattleGestures(options) {
  const {
    root, getIntent, getDropAction, commit,
    begin = () => {}, cancel: onCancel = () => {}, onDrag = () => {},
    allowRevealedTarget = () => false,
    threshold = 10, clickSuppressionMs = 750,
  } = options;
  const doc = options.document ?? root?.ownerDocument ?? globalThis.document;
  const win = doc?.defaultView;
  if (!root?.addEventListener || !doc?.addEventListener
      || typeof getIntent !== 'function' || typeof getDropAction !== 'function'
      || typeof commit !== 'function') {
    throw new TypeError('Battle gestures need a stable root, document, and intent/drop/commit callbacks.');
  }

  let gesture = null;
  let suppression = null;
  let destroyed = false;
  let multiTouchSequence = false;
  const pointers = new Set();
  const removers = [];
  const listen = (target, name, handler, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(name, handler, options);
    removers.push(() => target.removeEventListener(name, handler, options));
  };
  const withinRoot = (element) => !!element && (element === root || root.contains(element));
  const prevent = (event) => { if (event?.cancelable !== false) event?.preventDefault?.(); };

  function armSuppression(g, extraId) {
    const ids = new Set([...pointers, g.pointerId]);
    if (extraId !== undefined) ids.add(extraId);
    suppression = { pointerIds: [...ids], expiresAt: Date.now() + clickSuppressionMs };
  }

  function setHover(g, element) {
    if (g.hover === element) return;
    if (g.hover && !g.hoverHadClass) g.hover.classList?.remove('gesture-drop-target');
    g.hover = element;
    g.hoverHadClass = !!element?.classList?.contains('gesture-drop-target');
    element?.classList?.add('gesture-drop-target');
  }

  function release(g) {
    // Clear state first: releasePointerCapture synchronously/async dispatches
    // lostpointercapture on different browsers, and callbacks may rerender.
    if (gesture === g) gesture = null;
    setHover(g, null);
    g.ghost?.remove();
    if (g.dragging) {
      if (g.oldDraggingAttribute === null) root.removeAttribute('data-gesture-dragging');
      else root.setAttribute('data-gesture-dragging', g.oldDraggingAttribute);
    }
    if (g.captured) {
      try {
        if (!root.hasPointerCapture || root.hasPointerCapture(g.pointerId)) {
          root.releasePointerCapture?.(g.pointerId);
        }
      } catch { /* Pointer already ended/cancelled by the browser. */ }
    }
    if (g.notifiedDrag) onDrag(false, g.intent);
  }

  function abort(reason = 'cancelled', event, suppress = true) {
    const g = gesture;
    if (!g) return;
    if (suppress) armSuppression(g, event?.pointerId);
    try { release(g); }
    finally { if (g.began) onCancel(g.intent, reason, event); }
  }

  function makeGhost(g) {
    const source = g.source;
    const ghost = source?.cloneNode?.(true) ?? doc.createElement('div');
    ghost.removeAttribute?.('id');
    ghost.removeAttribute?.('name');
    for (const node of ghost.querySelectorAll?.('[id], [name]') ?? []) {
      node.removeAttribute('id');
      node.removeAttribute('name');
    }
    ghost.classList?.add('gesture-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    ghost.setAttribute('tabindex', '-1');
    if (!source?.cloneNode) ghost.textContent = g.intent.label ?? source?.textContent ?? 'Move';
    Object.assign(ghost.style, {
      position: 'fixed', left: '0', top: '0', margin: '0',
      width: `${Math.min(180, Math.max(72, g.sourceRect?.width || 112))}px`,
      height: 'auto', maxHeight: '220px', overflow: 'hidden',
      pointerEvents: 'none', zIndex: '2147483647', opacity: '0.9',
      transformOrigin: 'center center', transition: 'none',
      userSelect: 'none', willChange: 'transform',
    });
    return ghost;
  }

  function updateVisual(g, event) {
    if (g.ghost) {
      g.ghost.style.transform = `translate3d(${event.clientX + 14}px, ${event.clientY - 42}px, 0) scale(.9)`;
    }
    const hit = doc.elementFromPoint?.(event.clientX, event.clientY) ?? null;
    if (!withinRoot(hit)) {
      setHover(g, null);
      return null;
    }
    const action = getDropAction(g.intent, hit, event);
    // Layout can reveal a distinct legal target underneath an expanded hand.
    // Default behavior still cancels returning to the old source rectangle.
    if (isPointInRect(event, g.sourceRect) && !(isLegalDropAction(action) && allowRevealedTarget(g.intent,hit,action,event))) {
      setHover(g,null); return null;
    }
    const marked = hit.closest?.('[data-gesture-target], [data-drop-target], [data-drop-zone]');
    setHover(g, isLegalDropAction(action) ? (withinRoot(marked) ? marked : hit) : null);
    return action;
  }

  function startDrag(g, event) {
    // Snapshot before begin(): the entire source subtree may disappear there.
    g.ghost = makeGhost(g);
    if (root.setPointerCapture) {
      try {
        root.setPointerCapture(g.pointerId);
        g.captured = true;
      } catch {
        abort('capture-failed', event);
        return false;
      }
    }
    g.oldDraggingAttribute = root.getAttribute('data-gesture-dragging');
    g.dragging = true;
    root.setAttribute('data-gesture-dragging', 'true');
    (doc.body ?? root).appendChild(g.ghost);
    g.began = true;
    if (begin(g.intent, event) === false) {
      abort('begin-rejected', event);
      return false;
    }
    if (gesture !== g) return false; // begin() may cancel or destroy the binding.
    g.notifiedDrag = true;
    onDrag(true, g.intent);
    return gesture === g;
  }

  function trackPointerDown(event) {
    if (destroyed) return;
    // A fresh interaction owns its own click. Do not swallow a fast second tap
    // merely because a previous drag armed a timed compatibility-click guard.
    if (pointers.size === 0 && !gesture) {
      suppression = null;
      multiTouchSequence = false;
    }
    pointers.add(event.pointerId);
    if (pointers.size > 1) {
      multiTouchSequence = true;
      if (gesture) abort('multitouch', event);
      else if (suppression) suppression.pointerIds = [...new Set([...suppression.pointerIds, event.pointerId])];
    }
  }

  function pointerDown(event) {
    if (destroyed || gesture || multiTouchSequence || event.defaultPrevented
        || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
    const intent = getIntent(event.target, event);
    if (intent === null || intent === undefined || intent === false) return;
    const source = intent.sourceElement ?? event.target;
    const rect = source?.getBoundingClientRect?.();
    gesture = {
      pointerId: event.pointerId, intent, source,
      start: { clientX: event.clientX, clientY: event.clientY },
      sourceRect: rect ? {
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: rect.width, height: rect.height,
      } : null,
      dragging: false, captured: false, began: false, notifiedDrag: false,
      ghost: null, hover: null, hoverHadClass: false,
    };
    // Do not preventDefault or capture while pending: native click is the tap
    // fallback, including the direct button handlers already used by the app.
  }

  function pointerMove(event) {
    const g = gesture;
    if (!g || event.pointerId !== g.pointerId) return;
    if (root.isConnected === false) { abort('root-detached', event); return; }
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      abort('buttons-released', event);
      return;
    }
    if (!g.dragging && !hasDragThreshold(g.start, event, threshold)) return;
    prevent(event);
    try {
      if (!g.dragging && !startDrag(g, event)) return;
      updateVisual(g, event);
    } catch (error) {
      abort('callback-error', event);
      throw error;
    }
  }

  function pointerUp(event) {
    const g = gesture;
    try {
      if (!g || event.pointerId !== g.pointerId) return;
      if (!g.dragging) {
        release(g);
        return;
      }
      prevent(event);
      armSuppression(g);
      let action;
      try { action = updateVisual(g, event); }
      catch (error) { abort('callback-error', event); throw error; }
      if (!isLegalDropAction(action)) { abort('invalid-drop', event); return; }
      release(g);
      commit(action, event, g.intent);
    } finally {
      // Escape/lost capture can cancel while a finger is still held down.
      // Refresh the guard on its eventual release, even after a long hold.
      if (suppression?.pointerIds.includes(event.pointerId)) {
        suppression.expiresAt = Date.now() + clickSuppressionMs;
      }
      pointers.delete(event.pointerId);
    }
  }

  function pointerCancel(event) {
    try {
      if (gesture?.pointerId === event.pointerId) abort('pointercancel', event);
    } finally {
      if (suppression?.pointerIds.includes(event.pointerId)) {
        suppression.expiresAt = Date.now() + clickSuppressionMs;
      }
      pointers.delete(event.pointerId);
    }
  }

  function lostCapture(event) {
    if (gesture?.dragging && gesture.pointerId === event.pointerId) {
      abort('lostpointercapture', event);
    }
  }

  function clickCapture(event) {
    if (!shouldSuppressClick(event, suppression)) return;
    prevent(event);
    event.stopImmediatePropagation();
    // Keep the guard until a fresh pointerdown/expiry. Some browsers emit both
    // a retargeted click and a compatibility click after releasing capture.
  }

  function interrupt(reason, event) {
    abort(reason, event);
    // blur/rotation can consume terminal pointer events; don't leave the next
    // genuine interaction permanently blocked as a phantom second pointer.
    pointers.clear();
    multiTouchSequence = false;
  }

  listen(doc, 'pointerdown', trackPointerDown, true);
  listen(root, 'pointerdown', pointerDown, true);
  listen(doc, 'pointermove', pointerMove, { capture: true, passive: false });
  listen(doc, 'pointerup', pointerUp, { capture: true, passive: false });
  listen(doc, 'pointercancel', pointerCancel, true);
  listen(root, 'lostpointercapture', lostCapture, true);
  listen(root, 'click', clickCapture, true);
  listen(doc, 'keydown', (event) => {
    if (event.key === 'Escape' && gesture) { prevent(event); abort('escape', event); }
  }, true);
  listen(doc, 'visibilitychange', (event) => {
    if (doc.hidden) interrupt('hidden', event);
  });
  listen(win, 'blur', (event) => interrupt('blur', event));
  listen(win, 'resize', (event) => interrupt('resize', event));
  listen(win, 'orientationchange', (event) => interrupt('orientationchange', event));
  listen(win?.screen?.orientation, 'change', (event) => interrupt('orientationchange', event));

  return {
    cancel(reason = 'external-cancel') { abort(reason); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try { abort('destroy'); }
      finally {
        for (const remove of removers) remove();
        pointers.clear();
        suppression = null;
      }
    },
  };
}
