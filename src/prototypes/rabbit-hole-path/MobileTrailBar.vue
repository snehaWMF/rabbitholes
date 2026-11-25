<script setup lang="ts">
/**
 * Mobile (Minerva) bar pinned to the bottom of the screen. Each feature has
 * its own version for now (a combined one isn't designed yet):
 * - `trail`: the rabbit hole's state, expanding into a sheet with the full
 *   trail (passed in the default slot);
 * - `paths`: where most readers come from and go next, with a close button.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconClose, cdxIconCollapse, cdxIconPlay } from '@wikimedia/codex-icons'

import type { Tint } from './imageColor'
import type { ArticlePaths } from './useClickstream'

interface Props {
  /** Colour from the article's main image; without one the bar is the header's grey. */
  tint?: Tint | null
  /** Which feature's bar to show. */
  mode: 'trail' | 'paths'
  ended: boolean
  /** The reader jumped to a page the last step doesn't link to. */
  offPath?: boolean
  /** Number of steps in the trail (the start article counts as one). */
  steps: number
  /** The article being read. */
  current: string
  /** Other readers' paths for this article; `null` while loading or when hidden. */
  paths?: ArticlePaths | null
  /** The article the reader followed a link from, if any. */
  cameFrom?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  tint: null,
  paths: null,
  cameFrom: null,
  offPath: false,
})

/* Only the collapsed bar takes the colour; the open sheet stays plain for reading. */
const barStyle = computed(() =>
  props.tint && !open.value
    ? {
        '--trail-bar-background': props.tint.background,
        '--trail-bar-color': props.tint.dark ? '#fff' : 'var(--color-base)',
      }
    : undefined,
)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ start: []; go: [title: string] }>()

/* Other readers' paths. Closing them hides the bar until the next article. */
const topOut = computed(() => props.paths?.out?.[0]?.[0] ?? null)
const pathsClosed = ref(false)
watch(
  () => props.current,
  () => (pathsClosed.value = false),
)
/* `null` paths means still loading: show nothing rather than a flash of "no path". */
const showPathsBar = computed(
  () => props.mode === 'paths' && !pathsClosed.value && props.paths !== null,
)
const visible = computed(() => props.mode === 'trail' || showPathsBar.value)

/*
 * The second line of the bar. For the rabbit hole it follows the reader:
 * not started → what Start does; started → what to do next; going → how deep.
 */
const summary = computed(() => {
  if (props.ended) return 'Select Start to see your trail'
  if (props.offPath) return "You've veered off the path"
  if (props.steps <= 1) return 'Follow a link in the article to start going deeper'
  const links = props.steps - 1
  return `${links} ${links === 1 ? 'link' : 'links'} deep`
})

/* Before Start there's no trail to open, so the bar offers only Start. */
const canOpen = computed(() => !props.ended)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) open.value = false
}

/* Keep the end of the page clear of the bar, and stop the page scrolling under the open sheet. */
onMounted(() => window.addEventListener('keydown', onKeydown))
watch(visible, (value) => document.body.classList.toggle('has-trail-bar', value), {
  immediate: true,
})
/*
 * Publish the collapsed bar's height as --trail-bar-height on <html>, so
 * things like toasts can sit just above it (the paths bar is taller).
 */
const barEl = ref<HTMLElement | null>(null)
let barObserver: ResizeObserver | null = null
function publishBarHeight() {
  const el = barEl.value
  const root = document.documentElement.style
  if (!el) root.removeProperty('--trail-bar-height')
  else if (!open.value) root.setProperty('--trail-bar-height', `${el.offsetHeight}px`)
}
watch(barEl, (el) => {
  barObserver?.disconnect()
  publishBarHeight()
  if (!el) return
  barObserver = new ResizeObserver(publishBarHeight)
  barObserver.observe(el)
})
// Back to the collapsed bar (after the sheet, or a different version): measure again.
watch([open, () => props.mode, () => props.ended, () => props.steps], () =>
  nextTick(publishBarHeight),
)

onBeforeUnmount(() => {
  document.body.classList.remove('has-trail-bar', 'trail-sheet-open')
  window.removeEventListener('keydown', onKeydown)
  barObserver?.disconnect()
  document.documentElement.style.removeProperty('--trail-bar-height')
})
watch(open, (value) => document.body.classList.toggle('trail-sheet-open', value))
</script>

