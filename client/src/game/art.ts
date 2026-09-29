function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function skyline(c: CanvasRenderingContext2D, w: number, h: number, offset = 0, ground = true) {
  const r = random(1986);
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0c171c'); sky.addColorStop(.6, '#204046'); sky.addColorStop(1, '#182c31');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  const glow = c.createRadialGradient(w * .64, h * .49, 12, w * .64, h * .49, w * .4);
  glow.addColorStop(0, '#bd754d65'); glow.addColorStop(.5, '#667a6d24'); glow.addColorStop(1, '#233b4000');
  c.fillStyle = glow; c.fillRect(0, 0, w, h);
  c.fillStyle = '#b88754'; c.fillRect(w * .64, h * .29, 53, 53);
  c.fillStyle = '#223b40'; c.fillRect(w * .64, h * .29 + 29, 53, 5);
  for (let layer = 0; layer < 3; layer++) {
    let x = -90 - (offset * (layer + 1) * .13 % 90);
    while (x < w + 100) {
      const bw = 30 + Math.floor(r() * 70), bh = 50 + Math.floor(r() * (130 + layer * 30));
      const bottom = h * (.64 + layer * .085);
      c.fillStyle = ['#20353b', '#172c32', '#112329'][layer];
      c.fillRect(x, bottom - bh, bw, bh);
      c.fillRect(x + bw * .25, bottom - bh - 12, bw * .45, 12);
      c.fillRect(x + bw * .4, bottom - bh - 35, 2, 24);
      for (let wx = x + 8; wx < x + bw - 7; wx += 10) {
        for (let wy = bottom - bh + 12; wy < bottom - 8; wy += 14) {
          if (r() > .63) {
            c.fillStyle = r() > .35 ? '#55807966' : '#d68d4b77';
            c.fillRect(wx, wy, 3 + Math.floor(r() * 3), 5);
          }
        }
      }
      if (layer === 1 && bw > 60) {
        c.fillStyle = '#498486'; c.fillRect(x + bw - 14, bottom - bh + 20, 6, 35);
      }
      x += bw + 5 + Math.floor(r() * 12);
    }
  }
  c.fillStyle = '#79a7a80c';
  c.beginPath(); c.moveTo(w * .81, h * .3); c.lineTo(w * .38, h * .81); c.lineTo(w * .62, h * .81); c.closePath(); c.fill();
  if (!ground) return;
  c.fillStyle = '#071317'; c.fillRect(0, h * .85, w, h * .15);
  c.fillStyle = '#446366'; c.fillRect(0, h * .85, w, 3);
  c.fillStyle = '#172c31'; c.fillRect(0, h * .89, w, 4);
  for (let x = -offset % 55; x < w; x += 55) {
    c.fillStyle = '#2a4247'; c.fillRect(x, h * .89, 28, 2);
  }
}

export function person(c: CanvasRenderingContext2D, x: number, floor: number, scale: number, phase: number) {
  c.save(); c.translate(Math.floor(x), Math.floor(floor)); c.scale(scale, scale);
  c.fillStyle = '#d9cbb3'; c.fillRect(-3, -27, 7, 7);
  c.fillStyle = '#15242a'; c.fillRect(-4, -29, 8, 3);
  c.fillStyle = '#b7653c'; c.fillRect(-5, -20, 10, 13); c.fillRect(-8, -17, 3, 9);
  c.fillStyle = '#172329'; c.fillRect(-4 - phase, -7, 4, 7); c.fillRect(1 + phase, -7, 4, 7);
  c.fillStyle = '#afbaa4'; c.fillRect(-5 - phase, -2, 5, 2); c.fillRect(1 + phase, -2, 5, 2);
  c.restore();
}

export function drawRooftops(ctx: CanvasRenderingContext2D) {
  skyline(ctx, 1440, 690);
  ctx.fillStyle = '#101c20'; ctx.fillRect(1020, 45, 24, 542); ctx.fillRect(1007, 67, 147, 17);
  ctx.fillStyle = '#66938a'; ctx.fillRect(1100, 84, 42, 5);
  ctx.fillStyle = '#72988c18';
  ctx.beginPath(); ctx.moveTo(1102, 89); ctx.lineTo(927, 586); ctx.lineTo(1310, 586); ctx.lineTo(1138, 89); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#081317'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 115); ctx.quadraticCurveTo(500, 265, 1032, 51); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1032, 51); ctx.quadraticCurveTo(1300, 190, 1440, 90); ctx.stroke();
  ctx.fillStyle = '#121e23'; ctx.fillRect(725, 359, 137, 92);
  ctx.strokeStyle = '#426469'; ctx.lineWidth = 3; ctx.strokeRect(725, 359, 137, 92);
  ctx.fillStyle = '#d48755'; ctx.font = 'bold 21px monospace'; ctx.fillText('STAY LATE', 736, 390);
  ctx.fillStyle = '#698684'; ctx.font = '12px monospace'; ctx.fillText('MAKE SOMETHING', 736, 413);
  ctx.fillStyle = '#0b191e'; ctx.fillRect(750, 452, 6, 132); ctx.fillRect(839, 452, 6, 132);
  person(ctx, 948, 584, 2.2, 0);
  const rain = random(86);
  ctx.strokeStyle = '#9ab2a414'; ctx.lineWidth = 1;
  for (let i = 0; i < 200; i++) {
    const x = rain() * 1440, y = rain() * 650;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); ctx.stroke();
  }
}
