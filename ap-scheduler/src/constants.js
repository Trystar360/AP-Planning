// Colour palette assigned to staff members in order. The first 8 use this
// curated set; beyond that, staffColorByIndex() generates further distinct
// hues so any number of facilitators stay visually distinct.
export const STAFF_PALETTE = [
  '#c0492f', // rust
  '#cf8b3c', // amber
  '#7e9444', // olive
  '#3f8f6b', // jade
  '#3f93a6', // teal
  '#5b85bd', // lake
  '#8268b3', // violet
  '#bf5a78', // berry
];

// A distinct colour for the Nth facilitator, for ANY N. The curated palette
// covers the first 8; past that we walk the hue wheel by the golden angle
// (137.5°), which keeps successive hues far apart so colours never repeat.
export function staffColorByIndex(index) {
  const i = index >= 0 ? index : 0;
  if (i < STAFF_PALETTE.length) return STAFF_PALETTE[i];
  const hue = Math.round((i * 137.508) % 360);
  return `hsl(${hue}, 52%, 42%)`;
}

export const ACTIVITIES = [
  'Zip Line',
  'Mini Zip Line',
  'Climbing Wall',
  'Climbing Tower',
  'Laser Tag',
  'Power Swing',
  'Sky Trail',
];

export const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Row headers for the schedule grid (every hour)
export const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00',
];

// 15-minute increment options for start/end time dropdowns (8:00 AM – 9:00 PM)
export const TIME_OPTIONS = (() => {
  const times = [];
  for (let h = 8; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 0) break;
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return times;
})();

export const ACTIVITY_COLORS = {
  'Zip Line':       { bg: '#dde6f1', border: '#5b85bd', text: '#2c4a78' },
  'Mini Zip Line':  { bg: '#d8e9ec', border: '#3f93a6', text: '#1f5560' },
  'Climbing Wall':  { bg: '#dceadf', border: '#4e9067', text: '#265840' },
  'Climbing Tower': { bg: '#e3ead3', border: '#7e9444', text: '#4c5a1f' },
  'Laser Tag':      { bg: '#f1dee4', border: '#bf5a78', text: '#7c2f45' },
  'Power Swing':    { bg: '#f6e6cf', border: '#cf8b3c', text: '#7d4d17' },
  'Sky Trail':      { bg: '#e6def0', border: '#8268b3', text: '#4a3673' },
};
