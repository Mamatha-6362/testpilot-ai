import shutil
from pathlib import Path
from backend.app.config import PROJECTS_DIR

DEMO_PROJECT_ID = "demo-cart-project"

CART_CODE_BUGGY = '''"""
Shopping cart calculation module.
"""

class ShoppingCart:
    def __init__(self):
        self.items = []

    def add_item(self, name: str, price: float):
        if price < 0:
            raise ValueError("Item price cannot be negative")
        self.items.append({"name": name, "price": price})

    def get_total(self) -> float:
        return sum(item["price"] for item in self.items)

    def apply_discount(self, percentage: float) -> float:
        """
        Applies a percentage discount to the current cart total.
        NOTE: Missing range validation for 0 <= percentage <= 100.
        """
        discount_amount = self.get_total() * (percentage / 100.0)
        return round(self.get_total() - discount_amount, 2)
'''

TEST_CART_CODE = '''import pytest
from store.cart import ShoppingCart

def test_add_item_and_total():
    cart = ShoppingCart()
    cart.add_item("Mechanical Keyboard", 100.0)
    cart.add_item("Mouse", 50.0)
    assert cart.get_total() == 150.0

def test_standard_discount():
    cart = ShoppingCart()
    cart.add_item("Wireless Headphones", 100.0)
    discounted = cart.apply_discount(20)
    assert discounted == 80.0

def test_boundary_zero_and_hundred_discount():
    cart = ShoppingCart()
    cart.add_item("Desk Pad", 50.0)
    assert cart.apply_discount(0) == 50.0
    assert cart.apply_discount(100) == 0.0

def test_discount_for_invalid_percentage():
    """
    Requirements state: Percentage must be between 0 and 100.
    Invalid percentages > 100 must raise ValueError.
    """
    cart = ShoppingCart()
    cart.add_item("Ergonomic Chair", 200.0)
    with pytest.raises(ValueError, match="between 0 and 100"):
        cart.apply_discount(150)
'''

README_CONTENT = '''# E-Commerce Cart & Discount Service (Demo Project)

A lightweight e-commerce module to manage items and calculate discounts.

## Requirements
1. Items can be added with positive price values.
2. `get_total()` must return the exact sum of all item prices.
3. `apply_discount(percentage)` must apply discounts between 0% and 100%.
4. Any discount percentage outside [0, 100] must raise a ValueError.
'''

def create_sample_project() -> Path:
    """Creates or resets the built-in reference sample project."""
    project_path = PROJECTS_DIR / DEMO_PROJECT_ID
    if project_path.exists():
        shutil.rmtree(project_path)

    project_path.mkdir(parents=True, exist_ok=True)
    store_dir = project_path / "store"
    tests_dir = project_path / "tests"
    store_dir.mkdir(parents=True, exist_ok=True)
    tests_dir.mkdir(parents=True, exist_ok=True)

    (store_dir / "__init__.py").write_text("", encoding="utf-8")
    (store_dir / "cart.py").write_text(CART_CODE_BUGGY, encoding="utf-8")
    (tests_dir / "__init__.py").write_text("", encoding="utf-8")
    (tests_dir / "test_cart.py").write_text(TEST_CART_CODE, encoding="utf-8")
    (project_path / "README.md").write_text(README_CONTENT, encoding="utf-8")
    (project_path / "requirements.txt").write_text("pytest>=8.0.0\n", encoding="utf-8")

    return project_path
