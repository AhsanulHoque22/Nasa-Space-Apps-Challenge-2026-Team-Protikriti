/**
 * Mission 1.2: what is worth knowing at each certified landing site, pinned where it is.
 * Positions come from data, never placed by eye:
 * - Perseverance and Curiosity: the rover's position at the stop nearest the event's sol, from the
 *   image metadata of NASA's raw-image API (web/public/data/stops). Sols are from the dates the
 *   sources give, counted from each landing.
 * - Spirit: the PDS Geosciences Node corrected traverse (MERA_traverse.csv, science team, T. Parker),
 *   equirectangular about 175.5°E on the 3,396,190 m sphere, at the event's sol.
 * - Opportunity at Victoria crater: the lowest and highest points of the site's terrain model.
 *   The rover traverse is relative to the landing point, and anchoring it on published landing
 *   coordinates put Duck Bay ~370 m off the rim in this terrain, so rover positions are not pinned.
 * Distances quoted in the text were measured between these positions.
 */

export type SiteFeature = {
  name: string
  lon: number
  lat: number
  /** What was found here, with dates. */
  finding: string
  /** Why it matters to a crew choosing where to land. */
  forCrew: string
  /** How the pin's position was found. */
  located: string
  source: { label: string; url: string }
  /** A NASA image of the finding (public domain), from the NASA Image and Video Library. */
  photo: SitePhoto
}

export type SitePhoto = {
  /** Served path: a 960 px WebP made from the NASA original. */
  src: string
  alt: string
  /** What the image shows, from NASA's own description. */
  caption: string
  credit: string
  /** NASA Photojournal page for the original. */
  page: string
}

const photo = (id: string, alt: string, caption: string, credit: string): SitePhoto => ({
  src: `media/sites/${id.toLowerCase()}.webp`,
  alt,
  caption,
  credit,
  page: `https://photojournal.jpl.nasa.gov/catalog/${id}`,
})

export type SiteBrief = {
  siteId: string
  rover: string
  /** The site in two or three sentences. */
  summary: string
  /** Where the lander sets down (mission 1.3): a spot where a rover already landed safely. */
  touchdown: { name: string; lon: number; lat: number; located: string }
  features: readonly SiteFeature[]
}

const M20_STOPS = 'Perseverance stop'
const MSL_STOPS = 'Curiosity stop'
const SPIRIT_PDS = 'Spirit’s corrected traverse (PDS Geosciences Node)'

