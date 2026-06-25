import { ACTIVITY_COLORS, STAFF_PALETTE } from './constants';
import { toMinutes, formatMinutes } from './utils';

export default function SummaryBar({ entries, staff }) {
  if (entries.length === 0) return null;

  // Per-activity counts
  const byActivity = {};
  entries.forEach((e) => { byActivity[e.activity] = (byActivity[e.activity] || 0) + 1; });

  // Per-staff counts + total scheduled minutes
  const byStaff = {};
  entries.forEach((e) => {
    const name = e.staff || 'Unassigned';
    const mins = Math.max(0, toMinutes(e.end_time || e.start_time) - toMinutes(e.start_time));
    if (!byStaff[name]) byStaff[name] = { count: 0, mins: 0 };
    byStaff[name].count += 1;
    byStaff[name].mins += mins;
  });

  const staffColor = (name) => {
    const idx = staff.findIndex((s) => s.name === name);
    return STAFF_PALETTE[idx >= 0 ? idx % STAFF_PALETTE.length : 0];
  };

  const activities = Object.entries(byActivity).sort((a, b) => b[1] - a[1]);
  const people = Object.entries(byStaff).sort((a, b) => b[1].mins - a[1].mins);
  const totalHours = formatMinutes(people.reduce((n, [, v]) => n + v.mins, 0));

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
        <span className="summary-label">By team member</span>
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
