<script setup lang="ts">
import { computed } from 'vue'

import { CLICKSTREAM_MONTH, type ArticlePaths } from './useClickstream'

interface Props {
  /** `null` while loading; `{}` when the article has no clickstream data. */
  paths: ArticlePaths | null
  /** The article the reader actually came from, if they followed a link here. */
  cameFrom?: string | null
}

const props = withDefaults(defineProps<Props>(), { cameFrom: null })

const emit = defineEmits<{
  go: [title: string]
}>()

const topIn = computed(() => props.paths?.in?.[0]?.[0] ?? null)
const topOut = computed(() => props.paths?.out?.[0]?.[0] ?? null)
const sameAsReader = computed(() => !!topIn.value && topIn.value === props.cameFrom)
/** Loaded, but this article has no common path in or out. */
const noData = computed(() => props.paths !== null && !topIn.value && !topOut.value)

const PRIVACY_POLICY_URL = 'https://foundation.wikimedia.org/wiki/Policy:Privacy_policy'
</script>

<template>
  <!--
    Always shown, at a fixed height, so the trail above sizes itself against a
    space that never changes — with "No popular path found for this article" when there's no data.
  -->
  <section class="common-paths" aria-labelledby="common-paths-heading">
    <h2 id="common-paths-heading" class="common-paths__heading">Other readers' paths</h2>

    <p v-if="noData" class="common-paths__line common-paths__line--empty">
      No popular path found for this article. You've wandered off the beaten path.
    </p>

    <p v-if="topIn" class="common-paths__line">
      {{ sameAsReader ? 'Like you, most readers come here from' : 'Most readers come here from' }}
      <a
        class="common-paths__link"
        :href="`#${encodeURIComponent(topIn)}`"
        @click.prevent="emit('go', topIn)"
        >{{ topIn }}</a
      >
    </p>

    <p v-if="topOut" class="common-paths__line">
      Most readers go next to
      <a
        class="common-paths__link"
        :href="`#${encodeURIComponent(topOut)}`"
        @click.prevent="emit('go', topOut)"
        >{{ topOut }}</a
      >
    </p>

    <p v-if="topIn || topOut" class="common-paths__source">
      Based on Wikipedia link clicks, {{ CLICKSTREAM_MONTH }} ·
      <a class="common-paths__link" :href="PRIVACY_POLICY_URL" target="_blank" rel="noopener"
        >Privacy policy</a
      >
    </p>
  </section>
</template>

<style scoped>
/* Every piece of text here is the Codex "Small" style, to sit with the trail. */
.common-paths {
  /* Room for the fullest version: heading, two two-line paths, two-line source. */
  min-block-size: 11.5rem;
  margin-block-start: var(--spacing-150, 24px);
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
  color: var(--color-base);
}

/* First in the rail (rabbit hole hidden): no gap, so its rule meets the toolbar's. */
.common-paths:first-child {
  margin-block-start: 0;
}

.common-paths__heading {
  margin: 0 0 var(--spacing-50, 8px);
  padding-block-end: var(--spacing-25, 4px);
  border-block-end: var(--border-width-base, 1px) solid var(--border-color-subtle);
  font: inherit;
  color: var(--color-subtle);
}

.common-paths__line {
  margin: 0 0 var(--spacing-50, 8px);
}

.common-paths__link {
  color: var(--color-progressive);
  text-decoration: none;
}

.common-paths__link:hover {
  text-decoration: underline;
}

.common-paths__line--empty {
  color: var(--color-subtle);
}

/* Same footnote size as "spent 2m" in the trail. */
.common-paths__source {
  margin: 0;
  font-size: var(--font-size-x-small, 0.75rem);
  line-height: var(--line-height-x-small, 1.25rem);
  color: var(--color-subtle);
}
</style>
