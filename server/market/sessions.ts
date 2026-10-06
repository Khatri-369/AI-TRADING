import type { AssetCategory, MarketSession } from '../../shared/types';

// Published NYSE calendar: https://www.nyse.com/trade/hours-calendars (2026–2028).
// Years outside this verified calendar remain explicitly labelled schedule estimates.
const US_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
  '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19', '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25',
]);
const US_EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24', '2027-11-26', '2028-07-03', '2028-11-24']);

export function zonedClock(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)!.value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, weekday: part('weekday'), minutes: Number(part('hour')) * 60 + Number(part('minute')) };
}

export function marketSession(category: AssetCategory, now = new Date()): MarketSession {
  if (category === 'crypto') return { state: 'OPEN', timezone: 'UTC', note: '24/7 market; individual venues may halt trading' };
  if (category === 'forex') return { state: 'UNKNOWN', timezone: 'UTC', note: 'Daily reference rate, not an executable intraday FX quote' };
  if (category === 'commodities') return { state: 'UNKNOWN', timezone: 'America/New_York', note: 'Indicative OTC spot quote; provider does not report exchange session status' };
  const timezone = category === 'us' ? 'America/New_York' : 'Asia/Kolkata';
  const { date, weekday, minutes } = zonedClock(now, timezone);
  const weekend = weekday === 'Sat' || weekday === 'Sun';
  if (category === 'us') {
    const verified = Number(date.slice(0, 4)) >= 2026 && Number(date.slice(0, 4)) <= 2028;
    const early = US_EARLY_CLOSE.has(date);
    const note = verified
      ? 'US session schedule with published 2026–2028 NYSE holidays; unscheduled halts are not tracked'
      : 'US weekday schedule estimate; holiday calendar unavailable for this year';
    if (weekend || US_HOLIDAYS.has(date)) return { state: 'CLOSED', timezone, note };
    if (minutes >= 240 && minutes < 570) return { state: 'PRE-MARKET', timezone, note };
    if (minutes >= 570 && minutes < (early ? 780 : 960)) return { state: 'OPEN', timezone, note };
    if (minutes >= (early ? 780 : 960) && minutes < (early ? 1020 : 1200)) return { state: 'AFTER-HOURS', timezone, note };
    return { state: 'CLOSED', timezone, note };
  }
  const note = 'India weekday schedule estimate (09:15–15:30 IST); holidays, special sessions and halts require provider confirmation';
  if (weekend) return { state: 'CLOSED', timezone, note };
  if (minutes >= 540 && minutes < 555) return { state: 'PRE-MARKET', timezone, note };
  if (minutes >= 555 && minutes < 930) return { state: 'OPEN', timezone, note };
  return { state: 'CLOSED', timezone, note };
}
