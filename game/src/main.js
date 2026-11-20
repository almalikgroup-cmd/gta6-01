// SOLMAR HEAT — boot, the main loop, game states, the wanted/crime system,
// the police director, particles, pickups, bust/wasted flow and save/load.

import { CFG, HEAT_LEVELS } from './config.js';
import { makeRng, seedFrom } from './random.js';
import { Input } from './input.js';
import { SoundFX } from './audio.js';
import { buildWorld } from './world.js';
import { spawnParkedCars, spawnTraffic, spawnPolice, updateTrafficCar, updatePoliceCar, carSmoke } from './vehicles.js';
import { spawnPeds, updatePeds, scarePeds } from './peds.js';
import { createPlayer, updatePlayer, nearestCar, hurtPlayer } from './player.js';
import { createMissionState, updateMissions, currentObjective, startNextMission, onMissionCarStolen } from './missions.js';
import { render, VIEW_W, VIEW_H } from './render.js';
import { setupShot, maintainShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = seedFrom(params.get('seed') !== null ? Number(params.get('seed')) : 'solmar-heat');

// ---------------------------------------------------------------- save ----
function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ---------------------------------------------------------------- state ----
function buildGame(saved) {
  const rng = makeRng(seed);
  const world = buildWorld(seed);
  const G = {
    ctx, world, rng,
    time: 0,
    state: shotName ? 'playing' : 'title',
    input: new Input(canvas),
    sfx: new SoundFX(),
    player: createPlayer(world.points.spawn.x, world.points.spawn.y),
    cars: [], police: [], peds: [],
    particles: [], tracers: [], toasts: [],
    camera: { x: 0, y: 0 },
    cash: 120,
    heat: 0, wanted: 0, heatFloor: 0,
    bust: 0,
    lastCrimeT: -99, lastSeenT: -99,
    missions: createMissionState(),
    objectiveText: '',
    promptText: '',
    saveExists: !!saved,
    policeTimer: 0,
    startButton: null,
    bustedText: '',
    muted: false,
  };
  G.cars = [...spawnParkedCars(world, rng), ...spawnTraffic(world, rng)];
  G.peds = spawnPeds(world, rng);
  for (const pk of world.pickups) pk.taken = 0;

  if (saved) {
    G.cash = saved.cash ?? G.cash;
    G.missions.done = saved.missionsDone ?? 0;
    G.missions.nextIndex = saved.missionsDone ?? 0;
    if (saved.x && saved.y) { G.player.x = saved.x; G.player.y = saved.y; }
    G.player.ammo = saved.ammo ?? 24;
  }

  // ---- cross-module hooks -------------------------------------------------
  G.mouseWorld = () => ({ x: G.input.mouse.x + G.camera.x, y: G.input.mouse.y + G.camera.y });
  G.spawnParticles = (x, y, n, kind) => spawnParticles(G, x, y, n, kind);
  G.toast = (text, t = 2.6) => { G.toasts.push({ text, t }); if (G.toasts.length > 3) G.toasts.shift(); };
  G.addHeat = (amount) => { G.heat = Math.min(620, G.heat + amount); };
  G.onCrime = (amount, x, y, kind) => reportCrime(G, amount, x, y, kind);
  G.onPedHit = (ped, cause) => {
    reportCrime(G, cause === 'shot' ? 120 : cause === 'car' ? 85 : 45, ped.x, ped.y, cause);
    hurtFeedback(G);
  };
  G.onCarCrash = (a, b, rel) => {
    G.sfx.crash(rel > 130);
    G.spawnParticles(a.x, a.y, rel > 130 ? 8 : 4, 'spark');
    // Only the player's own driving earns heat — AI bumps and police rams
    // are not the player's crime.
    if (a.driver === 'player') reportCrime(G, rel > 150 ? 42 : 22, a.x, a.y, 'crash');
    if (a.driver === 'player' || b?.driver === 'player') hurtFeedback(G);
  };
  G.onMissionCarStolen = (car) => onMissionCarStolen(G, car);
  G.onWasted = () => { G.state = 'wasted'; G.sfx.bustedJingle(); };
  G.saveGame = () => saveGame(G);
  G.missionApi = { startNextMission };
  G.spawnPoliceAt = (x, y, angle) => {
    const cop = spawnPolice(world, rng, x, y);
    cop.x = x; cop.y = y; cop.angle = angle;
    G.police.push(cop);
    return cop;
  };
  return G;
}

function saveGame(G) {
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify({
      cash: G.cash,
      missionsDone: G.missions.done,
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      ammo: G.player.ammo,
    }));
    G.saveExists = true;
  } catch { /* storage unavailable: play on without saving */ }
}

