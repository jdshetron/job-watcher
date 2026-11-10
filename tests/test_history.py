"""First seen, last seen, removed and reopened logic, plus the run around it."""

import datetime as dt
from pathlib import Path

import requests

from conftest import greenhouse_payload, put_day
from watcher import fetch
from watcher.build import COLUMNS, build_rows, to_csv, write_history
from watcher.issue import issue_body
from watcher.status import latest_changes, make_status


def by_id(rows):
    return {r["posting_id"]: r for r in rows}


def test_first_seen_last_seen_and_first_run(tmp_path):
    put_day(tmp_path, "2026-11-01", "acme", [(1, "Data Analyst"), (2, "Engineer")])
    put_day(tmp_path, "2026-11-02", "acme", [(1, "Data Analyst"), (2, "Engineer"), (3, "BI Analyst")])
    h = by_id(build_rows(tmp_path))
    assert h["acme:1"]["first_seen"] == "2026-11-01" and h["acme:1"]["last_seen"] == "2026-11-02"
    assert h["acme:1"]["first_run"] is True and h["acme:3"]["first_run"] is False
    assert h["acme:3"]["first_seen"] == "2026-11-02" and h["acme:3"]["status"] == "open"
    assert h["acme:1"]["in_role"] is True and h["acme:2"]["in_role"] is False


def test_removed_then_reopened(tmp_path):
    put_day(tmp_path, "2026-11-01", "acme", [(1, "A"), (2, "B")])
    put_day(tmp_path, "2026-11-02", "acme", [(1, "A")])
    h = by_id(build_rows(tmp_path))
    assert (h["acme:2"]["status"], h["acme:2"]["removed_date"], h["acme:2"]["last_seen"]) == \
        ("removed", "2026-11-02", "2026-11-01")
    put_day(tmp_path, "2026-11-03", "acme", [(1, "A"), (2, "B")])
    h = by_id(build_rows(tmp_path))
    assert (h["acme:2"]["status"], h["acme:2"]["removed_date"]) == ("open", "")
    assert h["acme:2"]["first_seen"] == "2026-11-01" and h["acme:2"]["last_seen"] == "2026-11-03"


def test_failed_source_day_removes_nothing(tmp_path):
    put_day(tmp_path, "2026-11-01", "acme", [(1, "A")])
    put_day(tmp_path, "2026-11-01", "beta", [(9, "B")])
    put_day(tmp_path, "2026-11-02", "beta", [(9, "B")])  # acme failed on 11-02: no file
    h = by_id(build_rows(tmp_path))
    assert h["acme:1"]["status"] == "open" and h["acme:1"]["last_seen"] == "2026-11-01"


def test_source_added_later_has_its_own_first_run(tmp_path):
    put_day(tmp_path, "2026-11-01", "acme", [(1, "A")])
    put_day(tmp_path, "2026-11-02", "acme", [(1, "A")])
    put_day(tmp_path, "2026-11-02", "beta", [(9, "B")])
    assert by_id(build_rows(tmp_path))["beta:9"]["first_run"] is True


def test_title_change_updates_row(tmp_path):
    put_day(tmp_path, "2026-11-01", "acme", [(1, "Engineer")])
    put_day(tmp_path, "2026-11-02", "acme", [(1, "Data Analyst")])
    r = by_id(build_rows(tmp_path))["acme:1"]
    assert r["title"] == "Data Analyst" and r["in_role"] is True


def test_sorted_columns_and_reproducible(tmp_path):
    put_day(tmp_path, "2026-11-01", "zeta", [(5, "A")])
    put_day(tmp_path, "2026-11-01", "acme", [(20, "B"), (3, "C")])
    a = write_history(tmp_path, tmp_path / "h1.csv")
    write_history(tmp_path, tmp_path / "h2.csv")
    assert (tmp_path / "h1.csv").read_bytes() == (tmp_path / "h2.csv").read_bytes()
    ids = [r["posting_id"] for r in a]
    assert ids == sorted(ids)
    assert (tmp_path / "h1.csv").read_text(encoding="utf-8").splitlines()[0] == ",".join(COLUMNS)


def test_empty_values_and_booleans_in_csv(tmp_path):
    put_day(tmp_path, "2026-11-01", "acme", [(1, "Data Analyst")])
    line = to_csv(build_rows(tmp_path)).splitlines()[1].split(",")
    row = dict(zip(COLUMNS, line))
    assert row["department"] == "" and row["removed_date"] == ""
    assert row["in_role"] == "true" and row["first_run"] == "true"


