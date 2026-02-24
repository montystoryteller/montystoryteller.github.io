#!/usr/bin/env python3
"""
Normalize events JSON structure to separate venues and performers into their own collections
"""
import json
import copy
import re
from pathlib import Path
from collections import Counter


def slugify(text):
    """Convert text to a clean URL-friendly slug"""
    # Convert to lowercase
    text = text.lower()
    # Remove special characters, keep alphanumeric and spaces
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    # Replace spaces and multiple hyphens with single hyphen
    text = re.sub(r"[\s-]+", "-", text)
    # Remove leading/trailing hyphens
    text = text.strip("-")
    return text


def generate_venue_id(location):
    """Generate a clean ID from venue location string"""
    if not location:
        return None

    # Split by comma to get venue name (first part)
    parts = location.split(",")
    venue_name = parts[0].strip()

    # Get city/area (usually second part)
    city = parts[1].strip() if len(parts) > 1 else ""

    # Create base slug from venue name
    base_slug = slugify(venue_name)

    # Add city for disambiguation if available
    if city:
        city_slug = slugify(city)
        # Take first word of city for brevity
        city_word = city_slug.split("-")[0]
        if city_word and city_word not in base_slug:
            base_slug = f"{base_slug}-{city_word}"

    return base_slug


def generate_performer_id(performer_name):
    """Generate a clean ID from performer name"""
    if not performer_name:
        return None
    return slugify(performer_name)


def extract_venues(events_data):
    """Extract unique venues from all event types with generated IDs"""
    venues = {}
    venue_id_counter = Counter()
    location_to_id = {}  # Map full location string to its ID

    def add_venue(location, venue_url=None, latlon=None):
        if not location:
            return None

        # If we've seen this exact location string before, return existing ID
        if location in location_to_id:
            return location_to_id[location]

        # Generate base ID
        base_id = generate_venue_id(location)
        if not base_id:
            return None

        # Handle duplicates by adding number suffix
        venue_id_counter[base_id] += 1
        if venue_id_counter[base_id] > 1:
            venue_id = f"{base_id}-{venue_id_counter[base_id]}"
        else:
            venue_id = base_id

        # Parse location into parts
        parts = [p.strip() for p in location.split(",")]
        venue_name = parts[0] if len(parts) > 0 else location
        city = parts[1] if len(parts) > 1 else ""
        postcode = parts[2] if len(parts) > 2 else ""

        venues[venue_id] = {
            "id": venue_id,
            "name": venue_name,
            "city": city,
            "postcode": postcode,
            "full_address": location,
            "url": venue_url or "",
            "latlon": latlon or [],
        }

        # Remember the mapping
        location_to_id[location] = venue_id

        return venue_id

    # Process all event types
    for event_type in [
        "events",
        "specificEvents",
        "musicEvents",
        "folkNights",
        "irishSessions",
    ]:
        if event_type in events_data:
            for event in events_data[event_type]:
                if "location" in event:
                    add_venue(
                        event.get("location"),
                        event.get("venue_url"),
                        event.get("latlon"),
                    )

                # Handle alternate locations
                if "alternate_locations" in event:
                    for parity, alt_loc in event["alternate_locations"].items():
                        if "location" in alt_loc:
                            add_venue(
                                alt_loc["location"],
                                alt_loc.get("venue_url"),
                                alt_loc.get("latlon"),
                            )

    return venues, location_to_id


def extract_performers(events_data):
    """Extract unique performers from specific and music events with generated IDs"""
    performers = {}
    performer_id_counter = Counter()
    performer_to_id = {}  # Map performer name to its ID

    def add_performer(performer_name, performer_url=None, bio=None):
        if not performer_name:
            return None

        # If we've seen this performer before, return existing ID
        if performer_name in performer_to_id:
            return performer_to_id[performer_name]

        # Generate base ID
        base_id = generate_performer_id(performer_name)
        if not base_id:
            return None

        # Handle duplicates by adding number suffix
        performer_id_counter[base_id] += 1
        if performer_id_counter[base_id] > 1:
            performer_id = f"{base_id}-{performer_id_counter[base_id]}"
        else:
            performer_id = base_id

        performers[performer_id] = {
            "id": performer_id,
            "name": performer_name,
            "url": performer_url or "",
            "bio": bio or "",
        }

        # Remember the mapping
        performer_to_id[performer_name] = performer_id

        return performer_id

    # Process specific and music events
    for event_type in ["specificEvents", "musicEvents"]:
        if event_type in events_data:
            for event in events_data[event_type]:
                if "performer" in event:
                    add_performer(
                        event.get("performer"),
                        event.get("performer_url"),
                        event.get("description"),  # Use description as bio for now
                    )

    return performers, performer_to_id


