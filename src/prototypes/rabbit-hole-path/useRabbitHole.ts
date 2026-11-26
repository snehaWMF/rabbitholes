import { computed, ref, type Ref } from 'vue'

/**
 * Session-scoped rabbit hole: the articles a reader followed by clicking
 * links. Every page load starts with tracking off; the reader selects Start
 * to begin a hole on the article they're reading.
 *
 * A page only joins the trail if the reader's current step links to it.
 * Anything else — a search, Back / Forward to an unlinked page — takes them
 * off the path: nothing is added until they come back.
 *
 * The trail is a tree of steps. With `branching` off it stays a single line:
 * picking an earlier step pauses the path, and only the last step resumes it.
 * With `branching` on, picking any step puts the reader back on the path at
 * that step, and following a link from there starts a sub-path (a branch).
 */
export interface Step {
  title: string
  /** Index of the step this one was reached from; `null` for the first. */
  parent: number | null
}

export function useRabbitHole(startArticle: string, branching: Ref<boolean>) {
  const steps = ref<Step[]>([{ title: startArticle, parent: null }])
  /** Index into `steps` of the reader's place on the path. */
  const current = ref(0)
  /** Tracking off: no trail until the reader selects Start. Every visit starts off. */
  const ended = ref(true)
  /** The reader is somewhere the current step doesn't link to. */
  const offPath = ref(false)
  /**
   * The earlier step the reader went back to by selecting it in the trail
   * (single line only) — the path is paused there. `null` otherwise.
   */
  const revisited = ref<number | null>(null)

  /** Article to render — tracked or not. */
  const article = ref(startArticle)

  /** Every step's title, in the order reached. */
  const trail = computed(() => steps.value.map((s) => s.title))
  /** Links from the first step to the current one. */
  const depth = computed(() => {
    let n = 0
    for (let i = steps.value[current.value]?.parent; i != null; i = steps.value[i].parent) n++
    return n
  })

  /** The article links on each page read this session, by page title. */
  const linksByPage = new Map<string, Set<string>>()

  /** Record which articles a page links to (once its content has loaded). */
  function setLinks(page: string, links: Iterable<string>) {
    linksByPage.set(page, new Set(links))
  }

  /**
   * Reader opened an article. `step`: they picked that step in the trail.
   */
  function visit(title: string, { step }: { step?: number } = {}) {
    article.value = title
    if (ended.value) return

    if (step !== undefined) {
      if (branching.value) {
        current.value = step
        offPath.value = false
        revisited.value = null
      } else {
        // A single line: only the last step resumes the path.
        offPath.value = step !== current.value
        revisited.value = offPath.value ? step : null
      }
      return
    }

    const here = steps.value[current.value]
    if (title === here.title) {
      offPath.value = false
      revisited.value = null
      return
    }
    if (offPath.value) {
      // Moved on from the step they went back to: just off the path now.
      if (revisited.value !== null && steps.value[revisited.value]?.title !== title) revisited.value = null
      return
    }
    if (!linksByPage.get(here.title)?.has(title)) {
      offPath.value = true
      return
    }
    // Already followed this link from here: step onto it rather than adding it twice.
    const existing = steps.value.findIndex((s) => s.parent === current.value && s.title === title)
    if (existing >= 0) {
      current.value = existing
      return
    }
    steps.value = [...steps.value, { title, parent: current.value }]
    current.value = steps.value.length - 1
  }

  function reset() {
    steps.value = [{ title: article.value, parent: null }]
    current.value = 0
    offPath.value = false
    revisited.value = null
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
    steps,
    trail,
    depth,
    current,
    ended,
    offPath,
    revisited,
    article,
    visit,
    setLinks,
    end,
    start,
  }
}
