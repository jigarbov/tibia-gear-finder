// Wheel node costs, vocation perk maps, unlock logic and official-code mapping
// are adapted from the open-source Tibia Wheel planner:
// https://gitlab.com/klhio/tibia-wheel
// Its data.yaml notes CC BY-SA 3.0 compatibility with TibiaWiki; its code is LGPL-3.0-or-later.
const officialPlannerBase = "https://www.tibia.com/community/?subtopic=wheelofdestinyplanner&code=";

const vocationLabels = {
  knight: "Knight",
  paladin: "Paladin",
  sorcerer: "Sorcerer",
  druid: "Druid",
  monk: "Monk",
};

const goalLabels = {
  mitigation: "Mitigation",
  health: "Health",
  mana: "Mana",
  capacity: "Capacity",
  lifeLeech: "Life Leech",
  damage: "Damage",
  damageHealing: "Damage and Healing",
  spell: "Spell Augments",
  additionalSpells: "Additional Spells",
  giftOfLife: "Gift of Life",
  executionersThrow: "Executioner's Throw",
  combatMastery: "Combat Mastery",
  avatar: "Avatar",
  mas: "Mas/Area Spell",
  balanced: "Balanced solo",
  team: "Team hunt",
};

const commonGoalOptions = [
  "mitigation", "health", "mana", "capacity", "lifeLeech", "damage", "damageHealing", "spell", "balanced", "team",
];

const vocationGoalOptions = {
  knight: ["additionalSpells", "giftOfLife", "executionersThrow", "combatMastery", "avatar", "mas"],
  paladin: ["additionalSpells", "giftOfLife", "avatar", "mas"],
  druid: ["additionalSpells", "giftOfLife", "avatar", "mas"],
  sorcerer: ["additionalSpells", "giftOfLife", "avatar", "mas"],
  monk: [],
};

const goalRevelationTargets = {
  giftOfLife: ["Gift of Life"],
  executionersThrow: ["Executioner's Throw"],
  combatMastery: ["Combat Mastery"],
  avatar: ["Avatar of Steel", "Avatar of Light", "Avatar of Storm", "Avatar of Nature"],
  mas: ["Divine Grenade", "Beam Mastery", "Twin Bursts"],
  additionalSpells: ["Executioner's Throw", "Divine Grenade", "Beam Mastery", "Twin Bursts"],
};

const goalConvictionTargets = {
  mas: {
    knight: ["Augmented Groundshaker"],
    paladin: ["Augmented Divine Caldera"],
    druid: ["Augmented Terra Wave", "Augmented Strong Ice Wave", "Augmented Mass Healing"],
    sorcerer: ["Augmented Great Fire Wave", "Augmented Energy Wave"],
  },
};

const domainLabels = ["Revelation", "Power", "Resonance", "Stability"];
const domainClasses = ["wheel-domain-a", "wheel-domain-b", "wheel-domain-c", "wheel-domain-d"];
const sourcedWheelVocations = ["knight", "paladin", "sorcerer", "druid"];
const wheelAssetPath = "assets/wheel/";
const wheelAssets = {
  largeIcons: `${wheelAssetPath}icons-skillwheel-largeperks.e18f4254.webp`,
  mediumIcons: `${wheelAssetPath}icons-skillwheel-mediumperks.0a7441c4.webp`,
  smallIcons: `${wheelAssetPath}icons-skillwheel-smallperks.eda84a2f.webp`,
};

const wheelCornerImages = {
  0: [
    "backdrop_skillwheel_largebonus_front0_BR.e5de652f.webp",
    "backdrop_skillwheel_largebonus_front0_BL.23fe5137.webp",
    "backdrop_skillwheel_largebonus_front0_TL.5da10e96.webp",
    "backdrop_skillwheel_largebonus_front0_TR.6e428f83.webp",
  ],
  1: [
    "backdrop_skillwheel_largebonus_front1_BR.2a4a3514.webp",
    "backdrop_skillwheel_largebonus_front1_BL.c05e0e1b.webp",
    "backdrop_skillwheel_largebonus_front1_TL.835e88a4.webp",
    "backdrop_skillwheel_largebonus_front1_TR.bcacf234.webp",
  ],
  2: [
    "backdrop_skillwheel_largebonus_front2_BR.2a989afa.webp",
    "backdrop_skillwheel_largebonus_front2_BL.6e585ca8.webp",
    "backdrop_skillwheel_largebonus_front2_TL.9862b7c7.webp",
    "backdrop_skillwheel_largebonus_front2_TR.b3ab08d5.webp",
  ],
  3: [
    "backdrop_skillwheel_largebonus_front3_BR.0aaf7da2.webp",
    "backdrop_skillwheel_largebonus_front3_BL.0709e02d.webp",
    "backdrop_skillwheel_largebonus_front3_TL.17db7049.webp",
    "backdrop_skillwheel_largebonus_front3_TR.eeee95fa.webp",
  ],
};
const wheelCornerLights = [
  "backdrop_skillwheel_largebonus_light_BR.646c4c77.webp",
  "backdrop_skillwheel_largebonus_light_BL.0c36f727.webp",
  "backdrop_skillwheel_largebonus_light_TL.ceca9a98.webp",
  "backdrop_skillwheel_largebonus_light_TR.b4804640.webp",
];
const sectionPositionLabels = ["Bottom Right", "Bottom Left", "Top Left", "Top Right"];

const wheelData = {
  pointsPerCircle: [50, 75, 100, 150, 200],
  slicesPerCircle: [4, 8, 12, 8, 4],
  dedication: [
    0, 1, 3, 8,
    8, 8, 0, 0, 1, 1, 3, 3,
    3, 3, 3, 8, 8, 8, 0, 0, 0, 1, 1, 1,
    1, 1, 3, 3, 8, 8, 0, 0,
    2, 2, 2, 2,
  ],
  conviction: {
    knight: [
      2, 12, 3, 10, 7, 4, 0, 5, 7, 4, 1, 6,
      13, 11, 5, 7, 14, 1, 11, 13, 6, 7, 14, 0,
      6, 3, 6, 4, 5, 2, 5, 4, 9, 10, 8, 12,
    ],
    druid: [
      2, 31, 3, 29, 34, 4, 0, 5, 34, 4, 1, 6,
      32, 30, 5, 34, 33, 1, 30, 32, 6, 34, 33, 0,
      6, 3, 6, 4, 5, 2, 5, 4, 35, 29, 28, 31,
    ],
    paladin: [
      2, 22, 3, 18, 15, 4, 0, 5, 15, 4, 1, 6,
      21, 19, 5, 15, 20, 1, 19, 21, 6, 15, 20, 0,
      6, 3, 6, 4, 5, 2, 5, 4, 16, 18, 17, 22,
    ],
    sorcerer: [
      2, 27, 3, 24, 34, 4, 0, 5, 34, 4, 1, 6,
      36, 25, 5, 34, 26, 1, 25, 36, 6, 34, 26, 0,
      6, 3, 6, 4, 5, 2, 5, 4, 23, 24, 35, 27,
    ],
  },
  revelation: {
    knight: [3, 2, 0, 1],
    druid: [12, 10, 0, 11],
    paladin: [6, 5, 0, 4],
    sorcerer: [9, 8, 0, 7],
  },
};

const dedicationNames = [
  "HP", "Mana", "HP/Mana", "Capacity", "HP regen burst", "Mana regen burst", "Familiar expertise", "Familiar cooldown", "Mitigation",
];

const dedicationDisplay = {
  0: "Hit Points",
  1: "Mana",
  2: "Hit Points / Mana",
  3: "Capacity",
  4: "HP Regen Burst Chance",
  5: "Mana Regen Burst Chance",
  6: "Familiar Expertise",
  7: "Familiar Cooldown",
  8: "Mitigation Multiplier",
};

const dedicationEffects = [
  { knight: [3], paladin: [2], druid: [1], sorcerer: [1] },
  { knight: [1], paladin: [3], druid: [6], sorcerer: [6] },
  { knight: [3, 1], paladin: [2, 3], druid: [1, 6], sorcerer: [1, 6] },
  { knight: [5], paladin: [4], druid: [2], sorcerer: [2] },
  [0.2],
  [0.2],
  [0.3, 0.1],
  [1],
  [0.03],
];

const convictionNames = [
  "Fire Resistance", "Energy Resistance", "Ice Resistance", "Earth Resistance", "Holy/Death Resistance",
  "Mana Leech", "Life Leech", "Sword/Axe/Club Fighting", "Battle Instinct", "Battle Healing",
  "Augmented Fierce Berserk", "Augmented Intense Wound Cleansing", "Augmented Front Sweep", "Augmented Groundshaker",
  "Augmented Chivalrous Challenge", "Distance Fighting", "Ballistic Mastery", "Positional Tactics",
  "Augmented Divine Caldera", "Augmented Swift Foot", "Augmented Divine Dazzle", "Augmented Strong Ethereal Spear",
  "Augmented Sharpshooter", "Focus Mastery", "Augmented Great Fire Wave", "Augmented Energy Wave", "Augmented Sap Strength",
  "Augmented Focus Spells", "Healing Link", "Augmented Heal Friend", "Augmented Terra Wave", "Augmented Strong Ice Wave",
  "Augmented Mass Healing", "Augmented Nature's Embrace", "Magic Level", "Runic Mastery", "Augmented Magic Shield",
];

