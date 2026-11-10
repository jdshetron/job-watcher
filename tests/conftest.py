import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from watcher.fetch import write_raw  # noqa: E402


def greenhouse_payload(source, jobs, employer="Acme"):
    """A raw Greenhouse file listing `jobs` = [(id, title), ...]."""
    return {"source": source, "employer": employer, "ats": "greenhouse", "settings": {"board": source},
            "requests": [],
            "responses": [{"jobs": [{"id": i, "title": t, "location": {"name": "Remote"},
                                     "absolute_url": f"https://x/{i}",
                                     "first_published": "2026-11-01T09:00:00-05:00"} for i, t in jobs]},
                          {"departments": []}]}


def put_day(raw, day, source, jobs):
    write_raw(Path(raw) / day / f"{source}.json.gz", greenhouse_payload(source, jobs))
