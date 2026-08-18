import {
  flightHoursConstraint,
  regionConstraint,
  tagConstraint,
} from '../constraints'
import type {
  QuestionGraph,
  QuestionNode,
  QuestionOption,
  Vibe,
} from '../types'

/**
 * The decision graph (R4), as data. Branching lives in `option.next`, so deriving a
 * path is a walk and re-deriving it after an edit (R6) is the same walk with no
 * special case.
 *
 * Every node carries a `no-preference` option whose `constraints` is `[]`, and every
 * root-to-leaf path is between 3 and 5 questions long (A5). Both are enforced by
 * tests/question-graph.test.ts rather than by inspection.
 *
 * The Beach branch is the designer's reference implementation and ships exactly as
 * written in docs/03-design.md §4 S3.
 */

const NO_PREFERENCE_DESCRIPTION = "We'll pick this one for you."

function noPreference(next: string | null): QuestionOption {
  return {
    id: 'no-preference',
    label: 'No preference',
    description: NO_PREFERENCE_DESCRIPTION,
    next,
    constraints: [],
    preferTags: [],
  }
}

/** Q1 for every vibe: the national / international fork the brief asks for. */
function regionNode(
  vibe: Vibe,
  branches: { domestic: string; international: string; neutral: string },
): QuestionNode {
  const id = `${vibe}-region`
  return {
    id,
    prompt: 'Within India, or international?',
    defaultOptionId: 'no-preference',
    options: [
      {
        id: 'within-india',
        label: 'Within India',
        description: 'Shorter flights, no visa, fewer surprises.',
        next: branches.domestic,
        constraints: [regionConstraint('domestic')],
        preferTags: [],
      },
      {
        id: 'international',
        label: 'International',
        description: 'Passport out, more time in the air.',
        next: branches.international,
        constraints: [regionConstraint('international')],
        preferTags: [],
      },
      noPreference(branches.neutral),
    ],
  }
}

/** Only ever reachable from "International" — the word long-haul never appears elsewhere. */
function haulNode(vibe: Vibe, next: string): QuestionNode {
  const id = `${vibe}-haul`
  return {
    id,
    prompt: 'Happy with a long-haul flight, or keep it short?',
    defaultOptionId: 'no-preference',
    options: [
      {
        id: 'under-6h',
        label: 'Under 6 hours',
        description: 'Southeast Asia, the Gulf, Sri Lanka.',
        next,
        constraints: [flightHoursConstraint(id, 6)],
        preferTags: ['short-haul'],
      },
      {
        id: 'long-haul',
        label: 'Happy with long-haul',
        description: 'Anywhere the budget reaches.',
        next,
        constraints: [],
        preferTags: ['long-haul'],
      },
      noPreference(next),
    ],
  }
}

/** The last question on every path: it steers the stay tier, not the destination. */
const STAY_STYLE: QuestionNode = {
  id: 'stay-style',
  prompt: 'Resort comfort or local stays?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'resort-comfort',
      label: 'Resort comfort',
      description: 'Pool, service, predictable.',
      next: null,
      constraints: [],
      preferTags: ['resort-comfort'],
    },
    {
      id: 'local-stays',
      label: 'Local stays',
      description: 'Homestays and small properties.',
      next: null,
      constraints: [],
      preferTags: ['local-stays'],
    },
    noPreference(null),
  ],
}

// ------------------------------------------------------------------- beach ---

