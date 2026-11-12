import { onBeforeUnmount, ref, watch } from 'vue'

/**
 * Session-scoped rabbit hole: the chain of articles a reader followed by
 * clicking links. Each page load starts a new hole on the start article; the
 * reader's choice to end tracking lives in `sessionStorage` and lasts the tab.
 */
const STORAGE_KEY = 'protowiki:rabbit-hole'

/**
 * No scrolling for this long counts as idle. Override for demos with
 * `?idleAfter=<seconds>` in the URL.
 */
const DEFAULT_IDLE_AFTER_MS = 15 * 60 * 1000

function idleAfterMs() {
  const param = Number(new URLSearchParams(window.location.search).get('idleAfter'))
  return param > 0 ? param * 1000 : DEFAULT_IDLE_AFTER_MS
}

/** Input that means the reader is still reading this page. */
const ACTIVITY_EVENTS = ['scroll', 'wheel', 'touchmove', 'keydown'] as const

interface StoredState {
  trail: string[]
  /** Milliseconds spent reading each trail entry, banked when the reader leaves it. */
  times: number[]
  /** Milliseconds spent idle on each trail entry — not counted in `times`. */
  idles: number[]
  current: number
  ended: boolean
}

function load(): StoredState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredState) : null
  } catch {
    return null
  }
}

function save(state: StoredState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private mode / blocked storage — the trail just won't survive a reload.
  }
}

export function useRabbitHole(startArticle: string) {
  const stored = load()
  // Every visit starts fresh on `startArticle`; only the stop/start choice carries over.
  const trail = ref<string[]>([startArticle])
  const times = ref<number[]>([0])
  const idles = ref<number[]>([0])
  /** Index into `trail` of the article being read — always the newest step. */
  const current = ref(0)
  /** Tracking ended: no trail until it's started again. */
  const ended = ref(stored?.ended ?? false)

  /** Article to render — tracked or not. */
  const article = ref(startArticle)

  const IDLE_AFTER_MS = idleAfterMs()

  /**
   * When the reader started on the current article. Only time with the tab
   * visible counts, so a page left open in the background doesn't inflate it.
   */
  let enteredAt: number | null = document.hidden ? null : Date.now()
  /** Last scroll (or key / touch) — the start of any idle stretch. */
  let lastActivityAt = Date.now()
  /** Reading time banked since `lastActivityAt`, handed back if that stretch turns out idle. */
  let bankedSinceActivity = 0

  function setAt(list: typeof times, index: number, value: number) {
    const next = [...list.value]
    next[index] = value
    list.value = next
  }

  /** Add the time since `enteredAt` to the current entry. */
  function bankTime() {
    if (enteredAt === null || ended.value) return
    const elapsed = Date.now() - enteredAt
    setAt(times, current.value, (times.value[current.value] ?? 0) + elapsed)
    bankedSinceActivity += elapsed
    enteredAt = Date.now()
  }

  /**
   * The reader scrolled (or moved on). If nothing happened for longer than
   * the idle threshold, that whole stretch is moved from reading time to idle.
   */
  function markActivity() {
    const now = Date.now()
    const quietFor = now - lastActivityAt
    // Scroll fires constantly; only re-mark (and save) about once a second.
    if (quietFor < 1000) {
      lastActivityAt = now
      return
    }
    // Close out reading time up to here, so an idle stretch only hands back its own time.
    bankTime()
    if (!ended.value && quietFor >= IDLE_AFTER_MS) {
      const i = current.value
      setAt(times, i, Math.max(0, (times.value[i] ?? 0) - bankedSinceActivity))
      setAt(idles, i, (idles.value[i] ?? 0) + quietFor)
    }
    lastActivityAt = now
    bankedSinceActivity = 0
  }

  function onVisibilityChange() {
    if (document.hidden) {
      bankTime()
      enteredAt = null
    } else {
      // Coming back to the tab isn't scrolling — an away stretch can still count as idle.
      enteredAt = Date.now()
    }
  }

  function onPageHide() {
    bankTime()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  for (const type of ACTIVITY_EVENTS) {
    window.addEventListener(type, markActivity, { passive: true })
  }
  onBeforeUnmount(() => {
    bankTime()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
    for (const type of ACTIVITY_EVENTS) {
      window.removeEventListener(type, markActivity)
    }
  })

  watch(
    [trail, times, idles, current, ended],
    () => {
      save({
        trail: trail.value,
        times: times.value,
        idles: idles.value,
        current: current.value,
        ended: ended.value,
      })
    },
    { deep: true, flush: 'sync' },
  )

  /**
   * Reader followed a link, searched, or picked an earlier step in the trail.
   * Every move goes on the end of the chain — revisiting a page adds it again
   * rather than winding the trail back.
   */
  function follow(title: string) {
    article.value = title
    if (ended.value) return
    if (trail.value[current.value] === title) return
    markActivity()
    bankTime()
    addStep(title)
  }

  function addStep(title: string) {
    trail.value = [...trail.value, title]
    times.value = [...times.value, 0]
    idles.value = [...idles.value, 0]
    current.value = trail.value.length - 1
    bankedSinceActivity = 0
  }

  function reset() {
    trail.value = [article.value]
    times.value = [0]
    idles.value = [0]
    current.value = 0
    lastActivityAt = Date.now()
    bankedSinceActivity = 0
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
    enteredAt = Date.now()
  }

  return {
    trail,
    times,
    idles,
    current,
    ended,
    article,
    follow,
    end,
    start,
  }
}
