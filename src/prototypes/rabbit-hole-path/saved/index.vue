<script setup lang="ts">
/**
 * The reader's saved items, as on Wikipedia: pages they saved and rabbit
 * holes they kept, most recent first. Desktop shows a grid of cards; mobile
 * a list. A rabbit hole's card shows its first and last articles (with a
 * picture of each) and how deep it went; selecting it shows the whole path.
 * Reached from the header's saved icon, or "View" on the toast after saving.
 */
import { computed, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CdxIcon } from '@wikimedia/codex'
import { cdxIconLock, cdxIconMapTrail } from '@wikimedia/codex-icons'

import ChromeHeader from '@/components/chrome/ChromeHeader.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import type { ChromeNavTool } from '@/components/chrome/headerNavTools'
import SpecialPageWrapper from '@/components/SpecialPageWrapper.vue'

import { articleSummary } from '../articleSummary'
import { loadCollections, SAVED_PAGES_COLLECTION } from '../collections'
import { useAlwaysLoggedIn } from '../useLoggedIn'

const USERNAME = 'Username'
const NAV_TOOLS: ChromeNavTool[] = ['appearance', 'notifications', 'notices', 'bookmarks', 'user']

useAlwaysLoggedIn()

const route = useRoute()
const router = useRouter()

interface PageItem {
  kind: 'page'
  key: string
  title: string
  date: string
}

interface HoleItem {
  kind: 'hole'
  key: string
  first: string
  last: string
  links: number
  articles: string[]
  date: string
}

type Item = PageItem | HoleItem

/** Everything saved, most recent first. */
const items = computed<Item[]>(() => {
  const out: Item[] = []
  for (const c of loadCollections()) {
    if (!c.articles.length) continue
    if (c.name === SAVED_PAGES_COLLECTION) {
      for (const title of c.articles) {
        out.push({ kind: 'page', key: `page-${title}`, title, date: c.savedAt?.[title] ?? c.createdAt })
      }
    } else {
      out.push({
        kind: 'hole',
        key: `hole-${c.createdAt}`,
        first: c.articles[0],
        last: c.articles[c.articles.length - 1],
        links: c.links ?? c.articles.length - 1,
        articles: c.articles,
        date: c.createdAt,
      })
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
})

const shown = items

/** The rabbit hole just saved (`?saved=<createdAt>`): marked, and scrolled to. */
const justSaved = typeof route.query.saved === 'string' ? `hole-${route.query.saved}` : null

onMounted(async () => {
  await nextTick()
  if (justSaved) document.getElementById(justSaved)?.scrollIntoView({ block: 'center' })
})

function linksDeep(links: number) {
  return `Rabbit hole · ${links} ${links === 1 ? 'link' : 'links'} deep`
}

/** A rabbit hole's pictures: its first and last articles' (whichever exist). */
function holeImages(item: HoleItem) {
  const titles = item.first === item.last ? [item.first] : [item.first, item.last]
  return titles.map((t) => articleSummary(t)?.thumbnail).filter((src): src is string => !!src)
}

function open(title: string) {
  void router.push({ path: '/rabbit-hole-path', query: { article: title.replace(/ /g, '_') } })
}

/* A rabbit hole opens at its first article, with its path in the sidebar ("Saved rabbit hole"). */
function select(item: Item) {
  if (item.kind === 'page') open(item.title)
  else
    void router.push({
      path: '/rabbit-hole-path',
      query: { article: item.first.replace(/ /g, '_'), hole: item.key.replace(/^hole-/, '') },
    })
}
</script>

<template>
  <ChromeWrapper :username="USERNAME" :last-edited-notice="false">
    <template #header>
      <ChromeHeader
        :username="USERNAME"
        :nav-tools="NAV_TOOLS"
        @bookmarks-click="router.push('/rabbit-hole-path/saved')"
      />
    </template>

    <SpecialPageWrapper help>
      <template #title>
        <span class="saved__title">
          Saved
          <CdxIcon :icon="cdxIconLock" size="small" class="saved__lock" />
        </span>
      </template>

      <!-- "Collections" is a placeholder in this prototype: shown, not clickable. -->
      <div class="saved__tabs">
        <span class="saved__tab saved__tab--current">All items</span>
        <span class="saved__tab">Collections</span>
      </div>

      <p class="saved__sort">Sorted by most recent</p>

      <p v-if="!shown.length" class="saved__empty">
        Nothing saved yet. Save a rabbit hole when you end it, or save a page with the bookmark
        icon.
      </p>

      <ul class="saved__items">
        <li v-for="item in shown" :id="item.key" :key="item.key">
          <button
            type="button"
            class="saved__card"
            :class="{ 'saved__card--new': item.key === justSaved }"
            @click="select(item)"
          >
            <!-- Pictures: a saved page's lead image; a rabbit hole's first and last, side by side. -->
            <!-- A rabbit hole always gets the picture box, marked with the trail icon. -->
            <span
              v-if="item.kind === 'hole' || articleSummary(item.title)?.thumbnail"
              class="saved__image"
              :class="{ 'saved__image--pair': item.kind === 'hole' && holeImages(item).length > 1 }"
            >
              <template v-if="item.kind === 'hole'">
                <img v-for="src in holeImages(item)" :key="src" :src="src" alt="" />
                <span class="saved__badge" title="Rabbit hole">
                  <CdxIcon :icon="cdxIconMapTrail" size="small" />
                </span>
              </template>
              <img v-else :src="articleSummary(item.title)?.thumbnail ?? ''" alt="" />
            </span>

            <span class="saved__text">
              <template v-if="item.kind === 'hole'">
                <span class="saved__name">
                  {{ item.first }}<template v-if="item.last !== item.first"> → {{ item.last }}</template>
                </span>
                <span class="saved__desc">{{ linksDeep(item.links) }}</span>
              </template>
              <template v-else>
                <span class="saved__name">{{ item.title }}</span>
                <span class="saved__desc">{{ articleSummary(item.title)?.description }}</span>
              </template>
            </span>
          </button>
        </li>
      </ul>
    </SpecialPageWrapper>

  </ChromeWrapper>
</template>

<style scoped>
.saved__title {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
}

.saved__lock {
  color: var(--color-subtle);
}

.saved__tabs {
  display: flex;
  gap: var(--spacing-150, 24px);
  margin-block: var(--spacing-100, 16px) var(--spacing-150, 24px);
  font-family: var(--font-family-system-sans, system-ui, sans-serif);
}

.saved__tab {
  font-weight: var(--font-weight-bold);
  color: var(--color-progressive);
}

.saved__tab--current {
  color: var(--color-base);
}

.saved__sort {
  margin: 0 0 var(--spacing-50, 8px);
  font-size: var(--font-size-x-small, 0.75rem);
  color: var(--color-base);
}

.saved__empty {
  color: var(--color-subtle);
}

/* Desktop: a grid of cards. */
.saved__items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 12rem));
  gap: var(--spacing-100, 16px);
  margin: 0;
  padding: 0;
  list-style: none;
}

