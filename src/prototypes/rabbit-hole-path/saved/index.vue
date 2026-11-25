<script setup lang="ts">
/**
 * The reader's saved items: rabbit holes they kept (in the order they read
 * them) and loose saved pages. Reached from the header's saved-items icon,
 * or the "View" button on the toast after saving a rabbit hole.
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ChromeHeader from '@/components/chrome/ChromeHeader.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import SpecialPageWrapper from '@/components/SpecialPageWrapper.vue'

import { loadCollections, SAVED_PAGES_COLLECTION } from '../collections'

const USERNAME = 'Username'

const route = useRoute()
const router = useRouter()

/** Newest first; the standing "Saved pages" list sits after the rabbit holes. */
const collections = computed(() =>
  loadCollections()
    .filter((c) => c.articles.length)
    .sort((a, b) => {
      if (a.name === SAVED_PAGES_COLLECTION) return 1
      if (b.name === SAVED_PAGES_COLLECTION) return -1
      return b.createdAt.localeCompare(a.createdAt)
    }),
)

/** The collection just saved (`?saved=<createdAt>`), marked and scrolled to. */
const justSaved = ref(typeof route.query.saved === 'string' ? route.query.saved : null)

onMounted(async () => {
  await nextTick()
  if (justSaved.value) {
    document.getElementById(`saved-${justSaved.value}`)?.scrollIntoView({ block: 'center' })
  }
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })
}

function open(title: string) {
  void router.push({ path: '/rabbit-hole-path', query: { article: title.replace(/ /g, '_') } })
}
</script>

<template>
  <ChromeWrapper :username="USERNAME" :last-edited-notice="false">
    <template #header>
      <ChromeHeader :username="USERNAME" @bookmarks-click="router.push('/rabbit-hole-path/saved')" />
    </template>
    <SpecialPageWrapper title="Saved items">
      <p v-if="!collections.length" class="saved__empty">
        Nothing saved yet. Save a rabbit hole when you end it, or save a page with the bookmark
        icon.
      </p>

      <section
        v-for="collection in collections"
        :id="`saved-${collection.createdAt}`"
        :key="collection.createdAt + collection.name"
        class="saved__collection"
        :class="{ 'saved__collection--new': collection.createdAt === justSaved }"
      >
        <h2 class="saved__name">{{ collection.name }}</h2>
        <p class="saved__meta">
          {{ collection.articles.length }}
          {{ collection.articles.length === 1 ? 'article' : 'articles' }}
          <template v-if="collection.name !== SAVED_PAGES_COLLECTION">
            · saved {{ formatDate(collection.createdAt) }}
          </template>
        </p>
        <ol class="saved__articles">
          <li v-for="title in collection.articles" :key="title">
            <a
              class="saved__link"
              :href="`#${encodeURIComponent(title)}`"
              @click.prevent="open(title)"
              >{{ title }}</a
            >
          </li>
        </ol>
      </section>
    </SpecialPageWrapper>
  </ChromeWrapper>
</template>

<style scoped>
.saved__empty {
  color: var(--color-subtle);
}

.saved__collection {
  margin-block-end: var(--spacing-150, 24px);
  padding: var(--spacing-100, 16px);
  border: var(--border-width-base, 1px) solid var(--border-color-subtle);
  border-radius: var(--border-radius-base, 2px);
}

/* The one just saved: a progressive edge so it's easy to spot. */
.saved__collection--new {
  border-color: var(--border-color-progressive, #36c);
  box-shadow: inset 4px 0 0 var(--border-color-progressive, #36c);
}

.saved__name {
  margin: 0;
  font-family: var(--font-family-system-sans, system-ui, sans-serif);
  font-size: var(--font-size-medium, 1rem);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-medium, 1.625rem);
}

.saved__meta {
  margin: 0 0 var(--spacing-50, 8px);
  font-size: var(--font-size-small);
  color: var(--color-subtle);
}

.saved__articles {
  margin: 0;
  padding-inline-start: var(--spacing-150, 24px);
}

.saved__link {
  color: var(--color-progressive);
  text-decoration: none;
}

.saved__link:hover {
  text-decoration: underline;
}
</style>
