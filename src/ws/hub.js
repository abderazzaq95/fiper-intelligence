import { WebSocketServer } from 'ws';
import { log } from '../lib/logger.js';

let wss = null;
const clients = new Set();

/**
 * Push updates instead of making the browser poll. Clients subscribe to
 * channels; the scheduler broadcasts when data actually changes.
 */
export function attachWs(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', socket => {
    clients.add(socket);
    socket.channels = new Set(['prices', 'news', 'derived']);
    socket.send(JSON.stringify({ type: 'hello', channels: [...socket.channels] }));

    socket.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'subscribe' && Array.isArray(msg.channels)) {
          socket.channels = new Set(msg.channels);
        }
      } catch { /* ignore malformed frames */ }
    });

    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
  });

  // drop dead connections
  setInterval(() => {
    for (const c of clients) {
      if (c.readyState !== c.OPEN) clients.delete(c);
    }
  }, 30_000);

  log.ok('websocket listening on /ws');
}

export function broadcast(channel, payload) {
  if (!clients.size) return;
  const frame = JSON.stringify({ type: channel, data: payload, at: Date.now() });
  for (const c of clients) {
    if (c.readyState === c.OPEN && c.channels?.has(channel)) c.send(frame);
  }
}

export const clientCount = () => clients.size;
