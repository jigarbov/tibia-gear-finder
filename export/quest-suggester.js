const quests = Array.isArray(window.TIBIA_QUESTS) ? window.TIBIA_QUESTS : [];
const achievements = Array.isArray(window.TIBIA_ACHIEVEMENTS) ? window.TIBIA_ACHIEVEMENTS : [];

const QUEST_STATE_KEY = "tibiaQuestSuggester.questStates.v1";
const ACHIEVEMENT_COMPLETION_KEY = "tibiaAchievementTracker.completed.v1";
const rewardLabels = {
  access: "Access",
  outfit: "Outfit/addon",
  mount: "Mount",
  boss: "Boss",
  achievement: "Achievement",
  experience: "Experience",
  money: "Money",
  equipment: "Equipment",
  utility: "Utility",
  other: "Other",
};

let questStates = loadQuestStates();
let completedAchievements = loadCompletedAchievements();
let completedAchievementList = buildCompletedAchievementList();
let questPreferredView = "all";

const els = {
  controls: document.getElementById("questControls"),
  level: document.getElementById("questLevel"),
  area: document.getElementById("questArea"),
  reward: document.getElementById("questReward"),
  search: document.getElementById("questSearch"),
  hideDone: document.getElementById("questHideDone"),
  hideUnavailable: document.getElementById("questHideUnavailable"),
  results: document.getElementById("questResults"),
  title: document.getElementById("questResultsTitle"),
  summary: document.getElementById("questSummary"),
  reset: document.getElementById("questResetButton"),
  suggestedCount: document.getElementById("questSuggestedCount"),
  reviewCount: document.getElementById("questReviewCount"),
  doneCount: document.getElementById("questDoneCount"),
  laterCount: document.getElementById("questLaterCount"),
  unavailableCount: document.getElementById("questUnavailableCount"),
};

initialize();

function initialize() {
  hydrateAchievementStateFromUrl();
  removeAchievementStateFromUrl();
  populateFilters();
  bindEvents();
  render();
}

function populateFilters() {
  const areas = [...new Set(quests.flatMap(quest => quest.locations || []))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const rewards = [...new Set(quests.flatMap(quest => quest.rewardTypes || []))]
    .filter(Boolean)
    .sort((a, b) => (rewardLabels[a] || a).localeCompare(rewardLabels[b] || b));

  els.area.innerHTML = [
    `<option value="all">All areas</option>`,
    ...areas.map(area => `<option value="${escapeAttribute(area)}">${escapeHtml(area)}</option>`),
  ].join("");

  els.reward.innerHTML = [
    `<option value="all">Any reward</option>`,
    ...rewards.map(reward => `<option value="${escapeAttribute(reward)}">${escapeHtml(rewardLabels[reward] || reward)}</option>`),
  ].join("");
}

function bindEvents() {
  [els.level, els.area, els.reward, els.search, els.hideDone, els.hideUnavailable].filter(Boolean).forEach(element => {
    element.addEventListener("input", () => {
      questPreferredView = "all";
      render();
    });
    element.addEventListener("change", () => {
      questPreferredView = "all";
      render();
    });
  });

  document.addEventListener("change", event => {
    if (event.target instanceof HTMLInputElement && event.target.id?.startsWith("quest")) {
      render();
    }
    if (event.target instanceof HTMLSelectElement && event.target.id?.startsWith("quest")) {
      render();
    }
  });

  document.addEventListener("input", event => {
    if (event.target instanceof HTMLInputElement && event.target.id?.startsWith("quest")) {
      render();
    }
  });

  els.controls?.addEventListener("click", event => {
    if (event.target instanceof HTMLInputElement && event.target.type === "checkbox") {
      questPreferredView = "all";
      requestAnimationFrame(render);
    }
  });

  document.querySelectorAll("[data-quest-view]").forEach(button => {
    button.addEventListener("click", () => {
      questPreferredView = button.dataset.questView || "all";
      if (questPreferredView === "done") els.hideDone.checked = false;
      if (questPreferredView === "unavailable") els.hideUnavailable.checked = false;
      render();
      scrollToResults();
    });
  });

  window.addEventListener("storage", event => {
    if (event.key === ACHIEVEMENT_COMPLETION_KEY) {
      refreshCompletedAchievements();
    }
  });

  window.addEventListener("focus", () => {
    refreshCompletedAchievements();
  });

  els.reset.addEventListener("click", () => {
    questStates = {};
    questPreferredView = "all";
    saveQuestStates();
    render();
  });

  els.results.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.questId;
    const action = button.dataset.action;
    const state = questStates[id] || {};

    if (action === "done") {
      state.done = !state.done;
      if (state.done) state.achievementIgnored = false;
    } else if (action === "later") {
      state.later = !state.later;
    } else if (action === "not-done") {
      state.achievementIgnored = true;
    } else if (action === "use-achievement-hint") {
      state.achievementIgnored = false;
    }

    questStates[id] = state;
    if (!state.done && !state.later && !state.achievementIgnored) delete questStates[id];
    saveQuestStates();
    render();
  });
}

