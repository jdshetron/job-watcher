"""Step 1 of a run: call every job board and save what it returns.

Each source is saved, gzip-compressed, to data/raw/<date>/<source>.json.gz as
    {"source", "employer", "ats", "settings", "requests": [<url>...], "responses": [<JSON>...]}
A board that answers in pages has one response per page. A source that fails writes no file.
"""

import gzip
import json
import shutil
import time
from pathlib import Path

import requests

from .config import PAGE_PAUSE, SEARCH_LIMIT, SOURCES, TIMEOUT, USER_AGENT

MAX_TRIES = 4


def session():
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
    return s


def call(s, method, url, sleep=time.sleep, **kw):
    """One request with retries on 429 / 5xx / network errors. Returns parsed JSON."""
    for attempt in range(1, MAX_TRIES + 1):
        try:
            r = s.request(method, url, timeout=TIMEOUT, **kw)
        except requests.RequestException:
            if attempt == MAX_TRIES:
                raise
            sleep(2 * attempt)
            continue
        if r.status_code == 429 or r.status_code >= 500:
            if attempt == MAX_TRIES:
                r.raise_for_status()
            sleep(min(float(r.headers.get("retry-after", 2 * attempt)), 60))
            continue
        r.raise_for_status()
        return r.json()


# --- one function per applicant tracking system --------------------------------------------
# Each returns (requests_made, responses).

def fetch_greenhouse(src, s, sleep):
    base = f"https://boards-api.greenhouse.io/v1/boards/{src['board']}"
    urls = [f"{base}/jobs", f"{base}/departments"]
    return urls, [call(s, "GET", u, sleep) for u in urls]


def fetch_lever(src, s, sleep):
    url = f"https://api.lever.co/v0/postings/{src['company']}?mode=json"
    return [url], [call(s, "GET", url, sleep)]


def fetch_ashby(src, s, sleep):
    url = f"https://api.ashbyhq.com/posting-api/job-board/{src['board']}"
    return [url], [call(s, "GET", url, sleep)]


def fetch_smartrecruiters(src, s, sleep):
    base = f"https://api.smartrecruiters.com/v1/companies/{src['company']}/postings"
    urls, pages, offset = [], [], 0
    while True:
        params = {"limit": 100, "offset": offset}
        if src.get("search"):
            params["q"] = src["search"]
        page = call(s, "GET", base, sleep, params=params)
        urls.append(requests.Request("GET", base, params=params).prepare().url)
        pages.append(page)
        total = page.get("totalFound", 0)
        if offset == 0 and total > SEARCH_LIMIT and not src.get("search"):
            raise RuntimeError(f"{total} postings: add a search term for this board")
        offset += 100
        if not page.get("content") or offset >= total:
            return urls, pages
        sleep(PAGE_PAUSE)


def fetch_workday(src, s, sleep):
    url = f"https://{src['host']}/wday/cxs/{src['tenant']}/{src['site']}/jobs"
    urls, pages, offset, total = [], [], 0, None
    while True:
        body = {"appliedFacets": {}, "limit": 20, "offset": offset, "searchText": src.get("search", "")}
        page = call(s, "POST", url, sleep, json=body)
        urls.append(f"POST {url} offset={offset}")
        pages.append(page)
        if total is None:  # Workday only reports the total on the first page
            total = page.get("total", 0)
            if total > SEARCH_LIMIT and not src.get("search"):
                raise RuntimeError(f"{total} postings: add a search term for this board")
        offset += 20
        if not page.get("jobPostings") or offset >= total:
            return urls, pages
        sleep(PAGE_PAUSE)


FETCHERS = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
    "smartrecruiters": fetch_smartrecruiters,
    "workday": fetch_workday,
}


def fetch_source(src, s=None, sleep=time.sleep):
    s = s or session()
    urls, responses = FETCHERS[src["ats"]](src, s, sleep)
    settings = {k: v for k, v in src.items() if k not in ("name", "employer", "ats")}
    return {"source": src["name"], "employer": src["employer"], "ats": src["ats"],
            "settings": settings, "requests": urls, "responses": responses}


def write_raw(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    with open(path, "wb") as f, gzip.GzipFile(fileobj=f, mode="wb", mtime=0) as gz:
        gz.write(data)


def read_raw(path):
    with gzip.open(path, "rb") as gz:
        return json.loads(gz.read().decode("utf-8"))


def fetch_all(run_date, raw_dir, sources=SOURCES, fetcher=fetch_source):
    """Fetch every source for run_date. A second run on the same day replaces that day."""
    day = Path(raw_dir) / run_date.isoformat()
    if day.exists():
        shutil.rmtree(day)
    day.mkdir(parents=True)
    s = session()
    results = []
    for src in sources:
        try:
            payload = fetcher(src, s)
            write_raw(day / f"{src['name']}.json.gz", payload)
            results.append({"name": src["name"], "employer": src["employer"], "ats": src["ats"],
                            "ok": True, "error": ""})
        except Exception as e:  # one failing source must not stop the run
            results.append({"name": src["name"], "employer": src["employer"], "ats": src["ats"],
                            "ok": False, "error": f"{type(e).__name__}: {e}"[:300]})
        print(f"  {src['name']}: {'ok' if results[-1]['ok'] else results[-1]['error']}", flush=True)
    return results
