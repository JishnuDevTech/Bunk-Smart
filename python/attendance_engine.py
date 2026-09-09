"""Pure attendance calculations for Bunk Smart.

The browser currently persists Firebase records directly. This module defines
the calculation contract that a future API can call without duplicating rules.
Records use the same shape as the frontend: {date, status, title, ...}.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import date, timedelta
from typing import Any

ATTENDANCE_STATUSES = {"present", "bunked", "holiday"}


def _record_date(date_key: str, record: Mapping[str, Any]) -> date:
    value = str(record.get("date", date_key))[:10]
    return date.fromisoformat(value)


def validate_record(date_key: str, record: Mapping[str, Any], today: date | None = None) -> None:
    """Reject invalid statuses and future attendance records."""
    if record.get("status") not in ATTENDANCE_STATUSES:
        raise ValueError("status must be present, bunked, or holiday")
    if today is not None and _record_date(date_key, record) > today:
        raise ValueError("attendance cannot be recorded for a future date")
    if record.get("status") == "holiday" and not str(record.get("title", "")).strip():
        raise ValueError("holiday records require a title")


def monthly_metrics(records: Mapping[str, Mapping[str, Any]], year: int, month: int) -> dict[str, int]:
    """Return present, bunked, holiday, rate, and trailing streak for a month."""
    entries: list[tuple[str, Mapping[str, Any]]] = []
    for date_key, record in records.items():
        record_date = _record_date(date_key, record)
        if record_date.year == year and record_date.month == month:
            entries.append((date_key, record))
    entries.sort()

    present = sum(record.get("status") == "present" for _, record in entries)
    bunked = sum(record.get("status") == "bunked" for _, record in entries)
    holidays = sum(record.get("status") == "holiday" for _, record in entries)
    tracked = present + bunked
    streak = 0
    for _, record in reversed(entries):
        if record.get("status") != "present":
            break
        streak += 1

    return {
        "present": present,
        "bunked": bunked,
        "holidays": holidays,
        "rate": round(present / tracked * 100) if tracked else 0,
        "streak": streak,
    }


def monthly_trend(records: Mapping[str, Mapping[str, Any]]) -> list[dict[str, int | str]]:
    """Build chart-ready monthly percentages, excluding holidays from totals."""
    months = sorted({_record_date(key, record).strftime("%Y-%m") for key, record in records.items()})
    trend = []
    for month_key in months:
        year, month = (int(value) for value in month_key.split("-"))
        metrics = monthly_metrics(records, year, month)
        trend.append({"month": month_key, "present": metrics["rate"], "bunked": round(metrics["bunked"] / (metrics["present"] + metrics["bunked"]) * 100) if metrics["present"] + metrics["bunked"] else 0})
    return trend


def safe_bunks(records: Mapping[str, Mapping[str, Any]], year: int, month: int, target: int = 75) -> int:
    """Return additional bunk days possible while staying at the target rate."""
    metrics = monthly_metrics(records, year, month)
    if not metrics["present"] or not 1 <= target <= 100:
        return 0
    return max(0, int(metrics["present"] / (target / 100) - metrics["present"] - metrics["bunked"]))


def weekday_patterns(records: Mapping[str, Mapping[str, Any]]) -> list[dict[str, int | str]]:
    """Return attendance rates grouped by weekday, lowest rate first."""
    totals: dict[int, list[int]] = {}
    for date_key, record in records.items():
        if record.get("status") not in {"present", "bunked"}:
            continue
        weekday = _record_date(date_key, record).weekday()
        if weekday not in totals:
            totals[weekday] = [0, 0]
        totals[weekday][1] += 1
        totals[weekday][0] += record.get("status") == "present"
    return [
        {"weekday": date(2024, 1, 1) + timedelta(days=weekday), "rate": round(present / total * 100), "total": total}
        for weekday, (present, total) in sorted(totals.items(), key=lambda item: item[1][0] / item[1][1])
    ]


def simulate(records: Iterable[tuple[str, str]], today: date | None = None) -> dict[str, dict[str, Any]]:
    """Create validated records for imports, scripts, and future API handlers."""
    result: dict[str, dict[str, Any]] = {}
    for date_key, status in records:
        record = {"date": f"{date_key}T00:00:00.000Z", "status": status}
        if status == "holiday":
            record["title"] = "Holiday"
        validate_record(date_key, record, today=today)
        result[date_key] = record
    return result