function render() {
  const filters = readFilters();
  const rows = quests.map(quest => buildQuestView(quest, filters));
  const visible = rows
    .filter(row => passesFilters(row, filters))
    .sort(compareQuestRows);

  const done = visible.filter(row => row.state.done);
  const suggested = visible.filter(row => row.group === "suggested" && !row.state.later && !row.state.done);
  const confirm = visible.filter(row => row.group === "confirm" && !row.state.later && !row.state.done);
  const review = visible.filter(row => row.group === "review" && !row.state.later && !row.state.done);
  const later = visible.filter(row => row.state.later);
  const stretch = visible.filter(row => row.group === "stretch" && !row.state.later && !row.state.done);
  const unavailable = visible.filter(row => row.group === "unavailable" && !row.state.later && !row.state.done);
  const grouped = buildGroups({ done, confirm, suggested, review, stretch, unavailable, later })
    .filter(([, groupRows]) => groupRows.length);

  els.suggestedCount.textContent = String(suggested.length);
  els.reviewCount.textContent = String(review.length);
  els.doneCount.textContent = String(rows.filter(row => row.state.done).length);
  els.laterCount.textContent = String(Object.values(questStates).filter(state => state.later).length);
  els.unavailableCount.textContent = String(rows.filter(row => row.availability.status === "inactive").length);
  els.title.textContent = visible.length === 1 ? "1 quest" : `${visible.length} quests`;
  els.summary.textContent = buildSummary(filters, visible.length);

  if (!quests.length) {
    els.results.innerHTML = emptyState("No quest data found. Run npm run scrape:quests to build data/quests.js.");
    return;
  }

  if (!visible.length) {
    els.results.innerHTML = emptyState("No quests match those filters.");
    return;
  }

  els.results.innerHTML = grouped.map(([title, groupRows]) => renderGroup(title, groupRows)).join("");
}

function readFilters() {
  return {
    level: Math.max(1, Number(els.level.value) || 1),
    area: els.area.value,
    reward: els.reward.value,
    query: els.search.value.trim().toLowerCase(),
    hideDone: els.hideDone.checked,
    hideUnavailable: els.hideUnavailable.checked,
  };
}

function buildQuestView(quest, filters) {
  const state = questStates[quest.id] || {};
  const ignoredAchievement = findLikelyDoneAchievement(quest);
  const likelyDoneAchievement = state.achievementIgnored ? null : ignoredAchievement;
  const requiredLevel = hasUsefulRequiredLevel(quest) ? quest.requiredLevel : null;
  const baseLevel = quest.recommendedLevel ?? quest.minLevel ?? requiredLevel ?? quest.prerequisiteLevel;
  const suggestedLevel = requiredLevel != null && baseLevel != null
    ? Math.max(requiredLevel, baseLevel)
    : baseLevel;
  const availability = evaluateAvailability(quest.availability);
  const isReview = suggestedLevel == null;
  const isSuggested = !isReview && suggestedLevel <= filters.level;
  const group = availability.status === "inactive"
    ? "unavailable"
    : likelyDoneAchievement && !state.done ? "confirm"
    : isReview ? "review" : isSuggested ? "suggested" : "stretch";

  return {
    quest,
    state,
    likelyDoneAchievement,
    ignoredAchievement,
    suggestedLevel,
    availability,
    group,
  };
}