.saved__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-75, 12px);
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 16rem;
  padding: var(--spacing-75, 12px);
  border: var(--border-width-base, 1px) solid var(--border-color-subtle, #c8ccd1);
  border-radius: var(--border-radius-base, 2px);
  background: var(--background-color-base, #fff);
  font: inherit;
  font-family: var(--font-family-system-sans, system-ui, sans-serif);
  text-align: start;
  color: var(--color-base);
  cursor: pointer;
}

.saved__card:hover {
  border-color: var(--border-color-interactive, #a2a9b1);
}

.saved__card:focus-visible {
  outline: 2px solid var(--color-progressive);
  outline-offset: 1px;
}

/* The rabbit hole just saved: a progressive edge so it's easy to spot. */
.saved__card--new {
  border-color: var(--border-color-progressive, #36c);
  box-shadow: inset 0 0 0 1px var(--border-color-progressive, #36c);
}

.saved__image {
  position: relative;
  display: flex;
  gap: 2px;
  aspect-ratio: 1 / 0.95;
  overflow: hidden;
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
}

.saved__image img {
  flex: 1;
  min-inline-size: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.saved__text {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-25, 4px);
  min-inline-size: 0;
}

.saved__name {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-small);
  overflow-wrap: anywhere;
}

.saved__desc {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-subtle);
}

/* Rabbit holes: the map-trail icon in a white circle on the picture's corner. */
.saved__badge {
  position: absolute;
  inset-block-start: var(--spacing-50, 8px);
  inset-inline-start: var(--spacing-50, 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 2rem;
  block-size: 2rem;
  border-radius: var(--border-radius-circle, 50%);
  background-color: var(--background-color-base, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  color: var(--color-base);
}

.saved__badge .cdx-icon {
  color: inherit;
}

/* Mobile: a list, picture on the left. */
[data-skin='mobile'] .saved__items {
  display: block;
}

[data-skin='mobile'] .saved__items li + li {
  border-block-start: var(--border-width-base, 1px) solid var(--border-color-subtle, #c8ccd1);
}

[data-skin='mobile'] .saved__card {
  flex-direction: row;
  align-items: flex-start;
  gap: var(--spacing-100, 16px);
  min-block-size: 0;
  padding: var(--spacing-100, 16px) 0;
  border: 0;
  border-radius: 0;
}

[data-skin='mobile'] .saved__card--new {
  box-shadow: inset 4px 0 0 var(--border-color-progressive, #36c);
  padding-inline-start: var(--spacing-75, 12px);
}

[data-skin='mobile'] .saved__image {
  flex: none;
  inline-size: 4.5rem;
  aspect-ratio: 1;
}

[data-skin='mobile'] .saved__badge {
  inset-block-start: var(--spacing-25, 4px);
  inset-inline-start: var(--spacing-25, 4px);
  inline-size: 1.5rem;
  block-size: 1.5rem;
}

[data-skin='mobile'] .saved__name {
  font-size: var(--font-size-medium, 1rem);
  line-height: var(--line-height-small);
}

[data-skin='mobile'] .saved__desc {
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

</style>
