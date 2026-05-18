const header = document.querySelector("[data-sticky]");
const backTop = document.querySelector("[data-back-top]");
const filterButtons = document.querySelectorAll("[data-filter]");
const updateCards = document.querySelectorAll("[data-category]");
const scanFields = document.querySelectorAll("[data-scan-field]");
const scanSummary = document.querySelector("[data-scan-summary]");
const scanNote = document.querySelector("[data-scan-note]");
const editorialFields = document.querySelectorAll("[data-editorial-field]");
const completenessList = document.querySelector("[data-completeness-list]");
const queueList = document.querySelector("[data-queue-list]");
const workerList = document.querySelector("[data-worker-list]");
const catalogCounts = document.querySelectorAll("[data-catalog-count]");
const sourceSearch = document.querySelector("[data-source-search]");
const sourceFilter = document.querySelector("[data-source-filter]");
const searchResults = document.querySelector("[data-search-results]");
const searchCount = document.querySelector("[data-search-count]");
const sourceReviewStatus = document.querySelector("[data-source-review-status]");
const askInput = document.querySelector("[data-ask-input]");
const askButton = document.querySelector("[data-ask-button]");
const askAnswer = document.querySelector("[data-ask-answer]");
const weeklyBrief = document.querySelector("[data-weekly-brief]");
const policyTracker = document.querySelector("[data-policy-tracker]");
const evidenceMatrix = document.querySelector("[data-evidence-matrix]");
const reviewMetadata = document.querySelector("[data-review-metadata]");
const clinicObservatory = document.querySelector("[data-clinic-observatory]");

let publicSearchIndex = [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateHeader() {
  header?.classList.toggle("is-scrolled", window.scrollY > 12);
}

function setFilter(filter) {
  filterButtons.forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  updateCards.forEach((card) => {
    const categories = card.dataset.category.split(" ");
    const visible = filter === "all" || categories.includes(filter);
    card.classList.toggle("is-hidden", !visible);
  });
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

filterButtons.forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("active")));
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

backTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function hydrateScanStatus() {
  if (!scanFields.length) return;

  try {
    const response = await fetch("data/latest-scan.json", { cache: "no-store" });
    if (!response.ok) return;
    const scan = await response.json();
    const scannedAt = scan.scannedAt
      ? new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(scan.scannedAt))
      : "Ready";

    const values = {
      scannedAt,
      resultCount: scan.resultCount ?? "--",
      newCandidateCount: scan.newCandidateCount ?? "--",
    };

    scanFields.forEach((field) => {
      field.textContent = values[field.dataset.scanField] ?? field.textContent;
    });

    if (scanSummary) {
      scanSummary.textContent = `Latest local scan found ${scan.resultCount ?? 0} items and ${scan.newCandidateCount ?? 0} review candidates.`;
    }

    if (scanNote && scan.errors?.length) {
      scanNote.textContent = `Scanner ran with ${scan.errors.length} source issue${scan.errors.length === 1 ? "" : "s"}; review the log before publishing.`;
    }
  } catch {
    if (scanNote) {
      scanNote.textContent = "Scanner output will appear here after the local update scanner runs.";
    }
  }
}

hydrateScanStatus();

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function setEditorialFields(values) {
  editorialFields.forEach((field) => {
    const value = values[field.dataset.editorialField];
    if (value !== undefined) field.textContent = value;
  });
}

function renderCompleteness(completeness) {
  if (!completenessList) return;

  completenessList.innerHTML = "";
  (completeness.sections || []).forEach((section) => {
    const item = document.createElement("div");
    item.className = "completeness-item";
    item.innerHTML = `
      <div>
        <strong>${section.name}</strong>
        <span>${section.status}</span>
      </div>
      <div class="progress" aria-label="${section.name} completeness ${section.score}%">
        <span style="width: ${Math.max(0, Math.min(100, section.score || 0))}%"></span>
      </div>
    `;
    completenessList.append(item);
  });
}

function renderQueue(queue) {
  if (!queueList) return;

  const items = (queue.queue || []).slice(0, 6);
  queueList.innerHTML = "";
  if (!items.length) {
    queueList.innerHTML = "<p>No review items are waiting right now.</p>";
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("a");
    row.href = item.url || "#updates";
    row.className = `queue-item priority-${item.priority || "normal"}`;
    row.innerHTML = `
      <span>${item.lane || "source-desk"} · ${item.priority || "normal"}</span>
      <strong>${item.title || "Untitled item"}</strong>
    `;
    queueList.append(row);
  });
}

