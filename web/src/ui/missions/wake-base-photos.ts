/**
 * NASA photo library references for Mission 2.2: "Wake the base".
 * Authentic NASA imagery and technical figures for Mars base revival.
 */
export type WakePhoto = {
  src: string
  alt: string
  caption: string
  credit: string
  page: string
}

const NASA_IMAGE_BASE = 'https://images.nasa.gov/details/'

export const WAKE_PHOTOS = {
  outpostDormancy: {
    src: 'media/kilopower/kilopower-mars-base.webp',
    alt: 'NASA concept of a human outpost on Mars with surface fission reactors and habitat modules.',
    caption:
      'NASA surface base architecture in cold dormancy: the habitat and Kilopower fission farm stood uncrewed for ~800 sols awaiting the arrival of Expedition 2.',
    credit: 'NASA/Langley',
    page: 'https://www.nasa.gov/directorates/stmd/game-changing-development-program/kilopower/',
  },
  stirlingTesting: {
    src: 'media/cargo/GRC-2015-C-06315.webp',
    alt: 'Technician working on a 10 kW Stirling power converter in a NASA Glenn laboratory.',
    caption:
      'A 10 kW Stirling power converter in NASA Glenn’s test unit. Dual-opposed pistons produce electrical current from sodium heat pipes at 100 Hz.',
    credit: 'NASA Glenn',
    page: `${NASA_IMAGE_BASE}GRC-2015-C-06315`,
  },
  reactorDesign: {
    src: 'media/kilopower/kilopower-design.webp',
    alt: 'Engineering schematic of the Kilopower reactor core, sodium heat pipes, and radiator panels.',
    caption:
      'Kilopower reactor schematic: heat from U-235 fission travels through sodium heat pipes to drive Stirling converters and reject waste heat via titanium-water radiators.',
    credit: 'NASA Glenn/LANL',
    page: `${NASA_IMAGE_BASE}GRC-2015-C-06315`,
  },
  eclssFilters: {
    src: 'media/cargo/iss072e143163.webp',
    alt: 'Astronaut servicing air and water recovery filters on the International Space Station.',
    caption:
      'Astronaut servicing the Environmental Control and Life Support System (ECLSS). Catalytic oxidation beds and amine sorbent filters remove trace volatile contaminants and CO2.',
    credit: 'NASA',
    page: `${NASA_IMAGE_BASE}iss072e143163`,
  },
  radiatorPanel: {
    src: 'media/kilopower/kilopower-radiator.webp',
    alt: 'Titanium-water heat pipe radiator panel assembly deployed in clean room.',
    caption:
      'Kilopower deployable radiator panels: fine Martian dust settles during seasonal storms, diminishing heat emissivity by up to 35% if uncleaned.',
    credit: 'NASA Glenn',
    page: `${NASA_IMAGE_BASE}GRC-2015-C-06315`,
  },
  roverArrival: {
    src: 'media/traverse/jsc2008e138809.webp',
    alt: 'Pressurized rover chassis navigating rocky Mars-analog terrain at NASA JSC.',
    caption:
      'Expedition 2 pressurized rover standing outside the habitat airlock as environmental systems power up for crew ingress.',
    credit: 'NASA/JSC',
    page: `${NASA_IMAGE_BASE}jsc2008e138809`,
  },
} as const
