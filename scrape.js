import fs from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";

const OUT_DIR = path.resolve("data");
const JSON_OUT = path.join(OUT_DIR, "items.json");
const JS_OUT = path.join(OUT_DIR, "items.js");
const EXPORT_DIR = path.resolve("export");
const EXPORT_DATA_DIR = path.join(EXPORT_DIR, "data");
const EXPORT_FILES = [
  [".htaccess", path.join(EXPORT_DIR, ".htaccess")],
  ["app.js", path.join(EXPORT_DIR, "app.js")],
  ["achievement-tracker.js", path.join(EXPORT_DIR, "achievement-tracker.js")],
  ["quest-suggester.js", path.join(EXPORT_DIR, "quest-suggester.js")],
  ["achievement-tracker.html", path.join(EXPORT_DIR, "achievement-tracker.html")],
  ["index.html", path.join(EXPORT_DIR, "index.html")],
  ["quest-suggester.html", path.join(EXPORT_DIR, "quest-suggester.html")],
  ["speed-breakpoint.html", path.join(EXPORT_DIR, "speed-breakpoint.html")],
  ["styles.css", path.join(EXPORT_DIR, "styles.css")],
  [JS_OUT, path.join(EXPORT_DATA_DIR, "items.js")],
  [path.join(OUT_DIR, "quests.js"), path.join(EXPORT_DATA_DIR, "quests.js")],
  [path.join(OUT_DIR, "achievements.js"), path.join(EXPORT_DATA_DIR, "achievements.js")]
];
const CACHE_DIR = path.resolve("cache");
const BASE = "https://tibia.fandom.com";
const API = `${BASE}/api.php`;

const pages = [
  { url: `${BASE}/wiki/Bows`, slot: "weapon", type: "bow" },
  { url: `${BASE}/wiki/Crossbows`, slot: "weapon", type: "crossbow" },
  // These common names are redirects on TibiaWiki/Fandom. Use the real
  // article pages so API fetches return tables instead of redirect stubs.
  { url: `${BASE}/wiki/Sword_Weapons`, slot: "weapon", type: "sword" },
  { url: `${BASE}/wiki/Axe_Weapons`, slot: "weapon", type: "axe" },
  { url: `${BASE}/wiki/Club_Weapons`, slot: "weapon", type: "club" },
  { url: `${BASE}/wiki/Wands`, slot: "weapon", type: "wand" },
  { url: `${BASE}/wiki/Rods`, slot: "weapon", type: "rod" },
  { url: `${BASE}/wiki/Fist_Fighting_Weapons`, slot: "weapon", type: "fist" },
  { url: `${BASE}/wiki/Throwing_Weapons`, slot: "weapon", type: "throwing" },
  { url: `${BASE}/wiki/Ammunition`, slot: "ammo", type: "ammo" },
  { url: `${BASE}/wiki/Helmets`, slot: "helmet" },
  { url: `${BASE}/wiki/Armors`, slot: "armor" },
  { url: `${BASE}/wiki/Legs`, slot: "legs" },
  { url: `${BASE}/wiki/Boots`, slot: "boots" },
  { url: `${BASE}/wiki/Shields`, slot: "shield" },
  { url: `${BASE}/wiki/Spellbooks`, slot: "shield", type: "spellbook" },
  { url: `${BASE}/wiki/Rings`, slot: "ring" },
  { url: `${BASE}/wiki/Amulets_and_Necklaces`, slot: "amulet" },
  { url: `${BASE}/wiki/Backpacks`, slot: "backpack", optional: true }
];

