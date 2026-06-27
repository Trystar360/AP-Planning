import { useState, useEffect, useRef, useCallback } from 'react';
import { ACTIVITIES as DEFAULT_ACTIVITIES, DAYS, TIME_OPTIONS, ACTIVITY_COLORS as DEFAULT_ACTIVITY_COLORS } from './constants';
import { formatTime } from './utils';
import EntryModal from './EntryModal';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

// activityList is an array of { name, aliases? } objects. Returns the canonical
// activity name, mapping any configured alias (e.g. "MV High Ropes" → "Sky Trail").
// Column-header words from booking reports that the model sometimes returns
// verbatim instead of the cell value — never treat these as an activity.
const COLUMN_HEADERS = new Set([
  'location', 'function', 'booking', 'post as', 'set up', 'set up text',
  'start time', 'end time', 'gtd #', 'gtd', 'gtd#',
]);

function normalizeActivity(str, activityList) {
  if (!str) return '';
  const s = str.trim();
  if (!s) return '';
  const sl = s.toLowerCase();
  if (COLUMN_HEADERS.has(sl)) return '';
  const names = activityList.map((a) => a.name);
  const has = (name) => names.includes(name);

  // Exact match on a name or a configured alias.
  for (const a of activityList) {
    if (a.name.toLowerCase() === sl) return a.name;
    if ((a.aliases || []).some((al) => al && al.toLowerCase() === sl)) return a.name;
  }
  // Partial / substring match on names or aliases.
  for (const a of activityList) {
    const candidates = [a.name, ...(a.aliases || [])].filter(Boolean);
    if (candidates.some((c) => sl.includes(c.toLowerCase()) || c.toLowerCase().includes(sl))) return a.name;
  }
  // Keyword fallbacks — only fire when the named activity exists in the user's list
  if (sl.includes('zip') && (sl.includes('mini') || sl.includes('small')) && has('Mini Zip Line')) return 'Mini Zip Line';
  if (sl.includes('zip') && has('Zip Line')) return 'Zip Line';
  if (sl.includes('climb') && sl.includes('tower') && has('Climbing Tower')) return 'Climbing Tower';
  if (sl.includes('climb') && has('Climbing Wall')) return 'Climbing Wall';
  if (sl.includes('laser') && has('Laser Tag')) return 'Laser Tag';
  if (sl.includes('swing') && has('Power Swing')) return 'Power Swing';
  if ((sl.includes('sky') || sl.includes('trail')) && has('Sky Trail')) return 'Sky Trail';
  return s;
}

function normalizeDay(str) {
  if (!str) return '';
  const s = str.trim().toLowerCase();
  return DAYS.find(d => d.toLowerCase().startsWith(s.slice(0, 3))) || '';
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Compute the weekday name for a calendar date the model copied verbatim from a
// date heading. Doing this in code — rather than asking the model to work out
// the weekday — is deterministic and always correct (LLMs are unreliable at
// calendar math). Handles "M/D/YYYY" (the common report format) explicitly and
// falls back to native Date parsing for written-out dates like "June 20, 2026".
function dateToWeekday(str) {
  if (!str) return '';
  const s = str.trim();
  if (!s) return '';
  let dt;
  const md = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (md) {
    let [, mm, dd, yy] = md;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    // Construct in local time so getDay() isn't shifted by a UTC offset.
    dt = new Date(year, Number(mm) - 1, Number(dd));
  } else {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) dt = parsed;
  }
  if (!dt || Number.isNaN(dt.getTime())) return '';
  const name = WEEKDAY_NAMES[dt.getDay()];
  return DAYS.includes(name) ? name : '';
}

