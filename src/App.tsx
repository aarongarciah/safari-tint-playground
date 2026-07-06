import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { NumberField } from '@base-ui/react/number-field';
import { Popover } from '@base-ui/react/popover';
import { Dialog } from './components/Dialog';
import { Drawer } from './components/Drawer';
import {
  applyStateToDocument,
  cacheSerializedState,
  defaultState,
  isCssColor,
  normalizeColorInput,
  persistState,
  readInitialState,
  readStateFromQuery,
  serializeState,
  setModeColor,
  type Mode,
  type ModeColors,
} from './state';
import {
  connectSync,
  consumeRemoteRefresh,
  ensureSyncRoomId,
  refreshRoom,
  sendState,
  wasPageReload,
} from './sync';

type Insets = {
  top: number | null;
  right: number | null;
  bottom: number | null;
  left: number | null;
};

const unsetInsetValue = 9999;

function useSafeAreaInsets(viewportFitCover: boolean) {
  const [insets, setInsets] = useState<Insets>({ top: null, right: null, bottom: null, left: null });

  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = [
      'position: fixed',
      'visibility: hidden',
      'pointer-events: none',
      'contain: strict',
      `padding-top: env(safe-area-inset-top, ${unsetInsetValue}px)`,
      `padding-right: env(safe-area-inset-right, ${unsetInsetValue}px)`,
      `padding-bottom: env(safe-area-inset-bottom, ${unsetInsetValue}px)`,
      `padding-left: env(safe-area-inset-left, ${unsetInsetValue}px)`,
    ].join(';');

    const read = () => {
      const styles = window.getComputedStyle(probe);
      const parseInset = (value: string) => {
        const parsed = Number.parseFloat(value);
        return parsed === unsetInsetValue ? null : Math.round(parsed) || 0;
      };

      setInsets({
        top: parseInset(styles.paddingTop),
        right: parseInset(styles.paddingRight),
        bottom: parseInset(styles.paddingBottom),
        left: parseInset(styles.paddingLeft),
      });
    };

    document.body.append(probe);
    read();

    const resizeObserver = new ResizeObserver(read);
    resizeObserver.observe(document.documentElement);
    window.addEventListener('resize', read);
    window.visualViewport?.addEventListener('resize', read);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', read);
      window.visualViewport?.removeEventListener('resize', read);
      probe.remove();
    };
  }, [viewportFitCover]);

  return insets;
}

function settleViewportScrollPosition() {
  const frameIds: number[] = [];
  const timeoutIds: number[] = [];
  const scrollToInlineOrigin = () => {
    const scrollingElement = document.scrollingElement;

    scrollingElement?.scrollTo({ left: 0, top: scrollingElement.scrollTop });
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    window.scrollTo({ left: 0, top: window.scrollY });
  };
  const reconcile = () => {
    scrollToInlineOrigin();
    document.documentElement.getBoundingClientRect();
    scrollToInlineOrigin();
  };

  reconcile();
  frameIds.push(window.requestAnimationFrame(reconcile));
  frameIds.push(window.requestAnimationFrame(() => frameIds.push(window.requestAnimationFrame(reconcile))));
  timeoutIds.push(window.setTimeout(reconcile, 50));
  timeoutIds.push(window.setTimeout(reconcile, 250));

  return () => {
    frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  };
}