const headerAliases = new Map([
  ["name", "name"],
  ["item", "name"],
  ["weapon", "name"],
  ["lvl", "level"],
  ["level", "level"],
  ["voc", "vocations"],
  ["vocation", "vocations"],
  ["vocations", "vocations"],
  ["arm", "armor"],
  ["armor", "armor"],
  ["atk", "attack"],
  ["attack-value", "attack"],
  ["attack", "attack"],
  ["def", "defense"],
  ["defense", "defense"],
  ["def-mod", "defenseMod"],
  ["def-mod.", "defenseMod"],
  ["hands", "hands"],
  ["hand", "hands"],
  ["atk-mod", "attackMod"],
  ["atk-mod.", "attackMod"],
  ["attack-modifier", "attackMod"],
  ["range", "range"],
  ["hit", "hitPercent"],
  ["hit-", "hitPercent"],
  ["hit%", "hitPercent"],
  ["dmg", "damage"],
  ["damage", "damage"],
  ["damage-per-shot", "damage"],
  ["damage-shot", "damage"],
  ["bond", "damageType"],
  ["element", "damageType"],
  ["elemental", "damageType"],
  ["dmg-type", "damageType"],
  ["damage-type", "damageType"],
  ["mana", "manaPerShot"],
  ["mana-per-shot", "manaPerShot"],
  ["mana-shot", "manaPerShot"],
  ["weight", "weight"],
  ["oz", "weight"],
  ["imbuement-slots", "imbuementSlots"],
  ["imb-slots", "imbuementSlots"],
  ["imb-slots.", "imbuementSlots"],
  ["class", "classification"],
  ["class.", "classification"],
  ["classification", "classification"],
  ["attributes", "attributesText"],
  ["resist", "resistancesText"],
  ["resist.", "resistancesText"],
  ["resistances", "resistancesText"],
  ["dropped-by", "droppedBy"],
]);

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const allItems = [];

  for (const page of pages) {
    console.log(`Fetching ${page.url}`);
    const html = await fetchPageHtml(page);
    const parsed = parsePage(html, page);
    console.log(`  ${parsed.length} items`);
    allItems.push(...parsed);
  }

  const deduped = dedupeItems(allItems).sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
  await fs.writeFile(JSON_OUT, JSON.stringify(deduped, null, 2));
  await fs.writeFile(JS_OUT, `window.TIBIA_ITEMS = ${JSON.stringify(deduped, null, 2)};\n`);
  console.log(`Wrote ${deduped.length} items to ${JSON_OUT} and ${JS_OUT}`);
  await syncExportFiles();
}

async function syncExportFiles() {
  await fs.mkdir(EXPORT_DATA_DIR, { recursive: true });
  for (const [source, destination] of EXPORT_FILES) {
    await fs.copyFile(source, destination);
  }
  console.log(`Synced export files to ${EXPORT_DIR}`);
}

async function fetchPageHtml(page) {
  const pageName = page.url.replace(`${BASE}/wiki/`, "");
  const cachePath = path.join(CACHE_DIR, `${pageName.replace(/[^a-z0-9_-]/gi, "_")}.html`);

  try {
    const html = await fs.readFile(cachePath, "utf8");
    console.warn(`  Using cached copy: ${cachePath}`);
    return html;
  } catch {
  }

  try {
    let html = await fetchViaMediaWikiApi(pageName);
    const redirectTarget = extractRedirectTarget(html);
    if (redirectTarget) {
      console.warn(`  API returned redirect stub; following ${redirectTarget}`);
      html = await fetchViaMediaWikiApi(redirectTarget);
    }
    await fs.writeFile(cachePath, html);
    return html;
  } catch (apiError) {
    console.warn(`  API fetch failed: ${apiError.message}`);
  }

  try {
    const html = await fetchText(page.url);
    await fs.writeFile(cachePath, html);
    return html;
  } catch (pageError) {
    console.warn(`  Page fetch failed: ${pageError.message}`);
  }

  try {
    const html = await fs.readFile(cachePath, "utf8");
    console.warn(`  Using cached copy: ${cachePath}`);
    return html;
  } catch {
    if (page.optional) {
      console.warn(`  Skipping optional page without cached copy: ${page.url}`);
      return "";
    }
    throw new Error(
      `Could not fetch ${page.url}. Fandom may be blocking automated requests. ` +
      `Open the page in your browser, save it as HTML into ${cachePath}, then run npm run scrape again.`
    );
  }
}


