import { useState, useEffect, useRef, useCallback } from 'react';
import { ACTIVITIES as DEFAULT_ACTIVITIES, DAYS, TIME_OPTIONS, ACTIVITY_COLORS as DEFAULT_ACTIVITY_COLORS } from './constants';
import { formatTime } from './utils';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

function normalizeActivity(str, activities) {
  if (!str) return '';
  const s = str.trim();
  if (!s) return '';
  const sl = s.toLowerCase();
  const exact = activities.find(a => a.toLowerCase() === sl);
  if (exact) return exact;
  const partial = activities.find(a => sl.includes(a.toLowerCase()) || a.toLowerCase().includes(sl));
  if (partial) return partial;
  // Keyword fallbacks — only fire when the named activity exists in the user's list
  const has = (name) => activities.includes(name);
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

function buildPrompt(activities) {
  return `Extract all scheduled events or activity bookings from this image or document. The document can be in any format: screenshot, photo, handwritten note, text message, email, table, calendar, or anything else.

For each event found, return a JSON object with:
- activity: name of the activity or event (if it matches one of these, use the exact name: ${activities.join(', ')}; otherwise use whatever name appears; use "" if not mentioned)
- day: day of week — one of: ${DAYS.join(', ')} (use "" if not found or unclear)
- start_time: start time as "HH:MM" in 24-hour format, between 08:00 and 21:00 (use "" if not found)
- end_time: end time as "HH:MM" in 24-hour format, after start_time (use "" if not found)
- group_name: group name, class name, or booking reference (use "" if none)
- facilitators: array of staff, instructor, or facilitator name strings (use [] if none mentioned)
- notes: any other relevant details (use "" if none)

Only extract information that is actually present in the document. Do NOT guess or invent values — use "" or [] for fields that are not clearly stated.

Return ONLY a JSON array. Return [] if no events are found. Output raw JSON only, no markdown fences, no explanation.`;
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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
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
  return data.content?.[0]?.text || '[]';
}

async function analyzeFile(file, activities) {
  const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error('No API key configured. Add VITE_ANTHROPIC_API_KEY to your .env file.');
  }

  const base64 = await fileToBase64(file);
  const rawText = await callAnthropic(file, base64, anthropicKey, activities);

  const text = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Unexpected response from AI. Please try again.');
  }

  if (!Array.isArray(raw)) throw new Error('Unexpected response format from AI.');

  return raw.map(e => {
    const start = normalizeTime(e.start_time) || '09:00';
    let end = normalizeTime(e.end_time);
    if (!end || end <= start) {
      const startIdx = TIME_OPTIONS.indexOf(start);
      end = TIME_OPTIONS[Math.min(startIdx + 4, TIME_OPTIONS.length - 1)];
    }
    return {
      activity: normalizeActivity(e.activity, activities),
      day: normalizeDay(e.day),
      start_time: start,
      end_time: end,
      group_name: e.group_name || '',
      facilitators: Array.isArray(e.facilitators) ? e.facilitators : [],
      notes: e.notes || '',
    };
  });
}

export default function AIUploadModal({ weekLabel, activities: activitiesProp, onImport, onClose }) {
  const ACTIVITIES = activitiesProp?.length ? activitiesProp.map((a) => a.name) : DEFAULT_ACTIVITIES;
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
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      const results = await analyzeFile(file, ACTIVITIES);
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

  return (
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
                <div className="ai-entry-list">
                  {entries.map((entry, i) => {
                    const colors = ACTIVITY_COLORS[entry.activity] || { bg: '#f1f5f9', border: '#94a3b8', text: '#334155' };
                    const isEditing = editingIdx === i;
                    return (
                      <div
                        key={i}
                        className={`ai-entry-card${selected.has(i) ? ' selected' : ''}${isEditing ? ' editing' : ''}`}
                      >
                        <label className="ai-entry-top">
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
                              {entry.day || <em style={{ fontStyle: 'italic', color: 'var(--text-faint)' }}>Unknown day</em>}
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
                            onClick={(e) => { e.preventDefault(); setEditingIdx(isEditing ? null : i); }}
                            aria-label={isEditing ? 'Close editor' : 'Edit entry'}
                          >
                            {isEditing ? 'Done' : 'Edit'}
                          </button>
                        </label>

                        {isEditing && (
                          <div className="ai-entry-edit-form">
                            <div className="ai-edit-row">
                              <label className="ai-edit-label">Activity</label>
                              <select
                                className="ai-edit-select"
                                value={entry.activity}
                                onChange={(e) => updateEntry(i, { activity: e.target.value })}
                              >
                                <option value="">— unknown —</option>
                                {ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
                              </select>
                            </div>
                            <div className="ai-edit-row">
                              <label className="ai-edit-label">Day</label>
                              <select
                                className="ai-edit-select"
                                value={entry.day}
                                onChange={(e) => updateEntry(i, { day: e.target.value })}
                              >
                                <option value="">— unknown —</option>
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </div>
                            <div className="ai-edit-row">
                              <label className="ai-edit-label">Start</label>
                              <select
                                className="ai-edit-select"
                                value={entry.start_time}
                                onChange={(e) => {
                                  const start = e.target.value;
                                  const changes = { start_time: start };
                                  if (entry.end_time <= start) {
                                    const idx = TIME_OPTIONS.indexOf(start);
                                    changes.end_time = TIME_OPTIONS[Math.min(idx + 4, TIME_OPTIONS.length - 1)];
                                  }
                                  updateEntry(i, changes);
                                }}
                              >
                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                              </select>
                            </div>
                            <div className="ai-edit-row">
                              <label className="ai-edit-label">End</label>
                              <select
                                className="ai-edit-select"
                                value={entry.end_time}
                                onChange={(e) => updateEntry(i, { end_time: e.target.value })}
                              >
                                {TIME_OPTIONS.filter(t => t > entry.start_time).map(t => (
                                  <option key={t} value={t}>{formatTime(t)}</option>
                                ))}
                              </select>
                            </div>
                            <div className="ai-edit-row">
                              <label className="ai-edit-label">Group</label>
                              <input
                                type="text"
                                className="ai-edit-input"
                                value={entry.group_name}
                                placeholder="Group / booking name"
                                onChange={(e) => updateEntry(i, { group_name: e.target.value })}
                              />
                            </div>
                            <div className="ai-edit-row">
                              <label className="ai-edit-label">Staff</label>
                              <input
                                type="text"
                                className="ai-edit-input"
                                value={entry.facilitators.join(', ')}
                                placeholder="Names, comma-separated"
                                onChange={(e) => updateEntry(i, {
                                  facilitators: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                                })}
                              />
                            </div>
                            <div className="ai-edit-row">
                              <label className="ai-edit-label">Notes</label>
                              <input
                                type="text"
                                className="ai-edit-input"
                                value={entry.notes}
                                placeholder="Any additional notes"
                                onChange={(e) => updateEntry(i, { notes: e.target.value })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
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
                  disabled={selected.size === 0}
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
  );
}