def test_status_counts_and_changes(tmp_path):
    put_day(tmp_path, "2026-11-01", "acme", [(1, "A"), (2, "B")])
    put_day(tmp_path, "2026-11-02", "acme", [(1, "A"), (3, "Data Analyst")])
    rows = build_rows(tmp_path)
    results = [{"name": "acme", "employer": "Acme", "ats": "greenhouse", "ok": True, "count": 2, "error": ""},
               {"name": "beta", "employer": "Beta", "ats": "lever", "ok": False, "count": 0, "error": "HTTPError"}]
    s = make_status(rows, tmp_path, "2026-11-02T13:00:00Z", "2026-11-02", results)
    assert (s["first_run_date"], s["days_with_success"], s["open"]) == ("2026-11-01", 2, 2)
    assert (s["new_today"], s["removed_today"], s["open_in_role"]) == (1, 1, 1)
    assert [x["ok"] for x in s["sources"]] == [True, False]
    new, removed = latest_changes(rows, "2026-11-02")
    body = issue_body(s, new, removed)
    assert "[Data Analyst](https://x/3)" in body and "[B](https://x/2)" in body and "FAILED" in body


def test_first_run_postings_are_not_new(tmp_path):
    put_day(tmp_path, "2026-11-01", "acme", [(1, "A")])
    new, _ = latest_changes(build_rows(tmp_path), "2026-11-01")
    assert new == []


def test_issue_on_quiet_day():
    s = {"run_date": "2026-11-02", "run_time": "t", "open": 0, "open_in_role": 0, "new_today": 0,
         "removed_today": 0, "days_with_success": 2, "first_run_date": "2026-11-01", "sources": []}
    body = issue_body(s, [], [])
    assert body.count("None.") == 2


def test_fetch_all_survives_a_failing_source_and_rerun_replaces_day(tmp_path):
    srcs = [{"name": "good", "employer": "G", "ats": "greenhouse"},
            {"name": "bad", "employer": "B", "ats": "lever"}]

    def fetcher(src, s):
        if src["name"] == "bad":
            raise requests.HTTPError("403 Forbidden")
        return greenhouse_payload("good", [(1, "A")])

    day = dt.date(2026, 11, 2)
    stale = tmp_path / "2026-11-02" / "old.json.gz"
    stale.parent.mkdir(parents=True)
    stale.write_bytes(b"x")
    results = fetch.fetch_all(day, tmp_path, sources=srcs, fetcher=fetcher)
    assert [(r["name"], r["ok"]) for r in results] == [("good", True), ("bad", False)]
    assert "403" in results[1]["error"]
    assert sorted(p.name for p in (tmp_path / "2026-11-02").iterdir()) == ["good.json.gz"]


class FakeResp:
    def __init__(self, code, body=None, headers=None):
        self.status_code, self._body, self.headers = code, body, headers or {}

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(str(self.status_code))


class FakeSession:
    def __init__(self, answers):
        self.answers, self.calls = list(answers), []

    def request(self, method, url, **kw):
        self.calls.append((method, url, kw))
        return self.answers.pop(0)


def test_call_retries_rate_limit():
    s = FakeSession([FakeResp(429, headers={"retry-after": "1"}), FakeResp(200, {"ok": 1})])
    waits = []
    assert fetch.call(s, "GET", "u", sleep=waits.append) == {"ok": 1}
    assert waits == [1.0]


def test_workday_pages_until_total():
    pages = [FakeResp(200, {"total": 45, "jobPostings": [{"title": str(i)} for i in range(20)]}),
             FakeResp(200, {"total": 0, "jobPostings": [{"title": str(i)} for i in range(20)]}),
             FakeResp(200, {"total": 0, "jobPostings": [{"title": "x"}] * 5})]
    s = FakeSession(pages)
    src = {"name": "w", "employer": "W", "ats": "workday", "host": "h", "tenant": "t", "site": "s"}
    out = fetch.fetch_source(src, s, sleep=lambda _: None)
    assert len(out["responses"]) == 3
    assert [c[2]["json"]["offset"] for c in s.calls] == [0, 20, 40]


def test_big_board_without_search_term_fails():
    s = FakeSession([FakeResp(200, {"total": 9000, "jobPostings": [{"title": "a"}]})])
    src = {"name": "w", "employer": "W", "ats": "workday", "host": "h", "tenant": "t", "site": "s"}
    try:
        fetch.fetch_source(src, s, sleep=lambda _: None)
    except RuntimeError as e:
        assert "search term" in str(e)
    else:
        raise AssertionError("expected RuntimeError")
