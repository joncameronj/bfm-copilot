"""
Export GoHighLevel contacts that have "get treatment" tag but NOT "booked dc" tag.
Outputs a CSV file: treatment_contacts_no_booked_dc.csv

Usage:
    python export_treatment_contacts.py
"""

import csv
import requests
import sys
import time

API_KEY = "pit-cf41e84d-56f5-4693-a608-a2d3ba42911f"
BASE_URL = "https://rest.gohighlevel.com/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

INCLUDE_TAG = "get treatment"
EXCLUDE_TAG = "booked dc"

OUTPUT_FILE = "treatment_contacts_no_booked_dc.csv"

CSV_FIELDS = [
    "id",
    "firstName",
    "lastName",
    "email",
    "phone",
    "tags",
    "dateAdded",
    "source",
    "city",
    "state",
    "country",
    "companyName",
]


def fetch_all_contacts():
    """Fetch all contacts from GoHighLevel, paginating through results."""
    all_contacts = []
    offset = 0
    limit = 100

    while True:
        print(f"Fetching contacts (offset={offset})...")
        url = f"{BASE_URL}/contacts/"
        params = {"limit": limit, "query": ""}
        if offset > 0:
            params["startAfterId"] = all_contacts[-1]["id"]

        resp = requests.get(url, headers=HEADERS, params=params)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 5))
            print(f"Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            continue

        if resp.status_code != 200:
            print(f"Error: {resp.status_code} - {resp.text}")
            sys.exit(1)

        data = resp.json()
        contacts = data.get("contacts", [])
        if not contacts:
            break

        all_contacts.extend(contacts)
        offset += len(contacts)
        meta = data.get("meta", {})
        total = meta.get("total", "?")
        print(f"  Fetched {len(all_contacts)} / {total} contacts so far")

        if len(contacts) < limit:
            break

        time.sleep(0.5)  # Be nice to the API

    return all_contacts


def filter_contacts(contacts):
    """Keep contacts with INCLUDE_TAG but without EXCLUDE_TAG."""
    filtered = []
    for c in contacts:
        tags = [t.lower().strip() for t in c.get("tags", [])]
        if INCLUDE_TAG.lower() in tags and EXCLUDE_TAG.lower() not in tags:
            filtered.append(c)
    return filtered


def write_csv(contacts, filename):
    """Write contacts to a CSV file."""
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for c in contacts:
            row = {}
            for field in CSV_FIELDS:
                val = c.get(field, "")
                if field == "tags" and isinstance(val, list):
                    val = "; ".join(val)
                row[field] = val
            writer.writerow(row)


def main():
    print("Fetching all contacts from GoHighLevel...")
    contacts = fetch_all_contacts()
    print(f"\nTotal contacts fetched: {len(contacts)}")

    filtered = filter_contacts(contacts)
    print(f"Contacts with '{INCLUDE_TAG}' but without '{EXCLUDE_TAG}': {len(filtered)}")

    if not filtered:
        print("No matching contacts found.")
        return

    write_csv(filtered, OUTPUT_FILE)
    print(f"\nCSV written to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
