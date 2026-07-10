// ── Campaign menu + end-of-mission screens (DOM overlays) ─────────────────────
// View layer: simple DOM overlays over the canvas for the title menu and the
// win/lose debrief. Navigation between missions is reload-based (set location) so
// each match starts from a clean sim — no in-page teardown to leak listeners.

export interface CampaignProgress { version: number; completed: string[]; bonus?: Record<string, number>; heroKills?: number; reserve?: number }
const PROGRESS_KEY = 'shardDominion.campaign';

export function loadProgress(): CampaignProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<CampaignProgress>;
      if (p && Array.isArray(p.completed)) {
        // TP-4: return EVERY persisted field — the audit found heroKills/reserve
        // silently dropped here, which killed the whole campaign-persistence layer.
        return { version: p.version ?? 1, completed: p.completed, bonus: p.bonus ?? {}, heroKills: p.heroKills ?? 0, reserve: p.reserve ?? 0 };
      }
    }
  } catch { /* ignore malformed/unavailable storage */ }
  return { version: 1, completed: [] };
}

export function markCompleted(missionId: string): void {
  const p = loadProgress();
  if (!p.completed.includes(missionId)) p.completed.push(missionId);
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** Bank a secondary-objective reward for a FUTURE mission (FG-4). */
export function addBonus(missionId: string, credits: number): void {
  const p = loadProgress();
  p.bonus = p.bonus ?? {};
  p.bonus[missionId] = (p.bonus[missionId] ?? 0) + credits;
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
/** Consume (read + clear) the banked bonus for a mission about to start. */
export function takeBonus(missionId: string): number {
  const p = loadProgress();
  const b = p.bonus?.[missionId] ?? 0;
  if (b && p.bonus) { delete p.bonus[missionId]; try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ } }
  return b;
}

export interface MissionEntry { id: string; name: string; order: number; unlocked: boolean; completed: boolean }

/** Campaign mission-select screen (FG-4): linear unlock, checkmarks, replayable. */
export function showMissionSelect(missions: readonly MissionEntry[], onPick: (id: string) => void, onBack: () => void): void {
  const el = overlay();
  const panel = document.createElement('div');
  panel.style.textAlign = 'center';
  panel.innerHTML =
    '<div style="font-size:34px;font-weight:bold;color:#ffd34d;letter-spacing:2px;">CAMPAIGN</div>' +
    '<div style="color:#8fb7c9;margin:4px 0 20px;font-size:13px;">Operation: Aether Prime</div>';
  for (const m of [...missions].sort((a, b) => a.order - b.order)) {
    const b = button(`${m.completed ? '✔ ' : ''}Mission ${m.order}: ${m.name}${m.unlocked ? '' : '  🔒'}`, m.unlocked && !m.completed);
    if (!m.unlocked) { b.disabled = true; b.style.opacity = '0.45'; b.style.cursor = 'default'; }
    else b.onclick = () => onPick(m.id);
    panel.appendChild(b);
  }
  const back = button('BACK');
  back.onclick = () => { el.remove(); onBack(); };
  panel.appendChild(back);
  el.appendChild(panel);
}

export interface SkirmishSetup {
  maps: readonly { id: string; name: string }[];
  onStart: (mapId: string, faction: string, difficulty: string) => void;
  onBack: () => void;
}

/** Skirmish setup (FG-6): map pool + faction + difficulty, then launch. */
export function showSkirmishSetup(o: SkirmishSetup): void {
  const el = overlay();
  const panel = document.createElement('div');
  panel.style.textAlign = 'center';
  panel.innerHTML =
    '<div style="font-size:34px;font-weight:bold;color:#ffd34d;letter-spacing:2px;">SKIRMISH</div>' +
    '<div style="color:#8fb7c9;margin:4px 0 16px;font-size:13px;">choose your ground</div>';
  let mapId = o.maps[0]?.id ?? 'skirmish';
  let faction = 'concord';
  let difficulty = 'normal';
  const group = (label: string, opts: { id: string; name: string }[], get: () => string, set: (v: string) => void): HTMLDivElement => {
    const row = document.createElement('div');
    row.style.cssText = 'margin:8px 0;color:#cfe0ee;font-size:12px;';
    row.innerHTML = `<div style="color:#9fb4cc;margin-bottom:4px;">${label}</div>`;
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap;';
    const style = (active: boolean): string =>
      `font-family:monospace;font-size:12px;padding:6px 12px;cursor:pointer;border-radius:4px;border:1px solid ${active ? '#00e5ff' : '#3a4a5a'};background:${active ? 'rgba(0,229,255,0.14)' : 'rgba(20,26,34,0.9)'};color:${active ? '#00e5ff' : '#cfe0ee'};`;
    for (const opt of opts) {
      const b = document.createElement('button');
      b.textContent = opt.name;
      b.dataset.v = opt.id;
      b.style.cssText = style(get() === opt.id);
      b.onclick = () => {
        set(opt.id);
        for (const c of Array.from(btns.querySelectorAll('button'))) {
          (c as HTMLButtonElement).style.cssText = style((c as HTMLButtonElement).dataset.v === get());
        }
      };
      btns.appendChild(b);
    }
    row.appendChild(btns);
    return row;
  };
  panel.appendChild(group('MAP', [...o.maps], () => mapId, v => { mapId = v; }));
  panel.appendChild(group('FACTION', [
    { id: 'concord', name: 'Meridian Concord' },
    { id: 'emberhand', name: 'The Emberhand' },
    { id: 'shardborn', name: 'The Shardborn' },
  ], () => faction, v => { faction = v; }));
  panel.appendChild(group('DIFFICULTY', [
    { id: 'easy', name: 'Easy' }, { id: 'normal', name: 'Normal' }, { id: 'hard', name: 'Hard' },
  ], () => difficulty, v => { difficulty = v; }));
  const start = button('▶  START', true);
  start.onclick = () => o.onStart(mapId, faction, difficulty);
  const back = button('BACK');
  back.onclick = () => { el.remove(); o.onBack(); };
  panel.appendChild(start);
  panel.appendChild(back);
  el.appendChild(panel);
}

function overlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'sd-overlay';
  el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;background:rgba(6,5,10,0.92);z-index:1000;font-family:monospace;color:#e7e2d6;overflow-y:auto;padding:24px 0;box-sizing:border-box;';
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
  // Remove THIS overlay before handing off (mission select stacks its own).
  campaign.onclick = () => { el.remove(); onSelect(campaignMissionId); };
  skirmish.onclick = () => { el.remove(); onSelect('skirmish'); };
  panel.appendChild(campaign);
  panel.appendChild(skirmish);
  // REPLAYS (XP-7): the save history — pick one, it becomes the quick save + boots.
  try {
    const hist = JSON.parse(localStorage.getItem('shardDominion.saves') ?? '[]') as { label: string; payload: { missionId: string; faction?: string; difficulty?: string } }[];
    if (hist.length > 0) {
      const rb = button(`🎞 REPLAYS (${hist.length})`);
      rb.onclick = () => {
        el.remove();
        const rl = overlay();
        const rp = document.createElement('div');
        rp.style.textAlign = 'center';
        rp.innerHTML = '<div style="font-size:30px;font-weight:bold;color:#ffd34d;letter-spacing:2px;">REPLAYS</div><div style="color:#8fb7c9;margin:4px 0 16px;font-size:12px;">deterministic sim — every save replays exactly</div>';
        for (const h of hist) {
          const b = button(h.label);
          b.onclick = () => {
            localStorage.setItem('shardDominion.save', JSON.stringify(h.payload));
            location.search = `?mission=${h.payload.missionId}&continue=1&faction=${h.payload.faction ?? 'concord'}&difficulty=${h.payload.difficulty ?? 'normal'}`;
          };
          rp.appendChild(b);
        }
        const back = button('BACK');
        back.onclick = () => { rl.remove(); showTitleMenu(onSelect, campaignMissionId); };
        rp.appendChild(back);
        rl.appendChild(rp);
      };
      panel.appendChild(rb);
    }
  } catch { /* no history */ }
  // CONTINUE (FG-6): resume the saved match by replaying its command log.
  try {
    const raw = localStorage.getItem('shardDominion.save');
    if (raw) {
      const save = JSON.parse(raw) as { missionId: string; faction?: string; difficulty?: string };
      const cont = button('⏵ CONTINUE SAVED MATCH');
      cont.onclick = () => {
        location.search = `?mission=${save.missionId}&continue=1&faction=${save.faction ?? 'concord'}&difficulty=${save.difficulty ?? 'normal'}`;
      };
      panel.appendChild(cont);
    }
  } catch { /* no save */ }
  el.appendChild(panel);
}

