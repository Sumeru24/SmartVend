from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    Category,
    Inventory,
    Machine,
    MachineAlert,
    Payment,
    Product,
    Refund,
    StateLog,
    Transaction,
    TransactionItem,
    User,
)

IMAGES = {
    "chips": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=640&q=80",
    "cola": "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=640&q=80",
    "coffee": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=640&q=80",
    "water": "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=640&q=80",
    "cookies": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=640&q=80",
    "protein": "https://images.unsplash.com/photo-1622484212850-eb596d769edc?auto=format&fit=crop&w=640&q=80",
    "trail": "https://images.unsplash.com/photo-1599599810694-b5b37304c041?auto=format&fit=crop&w=640&q=80",
    "peanuts": "https://images.unsplash.com/photo-1567892737950-30c4db37cd89?auto=format&fit=crop&w=640&q=80",
    "mango": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=640&q=80",
    "yogurt": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=640&q=80",
    "chocolate": "https://images.unsplash.com/photo-1575377427642-087cf684f29d?auto=format&fit=crop&w=640&q=80",
    "noodles": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=640&q=80",
}

CATEGORY_DATA = [
    ("Snacks", "Chips, namkeen and savoury bites", "#f59e0b"),
    ("Beverages", "Chilled drinks and hydration", "#0ea5e9"),
    ("Healthy", "Protein-forward and better-for-you picks", "#10b981"),
    ("Sweets", "Cookies and chocolate", "#ec4899"),
    ("Essentials", "Quick meals and daily needs", "#8b5cf6"),
]

PRODUCT_DATA = [
    ("Saffron Masala Chips", "chips", "Snacks", 3000, "Fiery, hand-cooked potato chips with a saffron-spiced finish.", "SV-CHP-001"),
    ("Nitro Classic Cola", "cola", "Beverages", 4000, "Ice-cold classic cola in a recyclable aluminium can.", "SV-COLA-002"),
    ("South Indian Filter Coffee", "coffee", "Beverages", 9000, "Slow-brewed milk coffee with notes of jaggery and cardamom.", "SV-COF-003"),
    ("Himalayan Sparkling Water", "water", "Beverages", 2500, "Lightly carbonated mineral water with lime.", "SV-WTR-004"),
    ("Belgian Choco Cookies", "cookies", "Sweets", 5000, "Crunchy cookies loaded with Belgian dark chocolate.", "SV-CKY-005"),
    ("Almond Protein Bar", "protein", "Healthy", 8000, "Cold-pressed dates, almonds and 12g plant protein.", "SV-BAR-006"),
    ("Himalayan Trail Mix", "trail", "Healthy", 7000, "Roasted nuts, raisins and cranberries in a resealable pouch.", "SV-TRL-007"),
    ("Smoked Salt Peanuts", "peanuts", "Snacks", 2000, "Crunchy jumbo peanuts finished with smoked sea salt.", "SV-PNT-008"),
    ("Alphonso Mango Nectar", "mango", "Beverages", 4500, "A bright, pulpy Alphonso mango drink with no added colours.", "SV-MNG-009"),
    ("Wild Berry Greek Yogurt", "yogurt", "Healthy", 3500, "Thick cultured yogurt with a wild berry compote.", "SV-YGT-010"),
    ("70% Single Origin Dark Chocolate", "chocolate", "Sweets", 6000, "Small-batch Idukki cacao with a clean, fruity finish.", "SV-CHO-011"),
    ("Spicy Miso Instant Noodles", "noodles", "Essentials", 3500, "Springy noodles with a bold spicy miso broth.", "SV-NDL-012"),
]


def _seed_users(db: Session) -> dict[str, User]:
    users = {}
    for email, name, password, role in [
        ("admin@smartvend.in", "Aarav Mehta", "Admin@123", "admin"),
        ("operator@smartvend.in", "Meera Nair", "Operator@123", "operator"),
    ]:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(
                email=email,
                full_name=name,
                hashed_password=hash_password(password),
                role=role,
            )
            db.add(user)
            db.flush()
        users[role] = user
    return users