const convictionDisplay = {
  "Sword/Axe/Club Fighting": "Melee Skill Boost",
  "Distance Fighting": "Distance Skill Boost",
  "Magic Level": "Magic Skill Boost",
};

const revelationNames = [
  "Gift of Life", "Executioner's Throw", "Combat Mastery", "Avatar of Steel",
  "Divine Grenade", "Divine Empowerment", "Avatar of Light",
  "Beam Mastery", "Drain Body", "Avatar of Storm",
  "Twin Bursts", "Blessing of the Grove", "Avatar of Nature",
];

const cipIndexMap = {
  34: 0, 29: 1, 20: 2, 21: 3, 30: 4, 35: 5, 28: 6, 19: 7, 9: 8, 10: 9, 22: 10, 31: 11,
  18: 12, 8: 13, 2: 14, 3: 15, 11: 16, 23: 17, 17: 18, 7: 19, 1: 20, 0: 21, 4: 22, 12: 23,
  27: 24, 16: 25, 6: 26, 5: 27, 13: 28, 24: 29, 33: 30, 26: 31, 15: 32, 14: 33, 25: 34, 32: 35,
};
const cipVocationMap = { knight: "EK", druid: "ED", paladin: "RP", sorcerer: "MS" };

const wheelBuilds = {
  druid: [
    build(50, "T1 Forks", "D0Y2DABEZo_P9IAAA", ["spell", "team"]),
    build(100, "T1 Forks + 1x Gem", "D0Y2DABEZGqPz_SAAA", ["mitigation", "health"]),
    build(150, "T1 Forks + 2x Gem", "D0Y2BABkYQ0ghFkOE_EgAA", ["mitigation", "health", "mana"]),
    build(175, "T1 Forks + 2x Gem", "D0Y2DABEZGINIbzv-PBAA", ["mitigation", "health", "mana"]),
    build(225, "T1 Forks + 3x Gem", "D0Y2BABkYQEkx5w0X_IwEA", ["mitigation", "health", "mana"]),
    build(250, "T1 Forks + T1 Ulu's", "D0Y2DAAJJGYMobTKYA8X8kAAA", ["spell", "team"]),
    build(350, "T1 Forks + T1 Ulu's + 2x Gem", "D0Y2BABkYgQtIITHmDRVKA-D8SAAA", ["balanced", "team"]),
    build(500, "T1 Forks + T2 Ulu's + 1x Greater Gem", "D0Y2BABykMRmDKG0hITgMx_yMBAA", ["damage", "spell", "team"]),
    build(725, "T1 Forks + T2 Ulu's + 1x Greater Gem + T2 Strong Ice Wave", "D0Y2BAAUYMDCkgAkh5A4kT00DM_0gAAA", ["damage", "spell"]),
    build(1075, "T2 Forks + T2 Ulu's + 1x Greater Gem + T2 Blessing of the Grove", "D0Y2BgSJl2goGBwZsBBIyAXBABpEACktNAzP9IAAA", ["damage", "spell", "team"]),
  ],
  knight: [
    build(50, "T1 Front Sweep", "K0Y2DABEZo_P9IAAA", ["damage", "spell"]),
    build(100, "T1 Front Sweep + 1x Gem", "K0Y2DABEZGqPz_SAAA", ["health", "mitigation"]),
    build(150, "T1 Front Sweep + 2x Gem", "K0Y2BABkYQ0ghFkOE_EgAA", ["health", "mitigation"]),
    build(225, "T1 Front Sweep + 3x Gem", "K0Y2BABkYQEkx5w0X_IwEA", ["health", "mitigation"]),
    build(250, "T1 Combat Mastery + T1 Front Sweep", "K0Y2DAAN5GEApMgtj_kQAA", ["damage", "balanced"]),
    build(500, "T1 Combat Mastery + T1 Executioner's Throw + T1 Front Sweep", "K0Y2BgSJFkAAJvEMFgBMSSRgwIgRQg_o8EAA", ["balanced", "team"]),
    build(500, "T2 Combat Mastery + 1x Greater Gem", "K0Y2BABykMRmDKG0hITgMx_yMBAA", ["damage", "spell"]),
    build(500, "T2 Executioner's Throw + 1x Greater Gem", "K0Y2BgYJgmCSS8U4AEgxEDmEIF_5EAAA", ["damage", "spell"]),
    build(625, "T2 Executioner's Throw + T2 Exori Min", "K0Y2BgSJl2goGBwZsBBIzgBBL4jwQA", ["damage", "spell"]),
    build(725, "T2 Executioner's Throw + T2 Exori Min + 1x Greater Gem", "K0Y2BgYJh2Akh4pwAJBiOGFBCBCv4jAQA", ["damage", "balanced"]),
    build(750, "T2 Executioner's Throw + T1 Combat Mastery + 1x Greater Gem", "K0Y2BgYJgmCSS8U4AEgxFDCoOkEYjF4A0mQaL_kQAA", ["damage", "balanced"]),
    build(925, "T2 Executioner's Throw + T2 Exori Min + T1 Combat Mastery + 1x Greater Gem", "K0Y2BgYJh2Akh4pwAJBiOGFAZJIxCLwRtMgkT_IwEA", ["damage", "balanced"]),
    build(1000, "T2 Combat Mastery + T2 Executioner's Throw + 2x Greater Gem", "K0Y2BgYJgmCSS8U4AEgxFDSgqQAIIUbyAhOQ3E_I8EAA", ["damage", "balanced", "team"]),
    build(1175, "T2 Combat Mastery + T2 Executioner's Throw + T2 Exori Min + 2x Greater Gem", "K0Y2BgYJh2Akh4pwAJBiOGlBQgAQQp3kBCchqI-R8JAAA", ["damage", "spell"]),
  ],
  paladin: [
    build(50, "1x Gem", "P0Y2DAAoxQuf-RAAA", ["mitigation", "health"]),
    build(100, "2x Gem", "P0Y2BABkYoFAz8RwIA", ["mitigation", "health"]),
    build(250, "T1 Divine Barrage + T1 GoL", "P0Y2AAA0kQkeJtxIAN_EcCAA", ["damage", "team"]),
    build(450, "T2 Gran Con Base", "P0Y2AAgxQw6W0E4Rl5Q_hQ8B8JAAA", ["damage", "spell"]),
    build(450, "T2 Amp Res Base", "P0Y2CAAu8UEGkEJ1K8YTIM_5EAAA", ["mitigation", "team"]),
    build(500, "T2 Divine Barrage + T1 GoL + T1 Avatar", "P0Y2AAA0kQkeJtBOEZeYPFUiA8hv9IAAA", ["balanced", "team"]),
    build(600, "T2 Divine Barrage + T1 Empowerment", "P0Y2BAgBQoaQSmvL1ToOL_kQAA", ["damage", "team"]),
    build(725, "T2 Ethereal Barrage + 1x Greater Gem", "P0Y2BgYJh2Akh4pwAJBiOGFBCBCv4jAQA", ["damage", "spell"]),
    build(775, "T2 Divine Barrage + T2 Empowerment + 1x Greater Gem", "P0Y2BAgBQoaQSmvL1TGCSngZj_kQAA", ["damage", "balanced"]),
    build(1000, "T2 Mas San + T2 Divine Barrage + T2 Empowerment + 1x Greater Gem", "P0Y2BAgBQGBiMQaQTmeHunMJyYBmL-RwIA", ["damage", "team"]),
  ],
  sorcerer: [
    build(50, "1x Gem", "S0Y2DAAoxQuf-RAAA", ["mitigation", "health", "mana"]),
    build(100, "2x Gem", "S0Y2BABkYoFAz8RwIA", ["mitigation", "health", "mana"]),
    build(150, "2x Gem + T1 Focus Spells", "S0Y2BABkYQ0ghFkOE_EgAA", ["spell", "mana"]),
    build(225, "3x Gem + T1 Focus Spells", "S0Y2BABkYQEkx5w0X_IwEA", ["mitigation", "mana", "spell"]),
    build(225, "T1 Death Echo", "S0Y2DABEYgIsUbzv-PBAA", ["damage", "spell"]),
    build(250, "T1 Beam Mastery + T1 Death Echo", "S0Y2BgYJAEYgbvFBBpxIAF_EcCAA", ["damage", "spell"]),
    build(250, "T1 LoD + T1 Death Echo", "S0Y2DAAJJGIDLFGy7wHwkAAA", ["damage", "spell"]),
    build(425, "T1 Beam Mastery + T1 E-Wave + T1 Death Echo", "S0Y2BgYJBkAIEUEGHkDWZ7I0SA4D8SAAA", ["damage", "spell", "team"]),
    build(425, "T1 Beam Mastery + T1 E-Wave", "S0Y2CAA0kgNvJOATG9wQIpUIn_SAAA", ["damage", "team"]),
    build(500, "T1 Beam Mastery + T1 E-Wave + T1 Death Echo + T1 Avatar", "S0Y2BgYJAEYgbvFBBpxAAmvUGkJFgECP4jAQA", ["balanced", "team"]),
    build(500, "T2 Death Echo + T1 LoD + T1 Beam Mastery", "S0Y2BgYJAEYgbvFBBpBOKCCIYUbwYY-I8EAA", ["damage", "spell"]),
    build(650, "T2 E-Wave + T1 Beam Mastery", "S0Y2BgYJBkAIEUhhRvIyNvMNsbKgIB_5EAAA", ["damage", "team"]),
    build(700, "T2 Beam Mastery + T1 E-Wave + 1x Greater Gem", "S0Y2BgYJgmCSS8U4AEgxEDmIKQECYDw38kAAA", ["damage", "team"]),
    build(750, "T2 LoD + T2 Death Echo + 1x Greater Gem", "S0Y2BgYJAEYgbvFBBpxMCQAiKAlDdIZhqI-R8JAAA", ["damage", "spell"]),
    build(1000, "T2 Beam Mastery + T2 E-Wave + 1x Greater Gem + T1 Avatar + T1 GoL", "S0Y2BgYJgmySDJ4J3CkOJtZMSQAhQw8gYSDJIgJgj8RwIA", ["damage", "team"]),
    build(1000, "T2 LoD + T2 Beam Mastery + T2 Death Echo + 2x Greater Gem", "S0Y2BgYJgmCSS8U4AEgxFDSgqQAIIUbyAhOQ3E_I8EAA", ["damage", "spell"]),
  ],
  monk: [
    build(50, "T1 Chain", "M0Y2DABEZo_P9IAAA", ["damage", "spell"]),
    build(100, "T1 Chain + 1x Gem", "M0Y2DABEZGqPz_SAAA", ["mitigation", "health"]),
    build(150, "T1 Chain + 2x Gem", "M0Y2BABkYQ0ghFkOE_EgAA", ["mitigation", "health"]),
    build(225, "T1 Chain + 3x Gem", "M0Y2BABkYQEkx5w0X_IwEA", ["mitigation", "health"]),
    build(250, "T1 Ascetic", "M0Y2DAAN5GEApMgtj_kQAA", ["damage", "balanced"]),
    build(500, "T2 Ascetic + 1x Greater Gem", "M0Y2BABykMRmDKG0hITgMx_yMBAA", ["damage", "balanced"]),
    build(600, "T2 Ascetic + 1x Greater Gem + T1 FoB", "M0Y2BAgBQoaQSmvIGE5DQQ8z8SAAA", ["damage", "spell"]),
    build(625, "T2 Chain + T2 Outburst", "M0Y2BgYJh2Akh4pwAJBiM4gQT-IwEA", ["damage", "spell"]),
    build(725, "T2 Chain + T2 Outburst + 1x Greater Gem", "M0Y2BgYJh2Akh4pwAJBiOGFBCBCv4jAQA", ["damage", "balanced"]),
    build(775, "T2 Ascetic + T2 FoB + 1x Greater Gem", "M0Y2BAgBQoaQSmvL1TGCSngZj_kQAA", ["damage", "spell"]),
    build(900, "Sanctuary + T2 FoB + 1x Greater Gem", "M0Y2BAgBRvIwjDyBvCnwYiGE7I_YcCOYYgAA", ["mitigation", "team"]),
    build(1125, "T2 Ascetic + Sanctuary + T2 FoB + 1x Greater Gem", "M0Y2BAgBQoaQSmvL1TpklOA7JO_AcDOYag____AwA", ["balanced", "team"]),
  ],
};

