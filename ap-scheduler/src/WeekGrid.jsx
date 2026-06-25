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

function entryStart(e) {
  return toMinutes(e.start_time || e.time_slot || '00:00');
}
function entryEnd(e) {
  return toMinutes(e.end_time || e.start_time || e.time_slot || '00:00');
}

// Normalise facilitators — handles old `staff` string field for backward compat
function getFacilitators(e) {
  if (Array.isArray(e.facilitators)) return e.facilitators;
  if (e.staff) return [e.staff];
  return [];
}

// Returns a Set of entry ids where a facilitator is double-booked on the same day.
function findConflicts(entries) {
  const conflicts = new Set();
  const groups = {};
  entries.forEach((e) => {
    getFacilitators(e).forEach((name) => {
      const k = `${name}|${e.day}`;
      (groups[k] = groups[k] || []).push(e);
    });
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

  // Build lookup: day -> time_slot -> { entry, isContinuation }[]
  // An entry appears in every TIME_SLOT row it covers.
  const grid = {};
  DAYS.forEach((d) => {
    grid[d] = {};
    TIME_SLOTS.forEach((t) => { grid[d][t] = []; });
  });

  entries.forEach((e) => {
    const startMin = entryStart(e);
    const endMin = entryEnd(e);
    TIME_SLOTS.forEach((slot) => {
      const slotMin = toMinutes(slot);
      const nextSlotMin = slotMin + 60;
      if (slotMin < endMin && nextSlotMin > startMin) {
        if (grid[e.day]?.[slot]) {
          grid[e.day][slot].push({ entry: e, isContinuation: slotMin > startMin });
        }
      }
    });
  });

  // Sort within each slot by start time (first-row chips first)
  DAYS.forEach((d) => {
    TIME_SLOTS.forEach((t) => {
      grid[d][t].sort((a, b) => entryStart(a.entry) - entryStart(b.entry));
    });
  });

  const todayName = isCurrentWeek ? todayDayName() : null;

  const visibleSlots = collapseEmpty
    ? TIME_SLOTS.filter((t) => DAYS.some((d) => grid[d][t].length > 0))
    : TIME_SLOTS;

  const dayEntryCount = (day) => new Set(
    TIME_SLOTS.flatMap((t) => grid[day][t].map((r) => r.entry.id))
  ).size;

  const renderChip = ({ entry: e, isContinuation }) => {
    const colors = ACTIVITY_COLORS[e.activity] || {};
    const facilitators = getFacilitators(e);
    const timeRange = e.start_time && e.end_time
      ? `${formatTime(e.start_time)} – ${formatTime(e.end_time)}`
      : e.time_slot ? formatTime(e.time_slot) : '';
    const dur = durationLabel(e.start_time, e.end_time);
    const isConflict = conflicts.has(e.id);
    const isDimmed = filterStaff && !facilitators.includes(filterStaff);

    return (
      <div
        key={`${e.id}-${isContinuation ? 'cont' : 'start'}`}
        className={`entry-chip${isContinuation ? ' chip-continuation' : ''}${isConflict ? ' conflict' : ''}${isDimmed ? ' dimmed' : ''}`}
        style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${e.activity}${e.group_name ? `, ${e.group_name}` : ''}, ${timeRange}, ${facilitators.join(', ') || 'Unassigned'}`}
        onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); onEdit(e); }
        }}
      >
        {!isContinuation && (
          <>
            <span className="chip-activity">
              {isConflict && <span className="chip-warning" title="A facilitator is double-booked at this time">⚠</span>}
              {e.activity}
            </span>
            {e.group_name && <span className="chip-group">{e.group_name}</span>}
            {timeRange && (
              <span className="chip-time">
                {timeRange}{dur && <span className="chip-duration"> · {dur}</span>}
              </span>
            )}
          </>
        )}
        {isContinuation && (
          <span className="chip-activity chip-cont-label">
            {isConflict && <span className="chip-warning" title="A facilitator is double-booked at this time">⚠</span>}
            ↕ {e.activity}
          </span>
        )}
        <span className="chip-staff">
          {facilitators.length > 0
            ? facilitators.map((name) => (
                <span key={name} className="chip-facilitator">
                  <span className="staff-dot" style={{ background: staffColor(name, staff) }} />
                  {name}
                </span>
              ))
            : <em>Unassigned</em>}
        </span>
        {!isContinuation && e.notes && <span className="chip-notes">{e.notes}</span>}
        {!isContinuation && (
          <button
            className="chip-delete"
            onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
            title="Remove"
            aria-label={`Remove ${e.activity}`}
          >×</button>
        )}
      </div>
    );
  };

  return (
    <div className="week-grid-outer">
      {conflicts.size > 0 && (
        <div className="conflict-banner" role="status">
          ⚠ {conflicts.size} {conflicts.size === 1 ? 'activity has' : 'activities have'} a facilitator double-booking this week — check the highlighted entries.
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
