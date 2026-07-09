const RAW_ITEMS = Array.isArray(window.TIBIA_ITEMS) ? window.TIBIA_ITEMS : [];
let items = normalizeItems(RAW_ITEMS);

const HIDDEN_STORAGE_KEY = "tibiaGearFinder.hiddenItems.v1";
const FINDER_EQUIPMENT_STORAGE_KEY = "tibiaGearFinder.selectedEquipment.v1";
const permanentlyHidden = loadPermanentHidden();
let temporarilyHidden = new Set();
let selectedEquipment = {};
let collapsedSlots = new Set();
let equipmentFallbackReasons = {};

const DEFAULT_RESULTS_PER_SLOT = 5;
const damageTypeIcons = {
  physical: "https://static.wikia.nocookie.net/tibia/images/3/37/Physical_Damage_Icon.gif/revision/latest?cb=20210531030930&path-prefix=en",
  fire: "https://static.wikia.nocookie.net/tibia/images/7/7a/Fire_Damage_Icon.gif/revision/latest?cb=20210531161622&path-prefix=en",
  ice: "https://static.wikia.nocookie.net/tibia/images/8/88/Freezing_Icon.gif/revision/latest?cb=20171122235520&path-prefix=en",
  energy: "https://static.wikia.nocookie.net/tibia/images/3/30/Electrified_Icon.gif/revision/latest?cb=20171122235453&path-prefix=en",
  earth: "https://static.wikia.nocookie.net/tibia/images/5/5e/Poisoned_Icon.gif/revision/latest?cb=20171123000012&path-prefix=en",
  death: "https://static.wikia.nocookie.net/tibia/images/9/9c/Cursed_Icon.gif/revision/latest?cb=20171122234722&path-prefix=en",
};
const generalResistanceTypes = ["physical", "fire", "ice", "energy", "earth", "holy", "death"];