export const SITE_BRIEFS: readonly SiteBrief[] = [
  {
    siteId: 'jezero',
    rover: 'Perseverance',
    summary:
      'A 45 km crater that once held a lake. A river built a delta on its west side; Perseverance has driven from the flat floor onto that delta and up the valley that fed it.',
    touchdown: {
      name: 'Octavia E. Butler Landing, where Perseverance landed',
      lon: 77.450886,
      lat: 18.444627,
      located: `${M20_STOPS}, sol 13`,
    },
    features: [
      {
        name: 'Octavia E. Butler Landing',
        lon: 77.450886,
        lat: 18.444627,
        finding:
          'Perseverance touched down here on 18 February 2021, on the flat crater floor 2.5 km east of the delta front.',
        forCrew:
          'Flat floor to land on, with the delta rocks a short drive away: the pattern a crewed landing wants.',
        located: `${M20_STOPS}, sol 13: its first imaged position, before its first drive`,
        source: {
          label: 'Wikipedia: Octavia E. Butler Landing',
          url: 'https://en.wikipedia.org/wiki/Octavia_E._Butler_Landing',
        },
        photo: photo(
          'PIA24482',
          "Perseverance's wheel and rocky ground of the crater floor through a fisheye camera",
          'Hazcam view on 4 March 2021, as Perseverance drove for the first time, away from its landing site.',
          'NASA/JPL-Caltech',
        ),
      },
      {
        name: 'Rochette: the first rock core',
        lon: 77.444366,
        lat: 18.430739,
        finding:
          'On 1 September 2021 (sol 190) the drill cored the flat rock Rochette and sealed the first Martian rock sample, “Montdenier”. An attempt in August had crumbled to dust, leaving an empty tube.',
        forCrew:
          'Crews will drill for science and to test the ground: the first try here failed because the rock was too soft.',
        located: `${M20_STOPS}, sol 180: the rover stayed here until sol 199, spanning the drilling`,
        source: {
          label: 'CBS News: first rock sample confirmed',
          url: 'https://www.cbsnews.com/amp/news/nasa-perseverance-mars-rover-first-rock-sample-drilled-on-another-planet',
        },
        photo: photo(
          'PIA24840',
          "The flat rock Rochette with two small drill holes, beside the rover's wheel",
          'Rochette on 7 September 2021: the holes where the drill took the first samples, Montdenier and Montagnac.',
          'NASA/JPL-Caltech',
        ),
      },
      {
        name: 'Three Forks sample depot',
        lon: 77.407713,
        lat: 18.452554,
        finding:
          'From 21 December 2022 (sol 653) to 28 January 2023 Perseverance laid 10 sealed sample tubes here, 5 to 15 m apart: the first sample depot on another planet, a backup for Mars Sample Return.',
        forCrew:
          'A crew landing at Jezero would find a documented cache of samples already waiting on the surface.',
        located: `${M20_STOPS}, sol 652, the day before the first tube was dropped`,
        source: {
          label: 'NASA JPL: Perseverance deposits first sample',
          url: 'https://www.jpl.nasa.gov/news/nasas-perseverance-rover-deposits-first-sample-on-mars-surface',
        },
        photo: photo(
          'PIA25340',
          "A sealed sample tube lying on sandy ground beside the rover's wheel",
          'The 10th and last tube dropped at Three Forks, 28 January 2023 (sol 690), seen by the WATSON camera.',
          'NASA/JPL-Caltech/MSSS',
        ),
      },
      {
        name: 'Cheyava Falls',
        lon: 77.305274,
        lat: 18.497514,
        finding:
          'In July 2024 Perseverance drilled the “Sapphire Canyon” sample from this vein-filled rock beside Neretva Vallis, the river valley that fed the lake. Its “leopard spots” and organic compounds make it the team’s best candidate for a potential biosignature (Nature, 2025); processes without life could also explain them.',
        forCrew: 'Exactly the kind of open question a human geologist on site could help settle.',
        located: `${M20_STOPS}, sol 1210; NASA imaged the rock on 18 July 2024, sol 1212`,
        source: {
          label: 'NASA JPL: Meet the Mars samples, Sapphire Canyon',
          url: 'https://www.jpl.nasa.gov/videos/meet-the-mars-samples-sapphire-canyon-sample-25/',
        },
        photo: photo(
          'PIA26368',
          'Reddish rock crossed by white veins, with small dark-ringed spots',
          'Cheyava Falls on 18 July 2024 (sol 1212): white calcium sulfate veins with reddish bands between them.',
          'NASA/JPL-Caltech/MSSS',
        ),
      },
    ],
  },
  {
    siteId: 'gale',
    rover: 'Curiosity',
    summary:
      'A 154 km crater with Mount Sharp, a 5.5 km mound of layered rock, in the middle. Curiosity landed on the plain to the north in 2012 and has been climbing the mountain since 2014.',
    touchdown: {
      name: 'Bradbury Landing, where Curiosity landed',
      lon: 137.441633,
      lat: -4.589467,
      located: `${MSL_STOPS}, sol 3`,
    },
    features: [
      {
        name: 'Bradbury Landing',
        lon: 137.441633,
        lat: -4.589467,
        finding:
          'Curiosity landed here on 6 August 2012. Its RAD instrument then measured the radiation a crew would live in: about 0.67 mSv a day from cosmic rays at the surface (Hassler et al. 2014), against 1.8 mSv a day inside the spacecraft on the way.',
        forCrew:
          'About a third of the cruise dose rate, so the surface stay is the safer part of the trip.',
        located: `${MSL_STOPS}, sol 3: its first imaged position`,
        source: {
          label: 'SwRI: first radiation measurements from the surface of Mars',
          url: 'https://www.swri.org/press-release/swri-scientists-publish-first-radiation-measurements-surface-mars',
        },
        photo: photo(
          'PIA16068',
          'Layered slopes of Mount Sharp rising beyond a dark plain',
          'From Curiosity’s landing site toward the lower reaches of Mount Sharp.',
          'NASA/JPL-Caltech/MSSS',
        ),
      },
      {
        name: 'Yellowknife Bay: John Klein',
        lon: 137.44913,
        lat: -4.589485,
        finding:
          'Curiosity’s first drill hole, “John Klein”, on 8 February 2013 (sol 182), found mudstone that is 20 to 30% smectite clay: the bed of an ancient lake that could have supported microbes.',
        forCrew:
          'Clay minerals hold water bound in their structure, and this was the first rock shown to come from a habitable place.',
        located: `${MSL_STOPS}s, sols 166 and 274: the same spot, either side of the drilling`,
        source: {
          label: 'Sky & Telescope: habitable oasis on Mars',
          url: 'https://skyandtelescope.org/astronomy-news/habitable-oasis-on-mars/',
        },
        photo: photo(
          'PIA16726',
          'A round drill hole in flat grey mudstone, with grey powder around it',
          'The hole in John Klein from Curiosity’s first sample drilling on Mars.',
          'NASA/JPL-Caltech/MSSS',
        ),
      },
      {
        name: 'Pahrump Hills: the foot of Mount Sharp',
        lon: 137.377464,
        lat: -4.662699,
        finding:
          'Curiosity reached the base of Mount Sharp here in September 2014, after nearly 9 km of driving, and spent about six months on this outcrop, drilling the target “Confidence Hills”.',
        forCrew:
          'The mountain’s oldest layers start 5.8 km in a straight line from the landing site: the reason to land on this plain.',
        located: `${MSL_STOPS}, sol 753`,
        source: {
          label: 'Space.com: Curiosity arrives at its mountain destination',
          url: 'https://www.space.com/27123-curiosity-rover-mars-mountain-destination.html',
        },
        photo: photo(
          'PIA19114',
          'Pale outcrops and dunes seen from orbit, with the small rover among them',
          'Curiosity at Pahrump Hills, seen from orbit by the HiRISE camera on Mars Reconnaissance Orbiter.',
          'NASA/JPL-Caltech/Univ. of Arizona',
        ),
      },
      {
        name: 'Gediz Vallis: pure sulfur',
        lon: 137.408864,
        lat: -4.785707,
        finding:
          'On 30 May 2024 Curiosity drove over a rock here and cracked it open, showing yellow crystals of pure sulfur. Sulfur had been found on Mars only in sulfate minerals before; the team said the field of sulfur stones “shouldn’t be there”.',
        forCrew:
          'How it formed is still open: volcanic gas, hot water and unusual fluids have all been proposed.',
        located: `${MSL_STOPS}, sol 4200; the opened rock was imaged on sol 4205`,
        source: {
          label: 'Astrobiology.com: Curiosity discovers pure sulfur crystals',
          url: 'https://astrobiology.com/2024/07/22/curiosity-astrobiology-rover-discovers-pure-sulfur-crystals-on-mars/',
        },
        photo: photo(
          'PIA26307',
          'Pale yellow crystals in broken rock fragments',
          'Close-up of sulfur crystals inside the rock Curiosity crushed on 30 May 2024 (sol 4200), by its MAHLI camera.',
          'NASA/JPL-Caltech/MSSS',
        ),
      },
    ],
  },
  {
    siteId: 'columbia_hills',
    rover: 'Spirit',
    summary:
      'Gusev crater, 166 km across, was chosen as a possible ancient lake. Spirit landed on its plains in 2004 and drove to the Columbia Hills, where it found the evidence for water it was sent for.',
    touchdown: {
      name: 'Columbia Memorial Station, where Spirit landed',
      lon: 175.475837,
      lat: -14.565828,
      located: `${SPIRIT_PDS}, sol 1`,
    },
    features: [
      {
        name: 'Spirit’s landing site',
        lon: 175.475837,
        lat: -14.565828,
        finding:
          'Spirit came to rest on airbags here on 4 January 2004. The plains turned out to be volcanic basalt, not lake sediment.',
        forCrew:
          'So Spirit drove on into the Columbia Hills; Home Plate lies 3.5 km south-east of here. A landing site is only as good as what lies within driving range.',
        located: `${SPIRIT_PDS}, sol 1`,
        source: {
          label: 'Wikipedia: Spirit (rover)',
          url: 'https://en.wikipedia.org/wiki/Spirit_(rover)',
        },
        photo: photo(
          'PIA05117',
          "Spirit's empty lander with deflated airbags on a flat plain",
          '“Empty Nest”: Pancam mosaic of the landing site, the Columbia Memorial Station, with the lander Spirit drove off.',
          'NASA/JPL/Cornell',
        ),
      },
      {
        name: 'Husband Hill summit',
        lon: 175.52382,
        lat: -14.586965,
        finding:
          'Spirit reached the crest of Husband Hill in late August 2005 and drove to its true summit on sol 618: 106 m above the landing site.',
        forCrew: 'High ground gives a crew the view to plan safe drives across the terrain below.',
        located: `${SPIRIT_PDS}, sol 618`,
        source: {
          label: 'Phys.org: Spirit reaches true summit',
          url: 'https://phys.org/news/2005-10-spirit-true-summit.html',
        },
        photo: photo(
          'PIA04184',
          'A wide view over hills and plains from a hilltop',
          'Spirit’s view from the summit of Husband Hill (the centre of the panorama).',
          'NASA/JPL-Caltech/Cornell',
        ),
      },
      {
        name: 'Home Plate',
        lon: 175.525588,
        lat: -14.599602,
        finding:
          'An 80 m wide plateau of layered rock that Spirit reached on sol 744 (7 February 2006): an explosive volcanic deposit, where hot ash met water. Spirit spent its third Martian winter on its north edge.',
        forCrew:
          'Volcanic heat and water together are the setting of hot springs, a target in the search for past life.',
        located: `${SPIRIT_PDS}, sol 744`,
        source: {
          label: 'Wikipedia: Home Plate (Mars)',
          url: 'https://en.wikipedia.org/wiki/Home_Plate_(Mars)',
        },
        photo: photo(
          'PIA02055',
          'Layered, platy rock on the edge of Home Plate',
          'Spirit’s parting look at the layered rock of Home Plate (released 21 March 2006).',
          'NASA/JPL-Caltech/Cornell',
        ),
      },
      {
        name: 'Gertrude Weise: silica soil',
        lon: 175.526974,
        lat: -14.600465,
        finding:
          'On sol 1150 (29 March 2007) Spirit’s wheels churned up bright soil here that is about 90% silica. Water is needed to concentrate silica like this, as in hot springs or steam vents.',
        forCrew:
          'Spirit had worked within 50 m of this patch for 18 months without seeing it: finds hide just under the surface.',
        located: `${SPIRIT_PDS}, sol 1150`,
        source: {
          label: 'NASA JPL: Spirit unearths surprise evidence of a wetter past',
          url: 'https://www.jpl.nasa.gov/news/mars-rover-spirit-unearths-surprise-evidence-of-wetter-past/',
        },
        photo: photo(
          'PIA09491',
          'A streak of bright white soil in a wheel track',
          'The silica-rich soil churned up by Spirit’s wheels.',
          'NASA/JPL/Cornell',
        ),
      },
      {
        name: 'Troy: where Spirit got stuck',
        lon: 175.525373,
        lat: -14.600361,
        finding:
          'On 6 May 2009 (sol 1899) Spirit broke into soft soil here and never got out. It last called Earth on 22 March 2010.',
        forCrew:
          'Soft ground under a firm-looking crust is a real hazard: crews must test the ground before they drive or build on it.',
        located: `${SPIRIT_PDS}, sol 1899`,
        source: {
          label: 'Space.com: stuck on Mars, Spirit does science',
          url: 'https://www.space.com/6892-stuck-mars-spirit-rover-science.html',
        },
        photo: photo(
          'PIA12007',
          'A rover wheel sunk in pale, soft soil, seen through a fisheye camera',
          'Spirit’s front Hazcam on 6 May 2009 (sol 1899): wheels partly buried in soft ground at Troy.',
          'NASA/JPL-Caltech',
        ),
      },
    ],
  },
  {
    siteId: 'meridiani',
    rover: 'Opportunity',
    summary:
      'Flat, smooth plains near the equator, picked from orbit for grey hematite, a mineral that usually forms in water. At Eagle crater, about 6 km north of here, Opportunity found hematite “blueberries” and jarosite, a salt that forms only in acidic water.',
    touchdown: {
      name: 'Challenger Memorial Station, where Opportunity landed',
      lon: -5.5266,
      lat: -1.9462,
      located:
        'Published landing coordinates, 1.9462°S 354.4734°E (Wikipedia: Opportunity rover); about 6 km north of Victoria crater',
    },
    features: [
      {
        name: 'Victoria crater floor',
        lon: -5.494325,
        lat: -2.051074,
        finding:
          'Victoria crater is about 800 m wide and 70 m deep; in this terrain model the floor lies 76 m below the highest point of the rim. Opportunity drove in on sol 1293 and climbed out on sol 1634 (29 August 2008), studying the rock layers in its walls.',
        forCrew:
          'A crater wall is a ready-made cross-section: layers of rock a crew can read without drilling.',
        located: 'Lowest point of the site’s terrain model',
        source: {
          label: 'Wikipedia: Victoria (crater)',
          url: 'https://en.wikipedia.org/wiki/Victoria_(crater)',
        },
        photo: photo(
          'PIA08812',
          'A scalloped crater rim and dunes seen from orbit',
          'The Opportunity rover at the rim of Victoria crater, seen from orbit by HiRISE.',
          'NASA/JPL/University of Arizona',
        ),
      },
      {
        name: 'West rim, Duck Bay side',
        lon: -5.501489,
        lat: -2.048358,
        finding:
          'Opportunity reached the crater on 26 September 2006 (sol 951) at Duck Bay, an alcove in the western rim between the promontories Cape Verde and Cabo Frio, after 21 months of driving.',
        forCrew:
          'Rovers entered where the rim is broken down: crews would look for the same gentle ramps.',
        located:
          'Highest point of the terrain model, on the western rim; Duck Bay itself is not pinned because rover maps and this terrain differ by a few hundred metres',
        source: {
          label: 'Wikipedia: Victoria (crater)',
          url: 'https://en.wikipedia.org/wiki/Victoria_(crater)',
        },
        photo: photo(
          'PIA08783',
          'The far wall of a crater with layered cliffs',
          'Victoria crater from Duck Bay, Opportunity’s first view into it (the centre of the panorama).',
          'NASA/JPL-Caltech',
        ),
      },
    ],
  },
]