const els = {
  vocation: document.getElementById("wheelVocation"),
  level: document.getElementById("wheelLevel"),
  extraPoints: document.getElementById("wheelExtraPoints"),
  goal: document.getElementById("wheelGoal"),
  planTitle: document.getElementById("wheelPlanTitle"),
  pointSummary: document.getElementById("wheelPointSummary"),
  officialLink: document.getElementById("wheelOfficialLink"),
  graphic: document.getElementById("wheelGraphic"),
  verdict: document.getElementById("wheelVerdict"),
  stats: document.getElementById("wheelStats"),
  perkSummary: document.getElementById("wheelPerkSummary"),
  why: document.getElementById("wheelWhy"),
  breakpoints: document.getElementById("wheelBreakpointList"),
};

init();

function init() {
  for (const el of [els.vocation, els.level, els.extraPoints, els.goal]) {
    el?.addEventListener("input", render);
  }
  syncGoalOptions(els.vocation?.value || "knight");
  render();
}

function build(points, label, code, tags = []) {
  return { points, label, code, tags, url: `${officialPlannerBase}${code}` };
}

function render() {
  syncGoalOptions(els.vocation?.value || "knight");
  const state = getState();
  const builds = wheelBuilds[state.vocation] || [];
  const optimized = optimizeWheel(state);
  const recommended = optimized?.referenceBuild || chooseBuild(builds, state);
  const next = builds.find(entry => entry.points > state.points);
  const selected = optimized || recommended || builds[0];

  els.planTitle.textContent = selected
    ? `${vocationLabels[state.vocation]} ${goalLabels[state.goal]} route`
    : "No wheel route";
  els.pointSummary.textContent = `Level ${state.level.toLocaleString()} gives ${state.basePoints.toLocaleString()} promotion points, plus ${state.extraPoints.toLocaleString()} extra: ${state.points.toLocaleString()} total.`;

  if (selected?.url) {
    els.officialLink.href = selected.url;
    els.officialLink.textContent = "Open official setup";
  } else if (selected?.officialCode) {
    els.officialLink.href = `${officialPlannerBase}${selected.officialCode}`;
    els.officialLink.textContent = "Open optimised setup";
  }

  const allocation = selected?.allocation || allocateDomains(selected, state);
  els.graphic.innerHTML = renderWheelSvg(allocation, selected, state);
  els.verdict.innerHTML = renderVerdict(selected, next, state);
  els.stats.innerHTML = renderStats(selected, next, state, allocation);
  els.perkSummary.innerHTML = renderPerkSummary(selected, state, allocation);
  els.why.innerHTML = renderWhy(selected, state);
  els.breakpoints.innerHTML = renderBreakpointList(builds, selected, state);
}

function getState() {
  const level = Math.max(1, Number(els.level?.value) || 1);
  const extraPoints = Math.max(0, Number(els.extraPoints?.value) || 0);
  const basePoints = Math.max(0, level - 50);
  const vocation = els.vocation?.value || "knight";
  const availableGoals = getGoalOptions(vocation);
  const goal = availableGoals.includes(els.goal?.value) ? els.goal.value : availableGoals[0];
  if (els.goal && els.goal.value !== goal) els.goal.value = goal;
  return {
    vocation,
    level,
    basePoints,
    extraPoints,
    points: basePoints + extraPoints,
    goal,
  };
}

function syncGoalOptions(vocation) {
  if (!els.goal) return;
  const options = getGoalOptions(vocation);
  const current = options.includes(els.goal.value) ? els.goal.value : options[0];
  const existing = [...els.goal.options].map(option => option.value).join(",");
  if (existing !== options.join(",")) {
    els.goal.innerHTML = options
      .map(goal => `<option value="${escapeAttribute(goal)}">${escapeHtml(goalLabels[goal] || goal)}</option>`)
      .join("");
  }
  els.goal.value = current;
}

function getGoalOptions(vocation) {
  return [...commonGoalOptions, ...(vocationGoalOptions[vocation] || [])];
}

function chooseBuild(builds, state) {
  const affordable = builds.filter(entry => entry.points <= state.points);
  if (!affordable.length) return builds[0] || null;
  return affordable
    .map(entry => ({ entry, score: scoreBuild(entry, state) }))
    .sort((a, b) => b.score - a.score || b.entry.points - a.entry.points)[0].entry;
}

function scoreBuild(entry, state) {
  let score = entry.points * 0.75;
  if (entry.tags.includes(state.goal)) score += 180;
  if (state.goal === "balanced" && entry.tags.some(tag => ["damage", "mitigation", "health", "team"].includes(tag))) score += 70;
  if (state.goal === "team" && entry.tags.some(tag => ["team", "mitigation", "spell"].includes(tag))) score += 90;
  if (state.goal === "mitigation" && /gem|res|sanctuary|wound/i.test(entry.label)) score += 90;
  if (state.goal === "health" && /gem|sanctuary/i.test(entry.label)) score += 70;
  if (state.goal === "mana" && /focus|gem|forks/i.test(entry.label)) score += 70;
  if (state.goal === "capacity" && /gem/i.test(entry.label)) score += 60;
  if (state.goal === "lifeLeech" && /leech|wound|terra|front sweep/i.test(entry.label)) score += 110;
  if (state.goal === "damage" && /t2|base|mastery|barrage|berserk|throw|beam|wave|fob|chain|sweep/i.test(entry.label)) score += 90;
  if (state.goal === "damageHealing" && /gem|greater gem|avatar|gol|gift|healing|empowerment|grove/i.test(entry.label)) score += 130;
  if (state.goal === "spell" && /t2|mastery|base|focus|echo|wave|barrage|throw|sweep|augmented/i.test(entry.label)) score += 90;
  if (["additionalSpells", "giftOfLife", "executionersThrow", "combatMastery", "avatar", "mas"].includes(state.goal)) score += scoreReferenceBuildForTarget(entry, state.goal);
  score -= Math.max(0, state.points - entry.points) * 0.08;
  return score;
}

