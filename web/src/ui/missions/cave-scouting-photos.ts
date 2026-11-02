/**
 * NASA photo library references for Mission 2.5: "Cave scouting".
 * Authentic NASA orbital and rover imagery of Martian volcanic skylights and basalt lava tubes.
 */
export type CavePhoto = {
  src: string
  alt: string
  caption: string
  credit: string
  page: string
}

const NASA_IMAGE_BASE = 'https://images.nasa.gov/details/'

export const CAVE_PHOTOS = {
  arsiaSkylight: {
    src: 'media/sites/pia08812.webp',
    alt: 'HiRISE image showing a dark circular skylight pit dropping into a subterranean cavern on Arsia Mons.',
    caption:
      'Candidate cave entrance on Arsia Mons: HiRISE orbital view of a 110-metre circular collapse pit with a sheer vertical drop into a subterranean basaltic lava tube.',
    credit: 'NASA/JPL/Univ. of Arizona',
    page: `${NASA_IMAGE_BASE}PIA08812`,
  },
  roverApproach: {
    src: 'media/traverse/jsc2008e138809.webp',
    alt: 'Pressurized rover navigating across rough volcanic basalt test track at NASA Johnson Space Center.',
    caption:
      'Pressurized rover approaching the volcanic rim. Shape memory alloy tires deform over sharp basalt scree to navigate the 16° entrance ramp without puncture.',
    credit: 'NASA/JSC',
    page: `${NASA_IMAGE_BASE}jsc2008e138809`,
  },
  pavonisPits: {
    src: 'media/sites/pia09491.webp',
    alt: 'HiRISE image showing a chain of collapse pits and linear volcanic troughs on Pavonis Mons.',
    caption:
      'Chain of collapse pit craters on Pavonis Mons. These features trace underground lava tube conduits where magma drained during Mars’s volcanic past.',
    credit: 'NASA/JPL/Univ. of Arizona',
    page: `${NASA_IMAGE_BASE}PIA09491`,
  },
  volcanicCaldera: {
    src: 'media/sites/pia02055.webp',
    alt: 'Orbital view of volcanic caldera and deep channel collapses on Ceraunius Tholus.',
    caption:
      'Ceraunius Tholus volcanic flank: thick basalt strata provide natural shielding, attenuating cosmic rays and damping diurnal temperature swings.',
    credit: 'NASA/JPL/MSSS',
    page: `${NASA_IMAGE_BASE}PIA02055`,
  },
  subsurfaceRock: {
    src: 'media/sites/pia16726.webp',
    alt: 'Curiosity drill hole in Martian rock revealing unweathered grey interior beneath oxidized red dust.',
    caption:
      'Subsurface basalt core inspection: shielded from cosmic radiation and wind-blown dust, interior lava tube rock remains chemically unweathered.',
    credit: 'NASA/JPL-Caltech',
    page: `${NASA_IMAGE_BASE}PIA16726`,
  },
} as const
