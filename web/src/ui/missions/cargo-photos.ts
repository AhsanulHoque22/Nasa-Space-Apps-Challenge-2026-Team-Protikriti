/**
 * Photos on the mission 1.1 cards: NASA Image and Video Library items, stored in the app for
 * offline use. Each caption says what the photo shows and how it relates to the packed item.
 */
import type { CargoItem } from '../../core/cargo'

export type CargoPhoto = {
  src: string
  alt: string
  caption: string
  credit: string
  nasaId: string
}

const LIBRARY = 'https://images.nasa.gov/details/'

export const CARGO_PHOTOS: Partial<Record<CargoItem['id'], CargoPhoto>> = {
  kilopower: {
    src: 'media/cargo/GRC-2015-C-06315.webp',
    alt: 'A technician working on a large cylindrical Stirling power converter in a NASA laboratory.',
    caption:
      'A 10 kW Stirling power converter from NASA Glenn’s fission surface power test unit: Kilopower turns reactor heat into electricity the same way.',
    credit: 'NASA Glenn',
    nasaId: 'GRC-2015-C-06315',
  },
  solar: {
    src: 'media/cargo/PIA22205.webp',
    alt: 'Fan-shaped circular solar arrays unfolded on the InSight lander in a clean room.',
    caption:
      'InSight’s UltraFlex arrays during testing. The study’s Mars arrays are the same design, scaled up to 12 m wings.',
    credit: 'NASA/JPL-Caltech/Lockheed Martin',
    nasaId: 'PIA22205',
  },
  battery: {
    src: 'media/cargo/iss063e049941.webp',
    alt: 'An astronaut in a spacesuit working on the space station’s truss during a spacewalk.',
    caption:
      'Installing lithium-ion batteries on the space station in 2020. The study’s Mars batteries are a newer lithium-sulfur type.',
    credit: 'NASA',
    nasaId: 'iss063e049941',
  },
  isru: {
    src: 'media/cargo/PIA24176.webp',
    alt: 'Engineers in clean-room suits lowering a gold-coloured box into a rover.',
    caption:
      'MOXIE going into Perseverance. It made oxygen from Martian air on Mars, at best 12 g an hour; the plant works the same way at about 2.2 kg an hour, some 180 times more.',
    credit: 'NASA/JPL-Caltech',
    nasaId: 'PIA24176',
  },
  foodSols: {
    src: 'media/cargo/iss068e008036.webp',
    alt: 'An astronaut eating from a spoon inside the space station.',
    caption:
      'A meal on the space station. Its food planning value, 2.39 kg a day with packaging, sets the mass here.',
    credit: 'NASA',
    nasaId: 'iss068e008036',
  },
  waterKg: {
    src: 'media/cargo/iss072e143163.webp',
    alt: 'An astronaut servicing filters on the space station’s water recovery system.',
    caption:
      'Servicing the space station’s water recovery system, which recycles the crew’s water.',
    credit: 'NASA',
    nasaId: 'iss072e143163',
  },
}

export const photoUrl = (p: CargoPhoto) => `${LIBRARY}${p.nasaId}`
