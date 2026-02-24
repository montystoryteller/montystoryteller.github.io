#!/usr/bin/env python3
"""
Event Geocoding Script
Extracts event locations from HTML, geocodes them, and generates JavaScript with lat/lon data.
"""

import re
import time
import json
import requests
from collections import defaultdict
from typing import Dict, Tuple, Optional, List


class EventGeocoder:
    def __init__(self):
        self.geocode_cache = {}
        self.location_to_coords = {}

    def extract_postcode(self, location: str) -> Optional[str]:
        """Extract UK postcode from location string."""
        # UK postcode pattern
        postcode_pattern = r"\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b"
        match = re.search(postcode_pattern, location, re.IGNORECASE)
        return match.group(1).strip() if match else None

    def geocode_location(self, location: str) -> Optional[Tuple[float, float]]:
        """
        Geocode a location using Nominatim API.
        Returns (lat, lon) tuple or None.
        """
        if location in self.geocode_cache:
            print(f"  [CACHED] {location}")
            return self.geocode_cache[location]

        print(f"  [GEOCODING] {location}")

        try:
            # Respect rate limit (1 request per second)
            time.sleep(1.1)

            url = "https://nominatim.openstreetmap.org/search"
            params = {"format": "json", "q": location, "countrycodes": "gb", "limit": 1}
            headers = {"User-Agent": "StorytellingEventsGeocoder/1.0"}

            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()

            data = response.json()

            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                coords = (lat, lon)
                self.geocode_cache[location] = coords
                print(f"    ✓ Found: {lat}, {lon}")
                return coords
            else:
                # No results - try with just postcode + UK
                postcode = self.extract_postcode(location)
                if postcode:
                    print(f"    ↻ Retrying with postcode: {postcode}, UK")
                    time.sleep(1.1)

                    params["q"] = f"{postcode}, UK"
                    response = requests.get(
                        url, params=params, headers=headers, timeout=10
                    )
                    response.raise_for_status()

                    data = response.json()

                    if data and len(data) > 0:
                        lat = float(data[0]["lat"])
                        lon = float(data[0]["lon"])
                        coords = (lat, lon)
                        self.geocode_cache[location] = coords
                        print(f"    ✓ Found via postcode: {lat}, {lon}")
                        return coords

                print(f"    ✗ No results found")
                self.geocode_cache[location] = None
                return None

        except Exception as e:
            print(f"    ✗ Error: {e}")
            self.geocode_cache[location] = None
            return None

    def parse_events_from_html(
        self, html_content: str
    ) -> Tuple[List[dict], List[dict], List[dict]]:
        """Parse events, specificEvents, and musicEvents from HTML."""

        # Extract events array
        events_pattern = r"const events = \[(.*?)\];"
        events_match = re.search(events_pattern, html_content, re.DOTALL)

        # Extract specificEvents array
        specific_pattern = r"const specificEvents = \[(.*?)\];"
        specific_match = re.search(specific_pattern, html_content, re.DOTALL)

        # Extract musicEvents array
        music_pattern = r"const musicEvents = \[(.*?)\];"
        music_match = re.search(music_pattern, html_content, re.DOTALL)

        events = []
        specific_events = []
        music_events = []

        if events_match:
            events = self._parse_event_objects(events_match.group(1))

        if specific_match:
            specific_events = self._parse_event_objects(specific_match.group(1))

        if music_match:
            music_events = self._parse_event_objects(music_match.group(1))

        return events, specific_events, music_events

    def _parse_event_objects(self, js_array: str) -> List[dict]:
        """Parse JavaScript object literals from array string."""
        objects = []

        # Split by object boundaries (looking for },)
        obj_pattern = r"\{([^}]+)\}"
        matches = re.finditer(obj_pattern, js_array)

        for match in matches:
            obj_str = match.group(1)
            obj = {}

            # Extract location
            location_match = re.search(r'location:\s*["\']([^"\']+)["\']', obj_str)
            if location_match:
                obj["location"] = location_match.group(1)

            # Extract name
            name_match = re.search(r'name:\s*["\']([^"\']+)["\']', obj_str)
            if name_match:
                obj["name"] = name_match.group(1)

            # Check if latlon already exists
            latlon_match = re.search(r"latlon:\s*\[([^\]]+)\]", obj_str)
            if latlon_match:
                obj["has_latlon"] = True
            else:
                obj["has_latlon"] = False

            if "location" in obj:
                objects.append(obj)

        return objects

    def geocode_all_locations(
        self, events: List[dict], specific_events: List[dict], music_events: List[dict]
    ) -> Dict[str, Tuple[float, float]]:
        """
        Geocode all unique locations from events.
        Returns mapping of location -> (lat, lon).
        """
        # Collect unique locations (deduplicate)
        locations = set()

        for event in events:
            if not event.get("has_latlon") and "location" in event:
                locations.add(event["location"])

        for event in specific_events:
            if not event.get("has_latlon") and "location" in event:
                locations.add(event["location"])

        for event in music_events:
            if not event.get("has_latlon") and "location" in event:
                locations.add(event["location"])

        print(f"\n=== Geocoding {len(locations)} unique locations ===\n")

        results = {}
        for i, location in enumerate(sorted(locations), 1):
            print(f"[{i}/{len(locations)}] {location}")
            coords = self.geocode_location(location)
            if coords:
                results[location] = coords

        return results

    def generate_updated_js(
        self, html_content: str, location_coords: Dict[str, Tuple[float, float]]
    ) -> str:
        """Generate JavaScript code with latlon fields added."""

        def add_latlon_to_object(obj_str: str, location: str) -> str:
            """Add latlon field to a JavaScript object string if location matches."""
            if location not in location_coords:
                return obj_str

            # Check if latlon already exists
            if "latlon:" in obj_str:
                return obj_str

            lat, lon = location_coords[location]

            # Find the location field and add latlon after it
            location_pattern = r'(location:\s*["\']' + re.escape(location) + r'["\'])'

            if re.search(location_pattern, obj_str):
                latlon_field = f", latlon: [{lat}, {lon}]"
                obj_str = re.sub(location_pattern, r"\1" + latlon_field, obj_str)

            return obj_str

        # Process each event array
        def process_array(array_match):
            array_content = array_match.group(1)

            # Find all objects and update them
            def replace_object(obj_match):
                obj_str = obj_match.group(0)

                # Extract location from this object
                loc_match = re.search(r'location:\s*["\']([^"\']+)["\']', obj_str)
                if loc_match:
                    location = loc_match.group(1)
                    obj_str = add_latlon_to_object(obj_str, location)

                return obj_str

            array_content = re.sub(r"\{[^}]+\}", replace_object, array_content)
            return f"[{array_content}];"

        # Update events array
        html_content = re.sub(
            r"const events = \[(.*?)\];",
            lambda m: "const events = " + process_array(m),
            html_content,
            flags=re.DOTALL,
        )

        # Update specificEvents array
        html_content = re.sub(
            r"const specificEvents = \[(.*?)\];",
            lambda m: "const specificEvents = " + process_array(m),
            html_content,
            flags=re.DOTALL,
        )

        # Update musicEvents array
        html_content = re.sub(
            r"const musicEvents = \[(.*?)\];",
            lambda m: "const musicEvents = " + process_array(m),
            html_content,
            flags=re.DOTALL,
        )

        return html_content

    def save_cache(self, filename: str = "geocode_cache.json"):
        """Save geocode cache to file."""
        cache_data = {
            loc: {"lat": coords[0], "lon": coords[1]} if coords else None
            for loc, coords in self.geocode_cache.items()
        }
        with open(filename, "w") as f:
            json.dump(cache_data, f, indent=2)
        print(f"\n✓ Saved geocode cache to {filename}")

    def load_cache(self, filename: str = "geocode_cache.json"):
        """Load geocode cache from file."""
        try:
            with open(filename, "r") as f:
                cache_data = json.load(f)
                self.geocode_cache = {
                    loc: (data["lat"], data["lon"]) if data else None
                    for loc, data in cache_data.items()
                }
            print(
                f"✓ Loaded {len(self.geocode_cache)} cached locations from {filename}"
            )
        except FileNotFoundError:
            print(f"No cache file found at {filename}, starting fresh")


