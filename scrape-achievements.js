import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";

const OUT_DIR = path.resolve("data");
const JSON_OUT = path.join(OUT_DIR, "achievements.json");
const JS_OUT = path.join(OUT_DIR, "achievements.js");
const QUEST_JSON = path.join(OUT_DIR, "quests.json");
const CACHE_DIR = path.resolve("cache");
const EXPORT_DIR = path.resolve("export");
const EXPORT_DATA_DIR = path.join(EXPORT_DIR, "data");
const BASE = "https://tibia.fandom.com";
const API = `${BASE}/api.php`;
const ACHIEVEMENTS_PAGE = "Achievements/Spoiler";

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const html = await fetchPageHtml(ACHIEVEMENTS_PAGE);
  const quests = await loadQuestData();
  const achievements = parseAchievements(html, quests);

  await fs.writeFile(JSON_OUT, JSON.stringify(achievements, null, 2));
  await fs.writeFile(JS_OUT, `window.TIBIA_ACHIEVEMENTS = ${JSON.stringify(achievements, null, 2)};\n`);
  await syncExportData();
  console.log(`Wrote ${achievements.length} achievements to ${JSON_OUT} and ${JS_OUT}`);
}

async function loadQuestData() {
  try {
    return JSON.parse(await fs.readFile(QUEST_JSON, "utf8"));
  } catch {
    return [];
  }
}

async function syncExportData() {
  await fs.mkdir(EXPORT_DATA_DIR, { recursive: true });
  await fs.copyFile("achievement-tracker.html", path.join(EXPORT_DIR, "achievement-tracker.html")).catch(() => {});
  await fs.copyFile("achievement-tracker.js", path.join(EXPORT_DIR, "achievement-tracker.js")).catch(() => {});
  await fs.copyFile("quest-suggester.html", path.join(EXPORT_DIR, "quest-suggester.html")).catch(() => {});
  await fs.copyFile("quest-suggester.js", path.join(EXPORT_DIR, "quest-suggester.js")).catch(() => {});
  await fs.copyFile("index.html", path.join(EXPORT_DIR, "index.html")).catch(() => {});
  await fs.copyFile("speed-breakpoint.html", path.join(EXPORT_DIR, "speed-breakpoint.html")).catch(() => {});
  await fs.copyFile("styles.css", path.join(EXPORT_DIR, "styles.css")).catch(() => {});
  await fs.copyFile(JS_OUT, path.join(EXPORT_DATA_DIR, "achievements.js"));
}

async function fetchPageHtml(pageName) {
  const cachePath = path.join(CACHE_DIR, `${pageName.replace(/[^a-z0-9_-]/gi, "_")}.html`);

  try {
    const html = await fs.readFile(cachePath, "utf8");
    console.warn(`Using cached copy: ${cachePath}`);
    return html;
  } catch {
  }

  try {
    const html = await fetchViaMediaWikiApi(pageName);
    await fs.writeFile(cachePath, html);
    return html;
  } catch (apiError) {
    console.warn(`API fetch failed: ${apiError.message}`);
  }

  const html = await fetchText(`${BASE}/wiki/${pageName}`);
  await fs.writeFile(cachePath, html);
  return html;
}