function optimizeWheel(state) {
  if (!sourcedWheelVocations.includes(state.vocation)) return null;
  if (["health", "mana", "capacity", "mitigation", "damageHealing"].includes(state.goal)) {
    return optimizeWheelBeam(state);
  }
  const points = Math.min(Math.max(0, state.points), 4000);
  const perks = createEmptyPerks();
  let pointsLeft = points;
  let guard = 0;

  while (pointsLeft > 0 && guard < 200) {
    guard += 1;
    const candidates = [];
    for (let index = 0; index < 36; index++) {
      if (!perkAvailable(perks, index)) continue;
      const max = maxPointsForPerk(index);
      const current = perks[index];
      if (current >= max) continue;
      const chunk = Math.min(max - current, pointsLeft, nextChunkSize(index, current));
      if (chunk <= 0) continue;
      candidates.push({
        index,
        chunk,
        score: scorePerkChunk(index, chunk, current, state, perks),
      });
    }
    if (!candidates.length) break;
    candidates.sort((a, b) => b.score - a.score || b.chunk - a.chunk);
    const best = candidates[0];
    perks[best.index] += best.chunk;
    pointsLeft -= best.chunk;
  }

  if (pointsLeft > 0) {
    for (let index = 0; index < 36 && pointsLeft > 0; index++) {
      if (!perkAvailable(perks, index)) continue;
      const add = Math.min(maxPointsForPerk(index) - perks[index], pointsLeft);
      if (add > 0) {
        perks[index] += add;
        pointsLeft -= add;
      }
    }
  }

  const polishedPerks = polishPartialPerks(perks, state);
  const usedPoints = sum(Object.values(polishedPerks));
  const referenceBuild = chooseBuild(wheelBuilds[state.vocation] || [], state);
  const topPerks = summarizeTopPerks(polishedPerks, state);
  return {
    points: usedPoints,
    label: `Optimised ${goalLabels[state.goal]} allocation`,
    tags: [state.goal, "balanced"],
    perks: polishedPerks,
    topPerks,
    referenceBuild,
    allocation: allocationFromPerks(polishedPerks, state),
    officialCode: contextToCipCode(state.vocation, polishedPerks),
  };
}

function polishPartialPerks(perks, state) {
  const rawStatGoal = ["health", "mana", "capacity", "mitigation"].includes(state.goal);
  if (rawStatGoal) return perks;

  let budget = 0;
  const polished = { ...perks };
  const protectedPartialPoints = getProtectedPartialPoints(perks);
  Object.entries(polished).forEach(([rawIndex, points]) => {
    const index = Number(rawIndex);
    if (points > 0 && points < maxPointsForPerk(index)) {
      const protectedPoints = protectedPartialPoints[index] || 0;
      budget += points - protectedPoints;
      polished[index] = protectedPoints;
    }
  });

  if (budget <= 0) return perks;

  while (budget > 0) {
    const candidates = [];
    for (let index = 0; index < 36; index++) {
      if (!perkAvailable(polished, index)) continue;
      const current = polished[index];
      const cost = maxPointsForPerk(index) - current;
      if (cost <= 0 || cost > budget) continue;
      candidates.push({
        index,
        cost,
        score: scorePerkChunk(index, cost, current, state, polished) + scoreCompletionPolish(index, state),
      });
    }

    if (!candidates.length) break;
    candidates.sort((a, b) => b.score - a.score || a.cost - b.cost);
    const best = candidates[0];
    polished[best.index] += best.cost;
    budget -= best.cost;
  }

  while (budget > 0) {
    const candidates = getSpendCandidates(polished, budget, state);
    if (!candidates.length) break;
    candidates.sort((a, b) => b.score - a.score || b.chunk - a.chunk);
    const best = candidates[0];
    polished[best.index] += best.chunk;
    budget -= best.chunk;
  }

  return polished;
}

function getProtectedPartialPoints(perks) {
  const protectedPoints = {};
  for (let section = 0; section < 4; section++) {
    const sectionPoints = sectionSum(perks, section);
    const fullPoints = Object.entries(perks)
      .filter(([rawIndex, points]) => {
        const index = Number(rawIndex);
        return iconSection(index) === section && points >= maxPointsForPerk(index);
      })
      .reduce((total, [, points]) => total + points, 0);
    const protectedThreshold = [1000, 500, 250].find(threshold => sectionPoints >= threshold && fullPoints < threshold);
    let needed = protectedThreshold ? protectedThreshold - fullPoints : 0;
    if (needed <= 0) continue;

    Object.entries(perks)
      .filter(([rawIndex, points]) => {
        const index = Number(rawIndex);
        return iconSection(index) === section && points > 0 && points < maxPointsForPerk(index);
      })
      .sort((a, b) => b[1] - a[1])
      .forEach(([rawIndex, points]) => {
        if (needed <= 0) return;
        const index = Number(rawIndex);
        const keep = Math.min(points, needed);
        protectedPoints[index] = keep;
        needed -= keep;
      });
  }
  return protectedPoints;
}

function scoreCompletionPolish(index, state) {
  const conviction = convictionNames[wheelData.conviction[state.vocation][index]] || "";
  let score = 600;
  score += scoreConvictionForGoal(conviction, state.goal) * 3;
  if (goalConvictionTargets[state.goal]?.[state.vocation]?.includes(conviction)) score += 1200;
  return score;
}

function optimizeWheelBeam(state) {
  const points = Math.min(Math.max(0, state.points), 4000);
  const beamWidth = 260;
  let states = [{ perks: createEmptyPerks(), pointsLeft: points, pathScore: 0 }];
  let guard = 0;

  while (states.some(entry => entry.pointsLeft > 0) && guard < 200) {
    guard += 1;
    const nextStates = [];

    states.forEach(entry => {
      const candidates = getSpendCandidates(entry.perks, entry.pointsLeft, state);
      if (!candidates.length) {
        nextStates.push(entry);
        return;
      }

      candidates.forEach(candidate => {
        const perks = { ...entry.perks, [candidate.index]: entry.perks[candidate.index] + candidate.chunk };
        nextStates.push({
          perks,
          pointsLeft: entry.pointsLeft - candidate.chunk,
          pathScore: entry.pathScore + candidate.score,
        });
      });
    });

    states = dedupeBeamStates(nextStates, state)
      .sort((a, b) => scoreBeamState(b, state) - scoreBeamState(a, state))
      .slice(0, beamWidth);
  }

  const best = states.sort((a, b) => scoreFinalStatState(b, state) - scoreFinalStatState(a, state))[0];
  const perks = state.goal === "damageHealing"
    ? polishPartialPerks(best?.perks || createEmptyPerks(), state)
    : best?.perks || createEmptyPerks();
  const usedPoints = sum(Object.values(perks));
  const referenceBuild = chooseBuild(wheelBuilds[state.vocation] || [], state);
  const topPerks = summarizeTopPerks(perks, state);
  return {
    points: usedPoints,
    label: `Optimised ${goalLabels[state.goal]} allocation`,
    tags: [state.goal, "balanced"],
    perks,
    topPerks,
    referenceBuild,
    allocation: allocationFromPerks(perks, state),
    officialCode: contextToCipCode(state.vocation, perks),
  };
}

function getSpendCandidates(perks, pointsLeft, state) {
  const candidates = [];
  for (let index = 0; index < 36; index++) {
    if (!perkAvailable(perks, index)) continue;
    const max = maxPointsForPerk(index);
    const current = perks[index];
    if (current >= max) continue;
    const chunk = Math.min(max - current, pointsLeft, nextChunkSize(index, current));
    if (chunk <= 0) continue;
    candidates.push({
      index,
      chunk,
      score: scorePerkChunk(index, chunk, current, state, perks),
    });
  }
  return candidates;
}

function dedupeBeamStates(states, state) {
  const bestByKey = new Map();
  states.forEach(entry => {
    const key = Object.values(entry.perks).join(",");
    const existing = bestByKey.get(key);
    if (!existing || scoreBeamState(entry, state) > scoreBeamState(existing, state)) {
      bestByKey.set(key, entry);
    }
  });
  return [...bestByKey.values()];
}

function scoreBeamState(entry, state) {
  return entry.pathScore + scoreFinalStatState(entry, state) * 0.12;
}

function scoreFinalStatState(entry, state) {
  const totals = getDirectStatTotals(entry.perks, state.vocation);
  const used = sum(Object.values(entry.perks));
  if (state.goal === "health") return totals.hp * 10000 + totals.mitigation * 20 + used * 0.01;
  if (state.goal === "mana") return totals.mana * 10000 + totals.hp * 8 + used * 0.01;
  if (state.goal === "capacity") return totals.capacity * 10000 + totals.hp * 2 + used * 0.01;
  if (state.goal === "mitigation") return totals.mitigation * 10000 + totals.hp * 6 + used * 0.01;
  if (state.goal === "damageHealing") {
    const damageHealing = getDamageHealingBonus(entry.perks);
    const vessels = getTotalVesselResonance(entry.perks);
    return damageHealing * 100000 + vessels * 1000 + totals.hp * 4 + totals.mana * 2 + totals.mitigation * 20 + used * 0.01;
  }
  return entry.pathScore;
}

function getTotalVesselResonance(perks) {
  let total = 0;
  for (let section = 0; section < 4; section++) {
    total += getVesselResonanceLevel(perks, section);
  }
  return total;
}

