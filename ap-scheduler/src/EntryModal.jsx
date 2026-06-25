import { useState, useEffect } from 'react';
import { ACTIVITIES, DAYS, TIME_OPTIONS } from './constants';
import { formatTime } from './utils';

function addOneHour(t) {
  const [h, m] = t.split(':').map(Number);
  const nh = Math.min(h + 1, 21);
  return `${String(nh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function EntryModal({ mode, entry, staff, onSave, onClose }) {
  const defaultStart = entry?.start_time || TIME_OPTIONS[4]; // 9:00 AM
  const [form, setForm] = useState({
    activity: entry?.activity || ACTIVITIES[0],
    day: entry?.day || DAYS[0],
    start_time: defaultStart,
    end_time: entry?.end_time || addOneHour(defaultStart),
    group_name: entry?.group_name || '',
    staff: entry?.staff || (staff[0]?.name ?? ''),
    notes: entry?.notes || '',
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const startOptions = TIME_OPTIONS.filter((t) => t < '21:00');
  const endOptions = TIME_OPTIONS.filter((t) => t > form.start_time);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{mode === 'edit' ? 'Edit Entry' : 'Add Entry'}</h2>
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
          <label>
            Staff Member
            <select value={form.staff} onChange={set('staff')}>
              {staff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </label>
          <label>
            Notes (optional)
            <input
              type="text"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Any additional info…"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
