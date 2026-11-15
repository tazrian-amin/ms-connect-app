/*
 * Node 25+ has its own localStorage and sessionStorage, which are undefined unless Node is given a
 * storage file, and they stop jsdom's from being installed. In jsdom test files, put jsdom's back.
 */
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (dom) {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true, writable: true });
  }
}
