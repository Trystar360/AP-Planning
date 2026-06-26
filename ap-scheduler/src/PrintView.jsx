import { DAYS, ACTIVITY_COLORS } from './constants';
import { formatTime, toMinutes, durationLabel, formatWeekLabel } from './utils';

function getFacilitators(e) {
  if (Array.isArray(e.facilitators)) return e.facilitators;
  if (e.staff) return [e.staff];
  return [];
}

function dayDate(weekStart, dayIndex) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + dayIndex);
  return d;
}

function formatMins(mins) {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

export default function PrintView({ entries, weekStart, filterStaff }) {
  const filtered = filterStaff
    ? entries.filter((e) => getFacilitators(e).includes(filterStaff))
    : entries;

  const byDay = DAYS.map((day, i) => {
    const dayEntries = filtered
      .filter((e) => e.day === day)
      .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
    const date = dayDate(weekStart, i);
    return { day, date, entries: dayEntries };
  }).filter(({ entries: de }) => de.length > 0);

  const active = filtered.filter((e) => !e.cancelled);
  const activeCount = active.length;
  const totalMins = active.reduce(
    (sum, e) => sum + Math.max(0, toMinutes(e.end_time) - toMinutes(e.start_time)),
    0,
  );

  const activitySummary = [...new Set(active.map((e) => e.activity))]
    .map((activity) => {
      const acts = active.filter((e) => e.activity === activity);
      const mins = acts.reduce((s, e) => s + Math.max(0, toMinutes(e.end_time) - toMinutes(e.start_time)), 0);
      return { activity, count: acts.length, mins };
    })
    .sort((a, b) => b.count - a.count);

  const allFacNames = filterStaff
    ? [filterStaff]
    : [...new Set(active.flatMap(getFacilitators))].sort();

  const staffSummary = allFacNames
    .map((name) => {
      const myEntries = active.filter((e) => getFacilitators(e).includes(name));
      const mins = myEntries.reduce((s, e) => s + Math.max(0, toMinutes(e.end_time) - toMinutes(e.start_time)), 0);
      return { name, count: myEntries.length, mins };
    })
    .filter((s) => s.count > 0);

  const title = filterStaff ? `${filterStaff}'s Schedule` : 'Weekly Activity Schedule';
  const printDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="print-view">
      <div className="pv-header">
        <div className="pv-header-left">
          <div className="pv-org">AP Scheduler</div>
          <h1 className="pv-title">{title}</h1>
          <div className="pv-week">{formatWeekLabel(weekStart)}</div>
        </div>
        <div className="pv-header-right">
          <div className="pv-stats-row">
            <div className="pv-stat">
              <span className="pv-stat-value">{activeCount}</span>
              <span className="pv-stat-label">Activities</span>
            </div>
            <div className="pv-stat">
              <span className="pv-stat-value">{formatMins(totalMins)}</span>
              <span className="pv-stat-label">Total time</span>
            </div>
            <div className="pv-stat">
              <span className="pv-stat-value">{byDay.length}</span>
              <span className="pv-stat-label">Days active</span>
            </div>
          </div>
          <div className="pv-print-date">Printed {printDate}</div>
        </div>
      </div>

      <div className="pv-divider" />

      {byDay.length === 0 ? (
        <div className="pv-empty">No activities scheduled for this week.</div>
      ) : (
        byDay.map(({ day, date, entries: dayEntries }) => {
          const dayActive = dayEntries.filter((e) => !e.cancelled).length;
          return (
            <div key={day} className="pv-day-section">
              <div className="pv-day-heading">
                <span className="pv-day-name">{day}</span>
                <span className="pv-day-date">
                  {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="pv-day-count">
                  {dayActive} {dayActive === 1 ? 'activity' : 'activities'}
                </span>
              </div>
              <table className="pv-table">
                <colgroup>
                  <col className="pv-col-time" />
                  <col className="pv-col-activity" />
                  <col className="pv-col-group" />
                  <col className="pv-col-dur" />
                  <col className="pv-col-fac" />
                  <col className="pv-col-notes" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Activity</th>
                    <th>Group</th>
                    <th>Duration</th>
                    <th>Facilitator(s)</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {dayEntries.map((entry, idx) => {
                    const colors = ACTIVITY_COLORS[entry.activity];
                    const facs = getFacilitators(entry);
                    const cancelled = entry.cancelled;
                    return (
                      <tr
                        key={entry.id || idx}
                        className={`pv-row${cancelled ? ' pv-cancelled' : ''}${idx % 2 !== 0 ? ' pv-alt' : ''}`}
                      >
                        <td className="pv-time-cell">
                          <span className="pv-time-start">{formatTime(entry.start_time)}</span>
                          <span className="pv-time-arrow"> – </span>
                          <span className="pv-time-end">{formatTime(entry.end_time)}</span>
                        </td>
                        <td
                          className="pv-act-cell"
                          style={colors ? {
                            borderLeft: `4px solid ${colors.border}`,
                            paddingLeft: '6px',
                          } : {}}
                        >
                          {entry.activity}
                          {cancelled && <span className="pv-cancelled-tag">Cancelled</span>}
                        </td>
                        <td>{entry.group_name || '—'}</td>
                        <td className="pv-dur-cell">{durationLabel(entry.start_time, entry.end_time) || '—'}</td>
                        <td>{facs.length ? facs.join(', ') : '—'}</td>
                        <td className="pv-notes-cell">{entry.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {(activitySummary.length > 0 || staffSummary.length > 0) && (
        <div className="pv-summary">
          <div className="pv-divider pv-divider-summary" />
          <h2 className="pv-summary-heading">Week at a Glance</h2>
          <div className="pv-summary-cols">
            {activitySummary.length > 0 && (
              <div className="pv-summary-col">
                <h3 className="pv-summary-subhead">By Activity</h3>
                <table className="pv-sum-table">
                  <thead>
                    <tr><th>Activity</th><th>Sessions</th><th>Time</th></tr>
                  </thead>
                  <tbody>
                    {activitySummary.map((a) => {
                      const c = ACTIVITY_COLORS[a.activity];
                      return (
                        <tr key={a.activity}>
                          <td style={c ? { borderLeft: `3px solid ${c.border}`, paddingLeft: '5px' } : {}}>
                            {a.activity}
                          </td>
                          <td>{a.count}</td>
                          <td>{formatMins(a.mins)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {staffSummary.length > 0 && (
              <div className="pv-summary-col">
                <h3 className="pv-summary-subhead">By Facilitator</h3>
                <table className="pv-sum-table">
                  <thead>
                    <tr><th>Facilitator</th><th>Activities</th><th>Time</th></tr>
                  </thead>
                  <tbody>
                    {staffSummary.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td>{s.count}</td>
                        <td>{formatMins(s.mins)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pv-footer">
        <span>AP Scheduler — {filterStaff ? `${filterStaff}'s rota` : 'Full schedule'}</span>
        <span>{formatWeekLabel(weekStart)}</span>
        <span>Printed {printDate}</span>
      </div>
    </div>
  );
}
