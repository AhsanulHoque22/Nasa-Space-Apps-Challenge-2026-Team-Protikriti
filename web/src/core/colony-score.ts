/** 6-channel colony suitability grid reader (solar/ice/minerals/shelter/stability/wind). */

export type ColonyScoreGrid = {
  width: number
  height: number
  west: number
  east: number
  north: number
  south: number
  nodata: number
  channels: string[]
  data: Uint8Array
}

export type ColonyScore = {
  solar: number | null
  ice: number | null
  minerals: number | null
  shelter: number | null
  stability: number | null
  wind: number | null
}

export function parseColonyScore(meta: Record<string, unknown>, bin: ArrayBuffer): ColonyScoreGrid {
  const { width, height, west, east, north, south, nodata, channels } = meta as ColonyScoreGrid
  if (bin.byteLength !== width * height * (channels as string[]).length) {
    throw new Error(`colony_score.bin: expected ${width * height * channels.length} bytes`)
  }
  return { width, height, west, east, north, south, nodata, channels, data: new Uint8Array(bin) }
}

export function colonyScoreAt(grid: ColonyScoreGrid, lon: number, lat: number): ColonyScore {
  const col = Math.min(
    grid.width - 1,
    Math.floor((((lon + 180) % 360) / 360) * grid.width),
  )
  const row = Math.min(
    grid.height - 1,
    Math.floor(((grid.north - lat) / (grid.north - grid.south)) * grid.height),
  )
  const offset = (row * grid.width + col) * grid.channels.length
  const v = (i: number): number | null => {
    const val = grid.data[offset + i]
    return val === grid.nodata ? null : val
  }
  return {
    solar: v(0),
    ice: v(1),
    minerals: v(2),
    shelter: v(3),
    stability: v(4),
    wind: v(5),
  }
}

let _loaded: Promise<ColonyScoreGrid> | null = null

export function loadColonyScore(): Promise<ColonyScoreGrid> {
  _loaded ??= Promise.all([
    fetch('data/colony_score.json').then((r) => r.json()),
    fetch('data/colony_score.bin').then((r) => r.arrayBuffer()),
  ])
    .then(([meta, bin]) => parseColonyScore(meta as Record<string, unknown>, bin))
    .catch((e) => {
      _loaded = null
      throw e
    })
  return _loaded
}
