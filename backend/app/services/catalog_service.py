from __future__ import annotations

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Category, Inventory, Machine, Product, TransactionItem
from app.schemas.catalog import (
    CategoryCreate,
    CategoryUpdate,
    ProductCreate,
    ProductUpdate,
)
from app.services.exceptions import VendingError
from app.services.serializers import category_out, product_out


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "item"


def _unique_product_slug(db: Session, value: str, exclude_id: int | None = None) -> str:
    base = slugify(value)
    slug = base
    counter = 2
    while True:
        existing = db.scalar(select(Product).where(Product.slug == slug))
        if not existing or existing.id == exclude_id:
            return slug
        slug = f"{base}-{counter}"
        counter += 1


def list_categories(db: Session):
    counts = dict(
        db.execute(
            select(Product.category_id, func.count(Product.id)).group_by(
                Product.category_id
            )
        ).all()
    )
    categories = db.scalars(select(Category).order_by(Category.name)).all()
    return [category_out(category, int(counts.get(category.id, 0))) for category in categories]


def create_category(db: Session, payload: CategoryCreate):
    if db.scalar(select(Category).where(func.lower(Category.name) == payload.name.lower())):
        raise VendingError("A category with this name already exists.", 409)
    category = Category(
        name=payload.name,
        slug=slugify(payload.name),
        description=payload.description,
        color=payload.color,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category_out(category, 0)


def update_category(db: Session, category_id: int, payload: CategoryUpdate):
    category = db.get(Category, category_id)
    if not category:
        raise VendingError("Category not found.", 404)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        duplicate = db.scalar(
            select(Category).where(
                func.lower(Category.name) == data["name"].lower(),
                Category.id != category_id,
            )
        )
        if duplicate:
            raise VendingError("A category with this name already exists.", 409)
        category.name = data["name"]
        category.slug = slugify(data["name"])
    if "description" in data:
        category.description = data["description"]
    if "color" in data:
        category.color = data["color"]
    db.commit()
    count = db.scalar(select(func.count(Product.id)).where(Product.category_id == category.id)) or 0
    return category_out(category, int(count))


def delete_category(db: Session, category_id: int):
    category = db.get(Category, category_id)
    if not category:
        raise VendingError("Category not found.", 404)
    products = db.scalar(
        select(func.count(Product.id)).where(Product.category_id == category_id)
    )
    if products:
        raise VendingError(
            "Move or delete the products in this category first.", 409
        )
    db.delete(category)
    db.commit()


def list_products(db: Session, include_inactive: bool = True):
    stock_subquery = (
        select(
            Inventory.product_id,
            func.coalesce(func.sum(Inventory.quantity - Inventory.reserved_quantity), 0).label(
                "total_stock"
            ),
        )
        .group_by(Inventory.product_id)
        .subquery()
    )
    query = (
        select(Product, func.coalesce(stock_subquery.c.total_stock, 0))
        .outerjoin(stock_subquery, stock_subquery.c.product_id == Product.id)
        .options(joinedload(Product.category))
        .order_by(Product.created_at.desc())
    )
    if not include_inactive:
        query = query.where(Product.is_active.is_(True))
    return [product_out(product, int(stock)) for product, stock in db.execute(query).all()]


def create_product(db: Session, payload: ProductCreate):
    if not db.get(Category, payload.category_id):
        raise VendingError("Category not found.", 404)
    duplicate = db.scalar(
        select(Product).where(
            (func.lower(Product.sku) == payload.sku.lower())
            | (Product.slug == slugify(payload.name))
        )
    )
    if duplicate:
        raise VendingError("A product with this SKU or slug already exists.", 409)

    product = Product(
        name=payload.name,
        slug=_unique_product_slug(db, payload.name),
        sku=payload.sku.upper(),
        description=payload.description,
        category_id=payload.category_id,
        price_paise=payload.price_paise,
        image_url=payload.image_url,
        is_active=payload.is_active,
    )
    db.add(product)
    db.flush()

    machines = db.scalars(select(Machine)).all()
    for machine in machines:
        existing = db.scalar(
            select(Inventory).where(
                Inventory.machine_id == machine.id,
                Inventory.product_id == product.id,
            )
        )
        if not existing:
            slot = db.scalar(
                select(func.count(Inventory.id)).where(
                    Inventory.machine_id == machine.id
                )
            ) or 0
            db.add(
                Inventory(
                    machine_id=machine.id,
                    product_id=product.id,
                    quantity=payload.initial_stock,
                    low_stock_threshold=payload.low_stock_threshold,
                    slot_code=f"{chr(65 + slot // 4)}{slot % 4 + 1}",
                )
            )
    db.commit()
    db.refresh(product)
    return get_product(db, product.id)


def get_product(db: Session, product_id: int):
    product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(joinedload(Product.category))
    )
    if not product:
        raise VendingError("Product not found.", 404)
    total_stock = db.scalar(
        select(
            func.coalesce(
                func.sum(Inventory.quantity - Inventory.reserved_quantity), 0
            )
        ).where(Inventory.product_id == product_id)
    )
    return product_out(product, int(total_stock or 0))


def update_product(db: Session, product_id: int, payload: ProductUpdate):
    product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(joinedload(Product.category))
    )
    if not product:
        raise VendingError("Product not found.", 404)
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and not db.get(Category, data["category_id"]):
        raise VendingError("Category not found.", 404)
    if "sku" in data:
        duplicate = db.scalar(
            select(Product).where(
                func.lower(Product.sku) == data["sku"].lower(),
                Product.id != product.id,
            )
        )
        if duplicate:
            raise VendingError("This SKU is already in use.", 409)
        product.sku = data["sku"].upper()
    if "name" in data:
        product.name = data["name"]
        product.slug = _unique_product_slug(db, data["name"], exclude_id=product.id)
    for field in ("description", "category_id", "price_paise", "image_url", "is_active"):
        if field in data:
            setattr(product, field, data[field])
    db.commit()
    return get_product(db, product_id)


def delete_product(db: Session, product_id: int):
    product = db.get(Product, product_id)
    if not product:
        raise VendingError("Product not found.", 404)
    used = db.scalar(
        select(func.count(TransactionItem.id)).where(
            TransactionItem.product_id == product_id
        )
    )
    if used:
        product.is_active = False
        db.commit()
        return {
            "deleted": False,
            "archived": True,
            "message": "Product is referenced by transaction history and was archived instead of deleted.",
        }
    for inventory in db.scalars(
        select(Inventory).where(Inventory.product_id == product_id)
    ).all():
        db.delete(inventory)
    db.delete(product)
    db.commit()
    return {"deleted": True, "archived": False, "message": "Product deleted."}
