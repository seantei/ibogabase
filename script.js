const header = document.querySelector("[data-sticky]");
const navToggle = document.querySelector("[data-nav-toggle]");
const primaryNav = document.querySelector("[data-primary-nav]");
const mobileSearchToggle = document.querySelector("[data-mobile-search-toggle]");
const mobileSearchPanel = document.querySelector("[data-mobile-search-panel]");
const mobileSearchInput = document.querySelector("[data-mobile-search-input]");
const headerSearch = document.querySelector("[data-header-search]");
const headerSearchInput = document.querySelector("[data-header-search-input]");
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
const heroSearch = document.querySelector("[data-hero-search]");
const sourceFilter = document.querySelector("[data-source-filter]");
const quickSearchButtons = document.querySelectorAll("[data-search-query]");
const searchResults = document.querySelector("[data-search-results]");
const searchCount = document.querySelector("[data-search-count]");
const searchCountPlain = document.querySelector("[data-search-count-plain]");
const resultCount = document.querySelector("[data-result-count]");
const sourceReviewStatus = document.querySelector("[data-source-review-status]");
const assistantGated = document.querySelector("[data-assistant-gated]");
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
let publicSearchReady = false;
let publicSearchPromise = null;
const assistantEnabled = document.documentElement.dataset.enableAssistant === "true";

if (assistantGated && assistantEnabled) {
  assistantGated.hidden = false;
}

navToggle?.addEventListener("click", () => {
  const open = !primaryNav?.classList.contains("is-open");
  primaryNav?.classList.toggle("is-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
});

primaryNav?.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLButtonElement && target.classList.contains("nav-dropdown-trigger")) {
    const group = target.closest(".nav-group");
    const open = !group?.classList.contains("is-open");
    group?.classList.toggle("is-open", open);
    target.setAttribute("aria-expanded", String(open));
    if (open) primaryNav.scrollTop = 0;
    return;
  }
  if (!(target instanceof HTMLAnchorElement)) return;
  primaryNav.classList.remove("is-open");
  navToggle?.setAttribute("aria-expanded", "false");
});

mobileSearchToggle?.addEventListener("click", () => {
  if (!mobileSearchPanel) return;
  const open = mobileSearchPanel.hidden;
  mobileSearchPanel.hidden = !open;
  mobileSearchToggle.setAttribute("aria-expanded", String(open));
  if (open) mobileSearchInput?.focus();
});

async function sendQueryToSourceSearch(query) {
  const value = query.trim();
  if (!value) return;
  // Pages without an in-page search surface (every page except the homepage,
  // /search/, and /sources/) route to the dedicated search page instead of
  // silently doing nothing.
  if (!sourceSearch || !searchResults) {
    window.location.assign(`/search/?q=${encodeURIComponent(value)}`);
    return;
  }
  sourceSearch.value = value;
  await ensurePublicSearch();
  populateSourceFilter();
  renderSearchResults();
  searchResults?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

heroSearch?.form?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendQueryToSourceSearch(heroSearch.value);
});

headerSearch?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (headerSearchInput) sendQueryToSourceSearch(headerSearchInput.value);
});

mobileSearchPanel?.querySelector("form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (mobileSearchInput) sendQueryToSourceSearch(mobileSearchInput.value);
  mobileSearchPanel.hidden = true;
  mobileSearchToggle?.setAttribute("aria-expanded", "false");
});

sourceSearch?.form?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendQueryToSourceSearch(sourceSearch.value);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  const isTyping =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
  if (isTyping) return;
  const searchTarget = sourceSearch || headerSearchInput;
  if (!searchTarget) return;
  event.preventDefault();
  if (sourceSearch && searchResults) window.location.hash = "search";
  searchTarget.focus();
});

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

