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
const quickSearchButtons = document.querySelectorAll("[data-search-query]");
const searchResults = document.querySelector("[data-search-results]");
const searchCount = document.querySelector("[data-search-count]");
const sourceReviewStatus = document.querySelector("[data-source-review-status]");
const askInput = document.querySelector("[data-ask-input]");
const askButton = document.querySelector("[data-ask-button]");
const askAnswer = document.querySelector("[data-ask-answer]");
const weeklyBrief = document.querySelector("[data-weekly-brief]");
const liveSourceFeed = document.querySelector("[data-live-source-feed]");
const liveSourceStatus = document.querySelector("[data-live-source-status]");
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

function plainLabel(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayDateTime(value = "") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
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
    const index = await loadJson("data/public-search-index.json");
    const generatedAt = index.generatedAt
      ? new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(index.generatedAt))
      : "Ready";

    const values = {
      scannedAt: generatedAt,
      resultCount: index.totalRecords ?? "--",
      newCandidateCount: Object.keys(index.categories || {}).length || "--",
    };

    scanFields.forEach((field) => {
      field.textContent = values[field.dataset.scanField] ?? field.textContent;
    });

    if (scanSummary) {
      scanSummary.textContent = `The public catalog currently includes ${index.totalRecords ?? 0} searchable records across ${Object.keys(index.categories || {}).length || 0} source categories.`;
    }
  } catch {
    if (scanNote) {
      scanNote.textContent = "Public source status is temporarily unavailable.";
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

function renderQueue(records) {
  if (!queueList) return;

  const items = (records || []).slice(0, 6);
  queueList.innerHTML = "";
  if (!items.length) {
    queueList.innerHTML = "<p>Public catalog records are being refreshed.</p>";
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("a");
    row.href = item.url || "#updates";
    row.className = "queue-item priority-normal";
    row.innerHTML = `
      <span>${item.displayCategory || item.category || "Source"} · ${item.displaySourceType || item.confidence || "Cataloged"}</span>
      <strong>${item.title || "Untitled item"}</strong>
      ${item.summary ? `<small>${escapeHtml(item.summary)}</small>` : ""}
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
    const [completeness, index, roster] = await Promise.all([
      loadJson("data/site-completeness.json"),
      loadJson("data/public-search-index.json"),
      loadJson("data/workers/roster.json"),
    ]);

    setEditorialFields({
      overall: `${completeness.overall ?? "--"}%`,
      queueTotal: index.totalRecords ?? "--",
      highPriority: `${index.totalRecords ?? "--"} records`,
    });
    renderCompleteness(completeness);
    renderQueue(index.records || []);
    renderWorkers(roster, { workers: [] });
  } catch {
    setEditorialFields({
      overall: "Current",
      queueTotal: "--",
      highPriority: "catalog",
    });
  }
}

hydrateEditorialSystem();

async function hydrateSourceIndex() {
  if (!catalogCounts.length) return;

  try {
    const index = await loadJson("data/public-search-index.json");
    catalogCounts.forEach((field) => {
      const count = index.categories?.[field.dataset.catalogCount];
      if (count !== undefined) field.textContent = String(count);
    });
  } catch {
    catalogCounts.forEach((field) => {
      field.textContent = "--";
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
    if (searchResults) searchResults.innerHTML = "<p>Public search is temporarily unavailable.</p>";
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
quickSearchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (sourceSearch) sourceSearch.value = button.dataset.searchQuery || "";
    if (sourceFilter && button.dataset.searchFilter) sourceFilter.value = button.dataset.searchFilter;
    renderSearchResults();
    searchResults?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
});
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
    weeklyBrief.innerHTML = "<p>The weekly brief is temporarily unavailable.</p>";
  }
}

hydrateWeeklyBrief();

async function hydrateLiveSourceFeed() {
  if (!liveSourceFeed) return;

  try {
    const feed = await loadJson("data/live-source-feed.json");
    const records = (feed.records || []).slice(0, 12);
    if (liveSourceStatus) {
      const generated = displayDateTime(feed.generatedAt);
      liveSourceStatus.textContent = `${feed.totalRecords || records.length} recent source leads detected${generated ? ` · updated ${generated}` : ""}. Fast discovery, not verification.`;
    }

    liveSourceFeed.innerHTML = "";
    if (!records.length) {
      liveSourceFeed.innerHTML = "<p>New source leads will appear here after the next scan.</p>";
      return;
    }

    records.forEach((record) => {
      const item = document.createElement("article");
      item.className = "live-source-item";
      item.innerHTML = `
        <div>
          <span>${escapeHtml(record.kind)} · ${escapeHtml(record.status)}</span>
          <h4>${escapeHtml(record.title)}</h4>
          <p>${escapeHtml(record.publicNote)}</p>
          <small>${escapeHtml(record.sourceName)}${record.publishedAt ? ` · ${escapeHtml(displayDateTime(record.publishedAt))}` : ""}</small>
        </div>
        <a href="${escapeHtml(record.url)}" target="_blank" rel="noopener">Open source</a>
      `;
      liveSourceFeed.append(item);
    });
  } catch {
    if (liveSourceStatus) liveSourceStatus.textContent = "The live source feed is temporarily unavailable.";
  }
}

hydrateLiveSourceFeed();

async function hydratePolicyTracker() {
  if (!policyTracker) return;

  try {
    const [tracker, coverage] = await Promise.all([
      loadJson("data/policy-tracker.json"),
      loadJson("data/us-state-policy-coverage.json").catch(() => null),
    ]);
    const coverageRows = coverage?.coverage || [];
    const trackedStates = coverageRows.filter((row) => row.trackedRecordCount > 0);
    const coverageSummary = coverage ? `
      <div class="policy-coverage-summary">
        <div>
          <span>U.S. state coverage</span>
          <strong>${escapeHtml(coverage.counts?.statesAndDc ?? coverageRows.length)} jurisdictions checked</strong>
          <p>${escapeHtml(coverage.counts?.statesWithTrackedActivity ?? trackedStates.length)} have state-specific Iboga/Ibogaine policy records in the tracker. ${escapeHtml(coverage.counts?.statesWithoutStateSpecificRecord ?? 0)} have no state-specific tracker record as of ${escapeHtml((coverage.generatedAt || "").slice(0, 10))}.</p>
        </div>
        <div>
          <span>Important limit</span>
          <strong>Untracked does not mean impossible or absent.</strong>
          <p>The table marks what IbogaBase has traced to sources; it is not legal advice and does not replace current legal review.</p>
        </div>
      </div>
      <details class="state-coverage-details">
        <summary>Show all 50 states and DC</summary>
        <div class="state-coverage-grid">
          ${coverageRows.map((row) => `
            <article class="${row.trackedRecordCount > 0 ? "has-activity" : ""}">
              <h3>${escapeHtml(row.jurisdiction)}</h3>
              <p>${row.trackedRecordCount > 0
                ? `${escapeHtml(row.trackedRecordCount)} tracked record${row.trackedRecordCount === 1 ? "" : "s"}`
                : "No state-specific tracker record"}</p>
              ${row.rows?.length ? `<small>${escapeHtml(row.rows.map((item) => item.action).join("; "))}</small>` : "<small>Monitored by state name, Ibogaine, Iboga, bill, law, and clinical-trial queries.</small>"}
            </article>
          `).join("")}
        </div>
      </details>
    ` : "";
    policyTracker.innerHTML = `
      <div class="tracker-note">${escapeHtml(tracker.disclaimer)}</div>
      ${coverageSummary}
      <div class="tracker-table" role="table">
        <div role="row">
          <strong role="columnheader">Jurisdiction</strong>
          <strong role="columnheader">Status</strong>
          <strong role="columnheader">What it permits or tracks</strong>
          <strong role="columnheader">What it does not mean</strong>
          <strong role="columnheader">Source</strong>
        </div>
        ${(tracker.rows || []).map((row) => `
          <div role="row">
            <span><b>${escapeHtml(row.jurisdiction)}</b><small>${escapeHtml(row.action)}</small></span>
            <span>${escapeHtml(plainLabel(row.status))}<small>Checked ${escapeHtml(row.lastChecked)}</small></span>
            <span>${escapeHtml(row.whatItPermits)}</span>
            <span>${escapeHtml(row.whatItDoesNotPermit)}</span>
            <span><a href="${escapeHtml(row.primaryUrl)}">${escapeHtml(row.primarySource)}</a><small>${escapeHtml(row.confidence)}</small></span>
          </div>
        `).join("")}
      </div>
    `;
  } catch {
    policyTracker.innerHTML = "<p>Policy rows are temporarily unavailable.</p>";
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
          <strong role="columnheader">Human evidence</strong>
          <strong role="columnheader">Limits and safety</strong>
          <strong role="columnheader">Not proven</strong>
        </div>
        ${(evidence.conditions || []).map((condition) => `
          <div role="row">
            <span><b>${escapeHtml(condition.condition)}</b></span>
            <span>${escapeHtml(condition.evidenceLevel)}</span>
            <span>${escapeHtml(condition.humanStudies)}<small>${escapeHtml(condition.sampleSizes || "")}</small></span>
            <span>${escapeHtml(condition.limitations)}<small>${escapeHtml(condition.safetySignals)}</small></span>
            <span>${escapeHtml(condition.notProven)}<small>${escapeHtml(condition.bestNextSource || "")}</small></span>
          </div>
        `).join("")}
      </div>
    `;
  } catch {
    evidenceMatrix.innerHTML = "<p>The evidence matrix is temporarily unavailable.</p>";
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
    reviewMetadata.innerHTML = "<p>Review metadata is temporarily unavailable.</p>";
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
    clinicObservatory.innerHTML = "<p>Clinic observatory rules are temporarily unavailable.</p>";
  }
}

hydrateClinicObservatory();
