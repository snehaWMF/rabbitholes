<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconPlay, cdxIconShare, cdxIconStop } from '@wikimedia/codex-icons'

import type { Step } from './useRabbitHole'

interface Props {
  /** Module heading. */
  heading?: string
  /** A saved rabbit hole being looked at: no Start / End, no notes. */
  readonly?: boolean
  /** The trail as a tree: each step knows the step it was reached from. */
  steps: Step[]
  /** Index of the step the reader is on. */
  current: number
  /** Links from the first step to the current one. */
  depth: number
  /** Multiple paths: any step can start a sub-path (changes the off-path note). */
  branching?: boolean
  /** Tracking ended — no trail, just the option to start again. */
  ended: boolean
  /** The reader jumped to a page the last step doesn't link to; that step is the way back. */
  offPath?: boolean
  /** Show a "hide" button by the heading (desktop sidebar). */
  hideable?: boolean
  /** Articles in the reader's saved items — marked "saved" under their title. */
  saved?: string[]
  /**
   * Cap the list's height to fit the window (desktop sidebar). Off inside the
   * mobile sheet, which scrolls as a whole.
   */
  fit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  saved: () => [],
  fit: true,
  offPath: false,
  hideable: false,
  branching: false,
  heading: 'Your rabbit hole',
  readonly: false,
})

const emit = defineEmits<{
  revisit: [index: number]
  end: []
  start: []
  hide: []
  share: []
}>()

/** The step the reader is on — none while they're off the path. */
function isHere(index: number) {
  return index === props.current && !props.offPath
}

/*
 * ── Rows ──
 * The tree drawn as a list. A step's first link continues its line; any
 * later link from the same step is a sub-path, indented one level and drawn
 * right under it with an elbow from the line it branched from. Vertical
 * guides carry a line past sub-paths to where it continues.
 */
interface Row {
  key: string
  kind: 'step' | 'next' | 'off'
  index: number
  title: string
  level: number
  /** Line from the row above, at this row's level. */
  up: boolean
  /** Elbow from the parent's line (first step of a sub-path). */
  elbow: boolean
  /** Line on down to the next row at this level. */
  down: boolean
  /** Levels whose line passes straight through this row. */
  guides: number[]
}

const rows = computed<Row[]>(() => {
  const steps = props.steps
  const children = steps.map(() => [] as number[])
  steps.forEach((s, i) => {
    if (s.parent !== null) children[s.parent].push(i)
  })
  const out: Row[] = []
  const walk = (i: number, level: number, elbow: boolean) => {
    out.push({
      key: `step-${i}`,
      kind: 'step',
      index: i,
      title: steps[i].title,
      level,
      up: steps[i].parent !== null && !elbow,
      elbow,
      down: children[i].length > 0,
      guides: [],
    })
    for (const branch of children[i].slice(1)) walk(branch, level + 1, true)
    if (children[i][0] !== undefined) walk(children[i][0], level, false)
  }
  if (steps.length) walk(0, 0, false)

  // A note at the end: off the path, or (one step so far) the next step waiting.
  const extra = props.readonly ? null : props.offPath ? 'off' : steps.length === 1 ? 'next' : null
  if (extra) {
    const last = out[out.length - 1]
    last.down = true
    out.push({ key: extra, kind: extra, index: -1, title: '', level: last.level, up: true, elbow: false, down: false, guides: [] })
  }

  out.forEach((row, r) => {
    for (let level = 0; level < row.level; level++) {
      if (continuesBelow(out, r, level)) row.guides.push(level)
    }
  })
  return out
})

/** Whether the line at `level` carries on somewhere below row `r`. */
function continuesBelow(rows: Row[], r: number, level: number) {
  for (let j = r + 1; j < rows.length; j++) {
    const row = rows[j]
    if (row.level === level + 1 && row.elbow) return true
    if (row.level === level) return row.up
    if (row.level < level) return false
  }
  return false
}

/*
 * The list scrolls on its own past MAX_VISIBLE_STEPS articles — or sooner,
 * if even that would push what sits under it (the depth line, "Other
 * readers' paths") past the bottom of the window. Heights are measured, so it
 * adapts to wrapped titles and the screen size; the newest step stays in view.
 */
const MAX_VISIBLE_STEPS = 10
const GAP_BELOW_PX = 16
const MIN_LIST_PX = 120
const navRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLOListElement | null>(null)
const listMaxHeight = ref<string | undefined>(undefined)

