"""The employers the tool watches, and the job-board (applicant tracking system) that hosts each.

Every board answers a plain GET or POST with JSON and needs no login.
"""

USER_AGENT = "job-watcher/1.0 (educational project; python-requests)"
TIMEOUT = 30          # seconds per request
PAGE_PAUSE = 0.3      # seconds between page requests to the same board
SEARCH_LIMIT = 5000   # a board with more postings than this is requested with a search term

ROLE = "Data analyst"

# name: short key used in file names and posting_id; employer: display name;
# ats: which applicant tracking system; the other keys are that system's settings.
SOURCES = [
    # Greenhouse: https://boards-api.greenhouse.io/v1/boards/<board>/jobs (+ /departments)
    {"name": "airbnb", "employer": "Airbnb", "ats": "greenhouse", "board": "airbnb"},
    {"name": "stripe", "employer": "Stripe", "ats": "greenhouse", "board": "stripe"},
    {"name": "robinhood", "employer": "Robinhood", "ats": "greenhouse", "board": "robinhood"},
    {"name": "coinbase", "employer": "Coinbase", "ats": "greenhouse", "board": "coinbase"},
    {"name": "lyft", "employer": "Lyft", "ats": "greenhouse", "board": "lyft"},
    {"name": "pinterest", "employer": "Pinterest", "ats": "greenhouse", "board": "pinterest"},
    {"name": "reddit", "employer": "Reddit", "ats": "greenhouse", "board": "reddit"},
    {"name": "instacart", "employer": "Instacart", "ats": "greenhouse", "board": "instacart"},
    {"name": "affirm", "employer": "Affirm", "ats": "greenhouse", "board": "affirm"},
    {"name": "doordash", "employer": "DoorDash", "ats": "greenhouse", "board": "doordashusa"},
    {"name": "duolingo", "employer": "Duolingo", "ats": "greenhouse", "board": "duolingo"},
    {"name": "chime", "employer": "Chime", "ats": "greenhouse", "board": "chime"},
    # Lever: https://api.lever.co/v0/postings/<company>?mode=json
    {"name": "palantir", "employer": "Palantir", "ats": "lever", "company": "palantir"},
    {"name": "spotify", "employer": "Spotify", "ats": "lever", "company": "spotify"},
    # Ashby: https://api.ashbyhq.com/posting-api/job-board/<board>
    {"name": "ramp", "employer": "Ramp", "ats": "ashby", "board": "ramp"},
    {"name": "notion", "employer": "Notion", "ats": "ashby", "board": "notion"},
    {"name": "snowflake", "employer": "Snowflake", "ats": "ashby", "board": "snowflake"},
    # SmartRecruiters: https://api.smartrecruiters.com/v1/companies/<company>/postings
    {"name": "servicenow", "employer": "ServiceNow", "ats": "smartrecruiters", "company": "ServiceNow"},
    # Bosch lists more than 5,000 postings, so only postings matching "data" are requested.
    {"name": "bosch", "employer": "Bosch", "ats": "smartrecruiters", "company": "BoschGroup", "search": "data"},
    # Workday: POST https://<host>/wday/cxs/<tenant>/<site>/jobs
    {"name": "nvidia", "employer": "NVIDIA", "ats": "workday",
     "host": "nvidia.wd5.myworkdayjobs.com", "tenant": "nvidia", "site": "NVIDIAExternalCareerSite"},
    {"name": "salesforce", "employer": "Salesforce", "ats": "workday",
     "host": "salesforce.wd12.myworkdayjobs.com", "tenant": "salesforce", "site": "External_Career_Site"},
    {"name": "capital-one", "employer": "Capital One", "ats": "workday",
     "host": "capitalone.wd12.myworkdayjobs.com", "tenant": "capitalone", "site": "Capital_One"},
    {"name": "mastercard", "employer": "Mastercard", "ats": "workday",
     "host": "mastercard.wd1.myworkdayjobs.com", "tenant": "mastercard", "site": "CorporateCareers"},
]

BY_NAME = {s["name"]: s for s in SOURCES}
