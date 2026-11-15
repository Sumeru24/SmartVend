from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Inventory, Machine, Product
from app.services.analytics_service import (
    dashboard,
    inventory_analytics,
    machine_performance,
    product_performance,
    revenue_series,
    transactions_for_report,
)


def _rupees(paise: int) -> str:
    return f"INR {paise / 100:,.2f}"


def build_csv_report(db: Session, report_type: str = "summary") -> tuple[bytes, str]:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    if report_type == "products":
        writer.writerow(["Product ID", "Product", "SKU", "Units sold", "Revenue (INR)"])
        for row in product_performance(db):
            writer.writerow(
                [
                    row["product_id"],
                    row["name"],
                    row["sku"],
                    row["units_sold"],
                    f"{row['revenue_paise'] / 100:.2f}",
                ]
            )
        filename = f"smartvend-products-{timestamp}.csv"
    elif report_type == "inventory":
        writer.writerow(
            [
                "Machine",
                "Product",
                "Slot",
                "On hand",
                "Reserved",
                "Available",
                "Threshold",
            ]
        )
        rows = db.execute(
            select(Inventory, Product, Machine)
            .join(Product, Product.id == Inventory.product_id)
            .join(Machine, Machine.id == Inventory.machine_id)
            .order_by(Machine.name, Inventory.slot_code)
        ).all()
        for inventory, product, machine in rows:
            writer.writerow(
                [
                    machine.name,
                    product.name,
                    inventory.slot_code,
                    inventory.quantity,
                    inventory.reserved_quantity,
                    inventory.quantity - inventory.reserved_quantity,
                    inventory.low_stock_threshold,
                ]
            )
        filename = f"smartvend-inventory-{timestamp}.csv"
    else:
        writer.writerow(
            [
                "Reference",
                "Machine",
                "Status",
                "Items",
                "Total (INR)",
                "Paid (INR)",
                "Change (INR)",
                "Payment method",
                "Started",
            ]
        )
        for tx in transactions_for_report(db):
            writer.writerow(
                [
                    tx.reference,
                    tx.machine.name if tx.machine else "",
                    tx.current_state,
                    "; ".join(f"{i.product_name} x{i.quantity}" for i in tx.items),
                    f"{tx.total_paise / 100:.2f}",
                    f"{tx.amount_paid_paise / 100:.2f}",
                    f"{tx.change_paise / 100:.2f}",
                    tx.payment_method or "",
                    tx.started_at.isoformat(),
                ]
            )
        filename = f"smartvend-transactions-{timestamp}.csv"

    return buffer.getvalue().encode("utf-8"), filename


def _pdf_table(data, col_widths=None):
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 1), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
            ]
        )
    )
    return table


def build_pdf_report(db: Session, report_type: str = "summary") -> tuple[bytes, str]:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="SmartVend report",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "SVTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=27,
        textColor=colors.HexColor("#0f172a"),
        alignment=TA_LEFT,
        spaceAfter=2,
    )
    subtitle = ParagraphStyle(
        "SVSub",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#64748b"),
    )
    section = ParagraphStyle(
        "SVSection",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=16,
        spaceAfter=8,
    )
    story = [
        Paragraph("SmartVend", title_style),
        Paragraph("Finite Automata Vending Operations Report", subtitle),
        Paragraph(
            datetime.now(timezone.utc).strftime("Generated %d %B %Y at %H:%M UTC"),
            subtitle,
        ),
        Spacer(1, 10),
    ]

    data_overview = dashboard(db)
    stats = data_overview["stats"]
    story.append(Paragraph("Executive overview", section))
    overview_data = [
        ["Metric", "Value"],
        ["Total revenue", _rupees(stats["total_revenue_paise"])],
        ["Total transactions", f"{stats['total_transactions']:,}"],
        ["Successful / cancelled / failed", f"{stats['successful_transactions']} / {stats['cancelled_transactions']} / {stats['failed_transactions']}"],
        ["Success rate", f"{stats['success_rate']}%"],
        ["Units sold", f"{stats['units_sold']:,}"],
        ["Active machines", f"{stats['active_machines']} of {stats['total_machines']}"],
        ["Low stock SKUs", f"{stats['low_stock_products']}"],
        ["Refunds processed", _rupees(stats["refunded_paise"])],
    ]
    story.append(_pdf_table(overview_data, [95 * mm, 80 * mm]))

    story.append(Paragraph("Revenue trend (last 14 days)", section))
    revenue = revenue_series(db, "daily")["items"][-8:]
    story.append(
        _pdf_table(
            [["Date", "Transactions", "Revenue"]]
            + [
                [row["label"], str(row["transactions"]), _rupees(row["revenue_paise"])]
                for row in revenue
            ],
            [65 * mm, 50 * mm, 60 * mm],
        )
    )

    story.append(Paragraph("Top products", section))
    products = product_performance(db)[:8]
    story.append(
        _pdf_table(
            [["Product", "Units", "Revenue"]]
            + [
                [row["name"][:45], str(row["units_sold"]), _rupees(row["revenue_paise"])]
                for row in products
            ],
            [95 * mm, 35 * mm, 45 * mm],
        )
    )

    story.append(Paragraph("Machine performance", section))
    machines = machine_performance(db)
    story.append(
        _pdf_table(
            [["Machine", "Status", "Transactions", "Revenue"]]
            + [
                [row["name"], row["status"], str(row["transactions"]), _rupees(row["revenue_paise"])]
                for row in machines
            ],
            [60 * mm, 32 * mm, 38 * mm, 45 * mm],
        )
    )

    if report_type == "inventory":
        story.append(Paragraph("Inventory analytics", section))
        inv = inventory_analytics(db)
        story.append(
            _pdf_table(
                [["Category", "Units", "Low-stock SKUs", "Stock value"]]
                + [
                    [
                        row["name"],
                        str(row["units"]),
                        str(row["low_stock"]),
                        _rupees(row["value_paise"]),
                    ]
                    for row in inv["by_category"]
                ],
                [60 * mm, 30 * mm, 40 * mm, 45 * mm],
            )
        )

    story.append(Spacer(1, 14))
    story.append(
        Paragraph(
            "All dispensing is simulated by software. This report does not represent physical "
            "hardware telemetry. Monetary values are stored as integer paise.",
            subtitle,
        )
    )
    doc.build(story)
    filename = f"smartvend-{report_type}-{timestamp}.pdf"
    return buffer.getvalue(), filename