async function fitList() {
  await nextTick()
  const list = listRef.value
  const nav = navRef.value
  if (!list || !nav || !props.fit) return
  // Everything after the list in the rail — its height doesn't depend on the list's.
  // (The rail's own box is height-capped, so measure its last child instead.)
  const lastInRail = (nav.parentElement ?? nav).lastElementChild ?? nav
  const listRect = list.getBoundingClientRect()
  const below = Math.max(0, lastInRail.getBoundingClientRect().bottom - listRect.bottom)
  const listTop = listRect.top + window.scrollY
  const windowRoom = Math.max(MIN_LIST_PX, window.innerHeight - listTop - below - GAP_BELOW_PX)
  // Bottom of the last article that fits under the cap (offsetTop is from the list).
  const steps = list.querySelectorAll<HTMLElement>('.rabbit-hole__item')
  const lastVisible = steps[MAX_VISIBLE_STEPS - 1]
  const stepsRoom =
    steps.length > MAX_VISIBLE_STEPS && lastVisible
      ? lastVisible.offsetTop + lastVisible.offsetHeight
      : Infinity
  const room = Math.min(windowRoom, stepsRoom)
  const next = list.scrollHeight > room ? `${Math.floor(room)}px` : undefined
  if (next !== listMaxHeight.value) listMaxHeight.value = next
  await nextTick()
  list.scrollTop = list.scrollHeight
}

let railObserver: ResizeObserver | null = null

watch(() => [props.steps.length, props.current, props.ended, props.offPath], fitList)
onMounted(() => {
  fitList()
  window.addEventListener('resize', fitList)
  // "Other readers' paths" loads after the trail; refit when the rail changes size.
  const rail = navRef.value?.parentElement
  if (rail) {
    railObserver = new ResizeObserver(() => fitList())
    railObserver.observe(rail)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', fitList)
  railObserver?.disconnect()
})

/** The quiet line under a title, for pages in the reader's saved items. */
function metaFor(title: string) {
  return props.saved.includes(title) ? 'saved' : ''
}
</script>

<template>
  <nav ref="navRef" class="rabbit-hole" aria-labelledby="rabbit-hole-heading">
    <!-- Heading (with "hide" beside it on desktop), and End at the right once started. -->
    <div class="rabbit-hole__header">
      <h2 id="rabbit-hole-heading" class="rabbit-hole__heading">
        {{ props.heading }}
        <button
          v-if="props.hideable"
          type="button"
          class="rabbit-hole__hide"
          @click="emit('hide')"
        >
          hide
        </button>
      </h2>
      <button
        v-if="!props.ended && !props.readonly"
        type="button"
        class="rabbit-hole__toggle"
        @click="emit('end')"
      >
        <CdxIcon :icon="cdxIconStop" size="small" />
        End
      </button>
    </div>

    <button
      v-if="props.ended && !props.readonly"
      type="button"
      class="rabbit-hole__start"
      @click="emit('start')"
    >
      <CdxIcon :icon="cdxIconPlay" size="small" />
      Start your rabbit hole
    </button>

    <template v-if="!props.ended || props.readonly">
      <ol
        ref="listRef"
        class="rabbit-hole__list"
        :class="{ 'rabbit-hole__list--scrolls': listMaxHeight }"
        :style="{ maxHeight: listMaxHeight }"
      >
        <li
          v-for="row in rows"
          :key="row.key"
          class="rabbit-hole__item"
          :class="{
            'rabbit-hole__item--current': row.kind === 'step' && isHere(row.index),
            'rabbit-hole__item--next': row.kind === 'next',
            'rabbit-hole__item--off': row.kind === 'off',
          }"
          :style="{ '--level': row.level }"
        >
          <span
            v-for="level in row.guides"
            :key="level"
            class="rabbit-hole__guide"
            :style="{ '--at': level }"
            aria-hidden="true"
          />
          <span v-if="row.up" class="rabbit-hole__line rabbit-hole__line--up" aria-hidden="true" />
          <span v-if="row.elbow" class="rabbit-hole__elbow" aria-hidden="true" />
          <span v-if="row.down" class="rabbit-hole__line rabbit-hole__line--down" aria-hidden="true" />
          <span class="rabbit-hole__marker" aria-hidden="true" />

          <span v-if="row.kind === 'step'" class="rabbit-hole__text">
            <!-- A saved rabbit hole keeps every step a link, the current one marked by its dot. -->
            <span
              v-if="isHere(row.index) && !props.readonly"
              class="rabbit-hole__label"
              aria-current="page"
            >
              {{ row.title }}
            </span>
            <a
              v-else
              class="rabbit-hole__label"
              :aria-current="isHere(row.index) ? 'page' : undefined"
              :href="`#${encodeURIComponent(row.title)}`"
              @click.prevent="emit('revisit', row.index)"
            >
              {{ row.title }}
            </a>
            <span v-if="metaFor(row.title)" class="rabbit-hole__meta">
              {{ metaFor(row.title) }}
            </span>
          </span>
          <!-- Jumped somewhere the current step doesn't link to: a broken line to the way back. -->
          <span v-else-if="row.kind === 'off'" class="rabbit-hole__label">
            <template v-if="props.branching">
              You've veered off the path. When you're ready, select any article above to continue
              from it, or start a new path there.
            </template>
            <template v-else>
              You've veered off the path. When you're ready, select the last article above to
              continue your journey.
            </template>
          </span>
          <!-- Before the first link: an empty next step on the path, waiting to be filled. -->
          <span v-else class="rabbit-hole__label">
            Follow a link in the article to start going deeper.
          </span>
        </li>
      </ol>
      <p v-if="props.steps.length > 1" class="rabbit-hole__depth">
        {{ props.depth }} {{ props.depth === 1 ? 'link' : 'links' }} deep
        <button
          v-if="props.readonly"
          type="button"
          class="rabbit-hole__share"
          aria-label="Share this rabbit hole"
          title="Share this rabbit hole"
          @click="emit('share')"
        >
          <CdxIcon :icon="cdxIconShare" size="small" />
        </button>
      </p>
      <!-- Looking at a saved rabbit hole: start a fresh one of your own from here. -->
      <button
        v-if="props.readonly"
        type="button"
        class="rabbit-hole__start rabbit-hole__start--new"
        @click="emit('start')"
      >
        <CdxIcon :icon="cdxIconPlay" size="small" />
        Start a new rabbit hole
      </button>
    </template>
  </nav>
