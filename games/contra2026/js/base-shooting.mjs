import { BASE_BOSS_MOVER } from './base-boss.mjs?v=base-up-lift-1';

export const BASE_HIGH_SWITCH = Object.freeze({ x: 180, y: 80, w: 24, h: 18, hp: 4, max: 4 });

// Jump height is projected onto the rear wall; ground fire keeps the old lane.
export function baseShotHeight(player, stage, boss=false) {
  if(stage===2&&boss&&player.aimUp)return BASE_BOSS_MOVER.y+BASE_BOSS_MOVER.h/2;
  return 129 - (stage === 2 ? Math.max(0, 204 - player.y) * (boss?1.05:.75) : 0);
}
export function baseTargetAtHeight(target, height) {
  return height >= target.y - 2 && height <= target.y + target.h + 2;
}
export function baseCoreShielded(base, empT = 0) {
  // EMP disables the cannons, but the upper mechanism is a physical door lock.
  return base.targets.some(t => t.hp > 0 && (t.k === 'switch' || (t.k === 'gun' && !(empT > 0))));
}
export function baseHomingTarget(base, x, height, stage) {
  const live = base.targets.filter(t => t.hp > 0 && !(t.k === 'twin' && !t.solid)
    && (!['switch','device'].includes(t.k)&&!t.mover || baseTargetAtHeight(t, height)));
  const upper = stage === 2 ? live.filter(t => t.k === 'switch') : [];
  const sides = stage === 2 ? live.filter(t => ['gun', 'sat', 'rail'].includes(t.k)) : [];
  let best = null, distance = Infinity;
  for (const target of upper.length ? upper : sides.length ? sides : live) {
    const d = Math.abs(target.x + target.w / 2 - x);
    if (d < distance) { best = target; distance = d; }
  }
  return best;
}