function getDirectStatTotals(perks, vocation) {
  const totals = { hp: 0, mana: 0, capacity: 0, mitigation: 0 };
  Object.entries(perks).forEach(([rawIndex, points]) => {
    const index = Number(rawIndex);
    const dedicationId = wheelData.dedication[index];
    const values = getDedicationEffect(dedicationId, vocation);
    if (dedicationId === 0) totals.hp += values[0] * points;
    if (dedicationId === 1) totals.mana += values[0] * points;
    if (dedicationId === 2) {
      totals.hp += values[0] * points;
      totals.mana += values[1] * points;
    }
    if (dedicationId === 3) totals.capacity += values[0] * points;
    if (dedicationId === 8) totals.mitigation += values[0] * points;
  });
  return totals;
}

function scorePerkChunk(index, chunk, current, state, perks) {
  const circle = iconCircle(index);
  const section = iconSection(index);
  const dedication = dedicationNames[wheelData.dedication[index]] || "";
  const conviction = convictionNames[wheelData.conviction[state.vocation][index]] || "";
  const dedicationId = wheelData.dedication[index];
  const isFilling = current + chunk >= maxPointsForPerk(index);
  const text = `${dedication} ${conviction}`.toLowerCase();
  let score = chunk * 0.1;

  score += scoreDirectStatGain(dedicationId, chunk, state.goal, state.vocation);
  score += scoreDirectStatPath(index, state.goal, state.vocation, perks, current, chunk);
  score += scoreTextForGoal(text, state.goal) * (isFilling ? 1.2 : 0.85);
  score += scoreDedicationForGoal(dedication, state.goal) * chunk / 25;
  score += scoreTargetConvictionPath(index, state.goal, state.vocation, perks, current, chunk);
  score += scoreTargetConviction(conviction, state.goal, state.vocation, current, chunk, isFilling);
  if (isFilling) score += scoreConvictionForGoal(conviction, state.goal);

  const sectionPoints = sectionSum(perks, section);
  const beforeStage = getRevelationStage(sectionPoints);
  const afterStage = getRevelationStage(sectionPoints + chunk);
  const revelation = revelationNames[wheelData.revelation[state.vocation][section]] || "";
  score += scoreTargetRevelationSection(revelation, state.goal, sectionPoints, chunk);
  if (state.goal === "damageHealing" || state.goal === "balanced") {
    score += scoreDamageHealingChunk(index, current, chunk, perks, isFilling);
  }
  if (afterStage > beforeStage) {
    score += 120 * afterStage + scoreTextForGoal(revelation.toLowerCase(), state.goal) * 1.6;
    score += scoreRevelationTarget(revelation, state.goal, afterStage);
  }

  if (circle >= 3 && ["damage", "spell", "additionalSpells", "mas"].includes(state.goal)) score += 12;
  if (circle >= 2 && state.goal === "damageHealing") score += 10;
  if (circle <= 1 && ["mitigation", "mana"].includes(state.goal)) score += 7;
  return score;
}

function scoreReferenceBuildForTarget(entry, goal) {
  const label = normalizeGoalText(entry.label);
  const targets = goalRevelationTargets[goal] || [];
  if (targets.some(target => label.includes(normalizeGoalText(target)))) return 220;
  if (goal === "mas" && /mas san|caldera|groundshaker|beam|bursts|wave|area/i.test(entry.label)) return 180;
  return 0;
}

