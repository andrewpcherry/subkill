import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Card, Chip, Empty, Evidence, FilterBar } from '../ui.jsx';
import { alertCounts, alerts, longDate, shortDate } from '../state/derive.ts';

export default function Alerts() {
  const { state, setSheet, run, notify } = useStore();
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const list = alerts(state);
  const counts = alertCounts(state);

  // Duplicate alerts about the same event collapse into one card.
  const deduped = useMemo(() => {
    const seen = new Map();
    for (const a of list) {
      const key = `${a.paymentId || 'none'}|${a.title}`;
      if (!seen.has(key)) seen.set(key, { ...a, dupes: 0 });
      else seen.get(key).dupes += 1;
    }
    return [...seen.values()];
  }, [list]);

  const shown = deduped.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'needs') return a.status === 'open' && a.tone !== 'emerald' && a.tone !== 'blue';
    if (filter === 'watching') return a.status === 'watching' || a.tone === 'emerald';
    return a.status === 'resolved';
  });

  const act = (a) => {
    if (!a.paymentId) { setSheet(null); return; }
    if (a.paymentId === 'p_harbor' && a.id === 'al_harbor') setSheet({ kind: 'bill', paymentId: 'p_harbor' });
    else if (a.id.startsWith('al_case_')) setSheet({ kind: 'case', paymentId: a.paymentId });
    else if (a.id.startsWith('al_notice_')) setSheet({ kind: 'contract', paymentId: a.paymentId });
    else setSheet({ kind: 'payment', paymentId: a.paymentId });
  };

  return (
    <>
      <header style={{ marginBottom: 14 }}>
        <h1>Alerts</h1>
        <p className="muted small" style={{ marginTop: 3 }}>
          Opening an alert is not the same as resolving it. Each one keeps its status until you act.
        </p>
      </header>

      <FilterBar
        label="Alert filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `All (${counts.all})` },
          { value: 'needs', label: `Needs decision (${counts.needsDecision})` },
          { value: 'watching', label: `Watching (${counts.watching})` },
          { value: 'resolved', label: `Resolved (${counts.resolved})` },
        ]}
      />

      <div className="stack" style={{ marginTop: 16 }}>
        {shown.length === 0 ? (
          <Empty icon="✓" title="Nothing in this view" body="Try another filter, or come back after the next scheduled review." />
        ) : (
          shown.map((a) => (
            <Card key={a.id}>
              <div className="row between gap-sm wrap">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row gap-sm wrap" style={{ alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 570 }}>{a.title}</span>
                    <Chip tone={a.tone}>
                      {a.status === 'resolved' ? 'Resolved' : a.tone === 'emerald' ? 'Watching' : a.status === 'watching' ? 'Watching' : 'Needs decision'}
                    </Chip>
                    {a.dupes ? <Chip>+{a.dupes} duplicate grouped</Chip> : null}
                  </div>
                  <p className="small muted" style={{ marginTop: 4 }}>{a.detail}</p>
                  <div className="tiny dim" style={{ marginTop: 4 }}>
                    {shortDate(a.at)}
                    {a.reviewAfter ? ` · quiet until ${longDate(a.reviewAfter)}` : ''}
                  </div>
                </div>
              </div>

              <div className="btnrow" style={{ marginTop: 11 }}>
                {a.action ? (
                  <button type="button" className="btn sm primary" onClick={() => act(a)}>{a.action}</button>
                ) : null}
                {a.evidenceIds.length ? (
                  <button type="button" className="btn sm ghost" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                    {openId === a.id ? 'Hide evidence' : 'Show evidence'}
                  </button>
                ) : null}
                {a.paymentId && a.status !== 'resolved' ? (
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => setSheet({ kind: 'reviewLater', paymentId: a.paymentId })}
                  >
                    Review later
                  </button>
                ) : null}
                {a.status !== 'resolved' && a.tone !== 'red' ? (
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => { run.setAlertStatus(a.id, 'resolved'); notify('Alert marked resolved.'); }}
                  >
                    Mark resolved
                  </button>
                ) : null}
              </div>

              {openId === a.id ? (
                <div style={{ marginTop: 12 }}>
                  <Evidence items={state.evidence.filter((e) => a.evidenceIds.includes(e.id))} />
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>

      <div className="section">
        <div className="section-head"><h2>Digest preview</h2></div>
        <Card>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {state.settings.digest === 'daily' ? 'Daily' : 'Weekly'} digest, as it would arrive
          </div>
          <p className="small muted">
            {counts.needsDecision} decision{counts.needsDecision === 1 ? '' : 's'} waiting.{' '}
            {alerts(state).filter((a) => a.tone === 'emerald').length} case
            {alerts(state).filter((a) => a.tone === 'emerald').length === 1 ? '' : 's'} being watched.
          </p>
          <p className="tiny dim" style={{ marginTop: 8 }}>
            Quiet hours are {String(state.settings.quietHoursStart).padStart(2, '0')}:00 to{' '}
            {String(state.settings.quietHoursEnd).padStart(2, '0')}:00. Delivery is held during those hours in
            this simulation, but approaching deadlines always stay visible in the app.
          </p>
        </Card>
      </div>
    </>
  );
}
