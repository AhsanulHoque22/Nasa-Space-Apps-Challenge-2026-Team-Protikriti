/**
 * Story mode's mission registry, as data. Three expeditions to one site follows NASA's Evolvable
 * Mars Campaign (Rucker et al. 2016) and DRA 5.0 (three consecutive opportunities). A mission's
 * `built` flag turns true only when its screen exists; until then it is listed as coming soon.
 * Numbers in briefings are the sourced values in docs/superpowers/specs/2026-10-25-mission-journey-design.md.
 */

export type Hat = 'Commander' | 'Engineer' | 'Scientist' | 'Medic'

export type Expedition = { n: number; title: string; summary: string }

export type Mission = {
  /** "<expedition>.<order>", e.g. "1.4". */
  id: string
  expedition: number
  title: string
  /** The crew roles that own this mission's decisions. */
  hats: Hat[]
  built: boolean
  briefing: string
}

export const EXPEDITIONS: readonly Expedition[] = [
  {
    n: 1,
    title: 'First Footprints',
    summary: 'A crew of four lands and must stay alive for 525 sols until the window home opens.',
  },
  {
    n: 2,
    title: 'Second Crew',
    summary: 'A new crew arrives at the same base and builds on what the first crew left.',
  },
  {
    n: 3,
    title: 'Toward Permanence',
    summary: 'The third crew plans for a base that outlives any one expedition.',
  },
]

export const MISSIONS: readonly Mission[] = [
  {
    id: '1.1',
    expedition: 1,
    title: 'Briefing and cargo',
    hats: ['Commander', 'Engineer'],
    built: true,
    briefing:
      'Cargo goes first, about two years ahead of the crew. Pack one lander: the 21.5 t habitat is fixed, and every other kilogram is your choice of power, oxygen plant, food and spares.',
  },
  {
    id: '1.2',
    expedition: 1,
    title: 'Choose the landing site',
    hats: ['Scientist', 'Commander'],
    built: true,
    briefing:
      'Weigh the evidence for 30 NASA candidate zones: ice, terrain, science. Orbital data is evidence, not ground truth. Then learn whether the oxygen plant filled the return tanks in time.',
  },
  {
    id: '1.3',
    expedition: 1,
    title: 'Landing',
    hats: ['Commander'],
    built: true,
    briefing:
      'The closest real footage of a Mars landing: Perseverance in 2021. Why the entry is so hard, and why landing elevation matters.',
  },
  {
    id: '1.4',
    expedition: 1,
    title: 'Build the base',
    hats: ['Engineer', 'Medic'],
    built: true,
    briefing:
      'Place the habitat, power and oxygen plant on the real terrain. Slopes, shadows and a reactor at least 1 km from the crew decide what works. The survival clock starts.',
  },
  {
    id: '1.5',
    expedition: 1,
    title: 'First Marswalk',
    hats: ['Scientist', 'Medic'],
    built: true,
    briefing:
      'Plan a walk to a science stop and back. Slope, time, return margin and radiation dose decide between GO and NO-GO.',
  },
  {
    id: '1.6',
    expedition: 1,
    title: 'Greenhouse trial',
    hats: ['Scientist', 'Engineer'],
    built: false,
    briefing:
      'Grow food without local soil, which holds toxic perchlorate. Every square metre costs light, power and water. See how far a trial is from feeding a crew.',
  },
  {
    id: '1.7',
    expedition: 1,
    title: 'Dust storm',
    hats: ['Commander', 'Engineer'],
    built: false,
    briefing:
      'A storm like the one in 2018 dims the Sun for weeks. Decide what stays powered and what is switched off.',
  },
  {
    id: '1.8',
    expedition: 1,
    title: 'Return window',
    hats: ['Commander'],
    built: false,
    briefing:
      'Reach sol 525 with the crew alive and the ascent vehicle ready. The debrief shows what held and what nearly failed.',
  },
  {
    id: '1.9',
    expedition: 1,
    title: 'Water from ice',
    hats: ['Engineer', 'Scientist'],
    built: false,
    briefing: 'Find shallow ice inside your zone and plan how to bring water back to the base.',
  },
  {
    id: '1.10',
    expedition: 1,
    title: 'Long traverse',
    hats: ['Scientist', 'Commander'],
    built: false,
    briefing:
      'Two crew drive a pressurised rover about 100 km over two weeks while two stay at the base.',
  },
  {
    id: '1.11',
    expedition: 1,
    title: 'Power unit failure',
    hats: ['Engineer'],
    built: false,
    briefing:
      'One power unit fails. Bring the spare online and decide what to switch off meanwhile.',
  },
  {
    id: '2.1',
    expedition: 2,
    title: 'Pack the second lander',
    hats: ['Commander', 'Engineer'],
    built: false,
    briefing: 'Pack for a base that already exists: replace what wore out, add what was missing.',
  },
  {
    id: '2.2',
    expedition: 2,
    title: 'Wake the base',
    hats: ['Engineer'],
    built: false,
    briefing: 'Find out what survived while the base slept between crews.',
  },
  {
    id: '2.3',
    expedition: 2,
    title: 'Greenhouse scale-up',
    hats: ['Scientist', 'Engineer'],
    built: false,
    briefing:
      'NASA studies put food for one person at about 50 m² of crops. Grow toward it and pay for it in power and water.',
  },
  {
    id: '2.4',
    expedition: 2,
    title: 'Ice mining at scale',
    hats: ['Engineer'],
    built: false,
    briefing: 'Turn the first crew’s ice survey into a steady water supply.',
  },
  {
    id: '2.5',
    expedition: 2,
    title: 'Cave scouting',
    hats: ['Scientist', 'Medic'],
    built: false,
    briefing: 'Scout candidate caves and lava tubes as natural shelter from radiation.',
  },
  {
    id: '2.6',
    expedition: 2,
    title: 'Sample campaign',
    hats: ['Scientist'],
    built: false,
    briefing: 'Choose which rocks are worth carrying home, and why.',
  },
  {
    id: '2.7',
    expedition: 2,
    title: 'Return',
    hats: ['Commander'],
    built: false,
    briefing: 'Bring the second crew home and leave the base ready for the third.',
  },
  {
    id: '3.1',
    expedition: 3,
    title: 'Power farm end of life',
    hats: ['Engineer'],
    built: false,
    briefing:
      'The first power units near the end of their roughly 12-year life. Plan the handover.',
  },
  {
    id: '3.2',
    expedition: 3,
    title: 'Food independence trial',
    hats: ['Scientist'],
    built: false,
    briefing: 'How much of the crew’s food can the base grow itself?',
  },
  {
    id: '3.3',
    expedition: 3,
    title: 'Radiation across three crews',
    hats: ['Medic'],
    built: false,
    briefing:
      'Add up the dose each crew took, set against the 600 mSv career limit NASA was advised to use.',
  },
  {
    id: '3.4',
    expedition: 3,
    title: 'Phobos waypoint',
    hats: ['Scientist', 'Commander'],
    built: false,
    briefing:
      'Japan’s MMX mission is bringing Phobos samples to Earth. What would they tell a crew about using Phobos?',
  },
  {
    id: '3.5',
    expedition: 3,
    title: 'Handover to an outpost',
    hats: ['Commander'],
    built: false,
    briefing: 'Turn three expeditions into a base that stays.',
  },
]
