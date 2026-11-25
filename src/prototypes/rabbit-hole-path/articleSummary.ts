import { reactive } from 'vue'

import { wikimediaApiFetchHeaders } from '@/config'

/** What a saved-items card shows for an article: its short description and lead image. */
export interface ArticleSummary {
  description: string
  thumbnail: string | null
}

/** Reactive cache by title: `undefined` until fetched, then the summary (or `null` on failure). */
const summaries = reactive(new Map<string, ArticleSummary | null>())
const pending = new Set<string>()

/** The summary for a title; starts a fetch the first time it's asked for. */
export function articleSummary(title: string): ArticleSummary | null | undefined {
  if (!summaries.has(title) && !pending.has(title)) void load(title)
  return summaries.get(title)
}

async function load(title: string) {
  pending.add(title)
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { headers: wikimediaApiFetchHeaders('rabbit-hole-path saved items') },
    )
    if (!response.ok) throw new Error(String(response.status))
    const data = (await response.json()) as {
      description?: string
      thumbnail?: { source?: string }
    }
    summaries.set(title, { description: data.description ?? '', thumbnail: data.thumbnail?.source ?? null })
  } catch {
    summaries.set(title, null)
  } finally {
    pending.delete(title)
  }
}
