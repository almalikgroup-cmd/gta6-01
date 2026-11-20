// All drawing: the city from the camera's view, entities, particles, then the
// HUD (minimap, stars, cash, health, objective, speedo, ammo) and the full
// screens (title, pause, busted, wasted). Canvas 2D only, no images.

import { CFG, PALETTE } from './config.js';
import { currentMarker } from './missions.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function render(G) {
  const { ctx } = G;
  const cam = G.camera;
  ctx.fillStyle = '#101018';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawWorld(G);
  drawMarker(G);
  drawPickups(G);
  for (const c of G.cars) drawCar(G, c);
  for (const c of G.police) drawCar(G, c);
  for (const p of G.peds) if (p.state !== 'crew') drawPed(G, p);
  if (!G.player.car) drawPlayer(G);
  drawTracers(G);
  drawParticles(G);
  ctx.restore();

  if (G.state === 'playing' || G.state === 'paused') drawHud(G);
  if (G.state === 'title') drawTitle(G);
  if (G.state === 'paused') drawPause(G);
  if (G.state === 'busted') drawEndScreen(G, 'BUSTED', '#3d7bd9', G.bustedText || 'The Solmar PD emptied your pockets.', 'Press Enter to carry on');
  if (G.state === 'wasted') drawEndScreen(G, 'WASTED', '#d93d3d', 'You woke up at Solmar General. The bill stung.', 'Press Enter to carry on');
  if (G.missions.banner && G.state === 'playing') drawBanner(G);
}

// ---------------------------------------------------------------- world ----
function drawWorld(G) {
  const { ctx, world } = G;
  const cam = G.camera;
  const vx = cam.x - 40, vy = cam.y - 40, vw = VIEW_W + 80, vh = VIEW_H + 80;

  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx, vy, vw, vh);

  // Parks (greener) and parking lots.
  for (const p of world.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  for (const l of world.lots) {
    ctx.fillStyle = PALETTE.parking;
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.strokeStyle = '#ffffff2e';
    ctx.lineWidth = 2;
    for (let x = l.x + 32; x < l.x + l.w - 10; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, l.y + 8); ctx.lineTo(x, l.y + l.h - 8); ctx.stroke();
    }
  }

  // Beach + sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(vx, CFG.beachY, vw, CFG.seaY - CFG.beachY + 60);
  ctx.fillStyle = PALETTE.sandDark;
  for (let x = Math.floor(vx / 90) * 90; x < vx + vw; x += 90) {
    ctx.fillRect(x + 20, CFG.beachY + 60 + ((x * 7) % 90), 26, 5);
  }
  const wt = G.time * 0.9;
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(vx, CFG.seaY, vw, world.h - CFG.seaY + 60);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(vx, CFG.seaY + 26, vw, world.h - CFG.seaY);
  ctx.strokeStyle = PALETTE.foam;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = vx; x <= vx + vw; x += 24) {
    const y = CFG.seaY + 8 + Math.sin(x * 0.02 + wt) * 4;
    if (x === vx) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#ffffff30';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const yy = CFG.seaY + 50 + i * 42;
    for (let x = vx; x <= vx + vw; x += 40) {
      const y = yy + Math.sin(x * 0.015 + wt * 1.4 + i * 2) * 5;
      if (x === vx) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  drawRoads(G);
  for (const b of world.buildings) drawBuilding(G, b);
  for (const pr of world.props) drawProp(G, pr);
  for (const t of world.palms) drawPalm(G, t);
}

function drawRoads(G) {
  const { ctx, world } = G;
  const H2 = CFG.roadHalf;
  const roadsV = world.roadsV, roadsH = [...world.roadsH, world.beachRoadY];

  // Sidewalk band first (wider), then asphalt on top.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of roadsV) ctx.fillRect(rx - H2 - CFG.sidewalk, 0, (H2 + CFG.sidewalk) * 2, world.beachRoadY + H2 + CFG.sidewalk);
  for (const ry of roadsH) ctx.fillRect(0, ry - H2 - CFG.sidewalk, world.w, (H2 + CFG.sidewalk) * 2);
  ctx.fillStyle = PALETTE.asphalt;
  for (const rx of roadsV) ctx.fillRect(rx - H2, 0, H2 * 2, world.beachRoadY + H2);
  for (const ry of roadsH) ctx.fillRect(0, ry - H2, world.w, H2 * 2);

  // Crosswalks at every intersection.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const rx of roadsV) {
    for (const ry of roadsH) {
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        ctx.fillRect(rx - H2 - 14, ry + i * 22 - 6, 10, 12);
        ctx.fillRect(rx + H2 + 4, ry + i * 22 - 6, 10, 12);
        ctx.fillRect(rx + i * 22 - 6, ry - H2 - 14, 12, 10);
        ctx.fillRect(rx + i * 22 - 6, ry + H2 + 4, 12, 10);
      }
    }
  }

  // Dashed centre lines.
  ctx.strokeStyle = PALETTE.laneMark;
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const rx of roadsV) { ctx.moveTo(rx, 0); ctx.lineTo(rx, world.beachRoadY + H2); }
  for (const ry of roadsH) { ctx.moveTo(0, ry); ctx.lineTo(world.w, ry); }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBuilding(G, b) {
  const { ctx } = G;
  // Drop shadow, body, lighter roof inset, window grid.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
  ctx.fillStyle = 'rgba(70,50,30,0.55)';
  const cols = Math.max(2, Math.floor(b.w / 34));
  const rows = Math.max(2, Math.floor(b.h / 34));
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const wx = b.x + 14 + c * ((b.w - 28) / cols);
      const wy = b.y + 14 + r * ((b.h - 28) / rows);
      ctx.fillRect(wx, wy, 13, 16);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
}

