import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

if (!('createObjectURL' in URL)) {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => 'blob:mock-url'),
  });
}

if (!('revokeObjectURL' in URL)) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  });
}

Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
  writable: true,
  value: vi.fn(),
});

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof globalThis.ResizeObserver !== 'function') {
  class ResizeObserverMock {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
  });
}

if (typeof globalThis.IntersectionObserver !== 'function') {
  class IntersectionObserverMock {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }

    takeRecords() {
      return [];
    }
  }

  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    value: IntersectionObserverMock,
  });
}

if (typeof globalThis.MutationObserver !== 'function') {
  class MutationObserverMock {
    disconnect() {
      return undefined;
    }

    observe() {
      return undefined;
    }

    takeRecords() {
      return [];
    }
  }

  Object.defineProperty(globalThis, 'MutationObserver', {
    writable: true,
    value: MutationObserverMock,
  });
}

if (typeof document.getAnimations !== 'function') {
  Object.defineProperty(document, 'getAnimations', {
    writable: true,
    value: () => [],
  });
}

if (typeof Element.prototype.getAnimations !== 'function') {
  Object.defineProperty(Element.prototype, 'getAnimations', {
    writable: true,
    value: () => [],
  });
}

if (typeof Element.prototype.animate !== 'function') {
  Object.defineProperty(Element.prototype, 'animate', {
    writable: true,
    value: () => ({
      cancel: () => undefined,
      commitStyles: () => undefined,
      finish: () => undefined,
      pause: () => undefined,
      play: () => undefined,
      reverse: () => undefined,
      updatePlaybackRate: () => undefined,
      finished: Promise.resolve(undefined),
      oncancel: null,
      onfinish: null,
      playState: 'finished',
    }),
  });
}

if (typeof Element.prototype.setPointerCapture !== 'function') {
  Object.defineProperty(Element.prototype, 'setPointerCapture', {
    writable: true,
    value: () => undefined,
  });
}

if (typeof Element.prototype.releasePointerCapture !== 'function') {
  Object.defineProperty(Element.prototype, 'releasePointerCapture', {
    writable: true,
    value: () => undefined,
  });
}

if (typeof Element.prototype.hasPointerCapture !== 'function') {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', {
    writable: true,
    value: () => false,
  });
}
