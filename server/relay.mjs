// ── Shard Dominion multiplayer relay (FG-7) ─────────────────────────────────────
// A THIN dumb pipe: rooms of two, forward everything, decide nothing. All game
// logic lives in the deterministic client sim (lockstep); the relay never parses
// commands, so it can never desync a match.
//
//   node server/relay.mjs [port]        → ws://<host>:8787 by default
//
// Works on localhost / LAN / tailnet as-is. To put it on the public internet,
// deploy this one file + `ws` anywhere (Fly.io etc.) and point the client at it
// with ?relay=wss://your-app.fly.dev.
import { WebSocketServer } from 'ws';

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8787);
const wss = new WebSocketServer({ port: PORT });

/** room → { size, peers[] } */
const rooms = new Map();

wss.on('connection', (sock) => {
  let room = null;
  let slot = -1;

  sock.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(String(data)); } catch { return; }

    if (msg.type === 'join' && typeof msg.room === 'string' && room === null) {
      // XP-7: rooms scale — 1v1 (size 2, default) or 2v2 (size 4). The first
      // joiner's requested size fixes the room.
      const entry = rooms.get(msg.room) ?? { size: Math.max(2, Math.min(4, msg.size ?? 2)), peers: [] };
      if (entry.peers.length >= entry.size) { sock.send(JSON.stringify({ type: 'full' })); return; }
      room = msg.room;
      slot = entry.peers.length;
      entry.peers.push(sock);
      rooms.set(room, entry);
      sock.send(JSON.stringify({ type: 'joined', slot, size: entry.size }));
      if (entry.peers.length === entry.size) {
        // All seats filled → start (even slots = 'player' side, odd = 'enemy').
        for (const p of entry.peers) p.send(JSON.stringify({ type: 'start' }));
      }
      return;
    }

    // Everything else (cmd bundles, hashes, resign) → forward to the other seat.
    if (room !== null) {
      const peers = rooms.get(room)?.peers ?? [];
      for (const p of peers) if (p !== sock && p.readyState === 1) p.send(String(data));
    }
  });

  sock.on('close', () => {
    if (room === null) return;
    const peers = rooms.get(room)?.peers ?? [];
    for (const p of peers) if (p !== sock && p.readyState === 1) {
      p.send(JSON.stringify({ type: 'peer-left' }));
    }
    rooms.delete(room); // a departed seat ends the room (rejoin = new room)
  });
});

console.log(`[relay] listening on ws://0.0.0.0:${PORT}`);