function drawPalm(G, t) {
  const { ctx } = G;
  ctx.strokeStyle = PALETTE.palmTrunk;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(t.x, t.y);
  ctx.quadraticCurveTo(t.x + 4 * t.s, t.y - 10 * t.s, t.x + 8 * t.s, t.y - 16 * t.s);
  ctx.stroke();
  const cx = t.x + 8 * t.s, cy = t.y - 16 * t.s;
  ctx.strokeStyle = PALETTE.palmLeaf;
  ctx.lineWidth = 3.4;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t.x * 0.01;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + Math.cos(a) * 13 * t.s, cy + Math.sin(a) * 8 * t.s - 4, cx + Math.cos(a) * 20 * t.s, cy + Math.sin(a) * 13 * t.s + 3);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 3, 15 * t.s, 6, 0, 0, Math.PI * 2); ctx.fill();
}

function drawProp(G, pr) {
  const { ctx } = G;
  if (pr.kind === 'lamp') {
    ctx.fillStyle = '#5d6d7e';
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffeaa7';
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 2.2, 0, Math.PI * 2); ctx.fill();
  } else if (pr.kind === 'hydrant') {
    ctx.fillStyle = '#d63031';
    ctx.fillRect(pr.x - 3.4, pr.y - 3.4, 6.8, 6.8);
  } else if (pr.kind === 'bench') {
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(pr.x - 9, pr.y - 3, 18, 6);
  } else if (pr.kind === 'umbrella') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(pr.x + 3, pr.y + 4, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pr.color || '#ff6b81';
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 13, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#8a6b46';
    ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x, pr.y + 9); ctx.stroke();
  }
}

