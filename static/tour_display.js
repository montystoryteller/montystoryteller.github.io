let map;
let markers = [];
let eventsData = null;
let venuesLookup = {};
let performersLookup = {};
let toursLookup = {};
let currentTour = null; // Store current tour for map filtering

// UK_IRELAND_BOUNDS, ICON_SVG — defined in shared_utils.js

// getTodayMidnight() — defined in shared_utils.js

function getTourStatus(tour) {
  if (!tour.tour_dates || tour.tour_dates.length === 0) return "unknown";
  const today = getTodayMidnight();
  const dates = tour.tour_dates
    .map((d) => parseDateString(d.date))
    .filter(Boolean); // exclude entries with missing/malformed dates
  if (dates.length === 0) return "unknown";
  const allPast = dates.every((d) => d < today);
  const allFuture = dates.every((d) => d >= today);
  if (allPast) return "past";
  if (allFuture) return "future";
  return "current"; // straddles today
}

// isDatePast(dateStr) — defined in shared_utils.js

// sanitizeUrl() — defined in shared_utils.js

// initMap() — defined in shared_utils.js

// loadEventsData() — defined in shared_utils.js
// Populates eventsData, toursLookup, venuesLookup, performersLookup and returns eventsData.

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

  if (!performerId) {
    // Optional: Clear the map/content if no performer is selected
    document.getElementById("tourContent").style.display = "none";
    return;
  }

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

  // If there are tours available, handle the display logic
  if (performerTours.length === 1) {
    // If only one tour, select and display it automatically
    const soleTourId = performerTours[0].id;
    tourSelect.value = soleTourId;
    displayTour(soleTourId);
    updateURL(soleTourId);
  } else if (performerTours.length > 1) {
    // Optional: If there are multiple tours, you might want to clear
    // the previous tour's view until they pick one from the new list
    document.getElementById("tourContent").style.display = "none";
    markers.forEach((marker) => map.removeLayer(marker));
    markers = [];
  }
}

function handleTourChange() {
  // Auto-load tour when selection changes
  const tourId = document.getElementById("tourSelect").value;
  if (tourId) {
    displayTour(tourId);
    updateURL(tourId);
  }
}

