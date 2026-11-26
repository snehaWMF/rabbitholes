/**
 * Whether this page load was a browser refresh — answered `true` at most once,
 * so moving around inside the prototype afterwards isn't mistaken for one.
 */
let unchecked = true

export function consumeReload(): boolean {
  if (!unchecked) return false
  unchecked = false
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  // Only if the page refreshed was this one (not, say, the saved items page).
  return nav?.type === 'reload' && new URL(nav.name).pathname === window.location.pathname
}
