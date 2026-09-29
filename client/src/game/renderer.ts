import { person, skyline } from './art';
import { FLOOR, PLAYER_X, type Run } from './runner';

export function drawGame(c: CanvasRenderingContext2D, width: number, run: Run, reducedMotion: boolean) {
  skyline(c, width, 320, reducedMotion ? 0 : run.distance, false);
  c.fillStyle = '#091418cc'; c.fillRect(0, FLOOR + 10, width, 65);
  for (const gap of run.gaps) {
    const x = gap.x - run.distance;
    c.fillStyle = '#040c11'; c.fillRect(x, FLOOR, gap.width, 65);
    c.fillStyle = '#3e686a'; c.fillRect(x + 9, FLOOR + 55, gap.width - 18, 2);
    c.fillStyle = '#b68351'; c.font = '10px monospace';
    c.fillText('DROP', x + gap.width / 2 - 12, FLOOR + 47);
  }
  for (const p of run.platforms) {
    const x = Math.floor(p.x - run.distance);
    c.fillStyle = p.kind === 'vent' ? '#654e3b' : '#14262c';
    c.fillRect(x, p.top, p.width, 320 - p.top);
    c.fillStyle = p.kind === 'step' ? '#91aca1' : '#668783'; c.fillRect(x, p.top, p.width, 3);
    c.fillStyle = '#314a4e'; c.fillRect(x, p.top + 8, p.width, 2);
    c.strokeStyle = '#253c40'; c.lineWidth = 1;
    for (let seam = x + 36; seam < x + p.width; seam += 40) {
      c.beginPath(); c.moveTo(seam, p.top + 10); c.lineTo(seam, 320); c.stroke();
    }
    if (p.kind === 'vent') {
      c.fillStyle = '#b69a72';
      for (let y = p.top + 7; y < FLOOR - 2; y += 6) c.fillRect(x + 5, y, p.width - 10, 2);
    }
    for (const edge of [p.x, p.x + p.width]) {
      if (run.gaps.some(g => g.x === edge || g.x + g.width === edge)) {
        c.fillStyle = '#e2ae6b'; c.fillRect(edge - run.distance - 4, p.top - 7, 8, 7);
      }
    }
  }
  for (const sign of run.signs) {
    const x = sign.x - run.distance;
    c.font = '11px monospace'; c.fillStyle = '#0e1c20db';
    c.fillRect(x - 7, sign.y - 15, c.measureText(sign.text).width + 14, 24);
    c.fillStyle = '#b5c6b6'; c.fillText(sign.text, x, sign.y);
  }
  for (const tape of run.tapes) {
    if (tape.collected) continue;
    const x = tape.x - run.distance, y = tape.y;
    c.fillStyle = '#e2d4b2'; c.fillRect(x, y, 19, 12);
    c.fillStyle = '#b4633b'; c.fillRect(x + 2, y + 1, 15, 4);
    c.fillStyle = '#283d40'; c.fillRect(x + 3, y + 6, 4, 3); c.fillRect(x + 12, y + 6, 4, 3);
  }
  if (run.boost > 0 && !reducedMotion) {
    c.strokeStyle = '#c8e7d1'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(PLAYER_X, run.feet + 9, 12 + (1 - run.boost / .24) * 12, 4, 0, 0, Math.PI * 2); c.stroke();
  }
  person(c, PLAYER_X, run.feet, 1.45, run.mode === 'running' && run.grounded ? Math.floor(run.elapsed * 8) % 3 : 0);
  if (run.mode !== 'running') {
    c.fillStyle = '#081215b8'; c.fillRect(0, 0, width, 320);
    c.textAlign = 'center'; c.fillStyle = '#e0d5b7'; c.font = `bold ${width < 600 ? 20 : 24}px monospace`;
    c.fillText(run.mode === 'idle' ? 'TAPE RUN // ROOFTOP MIX' : run.mode === 'paused' ? 'PAUSED' : 'END OF SIDE A', width / 2, 127);
    c.fillStyle = '#a5b5ac'; c.font = `${width < 600 ? 12 : 14}px monospace`;
    c.fillText(run.mode === 'over' ? 'A missed landing. Save a boost for the gap.' : 'Climb the stairs. Cross gaps. Grab the tapes.', width / 2, 159);
    c.fillStyle = '#d8ae77'; c.font = `${width < 600 ? 11 : 12}px monospace`;
    c.fillText(run.mode === 'over' ? 'RUN AGAIN below. Your ballot is untouched.' : 'Press jump again in the air for a second boost.', width / 2, 185);
    c.textAlign = 'start';
  }
}
