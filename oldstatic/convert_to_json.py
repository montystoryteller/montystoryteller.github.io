#!/usr/bin/env python3
"""
Convert events from HTML JavaScript arrays to JSON format and merge with geocode data.
"""

import re
import json
from typing import List, Dict, Any


def parse_js_object(obj_str: str) -> Dict[str, Any]:
    """Parse a JavaScript object literal to a Python dict."""
    obj = {}

    # Remove surrounding braces and whitespace
    obj_str = obj_str.strip()
    if obj_str.startswith("{"):
        obj_str = obj_str[1:]
    if obj_str.endswith("}"):
        obj_str = obj_str[:-1]

    # Pattern for key-value pairs
    # Handles: key: "value", key: 'value', key: [...], key: true/false/null
    patterns = [
        (r'(\w+):\s*"([^"]*)"', "string"),
        (r"(\w+):\s*'([^']*)'", "string"),
        (r"(\w+):\s*\[([\d\.,\s]+)\]", "array"),
        (r"(\w+):\s*(true|false|null)", "boolean"),
        (r"(\w+):\s*(\d+)", "number"),
    ]

    for pattern, ptype in patterns:
        for match in re.finditer(pattern, obj_str):
            key = match.group(1)
            value = match.group(2)

            if ptype == "string":
                obj[key] = value
            elif ptype == "array":
                # Parse array of numbers
                nums = [float(n.strip()) for n in value.split(",")]
                obj[key] = nums
            elif ptype == "boolean":
                if value == "true":
                    obj[key] = True
                elif value == "false":
                    obj[key] = False
                else:
                    obj[key] = None
            elif ptype == "number":
                obj[key] = int(value)

    return obj


def extract_events_arrays(html_content: str) -> tuple:
    """Extract events, specificEvents, and musicEvents arrays from HTML."""

    def extract_array(array_name: str) -> List[Dict]:
        pattern = rf"const {array_name} = \[(.*?)\];"
        match = re.search(pattern, html_content, re.DOTALL)

        if not match:
            return []

        array_content = match.group(1)

        # Split into individual objects
        # Find all {...} blocks
        objects = []
        depth = 0
        current_obj = ""

        for char in array_content:
            if char == "{":
                depth += 1
                current_obj += char
            elif char == "}":
                current_obj += char
                depth -= 1
                if depth == 0 and current_obj.strip():
                    objects.append(parse_js_object(current_obj))
                    current_obj = ""
            elif depth > 0:
                current_obj += char

        return objects

    events = extract_array("events")
    specific_events = extract_array("specificEvents")
    music_events = extract_array("musicEvents")

    return events, specific_events, music_events


def merge_with_geocode(events: List[Dict], geocode_data: Dict) -> List[Dict]:
    """Merge events with geocode data and flag missing geocodes."""

    for event in events:
        location = event.get("location", "")

        # Skip if already has latlon
        if "latlon" in event:
            continue

        if location in geocode_data:
            coords = geocode_data[location]
            if coords and coords.get("lat") and coords.get("lon"):
                event["latlon"] = [coords["lat"], coords["lon"]]
            else:
                event["geocode_missing"] = True
                print(f"⚠ No geocode data for: {location}")
        else:
            event["geocode_missing"] = True
            print(f"⚠ Location not in geocode cache: {location}")

    return events


def main():
    import sys

    if len(sys.argv) < 3:
        print("Usage: python convert_to_json.py <input_html> <geocode_cache.json>")
        print("\nOutputs:")
        print("  - events.json")
        print("  - events_combined.json (with geocode data merged)")
        sys.exit(1)

    input_html = sys.argv[1]
    geocode_file = sys.argv[2]

    # Read HTML
    print(f"Reading {input_html}...")
    with open(input_html, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Extract events
    print("Extracting events...")
    events, specific_events, music_events = extract_events_arrays(html_content)

    print(f"Found {len(events)} recurring events")
    print(f"Found {len(specific_events)} specific events")
    print(f"Found {len(music_events)} music events")

    # Save raw events
    events_data = {
        "events": events,
        "specificEvents": specific_events,
        "musicEvents": music_events,
    }

    with open("events.json", "w", encoding="utf-8") as f:
        json.dump(events_data, f, indent=2, ensure_ascii=False)

    print("\n✓ Saved events.json")

    # Load geocode data
    print(f"\nReading {geocode_file}...")
    with open(geocode_file, "r", encoding="utf-8") as f:
        geocode_data = json.load(f)

    # Merge with geocode data
    print("\nMerging with geocode data...\n")
    events = merge_with_geocode(events, geocode_data)
    specific_events = merge_with_geocode(specific_events, geocode_data)
    music_events = merge_with_geocode(music_events, geocode_data)

    # Save combined data
    combined_data = {
        "events": events,
        "specificEvents": specific_events,
        "musicEvents": music_events,
    }

    with open("events_combined.json", "w", encoding="utf-8") as f:
        json.dump(combined_data, f, indent=2, ensure_ascii=False)

    print("\n✓ Saved events_combined.json")

    # Print summary
    missing_geocode = sum(
        1 for e in events + specific_events + music_events if e.get("geocode_missing")
    )

    print(f"\n=== Summary ===")
    print(f"Total events: {len(events) + len(specific_events) + len(music_events)}")
    print(
        f"Events with geocode data: {len(events) + len(specific_events) + len(music_events) - missing_geocode}"
    )
    print(f"Events missing geocode: {missing_geocode}")


if __name__ == "__main__":
    main()
