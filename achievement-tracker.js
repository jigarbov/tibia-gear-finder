const achievements = Array.isArray(window.TIBIA_ACHIEVEMENTS) ? window.TIBIA_ACHIEVEMENTS : [];
const ACHIEVEMENT_COMPLETION_KEY = "tibiaAchievementTracker.completed.v1";

let completedAchievements = loadCompletedAchievements();
let lastAchievementImportHtml = "";
let achievementQuickView = "all";

const els = {
  importPanel: document.getElementById("achievementImportPanel"),
  importText: document.getElementById("achievementImportText"),
  importButton: document.getElementById("achievementImportButton"),
  showImportButton: document.getElementById("achievementShowImportButton"),
  clearButton: document.getElementById("achievementClearButton"),
  importSummary: document.getElementById("achievementImportSummary"),
  search: document.getElementById("achievementSearch"),
  status: document.getElementById("achievementStatus"),
  grade: document.getElementById("achievementGrade"),
  hideQuestLinked: document.getElementById("achievementHideQuestLinked"),
  hideUnavailable: document.getElementById("achievementHideUnavailable"),
  doneCount: document.getElementById("achievementDoneCount"),
  openCount: document.getElementById("achievementOpenCount"),
  visibleCount: document.getElementById("achievementVisibleCount"),
  questLinkedCount: document.getElementById("achievementQuestLinkedCount"),
  unavailableCount: document.getElementById("achievementUnavailableCount"),
  title: document.getElementById("achievementResultsTitle"),
  summary: document.getElementById("achievementSummary"),
  results: document.getElementById("achievementResults"),
};

initialize();

function initialize() {
  bindEvents();
  render();
}

function bindEvents() {
  [els.search, els.status, els.grade, els.hideQuestLinked, els.hideUnavailable].forEach(element => {
    element.addEventListener("input", () => {
      achievementQuickView = "all";
      render();
    });
    element.addEventListener("change", () => {
      achievementQuickView = "all";
      render();
    });
  });

  document.querySelectorAll("[data-achievement-view]").forEach(button => {
    button.addEventListener("click", () => {
      achievementQuickView = button.dataset.achievementView || "all";
      if (achievementQuickView === "done") els.status.value = "done";
      if (achievementQuickView === "open") els.status.value = "open";
      if (achievementQuickView === "all") els.status.value = "all";
      if (achievementQuickView === "quest-linked") {
        els.status.value = "all";
        els.hideQuestLinked.checked = false;
      }
      if (achievementQuickView === "unavailable") {
        els.status.value = "all";
        els.hideUnavailable.checked = false;
      }
      render();
      scrollToResults();
    });
  });

  els.importText.addEventListener("paste", event => {
    lastAchievementImportHtml = event.clipboardData?.getData("text/html") || "";
  });

  els.importButton.addEventListener("click", importAchievements);
  els.showImportButton.addEventListener("click", () => {
    els.importPanel.classList.remove("achievement-import-collapsed");
    els.importText.hidden = false;
    els.importButton.hidden = false;
    els.showImportButton.hidden = true;
    els.importText.focus();
  });

  els.clearButton.addEventListener("click", () => {
    completedAchievements = {};
    saveCompletedAchievements();
    els.importSummary.textContent = "Cleared completed achievement status.";
    els.importPanel.classList.remove("achievement-import-collapsed");
    els.importText.hidden = false;
    els.importButton.hidden = false;
    els.showImportButton.hidden = true;
    lastAchievementImportHtml = "";
    render();
  });

  els.results.addEventListener("click", event => {
    const button = event.target.closest("[data-achievement-id]");
    if (!button) return;
    const id = button.dataset.achievementId;
    completedAchievements[id] = !completedAchievements[id];
    if (!completedAchievements[id]) delete completedAchievements[id];
    saveCompletedAchievements();
    render();
  });
}

function importAchievements() {
  const text = els.importText.value || "";
  const hasTibiaAchievementHtml = isEditAchievementPickerHtml(lastAchievementImportHtml);
  const isCautiousImport = hasTibiaAchievementHtml || isEditAchievementPickerPage(text);
  const richImport = hasTibiaAchievementHtml
    ? matchAchievementsFromEditPickerHtml(lastAchievementImportHtml)
    : null;
  const richMatches = richImport?.matches || null;

  const normalizedText = normalizeImportText(text);
  const matched = richMatches || [];

  if (!richMatches) {
    for (const achievement of achievements) {
      if (containsAchievement(normalizedText, achievement)) {
        matched.push(achievement);
      }
    }
  }

  if (richMatches) {
    completedAchievements = {};
  }

  for (const achievement of matched) {
    if (achievement?.id) {
      completedAchievements[achievement.id] = true;
    }
  }

  saveCompletedAchievements();
  els.importSummary.textContent = matched.length && richMatches
    ? `Imported ${matched.length} achievements from rich clipboard data. ${formatRichImportStats(richImport)}`
    : matched.length && isCautiousImport
    ? `Imported ${matched.length} possible achievements from plain text. This paste can include greyed-out entries, so undo any false positives.`
    : matched.length
    ? `Imported ${matched.length} achievements.`
    : "No known achievements matched that pasted text.";
  if (matched.length) {
    els.importPanel.classList.add("achievement-import-collapsed");
    els.importText.hidden = true;
    els.importButton.hidden = true;
    els.showImportButton.hidden = false;
  }
  render();
}

function matchAchievementsFromEditPickerHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  if (!doc.body) return null;

  const achievementNames = new Map();
  for (const achievement of achievements) {
    achievementNames.set(normalizeImportText(achievement.name), achievement);
  }

  const matchedById = new Map();
  const rows = [...doc.body.querySelectorAll("tr")];
  const stats = {
    rows: rows.length,
    matchedRows: 0,
    achievementRows: 0,
    enabledCheckboxRows: 0,
    disabledCheckboxRows: 0,
    greyRows: 0,
    fallback: false,
  };

  for (const row of rows) {
    const checkbox = row.querySelector("input[name='achievementlist[]'], input[type='checkbox']");
    const nameElement = row.querySelector("b");
    const achievement = nameElement ? achievementNames.get(normalizeImportText(nameElement.textContent)) : null;
    if (!checkbox || !achievement) continue;

    stats.achievementRows += 1;
    const state = getAchievementContainerCompletionState(row);
    if (state === true) {
      stats.matchedRows += 1;
      matchedById.set(achievement.id, achievement);
    }
    if (row.querySelector("input[type='checkbox']:not(:disabled)")) stats.enabledCheckboxRows += 1;
    if (row.querySelector("input[type='checkbox']:disabled")) stats.disabledCheckboxRows += 1;
    if (hasGreyedAchievementStyling(row)) stats.greyRows += 1;
  }

  if (!matchedById.size) {
    stats.fallback = true;
    for (const achievement of achievements) {
      const element = findAchievementElement(doc, achievement.name);
      if (!element) continue;
      const container = findAchievementContainer(element);
      if (container && getAchievementContainerCompletionState(container) === true) {
        matchedById.set(achievement.id, achievement);
      }
    }
  }

  const matches = [...matchedById.values()];
  return matches.length ? { matches, stats } : null;
}

function formatRichImportStats(importResult) {
  const stats = importResult?.stats;
  if (!stats) return "";
  const source = stats.fallback
    ? "Fallback parser."
    : `${stats.matchedRows} completed rows from ${stats.achievementRows} Tibia achievement rows.`;
  return `${source} ${stats.enabledCheckboxRows} enabled checkbox rows, ${stats.disabledCheckboxRows} disabled checkbox rows, ${stats.greyRows} grey rows.`;
}

function containsNormalizedAchievementName(normalizedText, achievementName) {
  const name = normalizeImportText(achievementName);
  return normalizedText === name
    || normalizedText.startsWith(`${name} tibia secret achievement`)
    || normalizedText.startsWith(`${name} tibia achievement`)
    || normalizedText.includes(` ${name} `)
    || normalizedText.startsWith(`${name} `)
    || normalizedText.endsWith(` ${name}`);
}

function findAchievementElement(doc, name) {
  const target = normalizeImportText(name);
  const candidates = [...doc.body.querySelectorAll("td, th, li, label, span, div, a")];
  return candidates.find(element => {
    const text = normalizeImportText(element.textContent);
    return text === target
      || text.startsWith(`${target} tibia secret achievement`)
      || text.startsWith(`${target} tibia achievement`)
      || (text.includes(target) && text.length <= target.length + 80);
  });
}

function findAchievementContainer(element) {
  const row = element.closest?.("tr");
  if (row) return row;

  let current = element;
  for (let depth = 0; current && depth < 6; depth += 1) {
    if (current.matches?.("li, label, div")) return current;
    current = current.parentElement;
  }
  return element;
}

function getAchievementContainerCompletionState(container) {
  const enabledCheckbox = container.querySelector?.("input[type='checkbox']:not(:disabled)");
  if (enabledCheckbox) return true;
  const disabledCheckbox = container.querySelector?.("input[type='checkbox']:disabled");
  if (disabledCheckbox) return false;

  if (hasGreyedAchievementStyling(container)) return false;
  return true;
}

