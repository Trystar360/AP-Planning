import { useState, useEffect } from 'react';
import { ACTIVITIES, DAYS, TIME_SLOTS } from './constants';

export default function EntryModal({ mode, entry, staff, onSave, onClose }) {
  const [form, setForm] = useState({
    activity: entry?.activity || ACTIVITIES[0],
    day: entry?.day || DAYS[0],
    time_slot: entry?.time_slot || TIME_SLOTS[0],
    staff: entry?.staff || (staff[0]?.name ?? ''),
    notes: entry?.notes || '',
  });

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

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
            Day
            <select value={form.day} onChange={set('day')}>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label>
            Time
            <select value={form.time_slot} onChange={set('time_slot')}>
              {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
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
