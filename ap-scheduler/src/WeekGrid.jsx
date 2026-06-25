import { useState } from 'react';
import { DAYS, TIME_SLOTS, ACTIVITY_COLORS, STAFF_PALETTE } from './constants';

function todayDayName() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long' });
}

function staffColor(name, staff) {
  const idx = staff.findIndex((s) => s.name === name);
  return STAFF_PALETTE[idx >= 0 ? idx % STAFF_PALETTE.length : 0];
}

export default function WeekGrid({ entries, staff, onAdd, onEdit, onDelete, isCurrentWeek, collapseEmpty }) {
  const [mobileDay, setMobileDay] = useState(() => {
    const today = todayDayName();
    return DAYS.includes(today) ? today : DAYS[0];
  });

  // Build lookup: day -> time_slot -> entries[]
  const grid = {};
  DAYS.forEach((d) => {
    grid[d] = {};
    TIME_SLOTS.forEach((t) => { grid[d][t] = []; });
  });
  entries.forEach((e) => {
    if (grid[e.day]?.[e.time_slot]) grid[e.day][e.time_slot].push(e);
  });

  const todayName = isCurrentWeek ? todayDayName() : null;

  const visibleSlots = collapseEmpty
    ? TIME_SLOTS.filter((t) => DAYS.some((d) => grid[d][t].length > 0))
    : TIME_SLOTS;

  const dayEntryCount = (day) => TIME_SLOTS.reduce((n, t) => n + grid[day][t].length, 0);

  const renderChip = (e) => {
    const colors = ACTIVITY_COLORS[e.activity] || {};
    const dot = staffColor(e.staff, staff);
    return (
      <div
        key={e.id}
        className="entry-chip"
        style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
        onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}
      >
        <span className="chip-activity">{e.activity}</span>
        <span className="chip-staff">
          <span className="staff-dot" style={{ background: dot }} />
          {e.staff}
        </span>
        {e.notes && <span className="chip-notes">{e.notes}</span>}
        <button
          className="chip-delete"
          onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
          title="Remove"
          aria-label="Remove entry"
        >×</button>
      </div>
    );
  };

  const renderCell = (day, slot) => (
    <td
      key={day}
      className={`day-cell${day === todayName ? ' today-col' : ''}`}
      onClick={() => onAdd(day, slot)}
    >
      {grid[day][slot].map(renderChip)}
      {grid[day][slot].length === 0 && <span className="add-hint">+</span>}
    </td>
  );

  return (
    <div className="week-grid-outer">
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
              {/* Desktop: all days. Mobile: selected day only (via CSS). */}
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
                  <td className="time-cell">{slot}</td>
                  {DAYS.map((d) => (
                    <td
                      key={d}
                      className={`day-cell${d === todayName ? ' today-col' : ''}${d === mobileDay ? ' mobile-visible' : ' mobile-hidden'}`}
                      onClick={() => onAdd(d, slot)}
                    >
                      {grid[d][slot].map(renderChip)}
                      {grid[d][slot].length === 0 && <span className="add-hint">+</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
            {visibleSlots.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-week-msg">
                  No activities scheduled yet — click any time slot to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
