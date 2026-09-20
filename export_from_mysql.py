import os
from pathlib import Path
import pandas as pd
import mysql.connector

# Database connection configuration (password from environment variable)
DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "ai_agent",
    "password": os.getenv("MYSQL_PASSWORD"),
    "database": "retail midterm",
    "raise_on_warnings": True,
}

# Directory where CSV files will be written (dashboard/data)
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Tables that correspond to the CSV inputs used by process_data.py
TABLES = [
    "stores",
    "promotions",
    "products",
    "categories",
    "suppliers",
    "employees",
    "orders",
    "payments",
    "shipments",
    "returns",
    "order_items",
]

def export_table(table_name: str, cnx) -> None:
    """Export a single MySQL table to a CSV file preserving column names.

    Args:
        table_name: Name of the table to export.
        cnx: An active MySQL connection.
    """
    query = f"SELECT * FROM `{table_name}`"
    df = pd.read_sql(query, cnx)
    csv_path = DATA_DIR / f"{table_name}.csv"
    df.to_csv(csv_path, index=False)
    print(f"Exported {table_name} → {csv_path}")

def main():
    cnx = mysql.connector.connect(**DB_CONFIG)
    try:
        for tbl in TABLES:
            export_table(tbl, cnx)
    finally:
        cnx.close()

if __name__ == "__main__":
    main()
