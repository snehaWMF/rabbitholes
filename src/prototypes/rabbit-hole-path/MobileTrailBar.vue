<script setup lang="ts">
/**
 * Mobile (Minerva) home for the sidebar: a slim bar pinned to the bottom of
 * the screen that summarises the rabbit hole, and expands into a sheet with
 * the full trail and other readers' paths (passed in the default slot).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconClose, cdxIconCollapse, cdxIconExpand, cdxIconPlay } from '@wikimedia/codex-icons'

import type { Tint } from './imageColor'
import type { ArticlePaths } from './useClickstream'

interface Props {
  /** Colour from the article's main image; without one the bar is the header's grey. */
  tint?: Tint | null
  /** Show the trail summary; when false the bar only leads to other readers' paths. */
  showTrail: boolean
  ended: boolean
  /** Number of steps in the trail (the start article counts as one). */
  steps: number
  /** The article being read. */
  current: string
  /** Other readers' paths for this article; `null` while loading or when hidden. */
  paths?: ArticlePaths | null
  /** The article the reader followed a link from, if any. */
  cameFrom?: string | null
}

const props = withDefaults(defineProps<Props>(), { tint: null, paths: null, cameFrom: null })

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

/*
 * Other readers' paths, shown in the bar itself when the article has them.
 * Closing them shows the rabbit hole row instead, until the next article.
 */
const topIn = computed(() => props.paths?.in?.[0]?.[0] ?? null)
const topOut = computed(() => props.paths?.out?.[0]?.[0] ?? null)
const pathsClosed = ref(false)
watch(
  () => props.current,
  () => (pathsClosed.value = false),
)
const showPathsRow = computed(() => !pathsClosed.value && !!(topIn.value || topOut.value))

const heading = computed(() => (props.showTrail ? 'Your rabbit hole' : "Other readers' paths"))

/** The second line of the bar: where the reader is, or what to do first. */
const summary = computed(() => {
  if (!props.showTrail) return props.current
  if (props.ended) return 'Select Start to see your trail'
  return props.current
})

const depth = computed(() => {
  if (!props.showTrail || props.ended || props.steps <= 1) return null
  const links = props.steps - 1
  return `${links} ${links === 1 ? 'link' : 'links'} deep`
})

/* Keep the end of the page clear of the bar, and stop the page scrolling under the open sheet. */
onMounted(() => document.body.classList.add('has-trail-bar'))
onBeforeUnmount(() => {
  document.body.classList.remove('has-trail-bar', 'trail-sheet-open')
})
watch(open, (value) => document.body.classList.toggle('trail-sheet-open', value))
</script>

<template>
  <Teleport to="body">
    <Transition name="trail-sheet-scrim">
      <div v-if="open" class="trail-sheet-scrim" aria-hidden="true" @click="open = false" />
    </Transition>

    <div
      class="trail-bar"
      :class="{ 'trail-bar--open': open, 'trail-bar--tinted': props.tint && !open }"
      :style="barStyle"
    >
      <!-- Collapsed, with paths: where most readers come from and go next. -->
      <div v-if="!open && showPathsRow" class="trail-bar__paths">
        <div class="trail-bar__paths-text">
          <p v-if="topIn" class="trail-bar__path">
            {{ topIn === props.cameFrom ? 'Like you, most readers come here from' : 'Most readers come here from' }}
            <a
              class="trail-bar__path-link"
              :href="`#${encodeURIComponent(topIn)}`"
              @click.prevent="emit('go', topIn)"
              >{{ topIn }}</a
            >
          </p>
          <p v-if="topOut" class="trail-bar__path">
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

      <!-- Collapsed: one tappable summary row. -->
      <div v-show="!open && !showPathsRow" class="trail-bar__row">
        <button
          type="button"
          class="trail-bar__summary"
          :aria-expanded="open"
          aria-controls="trail-sheet"
          @click="open = true"
        >
          <span class="trail-bar__text">
            <span class="trail-bar__heading">{{ heading }}</span>
            <span class="trail-bar__current">{{ summary }}</span>
          </span>
          <span v-if="depth" class="trail-bar__depth">{{ depth }}</span>
          <CdxIcon class="trail-bar__chevron" :icon="cdxIconCollapse" size="small" />
        </button>
        <button
          v-if="props.showTrail && props.ended"
          type="button"
          class="trail-bar__start"
          @click="emit('start')"
        >
          <CdxIcon :icon="cdxIconPlay" size="small" />
          Start
        </button>
      </div>

      <!-- Expanded: the sheet, with the same modules as the desktop sidebar. -->
      <section
        v-show="open"
        id="trail-sheet"
        class="trail-sheet"
        role="dialog"
        :aria-label="heading"
      >
        <div class="trail-sheet__top">
          <span class="trail-sheet__handle" aria-hidden="true" />
          <button
            type="button"
            class="trail-sheet__close"
            aria-label="Collapse"
            title="Collapse"
            @click="open = false"
          >
            <CdxIcon :icon="cdxIconExpand" size="small" />
          </button>
        </div>
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
.trail-bar--tinted .trail-bar__depth,
.trail-bar--tinted .trail-bar__chevron,
.trail-bar--tinted .trail-bar__start {
  color: inherit;
}

.trail-bar--tinted .trail-bar__heading,
.trail-bar--tinted .trail-bar__depth {
  opacity: 0.85;
}

/* Paths row: larger, body-size text on the bar's colour, links underlined in the same colour. */
.trail-bar__paths {
  display: flex;
  align-items: center;
  gap: var(--spacing-75, 12px);
  padding: var(--spacing-100, 16px) var(--spacing-50, 8px) var(--spacing-100, 16px)
    var(--spacing-150, 24px);
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-medium, 1.625rem);
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

.trail-bar__current {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: var(--font-weight-bold);
}

.trail-bar__depth {
  flex: none;
  color: var(--color-subtle);
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
.trail-sheet__close:focus-visible {
  outline: 2px solid var(--color-progressive);
  outline-offset: -2px;
}

.trail-sheet {
  display: flex;
  flex-direction: column;
  max-block-size: 75vh;
  max-block-size: 75dvh;
}

.trail-sheet__top {
  position: relative;
  display: flex;
  justify-content: flex-end;
  min-block-size: 2.75rem;
}

.trail-sheet__handle {
  position: absolute;
  inset-block-start: var(--spacing-50, 8px);
  inset-inline-start: 50%;
  inline-size: 2.25rem;
  block-size: 4px;
  border-radius: var(--border-radius-pill, 9999px);
  background-color: var(--border-color-subtle);
  transform: translateX(-50%);
}

.trail-sheet__close {
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  border: 0;
  background: none;
  color: var(--color-subtle);
  cursor: pointer;
}

.trail-sheet__close .cdx-icon {
  color: inherit;
}

.trail-sheet__body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 var(--spacing-100, 16px) var(--spacing-150, 24px);
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
