import { watch } from 'vue'

import { useConfig } from '@/composables/useConfig'

/**
 * The prototype is about logged-in readers, so every page of it always shows
 * one: a "Logged out" choice saved in ProtoWiki's settings (by this or another
 * prototype on the same site) is switched back to a logged-in reader.
 */
export function useAlwaysLoggedIn() {
  const { user } = useConfig()
  watch(
    user,
    (value) => {
      if (value === 'logged-out') user.value = 'new'
    },
    { immediate: true },
  )
  return user
}
