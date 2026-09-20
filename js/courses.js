/* ============================================================
   PathFinder — course explorer
   Search + field filter over the course catalog, plus a detail
   modal. Supports deep-linking via ?course=<id>.
   ============================================================ */

(function () {
  const grid = document.getElementById("course-grid");
  const searchInput = document.getElementById("search-input");
  const chipsWrap = document.getElementById("filter-chips");
  const resultsCount = document.getElementById("results-count");
  const emptyState = document.getElementById("empty-state");
  const overlay = document.getElementById("modal-overlay");
  const modalCard = document.getElementById("modal-card");

  const fields = ["All", ...new Set(COURSES.map((c) => c.field))];
  let activeField = "All";
  let query = "";

  function buildChips() {
    chipsWrap.innerHTML = "";
    fields.forEach((f) => {
      const btn = document.createElement("button");
      btn.className = "chip-btn" + (f === activeField ? " active" : "");
      btn.textContent = f;
      btn.addEventListener("click", () => {
        activeField = f;
        [...chipsWrap.children].forEach((b) => b.classList.toggle("active", b.textContent === f));
        render();
      });
      chipsWrap.appendChild(btn);
    });
  }

  function matches(course) {
    const inField = activeField === "All" || course.field === activeField;
    if (!inField) return false;
    if (!query) return true;
    const haystack = [
      course.name, course.field, course.about,
      ...course.careers, ...course.skills, ...course.subjects,
    ].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function render() {
    const filtered = COURSES.filter(matches);
    resultsCount.textContent = `Showing ${filtered.length} of ${COURSES.length} courses`;
    grid.innerHTML = "";
    emptyState.style.display = filtered.length === 0 ? "block" : "none";

    filtered.forEach((c) => {
      const card = document.createElement("div");
      card.className = "course-card reveal in";
      card.innerHTML = `
        <span class="icon-wrap">${icon(c.icon)}</span>
        <span class="field-tag">${c.field}</span>
        <h3>${c.name}</h3>
        <p>${c.blurb}</p>
        <span class="card-link">View details ${icon("target")}</span>
      `;
      card.addEventListener("click", () => openModal(c.id));
      grid.appendChild(card);
    });
  }

  function openModal(id) {
    const c = COURSES.find((x) => x.id === id);
    if (!c) return;

    const listItems = (arr, cls) => arr.map((x) => `<span class="tag-pill ${cls || ""}">${x}</span>`).join("");

    modalCard.innerHTML = `
      <button class="modal-close" id="modal-close" aria-label="Close">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="modal-header">
        <span class="icon-wrap">${icon(c.icon)}</span>
        <div>
          <span class="field-tag">${c.field}</span>
          <h3 style="margin:6px 0 0">${c.name}</h3>
        </div>
      </div>
      <p>${c.about}</p>
      <div class="modal-section">
        <h4>Possible Careers</h4>
        <div class="tag-list">${listItems(c.careers, "green")}</div>
      </div>
      <div class="modal-section">
        <h4>Important Skills</h4>
        <div class="tag-list">${listItems(c.skills)}</div>
      </div>
      <div class="modal-section">
        <h4>Common Subjects</h4>
        <div class="tag-list">${listItems(c.subjects)}</div>
      </div>
      <div class="modal-section text-center">
        <a href="quiz.html" class="btn btn-primary">Take the Quiz to Compare Fit</a>
      </div>
    `;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    document.getElementById("modal-close").addEventListener("click", closeModal);

    const url = new URL(window.location);
    url.searchParams.set("course", id);
    window.history.replaceState({}, "", url);
  }

  function closeModal() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    const url = new URL(window.location);
    url.searchParams.delete("course");
    window.history.replaceState({}, "", url);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  searchInput.addEventListener("input", (e) => {
    query = e.target.value.trim();
    render();
  });

  buildChips();
  render();

  const params = new URLSearchParams(window.location.search);
  const preselect = params.get("course");
  if (preselect && COURSES.some((c) => c.id === preselect)) {
    openModal(preselect);
  }
})();