function ColorField({
  label,
  value,
  onChange,
  info,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  info?: React.ReactNode;
}) {
  const id = useId();
  const colorPickerId = useId();
  const [draftValue, setDraftValue] = useState(value === 'transparent' ? '' : value);
  const [isFocused, setIsFocused] = useState(false);
  const normalizedDraftValue = normalizeColorInput(draftValue);
  const validDraft = isCssColor(draftValue);
  const nativePickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(value === 'transparent' ? '' : value);
    }
  }, [isFocused, value]);

  const commitDraftValue = (nextValue: string) => {
    const normalizedValue = normalizeColorInput(nextValue);

    if (isCssColor(normalizedValue)) {
      onChange(normalizedValue);
    }
  };

  return (
    <div className="field">
      <span className="field-label-with-info">
        <label htmlFor={id}>{label}</label>
        {info ? (
          <InfoTip label={`More information about ${label}`}>
            {info}
          </InfoTip>
        ) : null}
      </span>
      <input
        id={id}
        className="color-text-input"
        type="text"
        value={draftValue}
        placeholder="transparent"
        aria-invalid={!validDraft}
        onBlur={() => {
          setIsFocused(false);
          setDraftValue(
            validDraft
              ? (normalizedDraftValue === 'transparent' ? '' : normalizedDraftValue)
              : (value === 'transparent' ? '' : value),
          );
        }}
        onChange={(event) => {
          const nextValue = event.target.value;

          setDraftValue(nextValue);
          commitDraftValue(nextValue);
        }}
        onFocus={() => setIsFocused(true)}
      />
      <span className="color-swatch" style={{ '--swatch-color': value } as React.CSSProperties}>
        <input
          id={colorPickerId}
          className="color-picker-input"
          type="color"
          value={nativePickerValue}
          aria-label={`Pick ${label}`}
          onChange={(event) => {
            setDraftValue(event.target.value);
            onChange(event.target.value);
          }}
        />
      </span>
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="switch">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function InfoTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className="infotip-trigger" type="button" aria-label={label} openOnHover delay={150}>
        <svg className="infotip-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <path d="M8 7v4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.25" />
          <circle cx="8" cy="4.75" r="0.75" fill="currentColor" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={8}>
          <Popover.Popup className="infotip-popup">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ViewportFitField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="switch">
      <span className="switch-label-with-info">
        <label htmlFor={id}>viewport-fit=cover</label>
        <InfoTip label="More information about viewport-fit reload behavior">
          Updates the <code>{'<meta name="viewport">'}</code> value.
        </InfoTip>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

function NumberFieldControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const blockDecimalInput = (event: React.FormEvent<HTMLInputElement>) => {
    const data = (event.nativeEvent as InputEvent).data;

    if (data && /[.,]/.test(data)) {
      event.preventDefault();
    }
  };
  const blockDecimalPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (/[.,]/.test(event.clipboardData.getData('text'))) {
      event.preventDefault();
    }
  };

  return (
    <NumberField.Root
      id={id}
      className="number-field"
      min={0}
      max={999}
      step={1}
      smallStep={1}
      largeStep={10}
      snapOnStep
      format={{ maximumFractionDigits: 0 }}
      value={value}
      onValueChange={(nextValue) => onChange(Math.max(0, Math.round(nextValue ?? 0)))}
    >
      <NumberField.ScrubArea className="number-field-scrub-area">
        <label htmlFor={id} className="number-field-label">
          {label}
        </label>
      </NumberField.ScrubArea>

      <NumberField.Group className="number-field-group">
        <NumberField.Decrement className="number-field-stepper" aria-label={`Decrease ${label}`}>
          <MinusIcon />
        </NumberField.Decrement>
        <NumberField.Input
          className="number-field-input"
          inputMode="numeric"
          onBeforeInput={blockDecimalInput}
          onPaste={blockDecimalPaste}
        />
        <NumberField.Increment className="number-field-stepper" aria-label={`Increase ${label}`}>
          <PlusIcon />
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M1.5 8h13M8 14.5v-13" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M1.5 8h13" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.833.092-.647.35-1.088.636-1.338-2.22-.253-4.567-1.113-4.567-4.946 0-1.097.39-1.997 1.029-2.685-.103-.253-.446-1.336.098-2.685 0 0 .84-.269 2.749 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.685.64.699 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.856 0 1.338-.012 2.419-.012 2.749 0 .268.18.58.688.481C19.137 20.212 22 16.457 22 12.021 22 6.484 17.523 2 12 2z"
        fill="currentColor"
      />
    </svg>
  );
}

