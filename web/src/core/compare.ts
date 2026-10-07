/** Jezero beside the Jamuna at the same ground scale: the pipeline's compare.json, validated. */

export type Scene = { year: number; file: string; layer: string; date: string; source: string }

export type CompareDoc = {
  boxKm: number
  px: number
  /** Always shown: the Jamuna is not a Mars analog. */
  caveat: string
  jezero: { file: string; center: [number, number]; source: string }
  jamuna: { center: [number, number]; scenes: Scene[] }
}

const SAFE_FILE = /^[a-z0-9_]+\.jpg$/

function file(name: unknown): string {
  if (typeof name !== 'string' || !SAFE_FILE.test(name))
    throw new Error(`compare.json: bad file name ${JSON.stringify(name)}`)
  return name
}

export function parseCompare(raw: unknown): CompareDoc {
  const d = raw as Partial<CompareDoc> | null
  if (!d || typeof d !== 'object') throw new Error('compare.json: expected an object')
  if (typeof d.caveat !== 'string' || d.caveat.trim() === '')
    throw new Error('compare.json: the caveat is missing')
  if (!d.jezero || !d.jamuna || !Array.isArray(d.jamuna.scenes) || d.jamuna.scenes.length === 0)
    throw new Error('compare.json: missing Jezero or Jamuna scenes')
  if (!(typeof d.boxKm === 'number' && d.boxKm > 0)) throw new Error('compare.json: bad boxKm')
  const scenes = d.jamuna.scenes
    .map((s) => ({ ...s, file: file(s.file), year: Number(s.year) }))
    .sort((a, b) => a.year - b.year)
  return {
    ...(d as CompareDoc),
    jezero: { ...d.jezero, file: file(d.jezero.file) },
    jamuna: { ...d.jamuna, scenes },
  }
}
