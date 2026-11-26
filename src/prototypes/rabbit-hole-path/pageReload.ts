/**
 * How the prototype page was opened, answered once per page load so that
 * moving around inside the prototype afterwards doesn't count:
 * - `fresh`: the browser loaded this page itself (refresh, typed URL, link,
 *   new tab) — not reached from the saved items page inside the prototype;
 * - `reload`: specifically the browser's refresh.
 */
let unchecked = true

export function consumePageLoad(): { fresh: boolean; reload: boolean } {
  if (!unchecked) return { fresh: false, reload: false }
  unchecked = false
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const fresh = !!nav && new URL(nav.name).pathname === window.location.pathname
  return { fresh, reload: fresh && nav?.type === 'reload' }
}