function hurtFeedback(G) {
  // Small screen-shake via camera jitter is applied in the loop using hurtT.
  void G;
}

// ------------------------------------------------------------- particles ----
function spawnParticles(G, x, y, n, kind) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = kind === 'smoke' ? 12 + Math.random() * 16 : 30 + Math.random() * 70;
    G.particles.push({
      x, y, kind,
      vx: Math.cos(a) * sp,
      vy: kind === 'smoke' ? -22 - Math.random() * 18 : Math.sin(a) * sp,
      life: 0, maxLife: kind === 'smoke' ? 1.15 : 0.45 + Math.random() * 0.3,
      size: kind === 'smoke' ? 7 + Math.random() * 6 : 3,
    });
  }
  if (G.particles.length > 420) G.particles.splice(0, G.particles.length - 420);
}

function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) { G.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    G.tracers[i].life -= dt;
    if (G.tracers[i].life <= 0) G.tracers.splice(i, 1);
  }
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    G.toasts[i].t -= dt;
    if (G.toasts[i].t <= 0) G.toasts.splice(i, 1);
  }
}

// ---------------------------------------------------------------- crimes ----
function witnessed(G, x, y) {
  for (const p of G.peds) {
    if (p.state !== 'down' && Math.hypot(p.x - x, p.y - y) < CFG.witnessPedRadius) return true;
  }
  for (const c of G.police) {
    if (Math.hypot(c.x - x, c.y - y) < CFG.witnessCopRadius) return true;
  }
  return false;
}

function reportCrime(G, amount, x, y, kind) {
  const seen = witnessed(G, x, y);
  if (seen) {
    G.addHeat(amount);
    G.lastCrimeT = G.time;
    G.lastSeenT = G.time;
  } else if (kind === 'gunfire' || kind === 'crash') {
    G.addHeat(amount * 0.35); // heard, not seen: suspicion only
    G.lastCrimeT = G.time;
  }
}

function wantedFromHeat(heat) {
  let lvl = 0;
  for (let i = 0; i < HEAT_LEVELS.length; i++) if (heat >= HEAT_LEVELS[i]) lvl = i;
  return lvl;
}

function updateWanted(G, dt) {
  // Police eyes on the player refresh "seen".
  const p = G.player;
  let nearestCop = Infinity;
  for (const c of G.police) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < nearestCop) nearestCop = d;
    if (d < 430) G.lastSeenT = G.time;
  }
  const seenRecently = G.time - G.lastSeenT < 4;
  if (!seenRecently && G.police.length === 0 || !seenRecently && nearestCop > 430) {
    G.heat = Math.max(G.heatFloor, G.heat - (nearestCop > 700 ? CFG.heatDecayFast : CFG.heatDecay) * dt);
  }
  if (G.heat < G.heatFloor) G.heat = G.heatFloor;
  const newWanted = wantedFromHeat(G.heat);
  if (newWanted > G.wanted) G.toast(newWanted >= 3 ? `Wanted level ${newWanted} — the PD is swarming` : `Wanted level ${newWanted}`);
  G.wanted = newWanted;

  // Police director: keep the interceptor count matched to the level.
  G.policeTimer -= dt;
  const desired = G.wanted === 0 ? 0 : Math.min(CFG.policeMax, 1 + G.wanted);
  if (G.policeTimer <= 0) {
    G.policeTimer = 1.1;
    if (G.police.length < desired) {
      G.police.push(spawnPolice(G.world, G.rng, p.x, p.y));
    } else if (G.police.length > desired) {
      // The farthest unit gives up and despawns off-screen.
      let far = -1, fd = 0;
      G.police.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d > fd) { fd = d; far = i; } });
      if (far >= 0 && fd > 620) G.police.splice(far, 1);
    }
  }
  // Despawn units left hopelessly behind even at the right count.
  G.police = G.police.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 1500);
}

