from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Category,
    Inventory,
    Machine,
    Payment,
    Product,
    Refund,
    Transaction,
    TransactionItem,
)
from app.services.inventory_service import low_stock_alert_feed
from app.services.serializers import machine_out, transaction_summary


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _date_key(dt: datetime) -> str:
    return _aware(dt).astimezone(timezone.utc).strftime("%Y-%m-%d")


def dashboard(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)
    previous_week_start = week_start - timedelta(days=7)

    total_revenue = db.scalar(
        select(func.coalesce(func.sum(Transaction.total_paise), 0)).where(
            Transaction.current_state == "COMPLETED"
        )
    ) or 0
    total_transactions = db.scalar(select(func.count(Transaction.id))) or 0
    completed = db.scalar(
        select(func.count(Transaction.id)).where(
            Transaction.current_state == "COMPLETED"
        )
    ) or 0
    failed = db.scalar(
        select(func.count(Transaction.id)).where(Transaction.current_state == "ERROR")
    ) or 0
    cancelled = db.scalar(
        select(func.count(Transaction.id)).where(
            Transaction.current_state == "CANCELLED"
        )
    ) or 0
    pending = db.scalar(
        select(func.count(Transaction.id)).where(
            Transaction.current_state.in_(
                [
                    "IDLE",
                    "PRODUCT_SELECTED",
                    "INVENTORY_CHECK",
                    "PAYMENT_PENDING",
                    "PAYMENT_ACCEPTED",
                    "DISPENSING",
                    "CHANGE_RETURN",
                    "REFUNDING",
                ]
            )
        )
    ) or 0
    total_products = db.scalar(
        select(func.count(Product.id)).where(Product.is_active.is_(True))
    ) or 0
    active_machines = db.scalar(
        select(func.count(Machine.id)).where(Machine.status == "online")
    ) or 0
    total_machines = db.scalar(select(func.count(Machine.id))) or 0
    low_stock = db.scalar(
        select(func.count(Inventory.id)).where(
            Inventory.quantity - Inventory.reserved_quantity
            <= Inventory.low_stock_threshold
        )
    ) or 0
    units_sold = db.scalar(
        select(func.coalesce(func.sum(TransactionItem.quantity), 0))
        .join(Transaction, Transaction.id == TransactionItem.transaction_id)
        .where(Transaction.current_state == "COMPLETED")
    ) or 0
    today_revenue = db.scalar(
        select(func.coalesce(func.sum(Transaction.total_paise), 0)).where(
            Transaction.current_state == "COMPLETED",
            Transaction.completed_at >= today_start,
        )
    ) or 0
    week_revenue = db.scalar(
        select(func.coalesce(func.sum(Transaction.total_paise), 0)).where(
            Transaction.current_state == "COMPLETED",
            Transaction.completed_at >= week_start,
        )
    ) or 0
    previous_week_revenue = db.scalar(
        select(func.coalesce(func.sum(Transaction.total_paise), 0)).where(
            Transaction.current_state == "COMPLETED",
            Transaction.completed_at >= previous_week_start,
            Transaction.completed_at < week_start,
        )
    ) or 0
    revenue_growth = (
        ((week_revenue - previous_week_revenue) / previous_week_revenue * 100)
        if previous_week_revenue
        else (100.0 if week_revenue else 0.0)
    )
    refund_total = db.scalar(
        select(func.coalesce(func.sum(Refund.amount_paise), 0)).where(
            Refund.status == "processed"
        )
    ) or 0

    # 14-day sparkline
    start = today_start - timedelta(days=13)
    transactions = db.execute(
        select(Transaction.completed_at, Transaction.total_paise).where(
            Transaction.current_state == "COMPLETED",
            Transaction.completed_at >= start,
        )
    ).all()
    by_day: dict[str, dict] = {}
    for offset in range(14):
        day = start + timedelta(days=offset)
        by_day[day.strftime("%Y-%m-%d")] = {
            "date": day.strftime("%Y-%m-%d"),
            "label": day.strftime("%d %b"),
            "revenue_paise": 0,
            "transactions": 0,
        }
    for completed_at, amount in transactions:
        key = _date_key(completed_at)
        if key in by_day:
            by_day[key]["revenue_paise"] += amount
            by_day[key]["transactions"] += 1

    recent = db.scalars(
        select(Transaction)
        .options(
            joinedload(Transaction.machine),
            joinedload(Transaction.items).joinedload(TransactionItem.product),
        )
        .order_by(Transaction.started_at.desc())
        .limit(7)
    ).unique().all()

    payment_rows = db.execute(
        select(
            Payment.method,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount_paise), 0),
        )
        .where(Payment.status.in_(["captured", "refunded"]))
        .group_by(Payment.method)
    ).all()
    payment_mix = [
        {
            "method": method,
            "label": {"upi": "UPI", "coin": "Coins", "note": "Notes", "card": "Card"}.get(
                method, method.title()
            ),
            "count": int(count),
            "amount_paise": int(amount),
        }
        for method, count, amount in payment_rows
    ]

    top_products = product_performance(db)[:5]
    machines = db.scalars(select(Machine).order_by(Machine.name)).all()

    return {
        "stats": {
            "total_revenue_paise": int(total_revenue),
            "today_revenue_paise": int(today_revenue),
            "week_revenue_paise": int(week_revenue),
            "revenue_growth_percent": round(revenue_growth, 1),
            "refunded_paise": int(refund_total),
            "total_transactions": int(total_transactions),
            "successful_transactions": int(completed),
            "failed_transactions": int(failed),
            "cancelled_transactions": int(cancelled),
            "pending_transactions": int(pending),
            "success_rate": round((completed / total_transactions * 100) if total_transactions else 0, 1),
            "total_products": int(total_products),
            "low_stock_products": int(low_stock),
            "active_machines": int(active_machines),
            "total_machines": int(total_machines),
            "units_sold": int(units_sold),
            "avg_order_paise": int(total_revenue / completed) if completed else 0,
        },
        "revenue_series": list(by_day.values()),
        "recent_transactions": [transaction_summary(tx) for tx in recent],
        "payment_mix": payment_mix,
        "top_products": top_products,
        "low_stock": low_stock_alert_feed(db, limit=6),
        "machines": [machine_out(db, machine) for machine in machines],
    }