def _seed_history(db: Session, machines: list[Machine], products: list[Product]) -> None:
    """Create realistic historical transactions so analytics reflect SQL rows."""
    existing = db.scalar(select(func.count(Transaction.id))) or 0
    if existing:
        return

    rng = random.Random(41)
    payment_methods = ["upi", "upi", "upi", "cash", "cash"]
    now = datetime.now(timezone.utc)
    sequence_events = [
        "SELECT_PRODUCT",
        "CONFIRM_PRODUCT",
        "STOCK_AVAILABLE",
        "INSERT_NOTE",
        "SUFFICIENT_AMOUNT",
        "DISPENSE_PRODUCT",
        "DISPENSE_SUCCESS",
        "RETURN_CHANGE",
    ]
    sequence_states = [
        "IDLE",
        "PRODUCT_SELECTED",
        "INVENTORY_CHECK",
        "PAYMENT_PENDING",
        "PAYMENT_PENDING",
        "PAYMENT_ACCEPTED",
        "DISPENSING",
        "CHANGE_RETURN",
        "COMPLETED",
    ]
    ref_counter = 1000
    for day_offset in range(20, -1, -1):
        daily_count = rng.randint(1, 4) if day_offset else 2
        for _ in range(daily_count):
            machine = rng.choice([machines[0], machines[0], machines[1]])
            product = rng.choice(products)
            qty = rng.choices([1, 1, 2], k=1)[0]
            total = product.price_paise * qty
            method = rng.choice(payment_methods)
            paid = total + (rng.choice([0, 0, 0, 500, 1000, 2000]) if method == "cash" else 0)
            change = paid - total
            when = now - timedelta(days=day_offset, hours=rng.randint(1, 9), minutes=rng.randint(0, 59))
            ref_counter += 1
            transaction = Transaction(
                reference=f"SV-{when:%y%m%d}-{ref_counter}",
                machine_id=machine.id,
                current_state="COMPLETED",
                total_paise=total,
                amount_paid_paise=paid,
                change_paise=change,
                payment_method=method,
                started_at=when,
                completed_at=when + timedelta(seconds=42),
                stock_reserved=False,
                dispensed=True,
                created_at=when,
                updated_at=when + timedelta(seconds=42),
            )
            db.add(transaction)
            db.flush()
            db.add(
                TransactionItem(
                    transaction_id=transaction.id,
                    product_id=product.id,
                    product_name=product.name,
                    unit_price_paise=product.price_paise,
                    quantity=qty,
                    line_total_paise=total,
                )
            )
            db.add(
                Payment(
                    transaction_id=transaction.id,
                    method=method,
                    amount_paise=paid,
                    status="captured",
                    provider_ref=f"PAY-{when:%y%m%d}{ref_counter}",
                    is_simulated=True,
                    created_at=when,
                    updated_at=when,
                )
            )
            for seq, (event, before, after) in enumerate(
                zip(sequence_events, sequence_states, sequence_states[1:]), start=1
            ):
                db.add(
                    StateLog(
                        transaction_id=transaction.id,
                        machine_id=machine.id,
                        previous_state=before,
                        event=event,
                        next_state=after,
                        accepted=True,
                        reason="Seeded historical transition.",
                        sequence=seq,
                        created_at=when + timedelta(seconds=seq * 3),
                    )
                )

    # Cancelled attempt with no charge
    when = now - timedelta(days=3, hours=2)
    cancelled = Transaction(
        reference="SV-CANCELLED-001",
        machine_id=machines[0].id,
        current_state="CANCELLED",
        total_paise=8000,
        amount_paid_paise=0,
        change_paise=0,
        payment_method=None,
        started_at=when,
        completed_at=when + timedelta(seconds=18),
        created_at=when,
        updated_at=when,
    )
    db.add(cancelled)
    db.flush()
    db.add(
        StateLog(
            transaction_id=cancelled.id,
            previous_state="PAYMENT_PENDING",
            event="CANCEL_TRANSACTION",
            next_state="CANCELLED",
            accepted=True,
            reason="Customer cancelled before paying.",
            sequence=1,
            created_at=when,
        )
    )

    # Refunded purchase, showing recovery path
    when = now - timedelta(days=5, hours=3)
    refunded = Transaction(
        reference="SV-REFUND-002",
        machine_id=machines[1].id,
        current_state="CANCELLED",
        total_paise=9000,
        amount_paid_paise=10000,
        change_paise=0,
        payment_method="upi",
        started_at=when,
        completed_at=when + timedelta(minutes=3),
        created_at=when,
        updated_at=when + timedelta(minutes=3),
    )
    db.add(refunded)
    db.flush()
    db.add(
        TransactionItem(
            transaction_id=refunded.id,
            product_id=products[2].id,
            product_name=products[2].name,
            unit_price_paise=products[2].price_paise,
            quantity=1,
            line_total_paise=products[2].price_paise,
        )
    )
    payment = Payment(
        transaction_id=refunded.id,
        method="upi",
        amount_paise=10000,
        status="refunded",
        provider_ref="PAY-REFUND-002",
        is_simulated=True,
        created_at=when,
        updated_at=when,
    )
    db.add(payment)
    db.flush()
    db.add(
        Refund(
            transaction_id=refunded.id,
            payment_id=payment.id,
            amount_paise=10000,
            reason="Dispenser sensor fault after payment",
            status="processed",
            created_at=when + timedelta(minutes=3),
            updated_at=when + timedelta(minutes=3),
        )
    )
    for before, event, after, sec in [
        ("PAYMENT_ACCEPTED", "DISPENSE_PRODUCT", "DISPENSING", 10),
        ("DISPENSING", "DISPENSE_FAILURE", "REFUNDING", 20),
        ("REFUNDING", "PROCESS_REFUND", "CANCELLED", 180),
    ]:
        db.add(
            StateLog(
                transaction_id=refunded.id,
                previous_state=before,
                event=event,
                next_state=after,
                accepted=True,
                reason="Dispenser sensor fault; funds returned.",
                sequence=int(sec / 10),
                created_at=when + timedelta(seconds=sec),
            )
        )


