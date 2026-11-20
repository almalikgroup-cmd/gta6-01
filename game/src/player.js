// The player: on-foot movement with sprint, fists and a pistol, entering and
// driving cars, health and damage. Crime reporting is delegated to callbacks
// on G (onCrime, onPedHit...) so the wanted system lives in one place: main.js.

import { CFG } from './config.js';
import { collideWorld } from './world.js';
import { damageCar } from './vehicles.js';
import { scarePeds, knockDown } from './peds.js';

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    radius: CFG.playerRadius,
    angle: -Math.PI / 2,
    health: CFG.playerHealth,
    car: null,               // car being driven, or null on foot
    armed: true,             // pistol owned from the start; ammo is the limit
    ammo: 24,
    punchT: 0, gunT: 0,
    walkPhase: 0,
    hurtT: 0,
    dead: false,
  };
}

export function nearestCar(G, maxDist) {
  let best = null, bd = maxDist;
  for (const c of [...G.cars, ...G.police]) {
    if (c.kind === 'police') continue; // you cannot steal a live interceptor
    const d = Math.hypot(c.x - G.player.x, c.y - G.player.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function tryEnterCar(G) {
  const car = nearestCar(G, 58);
  if (!car) return;
  const p = G.player;
  const wasParked = car.driver === null && Math.abs(car.speed) < 4;
  const wasTraffic = car.driver === 'traffic';
  car.driver = 'player';
  car.target = null;
  p.car = car;
  p.x = car.x; p.y = car.y;
  G.sfx.door();
  if (wasParked || wasTraffic) {
    // Grand theft auto: a crime if anyone sees it.
    G.onCrime?.(55, car.x, car.y, 'theft');
    scarePeds(G, car.x, car.y, 90);
    // Some parked cars fight back with an alarm: extra noise, extra heat.
    if (wasParked && Math.random() < 0.3) {
      G.sfx.alarm();
      G.onCrime?.(20, car.x, car.y, 'alarm');
      G.toast?.('Car alarm! Move fast');
    }
    if (car.kind === 'mission') G.onMissionCarStolen?.(car);
  }
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  // Step out to the left of the car; nudge until free of buildings.
  const side = car.angle - Math.PI / 2;
  for (const dist of [30, 38, 46]) {
    const nx = car.x + Math.cos(side) * dist;
    const ny = car.y + Math.sin(side) * dist;
    const probe = { x: nx, y: ny };
    const before = { x: nx, y: ny };
    collideWorld(G.world, probe, p.radius);
    if (Math.hypot(probe.x - before.x, probe.y - before.y) < 2) {
      p.x = probe.x; p.y = probe.y;
      break;
    }
    p.x = nx; p.y = ny;
  }
  car.driver = null;
  if (Math.abs(car.speed) < 4) car.speed = 0;
  p.car = null;
  G.sfx.door();
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.punchT > 0) p.punchT -= dt;
  if (p.gunT > 0) p.gunT -= dt;

  if (input.wasPressed('KeyE')) {
    if (p.car) exitCar(G);
    else tryEnterCar(G);
  }
  if (p.car) { updateDrivenCar(G, dt); return; }

  // ---- on foot ------------------------------------------------------------
  let mx = 0, my = 0;
  if (input.isDown('KeyA', 'ArrowLeft')) mx -= 1;
  if (input.isDown('KeyD', 'ArrowRight')) mx += 1;
  if (input.isDown('KeyW', 'ArrowUp')) my -= 1;
  if (input.isDown('KeyS', 'ArrowDown')) my += 1;
  const moving = mx !== 0 || my !== 0;
  const sprint = input.isDown('ShiftLeft', 'ShiftRight');
  const speed = sprint ? CFG.playerSprint : CFG.playerWalk;
  if (moving) {
    const d = Math.hypot(mx, my);
    p.vx = (mx / d) * speed; p.vy = (my / d) * speed;
    p.angle = Math.atan2(my, mx);
    p.walkPhase += dt * (sprint ? 12 : 8);
  } else { p.vx = 0; p.vy = 0; }

  // Aim follows the mouse when the player is armed.
  const aim = G.mouseWorld();
  if (p.armed) p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  collideWorld(G.world, p, p.radius);
  // Sprinting kicks up dust on grass and sand.
  if (moving && sprint) {
    p.dustT = (p.dustT || 0) - dt;
    if (p.dustT <= 0) {
      p.dustT = CFG.sprintDust;
      G.spawnParticles?.(p.x, p.y + 6, 1, 'dust');
    }
  }
  // Shoved by moving cars is handled as damage in main (car proximity check).

  // ---- combat --------------------------------------------------------------
  const wantPunch = input.mouse.clicked || input.wasPressed('KeyJ');
  if (wantPunch && p.punchT <= 0) {
    doPunch(G);
  }
  const wantFire = (input.mouse.rdown && p.gunT <= 0) || input.wasPressed('KeyK');
  if (wantFire) doFire(G);
}

function doPunch(G) {
  const p = G.player;
  p.punchT = CFG.punchCooldown;
  p.punchAnim = 0.18;
  G.sfx.punch();
  const fx = p.x + Math.cos(p.angle) * CFG.punchRange;
  const fy = p.y + Math.sin(p.angle) * CFG.punchRange;
  for (const ped of G.peds) {
    if (ped.state !== 'down' && Math.hypot(ped.x - fx, ped.y - fy) < 20) {
      knockDown(G, ped, 'punch');
      G.onPedHit?.(ped, 'punch');
      scarePeds(G, p.x, p.y, 110);
      return;
    }
  }
  for (const c of [...G.cars, ...G.police]) {
    if (Math.hypot(c.x - fx, c.y - fy) < c.radius + 8) {
      damageCar(G, c, 4, fx, fy);
      G.onCrime?.(18, c.x, c.y, 'vandalism');
      return;
    }
  }
}

function doFire(G) {
  const p = G.player;
  if (!p.armed) return;
  if (p.gunT > 0) return;
  if (p.ammo <= 0) { G.sfx.dryFire(); p.gunT = 0.3; return; }
  p.gunT = CFG.gunCooldown;
  p.ammo -= 1;
  G.sfx.shot();
  const aim = G.mouseWorld();
  const ang = Math.atan2(aim.y - p.y, aim.x - p.x);
  p.angle = ang;
  const mx = p.x + Math.cos(ang) * 16, my = p.y + Math.sin(ang) * 16;
  G.spawnParticles?.(mx, my, 2, 'flash');
  // Hitscan: nearest ped or car along the ray, buildings block the shot.
  let bestT = CFG.gunRange, hit = null;
  const testCircle = (e, r, obj) => {
    const dx = e.x - p.x, dy = e.y - p.y;
    const t = dx * Math.cos(ang) + dy * Math.sin(ang);
    if (t < 0 || t > bestT) return;
    const side = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
    if (side < r) { bestT = t; hit = obj; }
  };
  for (const ped of G.peds) if (ped.state !== 'down') testCircle(ped, 11, { ped });
  for (const c of [...G.cars, ...G.police]) testCircle(c, c.radius + 3, { car: c });
  for (const b of G.world.buildings) {
    // Cheap ray-vs-rect: sample the corners' projection band.
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const dx = cx - p.x, dy = cy - p.y;
    const t = dx * Math.cos(ang) + dy * Math.sin(ang);
    if (t > 0 && t < bestT) {
      const side = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
      const rad = Math.hypot(b.w, b.h) / 2;
      if (side < rad && t - rad < bestT) { /* building may block; resolved below */ }
      if (side < Math.max(b.w, b.h) / 2 && Math.abs(t) < bestT) {
        // Only counts if the endpoint actually lands inside the rect.
        const ex = p.x + Math.cos(ang) * Math.min(t + rad, bestT);
        const ey = p.y + Math.sin(ang) * Math.min(t + rad, bestT);
        if (ex > b.x && ex < b.x + b.w && ey > b.y && ey < b.y + b.h && t < bestT) { bestT = t; hit = { wall: true }; }
      }
    }
  }
  const ex = p.x + Math.cos(ang) * bestT, ey = p.y + Math.sin(ang) * bestT;
  G.tracers.push({ x1: mx, y1: my, x2: ex, y2: ey, life: 0.07 });
  if (hit?.ped) {
    knockDown(G, hit.ped, 'shot');
    G.onPedHit?.(hit.ped, 'shot');
  } else if (hit?.car) {
    damageCar(G, hit.car, 16, ex, ey);
    G.onCrime?.(30, hit.car.x, hit.car.y, 'gunfire');
  }
  scarePeds(G, p.x, p.y, 240);
  G.onCrime?.(26, p.x, p.y, 'gunfire'); // firing at all is a crime when heard
}

export function updateDrivenCar(G, dt) {
  const p = G.player;
  const car = p.car;
  const input = G.input;
  const wrecked = car.health <= 12;

  const accel = wrecked ? 60 : 265;
  const maxF = wrecked ? 90 : 330;
  const maxR = 110;
  if (input.isDown('KeyW', 'ArrowUp')) car.speed += accel * dt;
  if (input.isDown('KeyS', 'ArrowDown')) {
    if (car.speed > 12) car.speed -= 430 * dt;       // brake
    else car.speed -= 150 * dt;                       // reverse
  }
  // Natural drag + rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (!input.isDown('KeyW', 'ArrowUp', 'KeyS', 'ArrowDown') && Math.abs(car.speed) < 6) car.speed = 0;
  car.speed = Math.max(-maxR, Math.min(maxF, car.speed));

  const steer = (input.isDown('KeyA', 'ArrowLeft') ? -1 : 0) + (input.isDown('KeyD', 'ArrowRight') ? 1 : 0);
  const handbrake = input.isDown('Space');
  if (input.wasPressed('KeyH')) {
    G.sfx.horn();
    scarePeds(G, car.x, car.y, CFG.hornRadius);
  }
  if (steer !== 0 && car.speed !== 0) {
    const dir = car.speed >= 0 ? 1 : -1;
    car.angle += steer * dir * (handbrake ? 2.5 : 1.85) * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  }
  if (handbrake) car.speed -= car.speed * 1.6 * dt;

  const px = car.x, py = car.y;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const hitWall = collideWorld(G.world, car, car.radius);
  if (hitWall) {
    const impact = Math.abs(car.speed);
    if (impact > 90) {
      damageCar(G, car, impact * 0.09, px, py);
      G.onCarCrash?.(car, null, impact);
      hurtPlayer(G, impact * 0.03);
    }
    car.speed *= -0.25;
  }
  // Car vs car while driving.
  for (const o of [...G.cars, ...G.police]) {
    if (o === car) continue;
    const dx = car.x - o.x, dy = car.y - o.y;
    const d = Math.hypot(dx, dy);
    const min = car.radius + o.radius - 2;
    if (d > 0.01 && d < min) {
      const push = min - d;
      car.x += (dx / d) * push * 0.6; car.y += (dy / d) * push * 0.6;
      o.x -= (dx / d) * push * 0.4; o.y -= (dy / d) * push * 0.4;
      const rel = Math.abs(car.speed);
      if (rel > 70 && car.ramCooldown <= 0) {
        damageCar(G, o, rel * 0.08, car.x, car.y);
        damageCar(G, car, rel * 0.045, car.x, car.y);
        hurtPlayer(G, rel * 0.02);
        car.ramCooldown = 0.35;
        G.onCarCrash?.(car, o, rel);
      }
    }
  }
  if (car.ramCooldown > 0) car.ramCooldown -= dt;

  p.x = car.x; p.y = car.y;
  p.vx = car.vx; p.vy = car.vy;
  p.angle = car.angle;
}

export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.dead || G.state !== 'playing') return;
  p.health -= amount;
  p.hurtT = 0.35;
  G.sfx.hurt();
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.onWasted?.();
  }
}