function passesFilters(row, filters) {
  const quest = row.quest;
  if (filters.hideDone && row.state.done) return false;
  if (filters.hideUnavailable && row.availability.status === "inactive") return false;
  if (filters.area !== "all" && !(quest.locations || []).includes(filters.area)) return false;
  if (filters.reward !== "all" && !(quest.rewardTypes || []).includes(filters.reward)) return false;

  if (row.group === "stretch" && row.suggestedLevel > filters.level + 60) return false;

  if (!filters.query) return true;
  const haystack = [
    quest.name,
    quest.category,
    quest.locationText,
    quest.rewardText,
    ...(quest.locations || []),
    ...(quest.rewardTypes || []),
  ].join(" ").toLowerCase();
  return haystack.includes(filters.query);
}

function compareQuestRows(a, b) {
  const stateA = a.state.later ? 1 : 0;
  const stateB = b.state.later ? 1 : 0;
  if (stateA !== stateB) return stateA - stateB;

  const groupOrder = { confirm: 0, suggested: 1, review: 2, stretch: 3, unavailable: 4 };
  if (groupOrder[a.group] !== groupOrder[b.group]) return groupOrder[a.group] - groupOrder[b.group];

  const levelA = a.suggestedLevel ?? 9999;
  const levelB = b.suggestedLevel ?? 9999;
  return levelA - levelB || a.quest.name.localeCompare(b.quest.name);
}

function buildGroups(groupsByKey) {
  const groups = [
    ["done", "Done", groupsByKey.done],
    ["confirm", "Got achievement, confirm completion", groupsByKey.confirm],
    ["suggested", "Suggested now", groupsByKey.suggested],
    ["review", "Worth checking", groupsByKey.review],
    ["stretch", "Coming up", groupsByKey.stretch],
    ["unavailable", "Unavailable now", groupsByKey.unavailable],
    ["later", "Do later", groupsByKey.later],
  ];
  const index = groups.findIndex(([key]) => key === questPreferredView);
  if (index > 0) {
    const [selected] = groups.splice(index, 1);
    groups.unshift(selected);
  }
  return groups.map(([, title, rows]) => [title, rows]);
}

function renderGroup(title, rows) {
  return `
    <div class="quest-group">
      <h2>${escapeHtml(title)}</h2>
      <div class="quest-card-grid">
        ${rows.map(renderQuestCard).join("")}
      </div>
    </div>
  `;
}

function renderQuestCard(row) {
  const quest = row.quest;
  const state = row.state;
  const levelPills = formatLevelPills(quest, row);
  const locations = (quest.locations || []).slice(0, 5);
  const rewardTypes = (quest.rewardTypes || []).map(type => rewardLabels[type] || type);

  return `
    <article class="quest-card ${state.done ? "quest-card-done" : ""} ${row.group === "confirm" ? "quest-card-confirm" : ""} ${state.later ? "quest-card-later" : ""} ${row.availability.status === "inactive" ? "quest-card-unavailable" : ""}">
      <div class="quest-card-head">
        <div>
          <span class="quest-category">${escapeHtml(quest.category)}</span>
          <h3><a href="${escapeAttribute(quest.wikiUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(quest.name)}</a></h3>
        </div>
        <div class="quest-levels" aria-label="Quest levels">
          ${levelPills.map(renderLevelPill).join("")}
        </div>
      </div>

      <div class="quest-tags">
        ${locations.map(location => `<span>${escapeHtml(location)}</span>`).join("")}
        ${rewardTypes.map(type => `<span>${escapeHtml(type)}</span>`).join("")}
        ${row.likelyDoneAchievement ? `<span class="quest-tag-confirm">Confirm completion</span>` : ""}
        ${state.achievementIgnored ? `<span>Achievement hint hidden</span>` : ""}
        ${quest.confidence === "needs-review" ? `<span>Needs estimate</span>` : ""}
        ${row.availability.badge ? `<span class="${row.availability.status === "inactive" ? "quest-tag-warning" : ""}">${escapeHtml(row.availability.badge)}</span>` : ""}
      </div>

      <p class="quest-reward">${escapeHtml(shorten(quest.rewardText || "Reward details unavailable.", 220))}</p>

      <div class="quest-meta">
        <span>${escapeHtml(whySuggested(quest, row))}</span>
      </div>

      <div class="quest-actions quest-card-actions">
        <button class="secondary-button" type="button" data-action="done" data-quest-id="${escapeAttribute(quest.id)}">${state.done ? "Undo done" : "Done"}</button>
        ${row.likelyDoneAchievement && !state.done ? `<button class="secondary-button" type="button" data-action="not-done" data-quest-id="${escapeAttribute(quest.id)}">Not done yet</button>` : ""}
        ${state.achievementIgnored && row.ignoredAchievement && !state.done ? `<button class="secondary-button" type="button" data-action="use-achievement-hint" data-quest-id="${escapeAttribute(quest.id)}">Use achievement hint</button>` : ""}
        <button class="secondary-button" type="button" data-action="later" data-quest-id="${escapeAttribute(quest.id)}">${state.later ? "Do sooner" : "Later"}</button>
      </div>
    </article>
  `;
}

