/**
 * NASA photo library references for Mission 2.4: "Ice mining at scale".
 * Authentic NASA imagery covering RASSOR excavation, Phoenix subsurface ice, and ISS potable water.
 */
export type IceMiningPhoto = {
  src: string
  alt: string
  caption: string
  credit: string
  page: string
}

const NASA_IMAGE_BASE = 'https://images.nasa.gov/details/'

export const MINING_PHOTOS = {
  orbitalRadar: {
    src: 'media/ice/pia22077.webp',
    alt: 'HiRISE orbital color image of exposed blue-tinted glacial ice scarps on Mars.',
    caption:
      'HiRISE image of erosion scarps exposing sheets of pure water ice under a thin 1 to 2 metre regolith lag deposit in the Martian mid-latitudes.',
    credit: 'NASA/JPL/Univ. of Arizona',
    page: `${NASA_IMAGE_BASE}PIA22077`,
  },
  rassorVehicle: {
    src: 'media/ice/ksc-20160929-ph_dng01_0001.webp',
    alt: 'NASA RASSOR 2.0 excavator robot with dual counter-rotating bucket drums at Kennedy Space Center.',
    caption:
      'NASA’s RASSOR excavation robot testing at Kennedy Space Center. Opposing drums cancel digging reaction forces, enabling excavation in Mars’s 0.38g gravity.',
    credit: 'NASA/KSC',
    page: `${NASA_IMAGE_BASE}KSC-20160929-PH_DNG01_0001`,
  },
  rassorDrumDig: {
    src: 'media/ice/ksc-20160929-ph_dng01_0039.webp',
    alt: 'Close-up of RASSOR counter-rotating drum teeth biting into dense regolith test bin.',
    caption:
      'Close-up of RASSOR’s bucket drums scooping dense soil. Each drum fills progressively as it rotates, hauling up to 150 kg of icy material per sortie.',
    credit: 'NASA/KSC',
    page: `${NASA_IMAGE_BASE}KSC-20160929-PH_DNG01_0039`,
  },
  phoenixIce: {
    src: 'media/ice/pia10906.webp',
    alt: 'Robotic trench in Martian soil exposing chunks of bright white water ice that sublimated over 4 sols.',
    caption:
      'NASA’s Phoenix lander trench in 2008: exposed white water ice chunks sublimated into vapor over 4 sols under thin 600 Pa Martian atmospheric pressure.',
    credit: 'NASA/JPL-Caltech/Univ. of Arizona',
    page: `${NASA_IMAGE_BASE}PIA10906`,
  },
  potableWater: {
    src: 'media/cargo/iss030e122089.webp',
    alt: 'Astronaut Dan Burbank opening a clear potable water storage bag inside the space station.',
    caption:
      'Expedition 30 commander Dan Burbank sampling potable water on the ISS. Multi-stage filtration removes salts and perchlorates to meet NASA drinking standards.',
    credit: 'NASA',
    page: `${NASA_IMAGE_BASE}iss030e122089`,
  },
  pipelineManifold: {
    src: 'media/cargo/iss072e143163.webp',
    alt: 'Astronaut servicing fluid loops and catalytic reactor beds on the space station.',
    caption:
      'Purification manifold servicing: catalytic reduction beds and high-pressure reverse osmosis membranes convert raw melt into potable reserve water.',
    credit: 'NASA',
    page: `${NASA_IMAGE_BASE}iss072e143163`,
  },
} as const
