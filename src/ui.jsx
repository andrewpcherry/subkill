import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { formatMoney } from './state/derive.ts';

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

export function Avatar({ name }) {
  const letters = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return <div className="av">{letters}</div>;
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
