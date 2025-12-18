import sys
import pathlib
import pytest

# Ensure repo root is on sys.path so tests can import backend.py
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import compute_allocation, Employee


def test_rounding_and_restaurant_overage():
    # Two employees with hours that produce fractional payouts; total tips chosen to demonstrate rounding
    employees = [
        Employee(name='Alice', hours=30, role='waiter'),
        Employee(name='Bob', hours=20, role='kitchen')
    ]
    total_tips = 503  # an odd number to force rounding effects with $5 increments

    rows = compute_allocation(total_tips, employees, restaurant_share=0.02, round_to=5.0)

    # Sum of rounded payouts must not exceed total_tips
    sum_rounded = sum(r['weekly_rounded'] for r in rows)
    assert sum_rounded <= total_tips + 1e-6

    # There must be a restaurant row
    assert any(r['id'] == 'restaurant' for r in rows)

    # All rounded values non-negative
    assert all(r['weekly_rounded'] >= 0 for r in rows)

    # prop_after values sum to <= 1 (may be slightly less due to rounding down restaurant)
    total_prop_after = sum(r['prop_after'] for r in rows)
    assert total_prop_after <= 1.000001
