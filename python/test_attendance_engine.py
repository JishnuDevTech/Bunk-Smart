from datetime import date
import unittest

from attendance_engine import monthly_metrics, monthly_trend, validate_record


class AttendanceEngineTests(unittest.TestCase):
    records = {
        "2026-09-01": {"status": "present"},
        "2026-09-02": {"status": "bunked"},
        "2026-09-03": {"status": "holiday", "title": "College protest"},
        "2026-09-04": {"status": "present"},
    }

    def test_holidays_do_not_reduce_rate(self):
        self.assertEqual(monthly_metrics(self.records, 2026, 9)["rate"], 67)

    def test_trend_is_chart_ready(self):
        self.assertEqual(monthly_trend(self.records)[0]["bunked"], 33)

    def test_future_records_are_rejected(self):
        with self.assertRaises(ValueError):
            validate_record("2026-09-10", {"status": "present"}, today=date(2026, 9, 9))


if __name__ == "__main__":
    unittest.main()