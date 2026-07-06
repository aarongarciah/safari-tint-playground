export type Mode = 'light' | 'dark';

export type ModeColors = {
  page: string;
  header: string;
  footer: string;
  theme: string;
};

export type PlaygroundState = {
  mode: Mode;
  viewportFitCover: boolean;
  headerVisible: boolean;
  headerFixed: boolean;
  headerTop: number;
  footerVisible: boolean;
  footerFixed: boolean;
  footerBottom: number;
  drawerOpen: boolean;
  dialogOpen: boolean;
  colors: Record<Mode, ModeColors>;
};

const defaultModeColors: Record<Mode, ModeColors> = {
  light: {
    page: '#ffffff',
    header: '#ffffff',
    footer: '#ffffff',
    theme: '#ffffff',
  },
  dark: {
    page: '#171717',
    header: '#000000',
    footer: '#000000',
    theme: '#171717',
  },
};

export const defaultState: PlaygroundState = {
  mode: 'light',
  viewportFitCover: false,
  headerVisible: true,
  headerFixed: true,
  headerTop: 0,
  footerVisible: true,
  footerFixed: false,
  footerBottom: 0,
  drawerOpen: false,
  dialogOpen: false,
  colors: defaultModeColors,
};

const colorParams = {
  bgL: ['light', 'page'],
  bgD: ['dark', 'page'],
  headerL: ['light', 'header'],
  headerD: ['dark', 'header'],
  footerL: ['light', 'footer'],
  footerD: ['dark', 'footer'],
  themeL: ['light', 'theme'],
  themeD: ['dark', 'theme'],
} as const satisfies Record<string, readonly [Mode, keyof ModeColors]>;

const booleanParams = {
  vfc: 'viewportFitCover',
  header: 'headerVisible',
  headerFixed: 'headerFixed',
  footer: 'footerVisible',
  footerFixed: 'footerFixed',
  drawerOpen: 'drawerOpen',
  dialogOpen: 'dialogOpen',
} as const satisfies Record<string, keyof PlaygroundState>;

const stateCachePrefix = 'safari-checker:state:';

