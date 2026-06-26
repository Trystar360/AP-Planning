import { useState, useEffect, useRef } from 'react';
import { DAYS, ACTIVITY_COLORS as DEFAULT_ACTIVITY_COLORS, STAFF_PALETTE } from './constants';
import { formatTime, toMinutes, durationLabel, minutesToHHMM, roundToQuarter, getDayDate, ordinal } from './utils';

const HOUR_PX = 60;
const DAY_MIN = 8 * 60;
const DAY_MAX = 21 * 60;
const MIN_CHIP_PX = 26;

function todayDayName() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long' });
}
function staffColor(name, staff) {
  const idx = staff.findIndex((s) => s.name === name);
  return STAFF_PALETTE[idx >= 0 ? idx % STAFF_PALETTE.length : 0];
}
function entryStart(e) { return toMinutes(e.start_time || e.time_slot || '00:00'); }
function entryEnd(e) {
  const end = toMinutes(e.end_time || '');
  return end > entryStart(e) ? end : entryStart(e) + 30;
}
function getFacilitators(e) {
  if (Array.isArray(e.facilitators)) return e.facilitators;
  if (e.staff) return [e.staff];
  return [];
}

function findConflicts(entries) {
  const conflicts = new Set();
  const groups = {};
  entries.filter((e) => !e.cancelled).forEach((e) => {
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
          conflicts.add(a.id); conflicts.add(b.id);
        }
      }
    }
  });
  return conflicts;
}

function packLanes(dayEntries) {
  const events = [...dayEntries].sort((a, b) => entryStart(a) - entryStart(b) || entryEnd(a) - entryEnd(b));
  const placements = [];
  let cluster = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    if (!cluster.length) return;
    const lanes = Math.max(...cluster.map((p) => p.lane)) + 1;
    cluster.forEach((p) => { p.lanes = lanes; });
    placements.push(...cluster);
    cluster = [];
  };
  events.forEach((e) => {
    if (entryStart(e) >= clusterEnd) flush();
    const used = new Set(cluster.filter((p) => entryEnd(p.entry) > entryStart(e)).map((p) => p.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ entry: e, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, entryEnd(e));
  });
  flush();
  return placements;
}