const BEACH_COAST: QuestionNode = {
  id: 'beach-coast',
  prompt: 'Which coast are you drawn to?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'west-coast',
      label: 'West coast',
      description: 'Konkan, Goa, Karnataka.',
      next: 'beach-crowd',
      constraints: [
        tagConstraint('beach-coast', 'west-coast', 'west coast', 'we looked at every coast'),
      ],
      preferTags: ['west-coast'],
    },
    {
      id: 'east-coast',
      label: 'East coast',
      description: 'Tamil Nadu, Andhra, Odisha.',
      next: 'beach-crowd',
      constraints: [
        tagConstraint('beach-coast', 'east-coast', 'east coast', 'we looked at every coast'),
      ],
      preferTags: ['east-coast'],
    },
    {
      // The islands branch skips the lively/empty question: every island in this
      // catalogue is the quiet answer, so asking would be theatre. It is also the
      // branch that makes R6 visible — changing this answer re-derives what follows.
      id: 'islands',
      label: 'Islands',
      description: 'Andaman & Lakshadweep.',
      next: 'stay-style',
      constraints: [
        tagConstraint('beach-coast', 'islands', 'island', 'we looked at the mainland too'),
      ],
      preferTags: ['islands', 'quiet'],
    },
    noPreference('beach-crowd'),
  ],
}

const BEACH_CROWD: QuestionNode = {
  id: 'beach-crowd',
  prompt: 'Lively beach or empty beach?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'lively',
      label: 'Lively',
      description: 'Shacks, music, people around.',
      next: 'stay-style',
      constraints: [
        tagConstraint('beach-crowd', 'lively', 'lively', 'we included quieter beaches'),
      ],
      preferTags: ['lively', 'nightlife'],
    },
    {
      id: 'empty',
      label: 'Empty',
      description: 'Long walks, nobody there.',
      next: 'stay-style',
      constraints: [tagConstraint('beach-crowd', 'quiet', 'empty', 'we included busier beaches')],
      preferTags: ['quiet'],
    },
    {
      id: 'mixed',
      label: 'One lively night, otherwise quiet',
      description: 'A bit of both.',
      next: 'stay-style',
      constraints: [],
      preferTags: ['quiet', 'lively'],
    },
    noPreference('stay-style'),
  ],
}

// --------------------------------------------------------------- mountains ---

const MOUNTAINS_RANGE: QuestionNode = {
  id: 'mountains-range',
  prompt: 'Himalaya, or the Northeast?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'himalaya',
      label: 'Himalaya',
      description: 'Himachal, Uttarakhand, the far north.',
      next: 'mountains-town',
      constraints: [
        tagConstraint('mountains-range', 'himalaya', 'Himalayan', 'we widened the search'),
      ],
      preferTags: ['himalaya'],
    },
    {
      id: 'northeast',
      label: 'Northeast',
      description: 'Sikkim, Meghalaya, Arunachal.',
      next: 'mountains-town',
      constraints: [
        tagConstraint('mountains-range', 'northeast', 'Northeastern', 'we widened the search'),
      ],
      preferTags: ['northeast'],
    },
    noPreference('mountains-town'),
  ],
}

const MOUNTAINS_TOWN: QuestionNode = {
  id: 'mountains-town',
  prompt: 'A hill town with cafés, or a valley with nobody in it?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'town',
      label: 'A hill town',
      description: 'Cafés, bakeries, other people.',
      next: 'stay-style',
      constraints: [
        tagConstraint('mountains-town', 'lively', 'busy hill town', 'we included quieter valleys'),
      ],
      preferTags: ['lively'],
    },
    {
      id: 'valley',
      label: 'An empty valley',
      description: 'Walks, weather, silence.',
      next: 'stay-style',
      constraints: [
        tagConstraint('mountains-town', 'quiet', 'quiet valley', 'we included busier hill towns'),
      ],
      preferTags: ['quiet'],
    },
    noPreference('stay-style'),
  ],
}

// ------------------------------------------------------------------- party ---

const PARTY_DOMESTIC: QuestionNode = {
  id: 'party-domestic',
  prompt: 'The west coast, or a city?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'west-coast',
      label: 'West coast',
      description: 'Beach shacks and sunset sets.',
      next: 'party-scene',
      constraints: [
        tagConstraint('party-domestic', 'west-coast', 'west coast', 'we looked further afield'),
      ],
      preferTags: ['west-coast'],
    },
    {
      id: 'city',
      label: 'A city',
      description: 'Bars, gigs, somewhere open late.',
      next: 'party-scene',
      constraints: [tagConstraint('party-domestic', 'city', 'city', 'we included the coast')],
      preferTags: ['city'],
    },
    noPreference('party-scene'),
  ],
}

