// Market page: six findings, each computed here from data/history.csv.

(async () => {
  let data;
  try { data = await loadData(); } catch (e) { return showError(e); }
  chartDefaults();
  const { rows, status } = data;
  const last = status.run_date;
  const first = rows.reduce((m, r) => (r.first_seen < m ? r.first_seen : m), last);
  const days = dateRange(first, last);
  const $ = id => document.getElementById(id);
  $("span").textContent = `${fmtDate(first)} to ${fmtDate(last)} (${days.length} day${days.length === 1 ? "" : "s"})`;
  const MINT = "#3ee6a8", VIOLET = "#8b7bff", CORAL = "#ff6b81";

  function finding(id, head, text) {
    $(id).querySelector(".head").textContent = head;
    $(id).querySelector(".text").innerHTML = text;
    return $(id).querySelector("canvas");
  }
  const countBy = (list, key) => { const m = new Map(); for (const r of list) m.set(key(r), (m.get(key(r)) || 0) + 1); return m; };
  const median = xs => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  const plural = (n, w) => `${fmtInt(n)} ${w}${n === 1 ? "" : "s"}`;
  const notFirstRun = rows.filter(r => !r.first_run);

  // 1. New postings per day (all / data analyst), first-run postings left out.
  {
    const all = countBy(notFirstRun, r => r.first_seen);
    const role = countBy(notFirstRun.filter(r => r.in_role), r => r.first_seen);
    const a = days.map(d => all.get(d) || 0), b = days.map(d => role.get(d) || 0);
    const total = a.reduce((x, y) => x + y, 0), totalRole = b.reduce((x, y) => x + y, 0);
    const counted = days.length - 1;  // the first day has only first-run postings
    const best = days.reduce((m, d, i) => (a[i] > a[m] ? i : m), 0);
    const head = total
      ? `About ${fmtInt(Math.round(total / Math.max(counted, 1)))} new postings appear per day; ${fmtInt(totalRole)} so far are data-analyst roles`
      : "No new postings yet: the first run sets the baseline";
    const text = total
      ? `Across ${plural(counted, "day")} after the first run, the boards added ${plural(total, "posting")}, ${fmtPct(totalRole / total)} of them in the data-analyst role. The busiest day was ${fmtDate(days[best])} with ${fmtInt(a[best])}.`
      : "Every posting on the first day was already open when watching began, so none count as new. This chart fills in from the second run on.";
    new Chart(finding("f1", head, text), {
      type: "bar",
      data: { labels: days.map(fmtDate), datasets: [
        { label: "All postings", data: a, backgroundColor: MINT },
        { label: "Data analyst", data: b, backgroundColor: VIOLET }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }

  // 2. Removed postings per day.
  {
    const rem = countBy(rows.filter(r => r.removed_date), r => r.removed_date);
    const remRole = countBy(rows.filter(r => r.removed_date && r.in_role), r => r.removed_date);
    const a = days.map(d => rem.get(d) || 0), b = days.map(d => remRole.get(d) || 0);
    const total = a.reduce((x, y) => x + y, 0);
    const best = days.reduce((m, d, i) => (a[i] > a[m] ? i : m), 0);
    const head = total ? `${fmtInt(total)} postings have been taken down, the most on ${fmtDate(days[best])}` : "No postings removed yet";
    const text = total
      ? `A posting counts as removed on the first day its board no longer lists it. ${fmtInt(b.reduce((x, y) => x + y, 0))} of the removed postings were data-analyst roles.`
      : "A posting is removed on the first day its board stops listing it, so removals can only show up from the second run on.";
    new Chart(finding("f2", head, text), {
      type: "bar",
      data: { labels: days.map(fmtDate), datasets: [
        { label: "All postings", data: a, backgroundColor: CORAL },
        { label: "Data analyst", data: b, backgroundColor: VIOLET }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }

  // 3. Open postings per employer as of the last run.
  {
    const open = rows.filter(r => r.status === "open");
    const all = countBy(open, r => r.employer), role = countBy(open.filter(r => r.in_role), r => r.employer);
    const emps = [...all.keys()].sort((x, y) => all.get(y) - all.get(x));
    const top = emps[0], topRole = [...role.keys()].sort((x, y) => role.get(y) - role.get(x))[0];
    const head = top ? `${top} has the most open postings (${fmtInt(all.get(top))}); ${topRole || "no one"} has the most data-analyst openings` : "No open postings";
    const text = `${plural(open.length, "posting")} are open across ${plural(emps.length, "employer")}. ` +
      (topRole ? `${topRole} lists ${fmtInt(role.get(topRole))} data-analyst roles, ${fmtPct(role.get(topRole) / all.get(topRole))} of its openings.` : "");
    new Chart(finding("f3", head, text), {
      type: "bar",
      data: { labels: emps, datasets: [
        { label: "Data analyst", data: emps.map(e => role.get(e) || 0), backgroundColor: VIOLET, stack: "s" },
        { label: "Other roles", data: emps.map(e => all.get(e) - (role.get(e) || 0)), backgroundColor: MINT, stack: "s" }] },
      options: { indexAxis: "y", scales: { x: { stacked: true, beginAtZero: true }, y: { stacked: true, ticks: { autoSkip: false } } } },
    });
  }

  // 4. Days open for removed, non-first-run postings: the median.
  {
    const closed = notFirstRun.filter(r => r.removed_date);
    const d = closed.map(r => daysBetween(r.first_seen, r.removed_date));
    const med = median(d);
    const hist = countBy(d, x => x);
    const maxD = d.length ? Math.max(...d) : 0;
    const labels = Array.from({ length: maxD + 1 }, (_, i) => i);
    const head = med == null ? "Not enough history yet to measure how long postings stay open"
      : `The median posting stays up ${med} day${med === 1 ? "" : "s"} before it is removed`;
    const text = med == null
      ? "This needs postings that were first seen after the first run and have since been removed. It fills in as the history grows."
      : `Based on ${plural(closed.length, "posting")} first seen after the watch began and since removed. ` +
        `The postings still open are not counted yet, so this median will rise as longer-running postings close.`;
    new Chart(finding("f4", head, text), {
      type: "bar",
      data: { labels: labels.map(x => `${x} d`), datasets: [{ label: "Removed postings", data: labels.map(x => hist.get(x) || 0), backgroundColor: VIOLET }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { title: { display: true, text: "Days from first seen to removed" } } } },
    });
  }

  // 5. Share removed within seven days.
  {
    const eligible = notFirstRun.filter(r => daysBetween(r.first_seen, last) >= 7);
    const quick = eligible.filter(r => r.removed_date && daysBetween(r.first_seen, r.removed_date) <= 7);
    const share = eligible.length ? quick.length / eligible.length : null;
    const head = share == null ? "Not enough history yet: this needs postings first seen at least 7 days ago"
      : `${fmtPct(share)} of new postings are gone within a week`;
    const text = share == null
      ? `The first postings that qualify are those first seen on the second run; they become eligible 7 days later. ${plural(notFirstRun.length, "posting")} are waiting.`
      : `Of ${plural(eligible.length, "posting")} first seen at least a week before the last run, ${fmtInt(quick.length)} were removed within 7 days. Apply early.`;
    new Chart(finding("f5", head, text), {
      type: "doughnut",
      data: { labels: ["Removed within 7 days", "Still up after 7 days"],
        datasets: [{ data: share == null ? [0, 1] : [quick.length, eligible.length - quick.length], backgroundColor: share == null ? ["#333b55", "#333b55"] : [CORAL, MINT], borderWidth: 0 }] },
      options: { cutout: "65%", plugins: { tooltip: { enabled: share != null } } },
    });
  }

  // 6. Top locations among open postings.
  {
    const open = rows.filter(r => r.status === "open" && r.location);
    const all = countBy(open, r => r.location), role = countBy(open.filter(r => r.in_role), r => r.location);
    const top = [...all.keys()].sort((x, y) => all.get(y) - all.get(x)).slice(0, 15);
    const head = top.length ? `${top[0]} leads with ${fmtInt(all.get(top[0]))} open postings` : "No locations yet";
    const remote = open.filter(r => /remote/i.test(r.location)).length;
    const text = `Locations are counted exactly as each board writes them. ${fmtInt(remote)} open postings (${fmtPct(remote / Math.max(open.length, 1))}) mention "remote".`;
    new Chart(finding("f6", head, text), {
      type: "bar",
      data: { labels: top, datasets: [
        { label: "Data analyst", data: top.map(l => role.get(l) || 0), backgroundColor: VIOLET, stack: "s" },
        { label: "Other roles", data: top.map(l => all.get(l) - (role.get(l) || 0)), backgroundColor: MINT, stack: "s" }] },
      options: { indexAxis: "y", scales: { x: { stacked: true, beginAtZero: true }, y: { stacked: true, ticks: { autoSkip: false } } } },
    });
  }
})();