function getTourURLParams() {
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

function createPerformerLinkElement(performer, isHeader = true) {
  if (!performer) return null;

  if (performer.url) {
    const safeUrl = sanitizeUrl(performer.url);
    const link = document.createElement("a");
    link.href = safeUrl;
    link.target = "_blank";
    link.className = `performer-link ${isHeader ? "site-link-header" : "site-link-footer"}`;
    link.textContent = isHeader
      ? `Visit ${performer.name}'s Website`
      : `Official Website: ${performer.name}`;
    return link;
  } else {
    // Return a plain span if no URL exists
    const span = document.createElement("span");
    span.className = `performer-link performer-name-plain ${isHeader ? "site-link-header" : "site-link-footer"}`;
    span.textContent = performer.name;
    return span;
  }
}

function displayTour(tourId) {
  const tour = toursLookup[tourId];
  if (!tour) {
    console.error("Tour not found:", tourId);
    return;
  }

  // Store current tour for map filtering
  currentTour = tour;

  // Show tour content
  document.getElementById("tourContent").style.display = "block";

  if (map) {
    map.invalidateSize();
  }

  // Set title and subtitle
  document.getElementById("tourTitle").textContent = tour.name;
  document.getElementById("tourSubtitle").textContent = tour.tour_name || "";

  // Performer websites
  const performer = performersLookup[tour.performer_id];
  const performerIds = new Set();
  if (tour.performer_id) performerIds.add(tour.performer_id);
  if (tour.performer_ids && Array.isArray(tour.performer_ids)) {
    tour.performer_ids.forEach((id) => performerIds.add(id));
  }

  const flyerContainer = document.getElementById("tourFlyerContainer");
  const flyerImage = document.getElementById("tourFlyerImage");

  // Rebuild container children in explicit order: top links → image → bottom links.
  // This avoids positional insertBefore/appendChild drift across repeated displayTour calls.
  flyerContainer.innerHTML = "";

  const topLinks = [];
  const bottomLinks = [];

  performerIds.forEach((id) => {
    const perf = performersLookup[id];
    if (perf && perf.url) {
      const safeUrl = sanitizeUrl(perf.url);
      if (!safeUrl) return;

      const topLink = document.createElement("a");
      topLink.href = safeUrl;
      topLink.target = "_blank";
      topLink.className = "performer-link site-link-header";
      topLink.textContent = `Visit ${perf.name}'s Website`;
      topLinks.push(topLink);

      const bottomLink = document.createElement("a");
      bottomLink.href = safeUrl;
      bottomLink.target = "_blank";
      bottomLink.className = "performer-link site-link-footer";
      bottomLink.textContent = `Official Website: ${perf.name}`;
      bottomLinks.push(bottomLink);
    }
  });

  topLinks.forEach((l) => flyerContainer.appendChild(l));
  flyerContainer.appendChild(flyerImage); // always re-attach image in the middle
  bottomLinks.forEach((l) => flyerContainer.appendChild(l));

  if (tour.tour_flyer) {
    flyerImage.src = `./storyclub_assets/event_flyers/${sanitizeFlyerPath(tour.tour_flyer)}`;
    flyerImage.alt = `${tour.name} tour flyer`;
    flyerImage.style.display = "block";
    flyerContainer.style.display = "block";
  } else {
    flyerImage.style.display = "none";
    // Show container if there are links, even if image is missing
    flyerContainer.style.display = performerIds.size > 0 ? "block" : "none";
  }

  // Display tour description if available
  const descContainer = document.getElementById("tourDescriptionContainer");
  if (tour.tour_description) {
    descContainer.innerHTML = "";
    appendParagraphs(descContainer, tour.tour_description);
    descContainer.style.display = "block";
  } else {
    descContainer.style.display = "none";
  }

  // Determine and show tour status banner
  const status = getTourStatus(tour);
  let existingBanner = document.getElementById("tourStatusBanner");
  if (existingBanner) existingBanner.remove();

  const STATUS_BANNER = {
    past: {
      cls: "tour-banner-past",
      text: "📅 This tour has ended — showing all dates.",
    },
    future: {
      cls: "tour-banner-future",
      text: "🗓 Upcoming tour — all dates still to come.",
    },
    current: {
      cls: "tour-banner-current",
      text: "🎭 Tour in progress — past dates shown in grey.",
    },
  };

  const banner = document.createElement("div");
  banner.id = "tourStatusBanner";
  banner.className = `tour-banner ${STATUS_BANNER[status]?.cls ?? "tour-banner-current"}`;
  banner.textContent = STATUS_BANNER[status]?.text ?? "";

  const datesSection = document.getElementById("tourDatesList").parentElement;
  datesSection.insertBefore(banner, document.getElementById("tourDatesList"));

  displayTourDates(tour, status);

  // Add markers to map
  addTourMarkersToMap(tour);
}

function displayTourDates(tour, status) {
  const datesContainer = document.getElementById("tourDatesList");
  datesContainer.innerHTML = "";

  if (!tour.tour_dates || tour.tour_dates.length === 0) {
    datesContainer.innerHTML = "<p>No dates scheduled yet.</p>";
    return;
  }

  const sortedDates = [...tour.tour_dates].sort(
    (a, b) => parseDateString(a.date) - parseDateString(b.date),
  );

  let firstUpcomingEl = null;

  sortedDates.forEach((tourDate) => {
    const past = isDatePast(tourDate.date);
    const dateItem = createTourDateElement(tourDate, tour, past);

    datesContainer.appendChild(dateItem);

    if (!past && !firstUpcomingEl) {
      firstUpcomingEl = dateItem;
    }
  });

  // For current tours, scroll to next upcoming date after a brief delay
  if (status === "current" && firstUpcomingEl) {
    setTimeout(() => {
      firstUpcomingEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
  }
}

// parseDateString() — defined in shared_utils.js

function createExpandableSection(parent, label, content, type) {
  const btn = document.createElement("div");
  btn.className = "event-expand-btn expand-btn-spaced";
  btn.textContent = label;

  const expandable = document.createElement("div");
  expandable.className = "event-expandable";
  expandable.style.display = "none";

  if (type === "image") {
    const img = document.createElement("img");
    img.src = `./storyclub_assets/event_flyers/${sanitizeFlyerPath(content)}`;
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

// createIcon() — defined in shared_utils.js

function createTourDateElement(tourDate, tour, past = false) {
  const div = document.createElement("div");
  // Use the standard event classes for gradients and borders
  div.className = "event tour-date-item";
  if (tour.isMusic) div.classList.add("music");
  if (past) div.classList.add("date-past");

  // Map Interaction: Zoom to venue on click
  div.addEventListener("click", () => {
    if (tourDate.venue_id && venuesLookup[tourDate.venue_id]) {
      const venue = venuesLookup[tourDate.venue_id];
      if (venue.latlon) {
        map.flyTo(venue.latlon, 14);
        markers.forEach((m) => {
          if (m.venue_id === tourDate.venue_id) m.openPopup();
        });
      }
    }
  });

  // Date Header
  const date = parseDateString(tourDate.date);
  if (!date) {
    console.warn("Invalid or missing date for tour date:", tourDate);
    return div;
  }
  const nameDiv = document.createElement("div");
  nameDiv.className = "event-name";
  nameDiv.textContent = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  div.appendChild(nameDiv);

  // Venue Location with icons — createVenueElement() defined in shared_utils.js
  if (tourDate.venue_id && venuesLookup[tourDate.venue_id]) {
    div.appendChild(createVenueElement(venuesLookup[tourDate.venue_id]));
  }

  // Tickets and Facebook Event — createTicketsElement() defined in shared_utils.js
  const ticketsEl = createTicketsElement(tourDate, past);
  if (ticketsEl) div.appendChild(ticketsEl);

  // --- More Info Button ---
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
    const tour = toursLookup[tourId];
    addTourMarkersToMap(tour);
    // Reset to show all dates
    displayTourDates(tour, getTourStatus(tour));
  }
}

function updateMapView() {
  if (!currentTour) return;
  if (!currentTour.tour_dates || currentTour.tour_dates.length === 0) return;

  const bounds = map.getBounds();
  const visibleTourDates = currentTour.tour_dates.filter((tourDate) => {
    if (tourDate.venue_id && venuesLookup[tourDate.venue_id]) {
      const venue = venuesLookup[tourDate.venue_id];
      if (
        venue.latlon &&
        Array.isArray(venue.latlon) &&
        venue.latlon.length === 2
      ) {
        return bounds.contains([venue.latlon[0], venue.latlon[1]]);
      }
    }
    return false;
  });

  console.log(
    `Tour dates in map view: ${visibleTourDates.length} of ${currentTour.tour_dates.length}`,
  );

  // Re-render the tour dates list with filtered dates
  const datesContainer = document.getElementById("tourDatesList");
  datesContainer.innerHTML = "";

  if (visibleTourDates.length === 0) {
    datesContainer.innerHTML =
      "<p>No tour dates visible in current map view. Zoom out or pan to see more dates.</p>";
    return;
  }

  // Sort dates chronologically; entries with missing/malformed dates sort to the end
  const sortedDates = [...visibleTourDates].sort((a, b) => {
    const dateA = parseDateString(a.date);
    const dateB = parseDateString(b.date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB;
  });

  sortedDates.forEach((tourDate) => {
    const past = isDatePast(tourDate.date);
    const dateItem = createTourDateElement(tourDate, currentTour, past);
    datesContainer.appendChild(dateItem);
  });
}

function addTourMarkersToMap(tour) {
  // Clear existing markers
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];

  if (!tour.tour_dates || tour.tour_dates.length === 0) {
    console.warn("No tour dates found for tour:", tour.name || tour);
    return;
  }

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

        const past = isDatePast(tourDate.date);
        const markerColor = past
          ? "#aaaaaa"
          : tour.isMusic
            ? "#443cd7"
            : "#4CAF50";
        const markerOpacity = past ? 0.5 : 0.8;

        const marker = L.circleMarker([lat, lon], {
          radius: past ? 6 : 8,
          fillColor: markerColor,
          color: past ? "#999" : "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: markerOpacity,
        }).addTo(map);

        marker.venue_id = tourDate.venue_id;

        const date = parseDateString(tourDate.date);
        const dateStr = date
          ? date.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
          : tourDate.date || "Date unknown";

        const popupContent = `
          <div class="popup-content">
            <h3>${escapeHtml(venue.name)}</h3>
            <p><strong>${escapeHtml(dateStr)}</strong></p>
            <p>${escapeHtml(venue.full_address || "")}</p>
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

// ---------------------------------------------------------------------------
// Now Touring Panel
// ---------------------------------------------------------------------------

/**
 * Build and insert a "Now Touring" panel above .tour-controls.
 * Shows tours whose date range straddles today (status === "current").
 * Story tours and music tours appear in separate labelled rows.
 * Each card sets both dropdowns and calls displayTour() on click.
 */
function renderNowTouringPanel() {
  const currentTours = Object.entries(toursLookup).filter(
    ([_, tour]) => getTourStatus(tour) === "current",
  );

  if (currentTours.length === 0) return;

  const today = getTodayMidnight();

  const storyTours = currentTours.filter(([_, t]) => !t.isMusic);
  const musicTours = currentTours.filter(([_, t]) => t.isMusic);

  const panel = document.createElement("div");
  panel.className = "now-touring-panel";

  const heading = document.createElement("h3");
  heading.className = "now-touring-heading";
  heading.textContent = "🎭 Now Touring";
  panel.appendChild(heading);

  /**
   * Build one labelled row of cards.
   * @param {Array} tours  - [[tourId, tour], ...]
   * @param {string} label - display label
   * @param {string} labelClass - CSS modifier class for colour
   */
  function buildRow(tours, label, labelClass) {
    if (tours.length === 0) return;

    const row = document.createElement("div");
    row.className = "now-touring-row";

    const rowLabel = document.createElement("div");
    rowLabel.className = `now-touring-row-label ${labelClass}`;
    rowLabel.textContent = label;
    row.appendChild(rowLabel);

    const grid = document.createElement("div");
    grid.className = "now-touring-grid";

    tours.forEach(([tourId, tour]) => {
      const performer = performersLookup[tour.performer_id];

      const allDates = (tour.tour_dates || [])
        .map((d) => parseDateString(d.date))
        .filter(Boolean)
        .sort((a, b) => a - b);

      const firstDate = allDates[0];
      const lastDate = allDates[allDates.length - 1];
      const remainingDates = allDates.filter((d) => d >= today).length;

      const fmtShort = (d) =>
        d
          ? d.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "?";

      const card = document.createElement("div");
      card.className = "now-touring-card";
      if (tour.isMusic) card.classList.add("music");

      const showName = document.createElement("div");
      showName.className = "now-touring-show-name";
      showName.textContent = tour.showname || tour.name;
      card.appendChild(showName);

      if (performer) {
        const perfName = document.createElement("div");
        perfName.className = "now-touring-performer";
        perfName.textContent = performer.name;
        card.appendChild(perfName);
      }

      const dateRange = document.createElement("div");
      dateRange.className = "now-touring-dates";
      dateRange.textContent = `${fmtShort(firstDate)} → ${fmtShort(lastDate)}`;
      card.appendChild(dateRange);

      const badge = document.createElement("div");
      badge.className = "now-touring-badge";
      badge.textContent =
        remainingDates === 1
          ? "1 date remaining"
          : `${remainingDates} dates remaining`;
      card.appendChild(badge);

      card.addEventListener("click", () => {
        const performerSelect = document.getElementById("performerSelect");
        const tourSelect = document.getElementById("tourSelect");

        if (tour.performer_id) {
          performerSelect.value = tour.performer_id;
          handlePerformerChange();
        }
        tourSelect.value = tourId;
        displayTour(tourId);
        updateURL(tourId);

        document
          .getElementById("tourContent")
          .scrollIntoView({ behavior: "smooth", block: "start" });
      });

      grid.appendChild(card);
    });

    row.appendChild(grid);
    panel.appendChild(row);
  }

  buildRow(storyTours, "📖 Stories & Spoken Word", "label-stories");
  buildRow(musicTours, "🎵 Music", "label-music");

  const controls = document.querySelector(".tour-controls");
  if (controls) {
    controls.parentNode.insertBefore(panel, controls);
  } else {
    document.body.appendChild(panel);
  }
}

// Initialize on page load
window.addEventListener("load", async () => {
  console.log("Page loaded, initializing...");

  const urlParams = getTourURLParams();
  console.log("URL params:", urlParams);

  const result = await loadEventsData(urlParams.cacheBuster);

  if (!result) {
    console.error("Failed to load events data");
    return;
  }

  eventsData = result.eventsData;
  toursLookup = result.toursLookup;
  venuesLookup = result.venuesLookup;
  performersLookup = result.performersLookup;

  console.log("Events data loaded successfully");
  console.log("Tours:", Object.keys(toursLookup).length);
  console.log("Performers:", Object.keys(performersLookup).length);
  console.log("Venues:", Object.keys(venuesLookup).length);

  map = initMap("map", updateMapView);
  console.log("Map initialized");

  populatePerformerDropdown();
  console.log("Performer dropdown populated");

  renderNowTouringPanel();
  console.log("Now Touring panel rendered");

  // If URL has tour/performer params, load them.
  // When only ?tour= is supplied (no performer=), derive the performer from
  // the tour data so both dropdowns are correctly populated.
  if (urlParams.tourId) {
    const tour = toursLookup[urlParams.tourId];
    const performerId =
      urlParams.performerId || (tour && tour.performer_id) || null;

    if (performerId) {
      console.log("Setting performer from URL (or tour lookup):", performerId);
      document.getElementById("performerSelect").value = performerId;
      handlePerformerChange(); // populates tourSelect for this performer
    }

    console.log("Loading tour from URL:", urlParams.tourId);
    document.getElementById("tourSelect").value = urlParams.tourId;
    displayTour(urlParams.tourId);
  } else if (urlParams.performerId) {
    // performer= present but no tour= — just seed the performer dropdown
    console.log("Setting performer from URL:", urlParams.performerId);
    document.getElementById("performerSelect").value = urlParams.performerId;
    handlePerformerChange();
  }
});