const PARTY_SCENE: QuestionNode = {
  id: 'party-scene',
  prompt: 'Beach shacks, or a proper city night?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'shacks',
      label: 'Beach shacks',
      description: 'Sand underfoot, music until late.',
      next: 'stay-style',
      constraints: [tagConstraint('party-scene', 'coast', 'beachfront', 'we included cities')],
      preferTags: ['coast', 'lively'],
    },
    {
      id: 'city-night',
      label: 'A proper city night',
      description: 'Clubs, rooftops, taxis home at four.',
      next: 'stay-style',
      constraints: [tagConstraint('party-scene', 'nightlife', 'city nightlife', 'we included the coast')],
      preferTags: ['nightlife', 'city'],
    },
    noPreference('stay-style'),
  ],
}

// --------------------------------------------------------------- honeymoon ---

const HONEYMOON_DOMESTIC: QuestionNode = {
  id: 'honeymoon-domestic',
  prompt: 'By the sea, or up in the hills?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'sea',
      label: 'By the sea',
      description: 'Long evenings, salt in the air.',
      next: 'honeymoon-setting',
      constraints: [tagConstraint('honeymoon-domestic', 'coast', 'seaside', 'we included the hills')],
      preferTags: ['coast', 'romantic'],
    },
    {
      id: 'hills',
      label: 'Up in the hills',
      description: 'Cold mornings, big views.',
      next: 'honeymoon-setting',
      constraints: [tagConstraint('honeymoon-domestic', 'mountain', 'hill', 'we included the coast')],
      preferTags: ['mountain', 'romantic'],
    },
    noPreference('honeymoon-setting'),
  ],
}

const HONEYMOON_SETTING: QuestionNode = {
  id: 'honeymoon-setting',
  prompt: 'Just the two of you, or somewhere with plenty going on?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'just-us',
      label: 'Just the two of us',
      description: 'Quiet, slow, nobody we know.',
      next: 'stay-style',
      constraints: [
        tagConstraint('honeymoon-setting', 'romantic', 'quiet romantic', 'we included busier places'),
      ],
      preferTags: ['romantic', 'quiet'],
    },
    {
      id: 'plenty-on',
      label: 'Plenty going on',
      description: 'Places to eat, things to do, some noise.',
      next: 'stay-style',
      constraints: [
        tagConstraint('honeymoon-setting', 'lively', 'lively', 'we included quieter places'),
      ],
      preferTags: ['lively', 'food'],
    },
    noPreference('stay-style'),
  ],
}

// ------------------------------------------------------------------- peace ---

const PEACE_DOMESTIC: QuestionNode = {
  id: 'peace-domestic',
  prompt: 'Backwaters and beaches, or the hills?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'water',
      label: 'Backwaters and beaches',
      description: 'Water, palms, very little to do.',
      next: 'peace-company',
      constraints: [tagConstraint('peace-domestic', 'coast', 'coastal', 'we included the hills')],
      preferTags: ['coast', 'backwater', 'quiet'],
    },
    {
      id: 'hills',
      label: 'The hills',
      description: 'Cold air, tea, long silences.',
      next: 'peace-company',
      constraints: [tagConstraint('peace-domestic', 'mountain', 'hill', 'we included the coast')],
      preferTags: ['mountain', 'quiet'],
    },
    noPreference('peace-company'),
  ],
}

const PEACE_COMPANY: QuestionNode = {
  id: 'peace-company',
  prompt: 'How empty is empty enough?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'nobody',
      label: 'Nobody around',
      description: 'A village, a beach, one café.',
      next: 'stay-style',
      constraints: [
        tagConstraint('peace-company', 'quiet', 'genuinely quiet', 'we included busier places'),
      ],
      preferTags: ['quiet'],
    },
    {
      id: 'some-life',
      label: 'Quiet, but some life',
      description: 'Somewhere to eat, someone to talk to.',
      next: 'stay-style',
      constraints: [],
      preferTags: ['quiet', 'food'],
    },
    noPreference('stay-style'),
  ],
}

