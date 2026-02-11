let map;
let markers = [];
let eventsData = null;
let venuesLookup = {};
let performersLookup = {};
let toursLookup = {};

const UK_IRELAND_BOUNDS = L.latLngBounds([49.5, -11.0], [61.0, 2.5]);

function sanitizeUrl(url) {
  if (!url) return null;
  url = url.trim();
  const allowedProtocols = ["http:", "https:", "mailto:"];

  try {
    const urlObj = new URL(url, window.location.origin);
    if (!allowedProtocols.includes(urlObj.protocol)) {
      console.warn("Blocked potentially dangerous URL:", url);
      return null;
    }
    return urlObj.href;
  } catch (e) {
    console.warn("Invalid URL:", url);
    return null;
  }
}

function initMap() {
  map = L.map("map", {
    maxBounds: UK_IRELAND_BOUNDS,
    maxBoundsViscosity: 1.0,
    minZoom: 5,
    maxZoom: 16,
  }).setView([53.0, -2.0], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);
}

async function loadEventsData(cacheBuster) {
  try {
    const version = cacheBuster || new Date().getTime();
    const response = await fetch(`events_normalized.json?v=${version}`);
    if (response.ok) {
      eventsData = await response.json();
      toursLookup = eventsData.tours || {};
      venuesLookup = eventsData.venues || {};
      performersLookup = eventsData.performers || {};

      console.log(`✓ Loaded events data`);
      return eventsData;
    } else {
      console.error("Failed to load events_normalized.json");
      return null;
    }
  } catch (error) {
    console.error("Error loading events:", error);
    return null;
  }
}

function shareTourLink() {
  const tourSelect = document.getElementById("tourSelect");
  const performerSelect = document.getElementById("performerSelect");

  const tourId = tourSelect.value;
  const performerId = performerSelect.value;

  if (!tourId) {
    alert("Please select a tour first");
    return;
  }

  // Create the correct URL manually based on current selections
  const params = new URLSearchParams();
  params.set("tour", tourId);
  if (performerId) {
    params.set("performer", performerId);
  }

  const shareableUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

  navigator.clipboard
    .writeText(shareableUrl)
    .then(() => {
      // Feedback UI
      const btn = document.querySelector("button[onclick='shareTourLink()']");
      const originalText = btn.innerHTML;
      btn.innerHTML = "✅ Link Copied!";

      // Also update the browser's address bar so it matches what was copied
      window.history.pushState({ tourId }, "", shareableUrl);

      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy link:", err);
    });
}

