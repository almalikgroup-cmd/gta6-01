// Deterministic screenshot scenes for ?shot=<name>&seed=<n>.
// Each scene rebuilds the game with the given seed, stages a tableau using
// the real entities, simulates a few seconds so traffic and pedestrians are
// mid-motion, then flags window.__SHOT_READY__ for the capture harness.

import { CFG } from './config.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function setupShot(G, name) {
  const P = G.world.points;
  G.state = 'playing';

  if (name === 'cover') {
    // Title screen over a staged beachfront vista: traffic on the avenue,
    // palms, the sea behind, camera looking down the coast road.
    G.state = 'title';
    G.camera.x = 1150;
    G.camera.y = 1560;
    stageTrafficNear(G, 1480, 1900, 6);
    G.player.x = 1480; G.player.y = 1930;
    // Beachfront strollers in the foreground of the vista.
    let placed = 0;
    for (const p of G.peds) {
      if (placed >= 4) break;
      p.x = 1330 + placed * 95;
      p.y = 1962 + (placed % 2) * 26;
      p.state = 'walk';
      p.target = { x: p.x + 140, y: p.y };
      placed++;
    }
    return;
  }

  if (name === 'drive') {
    // Mid-drive downtown with the first mission's marker active.
    const { startNextMission } = G.missionApi;
    startNextMission(G); // offers M1 via direct call for staging
    const car = G.cars.find((c) => c.driver === 'traffic') || G.cars[0];
    car.driver = 'player';
    car.x = 1480; car.y = 1240;
    car.angle = Math.PI / 2; car.speed = 190;
    G.player.car = car;
    G.player.x = car.x; G.player.y = car.y;
    G.cash = 350;
    G.player.ammo = 18;
    stageTrafficNear(G, 1480, 1300, 5);
    return;
  }

  if (name === 'chase') {
    // Four-star police chase on the central avenue.
    const car = G.cars.find((c) => c.driver === 'traffic') || G.cars[0];
    car.driver = 'player';
    car.x = 1480; car.y = 1000;
    car.angle = Math.PI / 2; car.speed = 240;
    car.health = 62;
    G.player.car = car;
    G.player.x = car.x; G.player.y = car.y;
    G.addHeat(360); // 4 stars
    G.cash = 1250;
    // Interceptors closing in from behind and the side streets (all staged
    // on real road lanes so the pursuit develops naturally).
    const spots = [
      { x: 1452, y: 830, a: Math.PI / 2 },
      { x: 1510, y: 730, a: Math.PI / 2 },
      { x: 1250, y: 768, a: 2.6 },
      { x: 2092, y: 950, a: -2.4 },
    ];
    for (const s of spots) {
      const cop = G.spawnPoliceAt(s.x, s.y, s.a);
      cop.speed = 210;
    }
    stageTrafficNear(G, 1480, 1150, 4);
    return;
  }

  if (name === 'mission') {
    // On foot at the M1 pickup beacon, package marker glowing, peds around.
    const { startNextMission } = G.missionApi;
    startNextMission(G);
    G.player.x = P.m1Pickup.x - 60;
    G.player.y = P.m1Pickup.y + 26;
    G.player.angle = 0.4;
    G.cash = 120;
    // A little street life near the warehouse corner.
    let placed = 0;
    for (const p of G.peds) {
      if (placed >= 5) break;
      p.x = P.m1Pickup.x + (placed - 2) * 44;
      p.y = P.m1Pickup.y + 60 + (placed % 2) * 30;
      placed++;
    }
    const car = G.cars.find((c) => c.driver === 'traffic');
    if (car) { car.x = P.m1Pickup.x - 140; car.y = P.m1Pickup.y + 90; car.angle = 0; car.speed = 60; }
    return;
  }

  // Unknown scene: fall back to the cover tableau.
  setupShot(G, 'cover');
}

function stageTrafficNear(G, x, y, n) {
  let placed = 0;
  for (const c of G.cars) {
    if (placed >= n) break;
    if (c.driver !== 'traffic') continue;
    if (dist(c, { x, y }) > 700) {
      c.x = x + (placed - n / 2) * 90;
      c.y = y + (placed % 3) * 70 - 60;
      c.speed = c.cruise * 0.8;
      placed++;
    }
  }
}

// Called every simulated step while a shot scene runs: the staged drive and
// chase would otherwise roll to a stop (no throttle input in a capture), so
// the player's car is held at cruising speed, looping up and down the
// central avenue between the downtown intersections.
export function maintainShot(G, name) {
  const car = G.player.car;
  if (!car) return;
  if (name !== 'drive' && name !== 'chase') return;
  const target = name === 'drive' ? 178 : 228;
  if (car.shotDir === undefined) car.shotDir = 1;
  if (car.y > 1700) car.shotDir = -1;
  if (car.y < 460) car.shotDir = 1;
  const targetAngle = car.shotDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  const laneX = 1480 + car.shotDir * CFG.laneOffset;
  let d = (targetAngle - car.angle) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  // Slow right down for the U-turns at each end of the loop so the car
  // stays on the avenue instead of swinging through the blocks.
  if (Math.abs(d) > 0.45) car.speed = Math.min(car.speed, 86);
  else if (car.speed < target) car.speed = target;
  car.angle += d * 0.045;
  car.x += (laneX - car.x) * 0.015;
}

export { CFG };