function renderWorkers(roster, status) {
  if (!workerList) return;

  const statuses = Object.fromEntries((status.workers || []).map((worker) => [worker.id, worker]));
  workerList.innerHTML = "";
  (roster.workers || []).forEach((worker) => {
    const workerStatus = statuses[worker.id] || {};
    const item = document.createElement("div");
    item.className = "worker-item";
    item.innerHTML = `
      <span>${worker.cadence} · ${workerStatus.status || "scheduled"}</span>
      <strong>${worker.label}</strong>
      <small>${worker.owner}</small>
    `;
    workerList.append(item);
  });
}

async function hydrateEditorialSystem() {
  if (!editorialFields.length && !completenessList && !queueList && !workerList) return;

  try {
    const [completeness, queue, roster, status] = await Promise.all([
      loadJson("data/site-completeness.json"),
      loadJson("data/editorial-queue.json"),
      loadJson("data/workers/roster.json"),
      loadJson("data/worker-status.json").catch(() => ({ workers: [] })),
    ]);

    setEditorialFields({
      overall: `${completeness.overall ?? "--"}%`,
      queueTotal: queue.totalCandidates ?? "--",
      highPriority: `${queue.highPriority ?? 0} high`,
    });
    renderCompleteness(completeness);
    renderQueue(queue);
    renderWorkers(roster, status);
  } catch {
    setEditorialFields({
      overall: "Building",
      queueTotal: "--",
      highPriority: "review",
    });
  }
}

hydrateEditorialSystem();

async function hydrateSourceIndex() {
  if (!catalogCounts.length) return;

  try {
    const index = await loadJson("data/source-index.json");
    catalogCounts.forEach((field) => {
      const category = index.categories?.[field.dataset.catalogCount];
      if (category) field.textContent = String(category.count ?? "--");
    });
  } catch {
    catalogCounts.forEach((field) => {
      field.textContent = "review";
    });
  }
}

hydrateSourceIndex();

function scoreRecord(record, query) {
  if (!query) return defaultRecordScore(record);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.reduce((score, term) => {
    if (record.title?.toLowerCase().includes(term)) score += 5;
    if (record.category?.toLowerCase().includes(term)) score += 3;
    if (record.sourceName?.toLowerCase().includes(term)) score += 2;
    if (record.displaySourceName?.toLowerCase().includes(term)) score += 2;
    if (record.searchText?.includes(term)) score += 1;
    return score;
  }, 0);
}

function defaultRecordScore(record) {
  const categoryPriority = {
    weekly_brief: 95,
    studies_papers: 90,
    laws_policy: 86,
    clinical_trials: 82,
    culture_stewardship: 78,
    evidence_pages: 74,
    news_articles_blogs: 70,
    podcasts_interviews: 62,
    documentaries_films: 58,
    companies_patents: 54,
    clinics: 45,
    review_metadata: 35,
  };

  const sourceBoost = record.sourceOrigin === "source_radar" ? 6 : 0;
  const freshnessPenalty = record.sourceOrigin === "latest_scan" ? -8 : 0;
  const namedSourceBoost = record.sourceName && !["source_radar", "manual_seed", "latest_scan"].includes(record.sourceName) ? 2 : 0;
  return (categoryPriority[record.category] || 50) + sourceBoost + namedSourceBoost + freshnessPenalty;
}

function renderResultDetails(record) {
  const rows = [
    ["Source", record.displaySourceName || record.sourceName || "Source catalog"],
    ["Type", record.whatItIs],
    ["Covers", record.conversationContext],
    ["How to read it", record.whyListed],
    ["Date", record.displayDate],
  ].filter(([, value]) => value);

  return rows.map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join("");
}

function renderSearchResults() {
  if (!searchResults) return;

  const query = sourceSearch?.value.trim() || "";
  const category = sourceFilter?.value || "all";
  const matches = publicSearchIndex
    .map((record) => ({ record, score: scoreRecord(record, query) }))
    .filter(({ record, score }) => score > 0 && (category === "all" || record.category === category))
    .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title))
    .slice(0, 10)
    .map(({ record }) => record);

  searchResults.innerHTML = "";
  if (!matches.length) {
    searchResults.innerHTML = "<p>No matching source records yet. Try a broader term or choose all source types.</p>";
    return;
  }

  matches.forEach((record) => {
    const item = document.createElement("article");
    item.className = "search-result";
    const label = [
      record.displayCategory || record.category,
      record.displaySourceType || record.confidence || record.sourceType,
    ].filter(Boolean).join(" · ");
    item.innerHTML = `
      <div class="result-copy">
        <span class="result-kicker">${escapeHtml(label)}</span>
        <h3>${escapeHtml(record.title)}</h3>
        <p>${escapeHtml(record.summary || "Source record awaiting summary.")}</p>
        <dl class="result-details">
          ${renderResultDetails(record)}
        </dl>
      </div>
      <div class="result-actions">
        <span>${escapeHtml(record.status || "Cataloged source")}</span>
        <a href="${escapeHtml(record.url || "#sources")}" target="_blank" rel="noopener">Open source</a>
      </div>
    `;
    searchResults.append(item);
  });
}