function populatePerformerDropdown() {
  const performerSelect = document.getElementById("performerSelect");

  // Get unique performers who have tours
  const performersWithTours = new Set();

  Object.values(toursLookup).forEach((tour) => {
    if (tour.performer_id && performersLookup[tour.performer_id]) {
      performersWithTours.add(tour.performer_id);
    }
  });

  // Sort performers by name
  const sortedPerformers = Array.from(performersWithTours)
    .map((id) => ({ id, name: performersLookup[id].name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  sortedPerformers.forEach((performer) => {
    const option = document.createElement("option");
    option.value = performer.id;
    option.textContent = performer.name;
    performerSelect.appendChild(option);
  });
}

function handlePerformerChange() {
  const performerId = document.getElementById("performerSelect").value;
  const tourSelect = document.getElementById("tourSelect");

  // Clear tour dropdown
  tourSelect.innerHTML = '<option value="">Select a tour...</option>';

  if (!performerId) return;

  // Find tours for this performer
  const performerTours = Object.entries(toursLookup)
    .filter(([_, tour]) => tour.performer_id === performerId)
    .map(([id, tour]) => ({ id, name: tour.tour_name || tour.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  performerTours.forEach((tour) => {
    const option = document.createElement("option");
    option.value = tour.id;
    option.textContent = tour.name;
    tourSelect.appendChild(option);
  });

  // If only one tour, select it automatically
  if (performerTours.length === 1) {
    tourSelect.value = performerTours[0].id;
  }
}

function handleTourChange() {
  // Tour selected, ready to load
}

function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    tourId: params.get("tour"),
    performerId: params.get("performer"),
    cacheBuster: params.get("v"),
  };
}

function updateURL(tourId) {
  const tour = toursLookup[tourId];
  if (!tour) return;

  const params = new URLSearchParams();
  params.set("tour", tourId);
  if (tour.performer_id) {
    params.set("performer", tour.performer_id);
  }

  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({ tourId }, "", newURL);
}

function loadTour() {
  const tourId = document.getElementById("tourSelect").value;
  if (!tourId) {
    alert("Please select a tour");
    return;
  }

  displayTour(tourId);
  updateURL(tourId);
}

function displayTour(tourId) {
  const tour = toursLookup[tourId];
  if (!tour) {
    console.error("Tour not found:", tourId);
    return;
  }

  // Show tour content
  document.getElementById("tourContent").style.display = "block";

  if (map) {
    map.invalidateSize();
  }

  // Set title and subtitle
  document.getElementById("tourTitle").textContent = tour.name;
  document.getElementById("tourSubtitle").textContent = tour.tour_name || "";

  // Performer website
  const performer = performersLookup[tour.performer_id];
  const flyerContainer = document.getElementById("tourFlyerContainer");
  const flyerImage = document.getElementById("tourFlyerImage");

  // Display tour flyer if available
  const existingLinks = flyerContainer.querySelectorAll(".performer-link");
  existingLinks.forEach((link) => link.remove());

  if (performer && performer.url) {
    const safeUrl = sanitizeUrl(performer.url);

    // Create Top Link
    const topLink = document.createElement("a");
    topLink.href = safeUrl;
    topLink.target = "_blank";
    topLink.className = "performer-link site-link-header";
    topLink.textContent = `Visit ${performer.name}'s Website`;
    flyerContainer.insertBefore(topLink, flyerImage);

    // Create Bottom Link
    const bottomLink = document.createElement("a");
    bottomLink.href = safeUrl;
    bottomLink.target = "_blank";
    bottomLink.className = "performer-link site-link-footer";
    bottomLink.textContent = `Official Website: ${performer.name}`;
    flyerContainer.appendChild(bottomLink);
  }

  if (tour.tour_flyer) {
    const flyerPath = tour.tour_flyer.replace(/[^a-zA-Z0-9._-]/g, "");
    flyerImage.src = `./storyclub_assets/event_flyers/${flyerPath}`;
    flyerImage.alt = `${tour.name} tour flyer`;
    flyerContainer.style.display = "block";
  } else {
    flyerContainer.style.display = "none";
  }

  // Display tour description if available
  const descContainer = document.getElementById("tourDescriptionContainer");
  if (tour.tour_description) {
    descContainer.innerHTML = "";
    const paragraphs = tour.tour_description.split("\n\n\n\n");
    paragraphs.forEach((p) => {
      if (p.trim()) {
        const pElem = document.createElement("p");
        pElem.textContent = p.replace(/\n\n/g, "\n");
        descContainer.appendChild(pElem);
      }
    });
    descContainer.style.display = "block";
  } else {
    descContainer.style.display = "none";
  }

  // Display tour dates
  displayTourDates(tour);

  // Add markers to map
  addTourMarkersToMap(tour);
}

function displayTourDates(tour) {
  const datesContainer = document.getElementById("tourDatesList");
  datesContainer.innerHTML = "";

  if (!tour.tour_dates || tour.tour_dates.length === 0) {
    datesContainer.innerHTML = "<p>No dates scheduled yet.</p>";
    return;
  }

  // Sort dates chronologically
  const sortedDates = [...tour.tour_dates].sort((a, b) => {
    const dateA = parseDateString(a.date);
    const dateB = parseDateString(b.date);
    return dateA - dateB;
  });

  sortedDates.forEach((tourDate) => {
    const dateItem = createTourDateElement(tourDate, tour);
    datesContainer.appendChild(dateItem);
  });
}

function parseDateString(dateStr) {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function createExpandableSection(parent, label, content, type) {
  const btn = document.createElement("div");
  btn.className = "event-expand-btn";
  btn.textContent = label;
  btn.style.marginTop = "8px";

  const expandable = document.createElement("div");
  expandable.className = "event-expandable";
  expandable.style.display = "none";

  if (type === "image") {
    const img = document.createElement("img");
    img.src = `./storyclub_assets/event_flyers/${content.replace(/[^a-zA-Z0-9._-]/g, "")}`;
    img.className = "event-flyer-image";
    expandable.appendChild(img);
  } else {
    const p = document.createElement("p");
    p.className = "event-description";
    p.textContent = content;
    expandable.appendChild(p);
  }

  btn.onclick = (e) => {
    e.stopPropagation(); // Don't zoom the map when clicking buttons
    const isHidden = expandable.style.display === "none";
    expandable.style.display = isHidden ? "block" : "none";
    btn.textContent = isHidden ? "Close" : label;
  };

  parent.appendChild(btn);
  parent.appendChild(expandable);
}

function createTourDateElement(tourDate, tour) {
  const div = document.createElement("div");
  // Use the standard event classes for gradients and borders
  div.className = "event tour-date-item";
  if (tour.isMusic) div.classList.add("music");

  // Map Interaction: Zoom to venue on click
  div.addEventListener("click", () => {
    if (tourDate.venue_id && venuesLookup[tourDate.venue_id]) {
      const venue = venuesLookup[tourDate.venue_id];
      if (venue.latlon) {
        map.flyTo(venue.latlon, 14);
        markers.forEach((m) => {
          if (m.getLatLng().lat === venue.latlon[0]) m.openPopup();
        });
      }
    }
  });

  // Date Header
  const date = parseDateString(tourDate.date);
  const nameDiv = document.createElement("div");
  nameDiv.className = "event-name";
  nameDiv.textContent = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  div.appendChild(nameDiv);

  // Venue Location
  if (tourDate.venue_id && venuesLookup[tourDate.venue_id]) {
    const venue = venuesLookup[tourDate.venue_id];
    const venueDiv = document.createElement("div");
    venueDiv.className = "event-location"; // Use class from events-styles.css

    if (venue.url) {
      const safeUrl = sanitizeUrl(venue.url);
      if (safeUrl) {
        const venueLink = document.createElement("a");
        venueLink.href = safeUrl;
        venueLink.target = "_blank";
        venueLink.textContent = venue.full_address || venue.name;

        // ADD THIS: Prevent the map from zooming when the link is clicked
        venueLink.addEventListener("click", (e) => {
          e.stopPropagation();
        });

        venueDiv.appendChild(venueLink);
      } else {
        venueDiv.textContent = venue.full_address || venue.name;
      }
    } else {
      venueDiv.textContent = venue.full_address || venue.name;
    }
    div.appendChild(venueDiv);
  }

  // Tickets
  if (tourDate.ticket_url) {
    const safeTicketUrl = sanitizeUrl(tourDate.ticket_url);
    if (safeTicketUrl) {
      const ticketDiv = document.createElement("div");
      ticketDiv.className = "event-tickets"; // Use class from events-styles.css

      const ticketLink = document.createElement("a");
      ticketLink.href = safeTicketUrl;
      ticketLink.target = "_blank";
      ticketLink.textContent = "Get tickets";

      // ADD THIS: Prevent map zoom on ticket click
      ticketLink.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      ticketDiv.appendChild(ticketLink);
      div.appendChild(ticketDiv);
    }
  }

  // --- Advice Button ---
  if (tourDate.description) {
    createExpandableSection(div, "More Info", tourDate.description, "text");
  }

  // --- Event Flyer Button (Only if it exists for this specific date) ---
  if (tourDate.event_flyer) {
    createExpandableSection(div, "Event Flyer", tourDate.event_flyer, "image");
  }

  return div;
}

function resetMapZoom() {
  const tourId = document.getElementById("tourSelect").value;
  if (tourId && toursLookup[tourId]) {
    addTourMarkersToMap(toursLookup[tourId]);
  }
}

function addTourMarkersToMap(tour) {
  // Clear existing markers
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];

  const bounds = [];

  tour.tour_dates.forEach((tourDate) => {
    if (tourDate.venue_id && venuesLookup[tourDate.venue_id]) {
      const venue = venuesLookup[tourDate.venue_id];

      if (
        venue.latlon &&
        Array.isArray(venue.latlon) &&
        venue.latlon.length === 2
      ) {
        const [lat, lon] = venue.latlon;

        const markerColor = tour.isMusic ? "#443cd7" : "#4CAF50";

        const marker = L.circleMarker([lat, lon], {
          radius: 8,
          fillColor: markerColor,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map);

        marker.venue_id = tourDate.venue_id;

        const date = parseDateString(tourDate.date);
        const dateStr = date.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });

        const popupContent = `
                    <div class="popup-content">
                        <h3>${venue.name}</h3>
                        <p><strong>${dateStr}</strong></p>
                        <p>${venue.full_address || ""}</p>
                    </div>
                `;

        marker.bindPopup(popupContent);
        markers.push(marker);
        bounds.push([lat, lon]);
      }
    }
  });

  // Fit map to show all markers
  if (bounds.length > 0) {
    if (bounds.length === 1) {
      map.setView(bounds[0], 10);
    } else {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    }
  }
}

// Initialize on page load
window.addEventListener("load", async () => {
  console.log("Page loaded, initializing...");

  const urlParams = getURLParams();
  console.log("URL params:", urlParams);

  const loaded = await loadEventsData(urlParams.cacheBuster);

  if (!loaded) {
    console.error("Failed to load events data");
    return;
  }

  console.log("Events data loaded successfully");
  console.log("Tours:", Object.keys(toursLookup).length);
  console.log("Performers:", Object.keys(performersLookup).length);
  console.log("Venues:", Object.keys(venuesLookup).length);

  initMap();
  console.log("Map initialized");

  populatePerformerDropdown();
  console.log("Performer dropdown populated");

  // If URL has tour/performer params, load them
  if (urlParams.performerId) {
    console.log("Setting performer from URL:", urlParams.performerId);
    document.getElementById("performerSelect").value = urlParams.performerId;
    handlePerformerChange();
  }

  if (urlParams.tourId) {
    console.log("Loading tour from URL:", urlParams.tourId);
    document.getElementById("tourSelect").value = urlParams.tourId;
    displayTour(urlParams.tourId);
  }
});