export default function WeekGrid({ weekStart, entries, staff, onAdd, onEdit, onDelete, isCurrentWeek, fullDay, filterStaff, activityColors: activityColorsProp }) {
  const ACTIVITY_COLORS = activityColorsProp && Object.keys(activityColorsProp).length ? activityColorsProp : DEFAULT_ACTIVITY_COLORS;
  const [mobileDay, setMobileDayRaw] = useState(() => {
    try {
      const saved = localStorage.getItem('ap:last-day');
      if (saved && DAYS.includes(saved)) return saved;
    } catch {}
    const today = todayDayName();
    return DAYS.includes(today) ? today : DAYS[0];
  });

  const setMobileDay = (day) => {
    setMobileDayRaw(day);
    try { localStorage.setItem('ap:last-day', day); } catch {}
  };
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  );
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    try { return !localStorage.getItem('ap:swipe-hint-seen'); }
    catch { return false; }
  });
  const touch = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    const t = setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); }, 60000);
    return () => clearInterval(t);
  }, []);

  const dismissSwipeHint = () => {
    setShowSwipeHint(false);
    try { localStorage.setItem('ap:swipe-hint-seen', '1'); } catch {}
  };

  const conflicts = findConflicts(entries);
  const conflictDays = new Set(entries.filter((e) => conflicts.has(e.id)).map((e) => e.day));
  const todayName = isCurrentWeek ? todayDayName() : null;
  const visibleDays = isMobile ? [mobileDay] : DAYS;

  let winStart = DAY_MIN, winEnd = DAY_MAX;
  if (!entries.length) {
    winStart = 9 * 60; winEnd = 17 * 60;
  } else if (!fullDay) {
    const starts = entries.map(entryStart);
    const ends = entries.map(entryEnd);
    winStart = Math.max(DAY_MIN, Math.floor(Math.min(...starts) / 60) * 60);
    winEnd = Math.min(DAY_MAX, Math.ceil(Math.max(...ends) / 60) * 60);
    if (winEnd - winStart < 120) winEnd = Math.min(DAY_MAX, winStart + 120);
  }
  const winMins = winEnd - winStart;
  const bodyHeight = (winMins / 60) * HOUR_PX;
  const hourLabels = [];
  for (let m = winStart; m <= winEnd; m += 60) hourLabels.push(m);

  const yFor = (mins) => ((Math.max(winStart, Math.min(winEnd, mins)) - winStart) / 60) * HOUR_PX;

  const dayEntryCount = (day) => entries.filter((e) => e.day === day && !e.cancelled).length;

  // Up to 3 unique activity colours for the week strip dots
  const dayActivityColors = (day) =>
    [...new Set(entries.filter((e) => e.day === day && !e.cancelled).map((e) => e.activity))]
      .slice(0, 3)
      .map((a) => ACTIVITY_COLORS[a]?.bg || '#94a3b8');

  const handleColumnClick = (day, ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    const mins = roundToQuarter(winStart + (y / HOUR_PX) * 60);
    const clamped = Math.max(winStart, Math.min(winEnd - 15, mins));
    onAdd(day, minutesToHHMM(clamped));
  };

  const onTouchStart = (e) => {
    if (!isMobile || e.touches.length !== 1) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!isMobile || !touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const idx = DAYS.indexOf(mobileDay);
      const next = dx < 0 ? idx + 1 : idx - 1;
      if (next >= 0 && next < DAYS.length) {
        setMobileDay(DAYS[next]);
        dismissSwipeHint();
      }
    }
  };

  const renderChip = (e, lane, lanes) => {
    const colors = ACTIVITY_COLORS[e.activity] || {};
    const facilitators = getFacilitators(e);
    const top = yFor(entryStart(e));
    const height = Math.max(MIN_CHIP_PX, yFor(entryEnd(e)) - top);
    const width = `calc(${100 / lanes}% - 4px)`;
    const left = `calc(${(100 / lanes) * lane}% + 2px)`;
    const timeRange = e.start_time && e.end_time
      ? `${formatTime(e.start_time)} – ${formatTime(e.end_time)}`
      : e.time_slot ? formatTime(e.time_slot) : '';
    const dur = durationLabel(e.start_time, e.end_time);
    const isConflict = conflicts.has(e.id);
    const isDimmed = filterStaff && !facilitators.includes(filterStaff);
    const compact = height < 44;
    const tooltip = [
      e.activity,
      e.group_name,
      timeRange,
      facilitators.join(', '),
      e.notes,
      e.cancelled ? 'Cancelled' : '',
    ].filter(Boolean).join(' · ');

    return (
      <div
        key={e.id}
        className={`entry-chip${isConflict ? ' conflict' : ''}${isDimmed ? ' dimmed' : ''}${e.cancelled ? ' cancelled' : ''}${compact ? ' compact' : ''}`}
        style={{ background: colors.bg, borderColor: colors.border, color: colors.text, top, height, width, left }}
        role="button"
        tabIndex={0}
        title={tooltip}
        aria-label={`Edit ${e.activity}${e.group_name ? `, ${e.group_name}` : ''}, ${timeRange}, ${facilitators.join(', ') || 'Unassigned'}${e.cancelled ? ', cancelled' : ''}`}
        onClick={(ev) => { ev.stopPropagation(); onEdit(e); }}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); onEdit(e); }
        }}
      >
        <span className="chip-activity">
          {isConflict && <span className="chip-warning" title="A facilitator is double-booked at this time">⚠</span>}
          {e.activity}
          {e.cancelled && <span className="chip-cancelled-tag">cancelled</span>}
        </span>
        {compact && e.start_time && (
          <span className="chip-time">{formatTime(e.start_time)}</span>
        )}
        {!compact && e.group_name && <span className="chip-group">{e.group_name}</span>}
        {!compact && timeRange && (
          <span className="chip-time">{timeRange}{dur && <span className="chip-duration"> · {dur}</span>}</span>
        )}
        {!compact && (
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
        )}
        {!compact && e.notes && <span className="chip-notes">{e.notes}</span>}
        <span className="chip-edit-hint" aria-hidden="true">✏</span>
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

      {/* Mobile week overview strip — shows all 7 days with activity colour dots */}
      <div className="week-strip">
        {DAYS.map((d) => {
          const dots = dayActivityColors(d);
          const count = dayEntryCount(d);
          const isActive = mobileDay === d;
          const isToday = d === todayName;
          const hasConflict = conflictDays.has(d);
          const dayDate = weekStart ? getDayDate(weekStart, d) : null;
          return (
            <button
              key={d}
              className={`wsd${isActive ? ' active' : ''}${isToday ? ' today' : ''}${hasConflict ? ' conflict-day' : ''}`}
              onClick={() => setMobileDay(d)}
              aria-pressed={isActive}
              aria-label={`${d}${dayDate ? ` ${ordinal(dayDate.getDate())}` : ''}${count > 0 ? `, ${count} activities` : ', no activities'}${isToday ? ', today' : ''}${hasConflict ? ', has conflicts' : ''}`}
            >
              <span className="wsd-name">{d.slice(0, 3)}</span>
              {dayDate && <span className="wsd-date">{dayDate.getDate()}</span>}
              <span className="wsd-dots">
                {dots.map((c, i) => <span key={i} className="wsd-dot" style={{ background: c }} />)}
                {dots.length === 0 && <span className="wsd-dot empty" />}
              </span>
              {count > 0 && <span className="wsd-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Day tabs — desktop only (week strip handles mobile) */}
      <div className="day-tabs">
        {DAYS.map((d) => {
          const count = dayEntryCount(d);
          const hasConflict = conflictDays.has(d);
          const dayDate = weekStart ? getDayDate(weekStart, d) : null;
          return (
            <button
              key={d}
              className={`day-tab${mobileDay === d ? ' active' : ''}${d === todayName ? ' today-tab' : ''}${hasConflict ? ' conflict-day' : ''}`}
              onClick={() => setMobileDay(d)}
            >
              <span className="day-tab-name">{d.slice(0, 3)}</span>
              {dayDate && <span className="day-tab-date">{dayDate.getDate()}</span>}
              {count > 0 && <span className="day-tab-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      {showSwipeHint && (
        <div className="swipe-hint" role="status" onClick={dismissSwipeHint}>
          ← Swipe to change day →
          <button className="swipe-hint-dismiss" aria-label="Dismiss hint">×</button>
        </div>
      )}

      <div
        className="timeline"
        style={{ gridTemplateColumns: `52px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
      >
        <div className="tl-corner" />
        {visibleDays.map((d) => {
          const dayDate = weekStart ? getDayDate(weekStart, d) : null;
          return (
            <div key={d} className={`tl-day-head${d === todayName ? ' today-col' : ''}${conflictDays.has(d) ? ' conflict-col' : ''}`}>
              {d}{dayDate ? ` ${ordinal(dayDate.getDate())}` : ''}{d === todayName && <span className="today-dot" />}
            </div>
          );
        })}

        <div className="tl-gutter" style={{ height: bodyHeight }}>
          {hourLabels.map((m) => (
            <div key={m} className="tl-hour-label" style={{ top: yFor(m) }}>{formatTime(minutesToHHMM(m))}</div>
          ))}
        </div>

        {visibleDays.map((d) => {
          const dayEntries = entries.filter((e) => e.day === d);
          const placements = packLanes(dayEntries);
          const showNow = todayName === d && nowMin >= winStart && nowMin <= winEnd;
          const isEmpty = dayEntries.length === 0;
          return (
            <div
              key={d}
              className={`tl-day-col${d === todayName ? ' today-col' : ''}`}
              style={{ height: bodyHeight }}
              onClick={(ev) => handleColumnClick(d, ev)}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {hourLabels.slice(0, -1).map((m) => (
                <div key={m} className="tl-hourline" style={{ top: yFor(m + 60) }} />
              ))}
              {isEmpty && (
                <div className="col-empty-hint" aria-hidden="true">
                  <span className="col-empty-plus">+</span>
                  <span className="col-empty-label">Tap to add</span>
                </div>
              )}
              {placements.map((p) => renderChip(p.entry, p.lane, p.lanes))}
              {showNow && (
                <div className="tl-now" style={{ top: yFor(nowMin) }} aria-hidden="true">
                  <span className="tl-now-dot" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {entries.length === 0 && (
        <div className="empty-week">
          <p className="empty-week-title">No activities scheduled this week</p>
          <p className="empty-week-sub">Tap any time slot or the <strong>+</strong> button to add one.</p>
        </div>
      )}

      {/* Floating add button — mobile only */}
      <button
        className="fab-add"
        onClick={() => onAdd(mobileDay, minutesToHHMM(Math.max(winStart, 9 * 60)))}
        aria-label="Add activity"
      >
        +
      </button>
    </div>
  );
}
