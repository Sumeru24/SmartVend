import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Node 26 exposes an unavailable built-in localStorage during tests, so we
// install a deterministic in-memory implementation for jsdom.
class MemoryStorage {
  #store = new Map();

  get length() {
    return this.#store.size;
  }

  key(index) {
    return Array.from(this.#store.keys())[index] ?? null;
  }

  getItem(key) {
    const value = this.#store.get(String(key));
    return value === undefined ? null : value;
  }

  setItem(key, value) {
    this.#store.set(String(key), String(value));
  }

  removeItem(key) {
    this.#store.delete(String(key));
  }

  clear() {
    this.#store.clear();
  }
}

const memoryStorage = new MemoryStorage();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: memoryStorage,
});
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: memoryStorage,
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = "";
  document.body.style.overflow = "";
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;
window.scrollTo = vi.fn();

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => `00000000-0000-4000-8000-${Date.now()}` },
    configurable: true,
  });
}
