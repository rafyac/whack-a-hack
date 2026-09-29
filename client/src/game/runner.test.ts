import { describe, expect, it } from 'vitest';
import { createRun, frameDelta, jumpRun, stepRun, FLOOR, PLAYER_X, type Platform, type Run } from './runner';

const roof = (x: number, width: number, rise = 0): Platform => ({ x, width, top: FLOOR - rise, kind: 'roof' });
function fixture(platforms: Platform[]): Run {
  return { ...createRun(), mode: 'running', section: 100, platforms, gaps: [], tapes: [], signs: [] };
}

describe('Tape Run physics', () => {
  it('allows two jumps but no third, and recharges on landing', () => {
    const run = fixture([roof(0, 5000)]);
    expect(jumpRun(run)).toBe(true); stepRun(run, .25);
    const firstHeight = run.feet;
    expect(jumpRun(run)).toBe(true);
    expect(run.jumpsLeft).toBe(0);
    expect(jumpRun(run)).toBe(false);
    stepRun(run, .25);
    expect(run.feet).toBeLessThan(firstHeight);
    stepRun(run, 1);
    expect(run.feet).toBe(FLOOR);
    expect(run.grounded).toBe(true); expect(run.jumpsLeft).toBe(2);
  });
  it('climbs and descends short stairs without jumping', () => {
    const run = createRun(); run.mode = 'running';
    stepRun(run, (555 - PLAYER_X) / 190);
    expect(run.feet).toBe(FLOOR - 54);
    expect(run.grounded).toBe(true);
    expect(run.collected).toBeGreaterThanOrEqual(3);
    stepRun(run, (800 - 555) / 190);
    expect(run.feet).toBe(FLOOR); expect(run.mode).toBe('running');
  });
  it('has no invisible floor over gaps', () => {
    const run = fixture([roof(0, 180), roof(450, 1000)]);
    stepRun(run, 1);
    expect(run.mode).toBe('over'); expect(run.feet).toBeGreaterThan(FLOOR);
  });
  it('leaves one recovery jump after walking off a ledge', () => {
    const run = fixture([roof(0, 180), roof(600, 1000)]);
    stepRun(run, .4);
    expect(run.grounded).toBe(false); expect(run.jumpsLeft).toBe(1);
    expect(jumpRun(run)).toBe(true); expect(jumpRun(run)).toBe(false);
  });
  it('allows a well-timed single jump over a short gap', () => {
    const run = fixture([roof(0, 151), roof(263, 2000)]);
    jumpRun(run); stepRun(run, 1);
    expect(run.mode).toBe('running'); expect(run.feet).toBe(FLOOR);
  });
  it('requires a second boost for the wider gap', () => {
    const single = fixture([roof(0, 170), roof(360, 2000)]);
    jumpRun(single); stepRun(single, 1.5);
    expect(single.mode).toBe('over');
    const double = fixture([roof(0, 170), roof(360, 2000)]);
    jumpRun(double); stepRun(double, .32); jumpRun(double); stepRun(double, 1.18);
    expect(double.mode).toBe('running'); expect(double.feet).toBe(FLOOR); expect(double.jumpsLeft).toBe(2);
  });
  it('keeps all authored sections traversable and terrain memory bounded', () => {
    const run = createRun(); run.mode = 'running';
    let climbed = false;
    for (let i = 0; i < 6000 && run.mode === 'running'; i++) {
      const x = run.distance + PLAYER_X;
      if (run.grounded) {
        const gap = run.gaps.find(g => g.x >= x && g.x - x < 26);
        const vent = run.platforms.find(p => p.kind === 'vent' && p.x >= x && p.x - x < 45);
        if (gap || vent) jumpRun(run);
        if (run.feet < FLOOR) climbed = true;
      } else if (run.jumpsLeft === 1 && run.velocity > -30) jumpRun(run);
      stepRun(run, 1 / 60);
    }
    expect(run.mode, `${run.reason} at ${run.distance}`).toBe('running');
    expect(run.distance).toBeGreaterThan(18000);
    expect(climbed).toBe(true); expect(run.collected).toBeGreaterThan(30);
    expect(run.platforms.length).toBeLessThan(35);
  });
  it('does not move or jump while paused and rejects invalid time', () => {
    const run = createRun(); run.mode = 'paused';
    stepRun(run, 5);
    expect(jumpRun(run)).toBe(false);
    expect(run.distance).toBe(0); expect(run.jumpsLeft).toBe(2);
    expect(() => stepRun(run, NaN)).toThrow(/finite/);
  });
  it('starts with a zero frame delta and tolerates lagged animation timestamps', () => {
    expect(frameDelta(null, 990)).toBe(0);
    expect(frameDelta(1000, 990)).toBe(0);
    expect(frameDelta(1000, 1016)).toBe(.016);
    expect(frameDelta(1000, 5000)).toBe(.04);
  });
});
