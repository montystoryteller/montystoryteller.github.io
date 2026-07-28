// main script
(function () {
  ("use strict");

  // Dropdown Menu Toggler For Mobile
  // ----------------------------------------
  const dropdownMenuToggler = document.querySelectorAll(
    "#nav-menu > .nav-dropdown > .nav-dropdown-toggle",
  );

  const topLevelDropdowns = document.querySelectorAll(
    "#nav-menu > .nav-dropdown",
  );

  const isMobileNav = () => window.matchMedia("(max-width: 1023px)").matches;

  const closeTopLevelDropdowns = () => {
    topLevelDropdowns.forEach((el) => el.classList.remove("active"));
  };

  dropdownMenuToggler.forEach((toggler) => {
    toggler?.addEventListener("click", (e) => {
      if (!isMobileNav()) return;
      e.preventDefault();
      e.stopPropagation();
      const dropdown = e.target.closest(".nav-dropdown");
      const isOpen = dropdown?.classList.contains("active");
      closeTopLevelDropdowns();
      if (!isOpen) {
        dropdown?.classList.add("active");
      }
    });
  });

  document.addEventListener("click", (e) => {
    if (!isMobileNav()) return;
    if (!e.target.closest("#nav-menu > .nav-dropdown")) {
      closeTopLevelDropdowns();
    }
  });

  // Clear stale mobile-open states when switching to desktop.
  window.addEventListener("resize", () => {
    if (!isMobileNav()) {
      closeTopLevelDropdowns();
    }
  });

  // Testimonial Slider
  // ----------------------------------------
  new Swiper(".testimonial-slider", {
    spaceBetween: 24,
    loop: true,
    pagination: {
      el: ".testimonial-slider-pagination",
      type: "bullets",
      clickable: true,
    },
    breakpoints: {
      768: {
        slidesPerView: 2,
      },
      992: {
        slidesPerView: 3,
      },
    },
  });

  // Outings Slider
  // ----------------------------------------
  new Swiper(".outing-slider", {
    spaceBetween: 24,
    loop: true,
    pagination: {
      el: ".outing-slider-pagination",
      type: "bullets",
      clickable: true,
    },
    breakpoints: {
      768: {
        slidesPerView: 2,
      },
      992: {
        slidesPerView: 3,
      },
    },
  });
})();