export interface PauseOpts {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  /** Save the match (command-log snapshot, FG-6). */
  onSave?: () => void;
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
  if (o.onSave) {
    const save = button('💾 SAVE MATCH');
    save.onclick = () => { o.onSave!(); save.textContent = '💾 SAVED ✓'; };
    panel.appendChild(save);
  }
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

export interface DevMenuOpts {
  missions: readonly { id: string; name: string }[];
  onLaunch: (id: string) => void;
  /** Validate pasted mission JSON; return an error string or null when valid. */
  validate: (raw: string) => string | null;
  onLaunchJson: (raw: string) => void;
}

/** Dev mission kit (XP-1): launch any registered mission, or paste mission JSON. */
export function showDevMenu(o: DevMenuOpts): void {
  const el = overlay();
  const panel = document.createElement('div');
  panel.style.cssText = 'text-align:center;max-width:640px;width:90%;';
  panel.innerHTML =
    '<div style="font-size:30px;font-weight:bold;color:#ffd34d;letter-spacing:2px;">MISSION KIT</div>' +
    '<div style="color:#8fb7c9;margin:4px 0 14px;font-size:12px;">dev tooling — launch registered missions or paste mission JSON (validated)</div>';
  const list = document.createElement('div');
  list.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:14px;';
  for (const m of o.missions) {
    const b = document.createElement('button');
    b.textContent = m.name;
    b.style.cssText = 'font-family:monospace;font-size:11px;padding:5px 10px;cursor:pointer;border:1px solid #3a4a5a;background:rgba(20,26,34,0.9);color:#cfe0ee;border-radius:4px;';
    b.onclick = () => o.onLaunch(m.id);
    list.appendChild(b);
  }
  panel.appendChild(list);
  const ta = document.createElement('textarea');
  ta.placeholder = '{ "id": "my_test", "name": "…", … }  — paste a mission JSON here';
  ta.style.cssText = 'width:100%;height:220px;background:#0a0d12;color:#cfe0ee;border:1px solid #3a4a5a;border-radius:6px;font-family:monospace;font-size:11px;padding:8px;box-sizing:border-box;';
  panel.appendChild(ta);
  const err = document.createElement('div');
  err.style.cssText = 'color:#e24a4a;font-size:11px;min-height:16px;margin:6px 0;text-align:left;font-family:monospace;';
  panel.appendChild(err);
  const launch = button('▶  VALIDATE + LAUNCH JSON', true);
  launch.onclick = () => {
    const msg = o.validate(ta.value);
    if (msg) { err.textContent = msg; return; }
    o.onLaunchJson(ta.value);
  };
  const back = button('MAIN MENU');
  back.onclick = () => { location.search = ''; };
  panel.appendChild(launch);
  panel.appendChild(back);
  el.appendChild(panel);
}

/** XP-3: bank end-of-mission carry — the hero's kill count + veteran reserve points. */
export function recordCampaignCarry(heroKills: number, vetPoints: number): void {
  const p = loadProgress();
  p.heroKills = Math.max(p.heroKills ?? 0, heroKills);
  p.reserve = Math.min(5, (p.reserve ?? 0) + vetPoints);
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
export function spendReserve(points: number): void {
  const p = loadProgress();
  p.reserve = Math.max(0, (p.reserve ?? 0) - points);
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** XP-3: pre-mission Deployment panel — spend Veteran Reserve on starting bonuses.
 *  Shown over the (paused) briefing; each spend applies live via the callbacks. */
export function showDeployment(reserve: number, apply: { vetSquad(): void; credits(): void }): void {
  const el = overlay();
  let left = reserve;
  const panel = document.createElement('div');
  panel.style.cssText = 'text-align:center;max-width:460px;';
  const title = document.createElement('div');
  title.innerHTML = '<div style="font-size:30px;font-weight:bold;color:#ffd34d;letter-spacing:2px;">DEPLOYMENT</div>';
  const count = document.createElement('div');
  count.style.cssText = 'color:#8fb7c9;margin:4px 0 14px;font-size:13px;';
  const upd = (): void => { count.textContent = `VETERAN RESERVE: ${left} pt${left === 1 ? '' : 's'} — survivors of past battles`; };
  upd();
  panel.appendChild(title); panel.appendChild(count);
  const mk = (label: string, fn: () => void): HTMLButtonElement => {
    const b = button(label, true);
    b.onclick = () => { if (left <= 0) return; left -= 1; spendReserve(1); fn(); upd(); if (left <= 0) { el.remove(); } };
    panel.appendChild(b); return b;
  };
  mk('⚔ DEPLOY A VETERAN SQUAD  (−1)', apply.vetSquad);
  mk('◈ +200 STARTING CREDITS  (−1)', apply.credits);
  const done = button('BEGIN MISSION');
  done.onclick = () => el.remove();
  panel.appendChild(done);
  el.appendChild(panel);
}

/** XP-6: the pre-mission CHOICE panel (M14 Seal/Harness). Blocks over the briefing. */
export function showChoice(prompt: string, options: readonly { id: string; label: string; blurb: string }[], onPick: (id: string) => void): void {
  const el = overlay();
  const panel = document.createElement('div');
  panel.style.cssText = 'text-align:center;max-width:560px;padding:0 20px;';
  panel.innerHTML =
    '<div style="font-size:28px;font-weight:bold;color:#ffd34d;letter-spacing:2px;">THE CHOICE</div>' +
    `<div style="color:#cfc9bd;margin:10px 0 18px;font-size:14px;line-height:1.5;">${escapeHtml(prompt)}</div>`;
  for (const o of options) {
    const b = button(o.label, true);
    b.style.width = '360px';
    b.onclick = () => { el.remove(); onPick(o.id); };
    const blurb = document.createElement('div');
    blurb.style.cssText = 'color:#8894a4;font-size:11px;margin:-4px auto 10px;max-width:360px;';
    blurb.textContent = o.blurb;
    panel.appendChild(b);
    panel.appendChild(blurb);
  }
  el.appendChild(panel);
}

/** XP-6: the campaign credits roll. */
export function showCredits(onDone: () => void): void {
  const el = overlay();
  const panel = document.createElement('div');
  panel.style.cssText = 'text-align:center;max-width:560px;';
  panel.innerHTML = [
    '<div style="font-size:34px;font-weight:bold;color:#ffd34d;letter-spacing:3px;margin-bottom:18px;">SHARD DOMINION</div>',
    '<div style="color:#8fb7c9;font-size:13px;margin-bottom:22px;">ACT I · OPERATION AETHER PRIME — ACT II · THE WAKING DEEP</div>',
    '<div style="color:#cfc9bd;font-size:13px;line-height:2;">',
    'A war for a planet that was never empty.<br><br>',
    'THE WARDEN — you<br>',
    'SERA VANE — the Ashen Warlord<br>',
    'MARSHAL CORR — the renegade<br>',
    'DIRECTOR HALEX — Project Cauterize<br>',
    'BROKER YSSEL — the Syndicate<br>',
    'THE CHORUS — the planet, listening<br><br>',
    'Built slice by slice on a pure deterministic sim.<br>',
    'Every mechanic verified before it shipped.<br><br>',
    'AETHER PRIME WILL REMEMBER WHAT YOU CHOSE.',
    '</div>',
  ].join('');
  const done = button('MAIN MENU', true);
  done.style.marginTop = '24px';
  done.onclick = () => { el.remove(); onDone(); };
  panel.appendChild(done);
  el.appendChild(panel);
}
