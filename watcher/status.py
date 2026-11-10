"""Step 3 of a run: data/status.json and the run log (every source's result on every run)."""

import csv
import json
from pathlib import Path

from .build import raw_files

LOG_COLUMNS = ["run_time", "date", "source", "ok", "count", "error"]


def append_run_log(path, run_time, run_date, results):
    path = Path(path)
    new = not path.exists()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        if new:
            w.writerow(LOG_COLUMNS)
        for r in results:
            w.writerow([run_time, run_date, r["name"], "true" if r["ok"] else "false", r["count"], r["error"]])


def latest_changes(rows, run_date):
    """Postings first seen on run_date (not first-run ones) and postings removed on run_date."""
    new = [r for r in rows if r["first_seen"] == run_date and not r["first_run"]]
    removed = [r for r in rows if r["removed_date"] == run_date]
    return new, removed


def make_status(rows, raw_dir, run_time, run_date, results):
    files = raw_files(raw_dir)
    new, removed = latest_changes(rows, run_date)
    return {
        "run_time": run_time,
        "run_date": run_date,
        "first_run_date": next(iter(files), None),
        "days_with_success": len(files),
        "open": sum(1 for r in rows if r["status"] == "open"),
        "open_in_role": sum(1 for r in rows if r["status"] == "open" and r["in_role"]),
        "new_today": len(new),
        "removed_today": len(removed),
        "sources": [{"name": r["name"], "employer": r["employer"], "ats": r["ats"], "ok": r["ok"],
                     "count": r["count"], "error": r["error"]} for r in results],
    }


def write_status(path, status):
    Path(path).write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8", newline="")
