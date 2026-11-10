"""The data-analyst title rule."""

import pytest

from watcher.role import in_role


@pytest.mark.parametrize("title", [
    "Data Analyst", "Senior Data Analyst, Payments", "Business Intelligence Developer", "BI Analyst",
    "Analytics Engineer", "Product Analyst", "Marketing Analyst II", "Business Analyst - Operations",
    "Data Analytics Manager", "Insights Analyst", "Quantitative Analyst",
])
def test_in_role(title):
    assert in_role(title)


@pytest.mark.parametrize("title", [
    "Software Engineer", "Security Analyst", "SOC Analyst", "Threat Intelligence Analyst",
    "Data Engineer", "Account Executive", "Analyst Relations Manager", "", None,
    "Cyber Data Analyst", "Financial Analyst", "Workplace Operations Analyst",
])
def test_not_in_role(title):
    assert not in_role(title)
