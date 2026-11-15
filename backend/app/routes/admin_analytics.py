from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import require_staff
from app.database.session import get_db
from app.services import analytics_service, report_service

router = APIRouter(prefix="/admin/analytics", tags=["Admin · Analytics"])
reports_router = APIRouter(prefix="/admin/reports", tags=["Admin · Reports"])


@router.get("/dashboard", summary="Executive dashboard metrics and charts")
def dashboard(db: Session = Depends(get_db), _=Depends(require_staff)):
    return analytics_service.dashboard(db)


@router.get("/revenue", summary="Daily, weekly, or monthly revenue")
def revenue(
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    return analytics_service.revenue_series(db, period)


@router.get("/products", summary="Best and least selling products")
def products(db: Session = Depends(get_db), _=Depends(require_staff)):
    rows = analytics_service.product_performance(db)
    return {"best": rows[:8], "least": list(reversed(rows[-8:])), "all": rows}


@router.get("/categories", summary="Revenue by category")
def categories(db: Session = Depends(get_db), _=Depends(require_staff)):
    return analytics_service.category_revenue(db)


@router.get("/payments", summary="Payment method distribution")
def payments(db: Session = Depends(get_db), _=Depends(require_staff)):
    return analytics_service.payment_distribution(db)


@router.get("/statuses", summary="Transaction state distribution")
def statuses(db: Session = Depends(get_db), _=Depends(require_staff)):
    return analytics_service.status_breakdown(db)


@router.get("/inventory", summary="Inventory analytics")
def inventory(db: Session = Depends(get_db), _=Depends(require_staff)):
    return analytics_service.inventory_analytics(db)


@router.get("/machines", summary="Machine performance")
def machines(db: Session = Depends(get_db), _=Depends(require_staff)):
    return analytics_service.machine_performance(db)


@reports_router.get("/export", summary="Export a CSV or PDF operations report")
def export_report(
    format: str = Query(default="csv", pattern="^(csv|pdf)$"),
    report_type: str = Query(default="summary", pattern="^(summary|transactions|products|inventory)$"),
    db: Session = Depends(get_db),
    _=Depends(require_staff),
):
    if format == "pdf":
        content, filename = report_service.build_pdf_report(db, report_type)
        media_type = "application/pdf"
    else:
        content, filename = report_service.build_csv_report(db, report_type)
        media_type = "text/csv; charset=utf-8"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
