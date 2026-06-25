import { useState, useEffect, useCallback } from 'react';
import WeekGrid from './WeekGrid';
import EntryModal from './EntryModal';
import StaffPanel from './StaffPanel';
import { fetchSchedule, addEntry, updateEntry, deleteEntry, fetchStaff, addStaff, deleteStaff, copyWeek, isShared } from './api';
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
  const [collapseEmpty, setCollapseEmpty] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, e] = await Promise.all([fetchStaff(), fetchSchedule(weekStart)]);
      setStaff(s);
      setEntries(e);
    } catch {
      setError('Could not load schedule data.');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAdd = (day, start_time) => setModal({ mode: 'add', day, start_time });
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

  const handleCopyWeek = async () => {
    const nextWeek = addWeeks(weekStart, 1);
    const nextLabel = formatWeekLabel(nextWeek);
    if (!confirm(`Copy this week's schedule to ${nextLabel}?\n\nExisting entries in that week won't be overwritten.`)) return;
    const count = await copyWeek(weekStart, nextWeek);
    if (count === 0) {
      alert('Nothing to copy — the next week already has all the same entries.');
    } else {
      alert(`Copied ${count} ${count === 1 ? 'entry' : 'entries'} to ${nextLabel}.`);
    }
  };

  const prevWeek = () => setWeekStart((w) => addWeeks(w, -1));
  const nextWeek = () => setWeekStart((w) => addWeeks(w, 1));
  const goToday = () => setWeekStart(currentWeek);

  const isCurrentWeek = weekStart === currentWeek;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>AP Scheduler {isShared && <span className="shared-badge">● Live</span>}</h1>
          <div className="header-actions">
            <button className="btn-icon" title="Print schedule" onClick={() => window.print()}>🖨</button>
            <button className="btn-secondary" onClick={() => setShowStaff(true)}>Team</button>
          </div>
        </div>

        <div className="week-nav">
          <button className="nav-btn" onClick={prevWeek}>‹</button>
          <div className="week-label">
            <span className="week-range">{formatWeekLabel(weekStart)}</span>
            {isCurrentWeek && <span className="this-week-badge">This week</span>}
          </div>
          <button className="nav-btn" onClick={nextWeek}>›</button>
          {!isCurrentWeek && <button className="btn-ghost" onClick={goToday}>Today</button>}
        </div>

        <div className="header-controls">
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
          <div className="toolbar">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={collapseEmpty}
                onChange={(e) => setCollapseEmpty(e.target.checked)}
              />
              Hide empty slots
            </label>
            <button className="btn-copy" onClick={handleCopyWeek} title="Copy this week's schedule to next week">
              Copy week →
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <WeekGrid
            entries={entries}
            staff={staff}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isCurrentWeek={isCurrentWeek}
            collapseEmpty={collapseEmpty}
          />
        )}
      </main>

      {modal && (
        <EntryModal
          mode={modal.mode}
          entry={modal.mode === 'edit' ? modal.entry : { day: modal.day, start_time: modal.start_time }}
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