// ------------------------------------------------------------------ bust ----
function updateBust(G, dt) {
  const p = G.player;
  if (G.wanted === 0) { G.bust = 0; return; }
  const speed = p.car ? Math.abs(p.car.speed) : Math.hypot(p.vx, p.vy);
  let cornered = false;
  if (speed < 30) {
    for (const c of G.police) {
      if (Math.hypot(c.x - p.x, c.y - p.y) < CFG.bustRadius + c.radius) { cornered = true; break; }
    }
  }
  if (cornered) {
    G.bust += dt / CFG.bustTime;
    if (G.bust >= 1) doBusted(G);
  } else {
    G.bust = Math.max(0, G.bust - dt * 1.4);
  }
}

function doBusted(G) {
  const fine = Math.min(G.cash, 60 + G.wanted * 90);
  G.cash -= fine;
  G.bustedText = `The Solmar PD fined you $${fine} and dropped you at the station.`;
  G.state = 'busted';
  G.sfx.bustedJingle();
  G.bust = 0;
}

function respawn(G, atHospital) {
  const P = G.world.points;
  const p = G.player;
  if (p.car) { p.car.driver = null; p.car = null; }
  const spot = atHospital ? P.hospital : P.policeStation;
  p.x = spot.x; p.y = spot.y + 30;
  p.health = CFG.playerHealth;
  p.dead = false;
  G.heat = 0; G.wanted = 0; G.heatFloor = 0;
  G.police = [];
  G.bust = 0;
  if (atHospital) G.cash = Math.max(0, G.cash - 75);
  G.state = 'playing';
  saveGame(G);
}

// ---------------------------------------------------------------- pickups ----
function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.world.pickups) {
    if (pk.taken > 0) { pk.taken -= dt; continue; }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 26) {
      if (pk.kind === 'ammo') {
        p.ammo += 12;
        G.toast('+12 pistol ammo');
        G.sfx.pickup();
      } else {
        if (p.health > 92) continue;
        p.health = Math.min(CFG.playerHealth, p.health + 45);
        G.toast('+45 health');
        G.sfx.pickup();
      }
      pk.taken = 25;
      G.spawnParticles(pk.x, pk.y, 4, pk.kind === 'ammo' ? 'spark' : 'cash');
    }
  }
}

// ------------------------------------------------------------------- loop ----
let G = buildGame(shotName ? null : loadSave());
let last = performance.now();
let shotFrames = 0;