// -------------------------------------------------------------- entities ----
function drawCar(G, car) {
  const { ctx } = G;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, -24, -11, 50, 26, 7); ctx.fill();
  ctx.fillStyle = car.color;
  rr(ctx, -26, -13, 52, 26, 7); ctx.fill();
  // Cabin + windows.
  ctx.fillStyle = car.kind === 'mission' ? '#2d3436' : '#22303c';
  rr(ctx, -9, -10.5, 21, 21, 4); ctx.fill();
  ctx.fillStyle = '#aee6f5';
  rr(ctx, 3, -9, 7, 18, 2); ctx.fill();
  rr(ctx, -8, -9, 4.6, 18, 2); ctx.fill();
  // Headlights / taillights.
  ctx.fillStyle = '#fff7ae';
  ctx.fillRect(24, -10, 3, 6); ctx.fillRect(24, 4, 3, 6);
  ctx.fillStyle = '#ff4757';
  ctx.fillRect(-27.4, -10, 3, 6); ctx.fillRect(-27.4, 4, 3, 6);
  if (car.kind === 'police') {
    ctx.fillStyle = '#1f3a93';
    ctx.fillRect(-26, -13, 52, 6);
    ctx.fillRect(-26, 7, 52, 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    // Light bar flashing.
    const phase = Math.floor(G.time * 5 + car.sirenPhase) % 2;
    ctx.fillStyle = phase === 0 ? '#ff3b30' : '#2e9bff';
    rr(ctx, -6, -5, 12, 10, 3); ctx.fill();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = phase === 0 ? '#ff3b30' : '#2e9bff';
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (car.kind === 'mission') {
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 2.4;
    rr(ctx, -26, -13, 52, 26, 7); ctx.stroke();
  }
  ctx.restore();
  // Damage smoke handled by particles; wreck tint:
  if (car.health < 30) {
    ctx.fillStyle = 'rgba(20,20,20,0.25)';
    ctx.beginPath(); ctx.arc(car.x, car.y, 20, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBody(ctx, x, y, angle, shirt, skin, hair, phase, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  // Legs (two dots offset by walk phase when moving).
  const lp = Math.sin(phase) * 4;
  ctx.fillStyle = '#2d3436';
  ctx.beginPath(); ctx.arc(-Math.sin(angle) * 3 + Math.cos(angle) * lp * 0.4, Math.cos(angle) * 3 + Math.sin(angle) * lp * 0.4, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-Math.sin(angle) * -3 - Math.cos(angle) * lp * 0.4, Math.cos(angle) * -3 - Math.sin(angle) * lp * 0.4, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(1, 2, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 7.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(-Math.cos(angle) * 1.4, -Math.sin(angle) * 1.4, 3.6, 0, Math.PI * 2); ctx.fill();
  if (opts.gun) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
    ctx.stroke();
  }
  if (opts.punch) {
    ctx.strokeStyle = skin;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 14, Math.sin(angle) * 14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPed(G, p) {
  const { ctx } = G;
  if (p.state === 'down') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.shirt;
    rr(ctx, -10, -5, 20, 10, 5); ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(11, 0, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  drawBody(ctx, p.x, p.y, p.angle, p.shirt, p.skin, p.hair, p.walkPhase);
  if (p.panic > 0.3) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', p.x, p.y - 15);
  }
}

function drawPlayer(G) {
  const p = G.player;
  const gun = p.armed;
  const punch = p.punchAnim > 0;
  drawBody(G.ctx, p.x, p.y, p.angle, '#20242c', '#e0ac69', '#14100c', p.walkPhase, { gun, punch });
  // Player marker ring so you can always find yourself.
  G.ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  G.ctx.lineWidth = 1.6;
  G.ctx.beginPath(); G.ctx.arc(p.x, p.y, 13.5, 0, Math.PI * 2); G.ctx.stroke();
  if (p.hurtT > 0) {
    G.ctx.fillStyle = 'rgba(255,60,60,0.25)';
    G.ctx.beginPath(); G.ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); G.ctx.fill();
  }
}

function drawTracers(G) {
  const { ctx } = G;
  ctx.strokeStyle = 'rgba(255,240,170,0.9)';
  ctx.lineWidth = 2;
  for (const t of G.tracers) {
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
}

function drawParticles(G) {
  const { ctx } = G;
  for (const pt of G.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    if (pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(60,60,60,${0.4 * a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255,${180 + Math.floor(60 * a)},60,${a})`;
      ctx.fillRect(pt.x - 1.6, pt.y - 1.6, 3.2, 3.2);
    } else if (pt.kind === 'flash') {
      ctx.fillStyle = `rgba(255,220,120,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 6 * a + 2, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'stars') {
      ctx.fillStyle = `rgba(255,230,90,${a})`;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('*', pt.x, pt.y);
    } else if (pt.kind === 'cash') {
      ctx.fillStyle = `rgba(120,255,140,${a})`;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pt.x, pt.y);
    } else if (pt.kind === 'dust') {
      ctx.fillStyle = `rgba(214,196,150,${0.35 * a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.4 - a * 0.4), 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ------------------------------------------------------- marker & pickups ----
function drawMarker(G) {
  const { ctx } = G;
  const m = currentMarker(G);
  if (!m) return;
  const pulse = 1 + Math.sin(G.missions.beaconPulse) * 0.12;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.strokeStyle = m.beacon ? '#ffe14d' : '#ffcf3f';
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,209,63,0.16)';
  ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.fill();
  // Light beam so the target reads from streets away.
  const grad = ctx.createLinearGradient(0, -190, 0, 0);
  grad.addColorStop(0, 'rgba(255,220,90,0)');
  grad.addColorStop(1, 'rgba(255,220,90,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(-7, -190, 14, 190);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(m.beacon ? '$' : '▼', 0, 8);
  ctx.restore();
}

function drawPickups(G) {
  const { ctx } = G;
  for (const pk of G.world.pickups) {
    if (pk.taken > 0) continue;
    const bob = Math.sin(G.time * 3 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'ammo') {
      ctx.fillStyle = '#2d3436';
      rr(ctx, -11, -8, 22, 16, 3); ctx.fill();
      ctx.fillStyle = '#f5d76e';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 3.6);
    } else {
      ctx.fillStyle = '#ffffff';
      rr(ctx, -10, -10, 20, 20, 4); ctx.fill();
      ctx.fillStyle = '#e84118';
      ctx.fillRect(-2.6, -7, 5.2, 14);
      ctx.fillRect(-7, -2.6, 14, 5.2);
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------- HUD ----
function drawHud(G) {
  const { ctx } = G;
  // Cash + wanted stars, top-left.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  rr(ctx, 14, 12, 236, 64, 10); ctx.fill();
  ctx.fillStyle = '#7bed6a';
  ctx.font = 'bold 25px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + G.cash.toLocaleString('en-US'), 26, 46);
  drawStars(ctx, 26, 56, G.wanted, 15);
  if (G.heatFloor > 0) {
    ctx.fillStyle = '#ffb3b3';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('HEAT LOCKED', 130, 68);
  }

  // Health bar under the cash panel.
  const hp = Math.max(0, G.player.health) / CFG.playerHealth;
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  rr(ctx, 14, 82, 236, 16, 8); ctx.fill();
  ctx.fillStyle = hp > 0.35 ? '#58d158' : '#e84118';
  if (hp > 0) { rr(ctx, 17, 85, 230 * hp, 10, 5); ctx.fill(); }

  // Bust meter.
  if (G.bust > 0.02) {
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    rr(ctx, VIEW_W / 2 - 130, 96, 260, 26, 8); ctx.fill();
    ctx.fillStyle = '#3d7bd9';
    rr(ctx, VIEW_W / 2 - 124, 101, 248 * Math.min(1, G.bust), 16, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED METER', VIEW_W / 2, 113);
  }

  // Objective line, bottom-left.
  ctx.font = '600 16px system-ui, sans-serif';
  const obj = G.objectiveText || '';
  const w = ctx.measureText(obj).width + 28;
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  rr(ctx, 14, VIEW_H - 48, Math.min(w, VIEW_W - 320), 34, 9); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'left';
  ctx.fillText(obj, 28, VIEW_H - 26);

  // Bottom-right: speedometer while driving, ammo while armed on foot.
  if (G.player.car) {
    const kmh = Math.round(Math.abs(G.player.car.speed) * 0.62);
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    rr(ctx, VIEW_W - 168, VIEW_H - 84, 154, 70, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(kmh), VIEW_W - 91, VIEW_H - 40);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#aebfd0';
    ctx.fillText('km/h', VIEW_W - 91, VIEW_H - 22);
    const chp = Math.max(0, G.player.car.health) / 100;
    ctx.fillStyle = '#3a4552';
    rr(ctx, VIEW_W - 156, VIEW_H - 96, 130, 7, 3); ctx.fill();
    ctx.fillStyle = chp > 0.3 ? '#7bed6a' : '#e84118';
    if (chp > 0) { rr(ctx, VIEW_W - 156, VIEW_H - 96, 130 * chp, 7, 3); ctx.fill(); }
  } else if (G.player.armed) {
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    rr(ctx, VIEW_W - 148, VIEW_H - 56, 134, 42, 10); ctx.fill();
    ctx.fillStyle = G.player.ammo > 0 ? '#f5d76e' : '#e84118';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔫 ' + G.player.ammo, VIEW_W - 81, VIEW_H - 27);
  }

  // Toasts (pickups, hints).
  ctx.textAlign = 'center';
  let ty = VIEW_H - 130;
  for (const t of G.toasts) {
    ctx.font = '600 15px system-ui, sans-serif';
    const tw = ctx.measureText(t.text).width + 24;
    ctx.fillStyle = 'rgba(10,14,20,0.65)';
    rr(ctx, VIEW_W / 2 - tw / 2, ty - 17, tw, 26, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, VIEW_W / 2, ty + 2);
    ty -= 34;
  }

  // Context prompt ("E — enter car").
  if (G.promptText) {
    ctx.font = '600 15px system-ui, sans-serif';
    const tw = ctx.measureText(G.promptText).width + 26;
    ctx.fillStyle = 'rgba(10,14,20,0.65)';
    rr(ctx, VIEW_W / 2 - tw / 2, VIEW_H - 92, tw, 28, 8); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(G.promptText, VIEW_W / 2, VIEW_H - 72);
  }

  drawMinimap(G);
  drawEdgeArrow(G);

  // Red/blue edge glow when the PD is close and the heat is on.
  if (G.wanted >= 2 && G.police.length) {
    let nd = Infinity;
    for (const c of G.police) nd = Math.min(nd, Math.hypot(c.x - G.player.x, c.y - G.player.y));
    if (nd < 430) {
      const flash = Math.floor(G.time * 4) % 2 === 0;
      const a = 0.16 * (1 - nd / 430) + 0.04;
      ctx.strokeStyle = flash ? `rgba(255,59,48,${a})` : `rgba(46,155,255,${a})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, VIEW_W - 10, VIEW_H - 10);
    }
  }
}

function drawStars(ctx, x, y, n, size) {
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < n ? '#ffd32a' : 'rgba(255,255,255,0.22)';
    ctx.font = `${size + 6}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('★', x + i * (size + 5), y + 12);
  }
}

function drawMinimap(G) {
  const { ctx, world } = G;
  const mw = 196, mh = 147, mx = VIEW_W - mw - 14, my = 12;
  const sx = mw / world.w, sy = mh / world.h;
  ctx.save();
  ctx.fillStyle = 'rgba(16,26,20,0.82)';
  rr(ctx, mx - 4, my - 4, mw + 8, mh + 8, 10); ctx.fill();
  ctx.beginPath();
  rr(ctx, mx, my, mw, mh, 7); ctx.clip();
  ctx.fillStyle = '#5da24e';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2e9bc6';
  ctx.fillRect(mx, my + CFG.seaY * sy, mw, (world.h - CFG.seaY) * sy);
  ctx.fillStyle = '#eed9a0';
  ctx.fillRect(mx, my + CFG.beachY * sy, mw, (CFG.seaY - CFG.beachY) * sy);
  ctx.strokeStyle = '#55555f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const rx of world.roadsV) { ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + world.beachRoadY * sy); }
  for (const ry of [...world.roadsH, world.beachRoadY]) { ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(30,30,36,0.5)';
  for (const b of world.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1.6, b.w * sx), Math.max(1.6, b.h * sy));
  // Traffic dots.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const c of G.cars) ctx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 2, 2);
  // Police blips flash red/blue.
  const flash = Math.floor(G.time * 4) % 2 === 0;
  for (const c of G.police) {
    ctx.fillStyle = flash ? '#ff3b30' : '#2e9bff';
    ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Mission marker.
  const m = currentMarker(G);
  if (m) {
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(mx + m.x * sx, my + m.y * sy, 4 + Math.sin(G.time * 5) * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Player arrow.
  const px = mx + G.player.x * sx, py = my + G.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Camera viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + G.camera.x * sx, my + G.camera.y * sy, VIEW_W * sx, VIEW_H * sy);
  ctx.restore();
}

function drawEdgeArrow(G) {
  const m = currentMarker(G);
  if (!m || G.state !== 'playing') return;
  const cam = G.camera;
  const sx = m.x - cam.x, sy = m.y - cam.y;
  if (sx > 30 && sx < VIEW_W - 30 && sy > 30 && sy < VIEW_H - 30) return; // on screen already
  const cx = VIEW_W / 2, cy = VIEW_H / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(ang) * (VIEW_W / 2 - 60);
  const ey = cy + Math.sin(ang) * (VIEW_H / 2 - 60);
  const { ctx } = G;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const d = Math.round(Math.hypot(m.x - G.player.x, m.y - G.player.y) / 10);
  ctx.fillText(d + 'm', ex, ey + 26);
}

// ---------------------------------------------------------------- screens ----
function drawBanner(G) {
  const b = G.missions.banner;
  const { ctx } = G;
  const a = Math.min(1, b.t / 0.6, (3.4 - b.t) / 0.6 + 0.4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  const w = 560;
  rr(ctx, VIEW_W / 2 - w / 2, 128, w, 86, 12); ctx.fill();
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 27px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.title, VIEW_W / 2, 166);
  ctx.fillStyle = '#e8eef4';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(b.sub, VIEW_W / 2, 194);
  ctx.restore();
}

function drawTitle(G) {
  const { ctx } = G;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, 'rgba(20,10,40,0.55)');
  grad.addColorStop(0.55, 'rgba(20,10,40,0.25)');
  grad.addColorStop(1, 'rgba(10,20,40,0.65)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd32a';
  ctx.font = '900 92px system-ui, sans-serif';
  ctx.fillText('SOLMAR', VIEW_W / 2, 208);
  ctx.fillStyle = '#ff5e7a';
  ctx.fillText('HEAT', VIEW_W / 2, 296);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillText('An original open-world crime caper on the Solmar coast', VIEW_W / 2, 336);

  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  rr(ctx, VIEW_W / 2 - 330, 372, 660, 196, 14); ctx.fill();
  ctx.fillStyle = '#dfe8f2';
  ctx.font = '16.5px system-ui, sans-serif';
  const lines = [
    'WASD / Arrows — move · Shift — sprint · E — enter / exit car',
    'Mouse — aim · Right mouse or K — pistol · Left mouse or J — punch',
    'Enter / Esc — pause · M — mute · Run jobs from the $ beacon',
    'Steal cars, dodge the Solmar PD, deliver for cash.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 408 + i * 27));
  ctx.fillStyle = '#7bed6a';
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText(G.saveExists ? '▶  ENTER — Continue      N — New game' : '▶  Press ENTER or click START', VIEW_W / 2, 538);
  // Start button (clickable).
  ctx.fillStyle = '#e84118';
  rr(ctx, VIEW_W / 2 - 90, 566, 180, 46, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('START', VIEW_W / 2, 596);
  G.startButton = { x: VIEW_W / 2 - 90, y: 566, w: 180, h: 46 };
}

function drawPause(G) {
  const { ctx } = G;
  ctx.fillStyle = 'rgba(6,8,14,0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#fff';
  ctx.font = '900 54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW_W / 2, 320);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#c8d4e2';
  ctx.fillText('Esc / P — resume · M — mute · Your progress auto-saves at the hideout beacon', VIEW_W / 2, 362);
  ctx.fillText(`Cash $${G.cash.toLocaleString('en-US')} · Missions done: ${G.missions.done}/3`, VIEW_W / 2, 394);
}

function drawEndScreen(G, title, color, sub, prompt) {
  const { ctx } = G;
  ctx.fillStyle = 'rgba(6,8,14,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = color;
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 320);
  ctx.fillStyle = '#e8eef4';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(sub, VIEW_W / 2, 362);
  ctx.fillStyle = '#ffd32a';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(prompt, VIEW_W / 2, 410);
}