function ColorSchemeIcon({ mode }: { mode: Mode }) {
  if (mode === 'dark') {
    return (
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function getResetState(mode: Mode) {
  const nextState = structuredClone(defaultState);
  nextState.mode = mode;

  return nextState;
}

function getResetComparableState(state: typeof defaultState) {
  return {
    ...state,
    drawerOpen: defaultState.drawerOpen,
    dialogOpen: defaultState.dialogOpen,
  };
}

export default function App() {
  const [state, setState] = useState(readInitialState);
  const [{ roomId: syncRoomId, created: createdSyncRoom }] = useState(ensureSyncRoomId);
  const activeColors = state.colors[state.mode];
  const insets = useSafeAreaInsets(state.viewportFitCover);
  const oppositeMode: Mode = state.mode === 'light' ? 'dark' : 'light';
  const resetTarget = getResetState(state.mode);
  const canReset = JSON.stringify(getResetComparableState(state)) !== JSON.stringify(resetTarget);
  const serializedState = serializeState(state);
  const [syncReady, setSyncReady] = useState(false);
  const latestSerializedStateRef = useRef(serializedState);
  const createdSyncRoomRef = useRef(createdSyncRoom);
  const lastSentStateRef = useRef<string | null>(null);
  const skipNextSyncBroadcastRef = useRef(false);
  const previousViewportFitCoverRef = useRef(state.viewportFitCover);
  const shouldBroadcastReloadRef = useRef(wasPageReload() && !consumeRemoteRefresh(syncRoomId));

  useLayoutEffect(() => {
    const viewportFitCoverChanged = previousViewportFitCoverRef.current !== state.viewportFitCover;
    latestSerializedStateRef.current = serializedState;
    applyStateToDocument(state);
    cacheSerializedState(syncRoomId, serializedState);
    persistState();

    previousViewportFitCoverRef.current = state.viewportFitCover;

    if (viewportFitCoverChanged) {
      return settleViewportScrollPosition();
    }
  }, [serializedState, state, syncRoomId]);

  useEffect(() => {
    if (!syncRoomId) {
      setSyncReady(false);
      return;
    }

    setSyncReady(false);
    lastSentStateRef.current = null;

    return connectSync(
      syncRoomId,
      {
        onState: (query) => {
          const nextState = readStateFromQuery(query);

          setState((current) => {
            if (serializeState(current) === serializeState(nextState)) {
              return current;
            }

            skipNextSyncBroadcastRef.current = true;
            return nextState;
          });
        },
        onOpen: ({ isCreator }) => {
          if (isCreator) {
            sendState(latestSerializedStateRef.current);
            lastSentStateRef.current = latestSerializedStateRef.current;
            createdSyncRoomRef.current = false;
          }

          if (shouldBroadcastReloadRef.current) {
            shouldBroadcastReloadRef.current = false;
            refreshRoom();
          }
        },
        onStatus: (status) => {
          setSyncReady(status === 'ready');
        },
      },
      { isCreator: createdSyncRoomRef.current },
    );
  }, [syncRoomId]);

  useEffect(() => {
    if (!syncRoomId || !syncReady) {
      return;
    }

    if (skipNextSyncBroadcastRef.current) {
      skipNextSyncBroadcastRef.current = false;
      lastSentStateRef.current = serializedState;
      return;
    }

    if (serializedState === lastSentStateRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      sendState(serializedState);
      lastSentStateRef.current = serializedState;
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [serializedState, syncRoomId, syncReady]);

  const setActiveColor = (colorKey: keyof ModeColors, value: string) => {
    setState((current) => setModeColor(current, colorKey, value));
  };
  const setOverlayOpen = (overlay: 'drawerOpen' | 'dialogOpen', open: boolean) => {
    setState((current) => ({ ...current, [overlay]: open }));
  };
  const resetState = () => {
    applyStateToDocument(resetTarget);
    setState(resetTarget);
  };
  const formatInset = (value: number | null) => (value ? `${value}px` : 'n/a');
  const describeInset = (side: keyof Insets) =>
    insets[side] ? `${side} ${insets[side]}px` : `${side} not active`;
  const isInsetActive = (value: number | null) => (value ? 'true' : 'false');

  return (
    <div className="app">
      <header
        className="site-header"
        hidden={!state.headerVisible}
        data-fixed={state.headerFixed}
      >
        <div className="bar-inner">
          <p className="bar-title">Header</p>
          <span className="bar-meta">{state.headerFixed ? 'fixed' : 'static'}</span>
        </div>
      </header>

      <main className="shell">
        <section className="hero" aria-labelledby="page-title">
          <h1 id="page-title">Safari Tint Playground</h1>
          <p>
            Paste the URL in another browser to compare how Safari and other browsers render toolbars and safe
            areas.
          </p>
          <ul>
            <li>
              All settings are synced across devices.
            </li>
            <li>
              Tab refreshes are synced across devices.
            </li>
            <li>
              Different color values are stored for light and dark theme.
            </li>
            <li>
              <strong>You might need a refresh after changing some of the settings</strong> for the browser to pick up the changes.
            </li>
          </ul>
        </section>

        <section className="panel" aria-label="Controls">
          <div className="button-row">
            <button
              className="button icon-button"
              type="button"
              aria-label={`Switch to ${oppositeMode} mode`}
              onClick={() => setState((current) => ({ ...current, mode: oppositeMode }))}
            >
              <ColorSchemeIcon mode={oppositeMode} />
            </button>
            <Drawer open={state.drawerOpen} onOpenChange={(open) => setOverlayOpen('drawerOpen', open)} />
            <Dialog open={state.dialogOpen} onOpenChange={(open) => setOverlayOpen('dialogOpen', open)} />
            {canReset ? (
              <button
                className="button reset-button"
                type="button"
                onClick={resetState}
              >
                Reset
              </button>
            ) : null}
          </div>

          <div className="controls">
            <section className="control-card" aria-labelledby="page-controls-title">
              <h3 id="page-controls-title">Page</h3>
              <ColorField
                label="Background"
                value={activeColors.page}
                onChange={(value) => setActiveColor('page', value)}
                info="Sets the html and body elements background color."
              />
              <ColorField
                label="Theme color meta"
                value={activeColors.theme}
                onChange={(value) => setActiveColor('theme', value)}
                info={
                  <>
                    Updates the <code>{'<meta name="theme-color">'}</code> value. Safari 26 ignores this
                    and samples page content instead. Browsers may ignore unsupported values.
                  </>
                }
              />
              <ViewportFitField
                checked={state.viewportFitCover}
                onChange={(checked) =>
                  setState((current) => ({ ...current, viewportFitCover: checked }))
                }
              />
            </section>

            <section className="control-card" aria-labelledby="header-controls-title">
              <h3 id="header-controls-title">Header</h3>
              <ColorField
                label="Background"
                value={activeColors.header}
                onChange={(value) => setActiveColor('header', value)}
              />
              <SwitchField
                label="Show header"
                checked={state.headerVisible}
                onChange={(checked) => setState((current) => ({ ...current, headerVisible: checked }))}
              />
              {state.headerVisible ? (
                <>
                  <SwitchField
                    label="Fixed header"
                    checked={state.headerFixed}
                    onChange={(checked) => setState((current) => ({ ...current, headerFixed: checked }))}
                  />
                  {state.headerFixed ? (
                    <NumberFieldControl
                      label="Top distance (px)"
                      value={state.headerTop}
                      onChange={(headerTop) => setState((current) => ({ ...current, headerTop }))}
                    />
                  ) : null}
                </>
              ) : null}
            </section>

            <section className="control-card" aria-labelledby="footer-controls-title">
              <h3 id="footer-controls-title">Footer</h3>
              <ColorField
                label="Background"
                value={activeColors.footer}
                onChange={(value) => setActiveColor('footer', value)}
              />
              <SwitchField
                label="Show footer"
                checked={state.footerVisible}
                onChange={(checked) => setState((current) => ({ ...current, footerVisible: checked }))}
              />
              {state.footerVisible ? (
                <>
                  <SwitchField
                    label="Fixed footer"
                    checked={state.footerFixed}
                    onChange={(checked) => setState((current) => ({ ...current, footerFixed: checked }))}
                  />
                  {state.footerFixed ? (
                    <NumberFieldControl
                      label="Bottom distance (px)"
                      value={state.footerBottom}
                      onChange={(footerBottom) => setState((current) => ({ ...current, footerBottom }))}
                    />
                  ) : null}
                </>
              ) : null}
            </section>

            <section className="surface control-card" aria-labelledby="surface-title">
              <h2 className="surface-title" id="surface-title">Safe area insets</h2>
              <div className="safe-area-readout" aria-label="Safe area inset readout">
                <span className="readout-item readout-top" data-active={isInsetActive(insets.top)}>
                  <code aria-label={describeInset('top')}>{formatInset(insets.top)}</code>
                </span>
                <span className="readout-item readout-right" data-active={isInsetActive(insets.right)}>
                  <code aria-label={describeInset('right')}>{formatInset(insets.right)}</code>
                </span>
                <span className="readout-square" aria-hidden="true" />
                <span className="readout-item readout-bottom" data-active={isInsetActive(insets.bottom)}>
                  <code aria-label={describeInset('bottom')}>{formatInset(insets.bottom)}</code>
                </span>
                <span className="readout-item readout-left" data-active={isInsetActive(insets.left)}>
                  <code aria-label={describeInset('left')}>{formatInset(insets.left)}</code>
                </span>
              </div>
            </section>
          </div>
        </section>
      </main>

      <aside className="site-credit" aria-label="Project links">
        <p className="site-credit-text">
          made with <span role="img" aria-label="love">❤️</span> by{' '}
          <a href="https://x.com/aarongarciah" target="_blank" rel="noopener noreferrer">
            @aarongarciah
          </a>
        </p>
        <span aria-hidden="true" style={{ userSelect: 'none' }}>/</span>
        <a
          className="site-credit-github"
          href="https://github.com/aarongarciah/safari-tint-playground"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
        >
          <GitHubIcon />
        </a>
      </aside>

      <footer className="site-footer" hidden={!state.footerVisible} data-fixed={state.footerFixed}>
        <div className="bar-inner">
          <p className="bar-title">Footer</p>
          <span className="bar-meta">{state.footerFixed ? 'fixed' : 'static'}</span>
        </div>
      </footer>
    </div>
  );
}
