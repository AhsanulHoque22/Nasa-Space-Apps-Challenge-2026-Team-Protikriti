/**
 * Photos and NASA visual references for Mission 2.1: Packing the second lander.
 * Matches the format and rich visual fidelity of Expedition 1.
 */
import type { Cargo2Item } from '../../core/cargo-2'

export type Cargo2Photo = {
  src: string
  alt: string
  caption: string
  credit: string
  nasaId: string
}

const NASA_IMAGE_BASE = 'https://images.nasa.gov/details/'

export const CARGO_2_PHOTOS: Record<Cargo2Item['id'], Cargo2Photo> = {
  stirlingSpare: {
    src: 'media/cargo/GRC-2015-C-06315.webp',
    alt: 'Technician working on a 10 kW Stirling power converter in a NASA laboratory.',
    caption:
      'A 10 kW Stirling power converter from NASA Glenn’s fission surface power test unit. Kilopower uses identical dual-opposed Stirling engines to turn reactor heat into electricity.',
    credit: 'NASA Glenn',
    nasaId: 'GRC-2015-C-06315',
  },
  eclssRefurb: {
    src: 'media/cargo/iss072e143163.webp',
    alt: 'An astronaut servicing water and air recycling filters on the International Space Station.',
    caption:
      'Servicing the space station’s Environmental Control and Life Support System (ECLSS). Catalytic oxidizers and sorbent beds must be renewed before full crew revival.',
    credit: 'NASA',
    nasaId: 'iss072e143163',
  },
  roverTreads: {
    src: 'media/traverse/jsc2008e138809.webp',
    alt: 'NASA pressurized rover wheel navigating across sharp, jagged volcanic rock test track.',
    caption:
      'Testing rover wheel mobility over jagged volcanic rocks at NASA JSC. Shape memory alloy spring tires replace punctured aluminum rims for long traverses.',
    credit: 'NASA/JSC',
    nasaId: 'jsc2008e138809',
  },
  greenhouseExtM2: {
    src: 'media/greenhouse/ksc-20171017-ph_iss01_0001.webp',
    alt: 'Lettuce and mustard greens flourishing under magenta LED arrays in the Veggie chamber.',
    caption:
      'Veg-03D experiment on the ISS. The 50 m² expansion kit adds modular aeroponic trays, nutrient dosers, and high-efficiency horticultural LEDs to the habitat.',
    credit: 'NASA/KSC',
    nasaId: 'KSC-20171017-PH_ISS01_0001',
  },
  rassorMiner: {
    src: 'media/ice/ksc-20160929-ph_dng01_0001.webp',
    alt: 'NASA RASSOR robotic excavator scooping regolith with counter-rotating bucket drums at Kennedy Space Center.',
    caption:
      'NASA’s RASSOR excavation robot testing at Kennedy Space Center. Its opposing bucket drums excavate dense regolith and subsurface ice without pushing the rover away in 0.38g.',
    credit: 'NASA/KSC',
    nasaId: 'ksc-20160929-ph_dng01_0001',
  },
  deepDrillKit: {
    src: 'media/sites/pia16726.webp',
    alt: 'Close-up of Curiosity drill hole in Martian rock with fresh grey tailings in Gale Crater.',
    caption:
      'Curiosity’s first drill hole at the “John Klein” site in Gale Crater. The 2-metre rotary-percussive coring kit samples unweathered astrobiological targets.',
    credit: 'NASA/JPL-Caltech',
    nasaId: 'PIA16726',
  },
  foodBufferSols: {
    src: 'media/cargo/iss068e008036.webp',
    alt: 'Astronaut enjoying packaged meal inside ISS galley.',
    caption:
      'Shelf-stable NASA flight rations: vacuum-sealed retort pouches and freeze-dried meals provide 2,800 kcal per crew-sol with 3-year shelf life.',
    credit: 'NASA',
    nasaId: 'iss068e008036',
  },
  freshFoodPack: {
    src: 'media/greenhouse/iss068e045014.webp',
    alt: 'Astronaut watering fresh dwarf tomato plants bearing fruit inside ISS Veggie facility.',
    caption:
      'Astronaut Josh Cassada tending dwarf tomatoes on ISS. Packaged microgreen seeds, vitamin supplements, and culinary herbs supply essential micronutrients and morale.',
    credit: 'NASA',
    nasaId: 'iss068e045014',
  },
}

export const cargo2PhotoUrl = (p: Cargo2Photo) => `${NASA_IMAGE_BASE}${p.nasaId}`