def seed_demo_data(db: Session, include_history: bool = True) -> None:
    if db.scalar(select(func.count(User.id))):
        return

    users = _seed_users(db)
    categories_by_name: dict[str, Category] = {}
    for name, description, color in CATEGORY_DATA:
        category = Category(
            name=name,
            slug=name.lower().replace(" ", "-"),
            description=description,
            color=color,
        )
        db.add(category)
        db.flush()
        categories_by_name[name] = category

    products: list[Product] = []
    for name, image_key, category_name, paise, description, sku in PRODUCT_DATA:
        product = Product(
            name=name,
            slug=name.lower().replace(" ", "-").replace("%", "pct"),
            sku=sku,
            description=description,
            category_id=categories_by_name[category_name].id,
            price_paise=paise,
            image_url=IMAGES[image_key],
            is_active=True,
        )
        db.add(product)
        db.flush()
        products.append(product)

    machines = [
        Machine(
            code="SV-BLR-01",
            name="Nexus One",
            location="Prestige Tech Park, Bengaluru",
            status="online",
        ),
        Machine(
            code="SV-BLR-02",
            name="Orbit Two",
            location="Indiranagar Metro, Bengaluru",
            status="online",
        ),
        Machine(
            code="SV-MUM-01",
            name="Harbour Point",
            location="BKC, Mumbai",
            status="maintenance",
        ),
    ]
    db.add_all(machines)
    db.flush()

    stock_plan = {
        0: [18, 22, 9, 30, 12, 15, 8, 26, 14, 20, 6, 11],
        1: [7, 4, 6, 16, 3, 9, 5, 12, 8, 4, 3, 10],
        2: [0, 10, 4, 0, 7, 2, 0, 8, 5, 0, 4, 6],
    }
    slots = [f"{row}{col}" for row in "ABC" for col in range(1, 5)]
    for machine_index, machine in enumerate(machines):
        for product_index, product in enumerate(products):
            quantity = stock_plan[machine_index][product_index]
            threshold = 5
            db.add(
                Inventory(
                    machine_id=machine.id,
                    product_id=product.id,
                    quantity=quantity,
                    reserved_quantity=0,
                    low_stock_threshold=threshold,
                    slot_code=slots[product_index] if machine_index == 0 else f"{machine_index + 1}{slots[product_index]}",
                )
            )
            if quantity <= threshold:
                severity = "critical" if quantity == 0 else "warning"
                db.add(
                    MachineAlert(
                        machine_id=machine.id,
                        severity=severity,
                        type="low_stock" if quantity else "out_of_stock",
                        message=f"{product.name} is {'out of stock' if quantity == 0 else f'low ({quantity} left)'} in {machine.name}.",
                    )
                )

    db.add(
        MachineAlert(
            machine_id=machines[2].id,
            severity="info",
            type="maintenance",
            message="Scheduled preventive maintenance is in progress.",
        )
    )

    if include_history:
        _seed_history(db, machines, products)

    db.commit()
