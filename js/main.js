/* ============================================================
   PathFinder — shared behavior: navbar, mobile menu,
   scroll-reveal animations, active-link highlighting.
   ============================================================ */

function initNavbar() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => links.classList.remove("open"))
    );
  }

  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a[data-page]").forEach((a) => {
    if (a.dataset.page === path) a.classList.add("active");
  });
}

function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || items.length === 0) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  items.forEach((el) => io.observe(el));
}

function scrollToHashTarget() {
  if (!location.hash) return;
  let target;
  try {
    target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  } catch (e) {
    return;
  }
  if (!target) return;
  // The browser's own fragment-scroll-on-load can be unreliable on pages
  // with `scroll-behavior: smooth` set globally, so it's handled
  // explicitly here once layout has settled instead of relying on it.
  requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
}

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  initReveal();
  scrollToHashTarget();
});
