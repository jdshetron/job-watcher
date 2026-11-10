// Today page: last run, the four counts, sources, and the new and removed postings.

(async () => {
  let data;
  try { data = await loadData(); } catch (e) { return showError(e); }
  const { rows, status } = data;
  const run = status.run_date;
  const $ = id => document.getElementById(id);

  $("last-run").textContent = fmtRunTime(status.run_time);
  $("t-days").textContent = fmtInt(status.days_with_success);
  $("t-days-sub").textContent = `since ${fmtDate(status.first_run_date)}`;
  $("t-open").textContent = fmtInt(status.open);
  $("t-new").textContent = fmtInt(status.new_today);
  $("t-removed").textContent = fmtInt(status.removed_today);

  const { added, removed } = latestChanges(rows, run);
  const openRows = rows.filter(r => r.status === "open");
  $("t-open-sub").textContent = `${fmtInt(openRows.filter(r => r.in_role).length)} data analyst`;
  $("t-new-sub").textContent = `${fmtInt(added.filter(r => r.in_role).length)} data analyst`;
  $("t-removed-sub").textContent = `${fmtInt(removed.filter(r => r.in_role).length)} data analyst`;
  $("first-note").hidden = status.first_run_date !== run;

  // Ticker: the most recently posted open data-analyst postings.
  const newest = openRows.filter(r => r.in_role)
    .sort((a, b) => (b.posted_date || b.first_seen).localeCompare(a.posted_date || a.first_seen)).slice(0, 6);
  $("ticker").innerHTML = newest.map((r, i) =>
    `<div style="animation-delay:${i * 80}ms"><b>${esc(r.employer)}</b><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></div>`
  ).join("") || '<div class="muted">No open data-analyst postings.</div>';

  // Picked for you: the open postings whose titles best fit the resume (assets/profile.js),
  // newest first among equal scores.
  $("picked-name").textContent = PROFILE.firstName;
  $("picked-why").innerHTML = `Ranked by how well the title matches ${esc(PROFILE.firstName)}'s resume: SQL, Power BI, business intelligence, reporting and analytics add points, and entry-to-mid-level titles rank above senior ones. <a href="${esc(PROFILE.portfolio)}" target="_blank" rel="noopener">Portfolio ↗</a>`;
  const picked = openRows.map(r => ({ r, f: fitScore(r) })).filter(x => x.f.score >= 4)
    .sort((a, b) => b.f.score - a.f.score || b.r.first_seen.localeCompare(a.r.first_seen) || a.r.employer.localeCompare(b.r.employer))
    .slice(0, 6);
  $("picked").innerHTML = picked.map(x => postingHTML(x.r, { runDate: run, note: `Matches: ${x.f.reasons.slice(0, 4).join(", ")}` })).join("")
    || '<li class="muted">No strong matches today.</li>';

  // Sources table.
  const perSource = new Map();
  for (const r of openRows) if (r.in_role) perSource.set(r.source, (perSource.get(r.source) || 0) + 1);
  const ok = status.sources.filter(s => s.ok).length;
  $("sources-ok").textContent = `${ok} of ${status.sources.length} ok`;
  $("sources").innerHTML = status.sources.map(s => `<tr>
    <td><strong>${esc(s.employer)}</strong></td>
    <td><span class="pill ats">${esc(s.ats)}</span></td>
    <td>${s.ok ? '<span class="pill ok">OK</span>' : '<span class="pill bad">Failed</span>'}</td>
    <td class="num">${fmtInt(s.count)}</td>
    <td class="num">${fmtInt(perSource.get(s.name) || 0)}</td>
    <td class="small muted">${esc(s.error || "")}</td></tr>`).join("");

  // New and removed lists, with the data-analyst / all switch.
  const STEP = 25;
  let scope = "role";
  const shown = { new: STEP, removed: STEP };
  const sortRows = list => [...list].sort((a, b) => (b.in_role - a.in_role) || a.employer.localeCompare(b.employer) || a.title.localeCompare(b.title));

  function renderList(key, list, removedFlag) {
    const items = sortRows(scope === "role" ? list.filter(r => r.in_role) : list);
    $(`${key}-count`).textContent = fmtInt(items.length);
    $(`${key}-list`).innerHTML = items.slice(0, shown[key]).map(r => postingHTML(r, { removed: removedFlag, runDate: run })).join("")
      || `<li class="muted small">None${scope === "role" ? " in the data-analyst role" : ""}.</li>`;
    const more = $(`${key}-more`);
    more.hidden = items.length <= shown[key];
    more.textContent = `Show ${Math.min(STEP * 4, items.length - shown[key])} more`;
  }
  function render() { renderList("new", added, false); renderList("removed", removed, true); }

  document.querySelectorAll("[data-scope]").forEach(b => b.addEventListener("click", () => {
    scope = b.dataset.scope; shown.new = shown.removed = STEP;
    document.querySelectorAll("[data-scope]").forEach(x => x.setAttribute("aria-pressed", x === b));
    render();
  }));
  $("new-more").addEventListener("click", () => { shown.new += STEP * 4; render(); });
  $("removed-more").addEventListener("click", () => { shown.removed += STEP * 4; render(); });
  render();
})();
