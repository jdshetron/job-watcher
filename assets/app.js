// Shared code for all three pages: loading and parsing the data files, dates, the shortlist,
// formatting, and the service worker. Every number on the site is computed here in the browser.

const DAY_MS = 86400000;
const SHORTLIST_KEY = "job-watcher.shortlist";

function parseCSV(text) {
  const rows = []; let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.length === head.length).map(r => {
    const o = Object.fromEntries(head.map((h, i) => [h, r[i]]));
    o.in_role = o.in_role === "true";
    o.first_run = o.first_run === "true";
    return o;
  });
}

let dataPromise = null;
function loadData() {
  dataPromise ??= (async () => {
    const [h, s] = await Promise.all([fetch("data/history.csv"), fetch("data/status.json")]);
    if (!h.ok || !s.ok) throw new Error("Could not load the data files.");
    return { rows: parseCSV(await h.text()), status: await s.json() };
  })();
  return dataPromise;
}

// --- dates (UTC, YYYY-MM-DD) ----------------------------------------------------------------
const toDay = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const daysBetween = (a, b) => Math.round((toDay(b) - toDay(a)) / DAY_MS);
function dateRange(from, to) {
  const out = [];
  for (let t = toDay(from); t <= toDay(to); t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const fmtDate = s => s ? new Date(toDay(s)).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : "—";
const fmtInt = n => n == null ? "—" : Number(n).toLocaleString();
const fmtPct = x => x == null || isNaN(x) ? "—" : `${(x * 100).toFixed(1)}%`;
function fmtRunTime(iso) {
  const d = new Date(iso);
  return `${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (${iso.replace("T", " ").replace("Z", " UTC")})`;
}

// --- the changes in the latest run (same rule as watcher/status.py) ---------------------------
function latestChanges(rows, runDate) {
  return {
    added: rows.filter(r => r.first_seen === runDate && !r.first_run),
    removed: rows.filter(r => r.removed_date === runDate),
  };
}

// --- shortlist (stored in this browser) -------------------------------------------------------
function getShortlist() {
  try { return new Set(JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]")); } catch { return new Set(); }
}
function setShortlist(set) {
  try { localStorage.setItem(SHORTLIST_KEY, JSON.stringify([...set])); } catch { /* storage blocked */ }
}

// --- rendering helpers ------------------------------------------------------------------------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const PALETTE = ["#3ee6a8", "#8b7bff", "#ff6b81", "#ffc857", "#4cc9f0", "#f78c6b", "#c77dff", "#06d6a0", "#ef476f", "#118ab2"];
function employerColor(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 65% 45%)`;
}
function postingHTML(r, { star = false, starred = false, removed = false, runDate = null } = {}) {
  const open = runDate && !removed ? daysBetween(r.first_seen, runDate) : null;
  const openText = open == null ? "" : r.first_run ? `open ≥ ${open} d` : `open ${open} d`;
  return `<li class="posting${removed ? " removed" : ""}">
    <span class="logo" style="background:${employerColor(r.employer)}" aria-hidden="true">${esc(r.employer[0])}</span>
    <div>
      <div class="title">${esc(r.title || "(no title)")} ${r.in_role ? '<span class="pill role">Data analyst</span>' : ""}</div>
      <div class="meta"><span>${esc(r.employer)}</span>${r.location ? `<span>📍 ${esc(r.location)}</span>` : ""}
        ${r.department ? `<span>${esc(r.department)}</span>` : ""}<span>first seen ${fmtDate(r.first_seen)}</span>
        ${removed ? `<span class="down">removed ${fmtDate(r.removed_date)}</span>` : openText ? `<span>${openText}</span>` : ""}</div>
    </div>
    <div class="actions">
      ${star ? `<button class="star" data-id="${esc(r.posting_id)}" aria-pressed="${starred}" title="${starred ? "Remove from" : "Add to"} shortlist" aria-label="Star ${esc(r.title)}">${starred ? "★" : "☆"}</button>` : ""}
      ${r.url ? `<a class="btn ${removed ? "" : "primary"}" href="${esc(r.url)}" target="_blank" rel="noopener">${removed ? "View" : "Apply"} ↗</a>` : ""}
    </div>
  </li>`;
}

function showError(e) {
  const el = document.getElementById("error");
  if (el) { el.textContent = `Could not load the data: ${e.message}`; el.hidden = false; }
  console.error(e);
}

// --- chart defaults ---------------------------------------------------------------------------
function chartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.color = "#8e98b8";
  Chart.defaults.borderColor = "rgba(148,163,214,.14)";
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.elements.bar.borderRadius = 6;
}

// --- offline banner and service worker --------------------------------------------------------
function updateOnline() { const b = document.getElementById("offline"); if (b) b.hidden = navigator.onLine; }
addEventListener("online", updateOnline);
addEventListener("offline", updateOnline);
addEventListener("DOMContentLoaded", updateOnline);
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(e => console.warn("service worker", e)));
}
