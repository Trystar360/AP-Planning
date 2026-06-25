import { useState } from 'react';
import { DAYS, TIME_SLOTS, ACTIVITY_COLORS, STAFF_PALETTE } from './constants';
import { formatTime, toMinutes, durationLabel } from './utils';

function todayDayName() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long' });
}

function staffColor(name, staff) {
  const idx = staff.findIndex((s) => s.name === name);
  return STAFF_PALETTE[idx >= 0 ? idx % STAFF_PALETTE.length : 0];
}

// Map an entry's start_time to the nearest hourly grid row
function slotForEntry(e) {
  if (e.start_time) {
    const hour = `${e.start_time.slice(0, 2)}:00`;
    return TIME_SLOTS.includes(hour) ? hour : TIME_SLOTS[TIME_SLOTS.length - 1];
  }
  return e.time_slot || TIME_SLOTS[0];
}

function entryStart(e) {
  return toMinutes(e.start_time || e.time_slot || '00:00');
}
function entryEnd(e) {
  return toMinutes(e.end_time || e.start_time || e.time_slot || '00:00');
}

// Returns a Set of entry ids where the same staff member is booked for
// overlapping times on the same day (i.e. can't be in two places at once).
function findConflicts(entries) {
  const conflicts = new Set();
  const groups = {};
  entries.forEach((e) => {
    if (!e.staff) return;
    const k = `${e.staff}|${e.day}`;
    (groups[k] = groups[k] || []).push(e);
  });
  Object.values(groups).forEach((list) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (entryStart(a) < entryEnd(b) && entryStart(b) < entryEnd(a)) {
          conflicts.add(a.id);
          conflicts.add(b.id);
        }
      }
    }
  });
  return conflicts;
}

export default function WeekGrid({ entries, staff, onAdd, onEdit, onDelete, isCurrentWeek, collapseEmpty, filterStaff }) {
  const [mobileDay, setMobileDay] = useState(() => {
    const today = todayDayName();
    return DAYS.includes(today) ? today : DAYS[0];
  });

  const conflicts = findConflicts(entries);

  // Build lookup: day -> time_slot -> entries[] (sorted by start time)
  const grid = {};
  DAYS.forEach((d) => {
    grid[d] = {};
    TIME_SLOTS.forEach((t) => { grid[d][t] = []; });
  });
  entries.forEach((e) => {
    const slot = slotForEntry(e);
    if (grid[e.day]?.[slot]) grid[e.day][slot].push(e);
  });
  DAYS.forEach((d) => {
    TIME_SLOTS.forEach((t) => { grid[d][t].sort((a, b) => entryStart(a) - entryStart(b)); });
  });

  const todayName = isCurrentWeek ? todayDayName() : null;

  const visibleSlots = collapseEmpty
    ? TIME_SLOTS.filter((t) => DAYS.some((d) => grid[d][t].length > 0))
    : TIME_SLOTS;

  const dayEntryCount = (day) => TIME_SLOTS.reduce((n, t) => n + grid[day][t].length, 0);

  const renderChip = (e) => {
    const colors = ACTIVITY_COLORS[e.activity] || {};
    const dot = staffColor(e.staff, staff);
    const timeRange = e.start_time && e.end_time
      ? `${formatTime(e.start_time)} – ${formatTime(e.end_time)}`
      : e.time_slot ? formatTime(e.time_slot) : '';
    const dur = durationLabel(e.start_time, e.end_time);
    const isConflict = conflicts.has(e.id);
    const isDimmed = filterStaff && e.staff !== filterStaff;
    return (
      <div
        key={e.id}
        className={`entry-chip${isConflict ? ' conflict' : ''}${isDimmed ? ' dimmed' : ''}`}
        style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${e.activity}${e.group_name ? `, ${e.group_name}` : ''}, ${timeRange}, ${e.staff}`}
        onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); onEdit(e); }
        }}
      >
        <span className="chip-activity">
          {isConflict && <span className="chip-warning" title={`${e.staff} is double-booked at this time`}>⚠</span>}
          {e.activity}
        </span>
        {e.group_name && <span className="chip-group">{e.group_name}</span>}
        {timeRange && (
          <span className="chip-time">
            {timeRange}{dur && <span className="chip-duration"> · {dur}</span>}
          </span>
        )}
        <span className="chip-staff">
          <span className="staff-dot" style={{ background: dot }} />
          {e.staff || <em>Unassigned</em>}
        </span>
        {e.notes && <span className="chip-notes">{e.notes}</span>}
        <button
          className="chip-delete"
          onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
          title="Remove"
          aria-label={`Remove ${e.activity}`}
        >×</button>
      </div>
    );
  };

  return (
    <div className="week-grid-outer">
      {conflicts.size > 0 && (
        <div className="conflict-banner" role="status">
          ⚠ {conflicts.size} {conflicts.size === 1 ? 'activity has' : 'activities have'} a staff double-booking this week — check the highlighted entries.
        </div>
      )}

      {/* Mobile day tabs */}
      <div className="day-tabs">
        {DAYS.map((d) => {
          const count = dayEntryCount(d);
          return (
            <button
              key={d}
              className={`day-tab${mobileDay === d ? ' active' : ''}${d === todayName ? ' today-tab' : ''}`}
              onClick={() => setMobileDay(d)}
            >
              <span className="day-tab-name">{d.slice(0, 3)}</span>
              {count > 0 && <span className="day-tab-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="week-grid-wrapper">
        <table className="week-grid">
          <thead>
            <tr>
              <th className="time-col">Time</th>
              {DAYS.map((d) => (
                <th
                  key={d}
                  className={`day-th${d === todayName ? ' today-col' : ''}${d === mobileDay ? ' mobile-visible' : ' mobile-hidden'}`}
                >
                  {d}
                  {d === todayName && <span className="today-dot" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleSlots.map((slot) => {
              const hasAny = DAYS.some((d) => grid[d][slot].length > 0);
              return (
                <tr key={slot} className={hasAny ? 'row-active' : 'row-empty'}>
                  <td className="time-cell">{formatTime(slot)}</td>
                  {DAYS.map((d) => (
                    <td
                      key={d}
                      className={`day-cell${d === todayName ? ' today-col' : ''}${d === mobileDay ? ' mobile-visible' : ' mobile-hidden'}`}
                      onClick={() => onAdd(d, slot)}
                    >
                      {grid[d][slot].map(renderChip)}
                      <button
                        className="add-cell"
                        aria-label={`Add activity on ${d} at ${formatTime(slot)}`}
                        onClick={(ev) => { ev.stopPropagation(); onAdd(d, slot); }}
                      >+</button>
                    </td>
                  ))}
                </tr>
              );
            })}
            {visibleSlots.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-week-msg">
                  No activities scheduled yet — tap any time slot to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
