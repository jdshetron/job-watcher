"""Command line entry point.

    python -m watcher run      # fetch every board, build history, write status and run log
    python -m watcher build    # rebuild data/history.csv from data/raw/ only
    python -m watcher issue    # open/update today's GitHub Issue (needs GITHUB_TOKEN)
"""

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

from .build import read_history, write_history
from .fetch import fetch_all
from .issue import issue_body, sync_issue
from .status import append_run_log, latest_changes, make_status, write_status

DATA = Path("data")
RAW = DATA / "raw"
HISTORY = DATA / "history.csv"
STATUS = DATA / "status.json"
RUN_LOG = DATA / "run_log.csv"


def utc_now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def cmd_run(run_date=None):
    now = utc_now()
    run_date = (run_date or now.date()).isoformat()
    results = fetch_all(dt.date.fromisoformat(run_date), RAW)
    rows = write_history(RAW, HISTORY)
    for r in results:
        r["count"] = sum(1 for row in rows if row["source"] == r["name"] and row["last_seen"] == run_date) if r["ok"] else 0
    run_time = now.isoformat().replace("+00:00", "Z")
    append_run_log(RUN_LOG, run_time, run_date, results)
    status = make_status(rows, RAW, run_time, run_date, results)
    write_status(STATUS, status)
    ok = sum(r["ok"] for r in results)
    print(f"{ok}/{len(results)} sources ok; {len(rows)} postings in history, {status['open']} open; "
          f"new today {status['new_today']}, removed today {status['removed_today']}")


def cmd_build():
    rows = write_history(RAW, HISTORY)
    print(f"wrote {HISTORY} with {len(rows)} rows")


def cmd_issue():
    status = json.loads(STATUS.read_text(encoding="utf-8"))
    new, removed = latest_changes(read_history(HISTORY), status["run_date"])
    body = issue_body(status, new, removed)
    repo, token = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
    if not (repo and token):
        print(body)
        print("GITHUB_REPOSITORY / GITHUB_TOKEN not set; issue not posted.")
        return
    print(f"issue #{sync_issue(repo, token, status['run_date'], body)} is up to date")


def main(argv=None):
    p = argparse.ArgumentParser(prog="watcher")
    p.add_argument("command", choices=["run", "build", "issue"])
    p.add_argument("--date", help="override the UTC run date (YYYY-MM-DD), for testing")
    args = p.parse_args(argv)
    if args.command == "run":
        cmd_run(dt.date.fromisoformat(args.date) if args.date else None)
    elif args.command == "build":
        cmd_build()
    else:
        cmd_issue()


if __name__ == "__main__":
    sys.exit(main())
