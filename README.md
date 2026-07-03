# Tibia Gear Finder

A small local-first web app for finding usable Tibia equipment by vocation, level, slot and priority.

## Fastest way to use it

Open `index.html` in your browser.

The app loads `data/items.js`, not just `items.json`, so it still works when opened directly from your computer with a `file:///` path.

The included data is only a small starter/sample dataset. Run the scraper to replace it with current data from TibiaWiki.

## Refresh the data from TibiaWiki

Install Node.js first if you do not already have it.

Then, in this folder:

```bash
npm install
npm run scrape
```

That writes both:

```text
data/items.json
data/items.js
```

After scraping, refresh `index.html` in your browser.

## Running it like a normal local website

Double-clicking `index.html` should work, but you can also run a tiny local server:

```bash
npm run serve
```

Then open:

```text
http://localhost:8080
```

## How recommendations work

The app filters items by:

```text
item.level <= your level
item.vocations contains your vocation, or the item has no vocation restriction
item.slot matches the chosen slot
weapon type matches, if the slot is Weapon
```

Then it sorts by the selected priority, for example:

- Range: range, attack modifier, hit chance, lower weight
- Attack: vocation-relevant attack boosts, total attack, wand/rod damage, attack modifier, hit chance, range, lower weight
- Elemental attack: the selected attack type first, then vocation-relevant skill modifiers, total attack and combat tie-breakers
- Armor: armor, total resistance, lower weight
- Lightest: lower weight, then armor/damage tie-breakers

## Data shape

Items look like this:

```json
{
  "name": "Composite Hornbow",
  "slot": "weapon",
  "type": "bow",
  "level": 50,
  "vocations": ["paladin"],
  "range": 6,
  "attackMod": 2,
  "hitPercent": 3,
  "weight": 35,
  "attributes": {},
  "resistances": {},
  "wikiUrl": "https://tibia.fandom.com/wiki/Composite_Hornbow"
}
```

## Notes

TibiaWiki tables are not perfectly consistent across equipment categories. The scraper tries to normalize common columns and text, but you should expect to tweak the parsing rules over time, especially for attributes and resistances.

## If Fandom returns HTTP 403

The scraper now tries the TibiaWiki MediaWiki API first, then falls back to the normal page HTML. It also writes fetched pages into a local `cache/` folder.

If Fandom still blocks your computer/network, open the wiki page in your browser, save the page HTML into the matching cache file, then run the scraper again. For example:

```text
cache/Bows.html
cache/Legs.html
```

The app itself does not need the scraper to run; it reads the existing `data/items.js` file.


## Swords/Axes/Clubs note

The scraper treats tables headed `Weapon` as item-name tables. This matters for melee weapon pages such as Swords, Axes, and Clubs.

## Notes on melee weapon pages

TibiaWiki/Fandom redirects `Swords`, `Axes`, and `Clubs` to the actual table pages `Sword_Weapons`, `Axe_Weapons`, and `Club_Weapons`. The scraper uses the real table pages directly and also tries to follow redirect stubs when they appear in cached/API HTML.

## Hidden items

Each result card has two hide buttons:

- **Hide for this search** removes the item from the current results only. These temporary hides reset whenever you change vocation, level, mode, slot, priority, or weapon type.
- **Hide permanently** saves the item in your browser's local storage and keeps it hidden across refreshes and future searches.
- **Show drops** controls whether result cards show drop sources. The equipment preview hover still shows drop sources.

The **Hidden items** section at the bottom of the page lists permanently hidden items. Use **Unhide** on one item or **Unhide all** to bring them back.


## Recent fixes

- Shields now keep and display their `Def` value from the TibiaWiki shields table.
- Defence/armor ranking now uses an `effective physical defence` score: `max(armor, defence) + physical resistance %`. This means an item with Arm 5 and physical +1% ranks alongside Arm 6 for physical-defence sorting.
- Physical Defence priority now considers armor/defence and physical resistance together instead of treating resistance as a separate afterthought.

## Priority fallback behaviour

If you choose a priority that does not make sense for a slot, the app now shows a placeholder card such as `No valid fire attack legs`. The remaining recommendations for that slot fall back to the balanced formula instead of quietly sorting by a weak tie-breaker like weight.

Examples:

- Attack on legs: only shows a valid priority result if the item has actual attack-style stats.
- Distance skill on armor/legs/helmets: only shows priority results if the item boosts distance.
- Elemental attack priorities: show items with that specific attack type or vocation-relevant skill modifiers that boost the selected weapon style.
- Resistance priorities: only show priority results if the item has that specific resistance.
- Balanced and general resistance sorting only count physical, fire, ice, energy, earth, holy and death. Niche resistances such as drown, life drain and mana drain only matter when you pick that exact priority.
- Balanced and Lightest always apply.

## Recent smart ranking/display updates

- Full equipment set mode now shows five recommendations per slot instead of three.
- The layout widens on desktop/monitor screens while staying compact on mobile.
- Scraped item images are saved as `imageUrl` and displayed on item cards.
- Attack now treats vocation-relevant skill boosts as attack boosts:
  - Paladin: distance fighting
  - Sorcerer/Druid: magic level
  - Knight: sword/axe/club fighting
  - Monk: fist fighting
- Wand and rod damage ranges are parsed when the wiki table exposes a damage column, and are used by Attack ranking.
- Added scraper entries and weapon-type filters for fist fighting weapons and throwing weapons.

## Latest UI/ranking changes

- Full-set order is Weapon, Off-hand/Ammunition, Helmet, Armor, Legs, Boots.
- The old Data/Load JSON panel has been removed; the app automatically loads `data/items.js` relative to `index.html`.
- Weapon type choices are vocation-aware and reset to a sensible default when changing vocation.
- The hand setup is now a simple unchecked = one-handed, checked = two-handed toggle. One-handed is the default.
- Two-handed mode hides the off-hand slot.
- Bow/Crossbow mode shows Ammunition instead of Off-hand.
- Attack skill bonuses are tied to the selected weapon type. For example, if Axe is selected, sword-only and club-only helmets/armor no longer count as valid attack results.
- Hide controls on item cards are now icon buttons: eye = hide for this search, trash = hide permanently.


## Recent changes

- Added a Speed priority for items with speed bonuses.
- Knight weapon ordering now starts with Axe, then Club, then Sword.
- Bow and Crossbow hide the hand toggle because they are always treated as two-handed.
- Ammunition scraping now keeps arrow/bolt ammunition and skips bow/crossbow equipment rows on the Ammunition page.
- Bow recommendations use arrow ammunition; Crossbow recommendations use bolt ammunition.
- Melee hand detection now also checks nearby table headings, which helps pages split into one-handed and two-handed sections.
