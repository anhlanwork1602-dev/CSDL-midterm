# Retail Analytics Dashboard

Interactive five-page HTML dashboard for **Sales Performance and Operational Efficiency in a Multi-Store Retail Business**.

## Dashboard pages
1. Growth Driver Analysis
2. Promotion Effectiveness
3. Workforce & Store Productivity
4. Assortment & Category Productivity
5. Delivery & Return Diagnostic

## Structure
- `index.html` — single-page dashboard shell and five views
- `assets/css/style.css` — dashboard styling
- `assets/js/app.js` — data loading, KPI calculations and page rendering
- `assets/js/filters.js` — slicer state and filtering
- `assets/js/charts.js` — Chart.js helpers
- `data/` — raw CSV inputs
- `process_data.py` — preprocessing/aggregation pipeline
- `outputs/` — lightweight JSON consumed by the dashboard
- `notebooks/` — optional validation work

## Data pipeline
`Raw CSV → process_data.py → outputs/*.json → index.html + JavaScript`

The browser does not process the full raw million-row dataset.

## Metric rules
- **Payment Revenue:** `SUM(payments.amount)` at order grain.
- **AOV:** Payment Revenue / distinct orders.
- **Item GMV:** `SUM(order_items.qty * order_items.price)` at item grain.
- **Returned-order rate:** returned distinct orders / distinct orders.
- **Return-line rate:** returned item lines / item lines.
- **Revenue per employee:** 2023 Payment Revenue / current store headcount.
- **GMV per SKU:** category Item GMV / category SKU count.

Payment Revenue and Item GMV intentionally remain separate.

## Regenerate outputs
From the project root:

`python process_data.py`

## Run locally
Because browsers commonly block `fetch()` under `file://`, run a local server:

`python -m http.server 8000`

Then open `http://localhost:8000`.

## Static deployment
The project has no backend and is suitable for a static GitHub/Vercel deployment. `outputs/` must be committed together with `index.html` and `assets/`.

## Analytical scope
Main order-level analysis uses complete calendar years **2020–2023** and excludes incomplete 2024 records. Workforce analysis compares **2023 output with current headcount**.

## Important limitations
Promotion assignment has no untreated control group; staffing has no historical effective dates or labor hours; shipment status is a snapshot without delivery timestamps; return reasons are absent; payment revenue and item GMV do not reconcile as financial components. The dashboard therefore presents diagnostics and observed associations, not unsupported causal claims.
