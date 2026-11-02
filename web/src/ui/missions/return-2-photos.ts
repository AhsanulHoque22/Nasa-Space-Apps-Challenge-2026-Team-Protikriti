/**
 * NASA photo library references for Mission 2.7: "Return & Handover".
 * Authentic NASA rover, orbital, ascent rocket, and splashdown return imagery.
 */
export type ReturnPhoto = {
  src: string
  alt: string
  caption: string
  credit: string
  page: string
}

const NASA_IMAGE_BASE = 'https://images.nasa.gov/details/'

export const RETURN_2_PHOTOS = {
  earthEveningStar: {
    src: 'media/return/pia17936.webp',
    alt: 'Earth as a bright solitary evening star glowing over a dark Martian horizon, seen by Curiosity.',
    caption:
      'Earth as the evening star from Mars: seen by Curiosity from Gale crater. The destination planet glowing 225 million kilometers across the interplanetary void.',
    credit: 'NASA/JPL-Caltech/MSSS/TAMU',
    page: 'https://photojournal.jpl.nasa.gov/catalog/PIA17936',
  },
  mavAscentPlume: {
    src: 'media/landing/pia24285.webp',
    alt: 'Rocket engine thrust plume illuminating the Martian surface during powered ascent.',
    caption:
      'Mars Ascent Vehicle (MAV) propulsion: LOX/CH4 rocket engines igniting to lift the crew and 15 kg of pristine samples into low Mars orbit.',
    credit: 'NASA/JPL-Caltech',
    page: `${NASA_IMAGE_BASE}PIA24285`,
  },
  orionSplashdown: {
    src: 'media/return/ksc-314d-0556_0010.webp',
    alt: 'NASA Orion crew return capsule floating in the Pacific Ocean supported by bright orange flotation bags.',
    caption:
      'Earth arrival splashdown: NASA Orion crew exploration vehicle floating safely in the Pacific Ocean after direct atmospheric entry from Mars.',
    credit: 'NASA/KSC',
    page: `${NASA_IMAGE_BASE}KSC-314D-0556_0010`,
  },
  crewInHab: {
    src: 'media/cargo/iss072e143163.webp',
    alt: 'Expedition crew members collaborating in high-tech orbital flight module.',
    caption:
      'Interplanetary transit module: Expedition 2 crew completing the 195-day coast back to Earth following trans-Earth injection.',
    credit: 'NASA/JSC',
    page: `${NASA_IMAGE_BASE}iss072e143163`,
  },
  sampleCanisterStow: {
    src: 'media/sites/pia24482.webp',
    alt: 'Perseverance titanium sample tube secured in robotic caching mechanism.',
    caption:
      'Category V sample cache: titanium tubes stowed inside the central MAV payload bay for transfer to Earth analytical containment facilities.',
    credit: 'NASA/JPL-Caltech',
    page: `${NASA_IMAGE_BASE}PIA24482`,
  },
} as const