<template>
  <Teleport to="body">
    <Transition name="trail-sheet-scrim">
      <div v-if="open" class="trail-sheet-scrim" aria-hidden="true" @click="open = false" />
    </Transition>

    <div
      v-if="visible"
      ref="barEl"
      class="trail-bar"
      :class="{ 'trail-bar--open': open, 'trail-bar--tinted': props.tint && !open }"
      :style="barStyle"
    >
      <!-- Other readers' paths: one line, where most readers go next. -->
      <div v-if="showPathsBar" class="trail-bar__paths">
        <div class="trail-bar__paths-text">
          <p v-if="!topOut" class="trail-bar__path">No popular path found for this article.</p>
          <p v-else class="trail-bar__path">
            Most readers go next to
            <a
              class="trail-bar__path-link"
              :href="`#${encodeURIComponent(topOut)}`"
              @click.prevent="emit('go', topOut)"
              >{{ topOut }}</a
            >
          </p>
        </div>
        <button
          type="button"
          class="trail-bar__paths-close"
          aria-label="Close"
          title="Close"
          @click="pathsClosed = true"
        >
          <CdxIcon :icon="cdxIconClose" />
        </button>
      </div>

      <!-- Rabbit hole, collapsed: one tappable summary row. -->
      <div v-if="props.mode === 'trail'" v-show="!open" class="trail-bar__row">
        <button
          v-if="canOpen"
          type="button"
          class="trail-bar__summary"
          :aria-expanded="open"
          aria-controls="trail-sheet"
          @click="open = true"
        >
          <span class="trail-bar__text">
            <span class="trail-bar__heading">Your rabbit hole</span>
            <span class="trail-bar__current">{{ summary }}</span>
          </span>
          <CdxIcon class="trail-bar__chevron" :icon="cdxIconCollapse" size="small" />
        </button>
        <div v-else class="trail-bar__summary trail-bar__summary--static">
          <span class="trail-bar__text">
            <span class="trail-bar__heading">Your rabbit hole</span>
            <span class="trail-bar__current">{{ summary }}</span>
          </span>
        </div>
        <button
          v-if="props.ended"
          type="button"
          class="trail-bar__start"
          @click="emit('start')"
        >
          <CdxIcon :icon="cdxIconPlay" size="small" />
          Start
        </button>
      </div>

      <!-- Rabbit hole, expanded: the sheet with the full trail. -->
      <section
        v-if="props.mode === 'trail'"
        v-show="open"
        id="trail-sheet"
        class="trail-sheet"
        role="dialog"
        aria-label="Your rabbit hole"
      >
        <!-- Just a grab handle; tapping it (or outside the sheet, or Escape) collapses. -->
        <button
          type="button"
          class="trail-sheet__top"
          aria-label="Collapse"
          title="Collapse"
          @click="open = false"
        >
          <span class="trail-sheet__handle" aria-hidden="true" />
        </button>
        <div class="trail-sheet__body">
          <slot />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.trail-bar {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 90;
  padding-block-end: env(safe-area-inset-bottom, 0px);
  border-block-start: var(--border-width-base, 1px) solid var(--border-color-subtle);
  /* Collapsed: the image's colour when there is one, otherwise the header's grey. */
  background-color: var(--trail-bar-background, var(--background-color-interactive, #eaecf0));
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
  font-family: var(--font-family-system-sans, system-ui, sans-serif);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--trail-bar-color, var(--color-base));
  transition: background-color 200ms ease;
}

.trail-bar--open {
  border-start-start-radius: var(--border-radius-base, 2px);
  border-start-end-radius: var(--border-radius-base, 2px);
  background-color: var(--background-color-base);
}

/* On an image colour, the quiet text and Start take the bar's text colour so they stay readable. */
.trail-bar--tinted {
  border-block-start-color: transparent;
}

.trail-bar--tinted .trail-bar__heading,
.trail-bar--tinted .trail-bar__chevron,
.trail-bar--tinted .trail-bar__start {
  color: inherit;
}

.trail-bar--tinted .trail-bar__heading {
  opacity: 0.85;
}

/* Paths row: one slim line of small text on the bar's colour, the link underlined in the same colour. */
.trail-bar__paths {
  display: flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
  padding: var(--spacing-25, 4px) var(--spacing-25, 4px) var(--spacing-25, 4px)
    var(--spacing-100, 16px);
}

.trail-bar__paths-text {
  flex: 1;
  min-inline-size: 0;
}

.trail-bar__path {
  margin: 0;
}

.trail-bar__path-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.trail-bar__paths-close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}