function normalizeTime(str) {
  if (!str) return '';
  const s = str.trim().toLowerCase();
  let h, m;
  const match12 = s.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/);
  if (match12) {
    h = parseInt(match12[1]);
    m = parseInt(match12[2] || '0');
    if (match12[3] === 'pm' && h !== 12) h += 12;
    if (match12[3] === 'am' && h === 12) h = 0;
  } else {
    const match24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) { h = parseInt(match24[1]); m = parseInt(match24[2]); }
  }
  if (h === undefined) return '';
  h = Math.max(8, Math.min(21, h));
  m = Math.round((m || 0) / 15) * 15;
  if (m >= 60) { m = 0; h = Math.min(21, h + 1); }
  if (h === 21) m = 0;
  const candidate = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return TIME_OPTIONS.includes(candidate) ? candidate : '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function buildPrompt(activityList) {
  const known = activityList.map((a) => {
    const aliases = (a.aliases || []).filter(Boolean);
    return aliases.length ? `${a.name} (also known as: ${aliases.join(', ')})` : a.name;
  }).join('; ');
  return `Extract all scheduled events or activity bookings from this image or document. The document can be in any format: screenshot, photo, handwritten note, text message, email, calendar, or a printed booking/schedule report with columns and grouped rows.

For each event found, return a JSON object with:
- activity: the specific activity, ride, or facility being booked — the VALUE in the row, e.g. "Zip Line", "Wagon Ride", "Climbing Tower", "MV High Ropes", "Sky Trail". In a tabular booking report this value sits in the column headed "Location" (sometimes "Function"). Read the cell value for each row — NEVER return a column-header word itself such as "Location", "Function", "Booking", "Post As", "Set Up", "Set Up Text", "Start time", "End time" or "Gtd #". Prefer matching one of these known activities if it clearly refers to the same thing — some list alternative names in parentheses, so map those alternatives to the listed activity name: ${known}. Otherwise use the EXACT activity name shown in the document — it is fine to introduce a new activity name that is not in the known list. Use "" only if no activity is mentioned.
- date: the calendar date shown as a heading above this listing, copied EXACTLY as printed (e.g. "6/20/2026" or "June 20, 2026"). In a booking/schedule report this date is a bold or underlined heading that applies to every row beneath it until the next date heading — carry the same date down onto every row under it. Use "" only if there is genuinely no date heading anywhere above the row.
- day: the weekday name — one of: ${DAYS.join(', ')} — but ONLY if the document literally prints a weekday word (e.g. "Tuesday"). Do NOT calculate or guess the weekday from a calendar date — the app computes that from the date field. Leave day as "" whenever only a numeric or written-out date is shown, and "" if neither a weekday word nor a date is present.
- start_time: start time as "HH:MM" in 24-hour format, between 08:00 and 21:00 (use "" if not found)
- end_time: end time as "HH:MM" in 24-hour format, after start_time (use "" if not found)
- group_name: the booking, group, party, church, family, school, or organisation name. This is often a bold heading above a set of rows (e.g. "Schoonover Family - Family Retreat", "Chodae Community Church NJ - Upper Elementary Retreat") or a "Post As" / "Booking" column value (e.g. "Womens Retreat", "Family Retreat"). Prefer the most descriptive name available. Use "" if none.
- facilitators: array of staff, instructor, or facilitator name strings (use [] if none mentioned)
- notes: any other relevant details such as booking/reference numbers or set-up notes (use "" if none)

Treat each individual time row as its own event, even when several rows share the same group heading or repeat the same activity across consecutive time slots.

CRITICAL: Extract each visible row exactly ONCE. Do not duplicate, repeat, or pad the list — the number of objects you return must equal the number of distinct schedule rows actually visible in the document. If you are unsure, return fewer rows rather than repeating any.

Only extract information that is actually present in the document. Do NOT guess or invent values — use "" or [] for fields that are not clearly stated.

Return a JSON object with an "events" array containing one object per distinct schedule row. Return an empty events array if no events are found.`;
}

// JSON schema the model's response is constrained to via output_config.format.
// This guarantees the reply is valid JSON in our exact shape, eliminating the
// parse-failure class entirely; extractEntries below is now a salvage backstop
// for truncated (max_tokens) responses rather than the front line.
function buildResponseSchema() {
  return {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            activity: { type: 'string' },
            // Raw date heading (e.g. "6/20/2026"); we compute the weekday from it.
            date: { type: 'string' },
            // Only set when the document literally prints a weekday word; "" otherwise.
            day: { type: 'string', enum: [...DAYS, ''] },
            start_time: { type: 'string' },
            end_time: { type: 'string' },
            group_name: { type: 'string' },
            facilitators: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
          },
          required: ['activity', 'date', 'day', 'start_time', 'end_time', 'group_name', 'facilitators', 'notes'],
          additionalProperties: false,
        },
      },
    },
    required: ['events'],
    additionalProperties: false,
  };
}