function extractRedirectTarget(html) {
  const $ = load(html);
  const redirectLink = $(".redirectText a[href^='/wiki/']").first();
  const href = redirectLink.attr("href");
  if (!href) return "";
  return decodeURIComponent(href.replace(/^\/wiki\//, ""));
}

async function fetchViaMediaWikiApi(pageName) {
  const url = new URL(API);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", decodeURIComponent(pageName));
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
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: browserHeaders() });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function browserHeaders() {
  return {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "pragma": "no-cache"
  };
}

function parsePage(html, page) {
  const $ = load(html);
  const items = [];

  // Fandom is inconsistent: most equipment pages use wikitable/article-table,
  // but some melee weapon pages can render with extra wrapper/header rows.
  // So inspect every table and look for the first row that actually contains
  // useful column headers, instead of assuming the first row is the header.
  $("table").each((_, table) => {
    const sectionText = getNearbyHeadingText($, table);
    const rows = $(table).find("tr").toArray();
    const headerInfo = findHeaderRow($, rows);
    if (!headerInfo) return;

    const { headerIndex, headers } = headerInfo;

    rows.slice(headerIndex + 1).forEach(row => {
      const cells = $(row).children("td,th").toArray();
      if (cells.length < 2) return;
      const raw = {};

      cells.forEach((cell, i) => {
        const key = headers[i] || `extra${i}`;
        const text = cleanText($(cell).text());
        const imageUrl = extractImageUrl($, cell);
        if (imageUrl && !raw.imageUrl) raw.imageUrl = imageUrl;
        if (!text && key !== "name" && key !== "damageType" && key !== "droppedBy") return;

        if (key === "name") {
          const nameData = extractNameCell($, cell);
          raw.name = nameData.name || text;
          if (nameData.wikiUrl) raw.wikiUrl = nameData.wikiUrl;
          return;
        }

        if (key === "droppedBy") {
          raw.droppedBy = extractDroppedBy($, cell);
          return;
        }

        if (key === "attack") {
          const damageParts = extractDamageParts($, cell);
          if (damageParts.length) {
            raw.attack = String(damageParts.reduce((sum, part) => sum + part.amount, 0));
            raw.damageParts = damageParts;
            return;
          }
        }

        raw[key] = key === "damageType" ? extractDamageType($, cell, text) : text;
      });

      const name = cleanName(raw.name);
      if (!name || name.length > 80 || /^(name|weapon|item)$/i.test(name)) return;
      if (page.slot === "ammo" && !isAmmunitionName(name)) return;

      const attributesText = [raw.attributesText, raw.extraAttributes].filter(Boolean).join(" ");
      const resistancesText = raw.resistancesText || "";
      const damage = parseDamageRange(raw.damage);
      const item = {
        name,
        slot: page.slot,
        ...(page.type ? { type: page.type } : {}),
        level: toNumber(raw.level, 0),
        vocations: parseVocations(raw.vocations),
        armor: toNumber(raw.armor, 0),
        attack: toNumber(raw.attack, 0),
        damageParts: raw.damageParts || [],
        defense: toNumber(raw.defense, 0),
        defenseMod: toNumber(raw.defenseMod, 0),
        hands: inferHands(raw.hands, sectionText),
        attackMod: toNumber(raw.attackMod, 0),
        range: toNumber(raw.range, 0),
        hitPercent: toNumber(raw.hitPercent, 0),
        ammoType: page.slot === "ammo" ? inferAmmoType(name, sectionText) : "",
        damageType: cleanKey(raw.damageType),
        damageMin: damage.min,
        damageMax: damage.max,
        shotDamageAverage: damage.average,
        manaPerShot: toNumber(raw.manaPerShot, 0),
        weight: toNumber(raw.weight, 0),
        imbuementSlots: toNumber(raw.imbuementSlots, 0),
        classification: toNumber(raw.classification, 0),
        attributes: parseAttributes(attributesText),
        resistances: parseResistances(`${attributesText} ${resistancesText}`),
        droppedBy: raw.droppedBy || [],
        imageUrl: raw.imageUrl || "",
        wikiUrl: raw.wikiUrl || `${BASE}/wiki/${encodeURIComponent(name.replaceAll(" ", "_"))}`,
        sourcePage: page.url
      };

      // Drop mostly empty separator rows.
      if (!item.name || item.name === "?" || (!item.armor && !item.attack && !item.defense && !item.range && !item.weight && !item.shotDamageAverage && !Object.keys(item.attributes).length && !Object.keys(item.resistances).length)) {
        return;
      }
      items.push(item);
    });
  });

  return items;
}

function findHeaderRow($, rows) {
  for (let index = 0; index < Math.min(rows.length, 8); index++) {
    const cells = $(rows[index]).children("th,td").toArray();
    if (cells.length < 2) continue;

    const headers = cells.map(cell => canonicalHeader($(cell).text()));
    const knownHeaderCount = headers.filter(header =>
      [
        "name",
        "level",
        "vocations",
        "armor",
        "attack",
        "defense",
        "defenseMod",
        "hands",
        "range",
        "damage",
        "damageType",
        "manaPerShot",
        "weight",
        "imbuementSlots",
        "classification",
        "attributesText",
        "resistancesText",
        "droppedBy"
      ].includes(header)
    ).length;

    if (headers.includes("name") && knownHeaderCount >= 2) {
      return { headerIndex: index, headers };
    }
  }
  return null;
}


function getNearbyHeadingText($, table) {
  let node = $(table).prev();
  let steps = 0;
  while (node.length && steps < 12) {
    const tag = String(node.prop("tagName") || "").toLowerCase();
    if (/^h[1-6]$/.test(tag)) return cleanText(node.text());
    const nestedHeading = node.find("h1,h2,h3,h4,h5,h6").last();
    if (nestedHeading.length) return cleanText(nestedHeading.text());
    node = node.prev();
    steps += 1;
  }
  return "";
}

function isAmmunitionName(name) {
  return /\b(arrow|arrows|bolt|bolts)\b/i.test(name);
}

function inferAmmoType(name, sectionText = "") {
  const text = `${name} ${sectionText}`.toLowerCase();
  if (/\b(bolt|bolts)\b|crossbow/.test(text)) return "bolt";
  if (/\b(arrow|arrows)\b|bow/.test(text)) return "arrow";
  return "";
}

function inferHands(rawHands, sectionText = "") {
  const text = `${rawHands || ""} ${sectionText || ""}`.toLowerCase();
  if (/(^|[^0-9])2([^0-9]|$)|two|2-handed|two-handed/.test(text)) return "2";
  if (/(^|[^0-9])1([^0-9]|$)|one|1-handed|one-handed/.test(text)) return "1";
  return cleanText(rawHands || "");
}

function extractImageUrl($, cell) {
  const img = $(cell).find("img").first();
  if (!img.length) return "";
  const raw = img.attr("data-src") || img.attr("src") || "";
  if (!raw || raw.startsWith("data:")) return "";
  return raw.replace(/&amp;/g, "&");
}

function extractNameCell($, cell) {
  const links = $(cell).find("a").toArray();

  for (const link of links) {
    const href = $(link).attr("href") || "";
    const title = cleanText($(link).attr("title") || $(link).text());
    const isWikiArticle = href.startsWith("/wiki/") && !href.includes(":");
    const isImage = /^(file|image):/i.test(title) || /\.(png|jpg|jpeg|gif|webp)$/i.test(href);

    if (isWikiArticle && title && !isImage) {
      return {
        name: title,
        wikiUrl: href.startsWith("http") ? href : `${BASE}${href}`
      };
    }
  }

  return { name: cleanText($(cell).text()), wikiUrl: "" };
}

function extractDroppedBy($, cell) {
  const seen = new Set();
  const creatures = [];

  $(cell).find("a").each((_, link) => {
    const href = $(link).attr("href") || "";
    const title = cleanText($(link).attr("title") || $(link).text());
    const isWikiArticle = href.startsWith("/wiki/") && !href.includes(":");
    const isImage = /^(file|image):/i.test(title) || /\.(png|jpg|jpeg|gif|webp)$/i.test(href);
    if (!isWikiArticle || !title || isImage || seen.has(title)) return;

    seen.add(title);
    creatures.push({
      name: title,
      wikiUrl: href.startsWith("http") ? href : `${BASE}${href}`
    });
  });

  return creatures;
}

function extractDamageParts($, cell) {
  const parts = [];
  let pendingAmount = "";

  $(cell).contents().each((_, node) => {
    if (node.type === "text") {
      pendingAmount += node.data || "";
      return;
    }

    if (node.type !== "tag") return;

    const title = cleanText($(node).find("a[title$=' Damage']").first().attr("title") || "");
    if (!title) return;

    const amount = parseLastSignedNumber(pendingAmount);
    if (amount) {
      parts.push({
        amount,
        type: cleanKey(title.replace(/\s+damage$/i, "")),
        iconUrl: extractImageUrl($, node)
      });
    }
    pendingAmount = "";
  });

  if (parts.length === 1 && parts[0].type === "physical") return [];
  return parts;
}

function extractDamageType($, cell, fallback = "") {
  const title = cleanText(
    $(cell).find("a[title$=' Damage']").first().attr("title") ||
    $(cell).find("img[alt$=' Damage']").first().attr("alt") ||
    fallback
  );
  return title.replace(/\s+damage$/i, "");
}

function parseLastSignedNumber(value) {
  const matches = String(value || "").match(/[+-]?\d+(?:\.\d+)?/g);
  return matches ? Number(matches[matches.length - 1]) : 0;
}

function canonicalHeader(text) {
  const key = cleanKey(text.replace(/\[[^\]]+\]/g, ""));
  return headerAliases.get(key) || key;
}

function cleanKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/%/g, "%")
    .replace(/[^a-z0-9%]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(value) {
  return cleanText(value).replace(/^[0-9]+\s*/, "");
}

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}


function parseDamageRange(value) {
  const text = cleanText(value);
  if (!text) return { min: 0, max: 0, average: 0 };
  const range = text.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return { min, max, average: (min + max) / 2 };
  }
  const single = text.match(/\d+/);
  if (single) {
    const n = Number(single[0]);
    return { min: n, max: n, average: n };
  }
  return { min: 0, max: 0, average: 0 };
}

function parseVocations(text) {
  const source = cleanText(text).toLowerCase();
  if (!source || /none|all|any|-/i.test(source)) return [];
  const vocs = new Set();
  if (source.includes("knight") || source.includes("elite knight")) vocs.add("knight");
  if (source.includes("paladin") || source.includes("royal paladin")) vocs.add("paladin");
  if (source.includes("sorcerer") || source.includes("master sorcerer")) vocs.add("sorcerer");
  if (source.includes("druid") || source.includes("elder druid")) vocs.add("druid");
  if (source.includes("monk")) vocs.add("monk");
  return [...vocs];
}

function parseAttributes(text) {
  const source = cleanText(text).toLowerCase();
  const attrs = {};
  const patterns = [
    ["distance", /(?:distance fighting|distance|dist\.?)\s*\+?(-?\d+)/i],
    ["magicLevel", /(?:magic level|magic lvl|ml)\s*\+?(-?\d+)/i],
    ["sword", /sword(?: fighting)?\s*\+?(-?\d+)/i],
    ["axe", /axe(?: fighting)?\s*\+?(-?\d+)/i],
    ["club", /club(?: fighting)?\s*\+?(-?\d+)/i],
    ["shielding", /shielding\s*\+?(-?\d+)/i],
    ["fist", /fist(?: fighting)?\s*\+?(-?\d+)/i],
    ["speed", /speed\s*\+?(-?\d+)/i],
  ];
  for (const [key, regex] of patterns) {
    const match = source.match(regex);
    if (match) attrs[key] = Number(match[1]);
  }
  return attrs;
}

function parseResistances(text) {
  const source = cleanText(text).toLowerCase();
  const res = {};
  const elements = ["physical", "fire", "ice", "energy", "earth", "holy", "death", "drown", "life drain", "mana drain"];
  for (const element of elements) {
    const key = element.replace(/\s+/g, "");
    const regexes = [
      new RegExp(`${element}[^-+0-9]{0,18}([+-]?\\d+)%`, "i"),
      new RegExp(`([+-]?\\d+)%[^a-z0-9]{0,18}${element}`, "i")
    ];
    for (const regex of regexes) {
      const match = source.match(regex);
      if (match) {
        res[key] = Number(match[1]);
        break;
      }
    }
  }
  return res;
}

function dedupeItems(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.slot}:${item.type || ""}:${item.name.toLowerCase()}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}