function startRun(continueSave) {
  if (!continueSave) {
    try { localStorage.removeItem(CFG.saveKey); } catch { /* ignore */ }
    G = buildGame(null);
  }
  G.state = 'playing';
  G.sfx.ensure();
  G.sfx.click();
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (dt <= 0) dt = 0.016;
  const input = G.input;

  // Global keys.
  if (input.wasPressed('KeyM')) {
    G.muted = !G.muted;
    G.sfx.setMuted(G.muted);
    G.toast(G.muted ? 'Sound off' : 'Sound on');
  }

  if (G.state === 'title') {
    G.sfx.ensure();
    if (input.wasPressed('Enter') || input.wasPressed('Space')) startRun(G.saveExists);
    else if (input.wasPressed('KeyN')) startRun(false);
    else if (input.mouse.clicked && G.startButton) {
      const m = input.mouse;
      const b = G.startButton;
      if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) startRun(G.saveExists);
    }
    // Ambient city behind the title: traffic and peds keep living.
    stepWorld(G, dt, true);
  } else if (G.state === 'playing') {
    if (input.wasPressed('Escape', 'KeyP')) { G.state = 'paused'; G.sfx.click(); }
    else stepWorld(G, dt, false);
  } else if (G.state === 'paused') {
    if (input.wasPressed('Escape', 'KeyP', 'Enter')) { G.state = 'playing'; G.sfx.click(); }
  } else if (G.state === 'busted') {
    if (input.wasPressed('Enter', 'Space')) respawn(G, false);
  } else if (G.state === 'wasted') {
    if (input.wasPressed('Enter', 'Space')) respawn(G, true);
  }

  // Camera follows the player (or their car), clamped to the world.
  const focus = G.player;
  const lookX = focus.x + (focus.vx || 0) * 0.35;
  const lookY = focus.y + (focus.vy || 0) * 0.35;
  if (!(shotName === 'cover')) {
    G.camera.x = Math.max(0, Math.min(G.world.w - VIEW_W, lookX - VIEW_W / 2));
    G.camera.y = Math.max(0, Math.min(G.world.h - VIEW_H, lookY - VIEW_H / 2));
  }
  if (G.player.hurtT > 0.2 && G.state === 'playing') {
    G.camera.x += (Math.random() - 0.5) * 5;
    G.camera.y += (Math.random() - 0.5) * 5;
  }

  render(G);
  input.postUpdate();

  // Audio beds.
  const driving = G.state === 'playing' && !!G.player.car;
  G.sfx.engine(driving, driving ? Math.abs(G.player.car.speed) / 330 : 0);
  G.sfx.siren(G.state === 'playing' && G.wanted > 0 && G.police.length > 0, dt);

  if (shotName) {
    maintainShot(G, shotName);
    shotFrames++;
    if (shotFrames > 90) window.__SHOT_READY__ = true;
  }
}

function stepWorld(G, dt, ambient) {
  G.time += dt;
  updatePlayer(G, dt);
  if (G.player.punchAnim > 0) G.player.punchAnim -= dt;

  for (const c of G.cars) {
    if (c.driver === 'traffic') updateTrafficCar(G, c, dt);
    carSmoke(G, c, dt);
  }
  for (const c of G.police) {
    updatePoliceCar(G, c, dt);
    carSmoke(G, c, dt);
  }
  updatePeds(G, dt);

  if (!ambient) {
    updateMissions(G, dt);
    updateWanted(G, dt);
    updateBust(G, dt);
    updatePickups(G, dt);
    // Standing in traffic hurts: a car rolling over the player on foot.
    if (!G.player.car) {
      for (const c of [...G.cars, ...G.police]) {
        if (Math.abs(c.speed) > 120 && Math.hypot(c.x - G.player.x, c.y - G.player.y) < c.radius + G.player.radius) {
          hurtPlayer(G, 26 * dt * 4);
          break;
        }
      }
    }
    G.objectiveText = currentObjective(G);
    // Periodic autosave so a closed tab never loses much progress.
    G.autosaveT = (G.autosaveT || 0) + dt;
    if (G.autosaveT > 25) { G.autosaveT = 0; saveGame(G); }
    // Context prompt.
    const p = G.player;
    if (!p.car) {
      const car = nearestCar(G, 58);
      G.promptText = car ? 'E — enter car' : (G.missions.nextIndex < 3 && Math.hypot(p.x - G.world.points.missionStart.x, p.y - G.world.points.missionStart.y) < 46 ? 'Stand in the beacon to start the job' : '');
    } else {
      G.promptText = 'E — exit car · H — horn · Space — handbrake';
    }
  }
  updateParticles(G, dt);
}

// ------------------------------------------------------------- shot mode ----
if (shotName) {
  G.state = 'playing';
  setupShot(G, shotName);
  // Simulate a few seconds so the tableau is alive when captured.
  for (let i = 0; i < 150; i++) { stepWorld(G, 1 / 30, shotName === 'cover'); maintainShot(G, shotName); }
  G.state = shotName === 'cover' ? 'title' : 'playing';
  // Freeze the staged camera for the cover; others follow the player.
  requestAnimationFrame(frame);
} else {
  requestAnimationFrame(frame);
}
