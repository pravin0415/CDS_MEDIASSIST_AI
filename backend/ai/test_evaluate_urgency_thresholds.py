import unittest

from evaluate_urgency_thresholds import evaluate


class UrgencyThresholdEvaluationTests(unittest.TestCase):
    def test_counts_missed_urgent_cases(self):
        cases = [(True, 0.55, True), (True, 0.42, True), (False, 0.8, False)]
        result = evaluate(cases, 0.5)
        self.assertEqual((result["TP"], result["FN"], result["TN"]), (1, 1, 1))

    def test_threshold_must_not_override_condition_risk(self):
        result = evaluate([(False, 0.99, False)], 0.4)
        self.assertEqual(result["TN"], 1)


if __name__ == "__main__":
    unittest.main()
