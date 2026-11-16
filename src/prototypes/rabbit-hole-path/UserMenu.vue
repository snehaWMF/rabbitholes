<script setup lang="ts">
/**
 * The header's user icon (desktop and mobile). In this prototype it opens
 * the prototype settings directly, in a panel under the icon.
 */
import { ref } from 'vue'
import { CdxButton, CdxIcon, CdxPopover } from '@wikimedia/codex'
import {
  cdxIconDownTriangle,
  cdxIconUserAvatar,
  cdxIconUserAvatarOutline,
} from '@wikimedia/codex-icons'

import PrototypeSettings from './PrototypeSettings.vue'

interface Props {
  /** Minerva draws the outlined avatar; Vector the filled one. */
  skin: 'desktop' | 'mobile'
}

const props = defineProps<Props>()
const showTrail = defineModel<boolean>('showTrail', { required: true })
const showPaths = defineModel<boolean>('showPaths', { required: true })

const open = ref(false)
const anchor = ref<InstanceType<typeof CdxButton> | null>(null)
</script>

<template>
  <span class="user-menu" :class="`user-menu--${props.skin}`">
    <CdxButton
      ref="anchor"
      weight="quiet"
      aria-label="User menu"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = !open"
    >
      <CdxIcon :icon="props.skin === 'mobile' ? cdxIconUserAvatarOutline : cdxIconUserAvatar" />
      <CdxIcon class="user-menu__caret" :icon="cdxIconDownTriangle" size="x-small" />
    </CdxButton>

    <CdxPopover
      v-model:open="open"
      :anchor="anchor"
      placement="bottom-end"
      title="Prototype settings"
      use-close-button
      class="user-menu__popover"
    >
      <PrototypeSettings v-model:show-trail="showTrail" v-model:show-paths="showPaths" />
    </CdxPopover>
  </span>
</template>

<style scoped>
.user-menu {
  display: inline-flex;
}

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
</style>

<style>
/* Teleported out of the header, so unscoped. Wide enough that the note doesn't wrap narrowly. */
.user-menu__popover {
  width: 26rem;
  max-width: calc(100vw - 2rem);
}
</style>