function isMode(value: unknown): value is Mode {
  return value === 'light' || value === 'dark';
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeDistance(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : 0;
}

function mergeState(source?: Partial<PlaygroundState> | null): PlaygroundState {
  const mode = isMode(source?.mode) ? source.mode : defaultState.mode;

  return {
    ...defaultState,
    ...source,
    mode,
    viewportFitCover: Boolean(source?.viewportFitCover ?? defaultState.viewportFitCover),
    headerVisible: source?.headerVisible ?? defaultState.headerVisible,
    headerFixed: source?.headerFixed ?? defaultState.headerFixed,
    headerTop: normalizeDistance(source?.headerTop),
    footerVisible: source?.footerVisible ?? defaultState.footerVisible,
    footerFixed: source?.footerFixed ?? defaultState.footerFixed,
    footerBottom: normalizeDistance(source?.footerBottom),
    drawerOpen: source?.drawerOpen ?? defaultState.drawerOpen,
    dialogOpen: source?.dialogOpen ?? defaultState.dialogOpen,
    colors: {
      light: {
        ...defaultState.colors.light,
        ...(source?.colors?.light ?? {}),
      },
      dark: {
        ...defaultState.colors.dark,
        ...(source?.colors?.dark ?? {}),
      },
    },
  };
}

function readStateFromParams(params: URLSearchParams, base: PlaygroundState) {
  const next = mergeState(base);
  const mode = params.get('mode');

  if (isMode(mode)) {
    next.mode = mode;
  }

  Object.entries(colorParams).forEach(([param, [modeKey, colorKey]]) => {
    const value = params.get(param);
    if (isColor(value)) {
      next.colors[modeKey][colorKey] = value;
    }
  });

  Object.entries(booleanParams).forEach(([param, stateKey]) => {
    if (params.has(param)) {
      next[stateKey] = params.get(param) === '1' ? true : false;
    }
  });

  if (params.has('headerTop')) {
    next.headerTop = normalizeDistance(params.get('headerTop'));
  }

  if (params.has('footerBottom')) {
    next.footerBottom = normalizeDistance(params.get('footerBottom'));
  }

  return next;
}

function getCurrentRoomId() {
  return new URLSearchParams(window.location.search).get('id');
}

function getStateCacheKey(roomId: string) {
  return `${stateCachePrefix}${roomId}`;
}

export function readCachedSerializedState(roomId: string) {
  try {
    return window.localStorage.getItem(getStateCacheKey(roomId));
  } catch {
    return null;
  }
}

export function cacheSerializedState(roomId: string, serializedState: string) {
  try {
    window.localStorage.setItem(getStateCacheKey(roomId), serializedState);
  } catch {
    // Storage can be unavailable in private or locked-down browsing contexts.
  }
}

export function readInitialState(): PlaygroundState {
  const roomId = getCurrentRoomId();
  const cachedState = roomId ? readCachedSerializedState(roomId) : null;

  if (cachedState) {
    return readStateFromQuery(cachedState);
  }

  return structuredClone(defaultState);
}

export function readStateFromQuery(query: string): PlaygroundState {
  return readStateFromParams(new URLSearchParams(query), defaultState);
}

export function serializeState(state: PlaygroundState) {
  const params = new URLSearchParams();
  params.set('mode', state.mode);
  params.set('vfc', state.viewportFitCover ? '1' : '0');
  params.set('header', state.headerVisible ? '1' : '0');
  params.set('headerFixed', state.headerFixed ? '1' : '0');
  params.set('headerTop', String(state.headerTop));
  params.set('footer', state.footerVisible ? '1' : '0');
  params.set('footerFixed', state.footerFixed ? '1' : '0');
  params.set('footerBottom', String(state.footerBottom));
  params.set('drawerOpen', state.drawerOpen ? '1' : '0');
  params.set('dialogOpen', state.dialogOpen ? '1' : '0');
  params.set('bgL', state.colors.light.page);
  params.set('bgD', state.colors.dark.page);
  params.set('headerL', state.colors.light.header);
  params.set('headerD', state.colors.dark.header);
  params.set('footerL', state.colors.light.footer);
  params.set('footerD', state.colors.dark.footer);
  params.set('themeL', state.colors.light.theme);
  params.set('themeD', state.colors.dark.theme);
  return params.toString();
}

export function persistState() {
  const roomId = new URLSearchParams(window.location.search).get('id');
  const query = roomId ? `?id=${roomId}` : '';
  const nextUrl = `${window.location.pathname}${query}${window.location.hash}`;
  window.history.replaceState(null, '', nextUrl);
}

export function applyStateToDocument(state: PlaygroundState) {
  const activeColors = state.colors[state.mode];
  const root = document.documentElement;
  const body = document.body;

  root.dataset.theme = state.mode;
  root.dataset.viewportFitCover = String(state.viewportFitCover);
  root.style.colorScheme = state.mode;
  root.style.setProperty('--page-bg', activeColors.page);
  root.style.setProperty('--header-bg', activeColors.header);
  root.style.setProperty('--header-top', `${state.headerTop}px`);
  root.style.setProperty('--footer-bg', activeColors.footer);
  root.style.setProperty('--footer-bottom', `${state.footerBottom}px`);
  body.style.backgroundColor = activeColors.page;

  document
    .querySelector<HTMLMetaElement>('meta[data-managed-viewport]')
    ?.setAttribute(
      'content',
      `width=device-width, initial-scale=1${state.viewportFitCover ? ', viewport-fit=cover' : ''}`,
    );
  document
    .querySelector<HTMLMetaElement>('meta[data-theme-color-light]')
    ?.setAttribute('content', state.colors.light.theme);
  document
    .querySelector<HTMLMetaElement>('meta[data-theme-color-dark]')
    ?.setAttribute('content', state.colors.dark.theme);
}

export function setModeColor(
  state: PlaygroundState,
  colorKey: keyof ModeColors,
  value: string,
): PlaygroundState {
  return {
    ...state,
    colors: {
      ...state.colors,
      [state.mode]: {
        ...state.colors[state.mode],
        [colorKey]: value,
      },
    },
  };
}
