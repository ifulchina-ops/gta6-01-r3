// The renderer: one canvas, one camera, everything the city is. The look is
// late-afternoon Solara Bay — warm light, long shadows, teal water, sand,
// palms, neon signs, detailed cars with headlights and spoilers, skid marks
// and dust. It also paints the title, paused, busted, wasted and story-done
// screens, so the game never leaves the canvas.

import { PALETTE, SHADOW, VEHICLES, WORLD_W, WORLD_H, clamp } from './config.js';
import { ROAD_V, ROAD_H, ROAD_W, isRoad, isSand, isWater } from './city.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_DONE = 'done';

export function createRenderer(canvas, hud) {
  const ctx = canvas.getContext('2d');
  const view = { camX: 1650, camY: 1050, width: 1280, height: 720, zoom: 0.85 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    view.width = canvas.clientWidth;
    view.height = canvas.clientHeight;
    view.zoom = clamp(Math.min(view.width / 1500, view.height / 850), 0.6, 1.1);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawGround(game) {
    const { camX, camY } = view;
    const x0 = camX - view.width / 2 / view.zoom;
    const y0 = camY - view.height / 2 / view.zoom;
    const x1 = camX + view.width / 2 / view.zoom;
    const y1 = camY + view.height / 2 / view.zoom;
    // Grass base with dry patches.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = PALETTE.grassDry;
    for (let gx = Math.floor(x0 / 260) * 260; gx < x1; gx += 260) {
      for (let gy = Math.floor(y0 / 260) * 260; gy < y1; gy += 260) {
        if (((gx * 7 + gy * 13) % 5) === 0) ctx.fillRect(gx, gy, 180, 150);
      }
    }
    // Beach sand, then the bay with animated waves.
    if (x0 < 230) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(Math.max(x0, 96), y0, Math.min(x1, 230) - Math.max(x0, 96), y1 - y0);
    }
    if (x0 < 96) {
      const grad = ctx.createLinearGradient(0, y0, 96, y0);
      grad.addColorStop(0, PALETTE.waterDeep);
      grad.addColorStop(1, PALETTE.water);
      ctx.fillStyle = grad;
      ctx.fillRect(x0, y0, Math.min(x1, 96) - x0, y1 - y0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      for (let wy = Math.floor(y0 / 90) * 90; wy < y1; wy += 90) {
        ctx.beginPath();
        for (let wx = Math.max(x0, 8); wx < Math.min(x1, 96); wx += 12) {
          const wave = Math.sin(wx * 0.12 + game.time * 1.6 + wy * 0.05) * 3;
          if (wx === Math.max(x0, 8)) ctx.moveTo(wx, wy + wave);
          else ctx.lineTo(wx, wy + wave);
        }
        ctx.stroke();
      }
    }
    // Roads: asphalt, edge lines, dashed centres, crosswalks at corners.
    ctx.fillStyle = PALETTE.asphalt;
    for (const rx of ROAD_V) {
      if (rx + ROAD_W / 2 < x0 || rx - ROAD_W / 2 > x1) continue;
      ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    }
    for (const ry of ROAD_H) {
      if (ry + ROAD_W / 2 < y0 || ry - ROAD_W / 2 > y1) continue;
      ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
    }
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const rx of ROAD_V) {
      if (rx < x0 || rx > x1) continue;
      ctx.beginPath();
      ctx.moveTo(rx, y0);
      ctx.lineTo(rx, y1);
      ctx.stroke();
    }
    for (const ry of ROAD_H) {
      if (ry < y0 || ry > y1) continue;
      ctx.beginPath();
      ctx.moveTo(x0, ry);
      ctx.lineTo(x1, ry);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Sidewalk ribbons around each block.
    ctx.fillStyle = PALETTE.sidewalk;
    for (let vi = 0; vi < ROAD_V.length - 1; vi += 1) {
      for (let hi = 0; hi < ROAD_H.length - 1; hi += 1) {
        const bx0 = ROAD_V[vi] + ROAD_W / 2;
        const by0 = ROAD_H[hi] + ROAD_W / 2;
        const bx1 = ROAD_V[vi + 1] - ROAD_W / 2;
        const by1 = ROAD_H[hi + 1] - ROAD_W / 2;
        if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1) continue;
        ctx.fillRect(bx0, by0, bx1 - bx0, 10);
        ctx.fillRect(bx0, by1 - 10, bx1 - bx0, 10);
        ctx.fillRect(bx0, by0, 10, by1 - by0);
        ctx.fillRect(bx1 - 10, by0, 10, by1 - by0);
      }
    }
  }

  function drawShadow(x, y, w, h) {
    ctx.fillStyle = 'rgba(20, 16, 8, 0.28)';
    ctx.fillRect(x + SHADOW.x - w / 2, y + SHADOW.y - h / 2, w, h);
  }

  function drawBuilding(b) {
    drawShadow(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);
    // Sunlit face: the district colour, lit from the top-left.
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(b.x, b.y, b.w, 7);
    ctx.fillRect(b.x, b.y, 7, b.h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
    ctx.fillRect(b.x + b.w - 6, b.y, 6, b.h);
    // Windows across the whole face: mostly dark glass, some lit gold.
    const cols = Math.max(3, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        const wx = b.x + 10 + cx * ((b.w - 20) / cols);
        const wy = b.y + 10 + cy * ((b.h - 20) / rows);
        const roll = (cx * 7 + cy * 11 + Math.floor(b.windowsLit * 13)) % 5;
        ctx.fillStyle = roll === 0 ? '#ffd97a' : roll === 1 ? '#9fc4d8' : '#22303f';
        ctx.fillRect(wx, wy, 13, 11);
      }
    }
    // Rooftop furniture: AC boxes, and a helipad on the tall towers.
    ctx.fillStyle = '#2c3038';
    ctx.fillRect(b.x + 14, b.y + 14, 18, 12);
    ctx.fillRect(b.x + b.w - 32, b.y + b.h - 26, 18, 12);
    if (b.floors >= 10) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) / 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.font = `bold ${Math.min(22, b.w / 4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2);
    }
    // Neon sign on the roof edge.
    if (b.sign) {
      ctx.fillStyle = b.signColor;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y - 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(b.x + b.w / 2 - ctx.measureText(b.sign).width / 2 - 4, b.y - 20, ctx.measureText(b.sign).width + 8, 2);
    }
  }

  function drawPalm(palm) {
    const s = palm.s;
    ctx.strokeStyle = 'rgba(20, 16, 8, 0.25)';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(palm.x + SHADOW.x, palm.y + SHADOW.y);
    ctx.lineTo(palm.x + 14 * s + SHADOW.x, palm.y + SHADOW.y);
    ctx.stroke();
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.quadraticCurveTo(palm.x + 4 * s, palm.y - 16 * s, palm.x + 10 * s, palm.y - 26 * s);
    ctx.stroke();
    ctx.fillStyle = '#3f8a3f';
    for (let f = 0; f < 6; f += 1) {
      const a = (f / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(palm.x + 10 * s + Math.cos(a) * 13 * s, palm.y - 26 * s + Math.sin(a) * 8 * s, 14 * s, 4.5 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#6b4a1f';
    ctx.beginPath();
    ctx.arc(palm.x + 10 * s, palm.y - 26 * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawProp(prop, game) {
    if (prop.kind === 'fountain') {
      ctx.fillStyle = '#8a97a8';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#39c2d7';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, prop.r - 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(prop.x + Math.sin(game.time * 2) * 6, prop.y, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'bench') {
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(prop.x - 12, prop.y - 4, 24, 8);
    } else if (prop.kind === 'umbrella') {
      ctx.fillStyle = 'rgba(20, 16, 8, 0.2)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 8, prop.y + 6, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = prop.color;
      ctx.beginPath();
      ctx.moveTo(prop.x - 18, prop.y);
      ctx.lineTo(prop.x, prop.y - 20);
      ctx.lineTo(prop.x + 18, prop.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5a4a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y - 18);
      ctx.lineTo(prop.x, prop.y + 4);
      ctx.stroke();
    } else if (prop.kind === 'crane') {
      ctx.strokeStyle = '#d9a03a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y);
      ctx.lineTo(prop.x, prop.y - 190);
      ctx.lineTo(prop.x + 130, prop.y - 190);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(prop.x + 90, prop.y - 190);
      ctx.lineTo(prop.x + 90, prop.y - 120);
      ctx.stroke();
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(prop.x + 78, prop.y - 120, 24, 20);
    }
  }

  function drawCar(car, game) {
    const isBike = car.body === 'bike';
    const len = car.body === 'truck' ? 66 : isBike ? 40 : 52;
    const wid = isBike ? 14 : 26;
    drawShadow(car.x, car.y, len, wid);
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
      ctx.fillRect(-len / 2, -wid / 2, len, wid);
      ctx.fillStyle = '#555';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WRECK', 0, 4);
      ctx.restore();
      return;
    }
    // Wheels.
    ctx.fillStyle = '#14161c';
    const wl = len / 2 - 8;
    const ww = wid / 2 + 1;
    if (!isBike) {
      ctx.fillRect(-wl, -ww - 2, 12, 5);
      ctx.fillRect(wl - 4, -ww - 2, 12, 5);
      ctx.fillRect(-wl, ww - 3, 12, 5);
      ctx.fillRect(wl - 4, ww - 3, 12, 5);
    }
    // Body with a darker lower half for depth.
    ctx.fillStyle = car.color;
    roundRect(-len / 2, -wid / 2, len, wid, isBike ? 7 : 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(-len / 2, 2, len, wid / 2 - 2);
    // Windshield + roof.
    ctx.fillStyle = 'rgba(180, 220, 240, 0.85)';
    ctx.fillRect(-6, -wid / 2 + 3, 12, wid - 6);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(4, -wid / 2 + 3, 10, wid - 6);
    // Type details: taxi checker + roof sign, truck cargo, sports spoiler + stripes, cop light bar.
    if (car.body === 'taxi') {
      ctx.fillStyle = '#14161c';
      for (let i = 0; i < 6; i += 1) ctx.fillRect(-len / 2 + 4 + i * 7, -2, 4, 4);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-4, -wid / 2 - 7, 14, 6);
      ctx.fillStyle = '#14161c';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 3, -wid / 2 - 2);
    } else if (car.body === 'truck') {
      ctx.fillStyle = '#d8d3c4';
      ctx.fillRect(-len / 2 + 2, -wid / 2 + 2, 26, wid - 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(-len / 2 + 2, -wid / 2 + 2, 26, wid - 4);
    } else if (car.body === 'sports') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(-len / 2 + 6, -3, len - 20, 2);
      ctx.fillRect(-len / 2 + 6, 1, len - 20, 2);
      ctx.fillStyle = '#14161c';
      ctx.fillRect(-len / 2 - 3, -wid / 2 - 2, 5, wid + 4);
    } else if (car.body === 'bike') {
      ctx.fillStyle = '#e86a8a';
      ctx.beginPath();
      ctx.arc(2, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (car.body === 'cop') {
      const flash = Math.floor(game.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
      ctx.fillRect(-2, -wid / 2 - 2, 8, 5);
      ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
      ctx.fillRect(-2, wid / 2 - 3, 8, 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
    }
    // Headlights.
    ctx.fillStyle = '#fff6b0';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 5);
    ctx.fillRect(len / 2 - 2, wid / 2 - 8, 3, 5);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPerson(x, y, angle, shirt, pants, phase, scale = 1) {
    drawShadow(x, y, 16 * scale, 10 * scale);
    const bob = Math.sin(phase) * 1.5;
    ctx.fillStyle = pants;
    ctx.fillRect(x - 4 * scale, y + 2 * scale + bob, 8 * scale, 9 * scale);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(x, y - 2 * scale + bob * 0.5, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b48a';
    ctx.beginPath();
    ctx.arc(x, y - 9 * scale + bob * 0.5, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick so aim direction reads.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 2 * scale);
    ctx.lineTo(x + Math.cos(angle) * 10 * scale, y - 2 * scale + Math.sin(angle) * 10 * scale);
    ctx.stroke();
  }

  function drawMarker(x, y, color, label, pulse) {
    const r = 16 + Math.sin(pulse) * 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-r / 2, -r / 2, r, r);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-r / 2, -r / 2, r, r);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 210, 63, 0.12)';
    ctx.fillRect(x - 3, y - 130, 6, 130);
    if (label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 34);
      ctx.textAlign = 'left';
    }
  }

  function drawOverlay(game, screen) {
    const { width, height } = view;
    ctx.fillStyle = 'rgba(10, 14, 22, 0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText('SOLARA BAY', width / 2, height / 2 - 96);
      ctx.fillStyle = '#ff7a59';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('HEAT RISING', width / 2, height / 2 - 52);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px sans-serif';
      ctx.fillText('Twelve jobs. One heist. Five stars. Take the city.', width / 2, height / 2 - 8);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = Math.floor(game.time * 2) % 2 === 0 ? '#ffffff' : '#ffd23f';
      ctx.fillText(game.hasSave ? 'Press Enter to continue — your story is saved' : 'Press Enter or click to start', width / 2, height / 2 + 44);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '14px sans-serif';
      ctx.fillText('WASD walk & drive  •  E steal car  •  Click shoot  •  R radio  •  P pause  •  M mute', width / 2, height / 2 + 84);
      ctx.fillText('Taxi fares pay. Stashes hide. The safehouse heals and saves.', width / 2, height / 2 + 108);
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText('PAUSED', width / 2, height / 2);
      ctx.font = '16px sans-serif';
      ctx.fillText('Press P to keep playing', width / 2, height / 2 + 36);
    } else if (screen === SCREEN_BUSTED) {
      ctx.fillStyle = '#3b82ff';
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText('BUSTED', width / 2, height / 2 - 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Fine: $${game.bustedFine} — you woke up at Bay General.`, width / 2, height / 2 + 28);
      ctx.fillText('Press Enter to get back out there.', width / 2, height / 2 + 56);
    } else if (screen === SCREEN_WASTED) {
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText('WASTED', width / 2, height / 2 - 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Fine: $${game.bustedFine} — you woke up at Bay General.`, width / 2, height / 2 + 28);
      ctx.fillText('Press Enter to get back out there.', width / 2, height / 2 + 56);
    } else if (screen === SCREEN_DONE) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText('KING OF SOLARA', width / 2, height / 2 - 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Twelve jobs done. $${game.money.toLocaleString('en-US')} in the pocket. The city is yours.`, width / 2, height / 2 + 28);
      ctx.fillText('Press Enter to keep cruising — fares and stashes are still out there.', width / 2, height / 2 + 56);
    }
    ctx.textAlign = 'left';
  }

  function draw(game, screen) {
    const p = game.player;
    view.camX = clamp(p.x, view.width / 2 / view.zoom, WORLD_W - view.width / 2 / view.zoom);
    view.camY = clamp(p.y, view.height / 2 / view.zoom, WORLD_H - view.height / 2 / view.zoom);
    ctx.setTransform(view.zoom, 0, 0, view.zoom, view.width / 2 - view.camX * view.zoom, view.height / 2 - view.camY * view.zoom);
    drawGround(game);
    const x0 = view.camX - view.width / 2 / view.zoom - 60;
    const y0 = view.camY - view.height / 2 / view.zoom - 60;
    const x1 = view.camX + view.width / 2 / view.zoom + 60;
    const y1 = view.camY + view.height / 2 / view.zoom + 60;
    const onScreen = (x, y, m = 80) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
    // Skid marks fade under everything else.
    ctx.strokeStyle = 'rgba(20, 20, 24, 0.4)';
    ctx.lineWidth = 5;
    for (const s of game.skids) {
      ctx.globalAlpha = clamp(s.life / 5, 0, 0.55);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 16, s.y - Math.sin(s.angle) * 16);
      ctx.lineTo(s.x + Math.cos(s.angle) * 16, s.y + Math.sin(s.angle) * 16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of game.city.buildings) if (onScreen(b.x + b.w / 2, b.y + b.h / 2, 120)) drawBuilding(b);
    for (const c of game.city.containers) {
      if (!onScreen(c.x, c.y, 60)) continue;
      drawShadow(c.x + c.w / 2, c.y + c.h / 2, c.w, c.h);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    }
    for (const prop of game.city.props) if (onScreen(prop.x, prop.y, 100)) drawProp(prop, game);
    for (const palm of game.city.palms) if (onScreen(palm.x, palm.y, 60)) drawPalm(palm);
    // Cash bags, stashes and the bank casing zone.
    for (const prop of game.props) {
      if (prop.taken || !onScreen(prop.x, prop.y, 40)) continue;
      if (prop.kind === 'cash') {
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', prop.x, prop.y + 4);
        ctx.textAlign = 'left';
      } else if (prop.kind === 'stash') {
        const pulse = 1 + Math.sin(game.time * 4 + prop.x) * 0.15;
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 9 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    // Mission zone ring for the bank casing job.
    if (game.mission.index === 5 || (game.mission.index === 7 && game.mission.phase === 1)) {
      const bank = game.city.landmarks.bank;
      ctx.strokeStyle = 'rgba(255, 210, 63, 0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(bank.x, bank.y, 130, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Cars, people, bullets, particles.
    for (const car of game.cars) if (onScreen(car.x, car.y, 80)) drawCar(car, game);
    for (const ped of game.peds) {
      if (!onScreen(ped.x, ped.y, 40)) continue;
      if (ped.dead) {
        ctx.fillStyle = 'rgba(20, 20, 24, 0.5)';
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawPerson(ped.x, ped.y, 0, ped.shirt, ped.pants, ped.walkPhase);
      }
    }
    for (const e of game.enemies) {
      if (!onScreen(e.x, e.y, 40)) continue;
      drawPerson(e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), e.boss ? '#1c2733' : '#c22e2e', '#2c3038', game.time * 8, e.boss ? 1.5 : 1);
      // Health bar over rivals.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - 16, e.y - 30, 32, 5);
      ctx.fillStyle = e.boss ? '#ff3b30' : '#ff7a59';
      ctx.fillRect(e.x - 16, e.y - 30, 32 * clamp(e.hp / (e.boss ? 320 : 120), 0, 1), 5);
      if (e.boss) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('THE KINGPIN', e.x, e.y - 38);
        ctx.textAlign = 'left';
      }
    }
    for (const off of game.officers) {
      if (!onScreen(off.x, off.y, 40)) continue;
      drawPerson(off.x, off.y, Math.atan2(p.y - off.y, p.x - off.x), '#1c2733', '#1c2733', game.time * 10);
      ctx.fillStyle = '#3b82ff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', off.x, off.y - 16);
      ctx.textAlign = 'left';
    }
    // The player: on foot, or the car he is driving (drawn above already).
    if (!p.car) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 2, 15, 0, Math.PI * 2);
      ctx.stroke();
      drawPerson(p.x, p.y, p.angle, '#ffffff', '#2c3038', p.moving ? game.time * 12 : 0);
      if (game.combat.muzzle > 0) {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Bullets.
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 3;
    for (const b of game.combat.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ff9d5c';
    for (const b of game.combat.enemyBullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of game.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Markers: mission target, fare, safehouse.
    const target = game.missionTarget;
    if (target && screen === SCREEN_PLAY) {
      drawMarker(target.x, target.y, '#ffd23f', target.label, game.time * 4);
    }
    const fare = game.fareTarget;
    if (fare && screen === SCREEN_PLAY) {
      drawMarker(fare.x, fare.y, '#39d353', fare.label, game.time * 4 + 2);
    }
    // Warm late-afternoon light over everything.
    ctx.fillStyle = 'rgba(255, 176, 92, 0.06)';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Back to screen space for the HUD and overlays.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = canvas.width / view.width;
    ctx.scale(dpr, dpr);
    if (screen !== SCREEN_TITLE) drawHud(ctx, game, view);
    if (screen !== SCREEN_PLAY) drawOverlay(game, screen);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, view };
}