function chipMarkup(kind = "primary", label = "", size = "sm") {
  const labels = {
    primary: "Primary",
    study: "Study",
    trial: "Trial",
    review: "Review",
    law: "Law",
    media: "Media",
    claim: "Claim",
    culture: "Culture",
    steward: "Stewardship",
    high: "High confidence",
    moderate: "Moderate",
    low: "Low",
    established: "Established",
    promising: "Promising",
    contested: "Contested",
    overstated: "Overstated",
    false: "False",
    weak: "Weak evidence",
  };
  const safeKind = labels[kind] ? kind : "primary";
  const safeSize = size === "lg" ? "lg" : "sm";
  return `<span class="chip chip-${safeKind} chip-${safeSize}">${escapeHtml(label || labels[safeKind])}</span>`;
}

function sourceChipMarkup(record = {}) {
  const kind = sourceKindForRecord(record);
  const labels = {
    primary: "Source type: Primary",
    study: "Source type: Study",
    trial: "Source type: Trial",
    review: "Source type: Review",
    law: "Source type: Law",
    media: "Source type: Media",
    claim: "Source type: Claim",
    culture: "Source type: Culture",
    steward: "Source type: Stewardship",
  };
  return chipMarkup(kind, labels[kind] || "Source type: Primary");
}

function confidenceChipMarkup(value = "") {
  const kind = confidenceKind(value);
  const labels = {
    high: "Confidence: High",
    moderate: "Confidence: Moderate",
    low: "Confidence: Low",
  };
  return chipMarkup(kind, labels[kind] || "Confidence: Moderate");
}

function sourceKindForRecord(record = {}) {
  const category = record.category || "";
  const sourceType = record.sourceType || "";
  if (category.includes("law") || category.includes("policy")) return "law";
  if (category.includes("trial")) return "trial";
  if (category.includes("study") || sourceType.includes("study")) return "study";
  if (category.includes("podcast") || category.includes("media") || category.includes("film") || category.includes("documentar") || category.includes("news") || category.includes("article") || category.includes("blog") || category.includes("book")) return "media";
  if (category.includes("culture")) return "culture";
  if (category.includes("clinic") || category.includes("compan")) return "claim";
  if (category.includes("weekly") || category.includes("reference") || category.includes("evidence_page")) return "review";
  return "primary";
}

