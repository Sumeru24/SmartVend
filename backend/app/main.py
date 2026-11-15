import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.config import settings
from app.database.base import Base
from app.database.session import SessionLocal, engine
from app.models import *  # noqa: F401,F403 — register every SQLAlchemy model
from app.routes import (
    admin_analytics,
    admin_catalog,
    admin_inventory,
    admin_machines,
    admin_transactions,
    admin_uploads,
    auth,
    catalog,
    fsm,
    transactions,
)
from app.services.exceptions import VendingError
from app.services.seed import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smartvend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.SEED_DEMO_DATA:
        with SessionLocal() as db:
            try:
                seed_demo_data(db)
            except Exception:
                db.rollback()
                logger.exception("Demo seed failed")
    yield


app = FastAPI(
    title="SmartVend API",
    version="1.0.0",
    description=(
        "SmartVend — a finite-automata based smart vending machine management system. "
        "Every customer purchase advances through a persisted Extended Finite State Machine. "
        "All payments and dispensing are simulated; no physical hardware is controlled."
    ),
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(VendingError)
async def vending_error_handler(request: Request, exc: VendingError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append(
            {
                "field": ".".join(str(part) for part in error.get("loc", [])),
                "message": error.get("msg", "Invalid value"),
            }
        )
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Please check the submitted values.",
            "code": "VALIDATION_ERROR",
            "errors": errors,
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled API error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected server error occurred. No payment or stock change was committed.",
            "code": "INTERNAL_ERROR",
        },
    )


STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

for router in (
    auth.router,
    catalog.router,
    transactions.router,
    fsm.router,
    admin_catalog.router,
    admin_inventory.router,
    admin_machines.router,
    admin_transactions.router,
    admin_analytics.router,
    admin_analytics.reports_router,
    admin_uploads.router,
):
    app.include_router(router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["System"], summary="Service information")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "fsm": f"{settings.API_V1_PREFIX}/fsm/model",
        "simulation_notice": "All dispensing is software-simulated.",
    }


@app.get("/health", tags=["System"], summary="Liveness and database connectivity")
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected", "environment": settings.ENVIRONMENT}
