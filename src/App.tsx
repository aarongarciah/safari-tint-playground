import { useEffect, useId, useState } from 'react';
import { NumberField } from '@base-ui/react/number-field';
import { Dialog } from './components/Dialog';
import { Drawer } from './components/Drawer';
import {
  applyStateToDocument,
  defaultState,
  persistState,
  readInitialState,
  setModeColor,
  type Mode,
  type ModeColors,
} from './state';

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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <code>{value}</code>
    </label>
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M1.5 8h13M8 14.5v-13" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M1.5 8h13" />
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
          strokeWidth="1"
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
        strokeWidth="1"
      />
      <path
        d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1"
      />
    </svg>
  );
}

function getResetState(mode: Mode) {
  const nextState = structuredClone(defaultState);
  nextState.mode = mode;

  return nextState;
}

export default function App() {
  const [state, setState] = useState(readInitialState);
  const [openOverlays, setOpenOverlays] = useState({ drawer: false, dialog: false });
  const activeColors = state.colors[state.mode];
  const insets = useSafeAreaInsets(state.viewportFitCover);
  const oppositeMode: Mode = state.mode === 'light' ? 'dark' : 'light';
  const overlayOpen = openOverlays.drawer || openOverlays.dialog;
  const resetTarget = getResetState(state.mode);
  const canReset = JSON.stringify(state) !== JSON.stringify(resetTarget);

  useEffect(() => {
    applyStateToDocument(state);
    persistState(state);
  }, [state]);

  const setActiveColor = (colorKey: keyof ModeColors, value: string) => {
    setState((current) => setModeColor(current, colorKey, value));
  };
  const setOverlayOpen = (overlay: keyof typeof openOverlays, open: boolean) => {
    if (open && !overlayOpen) {
      document.documentElement.style.setProperty(
        '--scrollbar-lock-width',
        `${window.innerWidth - document.documentElement.clientWidth}px`,
      );
    }

    setOpenOverlays((current) => {
      const next = { ...current, [overlay]: open };

      if (!next.drawer && !next.dialog) {
        document.documentElement.style.setProperty('--scrollbar-lock-width', '0px');
      }

      return next;
    });
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
    <div className="app" data-overlay-open={overlayOpen}>
      <header
        className="site-header"
        hidden={!state.headerVisible}
        data-fixed={state.headerFixed}
        data-transparent-parent={state.headerTransparentParent}
      >
        <div aria-hidden="true" className="bar-background" />
        <div className="bar-inner">
          <p className="bar-title">Header</p>
          <span className="bar-meta">{state.headerFixed ? 'fixed' : 'static'}</span>
        </div>
      </header>

      <main className="shell">
        <section className="hero" aria-labelledby="page-title">
          <h1 id="page-title">Safari Tint Playground</h1>
          <p>
            Play with the settings to see how Safari and other browsers render browser chrome and safe areas.
            Paste the URL in another browser to compare how Safari and other browsers render browser chrome and safe
            areas.
          </p>
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
            <Drawer onOpenChange={(open) => setOverlayOpen('drawer', open)} />
            <Dialog onOpenChange={(open) => setOverlayOpen('dialog', open)} />
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
              />
              <ColorField
                label="Theme color meta"
                value={activeColors.theme}
                onChange={(value) => setActiveColor('theme', value)}
              />
              <SwitchField
                label="viewport-fit=cover"
                checked={state.viewportFitCover}
                onChange={(checked) =>
                  setState((current) => ({ ...current, viewportFitCover: checked }))
                }
              />
              <p className="note">
                Safari may need a reload to validate first-paint toolbar sampling after changing
                viewport fit.
              </p>
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
              <SwitchField
                label="Fixed header"
                checked={state.headerFixed}
                onChange={(checked) => setState((current) => ({ ...current, headerFixed: checked }))}
              />
              <SwitchField
                label="Transparent parent fix"
                checked={state.headerTransparentParent}
                onChange={(checked) =>
                  setState((current) => ({ ...current, headerTransparentParent: checked }))
                }
              />
              {state.headerFixed ? (
                <NumberFieldControl
                  label="Top distance (px)"
                  value={state.headerTop}
                  onChange={(headerTop) => setState((current) => ({ ...current, headerTop }))}
                />
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
            </section>
          </div>
        </section>

        <section className="surface" aria-labelledby="surface-title">
          <h2 id="surface-title">Safe area insets</h2>
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
      </main>

      <footer className="site-footer" hidden={!state.footerVisible} data-fixed={state.footerFixed}>
        <div className="bar-inner">
          <p className="bar-title">Footer</p>
          <span className="bar-meta">{state.footerFixed ? 'fixed' : 'static'}</span>
        </div>
      </footer>
    </div>
  );
}
