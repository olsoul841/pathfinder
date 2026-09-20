/* ============================================================
   PathFinder — quiz engine
   Renders the 12-question Likert quiz, scores answers across
   the six RIASEC traits, and matches against the course catalog
   using cosine similarity.
   ============================================================ */

(function () {
  const introEl = document.getElementById("quiz-intro");
  const questionsEl = document.getElementById("quiz-questions");
  const resultsEl = document.getElementById("quiz-results");

  const startBtn = document.getElementById("start-quiz-btn");
  const backBtn = document.getElementById("back-btn");
  const retakeBtn = document.getElementById("retake-btn");

  const progressFill = document.getElementById("progress-fill");
  const questionCountEl = document.getElementById("question-count");
  const traitLabelEl = document.getElementById("question-trait-label");
  const questionTextEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("likert-options");
  const dotsEl = document.getElementById("quiz-dots");

  const total = QUIZ_QUESTIONS.length;
  let current = 0;
  const answers = new Array(total).fill(null);

  const FOCUS_LABELS = {
    R: "Hands-on interests", I: "Curiosity & analysis", A: "Creativity",
    S: "People & empathy", E: "Leadership & drive", C: "Organization",
  };

  function buildDots() {
    dotsEl.innerHTML = "";
    for (let i = 0; i < total; i++) {
      const d = document.createElement("span");
      d.className = "quiz-dot";
      d.dataset.index = i;
      dotsEl.appendChild(d);
    }
  }

  function updateDots() {
    [...dotsEl.children].forEach((d, i) => {
      d.classList.toggle("done", answers[i] !== null && i !== current);
      d.classList.toggle("current", i === current);
    });
  }

  function renderQuestion() {
    const q = QUIZ_QUESTIONS[current];
    questionCountEl.textContent = `Question ${current + 1} of ${total}`;
    traitLabelEl.textContent = FOCUS_LABELS[q.trait];
    questionTextEl.textContent = q.text;
    progressFill.style.width = `${(current / total) * 100}%`;
    backBtn.style.visibility = current === 0 ? "hidden" : "visible";

    optionsEl.innerHTML = "";
    LIKERT.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "likert-option" + (answers[current] === opt.value ? " selected" : "");
      btn.innerHTML = `<span class="likert-dot"></span><span class="label">${opt.label}</span>`;
      btn.addEventListener("click", () => selectAnswer(opt.value));
      optionsEl.appendChild(btn);
    });

    updateDots();
  }

  function selectAnswer(value) {
    answers[current] = value;
    renderQuestion();
    window.setTimeout(() => {
      if (current < total - 1) {
        current++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    }, 260);
  }

  function goBack() {
    if (current > 0) {
      current--;
      renderQuestion();
    }
  }

  function computeTraitScores() {
    const scores = {};
    TRAIT_ORDER.forEach((t) => (scores[t] = { sum: 0, count: 0 }));
    QUIZ_QUESTIONS.forEach((q, i) => {
      const val = answers[i] || 3;
      scores[q.trait].sum += val;
      scores[q.trait].count += 1;
    });
    const raw = {};
    const pct = {};
    TRAIT_ORDER.forEach((t) => {
      const { sum, count } = scores[t];
      raw[t] = sum / count; // 1-5
      pct[t] = Math.round(((sum - count) / (count * 4)) * 100); // 0-100
    });
    return { raw, pct };
  }

  // Mean-centering turns this into a correlation rather than raw cosine
  // similarity. Plain cosine similarity on all-positive vectors (Likert
  // scores are always 1-5, course weights always >= 0) systematically
  // favors "flat" course profiles — ones spread evenly across traits —
  // over "peaked" ones, regardless of what the user actually answered.
  // Centering each vector on its own mean removes that bias: a trait the
  // user scored below their own average now counts against a course that
  // leans on it, instead of contributing nothing.
  function centerVector(vec) {
    const mean = TRAIT_ORDER.reduce((sum, t) => sum + vec[t], 0) / TRAIT_ORDER.length;
    const centered = {};
    TRAIT_ORDER.forEach((t) => (centered[t] = vec[t] - mean));
    return centered;
  }

  function cosineSimilarity(userVec, courseVec) {
    let dot = 0, uMag = 0, cMag = 0;
    TRAIT_ORDER.forEach((t) => {
      dot += userVec[t] * courseVec[t];
      uMag += userVec[t] * userVec[t];
      cMag += courseVec[t] * courseVec[t];
    });
    if (uMag === 0 || cMag === 0) return 0;
    return dot / (Math.sqrt(uMag) * Math.sqrt(cMag));
  }

  function buildWhyText(userCentered, course) {
    const courseCentered = centerVector(course.riasec);
    // Only ever cite traits the user is genuinely above their own average
    // on (userCentered[t] > 0) — otherwise two below-average traits can
    // multiply into a positive "weight" and get quoted as a strength.
    const overlapping = TRAIT_ORDER
      .filter((t) => course.riasec[t] > 0 && userCentered[t] > 0)
      .map((t) => ({ t, weight: courseCentered[t] * userCentered[t] }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 2);

    const parts = overlapping.map((o) => `${TRAITS[o.t].name} (${TRAITS[o.t].tag.toLowerCase()})`);
    const traitPhrase = parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0] || "your overall profile";

    return `You scored strongly in ${traitPhrase} — that mix lines up well with ${course.name}. ${course.blurb}`;
  }

  // Turns the top matches' raw similarity scores into percentages that
  // sum to exactly 100 across the shown list, so "78% match" actually
  // means "78% of your fit is explained by this course" rather than
  // "78% as good as our best guess" (which made every top-4 list read
  // as 100/98/95/92 no matter how different the courses really were).
  // A softmax with a low temperature is used so that courses which are
  // nearly tied stay close together, while a course that's genuinely a
  // much better fit than the rest claims most of the share instead of
  // everything clustering near 100%.
  function computeMatchShares(scores) {
    const TEMPERATURE = 0.1;
    const MIN_SHARE = 1; // never show a shortlisted match as a flat 0%

    const weights = scores.map((s) => Math.exp(s / TEMPERATURE));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let raw = weights.map((w) => (w / total) * 100);

    const deficit = raw.reduce((sum, v) => sum + Math.max(0, MIN_SHARE - v), 0);
    if (deficit > 0) {
      const donorPool = raw.reduce((sum, v) => sum + Math.max(0, v - MIN_SHARE), 0) || 1;
      raw = raw.map((v) =>
        v < MIN_SHARE ? MIN_SHARE : v - (Math.max(0, v - MIN_SHARE) / donorPool) * deficit
      );
    }

    // Largest-remainder rounding so the displayed integers still add up
    // to exactly 100 instead of drifting off by a point or two.
    const floors = raw.map(Math.floor);
    let remainder = 100 - floors.reduce((a, b) => a + b, 0);
    const order = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    const shares = [...floors];
    for (let k = 0; k < remainder && k < order.length; k++) shares[order[k].i] += 1;
    return shares;
  }

  function finishQuiz() {
    const { raw, pct } = computeTraitScores();
    const centeredUser = centerVector(raw);

    const ranked = COURSES.map((course) => ({
      course,
      score: cosineSimilarity(centeredUser, centerVector(course.riasec)),
    })).sort((a, b) => b.score - a.score);

    const top = ranked.slice(0, 4);
    const shares = computeMatchShares(top.map((entry) => entry.score));

    renderResults(pct, centeredUser, top, shares);

    questionsEl.style.display = "none";
    resultsEl.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderResults(pct, centeredUser, top, shares) {
    const barsWrap = document.getElementById("trait-bars");
    barsWrap.innerHTML = "";
    const sortedTraits = [...TRAIT_ORDER].sort((a, b) => pct[b] - pct[a]);
    sortedTraits.forEach((t) => {
      const row = document.createElement("div");
      row.className = "trait-bar-row";
      row.innerHTML = `
        <span class="tname">${TRAITS[t].name}</span>
        <span class="trait-bar-track"><span class="trait-bar-fill" data-w="${pct[t]}"></span></span>
        <span class="tval">${pct[t]}%</span>`;
      barsWrap.appendChild(row);
    });
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        barsWrap.querySelectorAll(".trait-bar-fill").forEach((el) => {
          el.style.width = el.dataset.w + "%";
        });
      }, 50);
    });

    const listWrap = document.getElementById("match-list");
    listWrap.innerHTML = "";
    top.forEach((entry, i) => {
      const pctMatch = shares[i];
      const card = document.createElement("div");
      card.className = "match-card reveal in";
      card.innerHTML = `
        <div class="match-rank">#${i + 1}</div>
        <div class="match-body">
          <div class="match-top-row">
            <h3 style="margin-bottom:0">${entry.course.name}</h3>
            <span class="match-score">${pctMatch}% match</span>
          </div>
          <span class="field-tag">${entry.course.field}</span>
          <div class="match-why">${buildWhyText(centeredUser, entry.course)}</div>
          <div style="margin-top:14px">
            <a href="courses.html?course=${entry.course.id}" class="card-link">See full details ${icon("target")}</a>
          </div>
        </div>`;
      listWrap.appendChild(card);
    });
  }

  function resetQuiz() {
    current = 0;
    answers.fill(null);
    resultsEl.style.display = "none";
    introEl.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  startBtn.addEventListener("click", () => {
    introEl.style.display = "none";
    questionsEl.style.display = "block";
    buildDots();
    renderQuestion();
  });
  backBtn.addEventListener("click", goBack);
  retakeBtn.addEventListener("click", resetQuiz);
})();
