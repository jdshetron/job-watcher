// Browse page: open postings with the role switch, filters, title search, sort by first-seen
// date, apply links, and a starred shortlist kept in localStorage.

(async () => {
  let data;
  try { data = await loadData(); } catch (e) { return showError(e); }
  const { rows, status } = data;
  const run = status.run_date;
  const $ = id => document.getElementById(id);
  const open = rows.filter(r => r.status === "open");
  const byId = new Map(rows.map(r => [r.posting_id, r]));
  const STEP = 40;
  let scope = "role", shown = STEP;
  let stars = getShortlist();

  // Filter options.
  const employers = [...new Set(open.map(r => r.employer))].sort((a, b) => a.localeCompare(b));
  $("employer").insertAdjacentHTML("beforeend", employers.map(e => `<option>${esc(e)}</option>`).join(""));
  const locCount = new Map();
  for (const r of open) if (r.location) locCount.set(r.location, (locCount.get(r.location) || 0) + 1);
  $("locations").innerHTML = [...locCount].sort((a, b) => b[1] - a[1]).slice(0, 300)
    .map(([l]) => `<option value="${esc(l)}">`).join("");

  function filtered() {
    const q = $("q").value.trim().toLowerCase();
    const emp = $("employer").value;
    const loc = $("location").value.trim().toLowerCase();
    const [lo, hi] = $("days").value ? $("days").value.split("-").map(Number) : [null, null];
    const list = open.filter(r => {
      if (scope === "role" && !r.in_role) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (emp && r.employer !== emp) return false;
      if (loc && !r.location.toLowerCase().includes(loc)) return false;
      if (lo != null) { const d = daysBetween(r.first_seen, run); if (d < lo || d > hi) return false; }
      return true;
    });
    const dir = $("sort").value === "old" ? 1 : -1;
    return list.sort((a, b) => dir * a.first_seen.localeCompare(b.first_seen) || a.employer.localeCompare(b.employer) || a.title.localeCompare(b.title));
  }

  function renderShortlist() {
    // A starred posting stays on the list after it is removed from the board, marked as removed.
    const items = [...stars].map(id => byId.get(id)).filter(Boolean);
    $("short-count").textContent = items.length;
    $("short-empty").hidden = items.length > 0;
    $("shortlist").innerHTML = items.map(r => postingHTML(r, { star: true, starred: true, removed: r.status === "removed", runDate: run })).join("");
  }
  function renderResults() {
    const list = filtered();
    $("result-count").textContent = `${fmtInt(list.length)} open posting${list.length === 1 ? "" : "s"}`;
    $("results").innerHTML = list.slice(0, shown).map(r => postingHTML(r, { star: true, starred: stars.has(r.posting_id), runDate: run })).join("")
      || '<li class="muted">No postings match these filters.</li>';
    $("more").hidden = list.length <= shown;
    $("more").textContent = `Show more (${fmtInt(list.length - shown)} left)`;
  }
  const reset = () => { shown = STEP; renderResults(); };

  document.addEventListener("click", e => {
    const b = e.target.closest(".star");
    if (!b) return;
    stars = getShortlist();
    stars.has(b.dataset.id) ? stars.delete(b.dataset.id) : stars.add(b.dataset.id);
    setShortlist(stars);
    renderShortlist(); renderResults();
  });
  document.querySelectorAll("[data-scope]").forEach(b => b.addEventListener("click", () => {
    scope = b.dataset.scope;
    document.querySelectorAll("[data-scope]").forEach(x => x.setAttribute("aria-pressed", x === b));
    reset();
  }));
  for (const id of ["q", "location"]) $(id).addEventListener("input", reset);
  for (const id of ["employer", "days", "sort"]) $(id).addEventListener("change", reset);
  $("more").addEventListener("click", () => { shown += STEP * 2; renderResults(); });

  renderShortlist(); renderResults();
})();
