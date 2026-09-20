import subprocess
import sys
import os
from pathlib import Path

# Paths to the scripts relative to this file
BASE_DIR = Path(__file__).resolve().parent
EXPORT_SCRIPT = BASE_DIR / "export_from_mysql.py"
PROCESS_SCRIPT = BASE_DIR / "process_data.py"

def run_script(script_path: Path) -> int:
    """Execute a Python script and return its exit code.
    Returns 0 on success, non‑zero on failure.
    """
    print(f"Running {script_path.name} ...")
    # Use the same Python interpreter that's running this script
    result = subprocess.run([sys.executable, str(script_path)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(result.stdout)
    return result.returncode

def main():
    # Step 1: export CSVs from MySQL
    rc = run_script(EXPORT_SCRIPT)
    if rc != 0:
        print(f"{EXPORT_SCRIPT.name} failed (exit code {rc}). Stopping.")
        sys.exit(rc)

    # Step 2: process the exported data into dashboard JSONs
    rc = run_script(PROCESS_SCRIPT)
    if rc != 0:
        print(f"{PROCESS_SCRIPT.name} failed (exit code {rc}).")
        sys.exit(rc)

    print("Dashboard refresh completed successfully.")

if __name__ == "__main__":
    main()
