import { useState, useEffect, useCallback } from 'react';
import WeekGrid from './WeekGrid';
import EntryModal from './EntryModal';
import StaffPanel from './StaffPanel';
import { fetchSchedule, addEntry, updateEntry, deleteEntry, fetchStaff, addStaff, deleteStaff } from './api';
import { getMonday, formatWeekStart, formatWeekLabel, addWeeks } from './utils';
import { ACTIVITY_COLORS, ACTIVITIES } from './constants';
import './App.css';

const currentWeek = formatWeekStart(getMonday(new Date()));

export default function App() {
  const [weekStart, setWeekStart] = useState(currentWeek);
  const [entries, setEntries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [modal, setModal] = useState(null);
  const [showStaff, setShowStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, e] = await Promise.all([fetchStaff(), fetchSchedule(weekStart)]);
      setStaff(s);
      setEntries(e);
    } catch {
      setError('Could not connect to server. Make sure the backend is running on port 3001.');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAdd = (day, time_slot) => setModal({ mode: 'add', day, time_slot });
  const handleEdit = (entry) => setModal({ mode: 'edit', entry });

  const handleSave = async (form) => {
    try {
      if (modal.mode === 'add') {
        await addEntry({ ...form, week_start: weekStart });
      } else {
        await updateEntry(modal.entry.id, form);
      }
      setModal(null);
      loadAll();
    } catch {
      alert('Failed to save entry.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this entry?')) return;
    await deleteEntry(id);
    loadAll();
  };

  const handleAddStaff = async (name) => {
    const member = await addStaff(name);
    setStaff((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleDeleteStaff = async (id) => {
    if (!confirm('Remove this team member?')) return;
    await deleteStaff(id);
    setStaff((prev) => prev.filter((s) => s.id !== id));
  };

  const prevWeek = () => setWeekStart((w) => addWeeks(w, -1));
  const nextWeek = () => setWeekStart((w) => addWeeks(w, 1));
  const goToday = () => setWeekStart(currentWeek);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>AP Activity Scheduler</h1>
          <button className="btn-secondary" onClick={() => setShowStaff(true)}>Manage Team</button>
        </div>

        <div className="week-nav">
          <button className="nav-btn" onClick={prevWeek}>‹ Prev</button>
          <div className="week-label">
            <span className="week-range">{formatWeekLabel(weekStart)}</span>
            {weekStart === currentWeek && <span className="this-week-badge">This Week</span>}
          </div>
          <button className="nav-btn" onClick={nextWeek}>Next ›</button>
          {weekStart !== currentWeek && (
            <button className="btn-ghost" onClick={goToday}>Today</button>
          )}
        </div>

        <div className="legend">
          {ACTIVITIES.map((a) => {
            const c = ACTIVITY_COLORS[a];
            return (
              <span key={a} className="legend-item" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                {a}
              </span>
            );
          })}
        </div>
      </header>

      <main className="app-main">
        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <WeekGrid
            entries={entries}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </main>

      {modal && (
        <EntryModal
          entry={modal.mode === 'edit' ? modal.entry : { day: modal.day, time_slot: modal.time_slot }}
          staff={staff}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {showStaff && (
        <StaffPanel
          staff={staff}
          onAdd={handleAddStaff}
          onDelete={handleDeleteStaff}
          onClose={() => setShowStaff(false)}
        />
      )}
    </div>
  );
}