function formatLevelPills(quest, row) {
  const pills = [];
  const minimum = quest.minLevel ?? (hasUsefulRequiredLevel(quest) ? quest.requiredLevel : null) ?? quest.prerequisiteLevel;
  const recommended = quest.recLevel ?? quest.recommendedLevel;

  if (minimum != null) {
    pills.push({ type: "minimum", label: "Min", value: String(minimum) });
  }

  if (recommended != null && recommended !== minimum) {
    pills.push({ type: "recommended", label: "Rec", value: String(recommended) });
  }

  if (!pills.length) {
    pills.push({ type: row.group === "review" ? "review" : "minimum", label: row.group === "review" ? "Check" : "Min", value: row.group === "review" ? "" : "Any" });
  }

  return pills;
}

function renderLevelPill(pill) {
  return `<span class="quest-level quest-level-${pill.type}">${escapeHtml(pill.label)}${pill.value ? ` <strong>${escapeHtml(pill.value)}</strong>` : ""}</span>`;
}

function whySuggested(quest, row) {
  if (row.likelyDoneAchievement) return `Likely done from full outfit/addon achievement: ${row.likelyDoneAchievement.name}.`;
  if (row.availability.status === "inactive") return row.availability.reason;
  if (row.group === "review") return "The listed level is missing, unclear or too low to trust.";
  if (hasUsefulRequiredLevel(quest) && quest.recommendedLevel != null && quest.requiredLevel > quest.recommendedLevel) {
    return `Suggested from the listed requirement level ${quest.requiredLevel}.`;
  }
  if (quest.levelSource === "recommended") return `Suggested from the wiki recommended level ${quest.recLevel}.`;
  if (quest.prerequisiteLevel != null) {
    const names = (quest.prerequisiteQuestNames || []).join(", ") || "a related prerequisite quest";
    return `Suggested from prerequisite quest level ${quest.prerequisiteLevel}: ${names}.`;
  }
  if (hasUsefulRequiredLevel(quest)) return `Suggested from the listed requirement level ${quest.requiredLevel}.`;
  return `Suggested from the listed minimum level ${quest.minLevel}.`;
}

function hasUsefulRequiredLevel(quest) {
  return quest.requiredLevel != null && !(quest.requiredLevel === 0 && /\b(access|outfits?|addons?|mount|boss|achievement|trade|teleport|shortcut|permission|ability)\b/i.test(quest.rewardText || ""));
}

function buildSummary(filters, count) {
  const parts = [`Level ${filters.level}`];
  if (filters.area !== "all") parts.push(filters.area);
  if (filters.reward !== "all") parts.push(rewardLabels[filters.reward] || filters.reward);
  if (filters.query) parts.push(`matching "${filters.query}"`);
  const availabilityText = filters.hideUnavailable ? "Unavailable timed quests are hidden." : "Unavailable timed quests are shown at the end.";
  const achievementText = `${completedAchievementList.length} completed achievements loaded.`;
  return `${count} visible mainland quests for ${parts.join(", ")}. ${achievementText} ${availabilityText} Newbie island quests and premium filtering are intentionally ignored.`;
}