</template>

<style scoped>
/* Every piece of text here is the Codex "Small" style. */
.rabbit-hole {
  font-family: var(--font-family-system-sans, system-ui, sans-serif);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
  color: var(--color-base);
}

/* Subtle by design: plain small text under the heading, underlined on hover. */
.rabbit-hole__toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-25, 4px);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--color-subtle);
  cursor: pointer;
}

.rabbit-hole__toggle .cdx-icon {
  color: inherit;
}

.rabbit-hole__toggle:hover {
  color: var(--color-base);
  text-decoration: underline;
}

.rabbit-hole__toggle:focus-visible {
  outline: 2px solid var(--color-progressive);
  outline-offset: 2px;
}

/* Heading (and "hide") left, End right, one rule under both. */
.rabbit-hole__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-50, 8px);
  margin: 0 0 var(--spacing-50, 8px);
  padding-block-end: var(--spacing-25, 4px);
  border-block-end: var(--border-width-base, 1px) solid var(--border-color-subtle);
}

.rabbit-hole__heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
  margin: 0;
  font: inherit;
  color: var(--color-subtle);
}

/* Small grey "hide" chip beside the heading, like Vector's sidebar menus. */
.rabbit-hole__hide {
  padding: 0 var(--spacing-50, 8px);
  border: 0;
  border-radius: var(--border-radius-base, 2px);
  background-color: var(--background-color-interactive, #eaecf0);
  font: inherit;
  color: var(--color-base);
  cursor: pointer;
}

.rabbit-hole__hide:hover {
  background-color: var(--background-color-interactive--hover, #dadde3);
}

.rabbit-hole__hide:focus-visible,
.rabbit-hole__start:focus-visible {
  outline: 2px solid var(--color-progressive);
  outline-offset: 2px;
}

/* Not started: "▶ Start your rabbit hole" under the heading. */
.rabbit-hole__start {
  display: flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
  padding: var(--spacing-25, 4px) 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--color-subtle);
  cursor: pointer;
}

.rabbit-hole__start .cdx-icon {
  color: var(--color-base);
}

.rabbit-hole__start--new {
  margin-block-start: var(--spacing-75, 12px);
}

.rabbit-hole__start:hover {
  color: var(--color-base);
  text-decoration: underline;
}

.rabbit-hole__list {
  /* Positioned so each step's offsetTop is measured from the list. */
  position: relative;
  /* How far a sub-path is indented. */
  --rabbit-hole-indent: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rabbit-hole__list--scrolls {
  overflow-y: auto;
  /* Room for the scrollbar so it never sits on top of the text. */
  padding-inline-end: var(--spacing-75, 12px);
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.rabbit-hole__item {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: var(--spacing-50, 8px);
  padding-block: var(--spacing-25, 4px);
}

/*
 * Lines between the markers. Each row draws its own pieces — up to its
 * marker, down from it, an elbow from the line it branched off, and guides
 * for lines passing through — so titles that wrap don't break the line.
 */
.rabbit-hole__item {
  --rabbit-hole-marker-mid: calc(var(--spacing-25, 4px) + 0.7em);
  --rabbit-hole-x: calc(var(--level, 0) * var(--rabbit-hole-indent) + 3px);
  padding-inline-start: calc(var(--level, 0) * var(--rabbit-hole-indent));
}

.rabbit-hole__line,
.rabbit-hole__guide,
.rabbit-hole__elbow {
  position: absolute;
  border-inline-start: var(--border-width-base, 1px) solid var(--border-color-subtle);
}

.rabbit-hole__line {
  inset-inline-start: var(--rabbit-hole-x);
}

.rabbit-hole__line--up {
  inset-block-start: 0;
  block-size: var(--rabbit-hole-marker-mid);
}

.rabbit-hole__line--down {
  inset-block: var(--rabbit-hole-marker-mid) 0;
}

.rabbit-hole__guide {
  inset-block: 0;
  inset-inline-start: calc(var(--at) * var(--rabbit-hole-indent) + 3px);
}

.rabbit-hole__elbow {
  inset-block-start: 0;
  inset-inline-start: calc(var(--rabbit-hole-x) - var(--rabbit-hole-indent));
  inline-size: calc(var(--rabbit-hole-indent) - 3px);
  block-size: var(--rabbit-hole-marker-mid);
  border-block-end: var(--border-width-base, 1px) solid var(--border-color-subtle);
  border-end-start-radius: 6px;
}

/* Markers sit on top of the line so it doesn't show through the hollow dots. */
.rabbit-hole__marker {
  position: relative;
  z-index: 1;
}

.rabbit-hole__marker {
  flex: none;
  inline-size: 7px;
  block-size: 7px;
  border-radius: var(--border-radius-circle, 50%);
  border: var(--border-width-base, 1px) solid var(--border-color-interactive);
  background-color: var(--background-color-base);
  transform: translateY(-1px);
}

/* The waiting next step: hollow dot, quiet text. */
.rabbit-hole__item--next,
.rabbit-hole__item--off {
  color: var(--color-subtle);
}

/* Off the path: the line to the note is broken (dashed). */
.rabbit-hole__item--off .rabbit-hole__line--up {
  border-inline-start-style: dashed;
}

.rabbit-hole__item--current .rabbit-hole__marker {
  border-color: var(--border-color-progressive--active, var(--color-progressive));
  background-color: var(--background-color-progressive, var(--color-progressive));
}

.rabbit-hole__label {
  flex: 1;
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

/* Title with "saved" on its own line beneath it. */
.rabbit-hole__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}

.rabbit-hole__meta {
  /* Deliberately below Codex "Small" — a quiet footnote to the title. */
  font-size: var(--font-size-x-small, 0.75rem);
  line-height: var(--line-height-x-small, 1.25rem);
  color: var(--color-subtle);
}

/* Earlier steps are pages the reader has been to: Wikipedia's visited-link purple. */
a.rabbit-hole__label {
  color: var(--color-visited, #6a60b0);
  text-decoration: none;
}

a.rabbit-hole__label:hover {
  text-decoration: underline;
}

/* A small, quiet icon button beside "N links deep" (saved rabbit holes). */
.rabbit-hole__share {
  display: inline-flex;
  padding: 2px;
  border: 0;
  border-radius: var(--border-radius-base, 2px);
  background: none;
  color: var(--color-subtle);
  cursor: pointer;
}

.rabbit-hole__share:hover {
  color: var(--color-base);
  background-color: var(--background-color-interactive-subtle);
}

.rabbit-hole__share:focus-visible {
  outline: 2px solid var(--color-progressive);
}

.rabbit-hole__share .cdx-icon {
  color: inherit;
}

.rabbit-hole__depth {
  display: flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
  margin: var(--spacing-50, 8px) 0 0;
  color: var(--color-subtle);
}

</style>