function normalizeGoalText(value) {
  return String(value || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreRevelationTarget(revelation, goal, stage) {
  const targets = goalRevelationTargets[goal] || [];
  if (targets.includes(revelation)) return 360 * stage;
  if (goal === "additionalSpells" && revelation !== "Gift of Life" && /Avatar/.test(revelation) === false) return 180 * stage;
  if (goal === "mas" && /Divine Grenade|Beam Mastery|Twin Bursts/.test(revelation)) return 360 * stage;
  return 0;
}

function scoreTargetRevelationSection(revelation, goal, sectionPoints, chunk) {
  if (!isTargetRevelation(revelation, goal)) return 0;
  const nextStageThreshold = [250, 500, 1000].find(threshold => threshold > sectionPoints);
  const exactTarget = (goalRevelationTargets[goal] || []).includes(revelation);
  const base = exactTarget ? 18 : 10;
  let score = chunk * base;

  if (nextStageThreshold) {
    const progress = Math.max(0, Math.min(chunk, nextStageThreshold - sectionPoints));
    score += progress * (exactTarget ? 32 : 20);
  }

  return score;
}

function isTargetRevelation(revelation, goal) {
  const targets = goalRevelationTargets[goal] || [];
  if (targets.includes(revelation)) return true;
  if (goal === "additionalSpells" && revelation !== "Gift of Life" && /Avatar/.test(revelation) === false) return true;
  if (goal === "mas" && /Divine Grenade|Beam Mastery|Twin Bursts/.test(revelation)) return true;
  return false;
}

function scoreTargetConviction(conviction, goal, vocation, current, chunk, isFilling) {
  const targets = goalConvictionTargets[goal]?.[vocation] || [];
  if (!targets.includes(conviction)) return 0;
  const max = maxPointsForPerkByConviction(conviction, vocation);
  const progress = Math.min(max, current + chunk) / max;
  return chunk * 16 + progress * 220 + (isFilling ? 900 : 0);
}

function scoreTargetConvictionPath(index, goal, vocation, perks, current, chunk) {
  const targetIndexes = getTargetConvictionIndexes(goal, vocation);
  if (!targetIndexes.length) return 0;
  const section = iconSection(index);
  const circle = iconCircle(index);
  const unfinishedTargets = targetIndexes.filter(targetIndex => perks[targetIndex] < maxPointsForPerk(targetIndex));
  const sectionTargets = unfinishedTargets.filter(targetIndex => iconSection(targetIndex) === section);
  if (!sectionTargets.length) return 0;
  const targetCircle = Math.min(...sectionTargets.map(iconCircle));
  const isTarget = sectionTargets.includes(index);
  const effectivePoints = current + chunk;
  const progress = Math.min(1, effectivePoints / maxPointsForPerk(index));
  if (isTarget) return chunk * 18 + progress * 260;
  if (circle < targetCircle) return chunk * 11 + progress * 110;
  return 0;
}

function getTargetConvictionIndexes(goal, vocation) {
  const targets = goalConvictionTargets[goal]?.[vocation] || [];
  return wheelData.conviction[vocation]
    ?.map((id, index) => targets.includes(convictionNames[id]) ? index : null)
    .filter(index => index != null) || [];
}

function maxPointsForPerkByConviction(conviction, vocation) {
  const index = wheelData.conviction[vocation]?.findIndex(id => convictionNames[id] === conviction) ?? -1;
  return index >= 0 ? maxPointsForPerk(index) : 100;
}

function scoreDamageHealingChunk(index, current, chunk, perks, isFilling) {
  const section = iconSection(index);
  const before = getVesselResonanceLevel(perks, section);
  const after = getVesselResonanceLevel(perks, section, index, current + chunk);
  const max = maxPointsForPerk(index);
  let score = 12 + chunk / max * 28;
  if (after > before) {
    score += after === 3 ? 360 : after === 2 ? 240 : 260;
  }
  if (isFilling) score += 26;
  return score;
}

function scoreDirectStatGain(dedicationId, chunk, goal, vocation) {
  const values = getDedicationEffect(dedicationId, vocation);
  const hpGain = dedicationId === 0 ? values[0] * chunk : dedicationId === 2 ? values[0] * chunk : 0;
  const manaGain = dedicationId === 1 ? values[0] * chunk : dedicationId === 2 ? values[1] * chunk : 0;
  const capacityGain = dedicationId === 3 ? values[0] * chunk : 0;
  const mitigationGain = dedicationId === 8 ? values[0] * chunk : 0;

  if (goal === "health") return hpGain * 18 + mitigationGain * 10;
  if (goal === "mana") return manaGain * 1.8;
  if (goal === "capacity") return capacityGain * 2.2;
  if (goal === "mitigation") return mitigationGain * 120 + hpGain * 0.35;
  if (goal === "balanced") return hpGain * 0.6 + manaGain * 0.45 + capacityGain * 0.08 + mitigationGain * 55;
  if (goal === "team") return hpGain * 0.35 + manaGain * 0.35 + mitigationGain * 45;
  return 0;
}

function scoreDirectStatPath(index, goal, vocation, perks, current, chunk) {
  if (!["health", "mana", "capacity"].includes(goal)) return 0;
  const section = iconSection(index);
  const circle = iconCircle(index);
  const targetIndexes = getDirectStatTargetIndexes(goal, vocation)
    .filter(targetIndex => iconSection(targetIndex) === section && perks[targetIndex] < maxPointsForPerk(targetIndex));
  if (!targetIndexes.length) return 0;

  const targetCircle = Math.min(...targetIndexes.map(iconCircle));
  const isTarget = targetIndexes.includes(index);
  const progress = Math.min(1, (current + chunk) / maxPointsForPerk(index));
  const goalWeight = goal === "health" ? 1.6 : 1;
  if (isTarget) return (chunk * 10 + progress * 120) * goalWeight;
  if (circle < targetCircle) return (chunk * 7 + progress * 70) * goalWeight;
  return 0;
}

function getDirectStatTargetIndexes(goal, vocation) {
  return wheelData.dedication
    .map((dedicationId, index) => {
      const values = getDedicationEffect(dedicationId, vocation);
      const hpGain = dedicationId === 0 ? values[0] : dedicationId === 2 ? values[0] : 0;
      const manaGain = dedicationId === 1 ? values[0] : dedicationId === 2 ? values[1] : 0;
      const capacityGain = dedicationId === 3 ? values[0] : 0;
      if (goal === "health" && hpGain > 0) return index;
      if (goal === "mana" && manaGain > 0) return index;
      if (goal === "capacity" && capacityGain > 0) return index;
      return null;
    })
    .filter(index => index != null);
}

function scoreTextForGoal(text, goal) {
  const scores = {
    mitigation: [/mitigation|resistance|shield|avatar|gift of life|healing|wound|leech/i, 70],
    health: [/hp|gift of life|hit points/i, 52],
    mana: [/mana|magic shield|focus|leech|runic|mp/i, 64],
    capacity: [/capacity|hp\/mana/i, 70],
    lifeLeech: [/life leech|mana leech|front sweep|terra wave|wound|healing|drain/i, 88],
    damage: [/damage|critical|fighting|distance|magic level|mastery|berserk|barrage|beam|wave|caldera|throw|spear|grenade|sweep|chain|echo|outburst|empowerment/i, 78],
    damageHealing: [/damage|healing|heal|leech|empowerment|avatar|gift of life|grove|mana|hp|mitigation|resistance/i, 58],
    spell: [/augmented|cooldown|spell|mastery|wave|beam|caldera|barrage|throw|focus|echo|grenade|empowerment/i, 82],
    additionalSpells: [/throw|grenade|beam|bursts|spell|mastery/i, 78],
    giftOfLife: [/gift of life|hp|mitigation|resistance/i, 80],
    executionersThrow: [/executioner|throw|fighting|damage|critical/i, 86],
    combatMastery: [/combat mastery|shield|critical|fighting|damage/i, 86],
    avatar: [/avatar|mitigation|critical|damage|hp/i, 86],
    mas: [/mas|area|groundshaker|wave|beam|bursts|caldera|grenade|damage/i, 86],
    balanced: [/hp|mana|mitigation|resistance|damage|healing|leech|fighting|magic level|mastery|avatar/i, 52],
    team: [/healing|heal|support|challenge|dazzle|empowerment|gift of life|grove|resistance|mitigation|link/i, 78],
  };
  const [pattern, value] = scores[goal] || scores.balanced;
  return pattern.test(text) ? value : 0;
}

function scoreDedicationForGoal(name, goal) {
  const text = name.toLowerCase();
  if (goal === "mitigation") return /mitigation/.test(text) ? 18 : /hp/.test(text) ? 8 : 0;
  if (goal === "health") return /hp/.test(text) ? 45 : 0;
  if (goal === "mana") return /mana|mp/.test(text) ? 18 : 0;
  if (goal === "capacity") return /capacity/.test(text) ? 22 : 0;
  if (goal === "lifeLeech") return /hp|mitigation/.test(text) ? 7 : 0;
  if (["damage", "spell", "additionalSpells", "executionersThrow", "combatMastery", "avatar", "mas"].includes(goal)) return /mana|hp\/mana/.test(text) ? 6 : 0;
  if (goal === "damageHealing" || goal === "balanced") return /hp|mana|hp\/mana|mitigation/.test(text) ? 12 : 0;
  if (goal === "team") return /mitigation|hp|mana/.test(text) ? 9 : 0;
  return /mitigation|hp|mana|hp\/mana/.test(text) ? 9 : 0;
}

function scoreConvictionForGoal(name, goal) {
  return scoreTextForGoal(name.toLowerCase(), goal) + (/resistance|leech|fighting|magic level/i.test(name) ? 28 : 44);
}

function summarizeTopPerks(perks, state) {
  const entries = Object.entries(perks)
    .filter(([, points]) => points > 0)
    .map(([rawIndex, points]) => {
      const index = Number(rawIndex);
      const conviction = convictionNames[wheelData.conviction[state.vocation][index]] || "Conviction perk";
      const dedication = dedicationNames[wheelData.dedication[index]] || "Dedication perk";
      return { index, points, label: `${conviction} + ${dedication}` };
    })
    .sort((a, b) => b.points - a.points || a.index - b.index);
  return entries.slice(0, 6);
}

function allocationFromPerks(perks, state) {
  return domainLabels.map((name, index) => {
    const points = sectionSum(perks, index);
    return {
      name: getDomainLabel(state, index),
      points,
      slices: 0,
      stage: getRevelationStage(points),
    };
  });
}

function allocateDomains(buildEntry, state) {
  const plan = (buildEntry?.label || "").toLowerCase();
  const weights = [1, 1, 1, 1];

  if (/gem|res|sanctuary|wound/.test(plan) || ["mitigation", "health"].includes(state.goal)) weights[2] += 2.4;
  if (/mastery|base|barrage|throw|beam|wave|echo|fob|chain|sweep|berserk/.test(plan) || ["damage", "spell"].includes(state.goal)) weights[1] += 2.6;
  if (/avatar|gol|grove|ulu|focus/.test(plan) || ["team", "mana"].includes(state.goal)) weights[0] += 1.8;
  if (["balanced", "team"].includes(state.goal)) weights[3] += 1.7;

  const invested = Math.min(buildEntry?.points || state.points, state.points);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let remaining = invested;
  const domainPoints = weights.map((weight, index) => {
    const value = index === weights.length - 1 ? remaining : Math.round(invested * weight / totalWeight / 25) * 25;
    remaining -= value;
    return Math.max(0, value);
  });

  return domainPoints.map((points, index) => ({
    name: domainLabels[index],
    points,
    slices: Math.min(9, Math.ceil(points / 65)),
    stage: getRevelationStage(points),
  }));
}

function getRevelationStage(points) {
  if (points >= 1000) return 3;
  if (points >= 500) return 2;
  if (points >= 250) return 1;
  return 0;
}

function renderWheelSvg(allocation, buildEntry, state) {
  const size = 522;
  const center = 261;
  const slices = [];
  const corners = [];
  const perks = buildEntry?.perks || {};
  const rotation = getVocationRotation(state.vocation);

  for (let index = 35; index >= 0; index--) {
    const circle = iconCircle(index);
    const domain = iconSection(index);
    const indexInCircle = iconIndexInCircle(index);
    const segmentSize = 360 / wheelData.slicesPerCircle[circle];
    const max = maxPointsForPerk(index);
    const points = Math.max(0, Math.min(max, perks[index] ?? approximatePerkPointsFromAllocation(index, allocation)));
    const fill = max ? points / max : 0;
    const conviction = getConvictionName(state.vocation, index);
    const dedication = dedicationNames[wheelData.dedication[index]] || "Dedication";
    const segment = deg2rad(segmentSize);
    const angle = segmentSize * (indexInCircle + 1);
    const iconOffset = circle === 3 ? indexInCircle % 2 === 0 ? 0.35 : 0.65 : 0.5;
    const radius = circle * 52 + 26;
    const [iconX, iconY] = rotatePoint(radius, 0, segment * iconOffset - deg2rad(angle));
    const arcRadius = circle * 52;
    const innerWidth = 50 * fill + 1;
    const inner = createSVGArc(arcRadius, innerWidth, segment);
    const outer = createSVGArc(arcRadius + innerWidth, 50 - innerWidth + 1, segment);
    const hover = createSVGArc(arcRadius, circle === 4 ? 50.5 : 52, segment * (circle === 4 ? 0.67 : circle === 3 ? 0.68 : 1));
    const hoverTransform = circle === 4
      ? `rotate(${-0.165 * segmentSize})`
      : circle === 3
        ? `rotate(${segmentSize * (indexInCircle % 2 === 0 ? 0 : -0.32)})`
        : "";
    const available = perkAvailable(perks, index);

    slices.push(`<g transform="rotate(${angle})" class="real-wheel-slice real-wheel-section-${domain} ${available ? "" : "real-wheel-locked"}">
      <path class="real-wheel-outer" d="${outer}"></path>
      <path class="real-wheel-inner" d="${inner}"></path>
      <path class="real-wheel-hover" d="${hover}" ${hoverTransform ? `transform="${hoverTransform}"` : ""}></path>
      <g transform="rotate(${-angle}) translate(${Math.round(iconX)}, ${Math.round(iconY)})">
        <rect width="30" height="30" transform="translate(-15, -15)" fill="url(#medium-${wheelData.conviction[state.vocation]?.[index] ?? 0})"></rect>
        <rect width="16" height="16" transform="translate(-16, 1)" fill="url(#small-${wheelData.dedication[index]})"></rect>
      </g>
      <title>${escapeHtml(conviction)} / ${escapeHtml(dedication)}: ${points}/${max}</title>
    </g>`);
  }

  for (let domain = 0; domain < 4; domain++) {
    const stage = allocation[domain].stage;
    const revelationName = getRevelationName(state.vocation, domain);
    const [x, y] = rotatePoint(172, 172, Math.PI / 2 * -domain);
    const [iconX, iconY] = rotatePoint(48, 48, Math.PI / 2 * -domain);
    const [lightX, lightY] = rotatePoint(46.5, 46.5, Math.PI / 2 * -domain);
    const progress = createSVGArc(17, 6, Math.PI * 2 * progressForRevelation(perks, domain));
    const iconIndex = wheelData.revelation[state.vocation]?.[domain] ?? 0;
    corners.push(`<g transform="translate(${Math.round(x)}, ${Math.round(y)})">
      <g transform="translate(-89, -89)">
        <image transform="translate(46.5, 46.5)" x="${lightX}" y="${lightY}" class="real-wheel-corner-light real-wheel-section-${domain}" href="${wheelAssetPath}${wheelCornerLights[domain]}" width="85" height="85"></image>
        <image href="${wheelAssetPath}${wheelCornerImages[Math.max(0, Math.min(3, stage))][domain]}" width="178" height="178"></image>
      </g>
      <g class="real-wheel-progress real-wheel-progress-${domain}" transform="translate(${iconX}, ${iconY}) rotate(-90) scale(1 -1)">
        <circle r="23"></circle>
        <path d="${progress}"></path>
      </g>
      <rect width="34" height="34" transform="translate(${iconX - 17}, ${iconY - 17})" fill="url(#large-${iconIndex})"></rect>
      <title>${escapeHtml(revelationName)}${stage ? ` stage ${stage}` : " locked"}</title>
    </g>`);
  }

  return `<div class="real-wheel-frame" style="--wheel-rotation: ${rotation}deg">
    <svg class="real-wheel-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Wheel picture for ${escapeHtml(buildEntry?.label || "recommended route")}">
    <defs>
      ${convictionNames.map((_, index) => `<pattern id="medium-${index}" patternUnits="userSpaceOnUse" width="30" height="30"><image href="${wheelAssets.mediumIcons}" x="${index * -30}" y="0" width="${30 * convictionNames.length}" height="30"></image></pattern>`).join("")}
      ${dedicationNames.map((_, index) => `<pattern id="small-${index}" patternUnits="userSpaceOnUse" width="16" height="16"><image href="${wheelAssets.smallIcons}" x="${index * -16}" y="0" width="${16 * dedicationNames.length}" height="16"></image></pattern>`).join("")}
      ${revelationNames.map((_, index) => `<pattern id="large-${index}" patternUnits="userSpaceOnUse" width="34" height="34"><image href="${wheelAssets.largeIcons}" x="${index * -34}" y="0" width="${34 * revelationNames.length}" height="34"></image></pattern>`).join("")}
    </defs>
    <g transform="translate(${center}, ${center})">
      ${corners.join("")}
      ${slices.join("")}
    </g>
    <text class="real-wheel-core-title" x="${center}" y="${center - 8}" text-anchor="middle">${escapeHtml(vocationLabels[state.vocation])}</text>
    <text class="real-wheel-core-points" x="${center}" y="${center + 15}" text-anchor="middle">${state.points.toLocaleString()} pts</text>
  </svg>
  <div class="real-wheel-front" aria-hidden="true"></div>
  </div>`;
}

function approximatePerkPointsFromAllocation(index, allocation) {
  const domain = iconSection(index);
  const points = allocation[domain]?.points || 0;
  const sameDomain = Array.from({ length: 36 }, (_, i) => i).filter(i => iconSection(i) === domain);
  const share = Math.floor(points / sameDomain.length);
  return Math.min(maxPointsForPerk(index), share);
}

function progressForRevelation(perks, section) {
  const sectionPoints = sectionSum(perks, section);
  const thresholds = [1000, 500, 250, 0];
  const level = getRevelationStage(sectionPoints);
  const currentIndex = thresholds.length - level - 1;
  const lastThreshold = thresholds[currentIndex];
  const nextThreshold = thresholds[currentIndex - 1];
  if (!nextThreshold) return 1;
  return (sectionPoints - lastThreshold) / (nextThreshold - lastThreshold);
}

function deg2rad(degrees) {
  return degrees * Math.PI / 180;
}

function rotatePoint(x, y, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    cos * x + sin * y,
    cos * y - sin * x,
  ];
}

function createSVGArc(radius, width, segment) {
  const outerRadius = radius + width;
  const [innerX, innerY] = rotatePoint(radius, 0, segment);
  const [outerX, outerY] = rotatePoint(outerRadius, 0, segment);
  const large = segment > Math.PI ? 1 : 0;
  return [
    `M${radius} 0`,
    `L${outerRadius} 0`,
    `A${outerRadius} ${outerRadius}, 0, ${large}, 0, ${outerX}, ${outerY}`,
    `L${innerX} ${innerY}`,
    `A${radius} ${radius}, 0, ${large}, 1, ${radius}, 0`,
  ].join("");
}

function renderVerdict(buildEntry, next, state) {
  if (!buildEntry) return `<p class="wheel-empty">No wheel build data is available for this vocation yet.</p>`;
  const unused = Math.max(0, state.points - buildEntry.points);
  return `<div class="wheel-verdict-card">
    <span>${escapeHtml(goalLabels[state.goal])}</span>
    <h2>${escapeHtml(buildEntry.label)}</h2>
    <p>${unused ? `${unused.toLocaleString()} points could not be legally placed.` : "All available points are spent."} ${next ? `Nearest TibiaPal comparison build is at ${next.points.toLocaleString()} points.` : "No higher TibiaPal comparison build is loaded yet."}</p>
  </div>`;
}

function renderStats(buildEntry, next, state, allocation) {
  const nextLevels = next ? Math.max(0, next.points - state.points) : 0;
  const revelationCount = allocation.filter(domain => domain.stage > 0).length;
  return [
    stat("Used points", buildEntry ? buildEntry.points.toLocaleString() : "0"),
    stat("Spare points", buildEntry ? Math.max(0, state.points - buildEntry.points).toLocaleString() : "0"),
    stat("Revelations", String(revelationCount)),
    stat("Next compare", next ? `${nextLevels.toLocaleString()} pts` : "Done"),
  ].join("");
}

function stat(label, value) {
  return `<div class="wheel-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderPerkSummary(buildEntry, state, allocation) {
  const perks = buildEntry?.perks;
  if (!perks || !sourcedWheelVocations.includes(state.vocation)) {
    return `<section class="wheel-perk-summary">
      <h3>Perks Summary</h3>
      <p class="wheel-summary-empty">Detailed stat totals are available once a sourced wheel dataset exists for this vocation.</p>
    </section>`;
  }

  return `<section class="wheel-perk-summary">
    <h3>Perks Summary</h3>
    ${renderSummaryGroup("Dedication Perks", getDedicationSummaryRows(perks, state))}
    ${renderSummaryGroup("Conviction Perks", getConvictionSummaryRows(perks, state))}
    ${renderSummaryGroup("Revelation Perks", getRevelationSummaryRows(perks, state, allocation))}
    ${renderSummaryGroup("Vessels", getVesselSummaryRows(perks))}
    <p class="wheel-summary-note">Note: The cooldown of a spell cannot be reduced to less than 50% of its base cooldown by any means.</p>
  </section>`;
}

function renderSummaryGroup(title, rows) {
  const content = rows.length
    ? rows.map(row => `<li>
        <span>${renderSummaryIcon(row)}${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(row.value)}</strong>
      </li>`).join("")
    : `<li class="wheel-summary-empty-row"><span>none</span><strong></strong></li>`;
  return `<div class="wheel-summary-group">
    <h4>${escapeHtml(title)}</h4>
    <ul>${content}</ul>
  </div>`;
}

function renderSummaryIcon(row) {
  if (row.icon == null || !row.type) return "";
  const className = row.type === "dedication"
    ? "wheel-summary-icon-small"
    : row.type === "conviction"
      ? "wheel-summary-icon-medium"
      : "wheel-summary-icon-large";
  return `<em class="wheel-summary-icon ${className}" style="--icon:${Number(row.icon) || 0}" title="${escapeAttribute(row.tooltip || row.label)}"></em>`;
}

function getDedicationSummaryRows(perks, state) {
  const totals = {};
  Object.entries(perks).forEach(([rawIndex, points]) => {
    const index = Number(rawIndex);
    const dedication = wheelData.dedication[index];
    const values = getDedicationEffect(dedication, state.vocation);
    if (dedication === 2) {
      totals[0] = (totals[0] || 0) + values[0] * points;
      totals[1] = (totals[1] || 0) + values[1] * points;
      return;
    }
    totals[dedication] = (totals[dedication] || 0) + (values[0] || 0) * points;
  });

  return Object.entries(totals)
    .filter(([, value]) => Math.abs(value) > 0.0001)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([rawId, value]) => {
      const id = Number(rawId);
      return {
        type: "dedication",
        icon: id,
        label: dedicationDisplay[id] || dedicationNames[id] || "Dedication",
        value: formatDedicationValue(id, value),
        tooltip: dedicationDisplay[id] || dedicationNames[id] || "Dedication",
      };
    });
}

function getDedicationEffect(dedication, vocation) {
  const effect = dedicationEffects[dedication];
  if (!effect) return [0];
  if (Array.isArray(effect)) return effect;
  return effect[vocation] || effect.knight || [0];
}

function formatDedicationValue(id, value) {
  if (id === 4 || id === 5 || id === 6 || id === 8) return `${formatNumber(value, 2)}%`;
  if (id === 7) return `-${formatNumber(value, 0)}s`;
  return `+${formatNumber(value, value % 1 ? 2 : 0)}`;
}

function getConvictionSummaryRows(perks, state) {
  const counts = {};
  Object.entries(perks).forEach(([rawIndex, points]) => {
    const index = Number(rawIndex);
    if (points < maxPointsForPerk(index)) return;
    const conviction = wheelData.conviction[state.vocation]?.[index];
    if (conviction == null) return;
    counts[conviction] = (counts[conviction] || 0) + 1;
  });

  return Object.entries(counts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([rawId, count]) => {
      const id = Number(rawId);
      const label = convictionDisplay[convictionNames[id]] || convictionNames[id] || "Conviction";
      return {
        type: "conviction",
        icon: id,
        label,
        value: formatConvictionValue(id, count),
        tooltip: convictionNames[id] || label,
      };
    });
}

function formatConvictionValue(id, count) {
  const name = convictionNames[id] || "";
  if (/Resistance/.test(name)) return `+${name === "Holy/Death Resistance" ? count : count * 2}%`;
  if (name === "Mana Leech") return `+${formatNumber(count * 0.25, 2)}%`;
  if (name === "Life Leech") return `+${formatNumber(count * 0.75, 2)}%`;
  if (/Fighting|Magic Level/.test(name)) return `+${count}`;
  if (/^Augmented /.test(name)) return count >= 2 ? "II" : "I";
  return count >= 2 ? `II (${count}x)` : "I";
}

function getRevelationSummaryRows(perks, state, allocation) {
  const rows = [];
  const damageHealing = getDamageHealingBonus(perks);
  if (damageHealing > 0) {
    rows.push({
      label: "Damage and Healing",
      value: `+${damageHealing}`,
      tooltip: "Potential gem bonus from enabled full vessel spots; assumes a matching lesser, regular, or greater gem is socketed.",
    });
  }

  for (let section = 0; section < 4; section++) {
    const icon = wheelData.revelation[state.vocation]?.[section] ?? 0;
    const stage = allocation[section]?.stage || 0;
    rows.push({
      type: "revelation",
      icon,
      label: getRevelationName(state.vocation, section),
      value: stage ? `Stage ${stage}` : "Locked",
      tooltip: `${sectionSum(perks, section).toLocaleString()} points in this domain.`,
    });
  }
  return rows;
}

function getDamageHealingBonus(perks) {
  let bonus = 0;
  for (let section = 0; section < 4; section++) {
    const resonance = getVesselResonanceLevel(perks, section);
    if (resonance >= 3) bonus += 2;
    else if (resonance >= 1) bonus += 1;
  }
  return bonus;
}

function getVesselSummaryRows(perks) {
  const rows = [];
  for (let section = 0; section < 4; section++) {
    const resonance = getVesselResonanceLevel(perks, section);
    if (!resonance) continue;
    rows.push({
      label: `Vessel Resonance ${sectionPositionLabels[section] || section + 1}`,
      value: roman(resonance),
      tooltip: `${resonance} full vessel ${resonance === 1 ? "spot" : "spots"} enabled in this domain.`,
    });
  }
  return rows;
}

function getVesselResonanceLevel(perks, section, pendingIndex = null, pendingPoints = null) {
  const filled = Object.entries(perks).filter(([rawIndex, points]) => {
    const index = Number(rawIndex);
    const effectivePoints = index === pendingIndex ? pendingPoints : points;
    return iconSection(index) === section && effectivePoints >= maxPointsForPerk(index);
  }).length;
  return Math.min(3, filled);
}

function roman(value) {
  return ["", "I", "II", "III"][value] || String(value);
}

function formatNumber(value, decimals = 0) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function renderWhy(buildEntry, state) {
  if (!buildEntry) return "";
  const source = `<a href="https://tibia-wheel.vercel.app/" target="_blank" rel="noopener noreferrer">tibia-wheel</a>`;
  const compare = buildEntry.referenceBuild
    ? ` The closest sourced comparison build is <a href="${escapeAttribute(buildEntry.referenceBuild.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(buildEntry.referenceBuild.label)}</a>.`
    : "";
  const goalNote = state.goal === "damageHealing"
    ? " For this goal, legal moves that complete full vessel spots are weighted above ordinary damage perks."
    : "";
  return `<div class="wheel-why">
    <h3>Why this route?</h3>
    <p>This is generated from the open-source ${source} wheel data: node costs, vocation perk maps and unlock rules. The optimiser repeatedly spends points into the best legal available perk for ${escapeHtml(goalLabels[state.goal].toLowerCase())}, then exports an official planner code where the source model supports the vocation.${goalNote}${compare}</p>
    <div class="quest-tags">${buildEntry.tags.map(tag => `<span>${escapeHtml(goalLabels[tag] || tag)}</span>`).join("")}</div>
    ${buildEntry.topPerks?.length ? `<ol class="wheel-top-perks">${buildEntry.topPerks.map(perk => `<li><strong>${perk.points.toLocaleString()}</strong> ${escapeHtml(perk.label)}</li>`).join("")}</ol>` : ""}
  </div>`;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function createEmptyPerks() {
  return Object.fromEntries(Array.from({ length: 36 }, (_, index) => [index, 0]));
}

function iconCircle(index) {
  if (index < 4) return 0;
  if (index < 12) return 1;
  if (index < 24) return 2;
  if (index < 32) return 3;
  return 4;
}

function iconIndexInCircle(index) {
  const circle = iconCircle(index);
  return index - sum(wheelData.slicesPerCircle.slice(0, circle));
}

function iconSection(index) {
  const circle = iconCircle(index);
  const previous = sum(wheelData.slicesPerCircle.slice(0, circle));
  return Math.floor((index - previous) / wheelData.slicesPerCircle[circle] * 4);
}

function maxPointsForPerk(index) {
  return wheelData.pointsPerCircle[iconCircle(index)];
}

function nextChunkSize(index, current) {
  const max = maxPointsForPerk(index);
  if (current >= max) return 0;
  if (max - current <= 25) return max - current;
  return Math.min(25, max - current);
}

function iconAngles(index) {
  const circle = iconCircle(index);
  const indexInCircle = iconIndexInCircle(index);
  const slice = 360 / wheelData.slicesPerCircle[circle];
  return [indexInCircle * slice, indexInCircle * slice + slice];
}

function perkNeighbours(perks, index) {
  const circle = iconCircle(index);
  if (circle === 0) return [];
  const section = iconSection(index);
  const previous = sum(wheelData.slicesPerCircle.slice(0, circle));
  const indexInCircle = iconIndexInCircle(index);
  const maxInCircle = wheelData.slicesPerCircle[circle];
  const [startAngle, endAngle] = iconAngles(index);
  const around = [
    indexInCircle > 0 ? index - 1 : previous + maxInCircle - 1,
    indexInCircle < maxInCircle - 1 ? index + 1 : previous,
    ...Object.keys(perks).filter(idx => {
      const numeric = Number(idx);
      if (iconCircle(numeric) !== circle - 1) return false;
      const [start, end] = iconAngles(numeric);
      return ((start >= startAngle && start <= endAngle) || (end <= endAngle && end >= startAngle)) && iconSection(numeric) === section;
    }).map(Number),
  ];

  if (circle < 3) return around;
  if (circle === 4) around.splice(0, 2);

  if (iconSection(around[0]) !== section) {
    around.splice(0, 1);
  } else if (iconSection(around[1]) !== section) {
    around.splice(1, 1);
  }
  return around;
}

function perkAvailable(perks, index) {
  const circle = iconCircle(index);
  const neighbours = perkNeighbours(perks, index);
  return circle === 0 || neighbours.some(idx => perks[idx] === maxPointsForPerk(idx));
}

function sectionSum(perks, section) {
  return Object.entries(perks)
    .filter(([index]) => iconSection(Number(index)) === section)
    .reduce((total, [, points]) => total + points, 0);
}

function contextToCipCode(vocation, perks) {
  if (!cipVocationMap[vocation]) return "";
  const bytes = new Uint8Array(36);
  Object.entries(perks).forEach(([index, points]) => {
    bytes[cipIndexMap[Number(index)]] = Math.max(0, Math.min(255, Number(points) || 0));
  });
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return `${cipVocationMap[vocation]}${btoa(binary)}`;
}

function getConvictionName(vocation, index) {
  return convictionNames[wheelData.conviction[vocation]?.[index]] || "Conviction";
}

function getRevelationName(vocation, section) {
  return revelationNames[wheelData.revelation[vocation]?.[section]] || "Revelation";
}

function getDomainLabel(state, section) {
  const revelation = getRevelationName(state.vocation, section);
  return revelation === "Revelation" ? domainLabels[section] : revelation;
}

function getVocationRotation(vocation) {
  return { knight: 90, paladin: -90, sorcerer: 180, druid: 0 }[vocation] ?? 90;
}

function renderBreakpointList(builds, selected, state) {
  return builds.map(entry => {
    const available = entry.points <= state.points;
    const active = selected && entry.code === selected.code;
    return `<article class="wheel-breakpoint ${active ? "wheel-breakpoint-active" : ""} ${available ? "" : "wheel-breakpoint-locked"}">
      <div>
        <span>${entry.points.toLocaleString()} pts${available ? "" : ` / +${(entry.points - state.points).toLocaleString()}`}</span>
        <h3>${escapeHtml(entry.label)}</h3>
      </div>
      <a href="${escapeAttribute(entry.url)}" target="_blank" rel="noopener noreferrer">Open</a>
    </article>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
