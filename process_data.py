
from pathlib import Path
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT / "outputs"
OUT.mkdir(exist_ok=True)

def read(name, **kwargs):
    return pd.read_csv(DATA / f"{name}.csv", **kwargs)

def records(df):
    clean = df.replace({np.nan: None, np.inf: None, -np.inf: None})
    return clean.to_dict(orient="records")

def dump(name, payload):
    with open(OUT / name, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

# ---------- Dimensions ----------
stores = read("stores")
promotions = read("promotions")
products = read("products")
categories = read("categories")
suppliers = read("suppliers")
employees = read("employees")

products = (products
    .merge(categories, on="category_id", how="left")
    .merge(suppliers, on="supplier_id", how="left"))
products["product_label"] = "Product " + products["product_id"].astype(str)

headcount = employees.groupby("store_id", as_index=False).agg(
    headcount=("employee_id","nunique"),
    payroll=("salary","sum")
)
stores = stores.merge(headcount, on="store_id", how="left").fillna({"headcount":0,"payroll":0})
stores["staffing_band"] = pd.cut(
    stores["headcount"],
    bins=[-1,7,12,np.inf],
    labels=["Lean (<=7)","Medium (8-12)","Large (>=13)"]
).astype(str)

# ---------- Order-level fact ----------
orders = read("orders")
orders["order_date"] = pd.to_datetime(orders["order_date"])
orders["year"] = orders["order_date"].dt.year
orders["month"] = orders["order_date"].dt.month
orders["month_label"] = orders["order_date"].dt.strftime("%b")
orders = orders[(orders["year"] >= 2020) & (orders["year"] <= 2023)].copy()

payments = read("payments")
shipments = read("shipments")

# Return events -> returned order flag, aggregated before order-level join.
returns = read("returns")
oi_keys = read("order_items", usecols=["order_item_id","order_id"])
returned_orders = (returns.merge(oi_keys, on="order_item_id", how="left")
                   .dropna(subset=["order_id"])
                   .groupby("order_id", as_index=False)
                   .agg(return_events=("return_id","count")))
returned_orders["returned_order"] = 1

# Basket size at order grain.
basket = (oi_keys.groupby("order_id", as_index=False)
          .agg(basket_lines=("order_item_id","nunique")))

fact = (orders
    .merge(payments.groupby("order_id", as_index=False)["amount"].sum(), on="order_id", how="left")
    .merge(shipments[["order_id","status"]], on="order_id", how="left")
    .merge(returned_orders[["order_id","returned_order"]], on="order_id", how="left")
    .merge(basket, on="order_id", how="left")
    .merge(stores[["store_id","city","headcount","payroll","staffing_band"]], on="store_id", how="left")
    .merge(promotions, on="promotion_id", how="left")
)
fact["amount"] = fact["amount"].fillna(0)
fact["returned_order"] = fact["returned_order"].fillna(0).astype(int)
fact["basket_lines"] = fact["basket_lines"].fillna(0).astype(int)
fact["status"] = fact["status"].fillna("unknown")
fact["discount"] = fact["discount"].fillna(0)

def discount_band(x):
    if x <= 5: return "0–5%"
    if x <= 10: return "6–10%"
    if x <= 15: return "11–15%"
    return "16%+"
fact["discount_band"] = fact["discount"].map(discount_band)
fact["promotion_label"] = "Promo " + fact["promotion_id"].astype(str)

def basket_band(n):
    if n <= 1: return "1 line"
    if n == 2: return "2 lines"
    if n == 3: return "3 lines"
    return "4+ lines"
fact["basket_band"] = fact["basket_lines"].map(basket_band)

# ---------- Page 1: Growth ----------
g = (fact.groupby(["year","month","month_label","city","store_id"], as_index=False)
     .agg(revenue=("amount","sum"), orders=("order_id","nunique")))
g["aov"] = g["revenue"] / g["orders"].replace(0,np.nan)
dump("growth_data.json", records(g))

# ---------- Page 2: Promotion ----------
p = (fact.groupby(["year","city","store_id","promotion_id","promotion_label",
                   "discount","discount_band"], as_index=False)
     .agg(revenue=("amount","sum"),
          orders=("order_id","nunique"),
          returned_orders=("returned_order","sum")))
p["aov"] = p["revenue"] / p["orders"].replace(0,np.nan)
p["return_rate"] = p["returned_orders"] / p["orders"].replace(0,np.nan)
dump("promotion_data.json", records(p))

# ---------- Page 3: Workforce ----------
wbase = fact[fact["year"] == 2023]
w = (wbase.groupby(["store_id","city","headcount","payroll","staffing_band"], as_index=False)
     .agg(revenue=("amount","sum"),
          orders=("order_id","nunique"),
          returned_orders=("returned_order","sum"),
          late_orders=("status", lambda s: (s.str.lower()=="late").sum())))
w["revenue_per_employee"] = w["revenue"] / w["headcount"].replace(0,np.nan)
w["orders_per_employee"] = w["orders"] / w["headcount"].replace(0,np.nan)
w["return_rate"] = w["returned_orders"] / w["orders"].replace(0,np.nan)
w["late_rate"] = w["late_orders"] / w["orders"].replace(0,np.nan)
# elasticity across store observations
valid = w[(w["headcount"]>0) & (w["revenue"]>0)]
if len(valid) > 2:
    elasticity = float(np.polyfit(np.log(valid["headcount"]), np.log(valid["revenue"]), 1)[0])
else:
    elasticity = None
dump("workforce_data.json", {"rows": records(w), "revenue_elasticity": elasticity})

# ---------- Item-level fact for Page 4 ----------
oi = read("order_items")
oi["line_gmv"] = oi["qty"] * oi["price"]

# Aggregate return events before joining to item lines.
ret_line = (returns.groupby("order_item_id", as_index=False)
            .agg(refund=("refund","sum"), return_events=("return_id","count")))
ret_line["returned_line"] = 1

item = (oi
    .merge(orders[["order_id","order_date","year","store_id"]], on="order_id", how="inner")
    .merge(products[["product_id","category_id","category_name","supplier_id","country","product_label"]],
           on="product_id", how="left")
    .merge(ret_line[["order_item_id","refund","returned_line"]], on="order_item_id", how="left"))
item["refund"] = item["refund"].fillna(0)
item["returned_line"] = item["returned_line"].fillna(0).astype(int)

# Product-level rows preserve category/supplier/product slicers.
a = (item.groupby(["category_id","category_name","supplier_id","country","product_id","product_label"],
                  as_index=False)
     .agg(gmv=("line_gmv","sum"),
          units=("qty","sum"),
          item_lines=("order_item_id","nunique"),
          returned_lines=("returned_line","sum"),
          refund=("refund","sum")))
a["return_line_rate"] = a["returned_lines"] / a["item_lines"].replace(0,np.nan)
a["refund_to_gmv"] = a["refund"] / a["gmv"].replace(0,np.nan)

# Category metrics from product rows.
cat = (a.groupby(["category_id","category_name"], as_index=False)
       .agg(gmv=("gmv","sum"),
            sku_count=("product_id","nunique"),
            units=("units","sum"),
            item_lines=("item_lines","sum"),
            returned_lines=("returned_lines","sum"),
            refund=("refund","sum")))
cat["gmv_per_sku"] = cat["gmv"] / cat["sku_count"].replace(0,np.nan)
cat["return_line_rate"] = cat["returned_lines"] / cat["item_lines"].replace(0,np.nan)
cat["refund_to_gmv"] = cat["refund"] / cat["gmv"].replace(0,np.nan)

if len(cat) > 1:
    slope, intercept = np.polyfit(cat["sku_count"], cat["gmv"], 1)
    cat["expected_gmv"] = intercept + slope * cat["sku_count"]
    cat["residual_gmv"] = cat["gmv"] - cat["expected_gmv"]
    cat["residual_pct"] = cat["residual_gmv"] / cat["expected_gmv"].replace(0,np.nan)
    pearson_r = float(cat["sku_count"].corr(cat["gmv"]))
    r2 = pearson_r ** 2
else:
    slope = intercept = pearson_r = r2 = None
    cat["expected_gmv"] = cat["residual_gmv"] = cat["residual_pct"] = None

cat["gmv_rank"] = cat["gmv"].rank(method="min", ascending=False).astype(int)
cat["productivity_rank"] = cat["gmv_per_sku"].rank(method="min", ascending=False).astype(int)
dump("assortment_data.json", {
    "products": records(a),
    "categories": records(cat),
    "pearson_r": pearson_r,
    "r_squared": r2,
    "fit": {"slope": slope, "intercept": intercept}
})

# ---------- Page 5: Delivery / Return ----------
# Overall order-level data by store/status/basket band.
d_overall = (fact.groupby(["year","city","store_id","status","basket_band"], as_index=False)
             .agg(orders=("order_id","nunique"),
                  returned_orders=("returned_order","sum")))
d_overall["return_rate"] = d_overall["returned_orders"] / d_overall["orders"].replace(0,np.nan)

# Category-specific returned-order diagnostic:
# denominator = distinct orders containing at least one item in the category.
order_cat = (item[["order_id","category_id","category_name"]]
             .drop_duplicates()
             .merge(fact[["order_id","year","city","store_id","status","basket_band","returned_order"]],
                    on="order_id", how="inner"))
d_cat = (order_cat.groupby(["year","city","store_id","status","basket_band","category_id","category_name"],
                           as_index=False)
         .agg(orders=("order_id","nunique"),
              returned_orders=("returned_order","sum")))
d_cat["return_rate"] = d_cat["returned_orders"] / d_cat["orders"].replace(0,np.nan)
dump("delivery_return_data.json", {
    "overall": records(d_overall),
    "by_category": records(d_cat)
})

filters = {
    "years": sorted(int(x) for x in fact["year"].dropna().unique()),
    "cities": sorted(str(x) for x in fact["city"].dropna().unique()),
    "stores": sorted(int(x) for x in fact["store_id"].dropna().unique()),
    "discount_bands": ["0–5%","6–10%","11–15%","16%+"],
    "promotions": sorted([{"id":int(r.promotion_id),"label":f"Promo {int(r.promotion_id)}","discount":float(r.discount)}
                          for r in promotions.itertuples()], key=lambda x:x["id"]),
    "staffing_bands": ["Lean (<=7)","Medium (8-12)","Large (>=13)"],
    "categories": sorted(str(x) for x in categories["category_name"].dropna().unique()),
    "suppliers": sorted(int(x) for x in suppliers["supplier_id"].dropna().unique()),
    "countries": sorted(str(x) for x in suppliers["country"].dropna().unique()),
    "products": sorted(int(x) for x in products["product_id"].dropna().unique()),
    "shipment_statuses": sorted(str(x) for x in fact["status"].dropna().unique()),
    "basket_bands": ["1 line","2 lines","3 lines","4+ lines"]
}
dump("filter_options.json", filters)

# ---------- Validation summary ----------
annual = fact.groupby("year").agg(revenue=("amount","sum"), orders=("order_id","nunique"))
annual["aov"] = annual["revenue"] / annual["orders"]
promo_band = fact.groupby("discount_band").agg(revenue=("amount","sum"),orders=("order_id","nunique"),
                                               returned_orders=("returned_order","sum"))
promo_band["aov"] = promo_band["revenue"]/promo_band["orders"]
promo_band["return_rate"] = promo_band["returned_orders"]/promo_band["orders"]
late = fact.assign(late=np.where(fact["status"].str.lower()=="late","Late","Non-late")).groupby("late").agg(
    orders=("order_id","nunique"), returned_orders=("returned_order","sum"))
late["return_rate"] = late["returned_orders"]/late["orders"]

validation = {
    "annual": records(annual.reset_index()),
    "promotion_band": records(promo_band.reset_index()),
    "workforce_elasticity": elasticity,
    "assortment_pearson_r": pearson_r,
    "assortment_r_squared": r2,
    "late_vs_nonlate": records(late.reset_index()),
    "notes": [
        "Payment revenue remains at order grain.",
        "Item GMV remains at item grain.",
        "2024 records are excluded from the main analysis.",
        "Category filter on Page 5 uses distinct orders containing the selected category."
    ]
}
dump("validation_summary.json", validation)
print("Generated dashboard outputs in", OUT)
