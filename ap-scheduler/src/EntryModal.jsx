import { useState, useEffect } from 'react';
import { ACTIVITIES, DAYS, TIME_OPTIONS } from './constants';
import { formatTime } from './utils';

function addOneHour(t) {
  const [h, m] = t.split(':').map(Number);
  const nh = Math.min(h + 1, 21);
  return `${String(nh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normFacilitators(entry) {
  if (Array.isArray(entry?.facilitators)) return entry.facilitators;
  if (entry?.staff) return [entry.staff]; // backward-compat
  return [];
}

export default function EntryModal({ mode, entry, staff, onSave, onDuplicate, onClose }) {
  const defaultStart = entry?.start_time || TIME_OPTIONS[4]; // 9:00 AM
  const [form, setForm] = useState({
    activity: entry?.activity || ACTIVITIES[0],
    day: entry?.day || DAYS[0],
    start_time: defaultStart,
    end_time: entry?.end_time || addOneHour(defaultStart),
    group_name: entry?.group_name || '',
    facilitators: normFacilitators(entry),
    notes: entry?.notes || '',
    cancelled: entry?.cancelled || false,
  });

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleStartChange = (e) => {
    const start = e.target.value;
    setForm((f) => ({
      ...f,
      start_time: start,
      end_time: f.end_time <= start ? addOneHour(start) : f.end_time,
    }));
  };

  const toggleFacilitator = (name) => {
    setForm((f) => {
      const already = f.facilitators.includes(name);
      return {
        ...f,
        facilitators: already
          ? f.facilitators.filter((n) => n !== name)
          : [...f.facilitators, name],
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const startOptions = TIME_OPTIONS.filter((t) => t < '21:00');
  const endOptions = TIME_OPTIONS.filter((t) => t > form.start_time);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title" id="entry-modal-title">{mode === 'edit' ? 'Edit Entry' : 'Add Entry'}</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Activity
            <select value={form.activity} onChange={set('activity')}>
              {ACTIVITIES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label>
            Group Name (optional)
            <input
              type="text"
              value={form.group_name}
              onChange={set('group_name')}
              placeholder="e.g. Group A, Scouts, Smith party…"
            />
          </label>
          <label>
            Day
            <select value={form.day} onChange={set('day')}>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <div className="time-row">
            <label>
              Start Time
              <select value={form.start_time} onChange={handleStartChange}>
                {startOptions.map((t) => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </select>
            </label>
            <label>
              End Time
              <select value={form.end_time} onChange={set('end_time')}>
                {endOptions.map((t) => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="facilitator-fieldset">
            <legend>Facilitator(s)</legend>
            {staff.length === 0 && <p className="facilitator-empty">No facilitators added yet — use the Facilitators panel.</p>}
            <div className="facilitator-checks">
              {staff.map((s) => (
                <label key={s.id} className="facilitator-check-label">
                  <input
                    type="checkbox"
                    checked={form.facilitators.includes(s.name)}
                    onChange={() => toggleFacilitator(s.name)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Notes (optional)
            <input
              type="text"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Any additional info…"
            />
          </label>
          {mode === 'edit' && (
            <label className="cancelled-check-label">
              <input
                type="checkbox"
                checked={form.cancelled}
                onChange={(e) => setForm((f) => ({ ...f, cancelled: e.target.checked }))}
              />
              Mark as cancelled (kept on the schedule, shown struck-through)
            </label>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            {mode === 'edit' && onDuplicate && (
              <button type="button" className="btn-secondary" onClick={() => onDuplicate(form)}>Duplicate</button>
            )}
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
