from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_FILE = ROOT / "MyAmazon_Project_Report.pdf"


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def bullet_items(items, style):
    return ListFlowable(
        [ListItem(p(item, style)) for item in items],
        bulletType="bullet",
        start="circle",
        leftPadding=18,
    )


def build_report():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TitleCenter",
            parent=styles["Title"],
            alignment=TA_CENTER,
            textColor=colors.HexColor("#111827"),
            fontSize=22,
            leading=26,
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionHeading",
            parent=styles["Heading2"],
            textColor=colors.HexColor("#111827"),
            fontSize=14,
            leading=18,
            spaceBefore=10,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyCustom",
            parent=styles["BodyText"],
            fontSize=10.2,
            leading=14,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SmallNote",
            parent=styles["BodyText"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#4b5563"),
        )
    )

    story = []

    story.append(p("MyAmazon Project Report", styles["TitleCenter"]))
    story.append(p("Full project analysis, architecture summary, functional review, and cleanup notes.", styles["BodyCustom"]))
    story.append(Spacer(1, 0.18 * inch))

    overview_table = Table(
        [
            ["Project", "MyAmazon - e-commerce portfolio app"],
            ["Frontend", "Vanilla HTML, CSS, and JavaScript"],
            ["Backend", "Node.js, Express, SQLite"],
            ["Payment Flow", "UPI and Cash on Delivery"],
            ["Main Features", "Auth, product catalog, cart, checkout, orders, admin panel"],
        ],
        colWidths=[1.55 * inch, 4.75 * inch],
    )
    overview_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111827")),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.6),
                ("LEADING", (0, 0), (-1, -1), 12),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(overview_table)
    story.append(Spacer(1, 0.18 * inch))

    sections = [
        (
            "1. Project Purpose",
            [
                "MyAmazon is a portfolio-style shopping application that simulates the core experience of a modern e-commerce site.",
                "The project focuses on product browsing, authenticated cart usage, checkout, order history, order deletion, and an admin dashboard.",
                "It is designed to demonstrate full-stack flow rather than external payment gateway complexity.",
            ],
        ),
        (
            "2. Technology Stack",
            [
                "Frontend pages are built with plain HTML, CSS, and JavaScript, which keeps the UI lightweight and easy to understand.",
                "The backend uses Node.js with Express for REST APIs and SQLite for persistent storage.",
                "Security-sensitive data such as passwords are handled with Node's crypto-based hashing utilities.",
                "Configuration is loaded through dotenv, and CORS is enabled for local development and frontend/backend communication.",
            ],
        ),
        (
            "3. Application Structure",
            [
                "The backend entry point is backend/server.js, which defines the HTTP API, static file hosting, and request validation.",
                "Database setup and seeding are handled in backend/db.js, including users, categories, products, cart items, orders, and order items.",
                "Seeded catalog data lives in backend/data/products.js and covers multiple departments such as health, home, gaming, fashion, kitchen, decor, fitness, and new arrivals.",
                "The frontend is organized into page-specific HTML, CSS, and JavaScript files under frontend/html, frontend/css, and frontend/js.",
            ],
        ),
        (
            "4. Key User Flows",
            [
                "Authentication: users can register and sign in, with session state stored in localStorage for a simple client-managed session model.",
                "Catalog browsing: products can be filtered and searched, with stock-aware presentation and category-aware browsing.",
                "Cart management: items can be added, updated, and removed before checkout.",
                "Checkout: the system now supports UPI and Cash on Delivery instead of Razorpay, which simplifies the payment path for a stable demo experience.",
                "Orders: users can view order history, track status, cancel while the order is still cancellable, and delete non-delivery-stage orders from history.",
                "Admin: the admin panel can manage products, orders, and users with role checks on the backend.",
            ],
        ),
        (
            "5. Backend Review",
            [
                "The API is organized around clear resource routes such as /api/products, /api/cart, /api/orders, and /api/admin routes.",
                "Input handling is reasonably defensive: malformed JSON is converted into a clean API error response.",
                "Order status logic is implemented on the server so cancellation and deletion rules are enforced consistently.",
                "The backend persists order totals, payment method, delivery details, and item snapshots, which is important for historical accuracy.",
            ],
        ),
        (
            "6. Frontend Review",
            [
                "The frontend is modular by page, which makes the code easier to follow than a single bundled script.",
                "Shared session and API helpers are centralized in frontend/js/api.js.",
                "The checkout page was simplified after removing Razorpay, which reduced complexity and made the flow easier to maintain.",
                "The orders page supports delete and cancel actions with direct feedback to the user.",
                "The admin dashboard presents operational data in a structured table layout.",
            ],
        ),
        (
            "7. Data Model",
            [
                "users stores account data, admin flags, block state, and timestamps.",
                "categories and products define the catalog.",
                "cart_items tracks active shopping carts by user and product.",
                "orders stores order summary fields such as status, tracking stage, payment method, delivery details, totals, and placed time.",
                "order_items stores a frozen copy of purchased product details for order history integrity.",
            ],
        ),
        (
            "8. Cleanup Performed",
            [
                "Removed the unused Razorpay dependency from package.json.",
                "Removed placeholder Razorpay environment variables from backend/.env.",
                "Removed debug console logging from backend and frontend production paths.",
                "Validated that the backend health endpoint still responds successfully after cleanup.",
            ],
        ),
        (
            "9. Current Strengths",
            [
                "The app has a clear end-to-end shopping flow and a realistic data model.",
                "Admin and user responsibilities are separated with backend authorization checks.",
                "The project is easy to run locally and works well as a portfolio demonstration.",
                "The payment path is now less fragile because it no longer depends on external gateway credentials.",
            ],
        ),
        (
            "10. Recommended Next Improvements",
            [
                "Replace browser alert dialogs with inline toast or banner notifications for better user experience.",
                "Add stronger request validation for incoming form data.",
                "Introduce rate limiting if the project is ever exposed publicly.",
                "Consider moving hard-coded admin identity values into a more explicit configuration layer if future reuse is planned.",
            ],
        ),
    ]

    for heading, items in sections:
        story.append(p(heading, styles["SectionHeading"]))
        story.append(bullet_items(items, styles["BodyCustom"]))
        story.append(Spacer(1, 0.08 * inch))

    story.append(
        KeepTogether(
            [
                p("Final Assessment", styles["SectionHeading"]),
                p(
                    "MyAmazon is in good shape as a portfolio-grade full-stack project. The main feature set is complete, the payment flow is simplified and reliable, and the codebase is structured clearly enough for future maintenance or demo use.",
                    styles["BodyCustom"],
                ),
                p(
                    "Generated on the local workspace from the current project state.",
                    styles["SmallNote"],
                ),
            ]
        )
    )

    doc = SimpleDocTemplate(
        str(OUTPUT_FILE),
        pagesize=A4,
        rightMargin=0.7 * inch,
        leftMargin=0.7 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
        title="MyAmazon Project Report",
        author="GitHub Copilot",
    )
    doc.build(story)


if __name__ == "__main__":
    build_report()
    print(f"Created {OUTPUT_FILE}")