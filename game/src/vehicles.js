// Cars: parked cars, lane-following traffic that brakes for obstacles, and
// police interceptors that chase and ram. Cars are circles for collision and
// rounded rectangles when drawn; traffic steers toward waypoints placed on
// lane centrelines at each intersection, which makes turns smooth.

import { CFG, CAR_COLORS } from './config.js';
import { rrange, pick, shuffle } from './random.js';
import { collideWorld, nearestRoadPoint } from './world.js';

let nextId = 1;

export function makeCar(x, y, angle, color, kind = 'civilian') {
  return {
    id: nextId++,
    x, y, angle, speed: 0,
    vx: 0, vy: 0,
    color, kind,               // 'civilian' | 'police' | 'mission'
    radius: CFG.carRadius,
    health: 100,
    driver: null,              // 'traffic' | 'police' | 'player' | null (parked)
    waypoint: null,
    target: null,              // traffic navigation target {wp, axis, dir, road}
    axis: 'v', dir: 1,         // current lane direction for traffic AI
    ramCooldown: 0,
    cruise: 150,
    stuck: 0,
    smokeT: 0,
    sirenPhase: Math.random() * 6,
    honkT: 0,
  };
}

export function spawnParkedCars(world, rng) {
  const cars = [];
  const spots = shuffle(rng, [...world.parkingSpots]);
  const n = Math.min(CFG.parkedCount, spots.length);
  for (let i = 0; i < n; i++) {
    const s = spots[i];
    cars.push(makeCar(s.x, s.y, s.angle, pick(rng, CAR_COLORS)));
  }
  return cars;
}

// A random point on a random lane, used to seed traffic across the city.
function randomLanePoint(world, rng) {
  const vertical = rng() < 0.55;
  if (vertical) {
    const rx = pick(rng, world.roadsV);
    const dir = rng() < 0.5 ? 1 : -1;
    return { x: rx + dir * CFG.laneOffset, y: rrange(rng, 80, world.beachRoadY - 60), axis: 'v', dir, road: rx };
  }
  const ry = pick(rng, [...world.roadsH, world.beachRoadY]);
  const dir = rng() < 0.5 ? 1 : -1;
  return { x: rrange(rng, 80, world.w - 80), y: ry + dir * CFG.laneOffset, axis: 'h', dir, road: ry };
}

// The next waypoint for a lane-following car standing near (x, y).
function nextWaypoint(world, rng, car) {
  const L = CFG.laneOffset;
  const intersections = car.axis === 'v' ? [...world.roadsH, world.beachRoadY] : world.roadsV;
  // Find the next intersection ahead.
  let ahead = null;
  for (const c of intersections) {
    const pos = car.axis === 'v' ? car.y : car.x;
    const d = (c - pos) * car.dir;
    if (d > 30 && (ahead === null || d < ahead.d)) ahead = { c, d };
  }
  if (!ahead) {
    // Reached the end of the road: U-turn onto the opposite lane.
    car.dir *= -1;
    return lanePoint(world, car, car.axis === 'v' ? car.y : car.x);
  }
  // Decide at this intersection: mostly straight, sometimes a turn.
  const turn = rng() < 0.34;
  const target = { cross: ahead.c };
  if (turn) {
    const newDir = rng() < 0.5 ? 1 : -1;
    target.axis = car.axis === 'v' ? 'h' : 'v';
    target.dir = newDir;
    target.road = ahead.c;
    // Waypoint sits on the new lane, just past the intersection.
    if (target.axis === 'h') target.wp = { x: car.x + newDir * 150, y: ahead.c + newDir * L };
    else target.wp = { x: ahead.c + newDir * L, y: car.y + newDir * 150 };
  } else {
    target.axis = car.axis;
    target.dir = car.dir;
    target.road = car.axis === 'v' ? Math.round(car.x - car.dir * L) : Math.round(car.y - car.dir * L);
    if (car.axis === 'v') target.wp = { x: target.road + car.dir * L, y: ahead.c + car.dir * 260 };
    else target.wp = { x: ahead.c + car.dir * 260, y: target.road + car.dir * L };
  }
  return target;
}

