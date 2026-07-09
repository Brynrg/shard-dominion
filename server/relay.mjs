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

/** room → [slot0Socket, slot1Socket] */
const rooms = new Map();

wss.on('connection', (sock) => {
  let room = null;
  let slot = -1;

  sock.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(String(data)); } catch { return; }

    if (msg.type === 'join' && typeof msg.room === 'string' && room === null) {
      const peers = rooms.get(msg.room) ?? [];
      if (peers.length >= 2) { sock.send(JSON.stringify({ type: 'full' })); return; }
      room = msg.room;
      slot = peers.length;
      peers.push(sock);
      rooms.set(room, peers);
      sock.send(JSON.stringify({ type: 'joined', slot }));
      if (peers.length === 2) {
        // Both seats filled → tell both sides to start (slot 0 = 'player' team).
        for (const p of peers) p.send(JSON.stringify({ type: 'start' }));
      }
      return;
    }

    // Everything else (cmd bundles, hashes, resign) → forward to the other seat.
    if (room !== null) {
      const peers = rooms.get(room) ?? [];
      for (const p of peers) if (p !== sock && p.readyState === 1) p.send(String(data));
    }
  });

  sock.on('close', () => {
    if (room === null) return;
    const peers = rooms.get(room) ?? [];
    for (const p of peers) if (p !== sock && p.readyState === 1) {
      p.send(JSON.stringify({ type: 'peer-left' }));
    }
    rooms.delete(room); // a departed seat ends the room (rejoin = new room)
  });
});

console.log(`[relay] listening on ws://0.0.0.0:${PORT}`);
