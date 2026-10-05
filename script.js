// "Pay ___ from one wallet." — matches the Figma prototype:
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

// Waitlist forms. There is no backend yet — hook the submission up here.
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
