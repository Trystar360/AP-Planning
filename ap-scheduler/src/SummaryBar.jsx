import { ACTIVITY_COLORS, STAFF_PALETTE } from './constants';
import { toMinutes, formatMinutes } from './utils';

function getFacilitators(e) {
  if (Array.isArray(e.facilitators)) return e.facilitators;
  if (e.staff) return [e.staff];
  return [];
}

export default function SummaryBar({ entries, staff }) {
  if (entries.length === 0) return null;

  // Per-activity counts
  const byActivity = {};
  entries.forEach((e) => { byActivity[e.activity] = (byActivity[e.activity] || 0) + 1; });

  // Per-facilitator counts + total scheduled minutes
  const byFacilitator = {};
  entries.forEach((e) => {
    const names = getFacilitators(e);
    const mins = Math.max(0, toMinutes(e.end_time || e.start_time) - toMinutes(e.start_time));
    const targets = names.length > 0 ? names : ['Unassigned'];
    targets.forEach((name) => {
      if (!byFacilitator[name]) byFacilitator[name] = { count: 0, mins: 0 };
      byFacilitator[name].count += 1;
      byFacilitator[name].mins += mins;
    });
  });

  const staffColor = (name) => {
    const idx = staff.findIndex((s) => s.name === name);
    return STAFF_PALETTE[idx >= 0 ? idx % STAFF_PALETTE.length : 0];
  };

  const activities = Object.entries(byActivity).sort((a, b) => b[1] - a[1]);
  const people = Object.entries(byFacilitator).sort((a, b) => b[1].mins - a[1].mins);
  const totalHours = formatMinutes(entries.reduce((n, e) => {
    return n + Math.max(0, toMinutes(e.end_time || e.start_time) - toMinutes(e.start_time));
  }, 0));

  return (
    <div className="summary-bar">
      <div className="summary-group">
        <span className="summary-label">{entries.length} activities · {totalHours} total</span>
        <div className="summary-pills">
          {activities.map(([name, count]) => {
            const c = ACTIVITY_COLORS[name] || {};
            return (
              <span key={name} className="summary-pill" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                {name} <b>{count}</b>
              </span>
            );
          })}
        </div>
      </div>
      <div className="summary-group">
        <span className="summary-label">By facilitator</span>
        <div className="summary-pills">
          {people.map(([name, v]) => (
            <span key={name} className="summary-pill summary-staff">
              <span className="staff-dot" style={{ background: staffColor(name) }} />
              {name} <b>{v.count}</b> · {formatMinutes(v.mins)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