def create_normalized_structure(
    events_data, venues, performers, location_to_id, performer_to_id
):
    """Create normalized version - replace location/performer strings with IDs"""
    normalized = copy.deepcopy(events_data)

    # Add the collections at the top level
    normalized["venues"] = venues
    normalized["performers"] = performers

    # Replace location/performer strings with IDs in events
    for event_type in [
        "events",
        "specificEvents",
        "musicEvents",
        "folkNights",
        "irishSessions",
    ]:
        if event_type not in normalized:
            continue

        for event in normalized[event_type]:
            # Replace location string with venue ID
            if "location" in event and event["location"]:
                venue_id = location_to_id.get(event["location"])
                if venue_id:
                    event["venue_id"] = venue_id
                    del event["location"]  # Remove the full string

            # Remove duplicate venue data
            if "venue_url" in event:
                del event["venue_url"]
            if "latlon" in event:
                del event["latlon"]

            # Handle alternate locations
            if "alternate_locations" in event:
                for parity, alt_loc in event["alternate_locations"].items():
                    if "location" in alt_loc and alt_loc["location"]:
                        venue_id = location_to_id.get(alt_loc["location"])
                        if venue_id:
                            alt_loc["venue_id"] = venue_id
                            del alt_loc["location"]

                    if "venue_url" in alt_loc:
                        del alt_loc["venue_url"]
                    if "latlon" in alt_loc:
                        del alt_loc["latlon"]

            # Replace performer string with ID
            if "performer" in event and event["performer"]:
                performer_id = performer_to_id.get(event["performer"])
                if performer_id:
                    event["performer_id"] = performer_id
                    del event["performer"]  # Remove the full name

            # Remove duplicate performer data
            if "performer_url" in event:
                del event["performer_url"]

    return normalized


def main():
    # Read input file
    input_file = Path("events_combined.json")

    with open(input_file, "r", encoding="utf-8") as f:
        events_data = json.load(f)

    print("Extracting venues and generating IDs...")
    venues, location_to_id = extract_venues(events_data)
    print(f"Found {len(venues)} unique venues")

    print("\nExtracting performers and generating IDs...")
    performers, performer_to_id = extract_performers(events_data)
    print(f"Found {len(performers)} unique performers")

    print("\nCreating normalized structure...")
    normalized = create_normalized_structure(
        events_data, venues, performers, location_to_id, performer_to_id
    )

    # Write single output file
    output_file = Path("events_normalized.json")

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(normalized, f, indent=2, ensure_ascii=False)
    print(f"\nWrote normalized data to {output_file}")

    # Print statistics
    print("\n=== Statistics ===")
    print(f"Venues: {len(venues)}")
    print(f"Performers: {len(performers)}")
    print(f"Recurring events: {len(events_data.get('events', []))}")
    print(f"Specific events: {len(events_data.get('specificEvents', []))}")
    print(f"Music events: {len(events_data.get('musicEvents', []))}")
    print(f"Folk nights: {len(events_data.get('folkNights', []))}")
    print(f"Irish sessions: {len(events_data.get('irishSessions', []))}")

    # Show sample venues with IDs
    print("\n=== Sample Venues ===")
    for i, (venue_id, venue) in enumerate(list(venues.items())[:5]):
        print(f"{i+1}. ID: {venue_id}")
        print(f"   Name: {venue['name']}")
        if venue["city"]:
            print(f"   City: {venue['city']}")
        if venue["url"]:
            print(f"   URL: {venue['url']}")
        if venue["latlon"]:
            print(f"   Coords: {venue['latlon']}")

    # Show sample performers with IDs
    print("\n=== Sample Performers ===")
    for i, (performer_id, performer) in enumerate(list(performers.items())[:5]):
        print(f"{i+1}. ID: {performer_id}")
        print(f"   Name: {performer['name']}")
        if performer["url"]:
            print(f"   URL: {performer['url']}")

    print("\n✓ Done! Your original file is unchanged.")
    print(f"✓ New file created: {output_file}")
    print("\nNext steps:")
    print("1. Review the new file to verify IDs and data look correct")
    print("2. Apply the JavaScript changes from SIMPLE_GUIDE.md")
    print("3. Update your HTML to load events_normalized.json instead")
    print("4. Test thoroughly before replacing original")


if __name__ == "__main__":
    main()
