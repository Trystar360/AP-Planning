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

function getFacilitators(e) {
  if (Array.isArray(e.facilitators)) return e.facilitators;
  if (e.staff) return [e.staff];
  return [];
}

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
  const todayName = isCurrentWeek ? todayDayName() : null;

  // Determine visible slots
  const occupiedSlots = new Set();
  entries.forEach((e) => {
    const startMin = entryStart(e);
    const endMin = entryEnd(e);
    TIME_SLOTS.forEach((slot) => {
      const sm = toMinutes(slot);
      if (sm < endMin && sm + 60 > startMin) occupiedSlots.add(slot);
    });
  });
  const visibleSlots = collapseEmpty ? TIME_SLOTS.filter((t) => occupiedSlots.has(t)) : TIME_SLOTS;

  // Build chip placement: each entry sits in ONE cell, spanning N rows.
  // chipMap["day|slot"] = [{ entry, span }]
  // consumed = set of "day|slot" cells skipped because a spanning entry covers them.
  const chipMap = {};
  const consumed = new Set();

  [...entries]
    .sort((a, b) => entryStart(a) - entryStart(b))
    .forEach((e) => {
      if (!DAYS.includes(e.day)) return;
      const startMin = entryStart(e);
      const endMin = entryEnd(e);
      const covered = visibleSlots.filter((s) => {
        const sm = toMinutes(s);
        return sm < endMin && sm + 60 > startMin;
      });
      if (!covered.length) return;

      const key = `${e.day}|${covered[0]}`;
      if (!chipMap[key]) chipMap[key] = [];
      const subsequent = covered.slice(1);
      const canSpan = subsequent.every((s) => !consumed.has(`${e.day}|${s}`));
      const span = canSpan ? covered.length : 1;
      chipMap[key].push({ entry: e, span });
      if (canSpan) subsequent.forEach((s) => consumed.add(`${e.day}|${s}`));
    });

  const dayEntryCount = (day) => {
    const ids = new Set();
    visibleSlots.forEach((t) => (chipMap[`${day}|${t}`] || []).forEach(({ entry }) => ids.add(entry.id)));
    return ids.size;
  };

  const renderChip = (e, fill) => {
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
        key={e.id}
        className={`entry-chip${fill ? ' chip-fill' : ''}${isConflict ? ' conflict' : ''}${isDimmed ? ' dimmed' : ''}`}
        style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${e.activity}${e.group_name ? `, ${e.group_name}` : ''}, ${timeRange}, ${facilitators.join(', ') || 'Unassigned'}`}
        onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); onEdit(e); }
        }}
      >
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
          ⚠ {conflicts.size} {conflicts.size === 1 ? 'activity has' : 'activities have'} a facilitator double-booking this week — check the highlighted entries.
        </div>
      )}

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
              const hasAny = DAYS.some((d) => {
                const k = `${d}|${slot}`;
                return !consumed.has(k) && (chipMap[k]?.length || 0) > 0;
              });
              return (
                <tr key={slot} className={hasAny ? 'row-active' : 'row-empty'}>
                  <td className="time-cell">{formatTime(slot)}</td>
                  {DAYS.map((d) => {
                    const cellKey = `${d}|${slot}`;
                    if (consumed.has(cellKey)) return null;

                    const chips = chipMap[cellKey] || [];
                    const rowSpan = chips.length ? Math.max(...chips.map((c) => c.span)) : 1;
                    const singleFill = chips.length === 1 && rowSpan > 1;

                    return (
                      <td
                        key={d}
                        rowSpan={rowSpan > 1 ? rowSpan : undefined}
                        className={`day-cell${rowSpan > 1 ? ' spanning-cell' : ''}${d === todayName ? ' today-col' : ''}${d === mobileDay ? ' mobile-visible' : ' mobile-hidden'}`}
                        onClick={() => onAdd(d, slot)}
                      >
                        <div className="cell-inner">
                          {chips.map(({ entry: e, span }) => renderChip(e, singleFill && span === rowSpan))}
                          <button
                            className="add-cell"
                            aria-label={`Add activity on ${d} at ${formatTime(slot)}`}
                            onClick={(ev) => { ev.stopPropagation(); onAdd(d, slot); }}
                          >+</button>
                        </div>
                      </td>
                    );
                  })}
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
