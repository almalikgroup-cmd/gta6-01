// Builds the city of Solmar from a seed: a road grid with lanes, sidewalks
// and crosswalks, pastel building blocks with collision, parking lots, parks,
// palm trees, a beach and the sea along the south edge, plus named landmarks
// the missions use (garage, hideout, hospital, police station...).

import { CFG, PALETTE, BUILDING_COLORS } from './config.js';
import { makeRng, rrange, rint, pick, chance } from './random.js';

// Road centreline positions. Vertical roads stop at the beachfront avenue;
// horizontal roads span the full width.
export const ROADS_V = [320, 900, 1480, 2060, 2640];
export const ROADS_H = [300, 800, 1300, 1800];
export const BEACH_ROAD_Y = 2000;

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const W = CFG.worldW, H = CFG.worldH;
  const buildings = [];
  const palms = [];
  const props = [];       // {x, y, kind: 'lamp'|'hydrant'|'bench'|'umbrella', r}
  const parkingSpots = []; // {x, y, angle} places a parked car may sit
  const lots = [];         // parking lot rects (drawn, with stall lines)
  const parks = [];        // park rects (drawn greener, palms inside)

  const roadHalf = CFG.roadHalf;
  const margin = roadHalf + CFG.sidewalk + 14; // building-free band around roads

  // ---- city blocks between the roads -------------------------------------
  const xEdges = [0, ...ROADS_V, W];
  const yEdges = [0, ...ROADS_H, BEACH_ROAD_Y];
  for (let xi = 0; xi < xEdges.length - 1; xi++) {
    for (let yi = 0; yi < yEdges.length - 1; yi++) {
      const bx = xEdges[xi] + margin;
      const by = yEdges[yi] + margin;
      const bw = xEdges[xi + 1] - xEdges[xi] - margin * 2;
      const bh = yEdges[yi + 1] - yEdges[yi] - margin * 2;
      if (bw < 120 || bh < 120) continue;
      const roll = rng();
      if (roll < 0.16) {
        // Parking lot block.
        lots.push({ x: bx, y: by, w: bw, h: bh });
        const cols = Math.max(2, Math.floor(bw / 64));
        const rows = Math.max(1, Math.floor(bh / 84));
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (chance(rng, 0.55)) {
              parkingSpots.push({
                x: bx + 34 + c * 64, y: by + 42 + r * 84,
                angle: chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2,
              });
            }
          }
        }
      } else if (roll < 0.30) {
        // Park block: grass, palms, benches, no buildings.
        parks.push({ x: bx, y: by, w: bw, h: bh });
        const n = rint(rng, 4, 8);
        for (let i = 0; i < n; i++) {
          palms.push({ x: rrange(rng, bx + 20, bx + bw - 20), y: rrange(rng, by + 20, by + bh - 20), s: rrange(rng, 0.85, 1.25) });
        }
        for (let i = 0; i < 3; i++) {
          props.push({ x: rrange(rng, bx + 16, bx + bw - 16), y: rrange(rng, by + 16, by + bh - 16), kind: 'bench', r: 8 });
        }
      } else {
        // Building block: 2–4 pastel buildings with gaps between them.
        const cols = bw > 380 ? 2 : 1;
        const rows = bh > 300 ? 2 : 1;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const cw = bw / cols, ch = bh / rows;
            const pad = rrange(rng, 10, 26);
            const b = {
              x: bx + c * cw + pad,
              y: by + r * ch + pad,
              w: cw - pad * 2,
              h: ch - pad * 2,
              color: pick(rng, BUILDING_COLORS),
              floors: rint(rng, 2, 6),
              seed: rng() * 1000,
            };
            if (b.w > 60 && b.h > 60) buildings.push(b);
          }
        }
      }
    }
  }

  // ---- beach: palms, umbrellas, a lifeguard hut strip --------------------
  for (let x = 60; x < W - 40; x += rrange(rng, 90, 170)) {
    palms.push({ x, y: rrange(rng, CFG.beachY + 26, CFG.seaY - 130), s: rrange(rng, 0.9, 1.4) });
    if (chance(rng, 0.6)) props.push({ x: x + rrange(rng, 24, 60), y: rrange(rng, CFG.beachY + 40, CFG.seaY - 60), kind: 'umbrella', r: 13, color: pick(rng, ['#ff6b81', '#feca57', '#48dbfb', '#ff9ff3']) });
  }
  // Palms along the beachfront avenue and the main north–south avenue.
  for (let y = 120; y < CFG.beachY - 60; y += rrange(rng, 130, 210)) {
    palms.push({ x: 1480 - roadHalf - 34, y, s: rrange(rng, 0.85, 1.15) });
    palms.push({ x: 1480 + roadHalf + 34, y: y + 60, s: rrange(rng, 0.85, 1.15) });
  }
  for (let x = 120; x < W - 80; x += rrange(rng, 140, 220)) {
    palms.push({ x, y: BEACH_ROAD_Y - 52, s: rrange(rng, 0.85, 1.2) });
  }
  // Street lamps + hydrants along sidewalks.
  for (const rx of ROADS_V) {
    for (let y = 90; y < CFG.beachY; y += 190) {
      props.push({ x: rx - roadHalf - 10, y, kind: 'lamp', r: 5 });
      if (chance(rng, 0.4)) props.push({ x: rx + roadHalf + 10, y: y + 80, kind: 'hydrant', r: 5 });
    }
  }

  // Roadside parking bays on quieter streets.
  for (const ry of [800, 1300]) {
    for (let x = 140; x < W - 120; x += rrange(rng, 150, 260)) {
      if (ROADS_V.some((rx) => Math.abs(x - rx) < 130)) continue;
      parkingSpots.push({ x, y: ry - roadHalf - 24, angle: 0 });
    }
  }

  // Ammo/health pickups at fixed, learnable spots.
  const pickups = [
    { x: 940, y: 340, kind: 'ammo' },
    { x: 2100, y: 840, kind: 'ammo' },
    { x: 560, y: 1560, kind: 'ammo' },
    { x: 2760, y: 1560, kind: 'ammo' },
    { x: 1520, y: 2060, kind: 'ammo' },
    { x: 380, y: 380, kind: 'health' },   // hospital corner
    { x: 2900, y: 1900, kind: 'health' }, // beach clinic
  ];

  const points = {
    spawn: { x: 1480, y: 1930 },                       // beachfront, facing the city
    hospital: { x: 380, y: 330 },
    policeStation: { x: 2680, y: 330 },
    garage: { x: 2520, y: 1330 },                      // M2 delivery
    hideout: { x: 240, y: 1900 },                      // M3 escape target / mission hub
    missionStart: { x: 240, y: 1840 },                 // glowing "$" beacon by the hideout
    m1Pickup: { x: 2920, y: 420 },                     // NE warehouse corner
    m1Drop: { x: 420, y: 1420 },                       // SW drop-off
    m3Beach: { x: 2350, y: 2150 },                     // crew member waits on the sand
  };

  return {
    w: W, h: H, buildings, palms, props, parkingSpots, lots, parks, pickups, points,
    roadsV: ROADS_V, roadsH: ROADS_H, beachRoadY: BEACH_ROAD_Y,
    rng,
  };
}

