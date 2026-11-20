// The three-mission story chain. Between missions the player free-roams; a
// glowing beacon at the hideout starts the next job. Each mission is a small
// stage machine with a world marker (also drawn on the minimap, with an edge
// arrow when off-screen) and an objective line for the HUD.

import { CFG } from './config.js';
import { makeCar } from './vehicles.js';

export const MISSION_DEFS = [
  {
    id: 'm1', name: 'First Run', reward: 500,
    intro: 'Pick up the package at the NE warehouse.',
  },
  {
    id: 'm2', name: 'Hot Wheels', reward: 900,
    intro: 'Steal the marked convertible and bring it to the garage.',
  },
  {
    id: 'm3', name: 'Harbor Heat', reward: 1500,
    intro: 'Collect your crew member at the beach, then lose the heat at the hideout.',
  },
];

export function createMissionState() {
  return {
    nextIndex: 0,        // which mission the beacon offers
    active: null,        // active mission runtime object
    done: 0,
    banner: null,        // {title, sub, t} big centre-screen message
    beaconPulse: 0,
  };
}

function banner(G, title, sub) {
  G.missions.banner = { title, sub, t: 3.4 };
  G.sfx.chime();
}

export function startNextMission(G) {
  const M = G.missions;
  if (M.active || M.nextIndex >= MISSION_DEFS.length) return false;
  const def = MISSION_DEFS[M.nextIndex];
  const P = G.world.points;
  const rt = { def, stage: 0, timer: null, car: null, crew: null };
  if (def.id === 'm1') {
    rt.marker = { ...P.m1Pickup };
    rt.objective = 'Drive to the warehouse and grab the package';
  } else if (def.id === 'm2') {
    // A distinctive convertible waits in a north-side parking bay.
    const car = makeCar(1480 - CFG.roadHalf - 24, 800 - 60, Math.PI, '#ff2e88', 'mission');
    car.driver = null;
    G.cars.push(car);
    rt.car = car;
    rt.marker = { x: car.x, y: car.y };
    rt.objective = 'Steal the pink convertible';
  } else if (def.id === 'm3') {
    rt.marker = { ...P.m3Beach };
    rt.objective = 'Pick up your crew member at the beach';
    rt.heatFloor = 0;
    // Make sure a crew member is visibly waiting on the sand.
    const crew = G.peds.find((p) => p.state !== 'down' && p.state !== 'crew');
    if (crew) {
      crew.x = P.m3Beach.x; crew.y = P.m3Beach.y;
      crew.state = 'wait';
      crew.target = null;
      rt.crewPed = crew;
    }
  }
  M.active = rt;
  banner(G, `Mission: ${def.name}`, def.intro);
  return true;
}

export function currentMarker(G) {
  const rt = G.missions.active;
  if (rt) return rt.marker;
  if (G.missions.nextIndex < MISSION_DEFS.length) {
    return { ...G.world.points.missionStart, beacon: true };
  }
  return null;
}

export function currentObjective(G) {
  const rt = G.missions.active;
  if (rt) {
    let s = rt.objective;
    if (rt.timer != null) s += ` — ${Math.max(0, Math.ceil(rt.timer))}s left`;
    return s;
  }
  if (G.missions.nextIndex < MISSION_DEFS.length) {
    return `Go to the $ beacon for work: ${MISSION_DEFS[G.missions.nextIndex].name}`;
  }
  return 'All jobs done. Solmar is yours — free roam.';
}

function completeMission(G) {
  const M = G.missions;
  const def = M.active.def;
  G.cash += def.reward;
  M.done += 1;
  M.nextIndex += 1;
  M.active = null;
  G.sfx.missionDone();
  G.sfx.cash();
  banner(G, 'Mission complete', `${def.name} — $${def.reward} earned`);
  G.saveGame?.();
}