function hasGreyedAchievementStyling(element) {
  return /\b(gray|grey|silver|disabled|unavailable|#999|#888|#777|#666|opacity\s*:\s*0\.[0-8]|color\s*:\s*rgb\(\s*128\s*,\s*128\s*,\s*128\s*\))/i.test(collectStyleText(element));
}

function collectStyleText(element) {
  const parts = [];
  let current = element;
  for (let depth = 0; current && depth < 4; depth += 1) {
    parts.push(current.getAttribute?.("style") || "");
    parts.push(current.getAttribute?.("class") || "");
    current = current.parentElement;
  }
  for (const child of [...(element.querySelectorAll?.("[style], [class]") || [])].slice(0, 40)) {
    parts.push(child.getAttribute("style") || "");
    parts.push(child.getAttribute("class") || "");
  }
  return parts.join(" ");
}

function isEditAchievementPickerPage(text) {
  const value = String(text || "");
  return /Edit Character Information/i.test(value)
    && /Display Character Achievements/i.test(value)
    && /select up to 5 gained achievements/i.test(value);
}

function isEditAchievementPickerHtml(html) {
  const value = String(html || "");
  return /Display Character Achievements/i.test(value)
    && /name=["']achievementlist\[\]["']/i.test(value);
}

function containsAchievement(normalizedText, achievement) {
  const name = normalizeImportText(achievement.name);
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(normalizedText);
}

function render() {
  const filters = readFilters();
  const rows = achievements.map(achievement => ({
    achievement,
    done: Boolean(completedAchievements[achievement.id]),
    availability: evaluateAvailability(achievement.availability),
  }));
  const visible = rows.filter(row => passesFilters(row, filters)).sort(compareAchievementRows);
  const doneCount = rows.filter(row => row.done).length;
  const questLinkedCount = rows.filter(row => row.achievement.relatedQuestIds?.length).length;
  const unavailableCount = rows.filter(row => row.availability.status === "inactive").length;

  els.doneCount.textContent = String(doneCount);
  els.openCount.textContent = String(Math.max(achievements.length - doneCount, 0));
  els.visibleCount.textContent = String(visible.length);
  els.questLinkedCount.textContent = String(questLinkedCount);
  els.unavailableCount.textContent = String(unavailableCount);
  els.title.textContent = visible.length === 1 ? "1 achievement" : `${visible.length} achievements`;
  els.summary.textContent = `${doneCount} completed out of ${achievements.length}. Quest-linked achievements can mark quests as likely done in the Quest Suggest...er.`;

  if (!achievements.length) {
    els.results.innerHTML = emptyState("No achievement data found. Run npm run scrape:achievements to build data/achievements.js.");
    return;
  }

  if (!visible.length) {
    els.results.innerHTML = emptyState("No achievements match those filters.");
    return;
  }

  els.results.innerHTML = `<div class="achievement-card-grid">${visible.map(renderAchievementCard).join("")}</div>`;
}

function readFilters() {
  return {
    query: els.search.value.trim().toLowerCase(),
    status: els.status.value,
    grade: els.grade.value,
    hideQuestLinked: els.hideQuestLinked.checked,
    hideUnavailable: els.hideUnavailable.checked,
  };
}

function passesFilters(row, filters) {
  const achievement = row.achievement;
  if (filters.status === "done" && !row.done) return false;
  if (filters.status === "open" && row.done) return false;
  if (filters.grade !== "all" && String(achievement.grade || "") !== filters.grade) return false;
  if (filters.hideQuestLinked && achievement.relatedQuestIds?.length) return false;
  if (filters.hideUnavailable && row.availability.status === "inactive") return false;
  if (!passesQuickView(row)) return false;

  if (!filters.query) return true;
  const haystack = [
    achievement.name,
    achievement.spoilerText,
    ...(achievement.related || []),
    ...(achievement.relatedQuestNames || []),
  ].join(" ").toLowerCase();
  return haystack.includes(filters.query);
}

function passesQuickView(row) {
  if (achievementQuickView === "quest-linked") return Boolean(row.achievement.relatedQuestIds?.length);
  if (achievementQuickView === "unavailable") return row.availability.status === "inactive";
  return true;
}

function compareAchievementRows(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const availabilityOrder = { active: 0, unknown: 1, inactive: 2 };
  const availabilityDelta = availabilityOrder[a.availability.status] - availabilityOrder[b.availability.status];
  if (availabilityDelta) return availabilityDelta;
  const gradeDelta = gradeSortValue(a.achievement.grade) - gradeSortValue(b.achievement.grade);
  if (gradeDelta) return gradeDelta;
  return a.achievement.name.localeCompare(b.achievement.name);
}

function gradeSortValue(grade) {
  return grade ? Number(grade) || 99 : 99;
}

function renderAchievementCard(row) {
  const achievement = row.achievement;
  const doneText = row.done ? "Undo done" : "Done";
  const related = achievement.relatedQuestNames?.length
    ? achievement.relatedQuestNames
    : achievement.related || [];

  return `
    <article class="achievement-card ${row.done ? "achievement-card-done" : ""} ${row.availability.status === "inactive" ? "achievement-card-unavailable" : ""}">
      <div class="achievement-card-head">
        <div>
          <span class="quest-category">${achievement.grade ? `Grade ${achievement.grade}` : "Ungraded"}</span>
          <h3><a href="${escapeAttribute(achievement.wikiUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(achievement.name)}</a></h3>
        </div>
        <span class="quest-level">${achievement.points ?? 0} pts</span>
      </div>

      <div class="quest-tags">
        ${row.done ? `<span>Completed</span>` : ""}
        ${achievement.relatedQuestIds?.length ? `<span>Quest-linked</span>` : ""}
        ${achievement.inferredLevel ? `<span>Level ${achievement.inferredLevel}+</span>` : ""}
        ${row.availability.badge ? `<span class="${row.availability.status === "inactive" ? "quest-tag-warning" : ""}">${escapeHtml(row.availability.badge)}</span>` : ""}
        ${related.slice(0, 5).map(item => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>

      <p class="quest-reward">${escapeHtml(shorten(achievement.spoilerText || "No spoiler text available.", 240))}</p>
      <div class="quest-meta">
        <span>${escapeHtml(row.availability.status === "inactive" ? row.availability.reason : achievement.inferenceReason || "No reliable level estimate yet.")}</span>
      </div>
      <div class="quest-actions">
        <button class="secondary-button" type="button" data-achievement-id="${escapeAttribute(achievement.id)}">${doneText}</button>
      </div>
    </article>
  `;
}

function evaluateAvailability(availability) {
  if (!availability || availability.type === "always") {
    return { status: "active", badge: "", reason: "No timed availability detected." };
  }

  if (availability.rule === "friday-day-range") {
    const today = startOfDay(new Date());
    const currentWindow = findCalendarWindow(availability, today, -1);
    if (currentWindow && today >= currentWindow.start && today <= currentWindow.end) {
      return { status: "active", badge: "Active now", reason: availability.label };
    }

    const nextWindow = findCalendarWindow(availability, today, 18);
    const nextText = nextWindow ? ` Next window: ${formatShortDate(nextWindow.start)}-${formatShortDate(nextWindow.end)}.` : "";
    return {
      status: "inactive",
      badge: "Unavailable now",
      reason: `${availability.label}${nextText}`,
    };
  }

  if (availability.type === "unknown") {
    return {
      status: "unknown",
      badge: "Check availability",
      reason: availability.label || "Availability may depend on world state or an event.",
    };
  }

  return { status: "active", badge: "", reason: availability.label || "No timed availability detected." };
}

function findCalendarWindow(rule, today, monthOffsetStart) {
  for (let offset = monthOffsetStart; offset <= 24; offset += 1) {
    const monthCursor = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const start = findMonthStartDate(monthCursor.getFullYear(), monthCursor.getMonth(), rule);
    if (!start) continue;
    const end = addDays(start, (rule.durationDays || 1) - 1);
    if (end >= today) return { start, end };
  }
  return null;
}

function findMonthStartDate(year, month, rule) {
  for (let day = rule.dayOfMonthStart; day <= rule.dayOfMonthEnd; day += 1) {
    const date = new Date(year, month, day);
    if (date.getMonth() === month && date.getDay() === rule.startWeekday) return startOfDay(date);
  }
  return null;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function loadCompletedAchievements() {
  try {
    return JSON.parse(localStorage.getItem(ACHIEVEMENT_COMPLETION_KEY) || "{}");
  } catch {
    return {};
  }
}

function scrollToResults() {
  requestAnimationFrame(() => {
    els.results.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function saveCompletedAchievements() {
  try {
    localStorage.setItem(ACHIEVEMENT_COMPLETION_KEY, JSON.stringify(completedAchievements));
  } catch {
  }
  saveSharedState({ completedAchievements });
}

function saveSharedState(partialState) {
  const existing = loadSharedState();
  try {
    window.name = JSON.stringify({
      ...existing,
      ...partialState,
      updatedAt: Date.now(),
    });
  } catch {
  }
}

function loadSharedState() {
  try {
    const parsed = JSON.parse(window.name || "{}");
    return parsed && typeof parsed === "object" && parsed.updatedAt ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeImportText(value) {
  return String(value || "")
    .replace(/Tibia Secret Achievement/g, " ")
    .replace(/Tibia Achievement/g, " ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function emptyState(message) {
  return `<div class="panel quest-empty">${escapeHtml(message)}</div>`;
}

function shorten(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