// ----------------------------------------------------------------- culture ---

const CULTURE_DOMESTIC: QuestionNode = {
  id: 'culture-domestic',
  prompt: 'Coastal towns, or the hills?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'coastal-towns',
      label: 'Coastal towns',
      description: 'Old ports, churches, fish markets.',
      next: 'culture-focus',
      constraints: [tagConstraint('culture-domestic', 'coast', 'coastal', 'we included the hills')],
      preferTags: ['coast', 'heritage'],
    },
    {
      id: 'hill-towns',
      label: 'The hills',
      description: 'Monasteries, markets, mountain food.',
      next: 'culture-focus',
      constraints: [tagConstraint('culture-domestic', 'mountain', 'hill', 'we included the coast')],
      preferTags: ['mountain', 'heritage'],
    },
    noPreference('culture-focus'),
  ],
}

const CULTURE_FOCUS: QuestionNode = {
  id: 'culture-focus',
  prompt: 'Old stones, or long meals?',
  defaultOptionId: 'no-preference',
  options: [
    {
      id: 'heritage',
      label: 'Old stones',
      description: 'Forts, temples, museums, walls.',
      next: 'stay-style',
      constraints: [
        tagConstraint('culture-focus', 'heritage', 'heritage', 'we widened the search'),
      ],
      preferTags: ['heritage'],
    },
    {
      id: 'food',
      label: 'Long meals',
      description: 'Markets, street food, one good dinner.',
      next: 'stay-style',
      constraints: [tagConstraint('culture-focus', 'food', 'food', 'we widened the search')],
      preferTags: ['food'],
    },
    noPreference('stay-style'),
  ],
}

// ------------------------------------------------------------------- graph ---

const NODES: QuestionNode[] = [
  regionNode('beach', {
    domestic: 'beach-coast',
    international: 'beach-haul',
    neutral: 'beach-crowd',
  }),
  haulNode('beach', 'beach-crowd'),
  BEACH_COAST,
  BEACH_CROWD,

  regionNode('mountains', {
    domestic: 'mountains-range',
    international: 'mountains-haul',
    neutral: 'mountains-town',
  }),
  haulNode('mountains', 'mountains-town'),
  MOUNTAINS_RANGE,
  MOUNTAINS_TOWN,

  regionNode('party', {
    domestic: 'party-domestic',
    international: 'party-haul',
    neutral: 'party-scene',
  }),
  haulNode('party', 'party-scene'),
  PARTY_DOMESTIC,
  PARTY_SCENE,

  regionNode('honeymoon', {
    domestic: 'honeymoon-domestic',
    international: 'honeymoon-haul',
    neutral: 'honeymoon-setting',
  }),
  haulNode('honeymoon', 'honeymoon-setting'),
  HONEYMOON_DOMESTIC,
  HONEYMOON_SETTING,

  regionNode('peace', {
    domestic: 'peace-domestic',
    international: 'peace-haul',
    neutral: 'peace-company',
  }),
  haulNode('peace', 'peace-company'),
  PEACE_DOMESTIC,
  PEACE_COMPANY,

  regionNode('culture', {
    domestic: 'culture-domestic',
    international: 'culture-haul',
    neutral: 'culture-focus',
  }),
  haulNode('culture', 'culture-focus'),
  CULTURE_DOMESTIC,
  CULTURE_FOCUS,

  STAY_STYLE,
]

export const QUESTION_GRAPH: QuestionGraph = {
  entry: {
    mountains: 'mountains-region',
    beach: 'beach-region',
    party: 'party-region',
    honeymoon: 'honeymoon-region',
    peace: 'peace-region',
    culture: 'culture-region',
  },
  nodes: Object.fromEntries(NODES.map((node) => [node.id, node])),
}
