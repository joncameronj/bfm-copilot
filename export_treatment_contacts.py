"""
Export GoHighLevel contacts that have "get treatment" tag but NOT "booked dc" tag.
Outputs a CSV file: treatment_contacts_no_booked_dc.csv

Usage:
    python export_treatment_contacts.py

Requires: pip install requests

Note: You need your GoHighLevel Location ID. Find it in your GHL dashboard under
Settings > Business Info, or in the URL when logged into a sub-account.
Set it below or pass as env var: GHL_LOCATION_ID
"""

import csv
import os
import requests
import sys
import time

API_KEY = "pit-cf41e84d-56f5-4693-a608-a2d3ba42911f"
BASE_URL = "https://services.leadconnectorhq.com"

# Set your Location ID here or via env var GHL_LOCATION_ID
LOCATION_ID = os.environ.get("GHL_LOCATION_ID", "")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Version": "2021-07-28",
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


def get_location_id():
    """Get the location ID, prompting the user if not set."""
    if LOCATION_ID:
        return LOCATION_ID

    # Try to fetch locations from the API
    print("No LOCATION_ID set. Attempting to find your location...")
    resp = requests.get(f"{BASE_URL}/locations/search", headers=HEADERS, params={"limit": 10})
    if resp.status_code == 200:
        data = resp.json()
        locations = data.get("locations", [])
        if len(locations) == 1:
            loc_id = locations[0]["id"]
            print(f"Found location: {locations[0].get('name', loc_id)} ({loc_id})")
            return loc_id
        elif len(locations) > 1:
            print("Multiple locations found:")
            for i, loc in enumerate(locations):
                print(f"  {i+1}. {loc.get('name', 'Unknown')} - {loc['id']}")
            choice = input("Enter number to select: ").strip()
            return locations[int(choice) - 1]["id"]

    loc_id = input("Enter your GoHighLevel Location ID: ").strip()
    if not loc_id:
        print("Error: Location ID is required.")
        sys.exit(1)
    return loc_id


def search_contacts_by_tag(location_id, tag):
    """Search contacts using the V2 search endpoint with tag filter."""
    all_contacts = []
    page = 1
    page_limit = 100

    while True:
        print(f"Searching contacts with tag '{tag}' (page {page})...")
        url = f"{BASE_URL}/contacts/search"
        body = {
            "locationId": location_id,
            "page": page,
            "pageLimit": page_limit,
            "filters": [
                {
                    "field": "tags",
                    "operator": "contains",
                    "value": tag,
                }
            ],
        }

        resp = requests.post(url, headers=HEADERS, json=body)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 5))
            print(f"Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            continue

        if resp.status_code != 200:
            print(f"Error {resp.status_code}: {resp.text}")
            print("\nIf you get a 422 error, the filter format may need adjusting.")
            print("Try the fallback method by running with --fallback flag.")
            sys.exit(1)

        data = resp.json()
        contacts = data.get("contacts", [])
        total = data.get("total", "?")

        all_contacts.extend(contacts)
        print(f"  Fetched {len(all_contacts)} / {total} contacts so far")

        if not contacts or len(contacts) < page_limit:
            break

        page += 1
        time.sleep(0.5)

    return all_contacts


def fetch_all_contacts_fallback(location_id):
    """Fallback: fetch ALL contacts and filter locally (V2 list endpoint)."""
    all_contacts = []
    start_after_id = None

    while True:
        print(f"Fetching contacts (got {len(all_contacts)} so far)...")
        url = f"{BASE_URL}/contacts/"
        params = {"locationId": location_id, "limit": 100}
        if start_after_id:
            params["startAfterId"] = start_after_id

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
        meta = data.get("meta", {})
        total = meta.get("total", "?")
        print(f"  Fetched {len(all_contacts)} / {total} contacts so far")

        start_after_id = meta.get("startAfterId")
        if not start_after_id or len(contacts) < 100:
            break

        time.sleep(0.5)

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
    use_fallback = "--fallback" in sys.argv

    location_id = get_location_id()
    print(f"Using Location ID: {location_id}\n")

    if use_fallback:
        print("Using fallback method: fetching all contacts then filtering locally...")
        contacts = fetch_all_contacts_fallback(location_id)
        print(f"\nTotal contacts fetched: {len(contacts)}")
        filtered = filter_contacts(contacts)
    else:
        print("Searching for contacts with 'get treatment' tag...")
        contacts = search_contacts_by_tag(location_id, INCLUDE_TAG)
        print(f"\nContacts with '{INCLUDE_TAG}' tag: {len(contacts)}")
        # Still need to filter out "booked dc" locally
        filtered = [
            c for c in contacts
            if EXCLUDE_TAG.lower() not in [t.lower().strip() for t in c.get("tags", [])]
        ]

    print(f"Contacts with '{INCLUDE_TAG}' but without '{EXCLUDE_TAG}': {len(filtered)}")

    if not filtered:
        print("No matching contacts found.")
        return

    write_csv(filtered, OUTPUT_FILE)
    print(f"\nCSV written to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
