// Cosmetic motion only; offsets are sprite-local screen pixels.
const INFANTRY = new Set(['infantry', 'rocket_trooper', 'engineer', 'commando', 'laser_trooper', 'warden', 'vane', 'ghostwalker', 'razor']);
const AIRCRAFT = new Set(['gunship', 'defense_drone']);

export function clipFrame(time: number, fps: number, frames: number, once = false): number {
  if (frames <= 1 || fps <= 0) return 0;
  const index = Math.floor(Math.max(0, time) * fps);
  return once ? Math.min(frames - 1, index) : index % frames;
}

/** Exact integration of exponential drag, independent of rendering refresh rate. */
export function dampedTravel(velocity: number, ticks: number, drag = 0.9): number {
  return drag === 1 ? velocity * ticks : velocity * (1 - Math.pow(drag, ticks)) / (1 - drag);
}

export function unitMotion(kind: string, action: 'idle' | 'moving' | 'firing', seconds: number, reduced = false): { bob: number; roll: number; recoil: number } {
  if (reduced) return { bob: 0, roll: 0, recoil: 0 };
  const infantry = INFANTRY.has(kind);
  const stride = seconds * Math.PI * (infantry ? 8 : 6);
  const air = AIRCRAFT.has(kind);
  const moving = action === 'moving';
  const recoilPhase = Math.max(0, Math.min(1, seconds / 0.22));
  const recoil = action === 'firing' ? Math.sin(Math.PI * recoilPhase) * Math.pow(1 - recoilPhase, 2) * (infantry ? 2 : 5) : 0;
  return {
    bob: air ? Math.sin(seconds * 2.1) * 1.8 : moving ? -Math.abs(Math.sin(stride)) * (infantry ? 0.9 : 0.35) : 0,
    roll: moving ? Math.sin(stride / 2) * (infantry ? 0.028 : air ? 0.022 : 0.008) : 0,
    recoil,
  };
}
