# Quick creation from book archetypes

The creator's **Koncepcja** step offers **Archetyp z podręcznika** and an explicit **Wczytaj archetyp** action. The source is the supplied **Savage Worlds, Polish edition 2015**, printed pages **11–12** (PDF pages 12–13). These are templates for new human characters in Exilium. The descriptions in the chooser relate their roles to the supplied Exilium guide.

Selecting a template previews its attributes, skills, Edges and remaining skill points. Loading it replaces the build: attributes, skills, Edges, Hindrances and Hindrance-point allocation. The player confirms before replacing an existing, different build. Other fields are preserved, including identity, narrative text, portrait, inventory, cash/credits and privacy. Selection alone does not autosave; loading uses the normal draft autosave. Players can edit every loaded statistic. The template is not a permanent class or a new character schema field.

The book leaves the choice of one Major and two Minor Hindrances to the player, and some templates leave skill points unallocated. Those choices remain explicit in the creator. Additional attribute points are allocated from Hindrance points where needed by the printed attributes. A template does not grant XP, historical baselines, GM waivers or free equipment. Finalization still checks budgets and prerequisites. Existing-character entry with a historical baseline cannot load an archetype.

| Archetype               | Printed page | Skill points left | Hindrance points already allocated |
| ----------------------- | ------------ | ----------------- | ---------------------------------- |
| Badacz tajemnic         | 11           | 0                 | 4                                  |
| „Buźka”                 | 11           | 0                 | 4                                  |
| Kierowca                | 11           | 7                 | 4                                  |
| Łotrzyk                 | 11           | 0                 | 4                                  |
| Naukowiec               | 12           | 0                 | 4                                  |
| Pilot                   | 12           | 1                 | 4                                  |
| Przywódca               | 12           | 3                 | 2                                  |
| Rewolwerowiec           | 12           | 4                 | 4                                  |
| Snajper                 | 12           | 5                 | 4                                  |
| Wojownik – rębacz       | 12           | 4                 | 4                                  |
| Wojownik – szermierz    | 12           | 0                 | 4                                  |
| Wojownik – sztuki walki | 12           | 6                 | 4                                  |

## Setting choices and source corrections

- **Kapłan – uzdrowiciel**, **Mag** and **Naukowiec, szalony** are omitted because their printed builds use supernatural backgrounds, skills or powers. The ordinary Naukowiec remains available: McGyver, Uczony and Wszechstronny are mundane options in this ruleset.
- **Pirat** is omitted because the printed template is built around seafaring, including Żeglowanie. The setting guide describes the region's caravan routes and aircraft, supporting Kierowca and Pilot directly.
- **Naukowiec** includes the book's two Knowledge skills, `Inna` and `Nauka`, and both targets of Uczony. The player can rename `Inna` using the existing Knowledge editor, which updates the Edge's target as well.
- **Wojownik – rębacz** has an explicit correction shown in its preview: **Strength d8**, replacing the printed d10. The printed attributes cost seven points, requiring four Hindrance points above the normal five; its second Edge would require two more, exceeding the four-point Hindrance cap. Strength d8 reduces attributes to six points and leaves two Hindrance points for the second Edge. Both printed Edges remain, with their prerequisites satisfied, and the four unallocated skill points stay unchanged. This is an application adaptation, not a claim of official errata.
- Derived statistics are calculated by the existing rules engine from the loaded build, including unconditional Edge effects. The printed derived-stat summaries are not copied as overrides.

For a Figura, all templates retain Exilium's **400-dollar** starting budget. MG can also apply these archetypes to a Blotka without budget allocation or prerequisites; Rębacz then uses its original printed Strength d10. The chosen category, privacy and identity are preserved. Equipment is chosen through the existing campaign compendium. Archetypes are defined in `src/lib/content/archetypes.ts`; the pure application helper in `src/lib/rules/archetypes.ts` preserves the rest of the character. Tests check all templates against ordinary creation validation, their remaining skill points, source exclusions, preservation of existing fields and isolation between loaded copies.
