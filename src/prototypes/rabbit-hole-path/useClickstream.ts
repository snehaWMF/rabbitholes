import { ref, watch, type Ref } from 'vue'

/**
 * "Most readers come here from … / go on to …" from the Wikipedia clickstream
 * (English Wikipedia, October 2026: https://dumps.wikimedia.org/other/clickstream/).
 * There's no live API, so the monthly dump was boiled down by
 * `extract_clickstream.py` to the top article-to-article link in and out of
 * each article (500+ clicks — ~305k articles), sharded into
 * `public/rabbit-holes/clickstream/<fnv1a(title) & 0xff>.json`.
 */
/** The month the bundled data actually comes from. */
export const CLICKSTREAM_DATA_MONTH = 'October 2026'

/**
 * The month the page *shows*: always the previous one, as a live feature
 * would (each monthly dump covers the month before). A deployed prototype
 * can't fetch new dumps, so the data stays at CLICKSTREAM_DATA_MONTH — the
 * prototype settings chip says so.
 */
const now = new Date()
export const CLICKSTREAM_MONTH = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString(
  'en',
  { month: 'long', year: 'numeric' },
)

/** [title, clicks in the month] */
export type ClickPath = [string, number]

export interface ArticlePaths {
  in?: ClickPath[]
  out?: ClickPath[]
}

type Shard = Record<string, ArticlePaths>

const shards = new Map<string, Promise<Shard>>()

/** Must match `fnv1a` in the extraction script: 32-bit FNV-1a over UTF-8 bytes. */
function shardFor(title: string) {
  let h = 0x811c9dc5
  for (const b of new TextEncoder().encode(title)) {
    h ^= b
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return (h & 0xff).toString(16).padStart(2, '0')
}

function loadShard(id: string): Promise<Shard> {
  let shard = shards.get(id)
  if (!shard) {
    shard = fetch(`${import.meta.env.BASE_URL}rabbit-holes/clickstream/${id}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<Shard>) : {}))
      .catch(() => ({}))
    shards.set(id, shard)
  }
  return shard
}

export function useClickstream(title: Ref<string>) {
  const paths = ref<ArticlePaths | null>(null)

  watch(
    title,
    async (value) => {
      paths.value = null
      const key = value.replace(/_/g, ' ')
      const shard = await loadShard(shardFor(key))
      if (title.value === value) paths.value = shard[key] ?? {}
    },
    { immediate: true },
  )

  return { paths }
}
