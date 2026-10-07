/** What Perseverance found at Jezero's delta. Each line is from the cited source; samples are NASA's. */

export type DeltaFact = {
  title: string
  text: string
  /** Official Mars 2020 sample numbers this fact is about, if any. */
  samples: number[]
  source: { label: string; url: string }
}

export const DELTA_FACTS: readonly DeltaFact[] = [
  {
    title: 'A delta built into a lake',
    text:
      'From the crater floor, the rover imaged Kodiak, a butte west of its landing site with rock ' +
      'layers up to 25 m high. The layers slope like the front of an underwater delta, so Jezero once ' +
      'held a lake; boulder beds near the top record later floods.',
    samples: [],
    source: {
      label: 'Mangold et al. 2021, Science 374 (doi:10.1126/science.abl4051)',
      url: 'https://doi.org/10.1126/science.abl4051',
    },
  },
  {
    title: 'Up the delta front, from sol 441',
    text:
      'On 17 May 2022 (sol 441) Perseverance entered the Hawksbill Gap channel and began climbing the ' +
      'delta front, where it filled nine sample tubes: seven rock cores and two of loose regolith.',
    samples: [10, 11, 12, 13, 14, 15, 16, 17, 18],
    source: {
      label: 'NASA Science, Mars Rock Samples (Perseverance)',
      url: 'https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/',
    },
  },
  {
    title: 'Wildcat Ridge: a salty lake bed',
    text:
      'Wildcat Ridge, a rock about 1 m wide, likely formed as mud and fine sand settled in an ' +
      'evaporating saltwater lake. The SHERLOC instrument found organic molecules there alongside ' +
      'sulfate minerals. Chemical processes that do not need life can make these molecules; the ' +
      'cores taken from this rock are samples 12 and 13.',
    samples: [12, 13],
    source: {
      label: 'NASA JPL, 15 Sept 2022: Perseverance investigates geologically rich terrain',
      url: 'https://www.jpl.nasa.gov/news/nasas-perseverance-rover-investigates-geologically-rich-mars-terrain',
    },
  },
  {
    title: 'Hogwallow Flats: the finest grains',
    text:
      'Higher on the delta, light striped rocks the team nicknamed "the Bacon Strip" are very fine ' +
      'grained, the kind of rock with the best chance of keeping traces of ancient life, if there ever was any.',
    samples: [],
    source: {
      label: 'NASA Science blog: Fine-grained rocks at Hogwallow Flats',
      url: 'https://science.nasa.gov/blogs/fine-grained-rocks-at-hogwallow-flats',
    },
  },
]
