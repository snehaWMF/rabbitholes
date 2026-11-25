import { ref } from 'vue'

/**
 * Session-scoped rabbit hole: the chain of articles a reader followed by
 * clicking links. Every page load starts with tracking off; the reader
 * selects Start to begin a hole on the article they're reading.
 *
 * A page only joins the trail if the trail's last article links to it.
 * Anything else — a search, Back / Forward to an unlinked page, an earlier
 * step in the trail — pauses the path: nothing is added until the reader
 * goes back to the trail's last article.
 */
export function useRabbitHole(startArticle: string) {
  const trail = ref<string[]>([startArticle])
  /** Index into `trail` of the reader's place in it — always the newest step. */
  const current = ref(0)
  /** Tracking off: no trail until the reader selects Start. Every visit starts off. */
  const ended = ref(true)
  /** The reader jumped to a page the trail's last article doesn't link to. */
  const offPath = ref(false)

  /** Article to render — tracked or not. */
  const article = ref(startArticle)

  /** The article links on each page read this session, by page title. */
  const linksByPage = new Map<string, Set<string>>()

  /** Record which articles a page links to (once its content has loaded). */
  function setLinks(page: string, links: Iterable<string>) {
    linksByPage.set(page, new Set(links))
  }

  /**
   * Reader opened an article, however they got there. `fromTrail`: they
   * picked an earlier step in the trail, which pauses the path. Once paused,
   * only going back to the last step resumes it.
   */
  function visit(title: string, { fromTrail = false } = {}) {
    article.value = title
    if (ended.value) return
    const last = trail.value[current.value]
    if (title === last) {
      offPath.value = false
    } else if (!offPath.value && !fromTrail && linksByPage.get(last)?.has(title)) {
      offPath.value = false
      trail.value = [...trail.value, title]
      current.value = trail.value.length - 1
    } else {
      offPath.value = true
    }
  }

  function reset() {
    trail.value = [article.value]
    current.value = 0
    offPath.value = false
  }

  /** End tracking for this session — and forget what was tracked. */
  function end() {
    ended.value = true
    reset()
  }

  /** Start a fresh hole from the article being read. */
  function start() {
    ended.value = false
    reset()
  }

  return {
    trail,
    current,
    ended,
    offPath,
    article,
    visit,
    setLinks,
    end,
    start,
  }
}