function evaluateAvailability(availability) {
  if (!availability || availability.type === "always") {
    return { status: "active", badge: "", reason: "No timed availability detected." };
  }

  if (availability.rule === "friday-day-range") {
    const today = startOfDay(new Date());
    const currentWindow = findCalendarWindow(availability, today, -1);
    if (currentWindow && today >= currentWindow.start && today <= currentWindow.end) {
      return {
        status: "active",
        badge: "Active now",
        reason: availability.label,
      };
    }

    const nextWindow = findCalendarWindow(availability, today, 18);
    const nextText = nextWindow ? ` Next window: ${formatShortDate(nextWindow.start)}-${formatShortDate(nextWindow.end)}.` : "";
    return {
      status: "inactive",
      badge: "Unavailable now",
      reason: `${availability.label}${nextText}`,
    };
  }

  if (availability.type === "month-range") {
    const activeMonths = Array.isArray(availability.months) ? availability.months : [];
    const currentMonth = new Date().getMonth() + 1;
    if (activeMonths.includes(currentMonth)) {
      return {
        status: "active",
        badge: availability.badge || "Active now",
        reason: availability.label,
      };
    }

    return {
      status: "inactive",
      badge: "Unavailable now",
      reason: availability.label || "This quest is tied to a seasonal event.",
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

function emptyState(message) {
  return `<div class="panel quest-empty">${escapeHtml(message)}</div>`;
}

function loadQuestStates() {
  try {
    return JSON.parse(localStorage.getItem(QUEST_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function loadCompletedAchievements() {
  const fromUrl = decodeAchievementStateFromUrl();
  if (Object.keys(fromUrl).length) return fromUrl;

  try {
    const savedText = localStorage.getItem(ACHIEVEMENT_COMPLETION_KEY);
    if (savedText != null) {
      const saved = JSON.parse(savedText || "{}");
      return saved && typeof saved === "object" ? saved : {};
    }
  } catch {
  }
  return loadSharedCompletedAchievements();
}

function hydrateAchievementStateFromUrl() {
  const fromUrl = decodeAchievementStateFromUrl();
  if (!Object.keys(fromUrl).length) return;
  completedAchievements = fromUrl;
  completedAchievementList = buildCompletedAchievementList();
  try {
    localStorage.setItem(ACHIEVEMENT_COMPLETION_KEY, JSON.stringify(fromUrl));
  } catch {
  }
}

function decodeAchievementStateFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("achievements");
    if (!encoded) return {};
    const parsed = JSON.parse(atob(decodeURIComponent(encoded)));
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.map(id => [id, true]));
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function removeAchievementStateFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("achievements")) return;
    url.searchParams.delete("achievements");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, document.title, next || "quest-suggester.html");
  } catch {
  }
}

function refreshCompletedAchievements() {
  completedAchievements = loadCompletedAchievements();
  completedAchievementList = buildCompletedAchievementList();
  render();
}

function loadSharedCompletedAchievements() {
  try {
    const parsed = JSON.parse(window.name || "{}");
    const shared = parsed?.completedAchievements;
    return shared && typeof shared === "object" ? shared : {};
  } catch {
    return {};
  }
}

function buildCompletedAchievementList() {
  return achievements.filter(achievement => completedAchievements[achievement.id]);
}

function findLikelyDoneAchievement(quest) {
  if (!completedAchievementList.length) return null;
  const rewardText = normalizeCompletionText(quest.rewardText);

  return completedAchievementList.find(achievement => {
    const achievementName = normalizeCompletionText(achievement.name);
    return achievementName
      && rewardText.includes(achievementName)
      && isStrongQuestCompletionAchievement(quest, achievement);
  }) || null;
}

function isStrongQuestCompletionAchievement(quest, achievement) {
  return isOutfitCompletionQuest(quest) && isOutfitCompletionAchievement(achievement);
}

function isOutfitCompletionQuest(quest) {
  const text = normalizeCompletionText(`${quest.name} ${quest.rewardText}`);
  return /\boutfits?\b/.test(text)
    && /\baddons?\b/.test(text)
    && /\bachievement\b/.test(text);
}

function isOutfitCompletionAchievement(achievement) {
  const text = normalizeCompletionText(`${achievement.name} ${achievement.spoilerText} ${(achievement.related || []).join(" ")}`);
  return /\boutfits?\b/.test(text)
    && (
      /\bboth addons?\b/.test(text)
      || /\bfull\b/.test(text)
      || /\ball addons?\b/.test(text)
      || /\boutfits? and addons?\b/.test(text)
      || /\bgetting both addons?\b/.test(text)
      || /\breceiving both addons?\b/.test(text)
    );
}

function normalizeCompletionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function saveQuestStates() {
  localStorage.setItem(QUEST_STATE_KEY, JSON.stringify(questStates));
}

function scrollToResults() {
  requestAnimationFrame(() => {
    els.results.scrollIntoView({ behavior: "smooth", block: "start" });
  });
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
