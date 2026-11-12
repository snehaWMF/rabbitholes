<script setup lang="ts">
/** Vector 2022-style "Contents" rail: (Top) plus the article's sections. */
export interface TocSection {
  id: string
  text: string
}

interface Props {
  sections: TocSection[]
  /** Id of the section in view, or `null` for the top of the page. */
  active?: string | null
}

const props = withDefaults(defineProps<Props>(), { active: null })

function scrollToSection(id: string | null) {
  if (id === null) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <nav class="toc" aria-labelledby="toc-heading">
    <h2 id="toc-heading" class="toc__heading">Contents</h2>
    <ul class="toc__list">
      <li class="toc__item" :class="{ 'toc__item--active': props.active === null }">
        <a href="#" class="toc__link" @click.prevent="scrollToSection(null)">(Top)</a>
      </li>
      <li
        v-for="section in props.sections"
        :key="section.id"
        class="toc__item"
        :class="{ 'toc__item--active': props.active === section.id }"
      >
        <a :href="`#${section.id}`" class="toc__link" @click.prevent="scrollToSection(section.id)">
          {{ section.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* Codex "Small" style throughout, like Vector's sidebar. */
.toc {
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
}

.toc__heading {
  margin: 0 0 var(--spacing-50, 8px);
  padding-block-end: var(--spacing-25, 4px);
  border-block-end: var(--border-width-base, 1px) solid var(--border-color-subtle);
  font: inherit;
  color: var(--color-subtle);
}

.toc__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.toc__item {
  padding-block: var(--spacing-25, 4px);
}

.toc__link {
  color: var(--color-progressive);
  text-decoration: none;
}

.toc__link:hover {
  text-decoration: underline;
}

.toc__item--active .toc__link {
  color: var(--color-base);
}
</style>
