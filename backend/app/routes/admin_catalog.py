from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_admin, require_staff
from app.database.session import get_db
from app.schemas.catalog import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from app.services import catalog_service

router = APIRouter(prefix="/admin", tags=["Admin · Catalog"])


@router.get(
    "/categories",
    response_model=list[CategoryOut],
    summary="List product categories",
)
def categories(db: Session = Depends(get_db), _=Depends(require_staff)):
    return catalog_service.list_categories(db)


@router.post(
    "/categories",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a category",
)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return catalog_service.create_category(db, payload)


@router.patch(
    "/categories/{category_id}",
    response_model=CategoryOut,
    summary="Update a category",
)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return catalog_service.update_category(db, category_id, payload)


@router.delete(
    "/categories/{category_id}",
    summary="Delete an empty category",
)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    catalog_service.delete_category(db, category_id)
    return {"message": "Category deleted."}


@router.get(
    "/products",
    response_model=list[ProductOut],
    summary="List products with aggregate stock",
)
def products(
    include_inactive: bool = Query(default=True),
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return catalog_service.list_products(db, include_inactive)


@router.get(
    "/products/{product_id}",
    response_model=ProductOut,
    summary="Product detail",
)
def product(
    product_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return catalog_service.get_product(db, product_id)


@router.post(
    "/products",
    response_model=ProductOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product and initialise inventory across machines",
)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return catalog_service.create_product(db, payload)


@router.patch(
    "/products/{product_id}",
    response_model=ProductOut,
    summary="Update a product",
)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return catalog_service.update_product(db, product_id, payload)


@router.delete(
    "/products/{product_id}",
    summary="Delete a product, or archive it if transaction history references it",
)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return catalog_service.delete_product(db, product_id)
