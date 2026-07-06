import { DurableObject } from 'cloudflare:workers';
import type { Env } from './types';

const stateKey = 'state';
const maxMessageLength = 4096;

export class SyncRoom extends DurableObject<Env> {
  async fetch(request: Request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.ctx.acceptWebSocket(server);

    const state = await this.ctx.storage.get<string>(stateKey);
    if (state) {
      server.send(state);
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(sender: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') {
      sender.close(1003, 'Expected text message');
      return;
    }

    if (message.length > maxMessageLength) {
      sender.close(1009, 'Message too large');
      return;
    }

    await this.ctx.storage.put(stateKey, message);

    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== sender) {
        socket.send(message);
      }
    }
  }
}