function failMission(G, why) {
  const M = G.missions;
  if (!M.active) return;
  banner(G, 'Mission failed', why);
  G.sfx.bustedJingle();
  // Clean up mission props; the beacon offers the same job again.
  if (M.active.car && M.active.car.driver !== 'player') {
    G.cars = G.cars.filter((c) => c !== M.active.car);
  }
  if (M.active.crew) {
    M.active.crew.state = 'walk';
    M.active.crew = null;
  }
  M.active = null;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function updateMissions(G, dt) {
  const M = G.missions;
  M.beaconPulse += dt * 3;
  if (M.banner) {
    M.banner.t -= dt;
    if (M.banner.t <= 0) M.banner = null;
  }
  const P = G.world.points;
  const player = G.player;

  if (!M.active) {
    // Standing in the beacon starts the next job.
    if (M.nextIndex < MISSION_DEFS.length && dist(player, P.missionStart) < 46 && !player.car) {
      startNextMission(G);
    }
    return;
  }

  const rt = M.active;
  if (rt.timer != null) {
    rt.timer -= dt;
    if (rt.timer <= 0) { failMission(G, 'Out of time. The beacon offers the job again.'); return; }
  }

  if (rt.def.id === 'm1') {
    if (rt.stage === 0 && dist(player, rt.marker) < 44) {
      rt.stage = 1;
      rt.marker = { ...P.m1Drop };
      rt.timer = 100;
      rt.objective = 'Deliver the package across town';
      G.sfx.pickup();
      banner(G, 'Package secured', 'Get it across town before the timer runs out');
    } else if (rt.stage === 1 && dist(player, rt.marker) < 48) {
      completeMission(G);
    }
  } else if (rt.def.id === 'm2') {
    if (rt.stage === 0) {
      rt.marker = { x: rt.car.x, y: rt.car.y };
      if (player.car === rt.car) {
        rt.stage = 1;
        rt.marker = { ...P.garage };
        rt.timer = 170; // the owner reported it: beat the clock to the garage
        rt.objective = 'Deliver the car to the garage, east side';
        G.onCrime?.(70, rt.car.x, rt.car.y, 'theft'); // the owner definitely noticed
        banner(G, 'Wheels hot', 'Heat is rising — get to the garage, fast');
      }
    } else if (rt.stage === 1) {
      if (player.car !== rt.car) {
        rt.marker = { x: rt.car.x, y: rt.car.y };
        rt.objective = 'Get back in the convertible';
      } else {
        rt.marker = { ...P.garage };
        rt.objective = 'Deliver the car to the garage, east side';
        if (dist(player, P.garage) < 56) completeMission(G);
      }
      if (rt.car.health <= 5) failMission(G, 'The convertible is wrecked.');
    }
  } else if (rt.def.id === 'm3') {
    if (rt.stage === 0 && dist(player, rt.marker) < 46) {
      // The crew member climbs in / tags along.
      let crew = rt.crewPed && rt.crewPed.state === 'wait' ? rt.crewPed : null;
      if (!crew) crew = G.peds.find((p) => Math.hypot(p.x - P.m3Beach.x, p.y - P.m3Beach.y) < 130 && p.state !== 'down');
      if (!crew && G.peds.length) crew = G.peds[0];
      if (crew) {
        crew.state = 'crew';
        rt.crew = crew;
      }
      rt.stage = 1;
      rt.marker = { ...P.hideout };
      rt.objective = 'Escape to the hideout — do not get busted';
      G.heatFloor = 320; // 3 stars, minimum, until delivered
      G.addHeat?.(320);
      banner(G, 'Crew aboard', 'Three stars. Run for the hideout');
    } else if (rt.stage === 1) {
      if (rt.crew) { rt.crew.x = player.x; rt.crew.y = player.y; }
      G.heatFloor = 320;
      if (dist(player, P.hideout) < 58) {
        G.heatFloor = 0;
        if (rt.crew) { rt.crew.state = 'walk'; rt.crew.x = P.hideout.x + 24; rt.crew.y = P.hideout.y + 10; }
        completeMission(G);
      }
    }
  }
}

// Called from player.js when the player enters any car.
export function onMissionCarStolen(G, car) {
  const rt = G.missions.active;
  if (rt && rt.def.id === 'm2' && rt.car === car) {
    // stage transition happens in updateMissions next frame
  }
}