function isUnsafeAsk(question) {
  return /\b(dose|dosage|how much|take ibogaine|provider|clinic near me|recommend a clinic|where can i get|buy iboga|buy ibogaine|self[- ]?treat|protocol|legal advice|am i allowed|can i legally|prescribe|emergency)\b/i.test(question);
}

function answerFromSources() {
  if (!askAnswer || !askInput) return;
  const question = askInput.value.trim();

  if (!question) {
    askAnswer.textContent = "Ask a question first. Good examples: “What changed in Oklahoma?” or “What is the safety concern with QT?”";
    return;
  }

  if (isUnsafeAsk(question)) {
    askAnswer.innerHTML = `
      <strong>I cannot answer that as guidance.</strong>
      <p>IbogaBase does not provide dosing, self-treatment steps, provider referrals, clinic recommendations, emergency advice, or individualized legal or medical guidance. Use the source search for general background, and consult qualified professionals for decisions.</p>
    `;
    return;
  }

  const matches = publicSearchIndex
    .map((record) => ({ record, score: scoreRecord(record, question) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ record }) => record);

  if (!matches.length) {
    askAnswer.innerHTML = "<p>I do not have enough indexed source material to answer that yet. Try searching the catalog, or add it to the source queue.</p>";
    return;
  }

  askAnswer.innerHTML = `
    <strong>Source-backed answer</strong>
    <p>${escapeHtml(matches[0].summary || "The closest indexed source needs editorial summary.")}</p>
    <p class="answer-boundary">This is an educational source summary, not medical or legal advice.</p>
    <div class="answer-citations">
      ${matches.map((record, index) => `
        <a href="${escapeHtml(record.url || "#sources")}">
          [${index + 1}] ${escapeHtml(record.title)} <span>${escapeHtml(record.sourceName || record.category)}</span>
        </a>
      `).join("")}
    </div>
  `;
}

async function hydratePublicSearch() {
  if (!sourceSearch && !askInput) return;

  try {
    const index = await loadJson("data/public-search-index.json");
    publicSearchIndex = index.records || [];
    if (searchCount) searchCount.textContent = `${index.totalRecords || publicSearchIndex.length} records`;
    renderSearchResults();
  } catch {
    if (searchCount) searchCount.textContent = "index pending";
    if (searchResults) searchResults.innerHTML = "<p>Search index will appear after the public catalog builder runs.</p>";
  }

  if (sourceReviewStatus) {
    try {
      const review = await loadJson("data/source-review-report.json");
      const reviewedAt = review.generatedAt
        ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(review.generatedAt))
        : "recently";
      const linkPhrase = review.liveLinkCheck ? "live links" : "link format";
      sourceReviewStatus.textContent = `${review.totalRecordsChecked || publicSearchIndex.length} public catalog entries checked for clean labels, source details, and ${linkPhrase} on ${reviewedAt}.`;
    } catch {
      sourceReviewStatus.textContent = "Public catalog entries are checked before each publish for clean labels, source details, and link format.";
    }
  }
}

sourceSearch?.addEventListener("input", renderSearchResults);
sourceFilter?.addEventListener("change", renderSearchResults);
askButton?.addEventListener("click", answerFromSources);
askInput?.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") answerFromSources();
});

hydratePublicSearch();

async function hydrateWeeklyBrief() {
  if (!weeklyBrief) return;

  try {
    const brief = await loadJson("data/weekly-brief.json");
    weeklyBrief.innerHTML = "";
    (brief.items || []).forEach((item) => {
      const card = document.createElement("article");
      card.innerHTML = `
        <span>${escapeHtml(item.lane)} · ${escapeHtml(item.confidence)}</span>
        <h3>${escapeHtml(item.headline)}</h3>
        <p><strong>What changed:</strong> ${escapeHtml(item.whatChanged)}</p>
        <p><strong>What it does not mean:</strong> ${escapeHtml(item.whatItDoesNotMean)}</p>
        <a href="${escapeHtml(item.sourceUrl)}">${escapeHtml(item.source)}</a>
      `;
      weeklyBrief.append(card);
    });
  } catch {
    weeklyBrief.innerHTML = "<p>The weekly brief will appear after the field scanner and editor run.</p>";
  }
}