const slots = ["weapon", "shield", "extra", "helmet", "armor", "legs", "boots", "ring", "amulet"];
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
  extra: "Extra",
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
    rules: (vocation, slot) => slot === "ring"
      ? [
          ["balancedWearableScore", "desc"],
          ["vocationDamageBoost", "desc"],
          ["effectivePhysicalDefense", "desc"],
          ["totalResistance", "desc"],
          ["weight", "asc"],
        ]
      : slot === "armor"
      ? [
          ["balancedArmorScore", "desc"],
          ["effectivePhysicalDefense", "desc"],
          ["totalResistance", "desc"],
          ["vocationDamageBoost", "desc"],
          ["weight", "asc"],
        ]
      : slot === "helmet"
      ? [
          ["vocationDamageBoost", "desc"],
          ["balancedWearableScore", "desc"],
          ["attributes.magicLevel", "desc"],
          ["effectivePhysicalDefense", "desc"],
          ["totalResistance", "desc"],
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
      : vocation === "paladin" && (slot === "weapon" || slot === "ammo")
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
      : vocation === "paladin"
        ? [
            ["balancedWearableScore", "desc"],
            ["attributes.distance", "desc"],
            ["vocationDamageBoost", "desc"],
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
  attack: {
    label: "Attack",
    rules: vocation => [
      ["vocationDamageBoost", "desc"],
      ["totalAttack", "desc"],
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
  attackPhysical: {
    label: "Physical attack",
    rules: [
      ["attack.physical", "desc"],
      ["vocationDamageBoost", "desc"],
      ["totalAttack", "desc"],
      ["attackMod", "desc"],
      ["hitPercent", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["totalResistance", "desc"],
      ["weight", "asc"],
    ],
  },
  attackFire: {
    label: "Fire attack",
    rules: [
      ["attack.fire", "desc"],
      ["vocationDamageBoost", "desc"],
      ["totalAttack", "desc"],
      ["attackMod", "desc"],
      ["hitPercent", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["totalResistance", "desc"],
      ["weight", "asc"],
    ],
  },
  attackIce: {
    label: "Ice attack",
    rules: [
      ["attack.ice", "desc"],
      ["vocationDamageBoost", "desc"],
      ["totalAttack", "desc"],
      ["attackMod", "desc"],
      ["hitPercent", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["totalResistance", "desc"],
      ["weight", "asc"],
    ],
  },
  attackEnergy: {
    label: "Energy attack",
    rules: [
      ["attack.energy", "desc"],
      ["vocationDamageBoost", "desc"],
      ["totalAttack", "desc"],
      ["attackMod", "desc"],
      ["hitPercent", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["totalResistance", "desc"],
      ["weight", "asc"],
    ],
  },
  attackEarth: {
    label: "Earth attack",
    rules: [
      ["attack.earth", "desc"],
      ["vocationDamageBoost", "desc"],
      ["totalAttack", "desc"],
      ["attackMod", "desc"],
      ["hitPercent", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["totalResistance", "desc"],
      ["weight", "asc"],
    ],
  },
  attackDeath: {
    label: "Death attack",
    rules: [
      ["attack.death", "desc"],
      ["vocationDamageBoost", "desc"],
      ["totalAttack", "desc"],
      ["attackMod", "desc"],
      ["hitPercent", "desc"],
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
  physicalResistance: {
    label: "Physical resistance",
    rules: [
      ["resistances.physical", "desc"],
      ["effectivePhysicalDefense", "desc"],
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
  earth: {
    label: "Earth resistance",
    rules: [
      ["resistances.earth", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
  holy: {
    label: "Holy resistance",
    rules: [
      ["resistances.holy", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
  death: {
    label: "Death resistance",
    rules: [
      ["resistances.death", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
  drown: {
    label: "Drown resistance",
    rules: [
      ["resistances.drown", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
  lifedrain: {
    label: "Life drain resistance",
    rules: [
      ["resistances.lifedrain", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
  manadrain: {
    label: "Mana drain resistance",
    rules: [
      ["resistances.manadrain", "desc"],
      ["effectivePhysicalDefense", "desc"],
      ["weight", "asc"],
    ],
  },
};

const priorityChecks = {
  balanced: () => true,
  light: item => toNumber(item.weight, 0) > 0,
  attack: (item, vocation) => getVocationDamageBoost(item, vocation) > 0 || getTotalAttack(item) > 0 || toNumber(item.attackMod, 0) > 0 || toNumber(item.hitPercent, 0) > 0 || toNumber(item.shotDamageAverage, 0) > 0,
  attackPhysical: (item, vocation) => isElementalAttackMatch(item, "physical", vocation),
  attackFire: (item, vocation) => isElementalAttackMatch(item, "fire", vocation),
  attackIce: (item, vocation) => isElementalAttackMatch(item, "ice", vocation),
  attackEnergy: (item, vocation) => isElementalAttackMatch(item, "energy", vocation),
  attackEarth: (item, vocation) => isElementalAttackMatch(item, "earth", vocation),
  attackDeath: (item, vocation) => isElementalAttackMatch(item, "death", vocation),
  range: item => toNumber(item.range, 0) > 0,
  armor: item => getEffectivePhysicalDefense(item) > 0 || toNumber(item.armor, 0) > 0 || toNumber(item.defense, 0) > 0,
  distance: item => toNumber(item.attributes?.distance, 0) > 0,
  magic: item => toNumber(item.attributes?.magicLevel, 0) > 0,
  speed: item => toNumber(item.attributes?.speed, 0) > 0,
  physical: item => getEffectivePhysicalDefense(item) > 0 || toNumber(item.resistances?.physical, 0) > 0,
  physicalResistance: item => toNumber(item.resistances?.physical, 0) > 0,
  fire: item => toNumber(item.resistances?.fire, 0) > 0,
  ice: item => toNumber(item.resistances?.ice, 0) > 0,
  energy: item => toNumber(item.resistances?.energy, 0) > 0,
  earth: item => toNumber(item.resistances?.earth, 0) > 0,
  holy: item => toNumber(item.resistances?.holy, 0) > 0,
  death: item => toNumber(item.resistances?.death, 0) > 0,
  drown: item => toNumber(item.resistances?.drown, 0) > 0,
  lifedrain: item => toNumber(item.resistances?.lifedrain, 0) > 0,
  manadrain: item => toNumber(item.resistances?.manadrain, 0) > 0,
};

const els = {
  vocation: document.querySelector("#vocation"),
  level: document.querySelector("#level"),
  mode: document.querySelector("#mode"),
  slot: document.querySelector("#slot"),
  slotLabel: document.querySelector("#slotLabel"),
  priority: document.querySelector("#priority"),
  prioritizeVocation: document.querySelector("#prioritizeVocation"),
  weaponType: document.querySelector("#weaponType"),
  twoHanded: document.querySelector("#twoHanded"),
  showDrops: document.querySelector("#showDrops"),
  handLabel: document.querySelector("#handLabel"),
  equipmentHover: document.querySelector("#equipmentHover"),
  equipmentPreview: document.querySelector("#equipmentPreview"),
  equipmentSummary: document.querySelector("#equipmentSummary"),
  results: document.querySelector("#results"),
  resultsTitle: document.querySelector("#resultsTitle"),
  resultLimit: document.querySelector("#resultLimit"),
  resultLimitValue: document.querySelector("#resultLimitValue"),
  summary: document.querySelector("#summary"),
  hiddenPanel: document.querySelector("#hiddenPanel"),
  hiddenList: document.querySelector("#hiddenList"),
  hiddenCount: document.querySelector("#hiddenCount"),
  clearHiddenButton: document.querySelector("#clearHiddenButton"),
  speedNavLink: document.querySelector(".site-nav-link[href^='speed-breakpoint.html']"),
  speedVocation: document.querySelector("#speedVocation"),
  speedLevel: document.querySelector("#speedLevel"),
  extraSpeed: document.querySelector("#extraSpeed"),
  speedTemporaryBoost: document.querySelector("#speedTemporaryBoost"),
  speedMounted: document.querySelector("#speedMounted"),
  useFinderEquipment: document.querySelector("#useFinderEquipment"),
  showLevelDeltas: document.querySelector("#showLevelDeltas"),
  speedManualEquipment: document.querySelector("#speedManualEquipment"),
  totalSpeed: document.querySelector("#totalSpeed"),
  speedSummary: document.querySelector("#speedSummary"),
  speedEquipmentSummary: document.querySelector("#speedEquipmentSummary"),
  speedBreakpointTable: document.querySelector("#speedBreakpointTable"),
};

function init() {
  if (els.results) {
    initFinder();
    return;
  }

  if (els.speedBreakpointTable) {
    initSpeedCalculator();
  }
}

function initFinder() {
  els.slot.innerHTML = slots.map(slot => `<option value="${slot}">${slotLabels[slot]}</option>`).join("");
  els.priority.innerHTML = Object.entries(priorities)
    .map(([key, value]) => `<option value="${key}">${value.label}</option>`)
    .join("");
  restoreFinderState();

  els.vocation.addEventListener("input", () => {
    renderWeaponTypeOptions(true);
    applyWeaponTypeHandDefaults(true);
    temporarilyHidden = new Set();
    render();
  });

  for (const el of [els.level, els.mode, els.slot, els.twoHanded, els.resultLimit, els.prioritizeVocation]) {
    el.addEventListener("input", () => {
      temporarilyHidden = new Set();
      render();
    });
  }

  els.priority.addEventListener("input", () => {
    selectedEquipment = {};
    temporarilyHidden = new Set();
    render();
  });

  els.showDrops.addEventListener("input", render);

  els.weaponType.addEventListener("input", () => {
    applyWeaponTypeHandDefaults(false);
    temporarilyHidden = new Set();
    render();
  });
  els.equipmentPreview.addEventListener("click", handleEquipmentPreviewClick);
  els.equipmentPreview.addEventListener("mouseover", handleEquipmentPreviewHover);
  els.equipmentPreview.addEventListener("focusin", handleEquipmentPreviewHover);
  els.equipmentPreview.addEventListener("mouseleave", clearEquipmentHover);
  els.equipmentPreview.addEventListener("focusout", clearEquipmentHover);
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
    duration: item.duration || "",
    charges: toNumber(item.charges, 0),
    imbuementSlots: toNumber(item.imbuementSlots, 0),
    attributes: item.attributes || {},
    resistances: item.resistances || {},
    droppedBy: normalizeDroppedBy(item.droppedBy),
    wikiUrl: item.wikiUrl || "",
    raw: item,
  };
  });
}

function normalizeDroppedBy(droppedBy) {
  if (!Array.isArray(droppedBy)) return [];
  const seen = new Set();
  const out = [];
  for (const source of droppedBy) {
    const name = String(source?.name || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      wikiUrl: source?.wikiUrl || "",
    });
  }
  return out;
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
    return getGeneralResistanceTotal(item);
  }
  if (path === "totalAttack") {
    return getTotalAttack(item);
  }
  if (path.startsWith("attack.")) {
    return getAttackByType(item, path.split(".")[1]);
  }
  if (path === "balancedShieldScore") {
    return getBalancedShieldScore(item, vocation);
  }
  if (path === "balancedArmorScore") {
    return getBalancedArmorScore(item, vocation);
  }
  if (path === "balancedWearableScore") {
    return getBalancedWearableScore(item, vocation);
  }
  if (path === "effectivePhysicalDefense") {
    return getEffectivePhysicalDefense(item);
  }
  if (path === "vocationDamageBoost") {
    return getVocationDamageBoost(item, vocation);
  }
  if (path === "vocationEquipmentPriority") {
    return getVocationEquipmentPriority(item, vocation);
  }
  if (path === "limitedChargePenalty") {
    return getLimitedChargePenalty(item);
  }
  return path.split(".").reduce((obj, key) => obj?.[key], item) ?? 0;
}

function getGeneralResistanceTotal(item) {
  return generalResistanceTypes.reduce((sum, key) => sum + toNumber(item.resistances?.[key], 0), 0);
}

function getTotalAttack(item) {
  if (Array.isArray(item.damageParts) && item.damageParts.length) {
    return item.damageParts.reduce((sum, part) => sum + toNumber(part.amount, 0), 0);
  }
  return Math.max(toNumber(item.attack, 0), toNumber(item.shotDamageAverage, 0));
}

function getAttackByType(item, type) {
  if (!type) return 0;
  const wanted = cleanKey(type);

  if (Array.isArray(item.damageParts) && item.damageParts.length) {
    return item.damageParts.reduce((sum, part) => {
      return cleanKey(part.type || "physical") === wanted ? sum + toNumber(part.amount, 0) : sum;
    }, 0);
  }

  const attack = toNumber(item.attack, 0);
  if (attack) {
    const itemType = cleanKey(item.damageType || "physical");
    return itemType === wanted ? attack : 0;
  }

  const shotDamage = toNumber(item.shotDamageAverage, 0);
  if (shotDamage) {
    const itemType = cleanKey(item.damageType || "");
    return itemType === wanted ? shotDamage : 0;
  }

  return 0;
}

function isElementalAttackMatch(item, type, vocation) {
  if (item.slot === "weapon" || item.slot === "ammo") {
    return getAttackByType(item, type) > 0;
  }

  return getVocationDamageBoost(item, vocation) > 0 && hasElementalAttackSource(type);
}

function hasElementalAttackSource(type) {
  return hasSelectedElementalAttackSource("weapon", type)
    || hasSelectedElementalAttackSource("ammo", type)
    || hasAvailableElementalAttackSource("weapon", type)
    || (getOffHandSlot() === "ammo" && hasAvailableElementalAttackSource("shield", type));
}

function hasSelectedElementalAttackSource(slot, type) {
  const selectedId = selectedEquipment[slot];
  if (!selectedId) return false;
  return getFiltered(slot === "ammo" ? "shield" : slot)
    .some(item => item.id === selectedId && getAttackByType(item, type) > 0);
}

function hasAvailableElementalAttackSource(slot, type) {
  const effectiveSlot = getEffectiveFilterSlot(slot);
  const filtered = getFiltered(slot);
  const selectedId = selectedEquipment[effectiveSlot];
  if (selectedId && filtered.some(item => item.id === selectedId)) return false;
  return filtered.some(item => getAttackByType(item, type) > 0);
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
  const totalResistance = getGeneralResistanceTotal(item);
  const vocationBoost = getVocationDamageBoost(item, vocation);
  const shielding = toNumber(item.attributes?.shielding, 0);
  const weight = toNumber(item.weight, 0);
  const chargePenalty = getLimitedChargePenalty(item);

  return physicalDefense
    + totalResistance * 0.6
    + vocationBoost * 4
    + shielding * 2
    - weight / 25
    - chargePenalty;
}

function getBalancedWearableScore(item, vocation) {
  const physicalDefense = getEffectivePhysicalDefense(item);
  const totalResistance = getGeneralResistanceTotal(item);
  const vocationBoost = getVocationDamageBoost(item, vocation);
  const secondaryBoost = getSecondaryGearBoost(item, vocation);
  const shielding = toNumber(item.attributes?.shielding, 0);
  const weight = toNumber(item.weight, 0);
  const isAmulet = item.slot === "amulet";
  const isRing = item.slot === "ring";
  const offenseWeight = isAmulet
    ? vocation === "paladin" || vocation === "monk" ? 6 : 5
    : isRing
      ? 4
    : vocation === "paladin" ? 5 : 4;
  const resistanceWeight = isAmulet
    ? 0.3
    : isRing
      ? 0.85
    : vocation === "paladin" ? 0.45 : 0.6;
  const chargePenalty = getLimitedChargePenalty(item);

  return physicalDefense
    + totalResistance * resistanceWeight
    + vocationBoost * offenseWeight
    + secondaryBoost
    + shielding * 2
    - weight / 25
    - chargePenalty;
}

function getBalancedArmorScore(item, vocation) {
  const physicalDefense = getEffectivePhysicalDefense(item);
  const totalResistance = getGeneralResistanceTotal(item);
  const vocationBoost = getVocationDamageBoost(item, vocation);
  const secondaryBoost = getSecondaryGearBoost(item, vocation);
  const shielding = toNumber(item.attributes?.shielding, 0);
  const weight = toNumber(item.weight, 0);
  const chargePenalty = getLimitedChargePenalty(item);

  if (vocation === "knight") {
    const physicalResistance = toNumber(item.resistances?.physical, 0);
    const elementalResistance = totalResistance - physicalResistance;
    return physicalDefense * 2
      + physicalResistance * 0.5
      + elementalResistance * 0.25
      + vocationBoost * 4
      + secondaryBoost
      + shielding * 2
      - weight / 50
      - chargePenalty;
  }

  return physicalDefense
    + totalResistance * 0.6
    + vocationBoost * 4
    + secondaryBoost
    + shielding * 2
    - weight / 25
    - chargePenalty;
}

function getLimitedChargePenalty(item) {
  const charges = toNumber(item.charges, 0);
  if (!charges || item.slot !== "amulet") return 0;
  if (charges <= 5) return 160;
  if (charges <= 10) return 80;
  if (charges <= 25) return 30;
  return 0;
}

function getSecondaryGearBoost(item, vocation) {
  const attrs = item.attributes || {};
  const imbuementSlots = toNumber(item.imbuementSlots, 0);
  let score = imbuementSlots * 2;

  if (vocation === "paladin" || vocation === "monk") {
    score += toNumber(attrs.magicLevel, 0) * 2;
  }

  return score;
}

function getVocationEquipmentPriority(item, vocation) {
  if (!vocation) return 0;
  const damageBoost = getVocationDamageBoost(item, vocation);
  const secondaryBoost = getSecondaryGearBoost(item, vocation);
  if (damageBoost > 0) return 3;
  if (secondaryBoost > 0) return 2;
  if (item.vocations?.includes(vocation) && hasMeaningfulGearStats(item)) return 1;
  return 0;
}

function hasMeaningfulGearStats(item) {
  return getEffectivePhysicalDefense(item) > 0
    || getGeneralResistanceTotal(item) !== 0
    || getTotalAttack(item) > 0
    || toNumber(item.attackMod, 0) !== 0
    || toNumber(item.hitPercent, 0) !== 0
    || toNumber(item.imbuementSlots, 0) > 0
    || Object.values(item.attributes || {}).some(value => toNumber(value, 0) !== 0);
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
    score += toNumber(item.imbuementSlots, 0) * 0.15;
  }

  return score;
}

function getSelectedWeaponType() {
  return els.weaponType?.value || "any";
}

function getSelectedHandMode() {
  return els.twoHanded?.checked ? "2" : "1";
}

function getOffHandSlot() {
  const weaponType = getSelectedWeaponType();
  return weaponType === "bow" || weaponType === "crossbow" ? "ammo" : "shield";
}

function getEffectiveFilterSlot(slot) {
  return slot === "shield" ? getOffHandSlot() : slot;
}

function getDisplaySlotLabel(slot) {
  if (slot === "shield" && getOffHandSlot() === "ammo") return slotLabels.ammo;
  return slotLabels[slot] || titleCase(slot);
}

function shouldPrioritizeVocationEquipment() {
  return els.prioritizeVocation?.checked !== false;
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
  const rules = typeof rawRules === "function" ? rawRules(vocation, slot) : rawRules;
  return shouldPrioritizeVocationEquipment()
    ? [["vocationEquipmentPriority", "desc"], ...rules]
    : rules;
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
  const effectiveSlot = getEffectiveFilterSlot(slot);
  const vocation = els.vocation.value;
  const level = toNumber(els.level.value, 0);
  const weaponType = getSelectedWeaponType();
  const handMode = getSelectedHandMode();

  return items.filter(item => {
    if (item.slot !== effectiveSlot) return false;
    if (!canUseItem(item, vocation, level)) return false;

    if (effectiveSlot === "weapon") {
      if (weaponType !== "any" && item.type !== weaponType) return false;
      if (!isAlwaysTwoHandedWeaponType(item.type) && shouldApplyHandFilter(item.type) && getItemHands(item) !== handMode) return false;
    }

    if (effectiveSlot === "ammo") {
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
  const previewEquipment = renderEquipmentPreview(priorityKey);
  const finderState = saveFinderEquipment(previewEquipment, { vocation, level, priorityKey });
  updateSpeedNavLink(finderState);
  renderHiddenItems();
  els.slotLabel.style.display = mode === "full" ? "none" : "grid";

  if (mode === "full") {
    els.resultsTitle.textContent = `Best full set`;
    els.summary.textContent = `${titleCase(vocation)}, level ${level}, prioritising ${priorities[priorityKey].label.toLowerCase()}.`;
    renderFullSet(priorityKey, resultLimit);
  } else {
    const slot = els.slot.value;
    els.resultsTitle.textContent = `Best ${getDisplaySlotLabel(slot).toLowerCase()}`;
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
  renderEquipmentSummary(equipment);
  if (randomBackpack) equipment.backpack = randomBackpack;
  const offHandSlot = getOffHandSlot();
  const offHandLabel = offHandSlot === "ammo" ? "Ammunition" : "Off-hand";
  const cells = [
    { key: "amulet", slot: "amulet", label: "Amulet" },
    { key: "helmet", slot: "helmet", label: "Helmet" },
    { key: "backpack", slot: "backpack", label: "Backpack" },
    { key: "weapon", slot: "weapon", label: "Weapon" },
    { key: "armor", slot: "armor", label: "Armor" },
    { key: "shield", slot: offHandSlot, actionSlot: "shield", label: offHandLabel },
    { key: "ring", slot: "ring", label: "Ring" },
    { key: "legs", slot: "legs", label: "Legs" },
    { key: "ammo", slot: "extra", label: "Extra" },
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
      return `<div class="equipment-slot equipment-${cell.key}" aria-label="${escapeAttr(label)}">${content}</div>`;
    }
    const actionSlot = cell.actionSlot || cell.slot;
    const selectedClass = selectedEquipment[cell.slot] === item?.id ? " selected-equipment" : "";
    const fallbackReason = equipmentFallbackReasons[cell.slot] || "";
    const fallbackClass = fallbackReason ? " priority-fallback-equipment" : "";
    const fallbackAttrs = fallbackReason ? ` title="${escapeAttr(fallbackReason)}"` : "";
    const ariaLabel = fallbackReason ? `${label}. ${fallbackReason}` : label;
    const itemId = item ? ` data-item-id="${escapeAttr(item.id)}"` : "";
    return `<button class="equipment-slot equipment-${cell.key}${selectedClass}${fallbackClass}" type="button" data-slot="${escapeAttr(actionSlot)}"${itemId} aria-label="${escapeAttr(ariaLabel)}"${fallbackAttrs}>${content}</button>`;
  }).join("");
  clearEquipmentHover();
  return equipment;
}

function renderEquipmentHoverCard(item) {
  if (!item) {
    return "";
  }
  const stats = buildStats(item);
  const drops = renderDropSources(item);
  const imageUrl = safeImageUrl(item.imageUrl);
  const meta = [
    item.type ? titleCase(item.type) : titleCase(item.slot),
    `Level ${item.level || "none"}`,
    item.vocations.length ? item.vocations.map(titleCase).join(", ") : "Any vocation",
  ].join(" • ");
  const image = imageUrl
    ? `<img class="item-image" src="${escapeAttr(imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<div class="item-image placeholder" aria-hidden="true">?</div>`;

  return `
    <span class="equipment-hover-card">
      <span class="item-card-head">${image}<span><strong>${escapeHtml(item.name)}</strong><span class="meta">${escapeHtml(meta)}</span></span></span>
      <span class="stats">${stats.map(renderStatPill).join("")}</span>
      <span class="reason">${drops}</span>
    </span>`;
}

function renderEquipmentHoverItem(item) {
  if (!els.equipmentHover) return;
  if (!item) {
    clearEquipmentHover();
    return;
  }
  els.equipmentHover.innerHTML = renderEquipmentHoverCard(item);
  els.equipmentHover.classList.add("active");
}

function handleEquipmentPreviewHover(event) {
  const slot = event.target.closest(".equipment-slot[data-item-id]");
  if (!slot || !els.equipmentPreview.contains(slot)) return;
  const item = items.find(candidate => candidate.id === slot.dataset.itemId);
  renderEquipmentHoverItem(item);
}

function clearEquipmentHover() {
  if (!els.equipmentHover) return;
  els.equipmentHover.innerHTML = "";
  els.equipmentHover.classList.remove("active");
}

function renderEquipmentSummary(equipment) {
  if (!els.equipmentSummary) return;
  const totals = getEquipmentTotals(equipment);
  const pills = buildEquipmentSummaryPills(totals);
  els.equipmentSummary.innerHTML = pills.length
    ? pills.map(renderSummaryPill).join("")
    : `<span class="summary-empty">No totals</span>`;
}

function getEquipmentTotals(equipment) {
  const totals = {
    armor: 0,
    defense: 0,
    attackParts: {},
    imbuementSlots: 0,
    attributes: {},
    resistances: {},
  };

  for (const item of Object.values(equipment || {})) {
    if (!item) continue;
    totals.armor += toNumber(item.armor, 0);
    addEquipmentAttackTotal(totals, item);
    totals.imbuementSlots += toNumber(item.imbuementSlots, 0);

    for (const [key, value] of Object.entries(item.attributes || {})) {
      totals.attributes[key] = (totals.attributes[key] || 0) + toNumber(value, 0);
    }
    for (const [key, value] of Object.entries(item.resistances || {})) {
      const n = toNumber(value, 0);
      if (n) {
        if (!totals.resistances[key]) totals.resistances[key] = [];
        totals.resistances[key].push(n);
      }
    }
  }

  totals.defense = getEquipmentDefense(equipment);
  return totals;
}

function addEquipmentAttackTotal(totals, item) {
  if (Array.isArray(item.damageParts) && item.damageParts.length) {
    for (const part of item.damageParts) {
      const type = part.type || "physical";
      totals.attackParts[type] = (totals.attackParts[type] || 0) + toNumber(part.amount, 0);
    }
    return;
  }

  const attack = toNumber(item.attack, 0);
  if (!attack) return;
  const type = item.damageType || "physical";
  totals.attackParts[type] = (totals.attackParts[type] || 0) + attack;
}

function getEquipmentDefense(equipment) {
  const weapon = equipment?.weapon;
  const offHand = equipment?.shield;
  const weaponDefenseMod = toNumber(weapon?.defenseMod, 0);

  if (offHand) {
    return toNumber(offHand.defense, 0)
      + toNumber(offHand.defenseMod, 0)
      + weaponDefenseMod;
  }

  return toNumber(weapon?.defense, 0) + weaponDefenseMod;
}

function buildEquipmentSummaryPills(totals) {
  const pills = [];
  const add = (label, value, suffix = "") => {
    const n = toNumber(value, 0);
    if (n) pills.push(`${label} ${fmtSigned(n)}${suffix}`);
  };
  const addResistance = key => {
    const effective = getStackedResistance(totals.resistances[key]);
    if (effective) {
      pills.push({
        text: `${prettyStat(key)} ${fmtSignedDecimal(effective)}%`,
        iconUrl: damageTypeIcons[key],
      });
    }
  };
  const addPlain = (label, value) => {
    const n = toNumber(value, 0);
    if (n) pills.push(`${label} ${n}`);
  };

  for (const key of ["physical", "fire", "ice", "energy", "earth", "holy", "death"]) {
    const attack = toNumber(totals.attackParts[key], 0);
    if (attack) {
      pills.push(buildElementalAttackPill(key, attack));
    }
  }
  addPlain("Arm", totals.armor);
  addPlain("Def", totals.defense);
  addPlain("Imbues", totals.imbuementSlots);

  for (const key of ["distance", "magicLevel", "fist", "sword", "axe", "club", "shielding", "speed"]) {
    add(prettyStat(key), totals.attributes[key]);
  }

  for (const key of ["physical", "fire", "ice", "energy", "earth", "holy", "death", "drown", "lifedrain", "manadrain"]) {
    addResistance(key);
  }

  return pills;
}

function getStackedResistance(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const damageTaken = values.reduce((remaining, value) => remaining * (1 - toNumber(value, 0) / 100), 1);
  return (1 - damageTaken) * 100;
}

function fmtSignedDecimal(value) {
  const n = Math.abs(value) < 0.05 ? 0 : value;
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return rounded > 0 ? `+${text}` : text;
}

function renderSummaryPill(pill) {
  if (typeof pill === "string") return `<span class="summary-pill">${escapeHtml(pill)}</span>`;
  const icon = pill.iconUrl
    ? `<img class="summary-icon" src="${escapeAttr(pill.iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : "";
  const label = pill.label || pill.title || pill.text || "";
  const title = label ? ` title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"` : "";
  return `<span class="summary-pill"${title}>${icon}${escapeHtml(pill.text || "")}</span>`;
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
  const previewSlots = ["amulet", "helmet", "extra", "weapon", "armor", "shield", "ring", "legs", "boots"];
  const equipment = {};
  equipmentFallbackReasons = {};
  for (const slot of previewSlots) {
    if (!shouldShowPreviewSlot(slot)) continue;
    const effectiveSlot = getEffectiveFilterSlot(slot);
    const filtered = getFiltered(slot);
    const selected = filtered.find(item => item.id === selectedEquipment[effectiveSlot]);
    if (selected) {
      equipment[effectiveSlot] = selected;
      continue;
    }
    const { ranked, hasPriorityMatch } = getRankedForSlot(filtered, priorityKey, 1);
    if (ranked[0]) {
      equipment[effectiveSlot] = ranked[0];
      const fallbackReason = hasPriorityMatch
        ? getItemFallbackReason(ranked[0], slot, priorityKey, hasPriorityMatch)
        : `No ${getDisplaySlotLabel(slot).toLowerCase()} matched ${priorities[priorityKey]?.label.toLowerCase() || "that"} priority, so this is ranked by balanced stats.`;
      if (fallbackReason) equipmentFallbackReasons[effectiveSlot] = fallbackReason;
    }
  }
  return equipment;
}

function pickRandomBackpack() {
  const backpacks = items.filter(item => item.slot === "backpack" && safeImageUrl(item.imageUrl));
  const source = backpacks.length ? backpacks : fallbackBackpacks;
  return source[Math.floor(Math.random() * source.length)] || null;
}

function shouldShowPreviewSlot(slot) {
  if (slot === "shield") return getOffHandSlot() === "ammo" || getSelectedHandMode() !== "2";
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
  const slots = ["weapon"];

  if (getOffHandSlot() === "ammo" || getSelectedHandMode() !== "2") {
    slots.push("shield");
  }

  slots.push("amulet", "helmet", "armor", "legs", "boots", "ring", "extra");
  return slots;
}

function getRankedForSlot(sourceItems, priorityKey, limit) {
  const vocation = els.vocation.value;
  const checker = priorityChecks[priorityKey] || priorityChecks.balanced;
  const priorityIsAlwaysUseful = isAlwaysUsefulPriority(priorityKey);
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
    ranked: rankItems(sourceItems, "balanced", vocation).slice(0, limit),
    hasPriorityMatch: false,
  };
}

function renderSlot(slot, ranked, compact, priorityKey, hasPriorityMatch) {
  const sectionId = getSlotSectionId(slot);
  const effectiveSlot = getEffectiveFilterSlot(slot);
  const hasManualSelection = !!selectedEquipment[effectiveSlot];
  const collapsed = collapsedSlots.has(slot);
  const title = renderSlotTitle(slot, collapsed);
  if (ranked.length === 0 && hasPriorityMatch) {
    const body = collapsed ? "" : `<p class="empty">No usable ${getDisplaySlotLabel(slot).toLowerCase()} found for these filters.</p>`;
    return `<article id="${sectionId}" class="slot-group${collapsed ? " collapsed" : ""}">${title}${body}</article>`;
  }

  if (ranked.length === 0) {
    const unavailableCard = hasPriorityMatch
      ? ""
      : renderUnavailablePriorityCard(slot, priorityKey, compact);
    const body = collapsed ? "" : `<div class="card-grid">${unavailableCard}</div>`;
    return `<article id="${sectionId}" class="slot-group${collapsed ? " collapsed" : ""}">${title}${body}</article>`;
  }

  const unavailableCard = hasPriorityMatch
    ? ""
    : renderUnavailablePriorityCard(slot, priorityKey, compact);
  const fallbackReason = hasPriorityMatch || hasManualSelection
    ? ""
    : `No ${getDisplaySlotLabel(slot).toLowerCase()} matched ${priorities[priorityKey]?.label.toLowerCase() || "that"} priority, so this is ranked by balanced stats.`;
  const cards = ranked.map((item, index) => {
    const itemFallbackReason = hasPriorityMatch
      ? ""
      : index === 0 ? fallbackReason : "";
    const cardIndex = hasPriorityMatch ? index : index + 1;
    return renderItemCard(item, cardIndex, compact, { fallbackReason: itemFallbackReason });
  }).join("");
  const body = collapsed ? "" : `<div class="card-grid">${unavailableCard}${cards}</div>`;
  return `<article id="${sectionId}" class="slot-group${collapsed ? " collapsed" : ""}">${title}${body}</article>`;
}

function getItemFallbackReason(item, slot, priorityKey, hasPriorityMatch) {
  if (!hasPriorityMatch || isAlwaysUsefulPriority(priorityKey)) return "";
  const checker = priorityChecks[priorityKey] || priorityChecks.balanced;
  if (checker(item, els.vocation.value)) return "";
  const slotLabel = getDisplaySlotLabel(slot).toLowerCase();
  const priorityLabel = priorities[priorityKey]?.label.toLowerCase() || "selected";
  return `This ${slotLabel} does not match ${priorityLabel} priority, so it was added as a balanced fallback.`;
}

function isAlwaysUsefulPriority(priorityKey) {
  return priorityKey === "balanced" || priorityKey === "light";
}

function renderSlotTitle(slot, collapsed) {
  const label = getDisplaySlotLabel(slot);
  const icon = collapsed ? "+" : "-";
  const action = collapsed ? "Expand" : "Minimise";
  return `
    <div class="slot-title">
      <h3>${escapeHtml(label)}</h3>
      <button class="slot-collapse-button" type="button" data-action="toggle-slot" data-slot="${escapeAttr(slot)}" aria-expanded="${collapsed ? "false" : "true"}" aria-label="${action} ${escapeAttr(label)}" title="${action} ${escapeAttr(label)}">${icon}</button>
    </div>`;
}

function getSlotSectionId(slot) {
  return `results-${cleanKey(slot)}`;
}

function renderUnavailablePriorityCard(slot, priorityKey, compact) {
  const priorityLabel = priorities[priorityKey]?.label || "that priority";
  const slotLabel = getDisplaySlotLabel(slot).toLowerCase();
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

function renderItemCard(item, index, compact, options = {}) {
  const stats = buildStats(item);
  const drops = shouldShowDropSources() ? renderDropSources(item) : "";
  const imageUrl = safeImageUrl(item.imageUrl);
  const wikiUrl = safeWikiUrl(item.wikiUrl);
  const isSelected = selectedEquipment[item.slot] === item.id;
  const fallbackReason = options.fallbackReason || "";
  const meta = [
    item.type ? titleCase(item.type) : titleCase(item.slot),
    `Level ${item.level || "none"}`,
    item.vocations.length ? item.vocations.map(titleCase).join(", ") : "Any vocation",
  ].join(" • ");
  const fallbackAttrs = fallbackReason ? ` title="${escapeAttr(fallbackReason)}" aria-label="${escapeAttr(fallbackReason)}"` : "";
  const fallbackClass = fallbackReason ? " priority-fallback-image" : "";
  const fallbackCardClass = fallbackReason ? " priority-fallback-card" : "";
  const fallbackCardAttrs = fallbackReason ? ` title="${escapeAttr(fallbackReason)}"` : "";
  const image = imageUrl
    ? `<img class="item-image${fallbackClass}" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" referrerpolicy="no-referrer"${fallbackAttrs}>`
    : `<div class="item-image placeholder${fallbackClass}" aria-hidden="true"${fallbackAttrs}>?</div>`;
  return `
    <article class="item-card ${index === 0 ? "best" : ""} ${isSelected ? "selected" : ""}${fallbackCardClass}" data-item-id="${escapeAttr(item.id)}"${fallbackCardAttrs}>
      <div class="item-card-head">${image}<div><h3>${index === 0 ? "★ " : ""}${escapeHtml(item.name)}</h3><div class="meta">${escapeHtml(meta)}</div></div></div>
      <div class="stats">${stats.map(renderStatPill).join("")}</div>
      ${drops ? `<p class="reason">${drops}</p>` : ""}
      <div class="card-actions">
        ${wikiUrl ? `<a href="${escapeAttr(wikiUrl)}" target="_blank" rel="noopener noreferrer">Open wiki page</a>` : ""}
        <button class="icon-button secondary-button" type="button" data-action="temp-hide" data-id="${escapeAttr(item.id)}" title="Hide for this search" aria-label="Hide ${escapeAttr(item.name)} for this search">👁</button>
        <button class="icon-button danger-button" type="button" data-action="perm-hide" data-id="${escapeAttr(item.id)}" title="Hide permanently" aria-label="Hide ${escapeAttr(item.name)} permanently">🗑</button>
      </div>
    </article>`;
}

function shouldShowDropSources() {
  return els.showDrops?.checked !== false;
}

function renderDropSources(item) {
  const sources = item.droppedBy || [];
  if (!sources.length) {
    return "Dropped by: Nothing unless the wiki isn't up to date. Might be purchasable or from a quest.";
  }

  return `Dropped by ${sources.map(source => {
    const url = safeWikiUrl(source.wikiUrl);
    const name = escapeHtml(source.name);
    return url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${name}</a>` : name;
  }).join(", ")}.`;
}

function renderStatPill(stat) {
  if (typeof stat === "string") return `<span class="pill">${escapeHtml(stat)}</span>`;
  const icon = stat.iconUrl
    ? `<img class="stat-icon" src="${escapeAttr(stat.iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : "";
  const label = stat.label || stat.title || stat.text || "";
  const title = label ? ` title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"` : "";
  const iconOnlyClass = stat.iconUrl && !stat.text ? " icon-only-pill" : "";
  return `<span class="pill stat-pill${iconOnlyClass}"${title}>${icon}${escapeHtml(stat.text || "")}</span>`;
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
  if (item.damageType && !item.attack && !(item.damageParts || []).length) out.push(buildElementalAttackPill(item.damageType));
  if (item.manaPerShot) out.push(`Mana ${item.manaPerShot}`);
  if (item.duration) out.push(`Duration ${item.duration}`);
  if (item.charges) out.push(`${item.charges} charge${item.charges === 1 ? "" : "s"}`);
  if (item.imbuementSlots) out.push(`${item.imbuementSlots} imbue slot${item.imbuementSlots === 1 ? "" : "s"}`);
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
  if (Array.isArray(item.damageParts) && item.damageParts.length) {
    for (const part of item.damageParts) {
      out.push(buildElementalAttackPill(part.type, part.amount, part.iconUrl));
    }
  } else if (item.attack) {
    if (item.damageType) {
      out.push(buildElementalAttackPill(item.damageType, item.attack));
    } else {
      out.push(`Atk ${item.attack}`);
    }
  }
  if (item.attackMod) out.push(`Atk mod ${fmtSigned(item.attackMod)}`);
}

function buildElementalAttackPill(type, value = 0, iconUrl = "") {
  const key = cleanKey(type || "");
  const n = toNumber(value, 0);
  const label = `${prettyStat(key || "elemental")} attack${n ? ` ${n}` : ""}`;
  return {
    text: n ? `Atk ${n}` : "",
    iconUrl: iconUrl || damageTypeIcons[key],
    label,
  };
}

function fmtSigned(value) {
  const n = toNumber(value, 0);
  return n > 0 ? `+${n}` : String(n);
}

function prettyStat(key) {
  const labels = { magicLevel: "Magic level", lifeDrain: "Life drain", manaDrain: "Mana drain", lifedrain: "Life drain", manadrain: "Mana drain" };
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
  return url.hostname === "static.wikia.nocookie.net" || url.hostname === "www.tibiawiki.com.br" ? url.href : "";
}

function safeWikiUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return "";
  const allowedHost = url.hostname === "tibia.fandom.com" || url.hostname === "www.tibiawiki.com.br";
  return allowedHost && url.pathname.startsWith("/wiki/") ? url.href : "";
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

function saveFinderEquipment(equipment, settings) {
  try {
    const state = buildFinderState(equipment, settings);
    localStorage.setItem(FINDER_EQUIPMENT_STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    // Local storage is optional; the calculator can still run manually.
    return buildFinderState(equipment, settings);
  }
}

function buildFinderState(equipment, settings) {
  const ids = {};
  for (const [slot, item] of Object.entries(equipment || {})) {
    if (item?.id && slot !== "backpack") ids[slot] = item.id;
  }
  return {
    ids,
    selectedIds: { ...selectedEquipment },
    vocation: settings?.vocation || "",
    level: toNumber(settings?.level, 0),
    priority: settings?.priorityKey || "",
    mode: els.mode?.value || "full",
    slot: els.slot?.value || "weapon",
    resultLimit: getSelectedResultLimit(),
    weaponType: els.weaponType?.value || "",
    twoHanded: !!els.twoHanded?.checked,
    prioritizeVocation: shouldPrioritizeVocationEquipment(),
    showDrops: els.showDrops?.checked !== false,
    savedAt: new Date().toISOString(),
  };
}

function updateSpeedNavLink(state) {
  if (!els.speedNavLink || !state) return;
  const encoded = encodeFinderState(state);
  els.speedNavLink.href = encoded ? `speed-breakpoint.html?finder=${encoded}` : "speed-breakpoint.html";
}

function encodeFinderState(state) {
  try {
    return encodeURIComponent(btoa(JSON.stringify(state)));
  } catch {
    return "";
  }
}

function restoreFinderState() {
  const state = loadFinderEquipment();
  const storedSelectedIds = state.selectedIds && typeof state.selectedIds === "object" ? state.selectedIds : null;
  const storedEquipmentIds = state.ids && typeof state.ids === "object" ? state.ids : {};
  const selectedIds = storedSelectedIds || storedEquipmentIds;
  selectedEquipment = {};
  for (const [slot, id] of Object.entries(selectedIds)) {
    if ((slots.includes(slot) || slot === "ammo") && items.some(item => item.id === id)) {
      selectedEquipment[slot] = id;
    }
  }

  setControlValue(els.vocation, state.vocation);
  renderWeaponTypeOptions(true);
  setControlValue(els.level, state.level);
  setControlValue(els.mode, state.mode);
  setControlValue(els.slot, state.slot);
  setControlValue(els.priority, state.priority);
  setControlValue(els.resultLimit, state.resultLimit);
  setControlValue(els.weaponType, state.weaponType);

  if (typeof state.twoHanded === "boolean") {
    els.twoHanded.checked = state.twoHanded;
    updateHandControlVisibility();
  } else {
    applyWeaponTypeHandDefaults(true);
  }

  if (typeof state.showDrops === "boolean") {
    els.showDrops.checked = state.showDrops;
  }

  if (typeof state.prioritizeVocation === "boolean") {
    els.prioritizeVocation.checked = state.prioritizeVocation;
  }
}

function setControlValue(control, value) {
  if (!control || value === undefined || value === null || value === "") return;
  const nextValue = String(value);
  if (control.tagName === "SELECT") {
    const hasOption = [...control.options].some(option => option.value === nextValue);
    if (!hasOption) return;
  }
  control.value = nextValue;
}

function handleResultClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    if (event.target.closest("a")) return;
    const card = event.target.closest(".item-card[data-item-id]");
    if (!card || !els.results.contains(card)) return;
    const item = items.find(candidate => candidate.id === card.dataset.itemId);
    if (!item) return;
    if (selectedEquipment[item.slot] === item.id) {
      delete selectedEquipment[item.slot];
    } else {
      selectedEquipment[item.slot] = item.id;
    }
    render();
    return;
  }

  if (button.dataset.action === "toggle-slot") {
    const slot = button.dataset.slot;
    if (!slot) return;
    if (collapsedSlots.has(slot)) {
      collapsedSlots.delete(slot);
    } else {
      collapsedSlots.add(slot);
    }
    render();
    return;
  }

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

const speedBreakpoints = [
  {
    label: "Peninsula Tomb maze",
    friction: 70,
    thresholds: [null, null, null, null, null, null, null, null, null, null, null, null, 111, 142, 200, 342, 1070],
  },
  {
    label: "Drawbridges",
    friction: 90,
    thresholds: [null, null, null, null, null, null, null, null, null, null, null, 120, 147, 192, 278, 499, 1842],
  },
  {
    label: "Tile with 95 friction",
    friction: 95,
    thresholds: [null, null, null, null, null, null, null, null, null, null, null, 127, 157, 205, 299, 543, 2096],
  },
  {
    label: "Cobbled, stone and marble",
    friction: 100,
    thresholds: [null, null, null, null, null, null, null, null, null, null, 113, 135, 167, 219, 321, 592, 2382],
  },
  {
    label: "Dirt (Light)",
    friction: 110,
    thresholds: [null, null, null, null, null, null, null, null, null, null, 126, 150, 187, 248, 367, 696, 3060],
  },
  {
    label: "Hive, Rotten Wasteland",
    friction: 125,
    thresholds: [null, null, null, null, null, null, null, null, null, null, 146, 175, 219, 293, 444, 876, 4419],
  },
  {
    label: "Dirt (Medium)",
    friction: 140,
    thresholds: [null, null, null, null, null, null, null, 111, 125, 143, 167, 201, 254, 344, 531, 1092, 6341],
  },
  {
    label: "Grass, gravel and rift floors",
    friction: 150,
    thresholds: [null, null, null, null, null, null, null, 120, 135, 155, 181, 219, 278, 380, 595, 1258, 8036],
  },
  {
    label: "Sand and snow",
    friction: 160,
    thresholds: [null, null, null, null, null, null, 116, 129, 145, 167, 196, 238, 304, 419, 663, 1443, 10167],
  },
  {
    label: "Dirt (Heavy)",
    friction: 200,
    thresholds: [null, null, null, 114, 124, 135, 149, 167, 190, 219, 261, 322, 419, 597, 998, 2444, 25761],
  },
  {
    label: "Underwater",
    friction: 250,
    thresholds: [117, 126, 135, 146, 160, 175, 195, 220, 252, 295, 356, 446, 598, 884, 1591, 4557, 81351],
  },
];

const movementMsByBreakpoint = [850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100, 50];
const speedManualSlots = ["boots", "armor", "legs", "shield", "extra", "ring", "amulet"];
const speedTemporaryBoostOptions = [
  { id: "", label: "None", percent: 0 },
  { id: "haste", label: "Haste (Utani Hur)", type: "spell", percent: 30 },
  { id: "strong-haste", label: "Strong Haste (Druid/Sorcerer)", type: "spell", percent: 70, vocations: ["druid", "sorcerer"] },
  { id: "charge", label: "Charge (Knight)", type: "spell", percent: 90, vocations: ["knight"] },
  { id: "swift-foot", label: "Swift Foot (Paladin)", type: "spell", percent: 80, vocations: ["paladin"] },
  { id: "adrenaline-burst", label: "Adrenaline Burst", type: "charm", percent: 150 },
  { id: "demonic-candy-ball", label: "Demonic Candy Ball speed roll", type: "food", speed: 50 },
  { id: "chilli-con-carniphila", label: "Chilli Con Carniphila", type: "food", speed: 80 },
  { id: "filled-jalapeno-peppers", label: "Filled Jalapeno Peppers", type: "food", speed: 100 },
];
function initSpeedCalculator() {
  const finderState = loadFinderEquipment();
  if (finderState && Object.keys(finderState).length) {
    saveLoadedFinderState(finderState);
  }
  if (finderState?.vocation) setControlValue(els.speedVocation, finderState.vocation);
  if (finderState?.level) els.speedLevel.value = String(finderState.level);
  renderSpeedBonusOptions();
  renderSpeedManualEquipment();

  for (const el of [els.speedVocation, els.speedLevel]) {
    el?.addEventListener("input", () => {
      renderSpeedBonusOptions();
      renderSpeedManualEquipment();
      renderSpeedCalculator();
    });
  }
  for (const el of [els.extraSpeed, els.speedTemporaryBoost, els.speedMounted, els.useFinderEquipment, els.showLevelDeltas]) {
    el?.addEventListener("input", renderSpeedCalculator);
  }
  els.speedManualEquipment?.addEventListener("input", renderSpeedCalculator);
  window.addEventListener("storage", event => {
    if (event.key === FINDER_EQUIPMENT_STORAGE_KEY && els.useFinderEquipment?.checked) {
      renderSpeedCalculator();
    }
  });

  renderSpeedCalculator();
}

function renderSpeedBonusOptions() {
  renderSpeedSelectOptions(els.speedTemporaryBoost, getAvailableSpeedTemporaryBoostOptions());
}

function renderSpeedSelectOptions(select, options) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = options.map(option => {
    const suffix = option.percent ? ` (+${option.percent}%)` : option.speed ? ` (${fmtSigned(option.speed)})` : "";
    return `<option value="${escapeAttr(option.id)}">${escapeHtml(option.label + suffix)}</option>`;
  }).join("");
  select.value = options.some(option => option.id === current) ? current : "";
}

function getAvailableSpeedTemporaryBoostOptions() {
  const vocation = getSpeedVocation();
  return speedTemporaryBoostOptions.filter(option => !option.vocations || option.vocations.includes(vocation));
}

function renderSpeedManualEquipment() {
  if (!els.speedManualEquipment) return;
  const vocation = getSpeedVocation();
  const level = Math.max(1, toNumber(els.speedLevel?.value, 1));
  const speedItems = items.filter(item => toNumber(item.attributes?.speed, 0) !== 0 && canUseItem(item, vocation, level));
  els.speedManualEquipment.innerHTML = `
    <div class="speed-manual-head">
      <h2>Manual speed gear</h2>
      <p>Used when finder gear is off. Filtered for ${escapeHtml(titleCase(vocation))}, level ${level.toLocaleString()}.</p>
    </div>
    <div class="speed-manual-grid">
      ${speedManualSlots.map(slot => renderSpeedSlotSelect(slot, speedItems)).join("")}
    </div>`;
}

function renderSpeedSlotSelect(slot, speedItems) {
  const slotItems = speedItems
    .filter(item => item.slot === slot)
    .sort((a, b) => toNumber(b.attributes?.speed, 0) - toNumber(a.attributes?.speed, 0) || a.name.localeCompare(b.name));
  return `
    <label>
      ${escapeHtml(slotLabels[slot] || titleCase(slot))}
      <select data-speed-slot="${escapeAttr(slot)}">
        <option value="">None</option>
        ${slotItems.map(item => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)} (${fmtSigned(item.attributes.speed)})</option>`).join("")}
      </select>
    </label>`;
}

function renderSpeedCalculator() {
  const level = Math.max(1, toNumber(els.speedLevel?.value, 1));
  const vocation = getSpeedVocation();
  const baseSpeed = getBaseCharacterSpeed(level);
  const extraSpeed = toNumber(els.extraSpeed?.value, 0);
  const temporaryBoostSpeed = getSelectedTemporaryBoostSpeed(baseSpeed);
  const mountSpeed = els.speedMounted?.checked ? 10 : 0;
  const usingFinder = els.useFinderEquipment?.checked !== false;
  const equipment = usingFinder ? getFinderEquipmentItems() : getManualSpeedEquipmentItems();
  const equipmentSpeed = getEquipmentSpeed(equipment);
  const totalSpeed = baseSpeed + equipmentSpeed + temporaryBoostSpeed + mountSpeed + extraSpeed;

  if (els.speedManualEquipment) {
    els.speedManualEquipment.style.display = usingFinder ? "none" : "block";
  }
  els.totalSpeed.textContent = totalSpeed.toLocaleString();
  els.speedSummary.textContent = `${titleCase(vocation)}, level ${level.toLocaleString()} base ${baseSpeed.toLocaleString()} + equipment ${fmtSigned(equipmentSpeed)} + temporary ${fmtSigned(temporaryBoostSpeed)} + mount ${fmtSigned(mountSpeed)} + extra ${fmtSigned(extraSpeed)}.`;
  renderSpeedEquipmentSummary(equipment, usingFinder);
  renderSpeedBreakpointTable(totalSpeed);
}

function getSelectedTemporaryBoostSpeed(baseSpeed) {
  const boost = speedTemporaryBoostOptions.find(option => option.id === els.speedTemporaryBoost?.value);
  if (boost?.percent) return Math.floor(Math.max(0, baseSpeed - 40) * boost.percent / 100);
  return toNumber(boost?.speed, 0);
}

function getBaseCharacterSpeed(level) {
  return 220 + (Math.max(1, level) - 1) * 2;
}

function getEquivalentLevel(speed) {
  return Math.max(1, Math.floor((toNumber(speed, 220) - 220) / 2) + 1);
}

function loadFinderEquipment() {
  const urlState = loadFinderEquipmentFromUrl();
  if (urlState) return urlState;
  try {
    const parsed = JSON.parse(localStorage.getItem(FINDER_EQUIPMENT_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadFinderEquipmentFromUrl() {
  try {
    const encoded = new URLSearchParams(window.location.search).get("finder");
    if (!encoded) return null;
    const parsed = JSON.parse(atob(decodeURIComponent(encoded)));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveLoadedFinderState(state) {
  try {
    localStorage.setItem(FINDER_EQUIPMENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // URL-provided finder state is enough for this page load.
  }
}

function getSpeedVocation() {
  return els.speedVocation?.value || loadFinderEquipment().vocation || "knight";
}

function getFinderEquipmentItems() {
  const finderState = loadFinderEquipment();
  const ids = finderState.ids || {};
  return Object.values(ids)
    .map(id => items.find(item => item.id === id))
    .filter(Boolean);
}

function getManualSpeedEquipmentItems() {
  if (!els.speedManualEquipment) return [];
  return [...els.speedManualEquipment.querySelectorAll("[data-speed-slot]")]
    .map(select => items.find(item => item.id === select.value))
    .filter(Boolean);
}

function getEquipmentSpeed(equipment) {
  return (equipment || []).reduce((sum, item) => sum + toNumber(item.attributes?.speed, 0), 0);
}

function renderSpeedEquipmentSummary(equipment, usingFinder) {
  if (!els.speedEquipmentSummary) return;
  const finderState = loadFinderEquipment();
  const source = usingFinder
    ? `Finder gear${finderState.savedAt ? ` saved ${formatSavedTime(finderState.savedAt)}` : ""}`
    : "Manual gear";
  const speedItems = (equipment || []).filter(item => toNumber(item.attributes?.speed, 0) !== 0);
  const visibleItems = usingFinder ? (equipment || []) : speedItems;
  els.speedEquipmentSummary.innerHTML = `
    <div class="speed-source">${escapeHtml(source)}</div>
    ${visibleItems.length
      ? `<div class="speed-gear-list">${visibleItems.map(renderSpeedGearPill).join("")}</div>`
      : `<p class="muted-text">No equipment selected.</p>`}
    ${visibleItems.length && !speedItems.length ? `<p class="muted-text speed-note">Selected equipment has no speed bonuses.</p>` : ""}`;
}

function renderSpeedGearPill(item) {
  const imageUrl = safeImageUrl(item.imageUrl);
  const image = imageUrl ? `<img src="${escapeAttr(imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : "";
  return `<span class="speed-gear-pill">${image}${escapeHtml(item.name)} <strong>${fmtSigned(item.attributes.speed)}</strong></span>`;
}

function formatSavedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderSpeedBreakpointTable(totalSpeed) {
  if (!els.speedBreakpointTable) return;
  const equivalentLevel = getEquivalentLevel(totalSpeed);
  const showLevelDeltas = els.showLevelDeltas?.checked;
  const headCells = movementMsByBreakpoint
    .map((ms, index) => `<th scope="col">BP ${index + 1}<span>${ms}ms</span></th>`)
    .join("");
  const rows = speedBreakpoints.map(terrain => renderSpeedTerrainRow(terrain, totalSpeed, showLevelDeltas)).join("");
  const note = showLevelDeltas
    ? "Table values show level difference from your current total speed if all non-level bonuses stay the same."
    : "Table values show required total speed.";
  els.speedBreakpointTable.innerHTML = `
    <div class="speed-equivalent">Runs like roughly level ${equivalentLevel.toLocaleString()} before other temporary effects. ${note}</div>
    <table class="speed-breakpoint-table">
      <thead>
        <tr>
          <th scope="col">Terrain</th>
          <th scope="col">Friction</th>
          ${headCells}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderSpeedTerrainRow(terrain, totalSpeed, showLevelDeltas = false) {
  const currentIndex = getCurrentBreakpointIndex(terrain.thresholds, totalSpeed);
  const nextIndex = getNextBreakpointIndex(terrain.thresholds, totalSpeed);
  const cells = terrain.thresholds.map((threshold, index) => {
    const classes = [
      index === currentIndex ? "current-breakpoint" : "",
      index === nextIndex ? "next-breakpoint" : "",
      threshold !== null && threshold <= totalSpeed ? "reached-breakpoint" : "",
    ].filter(Boolean).join(" ");
    const label = getSpeedTableCellLabel(threshold, totalSpeed, showLevelDeltas, index, currentIndex);
    return `<td class="${classes}">${label}</td>`;
  }).join("");
  return `
    <tr>
      <th scope="row">${escapeHtml(terrain.label)}</th>
      <td>${terrain.friction}</td>
      ${cells}
    </tr>`;
}

function getSpeedTableCellLabel(threshold, totalSpeed, showLevelDeltas, index, currentIndex) {
  if (threshold === null) return "-";
  if (!showLevelDeltas) return threshold.toLocaleString();
  if (index === currentIndex) return `<span class="checkmark" aria-label="Current breakpoint">✓</span>`;
  const speedGap = threshold - totalSpeed;
  const levelGap = speedGap > 0 ? Math.ceil(speedGap / 2) : Math.floor(speedGap / 2);
  return levelGap > 0 ? `+${levelGap.toLocaleString()}` : levelGap.toLocaleString();
}

function getCurrentBreakpointIndex(thresholds, totalSpeed) {
  let current = -1;
  thresholds.forEach((threshold, index) => {
    if (threshold !== null && threshold <= totalSpeed) current = index;
  });
  return current;
}

function getNextBreakpointIndex(thresholds, totalSpeed) {
  return thresholds.findIndex(threshold => threshold !== null && threshold > totalSpeed);
}

init();
