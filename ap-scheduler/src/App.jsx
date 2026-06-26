import { useState, useEffect, useCallback, useRef } from 'react';
import WeekGrid from './WeekGrid';
import EntryModal from './EntryModal';
import StaffPanel from './StaffPanel';
import CopyModal from './CopyModal';
import TemplatePanel from './TemplatePanel';
import ActivitiesPanel, { activityColorForIndex } from './ActivitiesPanel';
import AIUploadModal from './AIUploadModal';
import SummaryBar from './SummaryBar';
import Toast from './Toast';
import PrintView from './PrintView';
import {
  fetchSchedule, addEntry, updateEntry, deleteEntry,
  fetchStaff, addStaff, deleteStaff, copyWeek,
  fetchTemplates, saveTemplate, deleteTemplate, applyTemplate,
  fetchActivities, saveActivity, updateActivity, deleteActivity,
  isShared,
} from './api';
import { getWeekStart, formatWeekStart, formatWeekLabel, addWeeks } from './utils';
import { exportICS, exportCSV } from './exporters';
import './App.css';

const currentWeek = formatWeekStart(getWeekStart(new Date()));

export default function App() {
  const [weekStart, setWeekStart] = useState(currentWeek);
  const [entries, setEntries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [modal, setModal] = useState(null);
  const [showStaff, setShowStaff] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [filterStaff, setFilterStaff] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullDay, setFullDay] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [showActivities, setShowActivities] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAIUpload, setShowAIUpload] = useState(false);
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

  const loadedWeek = useRef(null);

  const loadAll = useCallback(async () => {
    const freshWeek = loadedWeek.current !== weekStart;
    if (freshWeek) setLoading(true);
    setError('');
    try {
      const [s, e] = await Promise.all([fetchStaff(), fetchSchedule(weekStart)]);
      setStaff(s);
      setEntries(e);
      loadedWeek.current = weekStart;
    } catch {
      setError('Could not load schedule data.');
    } finally {
      if (freshWeek) setLoading(false);
    }
  }, [weekStart]);

  const loadTemplates = useCallback(async () => {
    try { setTemplates(await fetchTemplates()); }
    catch { /* templates table may not exist yet — feature stays inert */ }
  }, []);

  const loadActivities = useCallback(async () => {
    try { setActivities(await fetchActivities()); }
    catch { /* non-fatal */ }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { loadActivities(); }, [loadActivities]);

  // Refresh when the tab becomes visible again or regains focus
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) loadAll(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', loadAll);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', loadAll);
    };
  }, [loadAll]);

  // Poll every 15 s in Supabase (shared) mode so other users' changes appear
  useEffect(() => {
    if (!isShared) return;
    const id = setInterval(loadAll, 15_000);
    return () => clearInterval(id);
  }, [loadAll]);

  // Pick up changes made by other tabs when using localStorage
  useEffect(() => {
    if (isShared) return;
    const onStorage = (e) => {
      if (e.key?.startsWith('ap-scheduler:')) loadAll();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadAll]);

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
      showToast('Saved ✓');
    } catch {
      showToast('Failed to save entry.');
    }
  };

  const handleDuplicate = async (form) => {
    try {
      const { cancelled: _c, ...rest } = form;
      await addEntry({ ...rest, week_start: weekStart });
      setModal(null);
      loadAll();
      showToast('Entry duplicated.');
    } catch {
      showToast('Could not duplicate entry.');
    }
  };

  const handleExport = (kind) => {
    setExportOpen(false);
    if (!entries.length) { showToast('Nothing to export for this week.'); return; }
    if (kind === 'ics') exportICS(entries, weekStart);
    else exportCSV(entries, weekStart);
  };

  const handleAIImport = async (importedEntries) => {
    setShowAIUpload(false);
    if (!importedEntries.length) return;

    // Create any activity types the import references that don't exist yet,
    // each with a distinct colour, so imported entries are colour-coded.
    let currentActivities = activities;
    const knownNames = new Set(currentActivities.map((a) => a.name.toLowerCase()));
    const usedBgs = new Set(currentActivities.map((a) => a.bg));
    const newNames = [...new Set(importedEntries.map((e) => e.activity).filter(Boolean))]
      .filter((n) => !knownNames.has(n.toLowerCase()));
    let createdCount = 0;
    for (const name of newNames) {
      let colors;
      for (let i = currentActivities.length; ; i++) {
        const c = activityColorForIndex(i);
        if (!usedBgs.has(c.bg)) { colors = c; break; }
      }
      try {
        const activity = await saveActivity(name, colors);
        currentActivities = [...currentActivities, activity];
        usedBgs.add(colors.bg);
        createdCount++;
      } catch { /* skip on failure */ }
    }
    if (createdCount) setActivities(currentActivities);

    let count = 0;
    for (const entry of importedEntries) {
      try {
        await addEntry({ ...entry, week_start: weekStart });
        count++;
      } catch { /* skip if duplicate */ }
    }
    loadAll();
    if (!count) {
      showToast('No new entries were added (possible duplicates).');
      return;
    }
    const parts = [`Added ${count} ${count === 1 ? 'entry' : 'entries'}`];
    if (createdCount) parts.push(`created ${createdCount} new activity ${createdCount === 1 ? 'type' : 'types'}`);
    showToast(`${parts.join(' and ')} from AI import.`);
  };

  const handleAddActivity = async (name, colors) => {
    const activity = await saveActivity(name, colors);
    setActivities((prev) => [...prev, activity]);
  };

  const handleUpdateActivity = async (id, changes) => {
    await updateActivity(id, changes);
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  };

  const handleDeleteActivity = async (id) => {
    await deleteActivity(id);
    setActivities((prev) => prev.filter((a) => a.id !== id));
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
    showToast(`Removed facilitator ${member.name}`, {
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
  const activityColors = Object.fromEntries(
    activities.map((a) => [a.name, { bg: a.bg, border: a.border, text: a.text }])
  );

  useEffect(() => {
    if (!exportOpen) return undefined;
    const close = () => setExportOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [exportOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => { setMenuOpen(false); setExportOpen(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">AP</span>
            <div className="brand-text">
              <h1>AP Scheduler</h1>
              {isShared && <span className="shared-badge"><span className="shared-dot" />Live sync</span>}
            </div>
          </div>
          <div className="header-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn-icon menu-toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => { setMenuOpen((v) => !v); setExportOpen(false); }}
            >
              <span className="menu-toggle-icon">{menuOpen ? '✕' : '☰'}</span>
              <span className="menu-toggle-text">Menu</span>
            </button>
            <div className={`header-action-menu ${menuOpen ? 'open' : ''}`}>
              <button
                className="btn-icon action-print"
                title={printTitle}
                onClick={() => { setMenuOpen(false); window.print(); }}
              >
                🖨 <span className="action-text">Print</span>
              </button>
              <div className="export-wrap">
                <button className="btn-secondary" onClick={() => setExportOpen((v) => !v)} aria-haspopup="true" aria-expanded={exportOpen}>
                  Export ▾
                </button>
                {exportOpen && (
                  <div className="export-menu" role="menu">
                    <button role="menuitem" onClick={() => { setMenuOpen(false); handleExport('ics'); }}>📅 Add to calendar (.ics)</button>
                    <button role="menuitem" onClick={() => { setMenuOpen(false); handleExport('csv'); }}>📄 Download CSV</button>
                  </div>
                )}
              </div>
              <button className="btn-secondary" onClick={() => { setMenuOpen(false); setShowActivities(true); }}>Activities</button>
              <button className="btn-secondary" onClick={() => { setMenuOpen(false); setShowAIUpload(true); }}>✦ AI Import…</button>
              <button className="btn-secondary" onClick={() => { setMenuOpen(false); setCopyOpen(true); }}>⧉ Copy week…</button>
              <button className="btn-secondary" onClick={() => { setMenuOpen(false); setShowTemplates(true); }}>Templates</button>
              <button className="btn-secondary" onClick={() => { setMenuOpen(false); setShowStaff(true); }}>Facilitators</button>
            </div>
          </div>
        </div>

        <div className="week-nav">
          <div className="week-switcher">
            <button className="nav-btn" onClick={prevWeek} aria-label="Previous week">‹</button>
            <div className="week-label">
              <span className="week-range">{formatWeekLabel(weekStart)}</span>
              {isCurrentWeek && <span className="this-week-badge">This week</span>}
            </div>
            <button className="nav-btn" onClick={nextWeek} aria-label="Next week">›</button>
          </div>
          {!isCurrentWeek && <button className="btn-today" onClick={goToday}>Today</button>}

          <div className="toolbar">
            <select
              className="staff-filter"
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              title="Show only one facilitator's shifts"
            >
              <option value="">All facilitators</option>
              {staff.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <label className="toggle-label" title="Show the full 8am–9pm day instead of just busy hours">
              <input
                type="checkbox"
                checked={fullDay}
                onChange={(e) => setFullDay(e.target.checked)}
              />
              All hours
            </label>
            <button className="btn-secondary" onClick={() => setShowSummary((v) => !v)} title="Show or hide the weekly totals">
              {showSummary ? 'Hide totals' : 'Show totals'}
            </button>
          </div>
        </div>

        {filterStaff && (
          <div className="filter-active-bar">
            <span>Showing <strong>{filterStaff}</strong>'s shifts only</span>
            <button className="btn-ghost filter-clear" onClick={() => setFilterStaff('')}>✕ Clear</button>
          </div>
        )}
      </header>

      <main className="app-main">
        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            {showSummary && <SummaryBar entries={entries} staff={staff} activityColors={activityColors} />}
            <WeekGrid
              weekStart={weekStart}
              entries={entries}
              staff={staff}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isCurrentWeek={isCurrentWeek}
              fullDay={fullDay}
              filterStaff={filterStaff}
              activityColors={activityColors}
            />
          </>
        )}
      </main>

      {modal && (
        <EntryModal
          mode={modal.mode}
          entry={modal.mode === 'edit' ? modal.entry : { day: modal.day, start_time: modal.start_time }}
          staff={staff}
          activities={activities}
          weekStart={weekStart}
          onSave={handleSave}
          onDuplicate={handleDuplicate}
          onDelete={modal.mode === 'edit' ? () => { setModal(null); handleDelete(modal.entry.id); } : undefined}
          onClose={() => setModal(null)}
          onOpenFacilitators={() => { setModal(null); setShowStaff(true); }}
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

      {showActivities && (
        <ActivitiesPanel
          activities={activities}
          onAdd={handleAddActivity}
          onUpdate={handleUpdateActivity}
          onDelete={handleDeleteActivity}
          onClose={() => setShowActivities(false)}
        />
      )}

      {showAIUpload && (
        <AIUploadModal
          weekLabel={formatWeekLabel(weekStart)}
          weekStart={weekStart}
          activities={activities}
          staff={staff}
          onImport={handleAIImport}
          onClose={() => setShowAIUpload(false)}
        />
      )}

      <Toast toast={toast} onAction={runToastAction} onDismiss={dismissToast} />

      <PrintView
        entries={entries}
        weekStart={weekStart}
        filterStaff={filterStaff}
        staff={staff}
        activityColors={activityColors}
      />
    </div>
  );
}
