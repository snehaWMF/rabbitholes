<script setup lang="ts">
definePage({
  meta: {
    // title + description: ask the author, or omit
    category: 'prototype',
    platform: 'web',
  },
})

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { CdxButton, CdxDialog, CdxToastContainer, useToast } from '@wikimedia/codex'

import ArticleLive from '@/components/article/ArticleLive.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import { provideChromeSearchHandlers } from '@/composables/useChromeSearch'
import { useConfig } from '@/composables/useConfig'
import {
  collectionArticles,
  createCollection,
  removePageFromCollection,
  savePagesToCollection,
} from './collections'
import CommonPaths from './CommonPaths.vue'
import PrototypeSettings from './PrototypeSettings.vue'
import RabbitHoleTrail from './RabbitHoleTrail.vue'
import TableOfContents, { type TocSection } from './TableOfContents.vue'
import { formatDuration } from './formatDuration'
import { useClickstream } from './useClickstream'
import { useRabbitHole } from './useRabbitHole'

const START_ARTICLE = "Alice's Adventures in Wonderland"

const { user } = useConfig()
/** The trail is a logged-in reader feature. */
const isLoggedIn = computed(() => user.value !== 'logged-out')

/* Prototype settings: show or hide each sidebar module. Both show on every load. */
const showTrail = ref(true)
const showPaths = ref(true)

/*
 * ── Each article has its own address ──
 * `?article=Queen_Victoria` (Wikipedia-style underscores), so browser Back /
 * Forward step through what the reader opened. No `article` → Alice.
 */
const route = useRoute()
const router = useRouter()

function titleFromQuery(): string | null {
  const value = route.query.article
  const raw = Array.isArray(value) ? value[0] : value
  return raw ? raw.replace(/_/g, ' ') : null
}

const { trail, times, idles, current, ended, article, follow, end, start } = useRabbitHole(
  titleFromQuery() ?? START_ARTICLE,
)

const { paths } = useClickstream(article)
/** The step before this one in the reader's own trail, to compare with everyone else's. */
const cameFrom = computed(() =>
  !ended.value && current.value > 0 ? trail.value[current.value - 1] : null,
)

provideChromeSearchHandlers({
  onSelect(title) {
    goTo(title)
  },
  onSubmit({ title }) {
    if (title) goTo(title)
  },
})

/** Open an article in the prototype: trail step, new history entry, back to the top. */
function goTo(title: string) {
  follow(title)
  window.scrollTo({ top: 0 })
  if (titleFromQuery() !== title) {
    void router.push({ query: { ...route.query, article: title.replace(/ /g, '_') } })
  }
}

/*
 * Back / Forward change the address without going through `goTo`. Treat the
 * article they land on like any other move: it goes on the end of the trail.
 */
watch(
  () => route.query.article,
  () => {
    const title = titleFromQuery() ?? START_ARTICLE
    if (title === article.value) return
    follow(title)
    window.scrollTo({ top: 0 })
  },
)

/*
 * ── Stopping: warn first, offer to keep the hole ──
 * Ending clears the trail, so once the reader has followed at least one
 * link they're asked first, with the option to save the session to their
 * saved items or share it on the way out.
 */
const stopDialogOpen = ref(false)

/** Distinct pages in the trail, in the order first visited. */
const trailPages = computed(() => [...new Set(trail.value)])

function requestStop() {
  if (trail.value.length <= 1) {
    end()
    return
  }
  stopDialogOpen.value = true
}

function stopAndLose() {
  stopDialogOpen.value = false
  end()
}

function saveSession() {
  createCollection(`${trail.value[0]} rabbit hole`, trailPages.value)
  stopDialogOpen.value = false
  end()
}

