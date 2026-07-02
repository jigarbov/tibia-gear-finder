const RAW_ITEMS = Array.isArray(window.TIBIA_ITEMS) ? window.TIBIA_ITEMS : [];
let items = normalizeItems(RAW_ITEMS);

const HIDDEN_STORAGE_KEY = "tibiaGearFinder.hiddenItems.v1";
const permanentlyHidden = loadPermanentHidden();
let temporarilyHidden = new Set();

const DEFAULT_RESULTS_PER_SLOT = 5;

const slots = ["weapon", "shield", "ammo", "helmet", "armor", "legs", "boots", "ring", "amulet"];
const fallbackBackpacks = [
  {
    id: "fallback-backpack",
    name: "Backpack",
    slot: "backpack",
    imageUrl: "https://static.wikia.nocookie.net/tibia/images/4/43/Backpack.gif/revision/latest?cb=20050612153130&path-prefix=en",
    wikiUrl: "https://tibia.fandom.com/wiki/Backpack",
  },
  {
    id: "fallback-blue-backpack",
    name: "Blue Backpack",
    slot: "backpack",
    imageUrl: "https://static.wikia.nocookie.net/tibia/images/9/9f/Blue_Backpack.gif/revision/latest?cb=20050612153320&path-prefix=en",
    wikiUrl: "https://tibia.fandom.com/wiki/Blue_Backpack",
  },
  {
    id: "fallback-green-backpack",
    name: "Green Backpack",
    slot: "backpack",
    imageUrl: "https://static.wikia.nocookie.net/tibia/images/9/90/Green_Backpack.gif/revision/latest?cb=20050612153515&path-prefix=en",
    wikiUrl: "https://tibia.fandom.com/wiki/Green_Backpack",
  },
  {
    id: "fallback-purple-backpack",
    name: "Purple Backpack",
    slot: "backpack",
    imageUrl: "https://static.wikia.nocookie.net/tibia/images/5/5b/Purple_Backpack.gif/revision/latest?cb=20050612153744&path-prefix=en",
    wikiUrl: "https://tibia.fandom.com/wiki/Purple_Backpack",
  },
];
const randomBackpack = pickRandomBackpack();

const slotLabels = {
  weapon: "Weapon",
  shield: "Off-hand",
  ammo: "Ammunition",
  helmet: "Helmet",
  armor: "Armor",
  legs: "Legs",
  boots: "Boots",
  ring: "Ring",
  amulet: "Amulet",
};

const weaponTypeLabels = {
  any: "Any",
  sword: "Sword",
  axe: "Axe",
  club: "Club",
  bow: "Bow",
  crossbow: "Crossbow",
  throwing: "Throwing",
  wand: "Wand",
  rod: "Rod",
  fist: "Fist",
};

const relevantWeaponTypes = {
  knight: ["axe", "club", "sword"],
  paladin: ["bow", "crossbow", "throwing"],
  sorcerer: ["wand"],
  druid: ["rod"],
  monk: ["fist"],
};

const defaultWeaponTypes = {
  knight: "axe",
  paladin: "bow",
  sorcerer: "wand",
  druid: "rod",
  monk: "fist",
};