def main():
    """Main execution function."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python geocode_events.py <input_html_file> [output_html_file]")
        print("\nThis script will:")
        print("  1. Parse events from your HTML file")
        print("  2. Geocode unique locations (with rate limiting)")
        print("  3. Add latlon fields to events")
        print("  4. Save updated HTML")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "updated_events.html"

    geocoder = EventGeocoder()

    # Try to load existing cache
    geocoder.load_cache()

    # Read input file
    print(f"\n=== Reading {input_file} ===\n")
    with open(input_file, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Parse events
    events, specific_events, music_events = geocoder.parse_events_from_html(
        html_content
    )

    print(f"Found {len(events)} recurring events")
    print(f"Found {len(specific_events)} specific events")
    print(f"Found {len(music_events)} music events")

    # Geocode locations
    location_coords = geocoder.geocode_all_locations(
        events, specific_events, music_events
    )

    print(f"\n=== Successfully geocoded {len(location_coords)} locations ===\n")

    # Generate updated HTML
    updated_html = geocoder.generate_updated_js(html_content, location_coords)

    # Save output
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(updated_html)

    print(f"✓ Saved updated HTML to {output_file}")

    # Save cache for future runs
    geocoder.save_cache()

    # Print summary
    print("\n=== Summary ===")
    print(f"Total locations geocoded: {len(location_coords)}")
    print(
        f"Failed geocodes: {sum(1 for v in geocoder.geocode_cache.values() if v is None)}"
    )


if __name__ == "__main__":
    main()
