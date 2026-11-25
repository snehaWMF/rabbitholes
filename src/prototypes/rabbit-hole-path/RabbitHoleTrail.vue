<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconPlay, cdxIconShare, cdxIconStop } from '@wikimedia/codex-icons'

interface Props {
  trail: string[]
  current: number
  /** Tracking ended — no trail, just the option to start again. */
  ended: boolean
  /** The reader searched away from the trail; its last article is the way back. */
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
})

const emit = defineEmits<{
  revisit: [index: number]
  share: []
  end: []
  start: []
  hide: []
}>()

/** The step the reader is on — none while they're off the path. */
function isHere(index: number) {
  return index === props.current && !props.offPath
}

/*
 * The list scrolls on its own past MAX_VISIBLE_STEPS articles — or sooner,
 * if even that would push what sits under it (the depth line, "Other
 * readers' paths") past the bottom of the window. Heights are measured, so it
 * adapts to wrapped titles and the screen size; the newest step stays in view.
 */
const MAX_VISIBLE_STEPS = 5
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

watch(() => [props.trail.length, props.ended, props.offPath], fitList)
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
        Your rabbit hole
        <button
          v-if="props.hideable"
          type="button"
          class="rabbit-hole__hide"
          @click="emit('hide')"
        >
          hide
        </button>
      </h2>
      <button v-if="!props.ended" type="button" class="rabbit-hole__toggle" @click="emit('end')">
        <CdxIcon :icon="cdxIconStop" size="small" />
        End
      </button>
    </div>

    <button v-if="props.ended" type="button" class="rabbit-hole__start" @click="emit('start')">
      <CdxIcon :icon="cdxIconPlay" size="small" />
      Start your rabbit hole
    </button>

    <template v-else>
      <ol
        ref="listRef"
        class="rabbit-hole__list"
        :class="{ 'rabbit-hole__list--scrolls': listMaxHeight }"
        :style="{ maxHeight: listMaxHeight }"
      >
        <template v-for="(title, index) in props.trail" :key="`${index}-${title}`">
          <li
            class="rabbit-hole__item"
            :class="{ 'rabbit-hole__item--current': isHere(index) }"
          >
            <span class="rabbit-hole__marker" aria-hidden="true" />
            <span class="rabbit-hole__text">
              <span v-if="isHere(index)" class="rabbit-hole__label" aria-current="page">
                {{ title }}
              </span>
              <a
                v-else
                class="rabbit-hole__label"
                :href="`#${encodeURIComponent(title)}`"
                @click.prevent="emit('revisit', index)"
              >
                {{ title }}
              </a>
              <span v-if="metaFor(title)" class="rabbit-hole__meta">
                {{ metaFor(title) }}
              </span>
            </span>
          </li>
        </template>
        <!-- Searched away: a broken line to a note pointing back to the last article. -->
        <li v-if="props.offPath" class="rabbit-hole__item rabbit-hole__item--off">
          <span class="rabbit-hole__marker" aria-hidden="true" />
          <span class="rabbit-hole__label">
            You've veered off the path. When you're ready, select the last article above to
            continue your journey.
          </span>
        </li>
        <!-- Before the first link: an empty next step on the path, waiting to be filled. -->
        <li
          v-else-if="props.trail.length === 1"
          class="rabbit-hole__item rabbit-hole__item--next"
        >
          <span class="rabbit-hole__marker" aria-hidden="true" />
          <span class="rabbit-hole__label">Follow a link in the article to start going deeper.</span>
        </li>
      </ol>
      <p v-if="props.trail.length > 1" class="rabbit-hole__depth">
        {{ props.trail.length - 1 }} {{ props.trail.length - 1 === 1 ? 'link' : 'links' }} deep
        <button
          type="button"
          class="rabbit-hole__share"
          aria-label="Share your rabbit hole"
          title="Share your rabbit hole"
          @click="emit('share')"
        >
          <CdxIcon :icon="cdxIconShare" size="x-small" />
        </button>
      </p>
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

.rabbit-hole__start:hover {
  color: var(--color-base);
  text-decoration: underline;
}

.rabbit-hole__list {
  /* Positioned so each step's offsetTop is measured from the list. */
  position: relative;
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
 * One straight line down the markers: each item draws its full height, the
 * first starting at its marker and the last stopping at it, so titles that
 * wrap onto two lines don't break the line.
 */
.rabbit-hole__item {
  --rabbit-hole-marker-mid: calc(var(--spacing-25, 4px) + 0.7em);
}

.rabbit-hole__item::before {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: 3px;
  border-inline-start: var(--border-width-base, 1px) solid var(--border-color-subtle);
}

.rabbit-hole__item:first-child::before {
  inset-block-start: var(--rabbit-hole-marker-mid);
}

.rabbit-hole__item:last-child::before {
  inset-block-end: auto;
  block-size: var(--rabbit-hole-marker-mid);
}

.rabbit-hole__item:only-child::before {
  content: none;
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
.rabbit-hole__item--off::before {
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

.rabbit-hole__depth {
  display: flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
  margin: var(--spacing-50, 8px) 0 0;
  color: var(--color-subtle);
}

/* A small, quiet icon button beside "N links deep". */
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
</style>
