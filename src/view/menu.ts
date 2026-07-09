// ── Campaign menu + end-of-mission screens (DOM overlays) ─────────────────────
// View layer: simple DOM overlays over the canvas for the title menu and the
// win/lose debrief. Navigation between missions is reload-based (set location) so
// each match starts from a clean sim — no in-page teardown to leak listeners.

export interface CampaignProgress { version: number; completed: string[] }
const PROGRESS_KEY = 'shardDominion.campaign';

export function loadProgress(): CampaignProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<CampaignProgress>;
      if (p && Array.isArray(p.completed)) return { version: p.version ?? 1, completed: p.completed };
    }
  } catch { /* ignore malformed/unavailable storage */ }
  return { version: 1, completed: [] };
}

export function markCompleted(missionId: string): void {
  const p = loadProgress();
  if (!p.completed.includes(missionId)) p.completed.push(missionId);
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function overlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'sd-overlay';
  el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,5,10,0.92);z-index:1000;font-family:monospace;color:#e7e2d6;';
  document.body.appendChild(el);
  return el;
}

function button(label: string, primary = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `display:block;width:280px;margin:8px auto;padding:13px;font-family:monospace;font-size:16px;font-weight:bold;cursor:pointer;border:2px solid ${primary ? '#00e5ff' : '#3a4a5a'};background:${primary ? 'rgba(0,229,255,0.14)' : 'rgba(20,26,34,0.9)'};color:${primary ? '#00e5ff' : '#cfe0ee'};border-radius:6px;`;
  return b;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

/** The title screen: Campaign vs Skirmish. `onSelect(missionId)` starts that match. */
export function showTitleMenu(onSelect: (missionId: string) => void, campaignMissionId = 'm1_first_light'): void {
  const el = overlay();
  const panel = document.createElement('div');
  panel.style.textAlign = 'center';
  panel.innerHTML =
    '<div style="font-size:46px;font-weight:bold;color:#ffd34d;letter-spacing:3px;">SHARD DOMINION</div>' +
    '<div style="color:#8fb7c9;margin:6px 0 28px;">Aether Prime — the war for Shard</div>';
  const campaign = button('▶  CAMPAIGN', true);
  const skirmish = button('SKIRMISH');
  campaign.onclick = () => onSelect(campaignMissionId);
  skirmish.onclick = () => onSelect('skirmish');
  panel.appendChild(campaign);
  panel.appendChild(skirmish);
  el.appendChild(panel);
}

export interface PauseOpts {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  audio: { getVolume(): number; setVolume(v: number): void; isMuted(): boolean; setMuted(m: boolean): void };
  getSpeed: () => number;
  setSpeed: (s: number) => void;
}

/** The in-match pause menu (FG-1). Returns a close function (also used by Resume). */
export function showPauseMenu(o: PauseOpts): () => void {
  const el = overlay();
  el.classList.add('sd-pause');
  const panel = document.createElement('div');
  panel.style.cssText = 'text-align:center;max-width:420px;';
  panel.innerHTML =
    '<div style="font-size:38px;font-weight:bold;color:#ffd34d;letter-spacing:3px;">PAUSED</div>' +
    '<div style="color:#8fb7c9;margin:4px 0 18px;font-size:13px;">the battlefield holds its breath</div>';

  // Volume row.
  const volRow = document.createElement('div');
  volRow.style.cssText = 'display:flex;align-items:center;gap:10px;justify-content:center;margin:10px 0;color:#cfe0ee;font-size:13px;';
  volRow.innerHTML = '<span>VOLUME</span>';
  const vol = document.createElement('input');
  vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.value = String(Math.round(o.audio.getVolume() * 100));
  vol.style.width = '160px';
  vol.oninput = () => o.audio.setVolume(Number(vol.value) / 100);
  const mute = document.createElement('button');
  const muteLabel = (): string => (o.audio.isMuted() ? 'UNMUTE' : 'MUTE');
  mute.textContent = muteLabel();
  mute.style.cssText = 'font-family:monospace;font-size:11px;padding:4px 10px;cursor:pointer;background:rgba(20,26,34,0.9);color:#cfe0ee;border:1px solid #3a4a5a;border-radius:4px;';
  mute.onclick = () => { o.audio.setMuted(!o.audio.isMuted()); mute.textContent = muteLabel(); };
  volRow.appendChild(vol); volRow.appendChild(mute);
  panel.appendChild(volRow);

  // Speed row.
  const spdRow = document.createElement('div');
  spdRow.style.cssText = 'display:flex;align-items:center;gap:6px;justify-content:center;margin:6px 0 14px;color:#cfe0ee;font-size:13px;';
  spdRow.innerHTML = '<span>SPEED</span>';
  for (const s of [0.5, 1, 1.5, 2]) {
    const b = document.createElement('button');
    const style = (active: boolean): string =>
      `font-family:monospace;font-size:11px;padding:4px 10px;cursor:pointer;border-radius:4px;border:1px solid ${active ? '#00e5ff' : '#3a4a5a'};background:${active ? 'rgba(0,229,255,0.14)' : 'rgba(20,26,34,0.9)'};color:${active ? '#00e5ff' : '#cfe0ee'};`;
    b.textContent = `${s}×`;
    b.style.cssText = style(o.getSpeed() === s);
    b.onclick = () => {
      o.setSpeed(s);
      for (const child of Array.from(spdRow.querySelectorAll('button'))) {
        (child as HTMLButtonElement).style.cssText = style(child.textContent === `${s}×`);
      }
    };
    spdRow.appendChild(b);
  }
  panel.appendChild(spdRow);

  const resume = button('▶  RESUME', true);
  resume.onclick = () => o.onResume();
  const restart = button('RESTART MISSION');
  restart.onclick = () => o.onRestart();
  const menu = button('MAIN MENU');
  menu.onclick = () => o.onMenu();
  panel.appendChild(resume); panel.appendChild(restart); panel.appendChild(menu);
  el.appendChild(panel);
  return () => el.remove();
}

export interface EndOpts {
  won: boolean;
  missionName: string;
  debrief: readonly string[];
  onNext?: () => void;  // only for a win with a real next mission
  onRetry?: () => void; // only for a loss
  onMenu: () => void;
}

/** The debrief screen after a mission ends, with navigation buttons. */
export function showEndScreen(o: EndOpts): void {
  const el = overlay();
  const panel = document.createElement('div');
  panel.style.cssText = 'text-align:center;max-width:600px;padding:0 24px;';
  const title = o.won ? 'VICTORY' : 'DEFEAT';
  const color = o.won ? '#4caf50' : '#e24a4a';
  panel.innerHTML =
    `<div style="font-size:50px;font-weight:bold;color:${color};letter-spacing:4px;">${title}</div>` +
    `<div style="color:#9fb4cc;margin:4px 0 20px;font-size:15px;">${escapeHtml(o.missionName)}</div>` +
    `<div style="color:#cfc9bd;font-size:14px;line-height:1.55;margin-bottom:24px;">${o.debrief.map(escapeHtml).join('<br>')}</div>`;
  if (o.won && o.onNext) { const b = button('▶  NEXT MISSION', true); b.onclick = o.onNext; panel.appendChild(b); }
  if (!o.won && o.onRetry) { const b = button('RETRY', true); b.onclick = o.onRetry; panel.appendChild(b); }
  const menu = button('MAIN MENU', !(o.won && o.onNext) && !(!o.won && o.onRetry));
  menu.onclick = o.onMenu;
  panel.appendChild(menu);
  el.appendChild(panel);
}
