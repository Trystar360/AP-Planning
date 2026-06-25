import { DAYS, TIME_SLOTS, ACTIVITY_COLORS } from './constants';

export default function WeekGrid({ entries, onAdd, onEdit, onDelete }) {
  // Build lookup: day -> time_slot -> entries[]
  const grid = {};
  DAYS.forEach((d) => {
    grid[d] = {};
    TIME_SLOTS.forEach((t) => { grid[d][t] = []; });
  });
  entries.forEach((e) => {
    if (grid[e.day]?.[e.time_slot]) grid[e.day][e.time_slot].push(e);
  });

  // Find which time slots have any entries + always show a minimum set
  const activeSlots = TIME_SLOTS.filter(
    (t) => DAYS.some((d) => grid[d][t].length > 0)
  );

  return (
    <div className="week-grid-wrapper">
      <table className="week-grid">
        <thead>
          <tr>
            <th className="time-col">Time</th>
            {DAYS.map((d) => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((slot) => {
            const hasAny = DAYS.some((d) => grid[d][slot].length > 0);
            return (
              <tr key={slot} className={hasAny ? 'row-active' : 'row-empty'}>
                <td className="time-cell">{slot}</td>
                {DAYS.map((day) => (
                  <td key={day} className="day-cell" onClick={() => onAdd(day, slot)}>
                    {grid[day][slot].map((e) => {
                      const colors = ACTIVITY_COLORS[e.activity] || {};
                      return (
                        <div
                          key={e.id}
                          className="entry-chip"
                          style={{
                            background: colors.bg,
                            borderColor: colors.border,
                            color: colors.text,
                          }}
                          onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}
                        >
                          <span className="chip-activity">{e.activity}</span>
                          <span className="chip-staff">{e.staff}</span>
                          {e.notes && <span className="chip-notes">{e.notes}</span>}
                          <button
                            className="chip-delete"
                            onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
                            title="Remove"
                          >×</button>
                        </div>
                      );
                    })}
                    {grid[day][slot].length === 0 && (
                      <span className="add-hint">+</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
