import { type CustomDataSource, JulianDate, type Viewer } from 'cesium'
import { describe, expect, it, vi } from 'vitest'
import type { Cell, Grid } from '../core/grid'
import { createRouteLayer } from './route-layer'

const grid: Grid = {
  width: 100,
  height: 100,
  pixelSizeM: 20,
  west: 77,
  east: 78,
  south: 18,
  north: 19,
  maxSafeSlopeDeg: 15,
  elevationM: new Float32Array(100 * 100),
}
const path: Cell[] = [
  { row: 10, col: 10 },
  { row: 10, col: 40 },
]

function setup(surface?: (lon: number, lat: number) => number) {
  let source: CustomDataSource | undefined
  const viewer = {
    dataSources: { add: (s: CustomDataSource) => (source = s) },
    scene: { requestRender: vi.fn() },
  } as unknown as Viewer
  const legend = { set: vi.fn(), remove: vi.fn() }
  const layer = createRouteLayer(viewer, grid, { surfaceM: surface, legend })
  return { layer, legend, source: () => source as CustomDataSource }
}

describe('route layer', () => {
  it('lays the route on the drawn ground, not clamped to the ellipsoid', () => {
    const { layer, source, legend } = setup(() => 1000)
    layer.setPath(path)
    const line = source().entities.values.find((e) => e.name === 'Planned Marswalk')?.polyline
    expect(line?.clampToGround?.getValue(JulianDate.now())).toBe(false)
    expect(line?.depthFailMaterial).toBeDefined() // still visible where a hill is in the way
    const positions = line?.positions?.getValue(JulianDate.now()) as {
      x: number
      y: number
      z: number
    }[]
    expect(positions.length).toBeGreaterThan(path.length) // densified to follow the terrain
    expect(legend.set).toHaveBeenCalledWith(
      'route',
      expect.objectContaining({ colour: '#FC3D21' }),
      expect.any(Array),
    )
  })

  it('falls back to clamping when no ground height is given', () => {
    const { layer, source } = setup()
    layer.setPath(path)
    const line = source().entities.values.find((e) => e.name === 'Planned Marswalk')?.polyline
    expect(line?.clampToGround?.getValue(JulianDate.now())).toBe(true)
  })

  it('takes a line out of the legend when it is cleared', () => {
    const { layer, legend } = setup(() => 0)
    layer.setPath(path)
    layer.setPath(null)
    expect(legend.remove).toHaveBeenCalledWith('route')
  })
})
