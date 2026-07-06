const roomIdPattern = /^[A-Za-z0-9_-]{12,64}$/;

let socket: WebSocket | null = null;
let queuedState: string | null = null;

export function createRoomId() {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function getSyncRoomId() {
  const roomId = new URLSearchParams(window.location.search).get('id');

  return roomId && roomIdPattern.test(roomId) ? roomId : null;
}

export function ensureSyncRoomId() {
  const existingRoomId = getSyncRoomId();

  if (existingRoomId) {
    return { roomId: existingRoomId, created: false };
  }

  const roomId = createRoomId();
  window.history.replaceState(null, '', `${window.location.pathname}?id=${roomId}${window.location.hash}`);

  return { roomId, created: true };
}

export function connectSync(roomId: string, onState: (state: string) => void, onOpen?: () => void) {
  disconnectSync();

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const nextSocket = new WebSocket(`${protocol}//${window.location.host}/api/sync/${roomId}`);
  socket = nextSocket;

  nextSocket.addEventListener('open', () => {
    if (socket !== nextSocket) {
      return;
    }

    if (queuedState) {
      nextSocket.send(queuedState);
      queuedState = null;
    }

    onOpen?.();
  });

  nextSocket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') {
      onState(event.data);
    }
  });

  nextSocket.addEventListener('close', () => {
    if (socket === nextSocket) {
      socket = null;
    }
  });

  return disconnectSync;
}

export function sendState(serializedState: string) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(serializedState);
    return;
  }

  queuedState = serializedState;
}

export function disconnectSync() {
  queuedState = null;
  socket?.close();
  socket = null;
}
