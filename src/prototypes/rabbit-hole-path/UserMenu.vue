<script setup lang="ts">
/**
 * A working user menu for the header (desktop and mobile). The account items
 * are mocks; "Prototype settings" opens the prototype's settings dialog.
 */
import { ref } from 'vue'
import { CdxIcon, CdxMenuButton, type MenuItemData } from '@wikimedia/codex'
import {
  cdxIconDownTriangle,
  cdxIconLogOut,
  cdxIconSettings,
  cdxIconUserAvatar,
  cdxIconUserAvatarOutline,
  cdxIconUserContributions,
  cdxIconUserTalk,
} from '@wikimedia/codex-icons'

interface Props {
  username: string
  /** Minerva draws the outlined avatar; Vector the filled one. */
  skin: 'desktop' | 'mobile'
}

const props = defineProps<Props>()
const emit = defineEmits<{ prototypeSettings: [] }>()

const PROTOTYPE_SETTINGS = 'prototype-settings'

const items: MenuItemData[] = [
  { value: 'user-page', label: props.username, icon: cdxIconUserAvatar },
  { value: 'talk', label: 'Talk', icon: cdxIconUserTalk },
  { value: 'contributions', label: 'Contributions', icon: cdxIconUserContributions },
  { value: 'log-out', label: 'Log out', icon: cdxIconLogOut },
  {
    value: PROTOTYPE_SETTINGS,
    label: 'Prototype settings',
    description: 'About the data, and what to show',
    icon: cdxIconSettings,
  },
]

/* A menu of actions, not a choice that stays selected. */
const selected = ref<string | null>(null)

function onSelect(value: string | null) {
  if (value === PROTOTYPE_SETTINGS) emit('prototypeSettings')
  selected.value = null
}
</script>

<template>
  <CdxMenuButton
    v-model:selected="selected"
    class="user-menu"
    :class="`user-menu--${props.skin}`"
    :menu-items="items"
    :menu-config="{ visibleItemLimit: 8 }"
    aria-label="User menu"
    @update:selected="onSelect"
  >
    <CdxIcon :icon="props.skin === 'mobile' ? cdxIconUserAvatarOutline : cdxIconUserAvatar" />
    <CdxIcon class="user-menu__caret" :icon="cdxIconDownTriangle" size="x-small" />
  </CdxMenuButton>
</template>

<style scoped>
.user-menu :deep(.cdx-button) {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--color-base);
}

/* Minerva: same 40px-tall touch target as the other header icons, a little wider for the arrow. */
.user-menu.user-menu--mobile :deep(.cdx-button) {
  /* Minerva sizes its header buttons to a 40px square; this one also holds the arrow. */
  width: auto;
  max-width: none;
  min-block-size: var(--size-icon-large, 40px);
  padding-inline: var(--spacing-50, 8px) var(--spacing-25, 4px);
  color: var(--color-subtle, #54595d);
}

.user-menu__caret {
  color: inherit;
}

/* The menu opens under the button but lines up with its right edge, so it stays on screen. */
.user-menu :deep(.cdx-menu) {
  inset-inline: auto 0;
  min-inline-size: 16rem;
}

/* Prototype settings: set apart from the account items, with the prototype chip's yellow. */
.user-menu :deep(.cdx-menu-item:last-child) {
  border-block-start: var(--border-width-base, 1px) solid var(--border-color-subtle);
  background-color: var(--background-color-warning-subtle);
}
</style>
