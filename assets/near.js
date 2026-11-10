// Near me page: open postings within a radius of home (or the device's location), on a map,
// ranked by fit with the resume in assets/profile.js.

(async () => {
  const $ = id => document.getElementById(id);
  const HOME_KEY = "job-watcher.home";

  // Profile card.
  $("first-name").textContent = PROFILE.firstName;
  $("p-name").textContent = PROFILE.name;
  $("p-headline").textContent = PROFILE.headline;
  $("p-edu").textContent = PROFILE.education;
  $("p-skills").innerHTML = ["SQL", "Power BI", "Business intelligence", "Power Automate", "Excel", "SAP / ERP", "Salesforce"]
    .map(s => `<span class="chip">${esc(s)}</span>`).join("");
  $("p-portfolio").href = PROFILE.portfolio;
  $("p-resume").href = $("resume-link").href = PROFILE.resume;
  $("fit-explain").textContent = "Ranked by fit: titles that mention your skills (SQL, Power BI, BI, reporting, analytics, business analyst…) and match your level score highest.";

  let data;
  try { data = await loadData(); } catch (e) { return showError(e); }
  const { rows, status } = data;
  const run = status.run_date;
  const HINT = { "uark-system": "AR", tyson: "AR" };

  // Every open posting with its places and fit, computed once.
  const open = rows.filter(r => r.status === "open").map(r => {
    const loc = locate(r.location, HINT[r.source]);
    return { r, loc, fit: fitScore(r) };
  });
  const usPlaces = PLACES.filter(p => /^[A-Z]{2}$/.test(p[1]) && !p[0].includes(",")).map(p => `${p[0]}, ${p[1]}`);
  $("home-list").innerHTML = [...new Set(usPlaces)].sort().map(l => `<option value="${esc(l)}">`).join("");

  // Home and settings, remembered in this browser.
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(HOME_KEY) || "{}"); } catch { /* ignore */ }
  let home = saved.home || PROFILE.home;
  $("home").value = home.label;
  $("radius").value = String(saved.radius || PROFILE.defaultRadius);
  if (saved.scope) $("scope").value = saved.scope;
  if (saved.remote === false) $("remote").checked = false;
  const save = () => { try { localStorage.setItem(HOME_KEY, JSON.stringify({ home, radius: +$("radius").value, scope: $("scope").value, remote: $("remote").checked })); } catch { /* ignore */ } };

  // Map.
  let map = null, layer = null;
  if (window.L) {
    map = L.map("map", { scrollWheelZoom: false, attributionControl: true })
      .setView([home.lat, home.lon], 7);  // a view must exist before the radius circle can be measured
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, className: "map-tiles",  // darkened in style.css to match the theme
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
  } else {
    $("map").innerHTML = '<p class="muted" style="padding:20px">The map needs an internet connection; the lists below still work.</p>';
  }

  const STEP = 30;
  let shown = STEP;
  let current = [];

  function inScope(x) {
    const s = $("scope").value;
    return s === "all" || (s === "role" ? x.r.in_role : x.fit.score >= 4);
  }
  function compute() {
    const radius = +$("radius").value, withRemote = $("remote").checked;
    const near = [], remote = [];
    for (const x of open) {
      let best = null;
      for (const p of x.loc.places) {
        if (!/^[A-Z]{2}$/.test(p.region)) continue;  // distance only within the US
        const d = milesBetween(home, p);
        if (!best || d < best.d) best = { d, p };
      }
      if (best && best.d <= radius) near.push({ ...x, dist: best.d, place: best.p });
      else if (withRemote && x.loc.remote && !x.loc.places.some(p => !/^[A-Z]{2}$/.test(p.region))
               && !/canada|uk\b|united kingdom|india|europe|emea|apac|latam|mexico|brazil/i.test(x.r.location)) {
        remote.push({ ...x, dist: null, place: null });
      }
    }
    return { near, remote, radius };
  }

  function card(x) {
    const label = fitLabel(x.fit.score);
    const where = x.dist == null ? "🌐 Remote" : `📍 ${Math.round(x.dist)} mi · ${x.place.label}`;
    const why = x.fit.reasons.length ? `Matches: ${x.fit.reasons.slice(0, 4).join(", ")}` : "";
    return postingHTML(x.r, { star: true, starred: getShortlist().has(x.r.posting_id), runDate: run,
      extra: `${label ? `<span class="pill fit">${label}</span>` : ""}<span class="pill dist">${esc(where)}</span>`,
      note: why });
  }

  function render() {
    save();
    const { near, remote, radius } = compute();
    const all = [...near, ...remote];
    const scoped = all.filter(inScope);
    $("home-label").textContent = home.label;
    $("n-in").textContent = fmtInt(near.length);
    $("n-in-sub").textContent = `within ${radius} mi · ${fmtInt(near.filter(x => x.r.in_role).length)} data analyst`;
    $("n-fit").textContent = fmtInt(all.filter(x => x.fit.score >= 4).length);
    $("n-remote").textContent = $("remote").checked ? fmtInt(remote.length) : "off";
    $("n-remote-sub").textContent = $("remote").checked ? `${fmtInt(remote.filter(x => x.r.in_role).length)} data analyst` : "";
    const closest = [...near].sort((a, b) => a.dist - b.dist)[0];
    $("n-close").textContent = closest ? closest.r.employer : "—";
    $("n-close-sub").textContent = closest ? `${Math.round(closest.dist)} mi · ${closest.place.label}` : `none within ${radius} mi`;

    // Best fits: highest score, nearby before remote on ties.
    const best = all.filter(x => x.fit.score >= 4)
      .sort((a, b) => b.fit.score - a.fit.score || (a.dist ?? 1e9) - (b.dist ?? 1e9) || b.r.first_seen.localeCompare(a.r.first_seen))
      .slice(0, 8);
    $("best-count").textContent = best.length;
    $("best").innerHTML = best.map(card).join("") || `<li class="muted">No strong fits in range. Try a bigger radius or turn on remote.</li>`;

    // Full list.
    const sort = $("sort").value;
    current = scoped.sort((a, b) =>
      sort === "dist" ? (a.dist ?? 1e9) - (b.dist ?? 1e9) || b.fit.score - a.fit.score
      : sort === "new" ? b.r.first_seen.localeCompare(a.r.first_seen) || b.fit.score - a.fit.score
      : b.fit.score - a.fit.score || (a.dist ?? 1e9) - (b.dist ?? 1e9));
    $("list-title").textContent = `${fmtInt(current.length)} ${$("scope").selectedOptions[0].text.toLowerCase()} in range`;
    renderList();

    // Map: home, radius, and a circle per town.
    if (map) {
      layer.clearLayers();
      const ring = L.circle([home.lat, home.lon], { radius: radius * 1609.34, color: "#8b7bff", weight: 1.5, fillOpacity: 0.05 }).addTo(layer);
      L.circleMarker([home.lat, home.lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#8b7bff", fillOpacity: 1 })
        .bindTooltip(`Home: ${esc(home.label)}`).addTo(layer);
      const towns = new Map();
      for (const x of near.filter(inScope)) {
        const t = towns.get(x.place.label) || { p: x.place, items: [] };
        t.items.push(x); towns.set(x.place.label, t);
      }
      for (const t of towns.values()) {
        const n = t.items.length;
        const top = [...t.items].sort((a, b) => b.fit.score - a.fit.score).slice(0, 6);
        L.circleMarker([t.p.lat, t.p.lon], { radius: 6 + Math.sqrt(n) * 3, color: "#3ee6a8", weight: 1.5, fillColor: "#3ee6a8", fillOpacity: .35 })
          .bindPopup(`<strong>${esc(t.p.label)}</strong> · ${n} posting${n === 1 ? "" : "s"}<br>` +
            top.map(x => `<a href="${esc(x.r.url)}" target="_blank" rel="noopener">${esc(x.r.title)}</a> <span style="opacity:.7">· ${esc(x.r.employer)}</span>`).join("<br>") +
            (n > top.length ? `<br><em>+${n - top.length} more in the list below</em>` : ""))
          .addTo(layer);
      }
      map.fitBounds(ring.getBounds(), { padding: [10, 10] });
    }
  }
  function renderList() {
    $("list").innerHTML = current.slice(0, shown).map(card).join("") || '<li class="muted">Nothing in range. Try a bigger radius, "All postings", or turning on remote.</li>';
    $("more").hidden = current.length <= shown;
    $("more").textContent = `Show more (${fmtInt(current.length - shown)} left)`;
  }

  function setHomeFromText() {
    const loc = locate($("home").value);
    const p = loc.places.find(q => /^[A-Z]{2}$/.test(q.region));
    if (p) { home = { label: p.label, lat: p.lat, lon: p.lon }; shown = STEP; render(); }
  }
  $("home").addEventListener("change", setHomeFromText);
  for (const id of ["radius", "scope", "remote", "sort"]) $(id).addEventListener("change", () => { shown = STEP; render(); });
  $("more").addEventListener("click", () => { shown += STEP * 2; renderList(); });
  $("geo").addEventListener("click", () => {
    const msg = $("geo-msg");
    if (!navigator.geolocation) { msg.hidden = false; msg.textContent = "This browser can't share its location."; return; }
    msg.hidden = false; msg.textContent = "Finding your location…";
    navigator.geolocation.getCurrentPosition(pos => {
      const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      // Label it with the nearest town in the list.
      const near = PLACES.filter(p => /^[A-Z]{2}$/.test(p[1])).map(p => ({ p, d: milesBetween(here, { lat: p[2], lon: p[3] }) })).sort((a, b) => a.d - b.d)[0];
      home = { ...here, label: near && near.d < 40 ? `near ${near.p[0]}, ${near.p[1]}` : "your location" };
      $("home").value = home.label; msg.hidden = true; shown = STEP; render();
    }, err => { msg.textContent = `Couldn't get your location (${err.message}).`; }, { timeout: 10000 });
  });
  document.addEventListener("click", e => {
    const b = e.target.closest(".star");
    if (!b) return;
    const s = getShortlist();
    s.has(b.dataset.id) ? s.delete(b.dataset.id) : s.add(b.dataset.id);
    setShortlist(s);
    b.setAttribute("aria-pressed", s.has(b.dataset.id)); b.textContent = s.has(b.dataset.id) ? "★" : "☆";
  });
  render();
})();
