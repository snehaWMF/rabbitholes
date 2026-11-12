<script setup lang="ts">
/**
 * Prototype-only: a yellow chip pinned bottom-left that opens a small panel
 * with notes about the prototype and switches for its modules. Not part of
 * the feature being prototyped.
 */
import { ref } from 'vue'
import { CdxCheckbox, CdxIcon, CdxPopover } from '@wikimedia/codex'
import { cdxIconSettings } from '@wikimedia/codex-icons'

import { CLICKSTREAM_DATA_MONTH } from './useClickstream'

const showTrail = defineModel<boolean>('showTrail', { required: true })
const showPaths = defineModel<boolean>('showPaths', { required: true })

const open = ref(false)
const chipRef = ref<HTMLElement | null>(null)
</script>

<template>
  <div class="prototype-settings">
    <button
      ref="chipRef"
      type="button"
      class="prototype-settings__chip"
      :aria-expanded="open"
      @click="open = !open"
    >
      <CdxIcon :icon="cdxIconSettings" size="small" />
      Prototype settings
    </button>

    <CdxPopover
      v-model:open="open"
      :anchor="chipRef"
      placement="top-start"
      title="Prototype settings"
      use-close-button
      render-in-place
    >
      <div class="prototype-settings__panel">
        <p class="prototype-settings__note">
          "Other readers' paths" uses a trimmed {{ CLICKSTREAM_DATA_MONTH }} snapshot of Wikipedia
          link clicks. There's no live API, so it isn't updated; the prototype copy says the previous
          month, as a live version would, since each month's data is published the month after.
        </p>

        <fieldset class="prototype-settings__modules">
          <legend class="prototype-settings__legend">Show in the sidebar</legend>
          <CdxCheckbox v-model="showTrail">Your rabbit hole</CdxCheckbox>
          <CdxCheckbox v-model="showPaths">Other readers' paths</CdxCheckbox>
        </fieldset>
      </div>
    </CdxPopover>
  </div>
</template>

<style scoped>
.prototype-settings {
  position: fixed;
  inset: auto auto var(--spacing-100, 16px) var(--spacing-100, 16px);
  z-index: 50;
}

/* Yellow so it reads as "about the prototype", not part of the design. */
.prototype-settings__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-25, 4px);
  padding: var(--spacing-25, 4px) var(--spacing-75, 12px);
  border: var(--border-width-base, 1px) solid var(--border-color-warning);
  border-radius: var(--border-radius-pill, 9999px);
  background-color: var(--background-color-warning-subtle);
  box-shadow: var(--box-shadow-small, 0 1px 2px rgba(0, 0, 0, 0.15));
  font-family: var(--font-family-base);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-base);
  cursor: pointer;
}

.prototype-settings__chip:hover {
  background-color: var(
    --background-color-warning-subtle--hover,
    var(--background-color-warning-subtle)
  );
}

.prototype-settings__chip:focus-visible {
  outline: 2px solid var(--color-progressive);
  outline-offset: 2px;
}

.prototype-settings__chip .cdx-icon {
  color: inherit;
}

.prototype-settings__panel {
  width: 26rem;
  max-width: calc(100vw - 4rem);
  font-family: var(--font-family-base);
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
