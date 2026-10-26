/** What a user learns by clicking a piece of hardware on the map, each fact with its source. */

export type Fact = { text: string; source: { label: string; url: string } }
export type FactImage = { src: string; alt: string; caption: string; credit: string }
export type HardwareFacts = {
  title: string
  facts: readonly Fact[]
  images: readonly FactImage[]
  /** Where to read more. */
  links: readonly { label: string; url: string }[]
}

const HACKADAY = {
  label: 'Hackaday: Kilopower, NASA’s offworld nuclear reactor (2019)',
  url: 'https://hackaday.com/2019/08/28/kilopower-nasas-offworld-nuclear-reactor/',
}
const MARIN = {
  label: 'Daniel Marín, Eureka: Un reactor nuclear para las misiones de la NASA (2017, Spanish)',
  url: 'https://danielmarin.naukas.com/2017/09/27/un-reactor-nuclear-para-las-misiones-de-la-nasa/',
}
const SPACE_COM = {
  label: 'Space.com: Nuclear reactor for Mars outpost could be ready to fly by 2022',
  url: 'https://www.space.com/nuclear-reactor-for-mars-outpost-2022.html',
}
const RUCKER = {
  label: 'Rucker et al. 2016, Solar Versus Fission Surface Power for Mars (NASA)',
  url: 'https://ntrs.nasa.gov/citations/20160010550',
}

export const KILOPOWER_FACTS: HardwareFacts = {
  title: 'Kilopower: a small fission reactor',
  facts: [
    {
      text: 'Developed by NASA’s Glenn Research Center and Los Alamos National Laboratory since 2015, in sizes from 1 to 10 kW of electricity.',
      source: MARIN,
    },
    {
      text: 'A uranium-235 core about the size of a paper-towel roll heats sodium heat pipes; they carry the heat to Stirling engines that turn it into electricity, and a radiator sheds what is left.',
      source: HACKADAY,
    },
    {
      text: 'The 1 kW prototype ran in 2017 and 2018: eight Stirling engines of about 125 W each.',
      source: HACKADAY,
    },
    {
      text: 'A complete 10 kW unit is about 3.4 m tall; the map draws it at that height.',
      source: SPACE_COM,
    },
    {
      text: 'NASA’s Mars base study chose fission over solar mainly because global dust storms threaten solar power. Four units deliver 35 kW day and night, and must stand at least 1 km from the habitat.',
      source: RUCKER,
    },
  ],
  images: [
    {
      src: 'media/kilopower/kilopower-mars-base.webp',
      alt: 'Four Kilopower reactors with umbrella radiators, cabled to a power box on the Martian surface',
      caption: 'Four 10 kW reactors powering a crewed Mars base (concept).',
      credit: 'NASA, via Daniel Marín’s Eureka blog',
    },
    {
      src: 'media/kilopower/kilopower-radiator.webp',
      alt: 'A Kilopower reactor column under a wide circular radiator',
      caption: 'The 10 kW reactor with its radiator deployed (concept).',
      credit: 'NASA, via Daniel Marín’s Eureka blog',
    },
    {
      src: 'media/kilopower/kilopower-design.webp',
      alt: 'Cut-away drawings of the Kilopower reactor: core, heat pipes, Stirling engines and radiator',
      caption: 'Inside: core at the bottom, heat pipes up to the Stirling engines, radiator above.',
      credit: 'NASA, via Daniel Marín’s Eureka blog',
    },
  ],
  links: [HACKADAY, MARIN, SPACE_COM, RUCKER],
}
