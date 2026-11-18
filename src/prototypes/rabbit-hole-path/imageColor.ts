/**
 * The colour of an article's main image, for tinting the mobile rabbit hole
 * bar. Picks the most common colour (ignoring near-white and near-black,
 * which are usually backgrounds and borders), not a muddy average.
 */

export interface Tint {
  /** Background colour, e.g. `rgb(120, 40, 30)`. */
  background: string
  /** Whether white text is needed to read on it. */
  dark: boolean
}

/** Smallest rendered width that counts as a picture rather than an icon or flag. */
const MIN_IMAGE_WIDTH = 100

/** The article's lead picture: the infobox image if there is one, else the first large image. */
export function mainImage(root: HTMLElement): HTMLImageElement | null {
  const candidates = [
    ...root.querySelectorAll<HTMLImageElement>('.infobox img, figure img, img.mw-file-element'),
  ]
  return (
    candidates.find((img) => Number(img.getAttribute('width') ?? img.width) >= MIN_IMAGE_WIDTH) ??
    null
  )
}

/** Load a fresh, CORS-enabled copy (the one in the page can't be read back). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = new URL(src.startsWith('//') ? `https:${src}` : src, window.location.href).href
  })
}

const SAMPLE = 32

export async function tintFromImage(img: HTMLImageElement): Promise<Tint | null> {
  const src = img.currentSrc || img.getAttribute('src')
  if (!src) return null
  try {
    const loaded = await loadImage(src)
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE
    canvas.height = SAMPLE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(loaded, 0, 0, SAMPLE, SAMPLE)
    const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE)

    // Bucket pixels by colour (4 bits a channel) and keep a running sum per bucket.
    const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a < 128) continue
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (min > 235 || max < 20) continue // paper-white backgrounds, black borders
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
      bucket.n++
      bucket.r += r
      bucket.g += g
      bucket.b += b
      buckets.set(key, bucket)
    }
    let best: { n: number; r: number; g: number; b: number } | null = null
    for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket
    if (!best) return null

    // Bright, vivid colours are toned down so the bar's text stays easy to read.
    let [r, g, b] = mute(best.r / best.n, best.g / best.n, best.b / best.n)
    // Light colours keep dark text. Anything darker than that gets white text, and
    // is darkened just enough for white to read clearly (WCAG AA, 4.5:1).
    if (luminance(r, g, b) >= LIGHT_ENOUGH) {
      return { background: `rgb(${r}, ${g}, ${b})`, dark: false }
    }
    ;[r, g, b] = darkenForWhiteText(r, g, b)
    return { background: `rgb(${r}, ${g}, ${b})`, dark: true }
  } catch {
    return null
  }
}

/** Colours at least this light (WCAG luminance) keep dark text; anything darker gets white. */
const LIGHT_ENOUGH = 0.4
/** Highest luminance that gives white text 4.5:1 contrast. */
const MAX_LUMINANCE_FOR_WHITE = 1.05 / 4.5 - 0.05

/** Scale the colour down, keeping its hue, until white text on it meets 4.5:1. */
function darkenForWhiteText(r: number, g: number, b: number): [number, number, number] {
  let [dr, dg, db] = [r, g, b]
  while (luminance(dr, dg, db) > MAX_LUMINANCE_FOR_WHITE) {
    ;[dr, dg, db] = [dr, dg, db].map((v) => v * 0.95)
  }
  return [dr, dg, db].map(Math.round) as [number, number, number]
}

/** Highest saturation the bar uses (HSL, 0–1); anything more vivid is turned down to this. */
const MAX_SATURATION = 0.4

/** Cap the colour's saturation, keeping its hue and lightness. Returns whole 0–255 channels. */
function mute(r: number, g: number, b: number): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (s <= MAX_SATURATION) return [r, g, b].map(Math.round) as [number, number, number]

  let h = 0
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h *= 60
  if (h < 0) h += 360

  // Back from HSL with the capped saturation.
  const c = (1 - Math.abs(2 * l - 1)) * MAX_SATURATION
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [r1 + m, g1 + m, b1 + m].map((v) => Math.round(v * 255)) as [number, number, number]
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance(r: number, g: number, b: number) {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}
