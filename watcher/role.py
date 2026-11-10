"""The title rule: is a posting in the data-analyst role?

A title is in the role when, ignoring case,
  1. it contains "analyst" together with one of the data words below, or
  2. it contains one of the role phrases below,
and it contains none of the excluded words.
"""

import re

DATA_WORDS = ["data", "analytics", "insights", "insight", "reporting", "business intelligence",
              "bi", "business", "product", "marketing", "operations", "quantitative", "financial"]
ROLE_PHRASES = ["data analyst", "analytics engineer", "business intelligence", "data analytics",
                "product analytics", "reporting analyst", "insights analyst", "analytics specialist",
                "analytics associate", "analytics consultant"]
EXCLUDE = ["security", "soc", "threat", "malware", "cyber"]


def _has(title, words):
    return any(re.search(rf"\b{re.escape(w)}\b", title) for w in words)


def in_role(title):
    t = (title or "").lower()
    if _has(t, EXCLUDE):
        return False
    if _has(t, ROLE_PHRASES):
        return True
    return _has(t, ["analyst", "analysts"]) and _has(t, DATA_WORDS)