async function fetchViaMediaWikiApi(pageName) {
  const url = new URL(API);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", pageName);
  url.searchParams.set("prop", "text");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const data = await fetchJson(url.toString());
  const html = data?.parse?.text?.["*"];
  if (!html) throw new Error("MediaWiki API returned no page HTML");
  return html;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: browserHeaders() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: browserHeaders() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function browserHeaders() {
  return {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "accept-language": "en-US,en;q=0.9",
  };
}

function parseAchievements(html, quests = []) {
  const $ = load(html);
  const achievements = [];
  const questLevelIndex = buildQuestLevelIndex(quests);

  $(".mw-parser-output table").each((_, table) => {
    const headers = $(table).find("tr").first().find("th,td").map((__, cell) => normalizeHeader($(cell).text())).get();
    if (!headers.includes("name") || !headers.includes("spoiler")) return;

    $(table).find("tr").slice(1).each((__, row) => {
      const cells = $(row).children("td,th");
      if (cells.length < 4) return;

      const values = {};
      cells.each((index, cell) => {
        const key = headers[index];
        if (!key) return;
        values[key] = {
          text: cleanText($(cell).text()),
          links: $(cell).find("a").map((___, link) => ({
            text: cleanText($(link).text()),
            href: $(link).attr("href") || "",
          })).get().filter(link => link.text),
          href: $(cell).find("a[href^='/wiki/']").first().attr("href") || "",
        };
      });

      const name = cleanAchievementName(values.name?.links?.[0]?.text || values.name?.text || "");
      if (!name) return;

      const spoilerText = cleanText([values.spoiler?.text, values.description?.text].filter(Boolean).join(" "));
      const relatedValue = values.related || values.relatedArticles;
      const related = extractRelated(relatedValue);
      const relatedQuestLinks = extractRelatedQuestLinks(...Object.values(values));
      const levelInference = inferLevel(name, spoilerText, relatedQuestLinks, related, questLevelIndex);
      const grade = parseNumber(values.grade?.text);
      const points = parseNumber(values.points?.text);

      achievements.push({
        id: slugify(name),
        name,
        grade,
        points,
        related,
        relatedQuestIds: relatedQuestLinks.map(link => slugify(link.text.replace(/\s*\(.*?\)\s*/g, ""))),
        relatedQuestNames: relatedQuestLinks.map(link => link.text),
        spoilerText,
        availability: inferAvailability(name, spoilerText, relatedQuestLinks),
        inferredLevel: levelInference.level,
        inferenceReason: levelInference.reason,
        wikiUrl: values.name?.href ? `${BASE}${values.name.href}` : `${BASE}/wiki/${encodeURIComponent(`${name}_(Achievement)`.replaceAll(" ", "_"))}`,
      });
    });
  });

  return dedupeAchievements(achievements).sort((a, b) => a.name.localeCompare(b.name));
}

function buildQuestLevelIndex(quests) {
  const byId = new Map();
  const rewardCandidates = [];

  for (const quest of quests) {
    const level = quest.recommendedLevel ?? quest.recLevel ?? quest.minLevel ?? null;
    if (!level) continue;

    const entry = {
      id: quest.id,
      name: quest.name,
      level,
      rewardText: normalizeMatchText(quest.rewardText),
    };
    byId.set(quest.id, entry);
    if (entry.rewardText) rewardCandidates.push(entry);
  }

  return { byId, rewardCandidates };
}

function normalizeHeader(value) {
  const header = cleanText(value).toLowerCase();
  if (header === "name") return "name";
  if (header === "grade" || header === "grau") return "grade";
  if (header === "points") return "points";
  if (header === "related" || header === "related articles") return "relatedArticles";
  if (header.includes("spoiler")) return "spoiler";
  if (header.includes("description")) return "description";
  return header.replace(/[^a-z0-9]+/g, "");
}

function extractRelatedQuestLinks(...values) {
  return values
    .filter(Boolean)
    .flatMap(value => value.links || [])
    .filter(link => /\bquest\b/i.test(link.text) && /^\/wiki\//.test(link.href));
}

function extractRelated(value) {
  if (!value) return [];
  return value.links.map(link => link.text).filter(Boolean).slice(0, 8);
}

function inferLevel(name, spoilerText, questLinks, related, questLevelIndex) {
  const directRewardMatches = findRewardQuestMatches([name], questLevelIndex.rewardCandidates);
  if (directRewardMatches.length) return levelFromQuestMatches(directRewardMatches, "quest reward", "lowest");

  const linkedQuestMatches = questLinks
    .map(link => questLevelIndex.byId.get(slugify(link.text.replace(/\s*\(.*?\)\s*/g, ""))))
    .filter(Boolean);
  if (linkedQuestMatches.length) return levelFromQuestMatches(linkedQuestMatches, "linked quest", "highest");

  const rewardMatches = findRewardQuestMatches(related, questLevelIndex.rewardCandidates);
  if (rewardMatches.length) return levelFromQuestMatches(rewardMatches, "related reward", "lowest");

  if (/\b(defeat|slay|kill|boss|warzone|arena)\b/i.test(spoilerText)) {
    return { level: null, reason: "No reliable level estimate yet." };
  }

  if (/\b(use|drink|eat|open|close|deliver|talk|buy|sell)\b/i.test(spoilerText)) {
    return { level: 8, reason: "Estimated as a low-level standalone task from the spoiler text." };
  }

  return { level: null, reason: "No reliable level estimate yet." };
}

function findRewardQuestMatches(related, rewardCandidates) {
  return related
    .map(name => ({
      name,
      normalized: normalizeMatchText(name),
    }))
    .filter(item => item.normalized.length >= 5 && !isGenericRelatedRewardName(item.normalized))
    .flatMap(item => rewardCandidates.filter(quest => containsMatchPhrase(quest.rewardText, item.normalized)));
}

function isGenericRelatedRewardName(name) {
  return /^(achievements?|addons?|books?|bosses|creatures?|items?|mounts?|npcs?|objects?|outfits?|quests?|tools?)$/.test(name)
    || /\b(quest|boss|creature|npc|achievement)\b/.test(name);
}

function levelFromQuestMatches(matches, sourceLabel, mode) {
  const sorted = [...matches].sort((a, b) => {
    const levelDelta = mode === "lowest" ? a.level - b.level : b.level - a.level;
    return levelDelta || a.name.localeCompare(b.name);
  });
  const strongest = sorted[0];
  const names = sorted.slice(0, 3).map(match => match.name).join(", ");
  return {
    level: strongest.level,
    reason: `Recommended level ${strongest.level} from ${sourceLabel}: ${names}.`,
  };
}

function containsMatchPhrase(text, phrase) {
  return ` ${text} `.includes(` ${phrase} `);
}

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeAchievements(achievements) {
  const seen = new Map();
  for (const achievement of achievements) {
    if (!seen.has(achievement.id)) {
      seen.set(achievement.id, achievement);
      continue;
    }

    const existing = seen.get(achievement.id);
    seen.set(achievement.id, {
      ...existing,
      grade: existing.grade ?? achievement.grade,
      points: existing.points ?? achievement.points,
      related: mergeUnique(existing.related, achievement.related),
      relatedQuestIds: mergeUnique(existing.relatedQuestIds, achievement.relatedQuestIds),
      relatedQuestNames: mergeUnique(existing.relatedQuestNames, achievement.relatedQuestNames),
      availability: mergeAvailability(existing.availability, achievement.availability),
      spoilerText: achievement.spoilerText.length > existing.spoilerText.length ? achievement.spoilerText : existing.spoilerText,
      inferredLevel: Math.max(existing.inferredLevel || 0, achievement.inferredLevel || 0) || null,
      inferenceReason: chooseInferenceReason(existing, achievement),
    });
  }
  return [...seen.values()];
}

function chooseInferenceReason(existing, achievement) {
  if ((achievement.inferredLevel || 0) > (existing.inferredLevel || 0)) return achievement.inferenceReason;
  return existing.inferenceReason || achievement.inferenceReason;
}

function inferAvailability(name, spoilerText, questLinks) {
  const relatedQuestIds = questLinks.map(link => slugify(link.text.replace(/\s*\(.*?\)\s*/g, "")));
  const text = `${name} ${spoilerText} ${questLinks.map(link => link.text).join(" ")}`.toLowerCase();

  if (relatedQuestIds.includes("a-pirate-s-death-to-me") || /\ba pirate'?s death to me\b/.test(text)) {
    return {
      type: "calendar",
      rule: "friday-day-range",
      startWeekday: 5,
      dayOfMonthStart: 18,
      dayOfMonthEnd: 23,
      durationDays: 4,
      label: "Active when A Pirate's Death to Me is active: Friday on the 18th-23rd, usually through Monday.",
      sourceUrl: "https://tibia.fandom.com/wiki/A_Pirate%27s_Death_to_Me",
    };
  }

  if (/\b(devovorga|orcsoberfest|lightbearer|bewitched|winterlight|rise of devovorga|event)\b/.test(text)) {
    return {
      type: "unknown",
      label: "Availability may depend on an event or world state.",
    };
  }

  return {
    type: "always",
    label: "No timed availability detected.",
  };
}

function mergeAvailability(a, b) {
  if (!a || a.type === "always") return b || a;
  if (!b || b.type === "always") return a;
  if (a.type === "calendar") return a;
  return b.type === "calendar" ? b : a;
}

function mergeUnique(a = [], b = []) {
  return [...new Set([...a, ...b].filter(Boolean))];
}

function cleanAchievementName(value) {
  return cleanText(value).replace(/\s*\(Achievement\)\s*$/i, "");
}

function parseNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