// ---- geometry helpers -----------------------------------------------------

// Push a circle out of every building rect (and keep it inside the world and
// out of the sea). Returns true when a collision was resolved.
export function collideWorld(world, e, r) {
  let hit = false;
  for (const b of world.buildings) {
    const nx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - nx, dy = e.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        e.x = nx + (dx / d) * r;
        e.y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest penetration.
        const left = e.x - b.x, right = b.x + b.w - e.x;
        const top = e.y - b.y, bottom = b.y + b.h - e.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) e.x = b.x - r;
        else if (m === right) e.x = b.x + b.w + r;
        else if (m === top) e.y = b.y - r;
        else e.y = b.y + b.h + r;
      }
    }
  }
  if (e.x < r) { e.x = r; hit = true; }
  if (e.y < r) { e.y = r; hit = true; }
  if (e.x > world.w - r) { e.x = world.w - r; hit = true; }
  if (e.y > CFG.seaY + 26) { e.y = CFG.seaY + 26; hit = true; } // nobody swims today
  return hit;
}

export function isOnRoad(world, x, y) {
  const m = CFG.roadHalf + 4;
  if (Math.abs(y - world.beachRoadY) < 56) return true;
  for (const rx of world.roadsV) if (Math.abs(x - rx) < m && y < world.beachRoadY) return true;
  for (const ry of world.roadsH) if (Math.abs(y - ry) < m) return true;
  return false;
}

export function isOnSidewalk(world, x, y) {
  const inner = CFG.roadHalf - 2, outer = CFG.roadHalf + CFG.sidewalk + 2;
  for (const rx of world.roadsV) {
    const d = Math.abs(x - rx);
    if (d > inner && d < outer && y < world.beachRoadY + outer) return true;
  }
  for (const ry of [...world.roadsH, world.beachRoadY]) {
    const d = Math.abs(y - ry);
    if (d > inner && d < outer) return true;
  }
  return false;
}

// Nearest point on any road centreline — used to drop police onto the grid.
export function nearestRoadPoint(world, x, y) {
  let best = null, bd = Infinity;
  for (const rx of world.roadsV) {
    const cy = Math.max(40, Math.min(y, world.beachRoadY));
    const d = (x - rx) ** 2 + (y - cy) ** 2;
    if (d < bd) { bd = d; best = { x: rx, y: cy, axis: 'v' }; }
  }
  for (const ry of [...world.roadsH, world.beachRoadY]) {
    const cx = Math.max(40, Math.min(x, world.w - 40));
    const d = (x - cx) ** 2 + (y - ry) ** 2;
    if (d < bd) { bd = d; best = { x: cx, y: ry, axis: 'h' }; }
  }
  return best;
}

export { PALETTE };
