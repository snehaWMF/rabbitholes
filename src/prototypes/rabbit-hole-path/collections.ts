/**
 * Reader-made collections of articles — where a rabbit hole goes when the
 * reader keeps it. Prototype-only: kept in this browser's `localStorage`.
 */
const STORAGE_KEY = 'protowiki:rabbit-hole-collections'

export interface Collection {
  name: string
  articles: string[]
  createdAt: string
  /** Rabbit holes: how many links deep the reader went. */
  links?: number
  /** Loose saved pages: when each one was saved (ISO), for sorting by most recent. */
  savedAt?: Record<string, string>
}

export function loadCollections(): Collection[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Collection[]
  } catch {
    return []
  }
}

export function createCollection(name: string, articles: string[], links?: number): Collection {
  const collection: Collection = { name, articles, createdAt: new Date().toISOString(), links }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...loadCollections(), collection]))
  } catch {
    // Blocked storage — the confirmation still shows; the collection just won't persist.
  }
  return collection
}

/** The standing collection that loose pages are added to. */
export const SAVED_PAGES_COLLECTION = 'Saved pages'

/** Add articles to a named collection (skipping ones already in it), creating it if needed. */
export function savePagesToCollection(articles: string[], name = SAVED_PAGES_COLLECTION) {
  const collections = loadCollections()
  const now = new Date().toISOString()
  let existing = collections.find((c) => c.name === name)
  if (!existing) {
    existing = { name, articles: [], createdAt: now }
    collections.push(existing)
  }
  existing.savedAt ??= {}
  for (const article of articles) {
    if (!existing.articles.includes(article)) existing.articles.push(article)
    existing.savedAt[article] = now
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
  } catch {
    // Blocked storage — as above.
  }
}

/** Articles in a named collection (empty if it doesn't exist yet). */
export function collectionArticles(name = SAVED_PAGES_COLLECTION): string[] {
  return loadCollections().find((c) => c.name === name)?.articles ?? []
}

/** Take one article back out of a named collection. */
export function removePageFromCollection(article: string, name = SAVED_PAGES_COLLECTION) {
  const collections = loadCollections()
  const existing = collections.find((c) => c.name === name)
  if (!existing) return
  existing.articles = existing.articles.filter((a) => a !== article)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
  } catch {
    // Blocked storage — as above.
  }
}
