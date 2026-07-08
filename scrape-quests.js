import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";

const OUT_DIR = path.resolve("data");
const JSON_OUT = path.join(OUT_DIR, "quests.json");
const JS_OUT = path.join(OUT_DIR, "quests.js");
const CACHE_DIR = path.resolve("cache");
const EXPORT_DIR = path.resolve("export");
const EXPORT_DATA_DIR = path.join(EXPORT_DIR, "data");
const BASE = "https://tibia.fandom.com";
const API = `${BASE}/api.php`;
const QUESTS_PAGE = "Quests";
const TIBIA_BR_QUESTS_URL = "https://www.tibiawiki.com.br/wiki/Quests";

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const html = await fetchPageHtml(QUESTS_PAGE);
  const requirementHtml = await fetchExternalPageHtml("TibiaWikiBR_Quests", TIBIA_BR_QUESTS_URL).catch(error => {
    console.warn(`TibiaWikiBR requirement fetch failed: ${error.message}`);
    return "";
  });
  const brQuests = requirementHtml ? parseTibiaWikiBrQuests(requirementHtml) : [];
  const requirementIndex = buildRequirementIndex(brQuests);
  const quests = mergeTibiaWikiBrQuests(parseQuests(html, requirementIndex), brQuests);

  await fs.writeFile(JSON_OUT, JSON.stringify(quests, null, 2));
  await fs.writeFile(JS_OUT, `window.TIBIA_QUESTS = ${JSON.stringify(quests, null, 2)};\n`);
  await syncExportData();
  console.log(`Wrote ${quests.length} mainland quests to ${JSON_OUT} and ${JS_OUT}`);
}

async function syncExportData() {
  await fs.mkdir(EXPORT_DATA_DIR, { recursive: true });
  await fs.copyFile("quest-suggester.html", path.join(EXPORT_DIR, "quest-suggester.html"));
  await fs.copyFile("quest-suggester.js", path.join(EXPORT_DIR, "quest-suggester.js"));
  await fs.copyFile("achievement-tracker.html", path.join(EXPORT_DIR, "achievement-tracker.html")).catch(() => {});
  await fs.copyFile("achievement-tracker.js", path.join(EXPORT_DIR, "achievement-tracker.js")).catch(() => {});
  await fs.copyFile("index.html", path.join(EXPORT_DIR, "index.html"));
  await fs.copyFile("speed-breakpoint.html", path.join(EXPORT_DIR, "speed-breakpoint.html"));
  await fs.copyFile("styles.css", path.join(EXPORT_DIR, "styles.css"));
  await fs.copyFile(JS_OUT, path.join(EXPORT_DATA_DIR, "quests.js"));
  await fs.copyFile(path.join(OUT_DIR, "achievements.js"), path.join(EXPORT_DATA_DIR, "achievements.js")).catch(() => {});
}

