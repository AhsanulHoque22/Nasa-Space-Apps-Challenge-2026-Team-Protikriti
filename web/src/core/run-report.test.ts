import { describe, expect, it } from 'vitest'
import type { StoresInput } from './base-stores'
import type { CargoPlan } from './cargo'
import type { Progress } from './mission-progress'
import { type Guard, guardHit, runReport } from './run-report'

const cargo: CargoPlan = {
  kilopower: 2,
  solar: 0,
  battery: 1,
  isru: 2,
  foodSols: 500,
  waterKg: 750,
  recycler: 0,
  greenhouseM2: 10,
}
const progress: Progress = {
  version: 1,
  owner: 'o',
  completed: ['1.1', '1.2', '1.3', '1.4', '1.5'],
  cargo,
  crewRouteDays: 178,
  stay: { days: 1319, sols: 1284, nextShipSol: 764, nextShipRouteDays: 150 },
  greenhouse: { areas: { lettuce: 6 }, at: { lon: 0, lat: 0 } },
}
const stores = (c: CargoPlan, untilSol: number): StoresInput => ({
  cargo: c,
  untilSol,
  solarKwhPerSol: () => 0,
  greenhouse: null,
  walks: [],
})

describe('runReport', () => {
  it('blames the reactors packed in 1.1 when the greenhouse browns out the base', () => {
    const lessons = runReport({
      progress,
      failure: { store: 'power', sol: 9, missionId: '1.6', why: 'Brownout' },
      stores: null,
    })
    const l = lessons.find((x) => x.missionId === '1.1')
    expect(l?.guard).toEqual({ kind: 'min', field: 'cargo.kilopower', value: 3 })
    expect(l?.fatal).toBe(true)
    expect(l?.measure).toContain('3')
  })

  it('asks for a recycler when the water ran out without one, and checks the fix holds', () => {
    const lessons = runReport({
      progress: { ...progress, cargo: { ...cargo, kilopower: 4 } },
      failure: { store: 'water', sol: 15, missionId: '1.4', why: 'Water out' },
      stores: stores({ ...cargo, kilopower: 4 }, 15),
    })
    expect(lessons.map((l) => l.guard)).toContainEqual({
      kind: 'min',
      field: 'cargo.recycler',
      value: 1,
    })
  })

  it('asks for food to the next ship when the food ran out', () => {
    const c = { ...cargo, kilopower: 4, recycler: 1 }
    const lessons = runReport({
      progress: { ...progress, cargo: c },
      failure: { store: 'food', sol: 501, missionId: '1.7', why: 'Food out' },
      stores: stores(c, 501),
    })
    expect(lessons.map((l) => l.guard)).toContainEqual({
      kind: 'min',
      field: 'cargo.foodSols',
      value: 764,
    })
  })

  it('tells the walkers to stay nearer when a suit ran out', () => {
    const lessons = runReport({
      progress,
      failure: { store: 'suit', sol: 5, missionId: '1.5', why: 'Suit out' },
      stores: null,
      walkDistanceM: 2400,
      walkPlannedM: 5200,
    })
    expect(lessons[0]).toMatchObject({
      missionId: '1.5',
      guard: { kind: 'max', field: 'walk.distanceM', value: 5199 },
    })
  })
})

describe('guardHit', () => {
  const min: Guard = { kind: 'min', field: 'cargo.kilopower', value: 3 }
  const max: Guard = { kind: 'max', field: 'greenhouse.peakKw', value: 7.5 }
  const eq: Guard = { kind: 'equals', field: 'storm.habitatKw', value: 14.9 }
  it('fires below a minimum, above a maximum and on an equal value, and not at the edge', () => {
    expect(guardHit(min, { 'cargo.kilopower': 2 })).toBe(true)
    expect(guardHit(min, { 'cargo.kilopower': 3 })).toBe(false)
    expect(guardHit(max, { 'greenhouse.peakKw': 7.6 })).toBe(true)
    expect(guardHit(max, { 'greenhouse.peakKw': 7.5 })).toBe(false)
    expect(guardHit(eq, { 'storm.habitatKw': 14.9 })).toBe(true)
    expect(guardHit(eq, { 'storm.habitatKw': 8 })).toBe(false)
  })
  it('stays quiet when the value is not on this screen', () => {
    expect(guardHit(min, {})).toBe(false)
  })
})