function nearestRoad(world, car) {
  const list = car.axis === 'v' ? world.roadsV : world.roadsH;
  let best = list[0], bd = Infinity;
  for (const r of list) {
    const pos = car.axis === 'v' ? car.x : car.y;
    const d = Math.abs(pos - r);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

function lanePoint(world, car, along) {
  const L = CFG.laneOffset;
  const road = nearestRoad(world, car);
  if (car.axis === 'v') return { axis: 'v', dir: car.dir, road, wp: { x: road + car.dir * L, y: along + car.dir * 200 }, cross: null };
  return { axis: 'h', dir: car.dir, road, wp: { x: along + car.dir * 200, y: road + car.dir * L }, cross: null };
}

export function spawnTraffic(world, rng, count = CFG.trafficCount) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomLanePoint(world, rng);
    const car = makeCar(p.x, p.y, p.axis === 'v' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI), pick(rng, CAR_COLORS));
    car.driver = 'traffic';
    car.axis = p.axis; car.dir = p.dir;
    car.cruise = rrange(rng, 120, 185);
    car.speed = car.cruise * 0.7;
    car.target = nextWaypoint(world, rng, car);
    cars.push(car);
  }
  return cars;
}

export function spawnPolice(world, rng, nearX, nearY) {
  // Drop the interceptor on a road, off-screen but close enough to matter.
  for (let tries = 0; tries < 12; tries++) {
    const a = rng() * Math.PI * 2;
    const d = rrange(rng, 520, 720);
    const x = Math.max(40, Math.min(world.w - 40, nearX + Math.cos(a) * d));
    const y = Math.max(40, Math.min(world.beachRoadY, nearY + Math.sin(a) * d));
    const rp = nearestRoadPoint(world, x, y);
    const car = makeCar(rp.x, rp.y, 0, '#f4f6f8', 'police');
    car.driver = 'police';
    car.cruise = 265;
    car.health = 160;
    return car;
  }
  const car = makeCar(nearX + 560, nearY, Math.PI, '#f4f6f8', 'police');
  car.driver = 'police';
  car.cruise = 265;
  car.health = 160;
  return car;
}

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Obstacle scan ahead of a car: anything solid within `dist` in its lane.
// Returns { e, along } for the nearest hit, or null.
function obstacleAhead(G, car, dist) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let best = null;
  const check = (e, r) => {
    const dx = e.x - car.x, dy = e.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 6 || along > dist) return;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < r + 13 && (!best || along < best.along)) best = { e, along };
  };
  for (const o of G.cars) { if (o !== car) check(o, o.radius); }
  for (const p of G.police) { if (p !== car) check(p, p.radius); }
  if (G.player.car !== car) check(G.player, G.player.radius + 4);
  for (const p of G.peds) { if (!p.down && p.state !== 'down') check(p, 10); }
  return best;
}

export function updateTrafficCar(G, car, dt) {
  const rng = G.rng;
  if (!car.target) car.target = nextWaypoint(G.world, rng, car);
  const wp = car.target.wp;
  const dx = wp.x - car.x, dy = wp.y - car.y;
  const distWp = Math.hypot(dx, dy);
  if (distWp < 42) {
    car.axis = car.target.axis; car.dir = car.target.dir;
    car.target = nextWaypoint(G.world, rng, car);
  }
  const desired = Math.atan2(dy, dx);
  car.angle = angleLerp(car.angle, desired, Math.min(1, dt * 3.2));

  let target = car.cruise;
  const ob = obstacleAhead(G, car, 88);
  // Anti-gridlock: a car blocked for a few seconds by a pedestrian (or by a
  // queue that is itself dissolving) creeps forward slowly; pedestrians
  // step out of the way of an occupied car that gets close.
  if (car.creepT > 0) car.creepT -= dt;
  const blockedByPed = ob && G.peds.includes(ob.e);
  if (ob && !(car.creepT > 0 && blockedByPed)) {
    // Follow behaviour: match the leader's speed, stopping only when close.
    const leadSpeed = ob.e.speed !== undefined ? Math.abs(ob.e.speed) : Math.hypot(ob.e.vx || 0, ob.e.vy || 0);
    if (ob.along < 46) target = 0;
    else target = Math.min(car.cruise, leadSpeed + (ob.along - 46) * 1.4);
    if (car.speed < 12 && target < 12) {
      car.stuck += dt;
      if (car.stuck > 3.5 && blockedByPed) { car.creepT = 1.3; car.stuck = 0; }
      if (car.stuck > 9) {
        // Hopeless queue: reroute — aim for a fresh waypoint and roll gently.
        car.target = nextWaypoint(G.world, rng, car);
        car.stuck = 0;
        car.creepT = 0.8;
        target = 40;
      }
    }
    // Drivers lean on the horn when a pedestrian or the player blocks the lane.
    if (car.honkT <= 0 && (ob.e === G.player || blockedByPed)) {
      G.sfx?.horn();
      car.honkT = rrange(rng, 2.5, 5);
    }
  } else {
    if (car.stuck > 0) car.stuck = Math.max(0, car.stuck - dt * 2);
    if (car.creepT > 0) target = 46;
    else {
      const obFar = obstacleAhead(G, car, 140);
      if (obFar) target = car.cruise * 0.5;
    }
  }
  if (car.honkT > 0) car.honkT -= dt;
  car.speed += Math.max(-260 * dt, Math.min(150 * dt, target - car.speed));
  if (car.speed < 0) car.speed = 0;
  moveCar(G, car, dt);
}

