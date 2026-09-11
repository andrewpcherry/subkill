import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { formatMoney } from './state/derive.ts';
import { MerchantMark } from './brands.jsx';

export { MerchantMark };

/**
 * The mark: a guardian's shield, opened by a diagonal cut.
 * Protection, and the act of cancelling. Violet right, mint left, mint cut.
 */
export function Logo({ size = 28, id = 'lg' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ff5c0" />
          <stop offset="100%" stopColor="#17d9a0" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <path
        d="M16 3.2 27 7v8.4c0 6.6-4.6 11.2-11 13.4"
        stroke={`url(#${id}-b)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M16 3.2 5 7v8.4c0 3.1 1 5.9 2.7 8.2"
        stroke={`url(#${id}-a)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M10.6 26.4 20.4 16"
        stroke={`url(#${id}-a)`} strokeWidth="3" strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ size = 17, tagline = false }) {
  return (
    <div className="row" style={{ gap: 9 }}>
      <Logo size={size * 1.7} />
      <div style={{ textAlign: 'left' }}>
        <div className="brand-name" style={{ fontSize: size }}>SubKill</div>
        {tagline ? <div className="brand-tag">Know where every dollar goes.</div> : null}
      </div>
    </div>
  );
}

export function Money({ cents, sign = false, hideCents = false, className = '' }) {
  return <span className={`num ${className}`}>{formatMoney(cents, { sign, cents: !hideCents })}</span>;
}

export function Card({ className = '', children, ...rest }) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value num" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function Chip({ tone, children, ...rest }) {
  return <span className={`chip ${tone || ''}`} {...rest}>{children}</span>;
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={checked}
      aria-pressed={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Tabs({ value, onChange, options, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ value, onChange, options, label }) {
  return (
    <div className="filterbar" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Accessible sheet. Traps focus, closes on Escape, restores focus on exit,
 * and renders full-height on small screens.
 */
export function Sheet({ title, subtitle, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  const restore = useRef(null);
  const titleId = useId();

  useEffect(() => {
    restore.current = document.activeElement;
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((el) => !el.hasAttribute('disabled'));

    const first = focusables()[0];
    if (first) first.focus();
    else node?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (restore.current && restore.current.focus) restore.current.focus();
    };
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className={`sheet ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
        tabIndex={-1}
      >
        <div className="grabber" />
        <div className="sheet-head">
          <div className="grow">
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="small muted" style={{ marginTop: 3 }}>{subtitle}</p> : null}
          </div>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Evidence({ items }) {
  if (!items.length) {
    return <p className="small dim">No supporting evidence is attached to this record.</p>;
  }
  return (
    <div className="stack-sm">
      {items.map((e) => (
        <div className="evidence" key={e.id}>
          <div className="small">{e.summary}</div>
          {e.detail ? <div className="tiny muted" style={{ marginTop: 4 }}>{e.detail}</div> : null}
          <div className="tiny dim" style={{ marginTop: 5 }}>
            {e.sourceLabel} · {new Date(e.observedAt).toISOString().slice(0, 10)} ·{' '}
            {e.confidence === 'confirmed'
              ? 'Confirmed from the source document'
              : e.confidence === 'reported_by_user'
                ? 'Reported by you, not independently confirmed'
                : 'Inferred'}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Lifecycle({ steps }) {
  return (
    <div className="life">
      {steps.map((s, i) => (
        <div className="life-step" key={`${s.label}-${i}`}>
          <div className="life-rail">
            <div className={`life-dot ${s.state || ''}`} />
            {i < steps.length - 1 ? <div className="life-line" /> : null}
          </div>
          <div className="life-body grow">
            <div className="small" style={{ fontWeight: 570 }}>{s.label}</div>
            {s.detail ? <div className="tiny muted" style={{ marginTop: 2 }}>{s.detail}</div> : null}
            {s.at ? <div className="tiny dim" style={{ marginTop: 2 }}>{s.at}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ icon, title, body, action }) {
  return (
    <div className="empty">
      {icon ? <div className="big">{icon}</div> : null}
      <div style={{ color: 'var(--text-2)', fontWeight: 560 }}>{title}</div>
      {body ? <p className="small" style={{ marginTop: 6, maxWidth: 380, marginInline: 'auto' }}>{body}</p> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export const CATEGORY_COLOR = {
  Streaming: '#ff4d8d',
  Software: '#8b7cff',
  Fitness: '#ff8a3d',
  Kids: '#3dc8ff',
  Learning: '#ffd645',
  Utilities: '#4ff5c0',
  Insurance: '#2dd4bf',
  Other: '#c4b5fd',
};

export function Avatar({ name, size = 36 }) {
  return <MerchantMark name={name} size={size} />;
}

/**
 * Category ring. Each slice carries that category's hue, so the breakdown reads
 * as a picture first and a number second.
 */
export function Ring({ slices, total, centerLabel, centerValue, size = 176, onSlice }) {
  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="13" />
        {slices.map((s) => {
          const frac = total > 0 ? s.value / total : 0;
          const len = circ * frac;
          const el = (
            <circle
              key={s.label}
              className="ring-seg"
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="13"
              strokeLinecap="butt"
              strokeDasharray={`${Math.max(0, len - 2)} ${circ}`}
              strokeDashoffset={-offset}
              onClick={() => onSlice && onSlice(s)}
              style={{ filter: `drop-shadow(0 0 7px ${s.color}aa)` }}
            >
              <title>{`${s.label}: ${s.display}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="ring-center">
        <div className="eyebrow">{centerLabel}</div>
        <div className="figure lg" style={{ marginTop: 5 }}>{centerValue}</div>
      </div>
    </div>
  );
}

export function Tile({ label, value, note, glow, onClick, valueColor }) {
  const style = { '--glow': glow ? `${glow}30` : 'transparent', '--edge': glow || 'transparent' };
  const inner = (
    <>
      <div className="tlabel">{label}</div>
      <div className="tval" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      {note ? <div className="tnote">{note}</div> : null}
    </>
  );
  if (onClick) return <button type="button" className="tile" style={style} onClick={onClick}>{inner}</button>;
  return <div className="tile" style={style}>{inner}</div>;
}

export function Bar({ pct, tone = 'emerald' }) {
  return (
    <div className="bar">
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: `var(--${tone})` }} />
    </div>
  );
}

export function WhyPopover({ why, evidence }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
        Why this appeared
      </button>
      {open ? (
        <Sheet
          title="Why this appeared"
          subtitle="What SubKill observed, and how confident it can be."
          onClose={() => setOpen(false)}
          footer={<button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>}
        >
          <p className="small" style={{ marginBottom: 14 }}>{why}</p>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Evidence</div>
          <Evidence items={evidence} />
        </Sheet>
      ) : null}
    </>
  );
}

export function DemoBadge() {
  return (
    <span className="demobadge" title="All data in this prototype is synthetic.">
      <span className="pip" />
      Investor Demo · Sample data
    </span>
  );
}
