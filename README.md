# Job Watcher: Data Analyst

[![Tests](https://github.com/jdshetron/job-watcher/actions/workflows/tests.yml/badge.svg)](https://github.com/jdshetron/job-watcher/actions/workflows/tests.yml)
[![Daily run](https://github.com/jdshetron/job-watcher/actions/workflows/daily.yml/badge.svg)](https://github.com/jdshetron/job-watcher/actions/workflows/daily.yml)

Every day, on its own, this tool reads the job boards of 23 employers, compares them with what it
saw before, records which postings are new and which are gone, opens a GitHub Issue with the
changes, and publishes the result to a website. The role it watches for is **data analyst**.

**Live site:** https://jdshetron.github.io/job-watcher/

## Sources

Every board is read as JSON through the applicant tracking system that hosts it, with no login.
No web page HTML is read.

| Source (`name`) | Employer | Applicant tracking system | Request |
|---|---|---|---|
| `airbnb` | Airbnb | Greenhouse | `GET boards-api.greenhouse.io/v1/boards/airbnb/jobs` and `/departments` |
| `stripe` | Stripe | Greenhouse | same, board `stripe` |
| `robinhood` | Robinhood | Greenhouse | same, board `robinhood` |
| `coinbase` | Coinbase | Greenhouse | same, board `coinbase` |
| `lyft` | Lyft | Greenhouse | same, board `lyft` |
| `pinterest` | Pinterest | Greenhouse | same, board `pinterest` |
| `reddit` | Reddit | Greenhouse | same, board `reddit` |
| `instacart` | Instacart | Greenhouse | same, board `instacart` |
| `affirm` | Affirm | Greenhouse | same, board `affirm` |
| `doordash` | DoorDash | Greenhouse | same, board `doordashusa` |
| `duolingo` | Duolingo | Greenhouse | same, board `duolingo` |
| `chime` | Chime | Greenhouse | same, board `chime` |
| `palantir` | Palantir | Lever | `GET api.lever.co/v0/postings/palantir?mode=json` |
| `spotify` | Spotify | Lever | same, company `spotify` |
| `ramp` | Ramp | Ashby | `GET api.ashbyhq.com/posting-api/job-board/ramp` |
| `notion` | Notion | Ashby | same, board `notion` |
| `snowflake` | Snowflake | Ashby | same, board `snowflake` |
| `servicenow` | ServiceNow | SmartRecruiters | `GET api.smartrecruiters.com/v1/companies/ServiceNow/postings` (pages of 100) |
| `bosch` | Bosch | SmartRecruiters | same, company `BoschGroup`, **search term `data`** |
| `nvidia` | NVIDIA | Workday | `POST nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs` (pages of 20) |
| `salesforce` | Salesforce | Workday | `POST salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/External_Career_Site/jobs` |
| `capital-one` | Capital One | Workday | `POST capitalone.wd12.myworkdayjobs.com/wday/cxs/capitalone/Capital_One/jobs` |
| `mastercard` | Mastercard | Workday | `POST mastercard.wd1.myworkdayjobs.com/wday/cxs/mastercard/CorporateCareers/jobs` |

**Search term:** Bosch's board lists more than 5,000 postings, so it is requested with the search
term **`data`** (`q=data`), which returns about 1,100. Every other board is read in full. If any
other board grows past 5,000, the fetcher stops with an error for that board asking for a search
term, so the limit can't be passed without anyone noticing.

The list lives in [`watcher/config.py`](watcher/config.py). Boards that answer in pages
(SmartRecruiters, Workday) are read page by page with a short pause between pages; a request
that gets `429` or a server error is retried up to 4 times.

## Title rule (in the data-analyst role or not)

`in_role` is `true` when the title, ignoring case and matching whole words,

1. contains one of these phrases: *data analyst, analytics engineer, business intelligence, data
   analytics, product analytics, reporting analyst, insights analyst, analytics specialist,
   analytics associate, analytics consultant*; **or**
2. contains *analyst* together with one of: *data, analytics, insight(s), reporting, business
   intelligence, BI, business, product, marketing, quantitative*;

**and** it contains none of *security, SOC, threat, malware, cyber* (security analysts are a
different job). So "Senior Data Analyst", "BI Analyst", "Analytics Engineer" and "Marketing Analyst"
are in the role; "Data Engineer", "Security Analyst", "Financial Analyst" and "Operations Analyst" are not. The
rule is in [`watcher/role.py`](watcher/role.py) and tested in `tests/test_role.py`.

Every posting a board returns is kept, in the role or not.

## The history file: `data/history.csv`

One row per posting, sorted by `posting_id`.

| Column | Meaning |
|---|---|
| `posting_id` | `<source>:<source_id>`, unique across all boards |
| `source` | Source name from the table above |
| `source_id` | The board's own ID for the posting (Workday: the last part of the posting's path, which ends in the requisition number) |
| `employer` | Employer name |
| `title` | Job title (latest seen) |
| `location` | Location as the board writes it (Workday writes "3 Locations" for multi-city postings) |
| `department` | Department or team; empty for Workday, which doesn't give one in the list |
| `posted_date` | Date the employer posted it, in UTC. Greenhouse `first_published`, Lever `createdAt`, Ashby `publishedAt`, SmartRecruiters `releasedDate`; Workday says "Posted N Days Ago", which is counted back from the run date, and is empty for "30+ Days Ago" |
| `url` | Link to the posting / application |
| `in_role` | `true` if the title rule matches |
| `first_run` | `true` if the posting was listed in the first raw file of its source (it was already open when watching began) |
| `first_seen` | First run date on which the source listed it |
| `last_seen` | Latest run date on which the source listed it |
| `status` | `open` or `removed` |
| `removed_date` | Run date on which it was first missing from its source's listing; empty if open |

All dates are UTC dates written `YYYY-MM-DD`; every run uses the UTC date of the moment it runs.
A column a source doesn't provide is left empty.

**How it is built**, day by day from the raw files, for each source that has a raw file that day:

- a posting seen for the first time gets that day as `first_seen` (and `first_run = true` if it is
  that source's first raw file);
- every posting listed that day gets that day as `last_seen`, and its title, location and other
  columns are updated to what the board says that day;
- an `open` posting of that source that is not listed that day becomes `removed`, with that day as
  `removed_date`;
- a `removed` posting that is listed again becomes `open` again, `removed_date` is cleared and
  `first_seen` is kept.

A source that failed on a day has no raw file that day, so it changes nothing: its postings are
not marked removed because of an outage.

### Building the history from the raw files

```bash
python -m watcher build
```

This reads only `data/raw/`, so running it again produces the same file, and a change to a rule
(for example the title rule) applies to every day of the history.

## The status file: `data/status.json`

| Key | Meaning |
|---|---|
| `run_time` | When the latest run started (UTC) |
| `run_date` | UTC date of the latest run |
| `first_run_date` | Date of the earliest raw file |
| `days_with_success` | Number of different dates with a raw file |
| `open` | Number of open postings |
| `open_in_role` | Open postings in the data-analyst role |
| `new_today` | Postings first seen in the latest run, leaving out first-run postings |
| `removed_today` | Postings removed in the latest run |
| `sources` | One entry per source: `name`, `employer`, `ats`, `ok` (true/false), `count` (postings returned), `error` |

Every source's result on every run, success or failure, is also appended to `data/run_log.csv`
(`run_time, date, source, ok, count, error`).

## What a daily run does

[`.github/workflows/daily.yml`](.github/workflows/daily.yml) runs every day at 12:17 UTC (and can be
started by hand from the Actions tab):

1. **Fetch** every board and save what it returns, gzip-compressed, to
   `data/raw/<date>/<source>.json.gz`. A board that fails writes no file; the run carries on and
   the failure is recorded in the status file and the run log.
2. **Build** `data/history.csv` from all the raw files.
3. **Write** `data/status.json` and append to `data/run_log.csv`.
4. **Open a GitHub Issue** titled with the date (label `daily-report`) listing the new and removed
   postings, each with a link (data-analyst postings first, marked ⭐), and **close** the previous
   day's issue. It is opened every day, even with no changes.
5. **Commit** the raw files, history, status and run log, then deploy the site to GitHub Pages.

A second run on the same day empties that day's raw folder first, rebuilds the history, and
updates the same issue, so each day counts once.

Other commands:

```bash
python -m watcher run     # steps 1-3
python -m watcher issue   # step 4 (needs GITHUB_TOKEN and GITHUB_REPOSITORY; prints the issue otherwise)
python -m pytest          # the tests
```

## Website

Three pages share one navigation bar, one stylesheet and one set of fonts and colours. They load
`data/history.csv` and `data/status.json` in the browser and compute everything there.

- **Today** (`index.html`): time of the last run, every source's status and count, the four counts
  (days with a successful run, open, new today, removed today), and the new and removed postings of
  the latest run, switchable between the data-analyst role and all postings.
- **Browse** (`browse.html`): open postings with a switch between the data-analyst role (default)
  and all postings, filters for employer, location and days open, a title search, a sort by
  first-seen date, an Apply link on every posting, and a ☆ star that saves the posting to a
  shortlist kept in the browser's `localStorage` (it survives reloads).
- **Market** (`market.html`): six findings computed from the history file, each with a heading
  that states the finding, a paragraph, how it's computed, and a chart: new postings per day,
  removed postings per day, open postings per employer, median days open, the share removed
  within seven days, and the top locations.

The site is installable: `manifest.webmanifest` describes the app and `sw.js` is a service worker
that loads pages and data from the network when online and serves the last saved copies offline.

## Files

| File | What it does |
|---|---|
| `watcher/config.py` | The 23 sources (employer, applicant tracking system, board settings, search term) and request settings |
| `watcher/fetch.py` | Calls each board (one function per tracking system, with paging and retries) and writes the raw `.json.gz` files |
| `watcher/convert.py` | Converts each board's response to the common columns |
| `watcher/role.py` | The data-analyst title rule |
| `watcher/build.py` | Builds `data/history.csv` from the raw files (first seen, last seen, removed, reopened) |
| `watcher/status.py` | Writes `data/status.json` and appends to `data/run_log.csv` |
| `watcher/issue.py` | Writes the daily issue and opens/updates/closes issues through the GitHub API |
| `watcher/__main__.py` | Command line: `run`, `build`, `issue` |
| `watcher/__init__.py` | Marks `watcher` as a package |
| `tests/conftest.py` | Test setup and helpers that write fake raw files |
| `tests/test_convert.py` | Conversion of each tracking system to the common columns |
| `tests/test_role.py` | The title rule |
| `tests/test_history.py` | First-seen, last-seen, removed and reopened logic; failed sources; status; issue text; paging and retries |
| `.github/workflows/daily.yml` | The daily run: fetch, build, status, issue, commit, deploy |
| `.github/workflows/tests.yml` | Runs the tests on every push |
| `.github/workflows/pages.yml` | Publishes the site to GitHub Pages |
| `index.html`, `browse.html`, `market.html` | The three pages |
| `assets/style.css` | Shared fonts, colours and layout |
| `assets/app.js` | Shared code: loading and parsing the data, dates, the shortlist, posting cards, service worker registration |
| `assets/today.js`, `assets/browse.js`, `assets/market.js` | Page-specific code |
| `manifest.webmanifest` | Web app manifest (makes the site installable) |
| `sw.js` | Service worker (offline support) |
| `icons/` | App icons (SVG and PNG) |
| `tools/make_icons.py` | Draws the PNG icons with the standard library |
| `data/raw/<date>/<source>.json.gz` | What each board returned on each day |
| `data/history.csv` | The history file |
| `data/status.json` | The status of the latest run |
| `data/run_log.csv` | Every source's result on every run |
| `requirements.txt` | Python packages: `requests`, `pytest` |
| `.gitignore` | Files git ignores (virtual environment, caches) |
