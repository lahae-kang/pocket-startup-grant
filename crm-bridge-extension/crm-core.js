(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PocketCRM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CRM_ORIGIN = 'https://crm.xn--9i1b674cwc38r6pa.com';
  const BOARD_ORIGIN = 'https://lahae-kang.github.io';
  const CHANNEL = 'pocket-crm-screen-v1';
  const clean = (value, max = 200) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function crmURL(value) {
    try { const url = new URL(value); return url.origin === CRM_ORIGIN && url.pathname === '/employee/schedule/meeting'; }
    catch { return false; }
  }
  function boardURL(value) {
    try { const url = new URL(value); return url.origin === BOARD_ORIGIN && url.pathname.startsWith('/pocket-startup-grant/'); }
    catch { return false; }
  }
  function key(entry) {
    return JSON.stringify([entry.company, entry.date, entry.time, entry.staff, entry.kindLabel, entry.place]);
  }
  function sanitizeSnapshot(value) {
    if (!value || !crmURL(value.sourceURL) || !Array.isArray(value.entries) || value.entries.length > 2000) return null;
    const dates = [...new Set((Array.isArray(value.dates) ? value.dates : []).filter(validDate))].sort();
    if (!dates.length || dates.length > 62) return null;
    const entries = [];
    const seen = new Set();
    for (const item of value.entries) {
      if (!item || !dates.includes(item.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time || '')) continue;
      const entry = { company: clean(item.company), date: item.date, time: item.time,
        staff: clean(item.staff), kindLabel: clean(item.kindLabel, 60), place: clean(item.place, 80) };
      if (!entry.company || entry.company === '내부회의') continue;
      const identity = key(entry);
      if (seen.has(identity)) continue;
      seen.add(identity);
      entries.push(entry);
    }
    return { id: clean(value.id, 100), sourceURL: `${CRM_ORIGIN}/employee/schedule/meeting`,
      capturedAt: clean(value.capturedAt, 50), dates, entries };
  }
  function capture(doc, sourceURL, now = new Date().toISOString()) {
    if (!crmURL(sourceURL)) return null;
    const table = doc.querySelector('.work-meet-table-wrap');
    if (!table || table.getClientRects().length === 0) return null;
    const dates = [...new Set(Array.from(doc.querySelectorAll('.fc-scrollgrid [data-date]'), node => node.getAttribute('data-date')).filter(validDate))];
    if (!dates.length) return null;
    const entries = [];
    for (const row of table.querySelectorAll('.project-schedule-history-table-conts')) {
      if (row.getClientRects().length === 0 || row.children.length < 6) continue;
      const cells = row.children;
      const match = cells[5].textContent.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}:\d{2})/);
      if (!match) continue;
      entries.push({ company: cells[0].textContent, staff: cells[2].textContent,
        kindLabel: cells[3].textContent, place: cells[4].textContent,
        date: `${match[1]}-${match[2]}-${match[3]}`, time: match[4] });
    }
    return sanitizeSnapshot({ id: now, capturedAt: now, sourceURL, dates, entries });
  }
  function normalizeName(value) {
    return clean(value).normalize('NFKC').toLowerCase().replace(/\([^)]*\)/g, '')
      .replace(/주식회사|㈜/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  }
  function emptyState() { return { version: 1, enabled: false, staffFilter: '', aliases: {}, entries: [], ignoredKeys: [], lastSync: '' }; }
  function state(value) {
    const base = emptyState();
    if (!value || value.version !== 1) return base;
    return { ...base, enabled: value.enabled === true, staffFilter: clean(value.staffFilter),
      aliases: value.aliases && typeof value.aliases === 'object' && !Array.isArray(value.aliases) ? value.aliases : {},
      entries: Array.isArray(value.entries) ? value.entries.filter(e => e && typeof e.id === 'string' && typeof e.externalKey === 'string' && typeof e.companyId === 'string' && validDate(e.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(e.time || '')).slice(-5000).map(e => ({
        id: e.id, externalKey: e.externalKey, companyId: e.companyId, company: clean(e.company),
        date: e.date, time: e.time, staff: clean(e.staff), kindLabel: clean(e.kindLabel, 60), place: clean(e.place, 80), missing: e.missing === true
      })) : [],
      ignoredKeys: Array.isArray(value.ignoredKeys) ? value.ignoredKeys.filter(k => typeof k === 'string').slice(-2000) : [],
      lastSync: clean(value.lastSync, 50) };
  }
  function matchesStaff(entry, filter) {
    const wanted = clean(filter).toLowerCase();
    return !wanted || entry.staff.split(/[,，]/).map(name => name.trim().toLowerCase()).includes(wanted);
  }
  function findCompany(entry, companies, aliases) {
    const explicit = aliases[entry.company];
    if (explicit === '-') return null;
    if (explicit) return companies.find(c => c.id === explicit) || null;
    const active = companies.filter(c => !c.contractEnded);
    const exact = active.filter(c => clean(c.name) === entry.company);
    if (exact.length === 1) return exact[0];
    const name = normalizeName(entry.company);
    if (!name) return null;
    const candidates = active.filter(c => normalizeName(c.name) === name);
    return candidates.length === 1 ? candidates[0] : null;
  }
  function preview(value, snapshot, companies) {
    const config = state(value);
    const result = { matched: [], unmatched: [] };
    if (!snapshot) return result;
    for (const entry of snapshot.entries.filter(e => matchesStaff(e, config.staffFilter))) {
      if (config.aliases[entry.company] === '-') continue;
      const company = findCompany(entry, companies, config.aliases);
      if (company) result.matched.push({ ...entry, companyId: company.id, boardName: company.name });
      else result.unmatched.push(entry);
    }
    return result;
  }
  function isManualDuplicate(entry, schedules) {
    return schedules.some(s => s.type === 'meeting' && (!s.kind || s.kind === 'meeting') && s.companyId === entry.companyId && s.date === entry.date && s.time === entry.time);
  }
  function merge(value, snapshot, companies, manualSchedules) {
    const config = state(value);
    if (!config.enabled || !snapshot) return config;
    const selected = preview(config, snapshot, companies).matched;
    const ignored = new Set(config.ignoredKeys);
    const incomingKeys = new Set(snapshot.entries.map(key));
    const next = config.entries.map(entry => ({ ...entry }));
    const incoming = selected.filter(e => !ignored.has(key(e)));
    const consumed = new Set();
    for (const entry of incoming) {
      const externalKey = key(entry);
      const exact = next.find(old => old.externalKey === externalKey);
      if (exact) {
        exact.companyId = entry.companyId;
        exact.missing = false;
        consumed.add(exact.id);
        continue;
      }
      // Only reconcile time/date edits when both old and new identities are unambiguous in this view.
      const sameSeries = old => old.companyId === entry.companyId && old.staff === entry.staff && old.kindLabel === entry.kindLabel && old.place === entry.place;
      const candidates = next.filter(old => sameSeries(old) && snapshot.dates.includes(old.date) && !incomingKeys.has(old.externalKey) && !consumed.has(old.id));
      const competing = incoming.filter(other => other.companyId === entry.companyId && other.staff === entry.staff && other.kindLabel === entry.kindLabel && other.place === entry.place && !config.entries.some(old => old.externalKey === key(other)));
      const old = candidates.length === 1 && competing.length === 1 ? candidates[0] : null;
      const record = { id: old?.id || `crm:${encodeURIComponent(externalKey)}`, externalKey,
        companyId: entry.companyId, company: entry.company, date: entry.date, time: entry.time,
        staff: entry.staff, kindLabel: entry.kindLabel, place: entry.place, missing: false };
      if (old) Object.assign(old, record);
      else if (!isManualDuplicate(entry, manualSchedules)) next.push(record);
      consumed.add(record.id);
    }
    for (const old of next) {
      if (snapshot.dates.includes(old.date) && matchesStaff(old, config.staffFilter) && !incomingKeys.has(old.externalKey) && !consumed.has(old.id)) old.missing = true;
    }
    const result = { ...config, entries: next, lastSync: snapshot.capturedAt };
    return JSON.stringify(result) === JSON.stringify(config) ? config : result;
  }
  function schedules(value, companies, manualSchedules) {
    const config = state(value);
    const ids = new Set(companies.map(c => c.id));
    return config.entries.filter(e => config.aliases[e.company] !== '-')
      .map(e => config.aliases[e.company] ? { ...e, companyId: config.aliases[e.company] } : e)
      .filter(e => ids.has(e.companyId) && !config.ignoredKeys.includes(e.externalKey) && matchesStaff(e, config.staffFilter) && !isManualDuplicate(e, manualSchedules))
      .map(e => ({ ...e, type: 'meeting', kind: 'meeting', externalSource: CHANNEL, title: '' }));
  }
  return { CRM_ORIGIN, BOARD_ORIGIN, CHANNEL, crmURL, boardURL, key, validDate, capture, sanitizeSnapshot,
    normalizeName, emptyState, state, matchesStaff, findCompany, preview, merge, schedules };
});
