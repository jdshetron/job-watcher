"""Step 4 of a run: open (or update) the GitHub Issue for the day and close the previous one."""

import requests

LABEL = "daily-report"
API = "https://api.github.com"
MAX_BODY = 60000  # GitHub allows 65,536 characters


def _line(r):
    star = " ⭐ **data analyst**" if r["in_role"] else ""
    where = f" · {r['location']}" if r["location"] else ""
    return f"- [{r['title'] or '(no title)'}]({r['url']}) · {r['employer']}{where}{star}"


def _section(title, rows):
    rows = sorted(rows, key=lambda r: (not r["in_role"], r["employer"], r["title"]))
    lines = [f"## {title} ({len(rows)})", ""]
    lines += [_line(r) for r in rows] or ["None."]
    return lines


def issue_body(status, new, removed):
    lines = [f"Daily report for **{status['run_date']}** (run at {status['run_time']}).", "",
             f"Open postings: **{status['open']:,}** ({status['open_in_role']:,} in the data-analyst role) · "
             f"new today: **{status['new_today']}** · removed today: **{status['removed_today']}** · "
             f"days with a successful run: **{status['days_with_success']}**", "",
             "Postings in the data-analyst role are listed first and marked ⭐."]
    if status["first_run_date"] == status["run_date"]:
        lines += ["", "This is the first run: every posting was already open, so none count as new."]
    head = "\n".join(lines)
    tail = ["", "## Sources", ""]
    for s in status["sources"]:
        state = f"ok, {s['count']} postings" if s["ok"] else f"FAILED ({s['error']})"
        tail.append(f"- {s['employer']} ({s['ats']}): {state}")
    tail = "\n".join(tail)
    body = []
    for part in (_section("New postings", new), [""], _section("Removed postings", removed)):
        body += part
    text = "\n".join(body)
    room = MAX_BODY - len(head) - len(tail) - 200
    if len(text) > room:  # too long for one issue: cut and point to the site
        text = text[:room].rsplit("\n", 1)[0] + "\n\n…list cut to fit the issue; the full lists are on the Today page."
    return f"{head}\n\n{text}\n{tail}\n"


def sync_issue(repo, token, title, body, session=None):
    """Create or update the issue titled `title`; close every other open daily issue."""
    s = session or requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
    existing = s.get(f"{API}/repos/{repo}/issues",
                     params={"state": "all", "labels": LABEL, "per_page": 100}, timeout=30)
    existing.raise_for_status()
    issues = [i for i in existing.json() if "pull_request" not in i]
    match = next((i for i in issues if i["title"] == title), None)
    if match:
        r = s.patch(f"{API}/repos/{repo}/issues/{match['number']}",
                    json={"body": body, "state": "open"}, timeout=30)
    else:
        r = s.post(f"{API}/repos/{repo}/issues",
                   json={"title": title, "body": body, "labels": [LABEL]}, timeout=30)
    r.raise_for_status()
    number = r.json()["number"]
    for i in issues:
        if i["state"] == "open" and i["title"] != title:
            s.patch(f"{API}/repos/{repo}/issues/{i['number']}",
                    json={"state": "closed"}, timeout=30).raise_for_status()
    return number
