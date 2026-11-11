# Rules decisions and coverage

Ruleset: `sw2015-exilium-1`. The source is the local `Savage-Worlds-Edycja-Polska-20151.pdf`, not Adventure Edition. Summaries were checked against extracted creation, skills, Hindrance/Edge and equipment sections; the creation and advancement pages were also inspected visually. This is an initial rules implementation, not a claim that every combination in the book has received a full table acceptance review.

The [catalog title audit](catalog-audit.md) accounts for all 111 Edge and 48 Hindrance titles. Exilium offers 93 and 47 respectively and explains each omission. It also documents the corrected Zręczność k8 prerequisite for Błyskawiczny refleks. The user confirmed that Pomysłowy Dobromir should remain excluded because its full entry uses Niesamowita nauka and powers. Native player-help popups are paraphrased guidance, not a substitute for the complete rules and the GM's situational rulings.

## Explicit table decisions

- **400 Exilium dollars** for starting equipment, replacing the core book's default 500.
- The party starts poor. Bogaty and Obrzydliwie Bogaty display a reminder to discuss and obtain the GM's consent; Szycha also warns because it includes Bogaty. This is an informational warning without an in-app approval workflow. It does not automatically select Biedak or reduce the ordinary 400-dollar budget. Approved wealth options retain their printed multipliers.
- Saved advances use the **current rank when spent**, not the rank at which their XP was earned. The saved ledger records XP and rank at spend time.
- Record the advance at 80 XP as the sixteenth advance; the next is at 90. Ranks change at 20, 40, 60 and 80 XP.
- Cybernetic limbs are descriptive. Do not apply automatic bonuses, strain, powers or installation rules.
- A player can record a scoped GM ruling, including its reason. This does not represent independent in-app approval by a GM account.
- Cash and electronic credits are distinct currencies. No conversion rate is assumed.
- Exactly filling the ordinary creation attribute and skill budgets is required for finalization, unless a specific ruling permits otherwise. Additional narrative Hindrances do not increase the normal credit cap.

## Source map

| Source pages (printed) | Implementation                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 9–10                   | Human Edge, attribute/skill budgets and costs, Hindrance spending, derived statistics                             |
| 11–12                  | [Book archetypes for quick creation](archetypes.md), setting exclusions and the labelled Rębacz budget correction |
| 17–23, 44              | The 2015 skill list, linked attributes, separate Knowledge specializations; Knowledge general is a Smarts test    |
| 23–28, 45–46           | Hindrances; child/elder budgets, free Blind Edge, starting-fund and derived-stat effects                          |
| 29–48                  | Edge names, prerequisites, professional consent and legendary trait targeting                                     |
| 42–43                  | Rank thresholds, advancement choices and Legendary rate/frequency                                                 |
| 49–50                  | Equipment notation and carrying capacity                                                                          |
| 55–62                  | Manual equipment fields and the reviewed initial compendium                                                       |
| 68–75                  | Fuksy, Shaken and wounds; tracker only, no automatic damage resolution                                            |

Some source tables are less detailed than the full entry. The full entry takes precedence: for example, `Złota rączka` requires Niesamowita nauka and is therefore excluded, even though its summary appears mundane. `Pomysłowy Dobromir`, supernatural backgrounds, powers and magical racial options are excluded. `Niedowiarek`, `Szósty zmysł` and `Władca zwierząt` are not offered as automatic Exilium options pending an explicit mundane adaptation.

## What is calculated

- Creation budgets, a free human Edge, Hindrance credit/spending, child budgets and the elder's Smarts-skill credit.
- Prerequisites for the catalog's Edges, including rank, linked traits, another Edge and selected target.
- Parry, torso Toughness/armor, Pace/running, Charisma, starting funds and session Fuksy.
- Wound/fatigue penalties and the `Nerwy` exceptions, plus known carried weight and capacity.
- Unconditional skill modifiers for Czujny, Badacz, As, Charakterny, Uzdrowiciel, Uczony and Niezdara. Context-dependent professional bonuses stay in their descriptions so they are not presented as universally applicable.
- Earned/spent/available advances, normal die limits, single/paired/new-skill advancement, one attribute increase per ordinary rank, every-other-advance Legendary attribute cadence, and targeted Zawodowiec/Ekspert/Mistrz.

Base choices are stored separately from advances. Later increases never recalculate the original skill point spending. Undo covers only the latest complete mutation; arbitrary removal of an old advance would require a dependency-aware correction workflow and is not offered.

Imported historical characters explicitly declare XP, advances already spent, whether an attribute increase was used in the current rank, and the last Legendary attribute-increase position if applicable. The imported baseline is trusted as a player's historical record, not retroactively certified as a legal point-buy build. Future advances are validated normally.

## Effects resolved at the table

The app does not roll dice, resolve damage or perform healing. Conditional Charisma, fear/health bonuses, professional environment restrictions, weapon damage modifiers, cards, temporary effects such as Berserk/Dla kurażu, and armor-versus-ammunition rules stay in descriptions or item notes. Explicit numeric GM corrections can adjust main derived statistics, with a mandatory reason.

The rulebook does not identify weight units clearly in the extracted equipment sections. Display its original numbers as `jedn. SW`, not kilograms. Carrying-penalty boundaries use: up to one capacity is unpenalized; above it, each additional capacity gives another −1. Unknown weights make the total incomplete. The Akrobata bonus is conservatively omitted when unknown carried weights prevent proving there is no overload. For equipped weapons, the largest applicable Parry modifier is used, including a negative modifier when it is the only equipped weapon; multi-weapon cases can be corrected explicitly by a ruling. Armor weight may differ when stored: adjust the entered weight to match the table's ruling. Store countable ammunition as weapon stock or a separate item with known weight; reserves are not automatically weighed or priced.

## Review before the first real campaign session

- Rehearse the group's actual characters and compare every active modifier against their paper sheets.
- Check any conditional armor, weapon and physical-Hindrance combinations used by those characters.
- Confirm imported historical advancement details rather than granting their old XP again.
- Decide setting-specific prices/availability where the core catalog is unsuitable.
- Record any agreed adaptation as an explicit ruling or a new ruleset version. Existing characters remain pinned to this version.

The [equipment compendium](compendium.md) is shared editable campaign data. Its 117 initial values are seeded once; subsequent player edits are recorded separately from application releases. Inventory copies retain their selected values. Custom Knowledge rename/removal preserves dice, recalculates costs and updates or clears targeted Edge references.
