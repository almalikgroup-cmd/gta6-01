// SOLMAR HEAT — central tuning constants and palette.
// Everything gameplay-related that a designer might tweak lives here so the
// rest of the code stays free of magic numbers.

export const CFG = {
  worldW: 3200,
  worldH: 2400,
  seaY: 2240,        // water starts here
  beachY: 2060,      // sand starts here
  roadHalf: 64,      // half width of a normal road (asphalt)
  laneOffset: 32,    // traffic lane distance from road centreline
  sidewalk: 20,      // sidewalk band outside the asphalt

  playerRadius: 11,
  playerWalk: 150,
  playerSprint: 245,
  playerHealth: 100,

  carRadius: 17,
  trafficCount: 26,
  parkedCount: 30,
  pedCount: 42,
  policeMax: 8,

  punchRange: 30,
  punchCooldown: 0.32,
  gunRange: 340,
  gunCooldown: 0.19,

  bustTime: 2.6,        // seconds of being cornered before arrest
  bustRadius: 58,
  sprintDust: 0.13,     // seconds between dust puffs while sprinting
  hornRadius: 130,      // how far a car horn startles pedestrians
  witnessPedRadius: 165,
  witnessCopRadius: 320,
  heatDecay: 7,         // heat per second while unseen
  heatDecayFast: 16,    // decay while far from any cop

  saveKey: 'solmar-heat-save-v1',
};

// Wanted level thresholds on the hidden "heat" meter.
export const HEAT_LEVELS = [0, 40, 110, 200, 320, 480];

export const PALETTE = {
  grass: '#79b657',
  grassDark: '#6aa84c',
  park: '#8fce6a',
  sand: '#eed9a0',
  sandDark: '#e3c98c',
  water: '#2e9bc6',
  waterDeep: '#2386ad',
  foam: '#d9f4fb',
  asphalt: '#4a4a52',
  asphaltDark: '#3f3f46',
  laneMark: '#f5d76e',
  sidewalk: '#cbb9a0',
  sidewalkEdge: '#b7a586',
  crosswalk: '#e8e4da',
  parking: '#5b5b63',
  palmTrunk: '#8a6b46',
  palmLeaf: '#3f9e4d',
  palmLeafDark: '#2f7d3c',
};

// Pastel building paints typical of a sun-soaked coastal city.
export const BUILDING_COLORS = [
  '#f6c6a5', '#f2a9a2', '#f9e29c', '#bfe3c0', '#a8d8ea',
  '#f7b7d3', '#ffd8a8', '#c5cbe8', '#e8b4b8', '#a2d2ff',
  '#ffc8dd', '#bde0fe', '#caffbf', '#fdffb6', '#f4e1c1',
];

export const CAR_COLORS = [
  '#e74c3c', '#f39c12', '#f1c40f', '#ecf0f1', '#3498db',
  '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6', '#fd79a8',
  '#00cec9', '#6c5ce7', '#dfe6e9', '#fab1a0', '#55efc4',
];

export const PED_SHIRTS = [
  '#ff7675', '#74b9ff', '#ffeaa7', '#55efc4', '#fd79a8',
  '#a29bfe', '#fdcb6e', '#81ecec', '#fab1a0', '#ffffff',
];