def revenue_series(db: Session, period: str = "daily") -> dict:
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "weekly":
        start = today - timedelta(days=7 * 7 + today.weekday())
        buckets = 8
    elif period == "monthly":
        month_index = today.year * 12 + today.month - 1 - 5
        year, month_zero = divmod(month_index, 12)
        start = today.replace(
            year=year, month=month_zero + 1, day=1, hour=0, minute=0, second=0, microsecond=0
        )
        buckets = 6
    else:
        period = "daily"
        start = today - timedelta(days=13)
        buckets = 14

    rows = db.execute(
        select(Transaction.completed_at, Transaction.total_paise).where(
            Transaction.current_state == "COMPLETED",
            Transaction.completed_at >= start,
        )
    ).all()

    labels: list[dict] = []
    if period == "daily":
        for offset in range(14):
            day = start + timedelta(days=offset)
            labels.append(
                {
                    "key": day.strftime("%Y-%m-%d"),
                    "label": day.strftime("%d %b"),
                    "revenue_paise": 0,
                    "transactions": 0,
                }
            )
        lookup = {item["key"]: item for item in labels}
        for completed_at, amount in rows:
            item = lookup.get(_date_key(completed_at))
            if item:
                item["revenue_paise"] += amount
                item["transactions"] += 1
    elif period == "weekly":
        for offset in range(buckets):
            week = start + timedelta(weeks=offset)
            labels.append(
                {
                    "key": week.strftime("%Y-%m-%d"),
                    "label": f"{week.strftime('%d %b')}",
                    "revenue_paise": 0,
                    "transactions": 0,
                }
            )
        for completed_at, amount in rows:
            completed = _aware(completed_at)
            completed_day = completed.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = completed_day - timedelta(days=completed_day.weekday())
            key = week_start.strftime("%Y-%m-%d")
            for item in labels:
                if item["key"] == key:
                    item["revenue_paise"] += amount
                    item["transactions"] += 1
                    break
    else:
        month_cursor = start
        for _ in range(buckets):
            labels.append(
                {
                    "key": month_cursor.strftime("%Y-%m"),
                    "label": month_cursor.strftime("%b %Y"),
                    "revenue_paise": 0,
                    "transactions": 0,
                }
            )
            if month_cursor.month == 12:
                month_cursor = month_cursor.replace(
                    year=month_cursor.year + 1, month=1
                )
            else:
                month_cursor = month_cursor.replace(month=month_cursor.month + 1)
        lookup = {item["key"]: item for item in labels}
        for completed_at, amount in rows:
            key = _aware(completed_at).strftime("%Y-%m")
            item = lookup.get(key)
            if item:
                item["revenue_paise"] += amount
                item["transactions"] += 1

    for item in labels:
        item.pop("key", None)
    total = sum(item["revenue_paise"] for item in labels)
    return {
        "period": period,
        "items": labels,
        "total_revenue_paise": total,
        "average_paise": int(total / buckets) if buckets else 0,
    }


def product_performance(db: Session) -> list[dict]:
    sales = (
        select(
            TransactionItem.product_id.label("product_id"),
            func.coalesce(func.sum(TransactionItem.quantity), 0).label("units"),
            func.coalesce(func.sum(TransactionItem.line_total_paise), 0).label("revenue"),
        )
        .join(Transaction, Transaction.id == TransactionItem.transaction_id)
        .where(Transaction.current_state == "COMPLETED")
        .group_by(TransactionItem.product_id)
        .subquery()
    )
    rows = db.execute(
        select(
            Product,
            func.coalesce(sales.c.units, 0),
            func.coalesce(sales.c.revenue, 0),
        )
        .outerjoin(sales, sales.c.product_id == Product.id)
        .where(Product.is_active.is_(True))
        .order_by(func.coalesce(sales.c.revenue, 0).desc(), Product.name)
    ).all()
    return [
        {
            "product_id": product.id,
            "name": product.name,
            "sku": product.sku,
            "category_id": product.category_id,
            "image_url": product.image_url,
            "units_sold": int(units),
            "revenue_paise": int(revenue),
        }
        for product, units, revenue in rows
    ]