/** Share the trail (share sheet, or copied as a list); `false` if the reader cancelled. */
async function shareTrail(): Promise<boolean> {
  const steps = trail.value.map((t, i) => {
    const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`
    const spent = times.value[i] > 0 ? ` (spent ${formatDuration(times.value[i])})` : ''
    return `${i + 1}. ${t}${spent} — ${url}`
  })
  const text = `My Wikipedia rabbit hole:\n${steps.join('\n')}`
  try {
    if (navigator.share) await navigator.share({ title: 'My Wikipedia rabbit hole', text })
    else await navigator.clipboard.writeText(text)
  } catch (err) {
    // Closing the share sheet counts as changing your mind.
    if (err instanceof DOMException && err.name === 'AbortError') return false
  }
  return true
}

async function shareAndStop() {
  if (!(await shareTrail())) return
  stopDialogOpen.value = false
  end()
}

/** The share icon by the trail: share without ending anything (no confirmation). */
function shareNow() {
  void shareTrail()
}

/*
 * ── Saved items ──
 * The toolbar's bookmark saves the page being read (and fills in); pressing
 * it again takes it back out. Saved pages are marked in the trail.
 */
const toast = useToast()
const savedArticles = ref<string[]>(collectionArticles())
const isSaved = computed(() => savedArticles.value.includes(article.value))

function onSave() {
  const title = article.value
  if (isSaved.value) {
    removePageFromCollection(title)
    toast.info(`${title} is removed from your saved items`, { autoDismiss: true })
  } else {
    savePagesToCollection([title])
    toast.success(`${title} is saved to your saved items`, { autoDismiss: true })
  }
  savedArticles.value = collectionArticles()
}

/** Picking an earlier step reopens it as the next link in the chain. */
function revisit(index: number) {
  goTo(trail.value[index])
}

/* ── Table of contents: the article's h2 sections, with the one in view marked ── */
const tocSections = ref<TocSection[]>([])
const activeSection = ref<string | null>(null)
let sectionObserver: IntersectionObserver | null = null

function onParserReady(root: HTMLElement) {
  const headings = [...root.querySelectorAll<HTMLElement>('h2[id]')]
  tocSections.value = headings.map((h) => ({ id: h.id, text: h.textContent?.trim() ?? '' }))
  activeSection.value = null

  sectionObserver?.disconnect()
  sectionObserver = new IntersectionObserver(
    () => {
      // Active = last heading scrolled past the top third of the viewport.
      const line = window.innerHeight / 3
      let active: string | null = null
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= line) active = h.id
      }
      activeSection.value = active
    },
    { rootMargin: '0px 0px -66% 0px' },
  )
  headings.forEach((h) => sectionObserver?.observe(h))
  alignRails()
}

onBeforeUnmount(() => sectionObserver?.disconnect())

/*
 * ── Rails line up with the article toolbar ──
 * Vector drops the side rails so their first heading rule continues the
 * Article/Talk toolbar's bottom rule. The title can wrap, so measure rather
 * than hard-code: push the rails down by however far apart the two rules are.
 */
const layoutRef = ref<HTMLElement | null>(null)
const railOffset = ref(0)
let headerObserver: ResizeObserver | null = null

function alignRails() {
  const layout = layoutRef.value
  const toolbar = layout?.querySelector('.article-header__toolbar')
  const heading = [
    ...(layout?.querySelectorAll('.toc__heading, .rabbit-hole__header, .common-paths__heading') ??
      []),
  ].find((h) => (h as HTMLElement).offsetParent !== null)
  if (!toolbar || !heading) return
  const delta = toolbar.getBoundingClientRect().bottom - heading.getBoundingClientRect().bottom
  railOffset.value = Math.max(0, railOffset.value + delta)
}

onMounted(() => {
  headerObserver = new ResizeObserver(() => alignRails())
  // Observe the whole layout: the header appears, the title wraps, rails reflow.
  if (layoutRef.value) headerObserver.observe(layoutRef.value)
  window.addEventListener('resize', alignRails)
  alignRails()
})

onBeforeUnmount(() => {
  headerObserver?.disconnect()
  window.removeEventListener('resize', alignRails)
})

/** Namespaced pages (File:, Help:, …) aren't articles — let those links be. */
const NON_ARTICLE_NAMESPACE =
  /^(File|Image|Category|Help|Wikipedia|WP|Template|Portal|Special|Talk|User|Draft|Module|MediaWiki|Media)( talk)?:/i

/** Parsoid article links look like `./Title_with_underscores#Section`. */
function articleTitleFromLink(link: HTMLAnchorElement): string | null {
  const rel = link.getAttribute('rel') ?? ''
  const href = link.getAttribute('href') ?? ''
  if (!rel.split(/\s+/).includes('mw:WikiLink') || !href.startsWith('./')) return null
  if (link.classList.contains('new')) return null // red link

  const path = href.slice(2).split(/[?#]/)[0]
  const title = decodeURIComponent(path).replace(/_/g, ' ').trim()
  if (!title || NON_ARTICLE_NAMESPACE.test(title)) return null
  return title
}

function onArticleClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = (event.target as HTMLElement).closest('a')
  if (!link) return
  const title = articleTitleFromLink(link)
  if (!title) return
  event.preventDefault()
  goTo(title)
}
</script>

<template>
  <ChromeWrapper username="Username">
    <div
      ref="layoutRef"
      class="rabbit-holes"
      :style="{ '--rabbit-holes-rail-offset': `${railOffset}px` }"
    >
      <aside class="rabbit-holes__toc">
        <div class="rabbit-holes__rail">
          <TableOfContents :sections="tocSections" :active="activeSection" />
        </div>
      </aside>

      <div class="rabbit-holes__article" @click="onArticleClick">
        <ArticleLive
          :article="article"
          tools-menu
          reader-toolbar
          :saved="isSaved"
          @parser-ready="onParserReady"
          @save-click="onSave"
        />
      </div>

      <aside class="rabbit-holes__aside">
        <div v-if="isLoggedIn" class="rabbit-holes__rail">
          <RabbitHoleTrail
            v-if="showTrail"
            :trail="trail"
            :times="times"
            :idles="idles"
            :current="current"
            :ended="ended"
            @revisit="revisit"
            :saved="savedArticles"
            @end="requestStop"
            @share="shareNow"
            @start="start"
          />
          <CommonPaths v-if="showPaths" :paths="paths" :came-from="cameFrom" @go="goTo" />
        </div>
      </aside>
    </div>

    <CdxToastContainer />

    <PrototypeSettings v-model:show-trail="showTrail" v-model:show-paths="showPaths" />

    <CdxDialog
      v-model:open="stopDialogOpen"
      title="End this session?"
      use-close-button
      close-button-label="Continue session"
      class="rabbit-holes__stop-dialog"
    >
      <p class="rabbit-holes__stop-body">
        Your rabbit hole of {{ trailPages.length }} pages will be lost when you end it. Save this
        session or share it before you go.
      </p>

      <template #footer>
        <div class="rabbit-holes__stop-actions">
          <CdxButton action="progressive" weight="primary" @click="saveSession">
            Save session
          </CdxButton>
          <CdxButton @click="shareAndStop">Share</CdxButton>
          <CdxButton @click="stopDialogOpen = false">Continue session</CdxButton>
          <CdxButton action="destructive" weight="quiet" @click="stopAndLose">
            End session
          </CdxButton>
        </div>
      </template>
    </CdxDialog>
  </ChromeWrapper>
</template>

<style scoped>
/*
 * Vector 2022 layout: contents on the left, the article centred, and the
 * right rail (normally Tools — here the rabbit hole; Tools moves to the ⋮
 * menu in the article toolbar).
 */
.rabbit-holes {
  --rabbit-holes-rail: 15.5rem;
  display: block;
}

.rabbit-holes__article {
  min-width: 0;
}

[data-skin='desktop'] .rabbit-holes {
  display: grid;
  grid-template-columns: var(--rabbit-holes-rail) minmax(0, 1fr) var(--rabbit-holes-rail);
  gap: var(--spacing-150, 24px);
  max-width: 1596px;
  margin-inline: auto;
  padding-inline: var(--spacing-150, 24px);
}

/* Measured in the script so the rails' first rule meets the toolbar's. */
[data-skin='desktop'] .rabbit-holes__toc,
[data-skin='desktop'] .rabbit-holes__aside {
  padding-block-start: var(--rabbit-holes-rail-offset, var(--spacing-150, 24px));
}

[data-skin='desktop'] .rabbit-holes__rail {
  position: sticky;
  top: var(--spacing-150, 24px);
  max-height: calc(100vh - 2 * var(--spacing-150, 24px));
  overflow-y: auto;
}

/* Narrower desktop: Vector folds the contents away first… */
@media (max-width: 1199px) {
  [data-skin='desktop'] .rabbit-holes {
    grid-template-columns: minmax(0, 1fr) var(--rabbit-holes-rail);
    padding-inline-start: 0;
  }

  [data-skin='desktop'] .rabbit-holes__toc {
    display: none;
  }
}

/* …then the right rail drops below the article. */
@media (max-width: 999px) {
  [data-skin='desktop'] .rabbit-holes {
    grid-template-columns: minmax(0, 1fr);
    padding-inline: 0;
  }

  [data-skin='desktop'] .rabbit-holes__aside {
    padding: var(--spacing-100, 16px);
  }

  [data-skin='desktop'] .rabbit-holes__rail {
    position: static;
    max-height: none;
  }
}

/* Three choices, stacked full-width — the safe ones first. */
.rabbit-holes__stop-body {
  margin: 0;
}

.rabbit-holes__stop-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-75, 12px);
  width: 100%;
}

.rabbit-holes__stop-actions .cdx-button {
  max-width: none;
  width: 100%;
}

/* Mobile skin: no contents rail; the trail follows the article. */
[data-skin='mobile'] .rabbit-holes__toc {
  display: none;
}

[data-skin='mobile'] .rabbit-holes__aside {
  padding: var(--spacing-100, 16px);
  border-block-start: var(--border-width-base, 1px) solid var(--border-color-subtle);
}
</style>

<style>
/*
 * Toasts (teleported to <body>, so unscoped): small, in the top-right corner
 * just under the header, instead of Codex's full-width bottom-centre stack.
 */
.cdx-toast-container {
  inset: 3.75rem var(--spacing-100, 16px) auto auto;
  width: auto;
}

.cdx-toast-container__stack {
  flex-direction: column;
  align-items: flex-end;
  width: auto;
}

/* Codex centres each toast with translate(-50%); in the corner it shouldn't move. */
.cdx-toast-container .cdx-toast {
  width: auto;
  max-width: 20rem;
  transform: none;
}

.cdx-toast-container .cdx-toast.cdx-toast-enter-from,
.cdx-toast-container .cdx-toast.cdx-toast-leave-to {
  transform: translateY(-8px);
}

.cdx-toast-container .cdx-toast.cdx-toast-leave-active-system.cdx-toast-leave-to,
.cdx-toast-container .cdx-toast.cdx-toast-leave-active-user.cdx-toast-leave-to {
  transform: translateY(-8px);
}

.cdx-toast-container .cdx-toast__message {
  padding-block: var(--spacing-50, 8px);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}
</style>
