import '@testing-library/jest-dom/vitest';

// jsdom does not implement PointerEvent — polyfill it so that
// fireEvent.pointerDown/pointerMove/pointerUp expose button/clientX/clientY etc.
// (https://github.com/jsdom/jsdom/issues/2527)
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    public pointerId?: number;
    public pointerType?: string;
    public isPrimary?: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
      this.isPrimary = params.isPrimary;
    }
  }
  // @ts-expect-error — polyfill assignment
  globalThis.PointerEvent = PointerEvent;
  // @ts-expect-error — polyfill assignment
  window.PointerEvent = PointerEvent;
}

// jsdom does not implement these pointer-capture APIs used by drag handlers.
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = function () {};
}
if (typeof Element.prototype.releasePointerCapture !== 'function') {
  Element.prototype.releasePointerCapture = function () {};
}
if (typeof Element.prototype.hasPointerCapture !== 'function') {
  Element.prototype.hasPointerCapture = function () {
    return false;
  };
}