def category_revenue(db: Session) -> list[dict]:
    rows = db.execute(
        select(
            Category.id,
            Category.name,
            Category.color,
            func.coalesce(func.sum(TransactionItem.line_total_paise), 0),
            func.coalesce(func.sum(TransactionItem.quantity), 0),
        )
        .join(Product, Product.category_id == Category.id)
        .join(TransactionItem, TransactionItem.product_id == Product.id)
        .join(Transaction, Transaction.id == TransactionItem.transaction_id)
        .where(Transaction.current_state == "COMPLETED")
        .group_by(Category.id, Category.name, Category.color)
        .order_by(func.sum(TransactionItem.line_total_paise).desc())
    ).all()
    return [
        {
            "category_id": category_id,
            "name": name,
            "color": color,
            "revenue_paise": int(revenue),
            "units_sold": int(units),
        }
        for category_id, name, color, revenue, units in rows
    ]


def payment_distribution(db: Session) -> list[dict]:
    rows = db.execute(
        select(
            Payment.method,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount_paise), 0),
        )
        .where(Payment.status.in_(["captured", "refunded"]))
        .group_by(Payment.method)
        .order_by(func.count(Payment.id).desc())
    ).all()
    total = sum(int(count) for _, count, _ in rows) or 1
    return [
        {
            "method": method,
            "label": {"upi": "UPI", "coin": "Coins", "note": "Notes"}.get(
                method, method.title()
            ),
            "count": int(count),
            "amount_paise": int(amount),
            "share_percent": round(int(count) / total * 100, 1),
        }
        for method, count, amount in rows
    ]


def status_breakdown(db: Session) -> list[dict]:
    rows = db.execute(
        select(Transaction.current_state, func.count(Transaction.id)).group_by(
            Transaction.current_state
        )
    ).all()
    total = sum(int(count) for _, count in rows) or 1
    return [
        {
            "status": status,
            "count": int(count),
            "share_percent": round(int(count) / total * 100, 1),
        }
        for status, count in rows
    ]


def inventory_analytics(db: Session) -> dict:
    rows = db.execute(
        select(Inventory, Product, Machine)
        .join(Product, Product.id == Inventory.product_id)
        .join(Machine, Machine.id == Inventory.machine_id)
    ).all()
    by_category: dict[str, dict] = defaultdict(
        lambda: {"name": "", "units": 0, "low_stock": 0, "value_paise": 0}
    )
    categories = {
        category.id: category
        for category in db.scalars(select(Category)).all()
    }
    total_units = 0
    stock_value = 0
    reserved = 0
    for inventory, product, machine in rows:
        available = inventory.quantity - inventory.reserved_quantity
        category = categories.get(product.category_id)
        key = str(product.category_id)
        by_category[key]["name"] = category.name if category else "Uncategorised"
        by_category[key]["units"] += available
        by_category[key]["value_paise"] += available * product.price_paise
        if available <= inventory.low_stock_threshold:
            by_category[key]["low_stock"] += 1
        total_units += available
        stock_value += available * product.price_paise
        reserved += inventory.reserved_quantity
    return {
        "total_available_units": total_units,
        "reserved_units": reserved,
        "stock_value_paise": stock_value,
        "by_category": list(by_category.values()),
        "low_stock": low_stock_alert_feed(db, limit=30),
    }


def machine_performance(db: Session) -> list[dict]:
    machines = db.scalars(select(Machine).order_by(Machine.name)).all()
    result = []
    for machine in machines:
        stats = db.execute(
            select(
                func.count(Transaction.id),
                func.coalesce(func.sum(Transaction.total_paise), 0),
            ).where(
                Transaction.machine_id == machine.id,
                Transaction.current_state == "COMPLETED",
            )
        ).one()
        inventory_units = db.scalar(
            select(
                func.coalesce(
                    func.sum(Inventory.quantity - Inventory.reserved_quantity), 0
                )
            ).where(Inventory.machine_id == machine.id)
        ) or 0
        low_stock = db.scalar(
            select(func.count(Inventory.id)).where(
                Inventory.machine_id == machine.id,
                Inventory.quantity - Inventory.reserved_quantity
                <= Inventory.low_stock_threshold,
            )
        ) or 0
        result.append(
            {
                "machine_id": machine.id,
                "code": machine.code,
                "name": machine.name,
                "location": machine.location,
                "status": machine.status,
                "transactions": int(stats[0]),
                "revenue_paise": int(stats[1]),
                "available_units": int(inventory_units),
                "low_stock": int(low_stock),
            }
        )
    return result


def transactions_for_report(db: Session, limit: int = 1000):
    return db.scalars(
        select(Transaction)
        .options(
            joinedload(Transaction.machine),
            joinedload(Transaction.items).joinedload(TransactionItem.product),
        )
        .order_by(Transaction.started_at.desc())
        .limit(limit)
    ).unique().all()
