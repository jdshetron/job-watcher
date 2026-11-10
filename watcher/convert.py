"""Convert one raw file into postings with the common columns.

Common columns: source, source_id, employer, title, location, department, posted_date, url.
A value the board does not provide is left as "".
"""

import datetime as dt
import re


def utc_date(value):
    """ISO timestamp (any offset) or epoch milliseconds -> 'YYYY-MM-DD' in UTC; '' if unknown."""
    if value in (None, ""):
        return ""
    try:
        if isinstance(value, (int, float)):
            t = dt.datetime.fromtimestamp(value / 1000, tz=dt.timezone.utc)
        else:
            t = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if t.tzinfo is None:
                t = t.replace(tzinfo=dt.timezone.utc)
        return t.astimezone(dt.timezone.utc).date().isoformat()
    except (ValueError, OverflowError, OSError):
        return ""


def workday_posted(text, raw_date):
    """Workday says 'Posted Today', 'Posted Yesterday', 'Posted 3 Days Ago' or 'Posted 30+ Days Ago'.
    The first three are turned into a date counted back from the raw file's date; '30+' is unknown."""
    t = (text or "").lower()
    d = dt.date.fromisoformat(raw_date)
    if "today" in t:
        return d.isoformat()
    if "yesterday" in t:
        return (d - dt.timedelta(days=1)).isoformat()
    m = re.search(r"(\d+)\s+days?\s+ago", t)
    if m and "+" not in t:
        return (d - dt.timedelta(days=int(m.group(1)))).isoformat()
    return ""


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def _greenhouse(payload, raw_date):
    jobs_resp, dept_resp = payload["responses"]
    dept_of = {}
    for d in dept_resp.get("departments", []):
        for j in d.get("jobs", []):
            dept_of.setdefault(j["id"], d["name"])
    for j in jobs_resp.get("jobs", []):
        yield {"source_id": j["id"], "title": j.get("title"),
               "location": (j.get("location") or {}).get("name"),
               "department": dept_of.get(j["id"], ""),
               "posted_date": utc_date(j.get("first_published")), "url": j.get("absolute_url")}


def _lever(payload, raw_date):
    for j in payload["responses"][0]:
        c = j.get("categories") or {}
        yield {"source_id": j["id"], "title": j.get("text"), "location": c.get("location"),
               "department": c.get("department") or c.get("team"),
               "posted_date": utc_date(j.get("createdAt")), "url": j.get("hostedUrl")}


def _ashby(payload, raw_date):
    for j in payload["responses"][0].get("jobs", []):
        yield {"source_id": j["id"], "title": j.get("title"), "location": j.get("location"),
               "department": j.get("department"), "posted_date": utc_date(j.get("publishedAt")),
               "url": j.get("jobUrl")}


def _smartrecruiters(payload, raw_date):
    company = payload["settings"]["company"]
    for page in payload["responses"]:
        for j in page.get("content", []):
            loc = j.get("location") or {}
            where = loc.get("fullLocation") or ", ".join(
                x for x in (loc.get("city"), loc.get("region"), (loc.get("country") or "").upper()) if x)
            yield {"source_id": j["id"], "title": j.get("name"), "location": where,
                   "department": (j.get("department") or {}).get("label"),
                   "posted_date": utc_date(j.get("releasedDate")),
                   "url": f"https://jobs.smartrecruiters.com/{company}/{j['id']}"}


def _workday(payload, raw_date):
    st = payload["settings"]
    for page in payload["responses"]:
        for j in page.get("jobPostings", []):
            path = j.get("externalPath")
            if not path:  # Workday sometimes returns an entry with only a requisition number
                continue
            yield {"source_id": path.rsplit("/", 1)[-1], "title": j.get("title"),
                   "location": j.get("locationsText"), "department": "",
                   "posted_date": workday_posted(j.get("postedOn"), raw_date),
                   "url": f"https://{st['host']}/en-US/{st['site']}{path}"}


CONVERTERS = {"greenhouse": _greenhouse, "lever": _lever, "ashby": _ashby,
              "smartrecruiters": _smartrecruiters, "workday": _workday}


def convert(payload, raw_date):
    """All postings in one raw file, in the common columns, one per source_id (first wins)."""
    out, seen = [], set()
    for p in CONVERTERS[payload["ats"]](payload, raw_date):
        sid = clean(p["source_id"])
        if not sid or sid in seen:
            continue
        seen.add(sid)
        out.append({"source": payload["source"], "source_id": sid, "employer": payload["employer"],
                    "title": clean(p["title"]), "location": clean(p["location"]),
                    "department": clean(p["department"]), "posted_date": p["posted_date"] or "",
                    "url": clean(p["url"])})
    return out
