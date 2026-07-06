import { SyncRoom } from './SyncRoom';
import type { Env } from './types';

export { SyncRoom };

const roomPathPattern = /^\/api\/sync\/([A-Za-z0-9_-]{12,64})$/;

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(roomPathPattern);

    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const roomId = match[1];
    const id = env.SYNC_ROOM.idFromName(roomId);

    return env.SYNC_ROOM.get(id).fetch(request);
  },
} satisfies ExportedHandler<Env>;
