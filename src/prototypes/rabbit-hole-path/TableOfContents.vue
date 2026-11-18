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
        <button type="button" class="toc__link" @click="scrollToSection(null)">(Top)</button>
      </li>
      <li
        v-for="section in props.sections"
        :key="section.id"
        class="toc__item"
        :class="{ 'toc__item--active': props.active === section.id }"
      >
        <button type="button" class="toc__link" @click="scrollToSection(section.id)">
          {{ section.text }}
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* Codex "Small" style throughout, like Vector's sidebar. */
.toc {
  font-family: var(--font-family-system-sans, system-ui, sans-serif);
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

/* Buttons styled as links, so hovering doesn't show a URL in the browser's corner. */
.toc__link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  text-align: start;
  color: var(--color-progressive);
  text-decoration: none;
  cursor: pointer;
}

.toc__link:focus-visible {
  outline: 2px solid var(--color-progressive);
  outline-offset: 1px;
}

.toc__link:hover {
  text-decoration: underline;
}

.toc__item--active .toc__link {
  color: var(--color-base);
}
</style>