.trail-bar__paths-close .cdx-icon {
  color: inherit;
}

.trail-bar__path-link:focus-visible,
.trail-bar__paths-close:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.trail-bar__row {
  display: flex;
  align-items: center;
  min-block-size: 3.5rem;
}

.trail-bar__summary {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-75, 12px);
  min-inline-size: 0;
  padding: var(--spacing-50, 8px) var(--spacing-100, 16px);
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: start;
  cursor: pointer;
}

.trail-bar__summary--static {
  cursor: default;
}

.trail-bar__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}

.trail-bar__heading {
  font-size: var(--font-size-x-small, 0.75rem);
  line-height: var(--line-height-x-small, 1.25rem);
  color: var(--color-subtle);
}

/* Up to two lines, so "Follow a link…" fits on a phone; longer gets an ellipsis. */
.trail-bar__current {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-weight: var(--font-weight-bold);
}


.trail-bar__chevron {
  flex: none;
  color: var(--color-subtle);
}

.trail-bar__start {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-25, 4px);
  margin-inline-end: var(--spacing-50, 8px);
  padding: var(--spacing-50, 8px);
  border: 0;
  border-radius: var(--border-radius-base, 2px);
  background: none;
  font: inherit;
  color: var(--color-progressive);
  cursor: pointer;
}

.trail-bar__start .cdx-icon {
  color: inherit;
}

.trail-bar__summary:focus-visible,
.trail-bar__start:focus-visible,
.trail-sheet__top:focus-visible {
  outline: 2px solid var(--color-progressive);
  outline-offset: -2px;
}

.trail-sheet {
  display: flex;
  flex-direction: column;
  max-block-size: 75vh;
  max-block-size: 75dvh;
}

/* A slim grab strip across the top of the sheet. */
.trail-sheet__top {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  block-size: var(--spacing-150, 24px);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.trail-sheet__handle {
  inline-size: 2.25rem;
  block-size: 4px;
  border-radius: var(--border-radius-pill, 9999px);
  background-color: var(--border-color-subtle);
}

.trail-sheet__body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--spacing-50, 8px) var(--spacing-100, 16px) var(--spacing-150, 24px);
}

/* In the sheet the trail reads at body size, with a full-strength heading. */
.trail-sheet__body :deep(.rabbit-hole) {
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-medium, 1.625rem);
}

.trail-sheet__body :deep(.rabbit-hole__heading) {
  color: var(--color-base);
}

.trail-sheet__body :deep(.rabbit-hole__header) {
  padding-block-end: var(--spacing-50, 8px);
}

.trail-sheet__body :deep(.rabbit-hole__meta) {
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}

.trail-sheet__body :deep(.rabbit-hole__item) {
  padding-block: var(--spacing-50, 8px);
  --rabbit-hole-marker-mid: calc(var(--spacing-50, 8px) + 0.8em);
}

.trail-sheet-scrim {
  position: fixed;
  inset: 0;
  z-index: 89;
  background-color: var(--background-color-backdrop-light, rgba(255, 255, 255, 0.65));
}

.trail-sheet-scrim-enter-active,
.trail-sheet-scrim-leave-active {
  transition: opacity 150ms ease;
}

.trail-sheet-scrim-enter-from,
.trail-sheet-scrim-leave-to {
  opacity: 0;
}
</style>

<style>
/* The bar is fixed over the page: keep the article's end (and the footer) clear of it. */
body.has-trail-bar {
  padding-block-end: calc(3.5rem + env(safe-area-inset-bottom, 0px));
}

body.trail-sheet-open {
  overflow: hidden;
}
</style>
