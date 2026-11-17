// HUD: everything Rico needs without pausing — money, health, ammo, wanted
// stars, the current job, a live minimap, the radio station and his speed.
// Drawn on the canvas so it shows up in screenshots exactly as it plays.

import { ROAD_V, ROAD_H } from './city.js';
import { missionTarget, currentMission, currentObjective } from './missions.js';
import { fareTarget } from './activities.js';
import { clamp } from './config.js';

const MAP_SIZE = 168;
const MAP_SCALE = MAP_SIZE / 3400;

export function createHud() {
  return {};
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12, 16, 24, 0.62)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function drawStars(ctx, x, y, wanted) {
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < wanted ? '#ffd23f' : 'rgba(255, 255, 255, 0.25)';
    ctx.fillText('★', x + i * 26, y);
  }
}

function drawMinimap(ctx, game, view) {
  const x0 = 14;
  const y0 = view.height - MAP_SIZE - 14;
  panel(ctx, x0 - 6, y0 - 6, MAP_SIZE + 12, MAP_SIZE + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MAP_SIZE, MAP_SIZE);
  ctx.clip();
  // Water on the west edge, sand next to it.
  ctx.fillStyle = '#1d7f9c';
  ctx.fillRect(x0, y0, 96 * MAP_SCALE, MAP_SIZE);
  ctx.fillStyle = '#eed9a4';
  ctx.fillRect(x0 + 96 * MAP_SCALE, y0, 134 * MAP_SCALE, MAP_SIZE);
  ctx.fillStyle = '#5a7a44';
  ctx.fillRect(x0, y0, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = '#2c3038';
  for (const rx of ROAD_V) ctx.fillRect(x0 + rx * MAP_SCALE - 2, y0, 4, MAP_SIZE);
  for (const ry of ROAD_H) ctx.fillRect(x0, y0 + ry * MAP_SCALE - 2, MAP_SIZE, 4);
  // Buildings as faint blocks.
  ctx.fillStyle = 'rgba(20, 24, 32, 0.55)';
  for (const b of game.city.buildings) {
    ctx.fillRect(x0 + b.x * MAP_SCALE, y0 + b.y * MAP_SCALE, Math.max(2, b.w * MAP_SCALE), Math.max(2, b.h * MAP_SCALE));
  }
  // Stashes as gold dots, fare as a green dot, mission target pulsing yellow.
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 12; i += 1) {
    if (game.activities.stashesFound.includes(i)) continue;
    const s = game.stashSpots[i];
    ctx.fillRect(x0 + s.x * MAP_SCALE - 1.5, y0 + s.y * MAP_SCALE - 1.5, 3, 3);
  }
  const fare = fareTarget(game);
  if (fare) {
    ctx.fillStyle = '#39d353';
    ctx.beginPath();
    ctx.arc(x0 + fare.x * MAP_SCALE, y0 + fare.y * MAP_SCALE, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const target = missionTarget(game);
  if (target) {
    const pulse = 4 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x0 + target.x * MAP_SCALE, y0 + target.y * MAP_SCALE, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops flash red-blue; the player is a white dot with a ring.
  for (const cop of game.cops) {
    ctx.fillStyle = Math.floor(game.time * 4) % 2 === 0 ? '#ff3b30' : '#3b82ff';
    ctx.beginPath();
    ctx.arc(x0 + cop.x * MAP_SCALE, y0 + cop.y * MAP_SCALE, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + game.player.x * MAP_SCALE, y0 + game.player.y * MAP_SCALE, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + game.player.x * MAP_SCALE, y0 + game.player.y * MAP_SCALE, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SOLARA BAY', x0, y0 - 10);
}

export function drawHud(ctx, game, view) {
  const { width, height } = view;
  ctx.textBaseline = 'alphabetic';
  // Top-left: money, health, ammo.
  panel(ctx, 14, 14, 236, 84);
  ctx.fillStyle = '#39d353';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${game.money.toLocaleString('en-US')}`, 26, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`AMMO ${game.player.ammo}`, 26, 62);
  ctx.fillText(`STASH ${game.activities.stashes}/12   FARES ${game.activities.faresDone}`, 26, 80);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(26, 88, 212, 6);
  ctx.fillStyle = game.player.health > 30 ? '#39d353' : '#ff3b30';
  ctx.fillRect(26, 88, 212 * clamp(game.player.health / 100, 0, 1), 6);
  // Top-right: wanted stars.
  panel(ctx, width - 178, 14, 164, 44);
  drawStars(ctx, width - 166, 37, game.wanted);
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(game.wanted > 0 ? 'WANTED' : 'CLEAN', width - 26, 52);
  ctx.textAlign = 'left';
  // Top-centre: current job.
  const mission = currentMission(game);
  if (mission) {
    const obj = currentObjective(game);
    ctx.font = 'bold 15px sans-serif';
    const w = Math.max(ctx.measureText(obj).width, ctx.measureText(mission.title).width) + 28;
    panel(ctx, width / 2 - w / 2, 14, w, 52);
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText(`${mission.title}  •  $${mission.reward}`, width / 2, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText(obj, width / 2, 54);
    ctx.textAlign = 'left';
  }
  // Bottom-right: radio chip + speed.
  const radio = game.radio;
  const chip = `♪ ${radio.name()} — ${radio.track()}`;
  ctx.font = '12px sans-serif';
  const chipW = ctx.measureText(chip).width + 24;
  panel(ctx, width - chipW - 14, height - 74, chipW, 30);
  ctx.fillStyle = radio.color();
  ctx.fillRect(width - chipW - 14, height - 74, 5, 30);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(chip, width - chipW + 4, height - 54);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '11px sans-serif';
  ctx.fillText('R — change station', width - chipW - 14, height - 82);
  if (game.player.car) {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(game.player.car.speed) * 0.12)} mph`, width - 20, height - 88);
    ctx.textAlign = 'left';
  }
  // Toast under the job bar.
  if (game.toastTimer > 0) {
    ctx.globalAlpha = clamp(game.toastTimer, 0, 1);
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(game.toastText).width + 28;
    panel(ctx, width / 2 - tw / 2, 76, tw, 32);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(game.toastText, width / 2, 97);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  drawMinimap(ctx, game, view);
}
