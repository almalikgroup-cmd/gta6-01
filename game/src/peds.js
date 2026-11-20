// Pedestrians: they stroll the sidewalks and the beach, chat in pairs, flee
// screaming (silently) from gunfire, reckless cars and flying fists, and fall
// when hit — then get back up and run off. They are also the city's eyes:
// crimes they witness feed the wanted system in main.js.

import { CFG, PED_SHIRTS } from './config.js';
import { rrange, pick } from './random.js';
import { collideWorld, isOnSidewalk } from './world.js';

// Walkable ground for pedestrians: a sidewalk band, the beach, or a park —
// but never asphalt. (At intersections the sidewalk bands cross the other
// road's asphalt, so both checks are needed.)
export function isWalkable(world, x, y) {
  const half = CFG.roadHalf - 2;
  for (const rx of world.roadsV) if (Math.abs(x - rx) < half && y < world.beachRoadY + half) return false;
  for (const ry of [...world.roadsH, world.beachRoadY]) if (Math.abs(y - ry) < half) return false;
  if (y > CFG.beachY + 4) return true;
  if (isOnSidewalk(world, x, y)) return true;
  for (const p of world.parks) if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return true;
  return false;
}

export function spawnPeds(world, rng, count = CFG.pedCount) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const onBeach = rng() < 0.18;
    let x = 100, y = 100;
    for (let tries = 0; tries < 10; tries++) {
      if (onBeach) {
        x = rrange(rng, 80, world.w - 80);
        y = rrange(rng, CFG.beachY + 30, CFG.seaY - 40);
      } else if (rng() < 0.5) {
        const rx = pick(rng, world.roadsV);
        x = rx + (rng() < 0.5 ? -1 : 1) * (CFG.roadHalf + 10);
        y = rrange(rng, 70, world.beachRoadY - 40);
      } else {
        const ry = pick(rng, [...world.roadsH, world.beachRoadY]);
        y = ry + (rng() < 0.5 ? -1 : 1) * (CFG.roadHalf + 10);
        x = rrange(rng, 70, world.w - 70);
      }
      if (isWalkable(world, x, y)) break;
    }
    peds.push({
      x, y, angle: rng() * Math.PI * 2,
      vx: 0, vy: 0,
      radius: 9,
      speed: rrange(rng, 34, 58),
      shirt: pick(rng, PED_SHIRTS),
      skin: pick(rng, ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
      hair: pick(rng, ['#2d2a26', '#6b4a2b', '#c9a86a', '#111111', '#8a8d91']),
      state: 'walk',           // walk | flee | down | crew
      target: null,
      retarget: rrange(rng, 0, 3),
      fleeT: 0, downT: 0,
      walkPhase: rng() * 6,
      panic: 0,
    });
  }
  return peds;
}

function pickStrollTarget(world, rng, ped) {
  // Wander: a new point a short stroll away, on walkable ground only —
  // pedestrians use sidewalks, parks and the beach, they don't jaywalk.
  for (let tries = 0; tries < 8; tries++) {
    const x = ped.x + rrange(rng, -260, 260);
    const y = ped.y + rrange(rng, -260, 260);
    if (x < 30 || y < 30 || x > world.w - 30 || y > CFG.seaY + 10) continue;
    if (isWalkable(world, x, y)) return { x, y };
  }
  return { x: ped.x, y: ped.y };
}

export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.state === 'down' || p.state === 'crew') continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.state = 'flee';
      p.fleeT = rrange(G.rng, 1.4, 2.6);
      p.panic = 1;
      p.fleeFrom = { x, y };
    }
  }
}

export function knockDown(G, ped, cause) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downT = cause === 'shot' ? 9999 : rrange(G.rng, 3, 5);
  ped.vx = 0; ped.vy = 0;
  G.spawnParticles?.(ped.x, ped.y, 5, 'stars');
}

export function updatePeds(G, dt) {
  const rng = G.rng;
  const player = G.player;
  for (const p of G.peds) {
    if (p.state === 'down') {
      p.downT -= dt;
      if (p.downT <= 0) { p.state = 'flee'; p.fleeT = 1.6; p.fleeFrom = { x: player.x, y: player.y }; }
      continue;
    }
    if (p.state === 'crew') continue; // handled by missions (follows the player)
    if (p.state === 'wait') { p.walkPhase += dt * 1.6; continue; } // mission crew, standing by

    // Danger sense: fast cars, any occupied car that gets close, and a
    // sprinting armed player are all worth running from.
    let danger = null;
    const cars = [...G.cars, ...G.police];
    for (const c of cars) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (Math.abs(c.speed) > 130 && d < 64) { danger = c; break; }
      if (c.driver && d < 40) { danger = c; break; }
    }
    if (!danger && p.panic > 0.4 && Math.hypot(player.x - p.x, player.y - p.y) < 50 && player.armed) danger = player;

    if (p.state === 'flee') {
      p.fleeT -= dt;
      const from = p.fleeFrom || player;
      const dx = p.x - from.x, dy = p.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 168;
      p.vx = (dx / d) * sp; p.vy = (dy / d) * sp;
      p.angle = Math.atan2(p.vy, p.vx);
      if (p.fleeT <= 0) { p.state = 'walk'; p.target = null; p.panic = 0; }
    } else if (danger) {
      p.state = 'flee';
      p.fleeT = 1.4;
      p.fleeFrom = { x: danger.x, y: danger.y };
      continue;
    } else {
      p.retarget -= dt;
      if (!p.target || p.retarget <= 0 || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 14) {
        p.target = pickStrollTarget(G.world, rng, p);
        p.retarget = rrange(rng, 4, 9);
      }
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.vx = (dx / d) * p.speed; p.vy = (dy / d) * p.speed;
      p.angle = Math.atan2(p.vy, p.vx);
      if (p.panic > 0) p.panic = Math.max(0, p.panic - dt * 0.4);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    collideWorld(G.world, p, p.radius);
    p.walkPhase += dt * (p.state === 'flee' ? 13 : 7);

    // Run over: a fast car knocks a pedestrian down (a crime if witnessed).
    for (const c of cars) {
      if (Math.abs(c.speed) > 60 && Math.hypot(c.x - p.x, c.y - p.y) < c.radius + p.radius - 2) {
        knockDown(G, p, 'car');
        if (c === player.car || c.driver === 'player') G.onPedHit?.(p, 'car');
        break;
      }
    }
  }
}