async function fetchPageHtml(pageName) {
  const cachePath = path.join(CACHE_DIR, `${pageName}.html`);

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

async function fetchExternalPageHtml(cacheName, url) {
  const cachePath = path.join(CACHE_DIR, `${cacheName.replace(/[^a-z0-9_-]/gi, "_")}.html`);

  try {
    const html = await fs.readFile(cachePath, "utf8");
    console.warn(`Using cached copy: ${cachePath}`);
    return html;
  } catch {
  }

  const html = await fetchText(url);
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

function parseQuests(html, requirementIndex = new Map()) {
  const $ = load(html);
  const quests = [];
  let inMainland = false;
  let category = "Mainland Quests";

  $(".mw-parser-output").children().each((_, element) => {
    const node = $(element);
    const heading = node.find(".mw-headline").first().text().trim();

    if (/^Newbie Islands Quests$/i.test(heading)) {
      inMainland = false;
      return;
    }

    if (/^Mainland Quests$/i.test(heading)) {
      inMainland = true;
      category = "Mainland Quests";
      return;
    }

    if (inMainland && /^h[3-4]$/i.test(element.tagName || "") && heading) {
      category = heading;
      return;
    }

    if (!inMainland || element.tagName !== "table") return;
    quests.push(...parseQuestTable($, node, category, requirementIndex));
  });

  return dedupeQuests(quests).sort((a, b) => {
    const levelA = questLevel(a) ?? 9999;
    const levelB = questLevel(b) ?? 9999;
    return levelA - levelB || a.name.localeCompare(b.name);
  });
}

function parseQuestTable($, table, category, requirementIndex) {
  const headers = table.find("tr").first().find("th,td").map((_, cell) => normalizeHeader($(cell).text())).get();
  if (!headers.includes("name") || (!headers.includes("location") && !headers.includes("reward"))) return [];

  const rows = [];
  table.find("tr").slice(1).each((_, row) => {
    const cells = $(row).children("td,th");
    if (cells.length < 4) return;

    const values = {};
    cells.each((index, cell) => {
      const key = headers[index];
      if (!key) return;
      values[key] = {
        text: cleanText($(cell).text()),
        links: $(cell).find("a").map((_, link) => cleanText($(link).text())).get().filter(Boolean),
        href: $(cell).find("a[href^='/wiki/']").first().attr("href") || "",
      };
    });

    const name = values.name?.links?.[0] || values.name?.text || "";
    if (!name || /^name$/i.test(name)) return;

    const minLevelRaw = values.minLevel?.text || values.level?.text || "";
    const recLevelRaw = values.recLevel?.text || "";
    const minLevel = parseLevel(minLevelRaw);
    const recLevel = parseLevel(recLevelRaw);
    const requirement = requirementIndex.get(slugify(name));
    const rewardText = values.reward?.text || "";
    const locationText = values.location?.text || "";
    const locations = extractLocations(values.location);
    const rewardTypes = inferRewardTypes(rewardText, name, category);
    const recommendedLevel = recLevel ?? (isSuspiciousLevel(minLevel, rewardText) ? null : minLevel);
    const usefulRequiredLevel = requirement?.requiredLevel != null && !isSuspiciousLevel(requirement.requiredLevel, rewardText);
    const levelSource = recLevel != null
      ? "recommended"
      : minLevel != null && recommendedLevel != null
        ? "minimum"
        : usefulRequiredLevel
          ? "requirement"
          : "estimate-needed";

    rows.push({
      id: slugify(name),
      name,
      category,
      minLevel,
      minLevelRaw,
      recLevel,
      recLevelRaw,
      requiredLevel: requirement?.requiredLevel ?? null,
      requiredLevelRaw: requirement?.requiredLevelRaw || "",
      requiredLevelSource: requirement ? "tibiawiki.com.br" : "",
      recommendedLevel,
      levelSource,
      locations,
      locationText,
      rewardText,
      rewardTypes,
      availability: inferAvailability(name, rewardText, locationText),
      wikiUrl: values.name?.href ? `${BASE}${values.name.href}` : `${BASE}/wiki/${encodeURIComponent(name.replaceAll(" ", "_"))}`,
      confidence: levelSource === "recommended" ? "high" : levelSource === "minimum" || levelSource === "requirement" ? "medium" : "needs-review",
    });
  });

  return rows;
}

function parseTibiaWikiBrQuests(html) {
  const $ = load(html);
  const quests = [];
  let inMainland = false;
  let category = "Mainland Quests";

  $(".mw-parser-output").children().each((_, element) => {
    const node = $(element);
    const heading = node.find(".mw-headline").first().text().trim();

    if (/^Quests de Mainland$/i.test(heading)) {
      inMainland = true;
      category = "Mainland Quests";
      return;
    }

    if (/^Tarefas Di/i.test(heading) || /^Veja Tamb/i.test(heading)) {
      inMainland = false;
      return;
    }

    if (inMainland && /^h[3-4]$/i.test(element.tagName || "") && heading) {
      category = translateBrQuestCategory(heading);
      return;
    }

    if (!inMainland || element.tagName !== "table") return;

    const headers = node.find("tr").first().find("th,td").map((__, cell) => normalizeHeader($(cell).text())).get();
    const nameIndex = headers.indexOf("name");
    const levelIndex = headers.indexOf("level");
    const locationIndex = headers.indexOf("location");
    const rewardIndex = headers.indexOf("reward");
    if (nameIndex < 0 || levelIndex < 0) return;

    node.find("tr").slice(1).each((__, row) => {
      const cells = $(row).children("td,th");
      const nameCell = cells.eq(nameIndex);
      const name = nameCell.find("a").first().text().trim() || cleanText(nameCell.text());
      if (!name || /^name$/i.test(name)) return;

      const levelRaw = cleanText(cells.eq(levelIndex).text());
      const level = parseLevel(levelRaw);
      const id = slugify(name);
      const locationValue = extractBrCellValue($, cells.eq(locationIndex));
      const rewardValue = extractBrCellValue($, cells.eq(rewardIndex));
      const rewardText = rewardValue.text || "See TibiaWikiBR for reward details.";
      const locationText = locationValue.text || "";
      const href = nameCell.find("a[href^='/wiki/']").first().attr("href") || "";

      quests.push({
        id,
        name,
        category,
        requiredLevel: level,
        requiredLevelRaw: levelRaw,
        requiredLevelSource: "tibiawiki.com.br",
        locations: locationValue.links.slice(0, 8),
        locationText,
        rewardText,
        rewardTypes: inferRewardTypes(rewardText, name, category),
        wikiUrl: href ? `https://www.tibiawiki.com.br${href}` : TIBIA_BR_QUESTS_URL,
      });
    });
  });

  return dedupeBrQuests(quests);
}

function extractBrCellValue($, cell) {
  if (!cell || !cell.length) return { text: "", links: [] };
  const ignored = new Set(["image", "map", "map colour"]);
  const links = cell.find("a").map((_, link) => cleanText($(link).text())).get()
    .filter(value => value && !ignored.has(value.toLowerCase()) && !/^aqui$/i.test(value));
  const uniqueLinks = [...new Set(links.map(translateBrTerm))];
  return {
    links: uniqueLinks,
    text: uniqueLinks.length ? uniqueLinks.join(", ") : englishFallbackText(cell.text()),
  };
}

function englishFallbackText(value) {
  return translateBrTerm(cleanText(value)
    .replace(/\b(e|ou|uma|um|de|do|da|dos|das|por|para|com|possibilidade de|pontos de experiência|experiência|dinheiro)\b/gi, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim());
}

function translateBrTerm(value) {
  return cleanText(value)
    .replace(/\bExperiência\b/gi, "Experience")
    .replace(/\bDinheiro\b/gi, "Money")
    .replace(/\bgps\b/gi, "gp")
    .replace(/\bVários Locais\.?\b/gi, "Various locations")
    .replace(/\bTodo o mapa(?: do)? Tibia\.?\b/gi, "All over Tibia")
    .replace(/\b2º Addon do Demon Hunter Outfit\b/gi, "Second addon for the Demon Hunter Outfit")
    .replace(/\bAddon do\b/gi, "Addon for")
    .replace(/\bAddon para o\b/gi, "Addon for")
    .replace(/\bSul de Thais\b/gi, "South of Thais");
}

function mergeTibiaWikiBrQuests(quests, brQuests) {
  const merged = quests.map(quest => ({ ...quest }));
  const byId = new Map();
  for (const quest of merged) {
    for (const id of questMatchIds(quest.id)) byId.set(id, quest);
  }

  const additions = [];
  for (const quest of brQuests) {
    const existing = questMatchIds(quest.id).map(id => byId.get(id)).find(Boolean);
    if (existing) {
      if (existing.requiredLevel == null && quest.requiredLevel != null) {
        existing.requiredLevel = quest.requiredLevel;
        existing.requiredLevelRaw = quest.requiredLevelRaw;
        existing.requiredLevelSource = quest.requiredLevelSource;
        if (existing.levelSource === "estimate-needed") {
          existing.levelSource = "requirement";
          existing.confidence = "medium";
        }
      }
      continue;
    }

    additions.push({
      id: quest.id,
      name: quest.name,
      category: quest.category,
      minLevel: null,
      minLevelRaw: "",
      recLevel: null,
      recLevelRaw: "",
      requiredLevel: quest.requiredLevel,
      requiredLevelRaw: quest.requiredLevelRaw,
      requiredLevelSource: quest.requiredLevelSource,
      recommendedLevel: null,
      levelSource: quest.requiredLevel != null ? "requirement" : "estimate-needed",
      locations: quest.locations,
      locationText: quest.locationText,
      rewardText: quest.rewardText,
      rewardTypes: quest.rewardTypes,
      availability: inferAvailability(quest.name, quest.rewardText, quest.locationText),
      wikiUrl: quest.wikiUrl,
      confidence: quest.requiredLevel != null ? "medium" : "needs-review",
      source: "tibiawiki.com.br",
    });
  }

  return applyQuestKnowledge(inferPrerequisiteLevels(dedupeQuests([...merged, ...additions]))).sort(compareQuests);
}

function buildRequirementIndex(brQuests) {
  const index = new Map();
  for (const quest of brQuests) {
    for (const id of questMatchIds(quest.id)) {
      if (!index.has(id) || (index.get(id).requiredLevel == null && quest.requiredLevel != null)) {
        index.set(id, quest);
      }
    }
  }
  return index;
}

function inferPrerequisiteLevels(quests) {
  return quests.map(quest => {
    if (quest.recommendedLevel != null || quest.minLevel != null || hasUsefulRequiredLevel(quest)) return quest;

    const outfitPhrase = extractOutfitPhrase(quest);
    if (!outfitPhrase) return quest;

    const candidates = quests
      .filter(candidate => candidate.id !== quest.id)
      .map(candidate => ({
        quest: candidate,
        level: questLevel(candidate),
      }))
      .filter(candidate => candidate.level != null)
      .filter(candidate => normalizedText(candidate.quest.rewardText).includes(normalizedText(outfitPhrase)));

    if (!candidates.length) return quest;

    candidates.sort((a, b) => b.level - a.level || a.quest.name.localeCompare(b.quest.name));
    const bestLevel = candidates[0].level;
    const sources = candidates.filter(candidate => candidate.level === bestLevel).map(candidate => candidate.quest.name);

    return {
      ...quest,
      prerequisiteLevel: bestLevel,
      prerequisiteQuestNames: sources.slice(0, 3),
      prerequisiteLevelSource: "quest reward",
      levelSource: quest.levelSource === "estimate-needed" ? "prerequisite" : quest.levelSource,
      confidence: quest.confidence === "needs-review" ? "medium" : quest.confidence,
    };
  });
}

function applyQuestKnowledge(quests) {
  const byId = new Map(quests.map(quest => [quest.id, quest]));
  const prerequisiteMap = new Map([
    ["deepling-outfits-quest", ["liquid-black-quest"]],
    ["glooth-glider-quest", ["hero-of-rathleton-quest"]],
  ]);
  const anyLevelActivityIds = new Set([
    "newly-wed-outfits-quest",
    "lottery-ticket-quest",
  ]);

  return quests.map(quest => {
    let updated = { ...quest };
    const prerequisiteIds = prerequisiteMap.get(updated.id) || [];
    const prerequisiteSources = prerequisiteIds
      .map(id => byId.get(id))
      .filter(Boolean)
      .map(source => ({ source, level: questLevel(source) }))
      .filter(item => item.level != null);

    if (prerequisiteSources.length) {
      prerequisiteSources.sort((a, b) => b.level - a.level || a.source.name.localeCompare(b.source.name));
      updated = {
        ...updated,
        prerequisiteLevel: prerequisiteSources[0].level,
        prerequisiteQuestNames: prerequisiteSources.map(item => item.source.name),
        prerequisiteLevelSource: "quest prerequisite",
        levelSource: updated.levelSource === "estimate-needed" || !hasUsefulRequiredLevel(updated) ? "prerequisite" : updated.levelSource,
        confidence: updated.confidence === "needs-review" || !hasUsefulRequiredLevel(updated) ? "medium" : updated.confidence,
      };
    }

    if (anyLevelActivityIds.has(updated.id) && updated.minLevel == null && updated.recommendedLevel == null && updated.prerequisiteLevel == null) {
      updated = {
        ...updated,
        minLevel: 0,
        minLevelRaw: updated.minLevelRaw || "0",
        levelSource: "minimum",
        confidence: updated.confidence === "needs-review" ? "medium" : updated.confidence,
      };
    }

    if (updated.id === "percht-raider-outfits-quest") {
      updated = {
        ...updated,
        minLevel: updated.minLevel ?? 0,
        minLevelRaw: updated.minLevelRaw || "0",
        levelSource: updated.levelSource === "estimate-needed" ? "minimum" : updated.levelSource,
        confidence: updated.confidence === "needs-review" ? "medium" : updated.confidence,
        availability: {
          type: "month-range",
          months: [12, 1],
          badge: "Winter event",
          label: "Available during the Percht Queen winter event, usually around December-January.",
        },
      };
    }

    return updated;
  });
}

function extractOutfitPhrase(quest) {
  const text = `${quest.name} ${quest.rewardText || ""}`;
  const match = text.match(/\b([A-Z][A-Za-z' -]+? Outfits?)\b/);
  return match ? match[1].replace(/\bOutfit\b$/, "Outfits").trim() : "";
}

function questLevel(quest) {
  return quest.recommendedLevel
    ?? quest.minLevel
    ?? (hasUsefulRequiredLevel(quest) ? quest.requiredLevel : null)
    ?? quest.prerequisiteLevel
    ?? null;
}

function hasUsefulRequiredLevel(quest) {
  return quest.requiredLevel != null && !isSuspiciousLevel(quest.requiredLevel, quest.rewardText || "");
}

function compareQuests(a, b) {
  const levelA = questLevel(a) ?? 9999;
  const levelB = questLevel(b) ?? 9999;
  return levelA - levelB || a.name.localeCompare(b.name);
}

function questMatchIds(id) {
  const aliases = new Map([
    ["feral-trapper-outfits-quest", "feral-trappers-quest"],
  ]);
  const ids = new Set([id]);
  if (aliases.has(id)) ids.add(aliases.get(id));
  for (const [from, to] of aliases) {
    if (to === id) ids.add(from);
  }
  return [...ids];
}

function dedupeBrQuests(quests) {
  const seen = new Map();
  for (const quest of quests) {
    if (!seen.has(quest.id) || (!seen.get(quest.id).requiredLevel && quest.requiredLevel)) {
      seen.set(quest.id, quest);
    }
  }
  return [...seen.values()];
}

function translateBrQuestCategory(heading) {
  const normalized = cleanText(heading).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("trocas")) return "Mainland Exchange Quests";
  if (normalized.includes("addons")) return "Mainland Addon Quests";
  if (normalized.includes("outfits") && normalized.includes("areas premium")) return "Premium Area Outfit Quests";
  if (normalized.includes("outfits")) return "Mainland Outfit Quests";
  return "Mainland Quests";
}

function parseRequiredLevels(html) {
  const $ = load(html);
  const levels = new Map();
  let inMainland = false;

  $(".mw-parser-output").children().each((_, element) => {
    const node = $(element);
    const heading = node.find(".mw-headline").first().text().trim();

    if (/^Quests de Mainland$/i.test(heading)) {
      inMainland = true;
      return;
    }

    if (/^Tarefas Diárias$/i.test(heading) || /^Veja Também$/i.test(heading)) {
      inMainland = false;
      return;
    }

    if (!inMainland || element.tagName !== "table") return;

    const headers = node.find("tr").first().find("th,td").map((__, cell) => normalizeHeader($(cell).text())).get();
    const nameIndex = headers.indexOf("name");
    const levelIndex = headers.indexOf("level");
    if (nameIndex < 0 || levelIndex < 0) return;

    node.find("tr").slice(1).each((__, row) => {
      const cells = $(row).children("td,th");
      const nameCell = cells.eq(nameIndex);
      const name = nameCell.find("a").first().text().trim() || cleanText(nameCell.text());
      if (!name || /^name$/i.test(name)) return;

      const levelRaw = cleanText(cells.eq(levelIndex).text());
      const level = parseLevel(levelRaw);
      if (level == null) return;

      const id = slugify(name);
      if (!levels.has(id)) {
        levels.set(id, {
          level,
          levelRaw,
        });
      }
    });
  });

  return levels;
}

function inferAvailability(name, rewardText, locationText) {
  const text = `${name} ${rewardText} ${locationText}`.toLowerCase();

  if (name === "A Pirate's Death to Me") {
    return {
      type: "calendar",
      rule: "friday-day-range",
      startWeekday: 5,
      dayOfMonthStart: 18,
      dayOfMonthEnd: 23,
      durationDays: 4,
      label: "Active when Friday falls on the 18th-23rd of a month, usually through the following Monday.",
      sourceUrl: "https://tibia.fandom.com/wiki/A_Pirate%27s_Death_to_Me",
    };
  }

  if (/\b(mini world change|world change|world event|seasonal event)\b/.test(text)) {
    return {
      type: "unknown",
      label: "Availability may depend on world state or an event.",
    };
  }

  return {
    type: "always",
    label: "No timed availability detected.",
  };
}

function normalizeHeader(value) {
  const header = cleanText(value).toLowerCase();
  if (header === "name" || header === "nome") return "name";
  if (header === "min level" || header === "min. level") return "minLevel";
  if (header === "rec level" || header === "rec. level") return "recLevel";
  if (header === "level") return "level";
  if (header === "location" || header === "localizacao" || header === "localização") return "location";
  if (header === "reward" || header === "recompensa") return "reward";
  if (header === "prem" || header === "premium") return "premium";
  return header.replace(/[^a-z0-9]+/g, "");
}

function parseLevel(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text || text === "?" || text === "-" || /^none$/i.test(text)) return null;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function isSuspiciousLevel(level, rewardText) {
  if (level == null) return true;
  if (level > 0) return false;
  return /\b(access|outfit|addon|mount|boss|achievement|trade|teleport|shortcut|permission|ability)\b/i.test(rewardText);
}

function extractLocations(locationValue) {
  if (!locationValue) return [];
  const ignored = new Set(["here", "map", "image"]);
  const linked = locationValue.links
    .map(value => value.replace(/\s*\(.*?\)\s*/g, "").trim())
    .filter(value => value && !ignored.has(value.toLowerCase()));

  if (linked.length) return [...new Set(linked)].slice(0, 8);

  return locationValue.text
    .split(/,| and |\/| in | near /i)
    .map(value => cleanText(value).replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 4);
}

function inferRewardTypes(rewardText, name, category) {
  const text = `${name} ${category} ${rewardText}`.toLowerCase();
  const types = [];
  const checks = [
    ["access", /\b(access|shortcut|permission|ability to|trade|teleport|enter|passage)\b/],
    ["outfit", /\b(outfits?|addons?)\b/],
    ["mount", /\b(mount|tame|domar)\b/],
    ["boss", /\b(boss|bosses|kill)\b/],
    ["achievement", /\bachievements?\b/],
    ["experience", /\b(exp|experience)\b/],
    ["money", /\b(gp|gold|platinum|crystal coin|ingot)\b/],
    ["equipment", /\b(armor|helmet|legs|boots|shield|sword|axe|club|bow|crossbow|wand|rod|ring|amulet|backpack)\b/],
    ["utility", /\b(key|rune|spell|imbu|charm|blessing|postman|bank|mailbox)\b/],
  ];

  for (const [type, pattern] of checks) {
    if (pattern.test(text)) types.push(type);
  }

  return types.length ? types : ["other"];
}

function dedupeQuests(quests) {
  const seen = new Map();
  for (const quest of quests) {
    if (!seen.has(quest.id)) seen.set(quest.id, quest);
  }
  return [...seen.values()];
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizedText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
