import { json } from '@sveltejs/kit';
import { DomainError, repository } from '../../../../../lib/server/db';
import { apiError } from '../../../../../lib/server/http';
import { characterSchema } from '../../../../../lib/rules/model';
import { effectiveBuild, rankIndex, spentAdvances, totalXp } from '../../../../../lib/rules/engine';
export function POST({ locals, params }: import('./$types').RequestEvent) {
  try {
    if (!locals.user) throw new DomainError(401, 'Zaloguj się ponownie.');
    const source = repository().get(locals.user.id, params.id),
      c = structuredClone(source.document);
    if (source.status !== 'draft') {
      c.build = effectiveBuild(c) as typeof c.build;
      const last = c.advances.findLastIndex((a) => a.kind === 'attribute' && a.rank === 4);
      c.legacy = {
        xp: totalXp(c),
        spent: spentAdvances(c),
        attributeUsed:
          c.advances.some((a) => a.kind === 'attribute' && a.rank === rankIndex(totalXp(c))) ||
          !!(c.legacy?.attributeUsed && rankIndex(c.legacy.xp) === rankIndex(totalXp(c))),
        lastLegendaryAttribute:
          last >= 0
            ? (c.legacy?.spent ?? 0) + last + 1
            : (c.legacy?.lastLegendaryAttribute ?? null),
        reason: 'Kopia zapisanej postaci z zachowaniem obecnego rozwoju',
      };
    }
    c.name = `${c.name.slice(0, 145)} — kopia`;
    c.xp = [];
    c.advances = [];
    c.inventory = c.inventory.map((i) => ({ ...i, id: crypto.randomUUID() }));
    // Keep references to the copied weapon instances in targeted Edges.
    const mapping = new Map(
      source.document.inventory.map((i, index) => [i.id, c.inventory[index].id]),
    );
    c.build.edges = c.build.edges.map((e) => ({ ...e, target: mapping.get(e.target) ?? e.target }));
    c.rulings = c.rulings.map((r) => ({ ...r, id: crypto.randomUUID() }));
    return json(repository().create(locals.user.id, c.name, characterSchema.parse(c)), {
      status: 201,
    });
  } catch (e) {
    return apiError(e);
  }
}
