"""Step 2 of a run: build data/history.csv from the raw files alone.

Day by day, for each source that has a raw file that day:
  * a posting seen for the first time gets that day as first_seen;
  * every posting listed that day gets that day as last_seen (and its latest title, location...);
  * an open posting of that source that is not listed is marked removed with that day's date;
  * a removed posting that is listed again is open again, removed_date cleared, first_seen kept.
A source with no raw file on a day (it failed) changes nothing that day.
"""

import csv
import io
import re
from pathlib import Path

from .convert import convert
from .fetch import read_raw
from .role import in_role

COLUMNS = ["posting_id", "source", "source_id", "employer", "title", "location", "department",
           "posted_date", "url", "in_role", "first_run", "first_seen", "last_seen", "status",
           "removed_date"]
DATE_DIR = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def raw_files(raw_dir):
    """{date: {source: path}} for every raw file, dates in order."""
    out = {}
    root = Path(raw_dir)
    if not root.exists():
        return out
    for day in sorted(p for p in root.iterdir() if p.is_dir() and DATE_DIR.match(p.name)):
        files = {f.name[:-len(".json.gz")]: f for f in sorted(day.glob("*.json.gz"))}
        if files:
            out[day.name] = files
    return out


def update(history, source, day, postings, first_day):
    """Apply one source's listing on one day to `history` (posting_id -> row)."""
    listed = set()
    for p in postings:
        pid = f"{source}:{p['source_id']}"
        listed.add(pid)
        row = history.get(pid)
        if row is None:
            row = history[pid] = {"posting_id": pid, "first_seen": day,
                                  "first_run": day == first_day}
        row.update(p)
        row["in_role"] = in_role(p["title"])
        row["last_seen"] = day
        row["status"] = "open"
        row["removed_date"] = ""
    for pid, row in history.items():
        if row["source"] == source and row["status"] == "open" and pid not in listed:
            row["status"] = "removed"
            row["removed_date"] = day


def build_rows(raw_dir):
    files = raw_files(raw_dir)
    first_day = {}
    for day, by_source in files.items():
        for source in by_source:
            first_day.setdefault(source, day)
    history = {}
    for day, by_source in files.items():
        for source, path in by_source.items():
            update(history, source, day, convert(read_raw(path), day), first_day[source])
    return [history[k] for k in sorted(history)]


def _cell(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    return "" if v is None else str(v)


def to_csv(rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(COLUMNS)
    for r in rows:
        w.writerow([_cell(r.get(c)) for c in COLUMNS])
    return buf.getvalue()


def write_history(raw_dir, path):
    rows = build_rows(raw_dir)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(to_csv(rows), encoding="utf-8", newline="")
    return rows


def read_history(path):
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["in_role"] = r["in_role"] == "true"
        r["first_run"] = r["first_run"] == "true"
    return rows
