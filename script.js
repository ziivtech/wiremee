// "Pay ___ from one wallet." matches the Figma prototype:
// each word holds for 0.8s, then slides in over 0.3s (ease-out).
(function rotateWords() {
  const words = document.querySelectorAll(".rotator__word");
  if (words.length < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let index = 0;
  setInterval(() => {
    words[index].classList.remove("is-active");
    index = (index + 1) % words.length;
    words[index].classList.add("is-active");
  }, 1100);
})();

// Mobile / tablet menu
(function navMenu() {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav__toggle");
  if (!nav || !toggle) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  nav.querySelectorAll(".nav__links a").forEach((link) =>
    link.addEventListener("click", () => setOpen(false))
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
})();

// Waitlist forms. There is no backend yet; hook the submission up here.
document.querySelectorAll("[data-waitlist]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector("input[type=email]");
    const button = form.querySelector("button");
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }

    // TODO: send `input.value` to the waitlist service.

    const label = button.textContent;
    button.textContent = "You're on the list!";
    button.disabled = true;
    input.value = "";
    setTimeout(() => {
      button.textContent = label;
      button.disabled = false;
    }, 3000);
  });
});

// "For Individuals" / "For businesses" tabs
(function audienceTabs() {
  const tabs = Array.from(document.querySelectorAll(".toggle__btn"));
  if (!tabs.length) return;

  const select = (tab) => {
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !active;
    });
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      select(next);
      next.focus();
    });
  });
})();

// Nav "Personal" / "Business" links open the matching audience tab
document.querySelectorAll("[data-audience-tab]").forEach((link) =>
  link.addEventListener("click", () => document.getElementById(link.dataset.audienceTab)?.click())
);

// Parallax for the bead-spiral backgrounds
(function beadParallax() {
  const sections = document.querySelectorAll(".beads");
  if (!sections.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const RANGE = 60; // max px the image lags behind the page
  let ticking = false;

  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;
      // -1 when the section is entering from below, 1 when leaving at the top
      const progress = (vh / 2 - (rect.top + rect.height / 2)) / (vh / 2 + rect.height / 2);
      section.style.setProperty("--parallax", `${(progress * RANGE).toFixed(1)}px`);
    });
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();