function confidenceKind(value = "") {
  const normalized = String(value).toLowerCase();
  if (normalized.includes("high") || normalized.includes("peer-reviewed") || normalized.includes("primary")) return "high";
  if (normalized.includes("low") || normalized.includes("weak") || normalized.includes("pending")) return "low";
  return "moderate";
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
  // Resolve data paths from the site root so loading works on subdirectory
  // pages (e.g. /search/, /sources/), not just the homepage.
  const url = /^(https?:)?\//.test(path) ? path : `/${path}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${url}`);
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
  const browseAll = searchResults.dataset.browseAll === "true";
  const limit = Number(searchResults.dataset.limit) || 10;

  if (!publicSearchReady) {
    searchResults.innerHTML = (query || browseAll)
      ? "<p>Loading source index...</p>"
      : "";
    return;
  }

  const category = sourceFilter?.value || "all";
  const inCategory = (record) => category === "all" || record.category === category;

  let ranked;
  if (query) {
    ranked = publicSearchIndex
      .map((record) => ({ record, score: scoreRecord(record, query) }))
      .filter(({ record, score }) => score > 0 && inCategory(record))
      .sort((a, b) => b.score - a.score || (a.record.title || "").localeCompare(b.record.title || ""))
      .map(({ record }) => record);
  } else if (browseAll) {
    ranked = publicSearchIndex
      .filter(inCategory)
      .slice()
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else {
    // Homepage with no query: show nothing.
    searchResults.innerHTML = "";
    if (resultCount) resultCount.textContent = "";
    return;
  }

  const total = ranked.length;
  const matches = ranked.slice(0, limit);
  if (resultCount) {
    resultCount.textContent = total
      ? `${total} ${total === 1 ? "result" : "results"}${category === "all" ? "" : " in this type"}`
      : "No results";
  }

  searchResults.innerHTML = "";
  if (!matches.length) {
    searchResults.innerHTML = query
      ? "<p>No matching source records yet. Try a broader term or choose all source types.</p>"
      : "<p>No source records in this type yet.</p>";
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
        <div class="chip-row">${sourceChipMarkup(record)}${confidenceChipMarkup(record.confidence)}</div>
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

  if (total > matches.length) {
    const note = document.createElement("p");
    note.className = "result-more-note";
    note.textContent = `Showing ${matches.length} of ${total}. Refine your search or pick a source type to narrow results.`;
    searchResults.append(note);
  }
}

function isUnsafeAsk(question) {
  // Normalize against simple obfuscation: leetspeak digits and letters spaced
  // out with separators ("d o s e", "d0se"), then test both forms.
  const leet = question.toLowerCase().replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
  const collapsed = leet.replace(/[^a-z]+/g, "");
  const unsafe = /\b(dose|doses|dosage|dosing|how much|what amount|therapeutic amount|how many grams?|mg|mg\/kg|milligrams?|flood|microdos\w*|taper|washout|wean|regimen|protocol|how to take|take ibogaine|self[- ]?treat\w*|at home|on my own|by myself|buy|purchase|order|supplier|vendor|ship|where (can i|to) (get|find|buy)|provider|referral|clinic near me|treatment cent(er|re)|retreat|recommend (a |the )?(clinic|provider|cent(er|re)|retreat|place)|which clinic|best clinic|prescribe|prescription|my medications?|i('m| am) taking|should i take|am i allowed|can i legally|legal advice|emergency|overdose|antidote)\b/i;
  const unsafeCollapsed = /(dose|dosage|dosing|howmuch|howmanygrams|mgkg|milligram|floodd?ose|microdos|selftreat|athome|buyiboga|buyibogaine|whereto(get|buy)|wherecani(get|buy)|bestclinic|whichclinic|recommendaclinic|treatmentcenter|overdose)/;
  return unsafe.test(leet) || unsafeCollapsed.test(collapsed);
}

async function answerFromSources() {
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

  await ensurePublicSearch();

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

async function ensurePublicSearch() {
  if (publicSearchReady) return;
  if (publicSearchPromise) return publicSearchPromise;

  publicSearchPromise = (async () => {
    try {
      const index = await loadJson("data/public-search-index.json");
      publicSearchIndex = index.records || [];
      publicSearchReady = true;
      populateSourceFilter();
      if (searchCount) searchCount.textContent = `${index.totalRecords || publicSearchIndex.length} records`;
      if (searchCountPlain) searchCountPlain.textContent = String(index.totalRecords || publicSearchIndex.length);
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
  })();

  return publicSearchPromise;
}

sourceSearch?.addEventListener("input", async () => {
  if (sourceSearch.value.trim()) await ensurePublicSearch();
  populateSourceFilter();
  renderSearchResults();
});
sourceFilter?.addEventListener("change", async () => {
  await ensurePublicSearch();
  renderSearchResults();
});
quickSearchButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (sourceSearch) sourceSearch.value = button.dataset.searchQuery || "";
    if (sourceFilter && button.dataset.searchFilter) sourceFilter.value = button.dataset.searchFilter;
    await ensurePublicSearch();
    renderSearchResults();
    searchResults?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
});
document.querySelectorAll("[data-suggested-search]").forEach((link) => {
  link.addEventListener("click", () => {
    sendQueryToSourceSearch(link.dataset.suggestedSearch || "");
  });
});

// Media library: client-side search + type filter over the static record list.
function hydrateMediaLibrary() {
  const search = document.querySelector("[data-media-search]");
  const filter = document.querySelector("[data-media-filter]");
  const dateFrom = document.querySelector("[data-media-date-from]");
  const dateTo = document.querySelector("[data-media-date-to]");
  const hostFilter = document.querySelector("[data-media-host-filter]");
  const guestFilter = document.querySelector("[data-media-guest-filter]");
  const form = document.querySelector("[data-media-filter-form]");
  const clear = document.querySelector("[data-media-clear]");
  const results = document.querySelector("[data-media-results]");
  const status = document.querySelector("[data-media-status]");
  const count = document.querySelector("[data-media-count]");
  const empty = document.querySelector("[data-media-empty]");
  const rows = Array.from(document.querySelectorAll(".media-library-row"));
  if (!rows.length || (!search && !filter && !dateFrom && !dateTo && !hostFilter && !guestFilter)) return;

  const normalizeText = (value = "") => String(value).toLowerCase().replace(/\s+/g, " ").trim();
  const parseMediaDate = (value = "") => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  };

  const typeOf = (row) => {
    const meta = (row.querySelector(".source-meta-line")?.textContent || "").toLowerCase();
    const chips = (row.querySelector(".chip-row")?.textContent || "").toLowerCase();
    const t = `${meta} ${chips}`;
    if (/podcast|interview/.test(t)) return { slug: "podcasts", label: "Podcasts & interviews" };
    if (/documentary|film/.test(t)) return { slug: "documentaries", label: "Documentaries & films" };
    if (/bibliograph/.test(t)) return { slug: "books", label: "Books" };
    if (/news|commentary|journalism|article|blog/.test(t)) return { slug: "news", label: "News & commentary" };
    return { slug: "other", label: "Other media" };
  };

  const typeCounts = new Map();
  rows.forEach((row) => {
    const { slug, label } = typeOf(row);
    row.dataset.mediaType = slug;
    row.dataset.mediaText = normalizeText([
      row.dataset.mediaSearchText,
      row.dataset.mediaTitle,
      row.dataset.mediaHost,
      row.dataset.mediaGuest,
      row.dataset.mediaDate,
      row.textContent,
    ].filter(Boolean).join(" "));
    if (!typeCounts.has(slug)) typeCounts.set(slug, { label, n: 0 });
    typeCounts.get(slug).n += 1;
  });

  if (filter && filter.options.length <= 1) {
    [...typeCounts.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .forEach(([slug, { label, n }]) => {
        if ([...filter.options].some((option) => option.value === slug)) return;
        const opt = document.createElement("option");
        opt.value = slug;
        opt.textContent = `${label} (${n})`;
        filter.append(opt);
      });
  }

  const applyDefault = () => {
    let shown = 0;
    rows.forEach((row) => {
      const show = row.dataset.mediaType === "podcasts";
      row.hidden = !show;
      if (show) shown += 1;
    });
    if (filter) filter.value = "podcasts";
    if (results) results.hidden = false;
    if (empty) empty.hidden = true;
    if (count) count.textContent = shown ? `${shown} podcast and interview records shown` : "";
    if (status) status.textContent = shown ? `${shown} podcast and interview records shown. Use search to narrow the list.` : "No podcast or interview records found.";
  };

  const apply = () => {
    const q = normalizeText(search?.value || "");
    const terms = q.split(/\s+/).filter(Boolean);
    const type = filter?.value || "all";
    const from = parseMediaDate(dateFrom?.value || "");
    const to = parseMediaDate(dateTo?.value || "");
    const toEnd = to === null ? null : to + 86_399_999;
    const hostQ = normalizeText(hostFilter?.value || "");
    const guestQ = normalizeText(guestFilter?.value || "");
    const fieldedTerms = [hostQ, guestQ].flatMap((value) => value.split(/\s+/).filter(Boolean));
    const allTextTerms = [...terms, ...fieldedTerms];
    const canUseRelaxedSearch = allTextTerms.length > 0 && (hostQ || guestQ);

    const rowMatches = (row, mode = "strict") => {
      const rowDate = parseMediaDate(row.dataset.mediaDate || "");
      const hostText = normalizeText(row.dataset.mediaHost || "");
      const guestText = normalizeText(row.dataset.mediaGuest || "");
      const matchType = type === "all" || row.dataset.mediaType === type;
      const matchText = !terms.length || terms.every((t) => row.dataset.mediaText.includes(t));
      const matchFrom = from === null || (rowDate !== null && rowDate >= from);
      const matchTo = toEnd === null || (rowDate !== null && rowDate <= toEnd);
      const matchHost = !hostQ || hostText.includes(hostQ) || row.dataset.mediaText.includes(hostQ);
      const matchGuest = !guestQ || guestText.includes(guestQ) || row.dataset.mediaText.includes(guestQ);
      if (mode === "relaxed") {
        const relaxedText = !allTextTerms.length || allTextTerms.every((t) => row.dataset.mediaText.includes(t));
        return matchType && relaxedText && matchFrom && matchTo;
      }
      return matchType && matchText && matchFrom && matchTo && matchHost && matchGuest;
    };

    let mode = "strict";
    let matches = rows.filter((row) => rowMatches(row, mode));
    if (!matches.length && canUseRelaxedSearch) {
      mode = "relaxed";
      matches = rows.filter((row) => rowMatches(row, mode));
    }

    const matchedRows = new Set(matches);
    let shown = 0;
    rows.forEach((row) => {
      const show = matchedRows.has(row);
      row.hidden = !show;
      if (show) shown += 1;
    });
    if (results) results.hidden = false;
    if (count) count.textContent = shown ? `${shown} of ${rows.length} records shown` : "";
    if (status) {
      status.textContent = shown
        ? `${shown} of ${rows.length} records shown${mode === "relaxed" ? " (broadened across all record text because podcast metadata can be incomplete)" : ""}.`
        : "No matching records.";
    }
    if (empty) {
      empty.hidden = shown !== 0;
      if (!shown) empty.textContent = "No media records match those filters. Try fewer fields or put the names together in Keyword.";
    }
  };

  const resetControls = () => {
    [search, hostFilter, guestFilter].forEach((control) => {
      if (control) control.value = "";
    });
    [dateFrom, dateTo].forEach((control) => {
      if (control) control.value = "";
    });
    applyDefault();
    search?.focus();
  };

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    apply();
  });
  clear?.addEventListener("click", resetControls);
  [search, hostFilter, guestFilter].forEach((control) => {
    control?.addEventListener("input", () => {
      if (results?.hidden === false && status) status.textContent = "Click Search media to update results.";
    });
  });
  [filter, dateFrom, dateTo].forEach((control) => {
    control?.addEventListener("change", () => {
      if (results?.hidden === false && status) status.textContent = "Click Search media to update results.";
    });
  });
  applyDefault();
}

hydrateMediaLibrary();

// Populate the source-type filter from the loaded index (browse/search pages).
function populateSourceFilter() {
  if (!sourceFilter || sourceFilter.dataset.populated === "true" || sourceFilter.options.length > 1) return;
  const seen = new Map();
  publicSearchIndex.forEach((record) => {
    if (record.category && !seen.has(record.category)) {
      seen.set(record.category, record.displayCategory || record.category);
    }
  });
  [...seen.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      sourceFilter.append(option);
    });
  sourceFilter.dataset.populated = "true";
}

// Hydrate the dedicated /search/ page (from ?q=) and browse views like /sources/
// (data-browse-all). The homepage has the same elements but neither trigger, so
// its behavior is unchanged.
if (searchResults && sourceSearch) {
  const initialQuery = new URLSearchParams(window.location.search).get("q");
  const browseAll = searchResults.dataset.browseAll === "true";
  if (initialQuery || browseAll) {
    if (initialQuery) sourceSearch.value = initialQuery;
    ensurePublicSearch().then(() => {
      populateSourceFilter();
      renderSearchResults();
    });
  }
}
askButton?.addEventListener("click", answerFromSources);
askInput?.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") answerFromSources();
});

async function hydrateWeeklyBrief() {
  if (!weeklyBrief) return;

  try {
    const brief = await loadJson("data/weekly-brief.json");
    weeklyBrief.innerHTML = "";
    (brief.items || []).forEach((item) => {
      const card = document.createElement("article");
      card.innerHTML = `
        <div class="chip-row">${sourceChipMarkup({ category: item.lane })}${confidenceChipMarkup(item.confidence)}</div>
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
      liveSourceFeed.innerHTML = "<p>No current source leads are listed in this view.</p>";
      return;
    }

    records.forEach((record) => {
      const item = document.createElement("article");
      item.className = "live-source-item";
      item.innerHTML = `
        <div>
          <div class="chip-row">${sourceChipMarkup({ category: record.kind })}${confidenceChipMarkup(record.status)}</div>
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
