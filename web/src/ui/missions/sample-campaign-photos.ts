/**
 * NASA photo library references for Mission 2.6: "Sample campaign".
 * Authentic NASA rover imagery of sample coring, hermetic sealing, sedimentary strata, and mineral veins.
 */
export type SamplePhoto = {
  src: string
  alt: string
  caption: string
  credit: string
  page: string
}

const NASA_IMAGE_BASE = 'https://images.nasa.gov/details/'

export const SAMPLE_PHOTOS = {
  sampleTubeInspection: {
    src: 'media/sites/pia24482.webp',
    alt: 'Perseverance rover robotic arm holding a cored rock sample tube ready for sealing on Mars.',
    caption:
      'Perseverance sample caching system: titanium sample tube loaded with pristine Martian core before insertion into the hermetic seal assembly.',
    credit: 'NASA/JPL-Caltech',
    page: `${NASA_IMAGE_BASE}PIA24482`,
  },
  coreDrillHole: {
    src: 'media/sites/pia16726.webp',
    alt: 'Curiosity drill hole in Martian mudstone exposing fresh unoxidized grey interior.',
    caption:
      'John Klein drill hole in mudstone: exposing pristine organic-preserving clay minerals beneath the thin oxidized surface patina.',
    credit: 'NASA/JPL-Caltech',
    page: `${NASA_IMAGE_BASE}PIA16726`,
  },
  sedimentaryStrata: {
    src: 'media/sites/pia16068.webp',
    alt: 'Layered sedimentary rock strata on Mars showing ancient lakebed deposition.',
    caption:
      'Yellowknife Bay sedimentary strata: fine laminations recording prolonged lacustrine deposition and aqueous geochemical history.',
    credit: 'NASA/JPL-Caltech/MSSS',
    page: `${NASA_IMAGE_BASE}PIA16068`,
  },
  hermeticSeal: {
    src: 'media/sites/pia24840.webp',
    alt: 'Robotic inspection of hermetic titanium seal on a Mars sample tube.',
    caption:
      'Planetary Protection Category V containment: gold-coated sapphire seal brazed onto the titanium sleeve to prevent terrestrial back-contamination.',
    credit: 'NASA/JPL-Caltech',
    page: `${NASA_IMAGE_BASE}PIA24840`,
  },
  mineralVeins: {
    src: 'media/sites/pia19114.webp',
    alt: 'Intricate network of white mineral veins criss-crossing dark bedrock at Garden City on Mars.',
    caption:
      'Hydrothermal mineral veins at Garden City: cross-cutting fractures filled with hydrated calcium sulfate precipitated by ancient circulating fluids.',
    credit: 'NASA/JPL-Caltech/MSSS',
    page: `${NASA_IMAGE_BASE}PIA19114`,
  },
} as const