hydrateWeeklyBrief();

async function hydratePolicyTracker() {
  if (!policyTracker) return;

  try {
    const tracker = await loadJson("data/policy-tracker.json");
    policyTracker.innerHTML = `
      <div class="tracker-note">${escapeHtml(tracker.disclaimer)}</div>
      <div class="tracker-table" role="table">
        <div role="row">
          <strong role="columnheader">Jurisdiction</strong>
          <strong role="columnheader">Status</strong>
          <strong role="columnheader">What it does not mean</strong>
          <strong role="columnheader">Source</strong>
        </div>
        ${(tracker.rows || []).map((row) => `
          <div role="row">
            <span><b>${escapeHtml(row.jurisdiction)}</b><small>${escapeHtml(row.action)}</small></span>
            <span>${escapeHtml(row.status)}<small>Checked ${escapeHtml(row.lastChecked)}</small></span>
            <span>${escapeHtml(row.whatItDoesNotPermit)}</span>
            <span><a href="${escapeHtml(row.primaryUrl)}">${escapeHtml(row.primarySource)}</a><small>${escapeHtml(row.confidence)}</small></span>
          </div>
        `).join("")}
      </div>
    `;
  } catch {
    policyTracker.innerHTML = "<p>Policy rows will appear after primary-source review.</p>";
  }
}

hydratePolicyTracker();

async function hydrateEvidenceMatrix() {
  if (!evidenceMatrix) return;

  try {
    const evidence = await loadJson("data/evidence-pages.json");
    evidenceMatrix.innerHTML = `
      <div class="matrix-heading">
        <h3>Condition evidence matrix</h3>
        <p>Each condition uses the same skeptical template: ${escapeHtml((evidence.template || []).join(", "))}.</p>
      </div>
      <div class="tracker-table compact" role="table">
        <div role="row">
          <strong role="columnheader">Condition</strong>
          <strong role="columnheader">Evidence level</strong>
          <strong role="columnheader">Main limitation</strong>
          <strong role="columnheader">Not proven</strong>
        </div>
        ${(evidence.conditions || []).map((condition) => `
          <div role="row">
            <span><b>${escapeHtml(condition.condition)}</b></span>
            <span>${escapeHtml(condition.evidenceLevel)}</span>
            <span>${escapeHtml(condition.limitations)}</span>
            <span>${escapeHtml(condition.notProven)}</span>
          </div>
        `).join("")}
      </div>
    `;
  } catch {
    evidenceMatrix.innerHTML = "<p>Evidence matrix will appear after condition records are built.</p>";
  }
}

hydrateEvidenceMatrix();

async function hydrateReviewMetadata() {
  if (!reviewMetadata) return;

  try {
    const metadata = await loadJson("data/review-metadata.json");
    reviewMetadata.innerHTML = "";
    (metadata.pages || []).forEach((page) => {
      const card = document.createElement("article");
      card.innerHTML = `
        <span>${escapeHtml(page.reviewStatus)}</span>
        <h3><a href="${escapeHtml(page.anchor)}">${escapeHtml(page.page)}</a></h3>
        <p><strong>Last source check:</strong> ${escapeHtml(page.lastSourceCheck)}</p>
        <p><strong>Confidence:</strong> ${escapeHtml(page.confidence)}</p>
        <p>${escapeHtml(page.openQuestions)}</p>
      `;
      reviewMetadata.append(card);
    });
  } catch {
    reviewMetadata.innerHTML = "<p>Per-page review metadata will appear after review records are generated.</p>";
  }
}

hydrateReviewMetadata();

async function hydrateClinicObservatory() {
  if (!clinicObservatory) return;

  try {
    const observatory = await loadJson("data/clinic-observatory.json");
    clinicObservatory.innerHTML = `
      <h3>Clinic Observatory rules</h3>
      <ul>
        ${(observatory.rules || []).map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}
      </ul>
    `;
  } catch {
    clinicObservatory.innerHTML = "<p>Clinic observatory rules will appear after the tracker is generated.</p>";
  }
}

hydrateClinicObservatory();
