import { useState, useEffect, useCallback, useRef } from 'react';
import WeekGrid from './WeekGrid';
import EntryModal from './EntryModal';
import StaffPanel from './StaffPanel';
import CopyModal from './CopyModal';
import TemplatePanel from './TemplatePanel';
import SummaryBar from './SummaryBar';
import Toast from './Toast';
import {
  fetchSchedule, addEntry, updateEntry, deleteEntry,
  fetchStaff, addStaff, deleteStaff, copyWeek,
  fetchTemplates, saveTemplate, deleteTemplate, applyTemplate,
  isShared,
} from './api';
import { getMonday, formatWeekStart, formatWeekLabel, addWeeks } from './utils';
import { ACTIVITY_COLORS, ACTIVITIES } from './constants';
import './App.css';

const currentWeek = formatWeekStart(getMonday(new Date()));

export default function App() {
  const [weekStart, setWeekStart] = useState(currentWeek);
  const [entries, setEntries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [modal, setModal] = useState(null);
  const [showStaff, setShowStaff] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [filterStaff, setFilterStaff] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapseEmpty, setCollapseEmpty] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  const showToast = useCallback((message, action = null) => {
    clearTimeout(toastTimer.current);
    setToast({ message, ...action });
    toastTimer.current = setTimeout(() => setToast(null), action?.actionLabel ? 7000 : 4000);
  }, []);
  const dismissToast = () => { clearTimeout(toastTimer.current); setToast(null); };
  const runToastAction = async () => {
    const action = toast?.onAction;
    dismissToast();
    if (action) await action();
  };

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

  const loadTemplates = useCallback(async () => {
    try { setTemplates(await fetchTemplates()); }
    catch { /* templates table may not exist yet — feature stays inert */ }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

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
      showToast('Failed to save entry.');
    }
  };

  const handleDelete = async (id) => {
    const entry = entries.find((e) => e.id === id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteEntry(id);
    } catch {
      showToast('Could not remove entry.');
      loadAll();
      return;
    }
    if (!entry) return;
    showToast('Entry removed', {
      actionLabel: 'Undo',
      onAction: async () => {
        const { id: _id, created_at: _c, ...rest } = entry;
        await addEntry(rest);
        loadAll();
      },
    });
  };

  const handleAddStaff = async (name) => {
    const member = await addStaff(name);
    setStaff((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleDeleteStaff = async (id) => {
    const member = staff.find((s) => s.id === id);
    setStaff((prev) => prev.filter((s) => s.id !== id));
    if (filterStaff && member && member.name === filterStaff) setFilterStaff('');
    await deleteStaff(id);
    if (!member) return;
    showToast(`Removed ${member.name}`, {
      actionLabel: 'Undo',
      onAction: async () => {
        try {
          const m = await addStaff(member.name);
          setStaff((prev) => [...prev, m].sort((a, b) => a.name.localeCompare(b.name)));
        } catch { loadAll(); }
      },
    });
  };

  const handleCopy = async ({ scope, toWeek }) => {
    setCopyOpen(false);
    const opts = scope === 'all' ? {} : { day: scope };
    const label = formatWeekLabel(toWeek);
    try {
      const count = await copyWeek(weekStart, toWeek, opts);
      showToast(count
        ? `Copied ${count} ${count === 1 ? 'entry' : 'entries'} to ${label}.`
        : `Nothing new to copy — ${label} already has these.`);
    } catch {
      showToast('Could not copy the schedule.');
    }
  };

  const handleSaveTemplate = async (name) => {
    const cleaned = entries.map(({ id: _i, week_start: _w, created_at: _c, ...rest }) => rest);
    await saveTemplate(name, cleaned);
    await loadTemplates();
    showToast('Template saved.');
  };

  const handleApplyTemplate = async (id) => {
    setShowTemplates(false);
    try {
      const count = await applyTemplate(id, weekStart);
      loadAll();
      showToast(count
        ? `Added ${count} ${count === 1 ? 'entry' : 'entries'} from template.`
        : 'Nothing new — those activities are already scheduled.');
    } catch {
      showToast('Could not apply the template.');
    }
  };

  const handleDeleteTemplate = async (id) => {
    await deleteTemplate(id);
    loadTemplates();
  };

  const prevWeek = () => setWeekStart((w) => addWeeks(w, -1));
  const nextWeek = () => setWeekStart((w) => addWeeks(w, 1));
  const goToday = () => setWeekStart(currentWeek);

  const isCurrentWeek = weekStart === currentWeek;
  const printTitle = filterStaff ? `Print ${filterStaff}'s rota` : 'Print schedule';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>AP Scheduler {isShared && <span className="shared-badge">● Live</span>}</h1>
          <div className="header-actions">
            <button className="btn-icon" title={printTitle} onClick={() => window.print()}>🖨</button>
            <button className="btn-secondary" onClick={() => setShowTemplates(true)}>Templates</button>
            <button className="btn-secondary" onClick={() => setShowStaff(true)}>Team</button>
          </div>
        </div>

        <div className="week-nav">
          <button className="nav-btn" onClick={prevWeek} aria-label="Previous week">‹</button>
          <div className="week-label">
            <span className="week-range">{formatWeekLabel(weekStart)}</span>
            {isCurrentWeek && <span className="this-week-badge">This week</span>}
          </div>
          <button className="nav-btn" onClick={nextWeek} aria-label="Next week">›</button>
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
            <select
              className="staff-filter"
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              title="Show only one team member's shifts"
            >
              <option value="">All team</option>
              {staff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={collapseEmpty}
                onChange={(e) => setCollapseEmpty(e.target.checked)}
              />
              Hide empty
            </label>
            <button className="btn-secondary" onClick={() => setShowSummary((v) => !v)}>
              {showSummary ? 'Hide summary' : 'Summary'}
            </button>
            <button className="btn-copy" onClick={() => setCopyOpen(true)} title="Copy this week's schedule elsewhere">
              Copy…
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {error && <div className="error-banner">{error}</div>}
        {filterStaff && (
          <div className="filter-banner">
            Showing <strong>{filterStaff}</strong>'s shifts.
            <button className="btn-ghost" onClick={() => setFilterStaff('')}>Show all</button>
          </div>
        )}
        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            {showSummary && <SummaryBar entries={entries} staff={staff} />}
            <WeekGrid
              entries={entries}
              staff={staff}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isCurrentWeek={isCurrentWeek}
              collapseEmpty={collapseEmpty}
              filterStaff={filterStaff}
            />
          </>
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

      {copyOpen && (
        <CopyModal
          weekStart={weekStart}
          onCopy={handleCopy}
          onClose={() => setCopyOpen(false)}
        />
      )}

      {showTemplates && (
        <TemplatePanel
          templates={templates}
          weekEntryCount={entries.length}
          weekLabel={formatWeekLabel(weekStart)}
          onSave={handleSaveTemplate}
          onApply={handleApplyTemplate}
          onDelete={handleDeleteTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      <Toast toast={toast} onAction={runToastAction} onDismiss={dismissToast} />
    </div>
  );
}
