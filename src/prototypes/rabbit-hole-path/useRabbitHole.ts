import { ref } from 'vue'

/**
 * Session-scoped rabbit hole: the chain of articles a reader followed by
 * clicking links. Every page load starts with tracking off; the reader
 * selects Start to begin a hole on the article they're reading.
 *
 * Searching jumps somewhere the trail doesn't link to, so it takes the
 * reader off the path: nothing they read there is added. Going back to the
 * trail's last article (or picking any step in the trail) puts them back on.
 */
export function useRabbitHole(startArticle: string) {
  const trail = ref<string[]>([startArticle])
  /** Index into `trail` of the reader's place in it — always the newest step. */
  const current = ref(0)
  /** Tracking off: no trail until the reader selects Start. Every visit starts off. */
  const ended = ref(true)
  /** The reader searched away from the trail and hasn't come back to it yet. */
  const offPath = ref(false)

  /** Article to render — tracked or not. */
  const article = ref(startArticle)

  /**
   * Reader followed a link, used Back / Forward, or picked a step in the
   * trail (`fromTrail`). Each move goes on the end of the chain — revisiting
   * a page adds it again rather than winding the trail back — unless the
   * reader is off the path, where only a way back to the trail counts.
   */
  function follow(title: string, { fromTrail = false } = {}) {
    article.value = title
    if (ended.value) return
    if (trail.value[current.value] === title) {
      offPath.value = false
      return
    }
    if (offPath.value && !fromTrail) return
    offPath.value = false
    addStep(title)
  }

  /** Reader searched for an article: off the path until they come back to the trail. */
  function jump(title: string) {
    article.value = title
    if (ended.value) return
    offPath.value = trail.value[current.value] !== title
  }

  function addStep(title: string) {
    trail.value = [...trail.value, title]
    current.value = trail.value.length - 1
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
    follow,
    jump,
    end,
    start,
  }
}