export function updatePoliceCar(G, car, dt) {
  const target = G.player.car ? G.player.car : G.player;
  // Aim at a predicted position so intercepts cut corners.
  const lead = 0.45;
  const tx = target.x + (target.vx || 0) * lead;
  const ty = target.y + (target.vy || 0) * lead;
  const dx = tx - car.x, dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const desired = Math.atan2(dy, dx);
  car.angle = angleLerp(car.angle, desired, Math.min(1, dt * 2.6));

  const playerSlow = !G.player.car || Math.abs(G.player.car.speed) < 26;
  let target2 = car.cruise + G.wanted * 9;
  if (dist < 90 && playerSlow) target2 = 0;              // cornered: stop and bust
  else if (dist < 150) target2 = Math.min(target2, 120); // close in carefully
  const ob = obstacleAhead(G, car, 60);
  if (ob && ob.e !== target && ob.e.kind !== 'police') target2 = Math.min(target2, 30);
  car.speed += Math.max(-320 * dt, Math.min(210 * dt, target2 - car.speed));
  moveCar(G, car, dt);
}

// Shared movement + collision for AI cars.
export function moveCar(G, car, dt) {
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  const px = car.x, py = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const hitWall = collideWorld(G.world, car, car.radius);
  if (hitWall) {
    const impact = Math.abs(car.speed);
    if (impact > 120) damageCar(G, car, impact * 0.05, px, py);
    car.speed *= 0.35;
  }
  // Car vs car: soft push-apart, small damage on hard hits.
  const others = [...G.cars, ...G.police];
  for (const o of others) {
    if (o === car) continue;
    const dx = car.x - o.x, dy = car.y - o.y;
    const d = Math.hypot(dx, dy);
    const min = car.radius + o.radius - 2;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      car.x += (dx / d) * push; car.y += (dy / d) * push;
      o.x -= (dx / d) * push; o.y -= (dy / d) * push;
      const rel = Math.abs(car.speed - o.speed);
      if (rel > 90 && car.ramCooldown <= 0) {
        damageCar(G, o, rel * 0.06, car.x, car.y);
        damageCar(G, car, rel * 0.04, car.x, car.y);
        car.ramCooldown = 0.4; o.ramCooldown = 0.4;
        G.onCarCrash?.(car, o, rel);
      }
    }
  }
  if (car.ramCooldown > 0) car.ramCooldown -= dt;
}

export function damageCar(G, car, amount, x, y) {
  car.health -= amount;
  if (car.health < 55 && Math.random() < 0.5) {
    G.spawnParticles?.(x ?? car.x, y ?? car.y, 3, 'spark');
  }
  if (car.health <= 0 && car.driver === 'traffic') {
    car.driver = null; // wrecked: driver bails, car is a hulk
    car.speed = 0;
  }
  if (car.health <= 0) car.health = 0;
}

// Wreck smoke, emitted by the main loop for badly damaged cars.
export function carSmoke(G, car, dt) {
  car.smokeT -= dt;
  if (car.health < 45 && car.smokeT <= 0) {
    car.smokeT = 0.09;
    G.spawnParticles?.(car.x, car.y - 6, 1, 'smoke');
  }
}
