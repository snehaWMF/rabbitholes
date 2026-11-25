<script setup lang="ts">
/**
 * Prototype-only: notes about the prototype and switches for its modules,
 * shown in the panel the header's user icon opens. Not part of the feature
 * being prototyped.
 */
import { CdxCheckbox } from '@wikimedia/codex'

import { CLICKSTREAM_DATA_MONTH } from './useClickstream'

const showTrail = defineModel<boolean>('showTrail', { required: true })
const showPaths = defineModel<boolean>('showPaths', { required: true })
</script>

<template>
  <div class="prototype-settings">
    <p class="prototype-settings__note">
      "Other readers' paths" uses a trimmed {{ CLICKSTREAM_DATA_MONTH }} snapshot of Wikipedia link
      clicks. There's no live API, so it isn't updated.
    </p>

    <fieldset class="prototype-settings__modules">
      <legend class="prototype-settings__legend">Show on the page</legend>
      <CdxCheckbox v-model="showTrail">Your rabbit hole</CdxCheckbox>
      <CdxCheckbox v-model="showPaths">Other readers' paths</CdxCheckbox>
    </fieldset>
  </div>
</template>

<style scoped>
.prototype-settings {
  font-family: var(--font-family-system-sans, system-ui, sans-serif);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}

.prototype-settings__note {
  margin: 0 0 var(--spacing-100, 16px);
  color: var(--color-subtle);
}

.prototype-settings__modules {
  margin: 0;
  padding: 0;
  border: 0;
}

.prototype-settings__legend {
  margin-block-end: var(--spacing-50, 8px);
  padding: 0;
  font-weight: var(--font-weight-bold);
  color: var(--color-base);
}
</style>
