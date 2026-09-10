import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SCHEMA_VERSION, createInitialState } from './state/seed.ts';
import * as A from './state/actions.ts';

const KEY = 'subkill.demo.v4';

const Ctx = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return createInitialState();
    return parsed;
  } catch {
    return createInitialState();
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable; the demo still works in memory */
  }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [route, setRoute] = useState({ tab: 'home', sub: null });
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [entered, setEntered] = useState(() => {
    try { return localStorage.getItem(KEY + '.entered') === '1'; } catch { return false; }
  });
  const toastTimer = useRef(null);

  useEffect(() => { save(state); }, [state]);
  useEffect(() => {
    try { localStorage.setItem(KEY + '.entered', entered ? '1' : '0'); } catch { /* ignore */ }
  }, [entered]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const notify = (message, tone = 'neutral') => {
    setToast({ message, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  };

  /** Wraps every action so screens never touch the reducer directly. */
  const run = useMemo(() => {
    const wrap = (fn) => (...args) => {
      let next;
      setState((prev) => {
        next = fn(prev, ...args);
        return next;
      });
      return next;
    };
    const out = {};
    for (const [name, fn] of Object.entries(A)) {
      if (typeof fn === 'function' && name !== 'resetDemo') out[name] = wrap(fn);
    }
    out.reset = () => {
      const fresh = createInitialState();
      setState(fresh);
      setSheet(null);
      setRoute({ tab: 'home', sub: null });
      return fresh;
    };
    return out;
  }, []);

  const go = (tab, sub = null) => {
    setRoute({ tab, sub });
    setSheet(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const value = {
    state, setState, route, go, sheet, setSheet, run,
    toast, notify, entered, setEntered,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}

/** Copy helper that degrades honestly when the clipboard is unavailable. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function downloadFile(filename, text, mime = 'text/plain') {
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
