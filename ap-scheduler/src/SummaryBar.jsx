import { ACTIVITY_COLORS as DEFAULT_ACTIVITY_COLORS, staffColorByIndex } from './constants';
import { toMinutes, formatMinutes, doubleBookedFacilitators, getFacilitators, UNASSIGNED } from './utils';

export default function SummaryBar({ entries: allEntries, staff, activityColors: activityColorsProp, filterStaff = [], onToggleFacilitator }) {
  const ACTIVITY_COLORS = activityColorsProp && Object.keys(activityColorsProp).length ? activityColorsProp : DEFAULT_ACTIVITY_COLORS;
  const entries = allEntries.filter((e) => !e.cancelled);
  if (entries.length === 0) return null;

  // Per-activity counts
  const byActivity = {};
  entries.forEach((e) => { byActivity[e.activity] = (byActivity[e.activity] || 0) + 1; });

  // Per-facilitator counts + total scheduled minutes
  const byFacilitator = {};
  entries.forEach((e) => {
    const names = getFacilitators(e);
    const mins = Math.max(0, toMinutes(e.end_time || e.start_time) - toMinutes(e.start_time));
    const targets = names.length > 0 ? names : [UNASSIGNED];
    targets.forEach((name) => {
      if (!byFacilitator[name]) byFacilitator[name] = { count: 0, mins: 0 };
      byFacilitator[name].count += 1;
      byFacilitator[name].mins += mins;
    });
  });

  const staffColor = (name) =>
    name === UNASSIGNED ? 'var(--text-faint)' : staffColorByIndex(staff.findIndex((s) => s.name === name));
  const doubleBooked = doubleBookedFacilitators(allEntries);

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
        <span className="summary-label">By facilitator{onToggleFacilitator ? ' · tap to filter' : ''}</span>
        <div className="summary-pills">
          {people.map(([name, v]) => {
            const active = filterStaff.includes(name);
            const conflict = doubleBooked.has(name);
            const title = conflict
              ? `${name} is double-booked${onToggleFacilitator ? ' — tap to filter' : ''}`
              : onToggleFacilitator
                ? name === UNASSIGNED ? 'Tap to show activities that still need staffing' : `Tap to filter to ${name}`
                : undefined;
            return (
              <button
                key={name}
                type="button"
                className={`summary-pill summary-staff${active ? ' active' : ''}${conflict ? ' double-booked' : ''}`}
                onClick={() => onToggleFacilitator?.(name)}
                aria-pressed={active}
                title={title}
              >
                <span className="staff-dot" style={{ background: staffColor(name) }} />
                {name} <b>{v.count}</b> · {formatMinutes(v.mins)}
                {conflict && <span className="summary-warning" aria-hidden="true">⚠</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
