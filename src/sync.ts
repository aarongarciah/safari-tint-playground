const roomIdPattern = /^[A-Za-z0-9_-]{12,64}$/;
const refreshMessage = '__refresh__';
const initialSyncTimeoutMs = 500;
const reconnectDelayMs = 1500;

let socket: WebSocket | null = null;
let queuedState: string | null = null;
let activeConnection: {
  roomId: string;
  callbacks: SyncCallbacks;
  isCreator: boolean;
} | null = null;
let reconnectTimeoutId: number | null = null;
let initialSyncTimeoutId: number | null = null;
let hasCalledReady = false;

export type SyncStatus = 'connecting' | 'ready' | 'disconnected';

export type SyncCallbacks = {
  onState: (serializedState: string) => void;
  onOpen?: (info: { isCreator: boolean }) => void;
  onStatus?: (status: SyncStatus) => void;
};

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

function getRemoteRefreshKey(roomId: string) {
  return `remote-refresh:${roomId}`;
}

export function consumeRemoteRefresh(roomId: string) {
  const key = getRemoteRefreshKey(roomId);
  const value = window.sessionStorage.getItem(key);
  window.sessionStorage.removeItem(key);

  return value === '1';
}

export function wasPageReload() {
  const navigation = window.performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;

  return navigation?.type === 'reload';
}

function clearInitialSyncTimeout() {
  if (initialSyncTimeoutId !== null) {
    window.clearTimeout(initialSyncTimeoutId);
    initialSyncTimeoutId = null;
  }
}

function markReady() {
  if (hasCalledReady || !activeConnection) {
    return;
  }

  hasCalledReady = true;
  clearInitialSyncTimeout();
  activeConnection.callbacks.onStatus?.('ready');
}

function scheduleInitialSyncFallback() {
  clearInitialSyncTimeout();
  initialSyncTimeoutId = window.setTimeout(markReady, initialSyncTimeoutMs);
}

function scheduleReconnect() {
  if (!activeConnection || reconnectTimeoutId !== null) {
    return;
  }

  activeConnection.callbacks.onStatus?.('disconnected');
  reconnectTimeoutId = window.setTimeout(() => {
    reconnectTimeoutId = null;

    if (activeConnection) {
      openConnection(activeConnection.roomId, activeConnection.callbacks, {
        isCreator: false,
      });
    }
  }, reconnectDelayMs);
}

function openConnection(roomId: string, callbacks: SyncCallbacks, options: { isCreator: boolean }) {
  if (socket) {
    socket.close();
    socket = null;
  }

  hasCalledReady = false;
  clearInitialSyncTimeout();
  callbacks.onStatus?.('connecting');

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const nextSocket = new WebSocket(`${protocol}//${window.location.host}/api/sync/${roomId}`);
  socket = nextSocket;

  nextSocket.addEventListener('open', () => {
    if (socket !== nextSocket || !activeConnection) {
      return;
    }

    if (queuedState) {
      nextSocket.send(queuedState);
      queuedState = null;
    }

    callbacks.onOpen?.({ isCreator: options.isCreator });

    if (options.isCreator) {
      markReady();
      return;
    }

    scheduleInitialSyncFallback();
  });

  nextSocket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string' || socket !== nextSocket) {
      return;
    }

    if (event.data === refreshMessage) {
      window.sessionStorage.setItem(getRemoteRefreshKey(roomId), '1');
      window.location.reload();
      return;
    }

    callbacks.onState(event.data);
    markReady();
  });

  nextSocket.addEventListener('error', () => {
    if (socket !== nextSocket) {
      return;
    }

    callbacks.onStatus?.('disconnected');
  });

  nextSocket.addEventListener('close', () => {
    if (socket !== nextSocket) {
      return;
    }

    socket = null;

    if (activeConnection?.roomId === roomId) {
      scheduleReconnect();
    }
  });
}

export function connectSync(
  roomId: string,
  callbacks: SyncCallbacks,
  options: { isCreator: boolean },
) {
  disconnectSync();
  activeConnection = { roomId, callbacks, isCreator: options.isCreator };
  openConnection(roomId, callbacks, options);

  return disconnectSync;
}

export function sendState(serializedState: string) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(serializedState);
    return;
  }

  queuedState = serializedState;
}

export function refreshRoom() {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(refreshMessage);
  }
}

export function disconnectSync() {
  activeConnection = null;
  hasCalledReady = false;
  clearInitialSyncTimeout();

  if (reconnectTimeoutId !== null) {
    window.clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  queuedState = null;
  socket?.close();
  socket = null;
}
