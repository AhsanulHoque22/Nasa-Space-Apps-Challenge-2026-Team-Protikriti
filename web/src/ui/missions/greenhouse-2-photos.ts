/**
 * NASA photo library references for Mission 2.3: "Greenhouse scale-up".
 * Rich authentic NASA photography from Kennedy Space Center BPC and ISS plant experiments.
 */
import type { CropId } from '../../core/greenhouse'

export type Greenhouse2Photo = {
  src: string
  alt: string
  caption: string
  credit: string
  page: string
}

const NASA_IMAGE_BASE = 'https://images.nasa.gov/details/'

export const CROP_2_PHOTOS: Record<CropId, Greenhouse2Photo> = {
  potato: {
    src: 'media/greenhouse/ksc-95pc1196.webp',
    alt: 'Researchers harvesting white potatoes from trays in Kennedy Space Center growth chamber.',
    caption:
      'Potato harvest in Kennedy Space Center’s Biomass Production Chamber. Potatoes deliver the highest calorie density (77 kcal/100g) with 105 g/m²/day edible yield.',
    credit: 'NASA/KSC',
    page: `${NASA_IMAGE_BASE}KSC-95pc1196`,
  },
  wheat: {
    src: 'media/greenhouse/ksc-388c2096-08.webp',
    alt: 'Dense canopy of dwarf wheat growing under high-intensity lamps in round chamber.',
    caption:
      'Yecoro Rojo dwarf wheat in KSC Biomass Production Chamber. Provides complex carbohydrates and plant protein, requiring 115 mol/m²/day of photon flux.',
    credit: 'NASA/KSC',
    page: `${NASA_IMAGE_BASE}KSC-388c2096-08`,
  },
  soybean: {
    src: 'media/greenhouse/0201977.webp',
    alt: 'Soybean leaves and pods growing in small plant chamber aboard space station.',
    caption:
      'Soybeans in the Advanced Astroculture experiment on ISS. A critical source of essential plant lipids (18% fat) and complete protein (36.5%).',
    credit: 'NASA',
    page: `${NASA_IMAGE_BASE}0201977`,
  },
  lettuce: {
    src: 'media/cargo/KSC-20171017-PH_ISS01_0001.webp',
    alt: 'Mizuna mustard and red romaine lettuce growing under magenta LED arrays.',
    caption:
      'Veg-03D multi-crop trial on ISS. Lettuce matures in just 28 days to provide continuous fresh greens and vitamin A/C.',
    credit: 'NASA/KSC',
    page: `${NASA_IMAGE_BASE}KSC-20171017-PH_ISS01_0001`,
  },
  tomato: {
    src: 'media/greenhouse/iss068e045014.webp',
    alt: 'Astronaut Josh Cassada tending to dwarf tomato plants on the International Space Station.',
    caption:
      'Dwarf tomatoes bearing fruit in the ISS Veggie facility. Provides fresh potassium, lycopene, and a vital psychological morale boost for the crew.',
    credit: 'NASA',
    page: `${NASA_IMAGE_BASE}iss068e045014`,
  },
}

export const FACILITY_PHOTOS = {
  scalingHero: {
    src: 'media/greenhouse/ksc-391c6479-10.webp',
    alt: 'Researchers inspecting multi-tier hydroponic growth trays at NASA Kennedy Space Center.',
    caption:
      'Kennedy’s Biomass Production Chamber proved crops can be grown without soil continuously: nutrient-rich water flows through roots while LED arrays simulate sunlight.',
    credit: 'NASA/KSC',
    page: `${NASA_IMAGE_BASE}KSC-391c6479-10`,
  },
  powerStagger: {
    src: 'media/kilopower/kilopower-mars-base.webp',
    alt: 'Kilopower fission surface power farm deployed on Martian terrain.',
    caption:
      'Fission surface power farm: the 38.5 kWe grid restored in Mission 2.2 supplies energy for the 50 m² LED canopy. Staggered photoperiods prevent grid blackout.',
    credit: 'NASA/Langley',
    page: 'https://www.nasa.gov/directorates/stmd/game-changing-development-program/kilopower/',
  },
  waterLoop: {
    src: 'media/cargo/iss072e143163.webp',
    alt: 'Astronaut servicing condensing heat exchangers and water recycling loop.',
    caption:
      'Closed-loop atmospheric condensing heat exchangers recover over 95% of water transpired by crops, recycling moisture back into the root doser tanks.',
    credit: 'NASA',
    page: `${NASA_IMAGE_BASE}iss072e143163`,
  },
} as const
