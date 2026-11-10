"""Conversion of each job-board system to the common columns."""

from watcher.config import SOURCES
from watcher.convert import convert, utc_date, workday_posted

COMMON = {"source", "source_id", "employer", "title", "location", "department", "posted_date", "url"}


def wrap(ats, responses, settings=None, source="acme"):
    return {"source": source, "employer": "Acme", "ats": ats, "settings": settings or {},
            "requests": [], "responses": responses}


def test_greenhouse():
    p = wrap("greenhouse", [
        {"jobs": [{"id": 11, "title": "  Data   Analyst ", "location": {"name": "New York, NY"},
                   "absolute_url": "https://boards.greenhouse.io/acme/jobs/11",
                   "first_published": "2026-11-01T22:30:00-05:00"}]},
        {"departments": [{"name": "Analytics", "jobs": [{"id": 11}]}]}])
    [r] = convert(p, "2026-11-10")
    assert set(r) == COMMON
    assert r == {"source": "acme", "source_id": "11", "employer": "Acme", "title": "Data Analyst",
                 "location": "New York, NY", "department": "Analytics",
                 "posted_date": "2026-11-02",  # 22:30 at UTC-5 is the next day in UTC
                 "url": "https://boards.greenhouse.io/acme/jobs/11"}


def test_lever():
    p = wrap("lever", [[{"id": "abc", "text": "BI Analyst", "hostedUrl": "https://jobs.lever.co/acme/abc",
                         "createdAt": 1762732800000,
                         "categories": {"location": "Remote", "team": "Data", "department": "Finance"}}]])
    [r] = convert(p, "2026-11-10")
    assert r["source_id"] == "abc" and r["title"] == "BI Analyst" and r["department"] == "Finance"
    assert r["posted_date"] == "2025-11-10" and r["url"].endswith("/abc") and r["location"] == "Remote"


def test_ashby():
    p = wrap("ashby", [{"jobs": [{"id": "u1", "title": "Analytics Engineer", "location": "SF",
                                  "department": "Data", "publishedAt": "2026-10-05T17:12:35.753+00:00",
                                  "jobUrl": "https://jobs.ashbyhq.com/acme/u1"}]}])
    [r] = convert(p, "2026-11-10")
    assert (r["source_id"], r["department"], r["posted_date"]) == ("u1", "Data", "2026-10-05")


def test_smartrecruiters_pages_and_location():
    p = wrap("smartrecruiters", [
        {"totalFound": 2, "content": [{"id": "7", "name": "Data Analyst", "releasedDate": "2026-11-09T15:23:43.953Z",
                                       "location": {"city": "Berlin", "country": "de"},
                                       "department": {"label": "IT"}}]},
        {"totalFound": 2, "content": [{"id": "8", "name": "Engineer", "location": {"fullLocation": "Austin, TX, USA"}}]}],
        settings={"company": "Acme"})
    a, b = convert(p, "2026-11-10")
    assert a["location"] == "Berlin, DE" and a["department"] == "IT" and a["posted_date"] == "2026-11-09"
    assert a["url"] == "https://jobs.smartrecruiters.com/Acme/7"
    assert b["location"] == "Austin, TX, USA" and b["department"] == "" and b["posted_date"] == ""


def test_workday_skips_entries_without_path_and_dates_relative_to_raw_day():
    p = wrap("workday", [{"total": 3, "jobPostings": [
        {"title": "Data Analyst", "externalPath": "/job/McLean-VA/Data-Analyst_R1", "locationsText": "McLean, VA",
         "postedOn": "Posted 3 Days Ago"},
        {"bulletFields": ["R2"]},
        {"title": "Engineer", "externalPath": "/job/X/Engineer_R3", "locationsText": "2 Locations",
         "postedOn": "Posted 30+ Days Ago"}]}],
        settings={"host": "acme.wd1.myworkdayjobs.com", "tenant": "acme", "site": "Careers"})
    a, b = convert(p, "2026-11-10")
    assert a["source_id"] == "Data-Analyst_R1" and a["posted_date"] == "2026-11-07"
    assert a["url"] == "https://acme.wd1.myworkdayjobs.com/en-US/Careers/job/McLean-VA/Data-Analyst_R1"
    assert b["posted_date"] == "" and b["department"] == ""


def test_duplicate_ids_kept_once():
    p = wrap("lever", [[{"id": "a", "text": "One"}, {"id": "a", "text": "Two"}]])
    assert [r["title"] for r in convert(p, "2026-11-10")] == ["One"]


def test_workday_posted_words():
    assert workday_posted("Posted Today", "2026-11-10") == "2026-11-10"
    assert workday_posted("Posted Yesterday", "2026-11-10") == "2026-11-09"
    assert workday_posted("", "2026-11-10") == ""


def test_utc_date_bad_values():
    assert utc_date(None) == "" and utc_date("not a date") == ""


def test_watch_list():
    names = [s["name"] for s in SOURCES]
    assert len(names) >= 15 and len(set(names)) == len(names)
    assert {s["ats"] for s in SOURCES} >= {"greenhouse", "lever", "ashby", "smartrecruiters", "workday"}