async function callAnthropic(file, base64, apiKey, activities) {
  const isImage = file.type.startsWith('image/');
  const fileBlock = isImage
    ? { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      // Sonnet 4.6 allows up to 64K output; 16K gives a multi-page report with
      // many rows room to finish (you're only billed for tokens generated).
      max_tokens: 16000,
      // Constrain the reply to our exact JSON shape (GA, no beta header).
      output_config: {
        format: { type: 'json_schema', schema: buildResponseSchema() },
      },
      messages: [{
        role: 'user',
        content: [fileBlock, { type: 'text', text: buildPrompt(activities) }],
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error ${res.status}`);
  }
  const data = await res.json();
  return { text: data.content?.[0]?.text || '[]', stopReason: data.stop_reason };
}

// Coerce a parsed value to the events array. Structured outputs return
// { events: [...] }; a bare array (legacy or salvage) is accepted too.
function toEntries(v) {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.events)) return v.events;
  return null;
}

// Robustly extract the events array from the model's reply. Structured outputs
// make this a clean JSON.parse in the normal case; the recovery paths salvage
// the events array from a response truncated mid-stream (e.g. when the response
// hits the token limit) by keeping the complete leading objects.
function extractEntries(text) {
  const t = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const v = toEntries(JSON.parse(t));
    if (v) return v;
  } catch { /* fall through to recovery */ }

  // From here on we salvage the events array directly: its opening '[' is the
  // first bracket in the payload (whether the reply is a bare array or the
  // structured { "events": [ ... ] } object).
  const start = t.indexOf('[');
  if (start === -1) return null;

  // Try the substring between the first '[' and the last ']'.
  const end = t.lastIndexOf(']');
  if (end > start) {
    try {
      const v = JSON.parse(t.slice(start, end + 1));
      if (Array.isArray(v)) return v;
    } catch { /* fall through */ }
  }

  // Salvage a truncated array: keep everything up to the last complete object.
  const frag = t.slice(start);
  const lastObj = frag.lastIndexOf('}');
  if (lastObj !== -1) {
    try {
      const v = JSON.parse(`${frag.slice(0, lastObj + 1)}]`);
      if (Array.isArray(v)) return v;
    } catch { /* give up */ }
  }
  return null;
}

async function analyzeFile(file, activities) {
  const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error('No API key configured. Add VITE_ANTHROPIC_API_KEY to your .env file.');
  }

  const base64 = await fileToBase64(file);
  const { text: rawText, stopReason } = await callAnthropic(file, base64, anthropicKey, activities);

  const raw = extractEntries(rawText);
  if (!raw) {
    if (import.meta.env.DEV) console.error('AI import: could not parse response', rawText);
    throw new Error(stopReason === 'max_tokens'
      ? 'This document has too many entries to read in one go. Try a single page or a clearer crop.'
      : 'Unexpected response from AI. Please try again.');
  }

  const MIN_SLOTS = 2; // 2 × 15 min = 30 min minimum duration

  const mapped = raw.map(e => {
    const start = normalizeTime(e.start_time) || '09:00';
    const startIdx = TIME_OPTIONS.indexOf(start);
    let end = normalizeTime(e.end_time);
    if (!end || end <= start) {
      end = TIME_OPTIONS[Math.min(startIdx + 4, TIME_OPTIONS.length - 1)];
    }
    // Enforce a minimum duration so imported entries are tall enough to read.
    if (TIME_OPTIONS.indexOf(end) - startIdx < MIN_SLOTS) {
      end = TIME_OPTIONS[Math.min(startIdx + MIN_SLOTS, TIME_OPTIONS.length - 1)];
    }
    // The date heading is authoritative — compute the weekday from it. Only
    // fall back to a literal weekday word when no date was found. Leave blank
    // (so the row is flagged for input) when neither is present.
    const day = dateToWeekday(e.date) || normalizeDay(e.day);
    return {
      activity: normalizeActivity(e.activity, activities),
      day,
      start_time: start,
      end_time: end,
      group_name: e.group_name || '',
      facilitators: Array.isArray(e.facilitators) ? e.facilitators : [],
      notes: e.notes || '',
    };
  });

  // Drop exact-duplicate rows — guards against the model repeating entries.
  const seen = new Set();
  return mapped.filter((e) => {
    const key = [
      e.activity, e.day, e.start_time, e.end_time,
      e.group_name, e.facilitators.join(','), e.notes,
    ].join('|').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function AIUploadModal({ weekLabel, weekStart, activities: activitiesProp, staff = [], onImport, onClose }) {
  const ACTIVITIES = activitiesProp?.length ? activitiesProp.map((a) => a.name) : DEFAULT_ACTIVITIES;
  // Full activity objects (incl. aliases) used for matching during analysis.
  const activityList = activitiesProp?.length ? activitiesProp : DEFAULT_ACTIVITIES.map((name) => ({ name }));
  const ACTIVITY_COLORS = activitiesProp?.length
    ? Object.fromEntries(activitiesProp.map((a) => [a.name, { bg: a.bg, border: a.border, text: a.text }]))
    : DEFAULT_ACTIVITY_COLORS;
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [editingIdx, setEditingIdx] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && editingIdx === null) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editingIdx]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const acceptFile = useCallback((f) => {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Unsupported file type. Please upload a JPEG, PNG, GIF, WebP image, or PDF.');
      return;
    }
    setError('');
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStep('analyzing');
    setError('');
    try {
      const results = await analyzeFile(file, activityList);
      setEntries(results);
      setSelected(new Set(results.map((_, i) => i)));
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('upload');
    }
  };

  const toggleEntry = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const updateEntry = (i, changes) => {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, ...changes } : e));
  };

  const handleImport = () => {
    onImport(entries.filter((_, i) => selected.has(i)));
  };

  // Activity names among the selected entries that aren't set up yet — these
  // will be created automatically (with a distinct colour) on import.
  const knownActivities = new Set(ACTIVITIES.map((n) => n.toLowerCase()));
  const newActivityTypes = [...new Set(
    entries.filter((_, i) => selected.has(i)).map((e) => e.activity).filter(Boolean),
  )].filter((n) => !knownActivities.has(n.toLowerCase()));

  // Selected entries with no day (no date heading and no weekday word) must be
  // resolved before import — the user picks a day inline on the card.
  const selectedMissingDay = entries.filter((e, i) => selected.has(i) && !e.day).length;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="modal ai-upload-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-upload-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="modal-title" id="ai-upload-title">AI Import</h2>
          <p className="ai-upload-subtitle">
            Upload a schedule image or PDF — Claude will extract the entries for you.
            {step === 'upload' && (
              <span className="ai-upload-tip"> For best results, upload the original PDF rather than a photo of a printout.</span>
            )}
          </p>

          {error && <div className="ai-upload-error">{error}</div>}

          {step === 'upload' && (
            <>
              <div
                className={`ai-dropzone${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                aria-label="Upload file"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="ai-file-input"
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                />
                {preview ? (
                  <img src={preview} alt="Schedule preview" className="ai-preview-img" />
                ) : file ? (
                  <div className="ai-file-selected">
                    <span className="ai-file-icon">📄</span>
                    <span className="ai-file-name">{file.name}</span>
                    <span className="ai-file-hint">Click to replace</span>
                  </div>
                ) : (
                  <div className="ai-dropzone-prompt">
                    <span className="ai-dropzone-icon" aria-hidden="true">⬆</span>
                    <span className="ai-dropzone-main">Drop a file here, or click to browse</span>
                    <span className="ai-dropzone-sub">JPEG · PNG · GIF · WebP · PDF</span>
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!file}
                  onClick={handleAnalyze}
                >
                  Analyze with AI ✦
                </button>
              </div>
            </>
          )}

          {step === 'analyzing' && (
            <div className="ai-analyzing">
              <div className="ai-spinner" aria-hidden="true" />
              <p className="ai-analyzing-text">Analyzing with AI…</p>
              <p className="ai-analyzing-sub">This usually takes a few seconds.</p>
            </div>
          )}

          {step === 'review' && (
            <>
              {entries.length === 0 ? (
                <div className="ai-no-entries">
                  <p>No schedule entries were found in this file.</p>
                  <p>Try a different image or PDF with clearer schedule information.</p>
                </div>
              ) : (
                <>
                  <p className="ai-review-count">
                    Found <strong>{entries.length}</strong> {entries.length === 1 ? 'entry' : 'entries'}
                    {weekLabel ? <> for <strong>{weekLabel}</strong></> : null}
                    {' '}— select and edit before adding:
                  </p>
                  {newActivityTypes.length > 0 && (
                    <div className="ai-new-activities" role="status">
                      <span className="ai-new-activities-label">
                        {newActivityTypes.length} new activity {newActivityTypes.length === 1 ? 'type' : 'types'} will be created:
                      </span>
                      <span className="ai-new-activities-names">{newActivityTypes.join(', ')}</span>
                    </div>
                  )}
                  {selectedMissingDay > 0 && (
                    <div className="ai-needs-day" role="alert">
                      {selectedMissingDay} selected {selectedMissingDay === 1 ? 'entry has' : 'entries have'} no date in the document — pick a day on {selectedMissingDay === 1 ? 'it' : 'each'} before adding.
                    </div>
                  )}
                  <div className="ai-entry-list">
                    {entries.map((entry, i) => {
                      const colors = ACTIVITY_COLORS[entry.activity] || { bg: '#f1f5f9', border: '#94a3b8', text: '#334155' };
                      return (
                        <label
                          key={i}
                          className={`ai-entry-card${selected.has(i) ? ' selected' : ''}${!entry.day ? ' needs-day' : ''}`}
                        >
                          <div className="ai-entry-top">
                            <input
                              type="checkbox"
                              checked={selected.has(i)}
                              onChange={() => toggleEntry(i)}
                              className="ai-entry-check"
                            />
                            <div className="ai-entry-body">
                              <span
                                className="ai-entry-activity"
                                style={entry.activity
                                  ? { background: colors.bg, borderColor: colors.border, color: colors.text }
                                  : { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-faint)', fontStyle: 'italic' }}
                              >
                                {entry.activity || 'Unknown activity'}
                              </span>
                              <span className="ai-entry-time">
                                {entry.day ? (
                                  entry.day
                                ) : (
                                  <select
                                    className="ai-entry-day-select"
                                    value=""
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => { e.preventDefault(); updateEntry(i, { day: e.target.value }); }}
                                    aria-label="Set day for this entry"
                                  >
                                    <option value="" disabled>Pick a day…</option>
                                    {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                )}
                                {' · '}{formatTime(entry.start_time)}–{formatTime(entry.end_time)}
                              </span>
                              {entry.group_name && (
                                <span className="ai-entry-meta">{entry.group_name}</span>
                              )}
                              {entry.facilitators.length > 0 && (
                                <span className="ai-entry-meta">{entry.facilitators.join(', ')}</span>
                              )}
                              {entry.notes && (
                                <span className="ai-entry-meta ai-entry-notes">{entry.notes}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="ai-entry-edit-btn"
                              onClick={(e) => { e.preventDefault(); setEditingIdx(i); }}
                              aria-label="Edit entry"
                            >
                              Edit
                            </button>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setStep('upload'); setEntries([]); setSelected(new Set()); setEditingIdx(null); }}
                >
                  ← Back
                </button>
                {entries.length > 0 && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={selected.size === 0 || selectedMissingDay > 0}
                    onClick={handleImport}
                  >
                    Add {selected.size} {selected.size === 1 ? 'entry' : 'entries'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {editingIdx !== null && (
        <EntryModal
          mode="edit"
          entry={entries[editingIdx]}
          staff={staff}
          activities={activitiesProp}
          weekStart={weekStart}
          onSave={(form) => {
            updateEntry(editingIdx, form);
            setEditingIdx(null);
          }}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </>
  );
}
