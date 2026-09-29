export const FLOOR = 255;
export const PLAYER_X = 140;
const SPEED = 190;
const GRAVITY = 1050;
const JUMP_SPEED = 360;
const CHUNK_WIDTH = 1280;

export type GameMode = 'idle' | 'running' | 'paused' | 'over' | 'error';
export type Platform = { x: number; width: number; top: number; kind: 'roof' | 'step' | 'vent' };
export type Run = {
  mode: GameMode; distance: number; elapsed: number; feet: number; velocity: number;
  grounded: boolean; jumpsLeft: number; coyote: number; boost: number;
  collected: number; section: number; reason: string;
  platforms: Platform[];
  gaps: { x: number; width: number }[];
  tapes: { x: number; y: number; collected: boolean }[];
  signs: { x: number; y: number; text: string }[];
};

function addSection(run: Run) {
  const base = run.section * CHUNK_WIDTH;
  const roof = (x: number, width: number, rise = 0, kind: Platform['kind'] = 'roof') =>
    run.platforms.push({ x: base + x, width, top: FLOOR - rise, kind });
  const gap = (x: number, width: number) => run.gaps.push({ x: base + x, width });
  const tape = (x: number, rise: number) => run.tapes.push({ x: base + x, y: FLOOR - rise, collected: false });
  const sign = (x: number, rise: number, text: string) => run.signs.push({ x: base + x, y: FLOOR - rise, text });

  // Authored sections keep every gap reachable at a fixed, relaxed pace.
  switch (run.section % 3) {
    case 0:
      roof(0, 360);
      roof(360, 72, 18, 'step'); roof(432, 72, 36, 'step');
      roof(504, 120, 54, 'step');
      roof(624, 72, 36, 'step'); roof(696, 72, 18, 'step');
      roof(768, 90); gap(858, 112); roof(970, 310);
      [395, 467, 550, 660, 730].forEach((x, i) => tape(x, [44, 62, 80, 62, 44][i]));
      tape(875, 64); tape(928, 75);
      sign(360, 106, '01 / UP & OVER'); sign(820, 116, 'MIND THE GAP');
      break;
    case 1:
      roof(0, 280); gap(280, 190); roof(470, 245);
      roof(715, 65, 18, 'step'); roof(780, 65, 36, 'step');
      roof(845, 155, 54, 'step'); gap(1000, 140); roof(1140, 140);
      tape(290, 65); tape(350, 105); tape(410, 112); tape(480, 70);
      tape(752, 44); tape(818, 62); tape(930, 80); tape(1030, 105); tape(1090, 100);
      sign(230, 145, '02 / JUMP. JUMP AGAIN.'); sign(830, 119, 'ROOFTOP SHORTCUT');
      break;
    case 2:
      roof(0, 640); roof(260, 38, 30, 'vent');
      roof(490, 60, 18, 'step'); roof(550, 90, 36, 'step');
      gap(640, 130); roof(770, 200); gap(970, 122); roof(1092, 188);
      tape(275, 77); tape(525, 44); tape(592, 62); tape(669, 88); tape(727, 80);
      tape(850, 27); tape(987, 66); tape(1045, 76);
      sign(230, 123, '03 / MIX IT UP'); sign(780, 134, 'LAND. RECHARGE. GO.');
      break;
  }
  run.section++;
}

export function createRun(): Run {
  const run: Run = {
    mode: 'idle', distance: 0, elapsed: 0, feet: FLOOR, velocity: 0,
    grounded: true, jumpsLeft: 2, coyote: .1, boost: 0, collected: 0, section: 0,
    platforms: [], gaps: [], tapes: [], signs: [], reason: '',
  };
  addSection(run);
  return run;
}

export function jumpRun(run: Run) {
  if (run.mode !== 'running' || run.jumpsLeft === 0) return false;
  run.boost = run.jumpsLeft === 1 ? .24 : 0;
  run.velocity = -JUMP_SPEED;
  run.jumpsLeft--;
  run.grounded = false;
  run.coyote = 0;
  return true;
}

function advance(run: Run, dt: number) {
  run.elapsed += dt; run.distance += SPEED * dt;
  run.boost = Math.max(0, run.boost - dt);
  const x = PLAYER_X + run.distance;
  while (run.section * CHUNK_WIDTH < x + 1000) addSection(run);
  const oldFeet = run.feet;
  const underfoot = run.platforms.filter(p => x >= p.x && x < p.x + p.width);
  const step = underfoot.filter(p => Math.abs(p.top - oldFeet) <= 18.01).sort((a, b) => a.top - b.top)[0];
  if (run.grounded && step) {
    run.feet = step.top; run.velocity = 0; run.coyote = .1;
  } else {
    run.grounded = false;
    run.coyote = Math.max(0, run.coyote - dt);
    // Walking off a ledge leaves one recovery jump, not two extra air jumps.
    if (run.coyote === 0 && run.jumpsLeft === 2) run.jumpsLeft = 1;
    run.velocity += GRAVITY * dt;
    run.feet += run.velocity * dt;
    const landing = run.platforms.filter(p =>
      x + 7 > p.x && x - 7 < p.x + p.width &&
      run.velocity >= 0 && oldFeet <= p.top && run.feet >= p.top
    ).sort((a, b) => a.top - b.top)[0];
    if (landing) {
      run.feet = landing.top; run.velocity = 0;
      run.grounded = true; run.jumpsLeft = 2; run.coyote = .1;
    }
  }
  const wall = run.platforms.find(p =>
    x + 7 > p.x && x - 7 < p.x + p.width &&
    run.feet > p.top + 18.1 && run.feet - 40 < FLOOR + 65
  );
  if (wall || run.feet > FLOOR + 70) {
    run.mode = 'over';
    run.reason = wall ? 'Caught the edge. Try your second jump a little later.' : 'Lost the rooftop. Save an air jump for the gap.';
    return;
  }
  for (const tape of run.tapes) {
    if (!tape.collected && x + 7 > tape.x && x - 7 < tape.x + 19 &&
        run.feet > tape.y && run.feet - 40 < tape.y + 12) {
      tape.collected = true; run.collected++;
    }
  }
  run.platforms = run.platforms.filter(p => p.x + p.width > x - 200);
  run.gaps = run.gaps.filter(g => g.x + g.width > x - 200);
  run.tapes = run.tapes.filter(t => t.x > x - 200);
  run.signs = run.signs.filter(s => s.x > x - 250);
}

export function stepRun(run: Run, seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Game time must be finite and non-negative.');
  for (let remaining = seconds; remaining > 0 && run.mode === 'running';) {
    const dt = Math.min(remaining, 1 / 120);
    advance(run, dt);
    remaining -= dt;
  }
}

export function frameDelta(previous: number | null, current: number) {
  // Animation frame start can precede an input handler's performance.now().
  return previous === null ? 0 : Math.min(Math.max((current - previous) / 1000, 0), .04);
}