const priorities = {
  balanced: {
    label: "Balanced",
    rules: (vocation, slot) => slot === "armor"
      ? [
          ["balancedArmorScore", "desc"],
          ["effectivePhysicalDefense", "desc"],
          ["totalResistance", "desc"],
          ["vocationDamageBoost", "desc"],
          ["weight", "asc"],
        ]
      : slot === "shield" && vocation === "knight"
      ? [
          ["balancedShieldScore", "desc"],
          ["defense", "desc"],
          ["effectivePhysicalDefense", "desc"],
          ["totalResistance", "desc"],
          ["weight", "asc"],
        ]
      : vocation === "sorcerer" || vocation === "druid"
      ? [
          ["attributes.magicLevel", "desc"],
          ["vocationDamageBoost", "desc"],
          ["shotDamageAverage", "desc"],
          ["effectivePhysicalDefense", "desc"],
          ["totalResistance", "desc"],
          ["weight", "asc"],
        ]
      : vocation === "paladin"
        ? [
            ["attributes.distance", "desc"],
            ["vocationDamageBoost", "desc"],
            ["attackMod", "desc"],
            ["attack", "desc"],
            ["range", "desc"],
            ["effectivePhysicalDefense", "desc"],
            ["totalResistance", "desc"],
            ["weight", "asc"],
          ]
        : vocation === "monk"
          ? [
              ["attributes.fist", "desc"],
              ["vocationDamageBoost", "desc"],
              ["attack", "desc"],
              ["effectivePhysicalDefense", "desc"],
              ["totalResistance", "desc"],
              ["weight", "asc"],
            ]
          : [
              ["vocationDamageBoost", "desc"],
              ["attack", "desc"],
              ["effectivePhysicalDefense", "desc"],
              ["armor", "desc"],
              ["defense", "desc"],
              ["totalResistance", "desc"],
              ["weight", "asc"],
            ],
  },
  damage: {
    label: "Damage / attack",
    rules: vocation => [
      ["vocationDamageBoost", "desc"],
      ["shotDamageAverage", "desc"],
      ["damageMax", "desc"],
      ["attackMod", "desc"],
      ["attack", "desc"],
      ["hitPercent", "desc"],
      ["range", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["totalResistance", "desc"],
      ["weight", "asc"],
    ],
  },
  range: {
    label: "Range",
    rules: [
      ["range", "desc"],
      ["attackMod", "desc"],
      ["hitPercent", "desc"],
      ["weight", "asc"],
    ],
  },
  armor: {
    label: "Defence / armor",
    rules: [
      ["effectivePhysicalDefense", "desc"],
      ["armor", "desc"],
      ["defense", "desc"],
      ["totalResistance", "desc"],
      ["weight", "asc"],
    ],
  },
  distance: {
    label: "Distance skill",
    rules: [
      ["attributes.distance", "desc"],
      ["armor", "desc"],
      ["range", "desc"],
      ["weight", "asc"],
    ],
  },
  magic: {
    label: "Magic level",
    rules: [
      ["attributes.magicLevel", "desc"],
      ["shotDamageAverage", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
  speed: {
    label: "Speed",
    rules: [
      ["attributes.speed", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["vocationDamageBoost", "desc"],
      ["weight", "asc"],
    ],
  },
  light: {
    label: "Lightest",
    rules: [
      ["weight", "asc"],
      ["effectivePhysicalDefense", "desc"],
      ["vocationDamageBoost", "desc"],
      ["range", "desc"],
    ],
  },
  physical: {
    label: "Physical defence",
    rules: [
      ["effectivePhysicalDefense", "desc"],
      ["resistances.physical", "desc"],
      ["armor", "desc"],
      ["defense", "desc"],
      ["weight", "asc"],
    ],
  },
  fire: {
    label: "Fire resistance",
    rules: [
      ["resistances.fire", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
  ice: {
    label: "Ice resistance",
    rules: [
      ["resistances.ice", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
  energy: {
    label: "Energy resistance",
    rules: [
      ["resistances.energy", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
};

const priorityChecks = {
  balanced: () => true,
  light: item => toNumber(item.weight, 0) > 0,
  damage: (item, vocation) => getVocationDamageBoost(item, vocation) > 0 || toNumber(item.attack, 0) > 0 || toNumber(item.attackMod, 0) > 0 || toNumber(item.hitPercent, 0) > 0 || toNumber(item.shotDamageAverage, 0) > 0,
  range: item => toNumber(item.range, 0) > 0,
  armor: item => getEffectivePhysicalDefense(item) > 0 || toNumber(item.armor, 0) > 0 || toNumber(item.defense, 0) > 0,
  distance: item => toNumber(item.attributes?.distance, 0) > 0,
  magic: item => toNumber(item.attributes?.magicLevel, 0) > 0,
  speed: item => toNumber(item.attributes?.speed, 0) > 0,
  physical: item => getEffectivePhysicalDefense(item) > 0 || toNumber(item.resistances?.physical, 0) > 0,
  fire: item => toNumber(item.resistances?.fire, 0) > 0,
  ice: item => toNumber(item.resistances?.ice, 0) > 0,
  energy: item => toNumber(item.resistances?.energy, 0) > 0,
};

const els = {
  vocation: document.querySelector("#vocation"),
  level: document.querySelector("#level"),
  mode: document.querySelector("#mode"),
  slot: document.querySelector("#slot"),
  slotLabel: document.querySelector("#slotLabel"),
  priority: document.querySelector("#priority"),
  weaponType: document.querySelector("#weaponType"),
  twoHanded: document.querySelector("#twoHanded"),
  handLabel: document.querySelector("#handLabel"),
  equipmentPreview: document.querySelector("#equipmentPreview"),
  results: document.querySelector("#results"),
  resultsTitle: document.querySelector("#resultsTitle"),
  resultLimit: document.querySelector("#resultLimit"),
  resultLimitValue: document.querySelector("#resultLimitValue"),
  summary: document.querySelector("#summary"),
  hiddenPanel: document.querySelector("#hiddenPanel"),
  hiddenList: document.querySelector("#hiddenList"),
  hiddenCount: document.querySelector("#hiddenCount"),
  clearHiddenButton: document.querySelector("#clearHiddenButton"),
};

init();

function init() {
  els.slot.innerHTML = slots.map(slot => `<option value="${slot}">${slotLabels[slot]}</option>`).join("");
  renderWeaponTypeOptions(true);
  applyWeaponTypeHandDefaults(true);
  els.priority.innerHTML = Object.entries(priorities)
    .map(([key, value]) => `<option value="${key}">${value.label}</option>`)
    .join("");

  els.vocation.addEventListener("input", () => {
    renderWeaponTypeOptions(true);
    applyWeaponTypeHandDefaults(true);
    temporarilyHidden = new Set();
    render();
  });

  for (const el of [els.level, els.mode, els.slot, els.priority, els.twoHanded, els.resultLimit]) {
    el.addEventListener("input", () => {
      temporarilyHidden = new Set();
      render();
    });
  }

  els.weaponType.addEventListener("input", () => {
    applyWeaponTypeHandDefaults(false);
    temporarilyHidden = new Set();
    render();
  });
  els.equipmentPreview.addEventListener("click", handleEquipmentPreviewClick);
  els.results.addEventListener("click", handleResultClick);
  els.hiddenList.addEventListener("click", handleHiddenClick);
  els.clearHiddenButton.addEventListener("click", clearPermanentHidden);

  render();
}

function normalizeItems(raw) {
  return raw.map(item => {
    const name = String(item.name ?? "Unknown item");
    const slot = cleanKey(item.slot || "extra");
    const type = item.type ? cleanKey(item.type) : undefined;
    return {
    id: item.id || makeItemId({ name, slot, type }),
    name,
    slot,
    type,
    ammoType: item.ammoType || "",
    level: toNumber(item.level, 0),
    vocations: normalizeItemVocations(item),
    imageUrl: item.imageUrl || "",
    armor: toNumber(item.armor, 0),
    defense: toNumber(item.defense, 0),
    defenseMod: toNumber(item.defenseMod, 0),
    damageParts: normalizeDamageParts(item.damageParts),
    hands: item.hands || "",
    attack: toNumber(item.attack, 0),
    attackMod: toNumber(item.attackMod, 0),
    range: toNumber(item.range, 0),
    hitPercent: toNumber(item.hitPercent, 0),
    damageType: item.damageType || "",
    damageMin: toNumber(item.damageMin, 0),
    damageMax: toNumber(item.damageMax, 0),
    shotDamageAverage: toNumber(item.shotDamageAverage, 0),
    manaPerShot: toNumber(item.manaPerShot, 0),
    weight: toNumber(item.weight, 0),
    attributes: item.attributes || {},
    resistances: item.resistances || {},
    wikiUrl: item.wikiUrl || "",
    raw: item,
  };
  });
}


function normalizeItemVocations(item) {
  const vocations = normalizeVocations(item.vocations);
  const type = cleanKey(item.type || "");
  if (vocations.length) return vocations;
  if (type === "wand") return ["sorcerer"];
  if (type === "rod") return ["druid"];
  if (type === "fist") return ["monk"];
  return vocations;
}

function normalizeDamageParts(parts) {
  if (!Array.isArray(parts)) return [];
  return parts
    .map(part => ({
      amount: toNumber(part.amount, 0),
      type: cleanKey(part.type || ""),
      iconUrl: safeImageUrl(part.iconUrl),
    }))
    .filter(part => part.amount > 0 && part.type);
}

function normalizeVocations(vocations) {
  if (!vocations) return [];
  if (Array.isArray(vocations)) return vocations.map(cleanVocation).filter(Boolean);
  return String(vocations)
    .split(/[,/]| and | or /i)
    .map(cleanVocation)
    .filter(Boolean);
}

function cleanVocation(value) {
  const v = cleanKey(value).replace(/s$/, "");
  if (["knight", "paladin", "sorcerer", "druid", "monk"].includes(v)) return v;
  if (v.includes("royal-paladin")) return "paladin";
  if (v.includes("elite-knight")) return "knight";
  if (v.includes("master-sorcerer")) return "sorcerer";
  if (v.includes("elder-druid")) return "druid";
  return "";
}

function cleanKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeItemId(item) {
  return cleanKey([item.slot, item.type || "", item.name].join("|"));
}

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function canUseItem(item, vocation, level) {
  const levelOk = item.level <= level;
  const vocationOk = item.vocations.length === 0 || item.vocations.includes(vocation);
  return levelOk && vocationOk;
}

function getStat(item, path, vocation) {
  if (path === "totalResistance") {
    return Object.values(item.resistances || {}).reduce((sum, value) => sum + toNumber(value, 0), 0);
  }
  if (path === "balancedShieldScore") {
    return getBalancedShieldScore(item, vocation);
  }
  if (path === "balancedArmorScore") {
    return getBalancedArmorScore(item, vocation);
  }
  if (path === "effectivePhysicalDefense") {
    return getEffectivePhysicalDefense(item);
  }
  if (path === "vocationDamageBoost") {
    return getVocationDamageBoost(item, vocation);
  }
  return path.split(".").reduce((obj, key) => obj?.[key], item) ?? 0;
}

function getEffectivePhysicalDefense(item) {
  // Practical ranking score: one point of physical resistance is treated as
  // roughly one point of equipment defence for sorting purposes. This makes
  // Arm 5 + physical 1% rank alongside Arm 6, instead of ignoring the resist.
  const baseDefense = Math.max(toNumber(item.armor, 0), toNumber(item.defense, 0));
  const physical = toNumber(item.resistances?.physical, 0);
  return baseDefense + physical;
}

function getBalancedShieldScore(item, vocation) {
  const physicalDefense = getEffectivePhysicalDefense(item);
  const totalResistance = Object.values(item.resistances || {}).reduce((sum, value) => sum + toNumber(value, 0), 0);
  const vocationBoost = getVocationDamageBoost(item, vocation);
  const shielding = toNumber(item.attributes?.shielding, 0);
  const weight = toNumber(item.weight, 0);

  return physicalDefense
    + totalResistance * 0.6
    + vocationBoost * 4
    + shielding * 2
    - weight / 25;
}

function getBalancedArmorScore(item, vocation) {
  const physicalDefense = getEffectivePhysicalDefense(item);
  const totalResistance = Object.values(item.resistances || {}).reduce((sum, value) => sum + toNumber(value, 0), 0);
  const vocationBoost = getVocationDamageBoost(item, vocation);
  const shielding = toNumber(item.attributes?.shielding, 0);
  const weight = toNumber(item.weight, 0);

  if (vocation === "knight") {
    const physicalResistance = toNumber(item.resistances?.physical, 0);
    const elementalResistance = totalResistance - physicalResistance;
    return physicalDefense * 2
      + physicalResistance * 0.5
      + elementalResistance * 0.25
      + vocationBoost * 4
      + shielding * 2
      - weight / 50;
  }

  return physicalDefense
    + totalResistance * 0.6
    + vocationBoost * 4
    + shielding * 2
    - weight / 25;
}


function getVocationDamageBoost(item, vocation) {
  const attrs = item.attributes || {};
  const weaponType = getSelectedWeaponType();
  let score = 0;

  if (vocation === "knight") {
    if (["sword", "axe", "club"].includes(weaponType)) {
      score += toNumber(attrs[weaponType], 0);
    }
  } else if (vocation === "paladin") {
    score += toNumber(attrs.distance, 0);
  } else if (vocation === "sorcerer" || vocation === "druid") {
    score += toNumber(attrs.magicLevel, 0);
  } else if (vocation === "monk") {
    score += toNumber(attrs.fist, 0);
  }

  if (item.type === "wand" || item.type === "rod") {
    score += toNumber(item.shotDamageAverage, 0) / 25;
  }

  const selectedMatchesItem = weaponType === "any" || item.type === weaponType;
  if (selectedMatchesItem && ["sword", "axe", "club", "fist", "throwing", "bow", "crossbow"].includes(item.type)) {
    score += toNumber(item.attack, 0) / 20;
    score += toNumber(item.attackMod, 0);
  }

  return score;
}

function getSelectedWeaponType() {
  return els.weaponType?.value || "any";
}

function getSelectedHandMode() {
  return els.twoHanded?.checked ? "2" : "1";
}

function shouldApplyHandFilter(type) {
  return ["sword", "axe", "club", "fist"].includes(type);
}

function getItemHands(item) {
  const text = String(item.hands || item.raw?.hands || item.raw?.attributesText || "").toLowerCase();
  if (/(^|[^0-9])2([^0-9]|$)|two|2-handed|two-handed/.test(text)) return "2";
  if (/(^|[^0-9])1([^0-9]|$)|one|1-handed|one-handed/.test(text)) return "1";

  // Reasonable Tibia defaults when the table does not expose hands clearly.
  if (["bow", "crossbow", "fist"].includes(item.type)) return "2";
  if (["wand", "rod", "throwing"].includes(item.type)) return "1";
  return "1";
}

function isAlwaysTwoHandedWeaponType(type) {
  return type === "bow" || type === "crossbow";
}

function applyWeaponTypeHandDefaults(resetForVocation = false) {
  if (!els.twoHanded) return;
  const weaponType = getSelectedWeaponType();
  if (isAlwaysTwoHandedWeaponType(weaponType)) {
    els.twoHanded.checked = true;
  } else if (resetForVocation) {
    els.twoHanded.checked = weaponType === "fist";
  }
  updateHandControlVisibility();
}

function updateHandControlVisibility() {
  if (!els.handLabel) return;
  const weaponType = getSelectedWeaponType();
  const hide = isAlwaysTwoHandedWeaponType(weaponType);
  els.handLabel.style.display = hide ? "none" : "grid";
}

function renderWeaponTypeOptions(resetIfIrrelevant = false) {
  const vocation = els.vocation?.value || "paladin";
  const relevant = relevantWeaponTypes[vocation] || [];
  const current = els.weaponType?.value || defaultWeaponTypes[vocation] || "any";
  const selected = resetIfIrrelevant && !relevant.includes(current)
    ? defaultWeaponTypes[vocation] || relevant[0] || current
    : current;
  const other = Object.keys(weaponTypeLabels).filter(type => type !== "any" && !relevant.includes(type));

  els.weaponType.innerHTML = [
    ...relevant.map(type => `<option value="${type}">${weaponTypeLabels[type]}</option>`),
    `<option value="any">Any weapon type</option>`,
    `<optgroup label="Other weapon types">${other.map(type => `<option value="${type}">${weaponTypeLabels[type]}</option>`).join("")}</optgroup>`,
  ].join("");

  els.weaponType.value = [...relevant, "any", ...other].includes(selected) ? selected : (defaultWeaponTypes[vocation] || "any");
}

function getRules(priorityKey, vocation, slot) {
  const rawRules = priorities[priorityKey]?.rules || priorities.balanced.rules;
  return typeof rawRules === "function" ? rawRules(vocation, slot) : rawRules;
}

function rankItems(sourceItems, priorityKey, vocation) {
  const slot = sourceItems[0]?.slot || "";
  const rules = getRules(priorityKey, vocation, slot);
  return [...sourceItems].sort((a, b) => {
    for (const [stat, direction] of rules) {
      const av = toNumber(getStat(a, stat, vocation), 0);
      const bv = toNumber(getStat(b, stat, vocation), 0);
      if (av !== bv) return direction === "desc" ? bv - av : av - bv;
    }
    return a.name.localeCompare(b.name);
  });
}

function getFiltered(slot) {
  const vocation = els.vocation.value;
  const level = toNumber(els.level.value, 0);
  const weaponType = getSelectedWeaponType();
  const handMode = getSelectedHandMode();

  return items.filter(item => {
    if (item.slot !== slot) return false;
    if (!canUseItem(item, vocation, level)) return false;

    if (slot === "weapon") {
      if (weaponType !== "any" && item.type !== weaponType) return false;
      if (!isAlwaysTwoHandedWeaponType(item.type) && shouldApplyHandFilter(item.type) && getItemHands(item) !== handMode) return false;
    }

    if (slot === "ammo") {
      if (weaponType === "bow" && item.ammoType && item.ammoType !== "arrow") return false;
      if (weaponType === "crossbow" && item.ammoType && item.ammoType !== "bolt") return false;
    }

    if (permanentlyHidden.has(item.id)) return false;
    if (temporarilyHidden.has(item.id)) return false;
    return true;
  });
}

function render() {
  updateHandControlVisibility();
  const mode = els.mode.value;
  const priorityKey = els.priority.value;
  const vocation = els.vocation.value;
  const level = toNumber(els.level.value, 0);
  const resultLimit = getSelectedResultLimit();
  els.resultLimitValue.textContent = String(resultLimit);
  renderEquipmentPreview(priorityKey);
  renderHiddenItems();
  els.slotLabel.style.display = mode === "full" ? "none" : "grid";

  if (mode === "full") {
    els.resultsTitle.textContent = `Best full set`;
    els.summary.textContent = `${titleCase(vocation)}, level ${level}, prioritising ${priorities[priorityKey].label.toLowerCase()}.`;
    renderFullSet(priorityKey, resultLimit);
  } else {
    const slot = els.slot.value;
    els.resultsTitle.textContent = `Best ${slotLabels[slot].toLowerCase()}`;
    els.summary.textContent = `${titleCase(vocation)}, level ${level}, prioritising ${priorities[priorityKey].label.toLowerCase()}.`;
    const filtered = getFiltered(slot);
    const { ranked, hasPriorityMatch } = getRankedForSlot(filtered, priorityKey, resultLimit);
    els.results.innerHTML = renderSlot(slot, ranked, false, priorityKey, hasPriorityMatch);
  }
}

function getSelectedResultLimit() {
  return Math.min(5, Math.max(1, toNumber(els.resultLimit?.value, DEFAULT_RESULTS_PER_SLOT)));
}

function renderEquipmentPreview(priorityKey) {
  if (!els.equipmentPreview) return;
  const equipment = getPreviewEquipment(priorityKey);
  if (randomBackpack) equipment.backpack = randomBackpack;
  const cells = [
    { key: "amulet", slot: "amulet", label: "Amulet" },
    { key: "helmet", slot: "helmet", label: "Helmet" },
    { key: "backpack", slot: "backpack", label: "Backpack" },
    { key: "weapon", slot: "weapon", label: "Weapon" },
    { key: "armor", slot: "armor", label: "Armor" },
    { key: "shield", slot: "shield", label: "Off-hand" },
    { key: "ring", slot: "ring", label: "Ring" },
    { key: "legs", slot: "legs", label: "Legs" },
    { key: "ammo", slot: "ammo", label: "Ammo" },
    { key: "empty-left", slot: "", label: "" },
    { key: "boots", slot: "boots", label: "Boots" },
    { key: "empty-right", slot: "", label: "" },
  ];

  els.equipmentPreview.innerHTML = cells.map(cell => {
    const item = equipment[cell.slot];
    const imageUrl = item ? safeImageUrl(item.imageUrl) : "";
    const label = item ? item.name : cell.label;
    const content = imageUrl
      ? `<img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" referrerpolicy="no-referrer">`
      : `<span>${cell.slot ? escapeHtml(cell.label.slice(0, 2)) : ""}</span>`;
    if (!cell.slot || cell.slot === "backpack") {
      return `<div class="equipment-slot equipment-${cell.key}" title="${escapeAttr(label)}">${content}</div>`;
    }
    return `<button class="equipment-slot equipment-${cell.key}" type="button" data-slot="${escapeAttr(cell.slot)}" title="${escapeAttr(label)}">${content}</button>`;
  }).join("");
}

function handleEquipmentPreviewClick(event) {
  const button = event.target.closest("[data-slot]");
  if (!button || !els.equipmentPreview.contains(button)) return;

  const slot = button.dataset.slot;
  let target = document.getElementById(getSlotSectionId(slot));
  if (!target && els.slot.value !== slot) {
    els.mode.value = "single";
    els.slot.value = slot;
    render();
    target = document.getElementById(getSlotSectionId(slot));
  }

  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getPreviewEquipment(priorityKey) {
  const previewSlots = ["amulet", "helmet", "ammo", "weapon", "armor", "shield", "ring", "legs", "boots"];
  const equipment = {};
  for (const slot of previewSlots) {
    if (!shouldShowPreviewSlot(slot)) continue;
    const filtered = getFiltered(slot);
    const { ranked } = getRankedForSlot(filtered, priorityKey, 1);
    if (ranked[0]) equipment[slot] = ranked[0];
  }
  return equipment;
}

function pickRandomBackpack() {
  const backpacks = items.filter(item => item.slot === "backpack" && safeImageUrl(item.imageUrl));
  const source = backpacks.length ? backpacks : fallbackBackpacks;
  return source[Math.floor(Math.random() * source.length)] || null;
}

function shouldShowPreviewSlot(slot) {
  const weaponType = getSelectedWeaponType();
  if (slot === "ammo") return weaponType === "bow" || weaponType === "crossbow";
  if (slot === "shield") return getSelectedHandMode() !== "2";
  return true;
}

function renderFullSet(priorityKey, resultLimit) {
  const groups = getFullSetSlots().map(slot => {
    const filtered = getFiltered(slot);
    const { ranked, hasPriorityMatch } = getRankedForSlot(filtered, priorityKey, resultLimit);
    return renderSlot(slot, ranked, true, priorityKey, hasPriorityMatch);
  });
  els.results.innerHTML = groups.join("");
}

function getFullSetSlots() {
  const weaponType = getSelectedWeaponType();
  const slots = ["weapon"];

  if (weaponType === "bow" || weaponType === "crossbow") {
    slots.push("ammo");
  } else if (getSelectedHandMode() !== "2") {
    slots.push("shield");
  }

  slots.push("amulet", "helmet", "armor", "legs", "boots", "ring");
  return slots;
}

function getRankedForSlot(sourceItems, priorityKey, limit) {
  const vocation = els.vocation.value;
  const checker = priorityChecks[priorityKey] || priorityChecks.balanced;
  const priorityIsAlwaysUseful = priorityKey === "balanced" || priorityKey === "light";
  const priorityMatches = priorityIsAlwaysUseful ? sourceItems : sourceItems.filter(item => checker(item, vocation));

  if (priorityMatches.length > 0) {
    const priorityRanked = rankItems(priorityMatches, priorityKey, vocation).slice(0, limit);
    const selectedIds = new Set(priorityRanked.map(item => item.id));
    const balancedFill = rankItems(sourceItems, "balanced", vocation)
      .filter(item => !selectedIds.has(item.id))
      .slice(0, Math.max(0, limit - priorityRanked.length));

    return {
      ranked: [...priorityRanked, ...balancedFill],
      hasPriorityMatch: true,
    };
  }

  return {
    ranked: rankItems(sourceItems, "balanced", vocation).slice(0, Math.max(0, limit - 1)),
    hasPriorityMatch: false,
  };
}

function renderSlot(slot, ranked, compact, priorityKey, hasPriorityMatch) {
  const sectionId = getSlotSectionId(slot);
  if (ranked.length === 0 && hasPriorityMatch) {
    return `<article id="${sectionId}" class="slot-group"><div class="slot-title"><h3>${slotLabels[slot]}</h3></div><p class="empty">No usable ${slotLabels[slot].toLowerCase()} found for these filters.</p></article>`;
  }

  const unavailableCard = hasPriorityMatch
    ? ""
    : renderUnavailablePriorityCard(slot, priorityKey, compact);

  if (ranked.length === 0) {
    return `<article id="${sectionId}" class="slot-group"><div class="slot-title"><h3>${slotLabels[slot]}</h3></div><div class="card-grid">${unavailableCard}</div></article>`;
  }

  const cards = ranked.map((item, index) => renderItemCard(item, hasPriorityMatch ? index : index + 1, compact)).join("");
  return `<article id="${sectionId}" class="slot-group"><div class="slot-title"><h3>${slotLabels[slot]}</h3></div><div class="card-grid">${unavailableCard}${cards}</div></article>`;
}

function getSlotSectionId(slot) {
  return `results-${cleanKey(slot)}`;
}

function renderUnavailablePriorityCard(slot, priorityKey, compact) {
  const priorityLabel = priorities[priorityKey]?.label || "that priority";
  const slotLabel = slotLabels[slot].toLowerCase();
  const fallbackText = compact
    ? "Showing balanced picks next."
    : "The recommendations after this use the balanced formula instead, so the slot is still useful.";

  return `
    <article class="item-card unavailable-priority best">
      <h3>No valid ${priorityLabel.toLowerCase()} ${slotLabel}</h3>
      <div class="meta">Priority not applicable</div>
      <div class="stats"><span class="pill">No matching boost parsed</span></div>
      ${compact ? "" : `<p class="reason">No usable ${slotLabel} in this result set has stats for ${priorityLabel.toLowerCase()}. ${fallbackText}</p>`}
    </article>`;
}

function renderItemCard(item, index, compact) {
  const stats = buildStats(item);
  const reason = buildReason(item);
  const imageUrl = safeImageUrl(item.imageUrl);
  const wikiUrl = safeWikiUrl(item.wikiUrl);
  const meta = [
    item.type ? titleCase(item.type) : titleCase(item.slot),
    `Level ${item.level || "none"}`,
    item.vocations.length ? item.vocations.map(titleCase).join(", ") : "Any vocation",
  ].join(" • ");
  const image = imageUrl ? `<img class="item-image" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" referrerpolicy="no-referrer">` : `<div class="item-image placeholder" aria-hidden="true">?</div>`;
  return `
    <article class="item-card ${index === 0 ? "best" : ""}">
      <div class="item-card-head">${image}<div><h3>${index === 0 ? "★ " : ""}${escapeHtml(item.name)}</h3><div class="meta">${escapeHtml(meta)}</div></div></div>
      <div class="stats">${stats.map(renderStatPill).join("")}</div>
      ${compact ? "" : `<p class="reason">${escapeHtml(reason)}</p>`}
      <div class="card-actions">
        ${wikiUrl ? `<a href="${escapeAttr(wikiUrl)}" target="_blank" rel="noopener noreferrer">Open wiki page</a>` : ""}
        <button class="icon-button secondary-button" type="button" data-action="temp-hide" data-id="${escapeAttr(item.id)}" title="Hide for this search" aria-label="Hide ${escapeAttr(item.name)} for this search">👁</button>
        <button class="icon-button danger-button" type="button" data-action="perm-hide" data-id="${escapeAttr(item.id)}" title="Hide permanently" aria-label="Hide ${escapeAttr(item.name)} permanently">🗑</button>
      </div>
    </article>`;
}

function renderStatPill(stat) {
  if (typeof stat === "string") return `<span class="pill">${escapeHtml(stat)}</span>`;
  const icon = stat.iconUrl
    ? `<img class="stat-icon" src="${escapeAttr(stat.iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : "";
  return `<span class="pill stat-pill">${icon}${escapeHtml(stat.text || "")}</span>`;
}

function buildStats(item) {
  const out = [];
  if (item.slot === "weapon") addAttackStats(out, item);
  if (item.armor) out.push(`Arm ${item.armor}`);
  if (item.defense) out.push(`Def ${item.defense}`);
  if (item.defenseMod) out.push(`Def mod ${fmtSigned(item.defenseMod)}`);
  if (item.hands) out.push(`${item.hands} hand${String(item.hands) === "1" ? "" : "s"}`);
  if (item.slot !== "weapon") addAttackStats(out, item);
  if (item.range) out.push(`Range ${item.range}`);
  if (item.hitPercent) out.push(`Hit ${fmtSigned(item.hitPercent)}%`);
  if (item.shotDamageAverage) out.push(`Damage ${item.damageMin}-${item.damageMax}`);
  if (item.damageType) out.push(titleCase(item.damageType));
  if (item.manaPerShot) out.push(`Mana ${item.manaPerShot}`);
  if (item.weight) out.push(`Weight ${item.weight}`);

  for (const [key, value] of Object.entries(item.attributes || {})) {
    const n = toNumber(value, 0);
    if (n) out.push(`${prettyStat(key)} ${fmtSigned(n)}`);
  }
  for (const [key, value] of Object.entries(item.resistances || {})) {
    const n = toNumber(value, 0);
    if (n) out.push(`${prettyStat(key)} ${fmtSigned(n)}%`);
  }
  return out.length ? out : ["No parsed stats"];
}

function addAttackStats(out, item) {
  if (item.attack) out.push(`Atk ${item.attack}`);
  for (const part of item.damageParts || []) {
    out.push({
      text: `${prettyStat(part.type)} ${part.amount}`,
      iconUrl: part.iconUrl,
    });
  }
  if (item.attackMod) out.push(`Atk mod ${fmtSigned(item.attackMod)}`);
}

function buildReason(item) {
  const bits = [];
  if (item.range) bits.push(`range ${item.range}`);
  if (item.attackMod) bits.push(`attack modifier ${fmtSigned(item.attackMod)}`);
  if (item.armor) bits.push(`armor ${item.armor}`);
  if (item.defense) bits.push(`defence ${item.defense}`);
  const effectivePhysicalDefense = getEffectivePhysicalDefense(item);
  const baseDefense = Math.max(toNumber(item.armor, 0), toNumber(item.defense, 0));
  if (effectivePhysicalDefense && effectivePhysicalDefense !== baseDefense) bits.push(`physical defence score ${effectivePhysicalDefense}`);
  if (item.attributes?.distance) bits.push(`distance ${fmtSigned(item.attributes.distance)}`);
  if (item.attributes?.magicLevel) bits.push(`magic level ${fmtSigned(item.attributes.magicLevel)}`);
  if (item.attributes?.fist) bits.push(`fist fighting ${fmtSigned(item.attributes.fist)}`);
  if (item.attributes?.speed) bits.push(`speed ${fmtSigned(item.attributes.speed)}`);
  if (item.shotDamageAverage) bits.push(`wand/rod damage ${item.damageMin}-${item.damageMax}`);
  if (item.resistances?.physical) bits.push(`physical resistance ${fmtSigned(item.resistances.physical)}%`);
  if (item.weight) bits.push(`weight ${item.weight}`);
  return bits.length ? `Chosen because it has ${bits.join(", ")} while matching your level and vocation.` : "Chosen because it matches your level and vocation better than the other parsed options.";
}

function fmtSigned(value) {
  const n = toNumber(value, 0);
  return n > 0 ? `+${n}` : String(n);
}

function prettyStat(key) {
  const labels = { magicLevel: "Magic level", lifeDrain: "Life drain", manaDrain: "Mana drain" };
  return labels[key] || String(key).replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
}

function titleCase(value) {
  return String(value).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#039;");
}

function safeImageUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return "";
  return url.hostname === "static.wikia.nocookie.net" ? url.href : "";
}

function safeWikiUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return "";
  return url.hostname === "tibia.fandom.com" && url.pathname.startsWith("/wiki/") ? url.href : "";
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}


function loadPermanentHidden() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function savePermanentHidden() {
  localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify([...permanentlyHidden]));
}

function handleResultClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  if (!id) return;

  if (button.dataset.action === "temp-hide") {
    temporarilyHidden.add(id);
    render();
    return;
  }

  if (button.dataset.action === "perm-hide") {
    permanentlyHidden.add(id);
    temporarilyHidden.delete(id);
    savePermanentHidden();
    render();
  }
}

function handleHiddenClick(event) {
  const button = event.target.closest("button[data-action='unhide']");
  if (!button) return;
  const id = button.dataset.id;
  if (!id) return;
  permanentlyHidden.delete(id);
  savePermanentHidden();
  render();
}

function clearPermanentHidden() {
  if (permanentlyHidden.size === 0) return;
  permanentlyHidden.clear();
  savePermanentHidden();
  render();
}

function renderHiddenItems() {
  const hiddenItems = items
    .filter(item => permanentlyHidden.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  els.hiddenCount.textContent = hiddenItems.length.toLocaleString();
  els.clearHiddenButton.disabled = hiddenItems.length === 0;

  if (hiddenItems.length === 0) {
    els.hiddenList.innerHTML = `<p class="muted-text">No permanently hidden items yet.</p>`;
    return;
  }

  els.hiddenList.innerHTML = hiddenItems.map(item => {
    const meta = [
      slotLabels[item.slot] || titleCase(item.slot),
      item.type ? titleCase(item.type) : "",
      item.level ? `Level ${item.level}` : "No level",
    ].filter(Boolean).join(" • ");

    return `
      <div class="hidden-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(meta)}</span>
        </div>
        <button class="secondary-button" type="button" data-action="unhide" data-id="${escapeAttr(item.id)}">Unhide</button>
      </div>`;
  }).join("");
}
