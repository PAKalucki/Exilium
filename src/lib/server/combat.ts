import { createHash, randomInt, randomUUID } from 'node:crypto';
import {
  combatChangeSchema,
  combatDocumentSchema,
  createCombatSchema,
  initiativeUnitSchema,
  participantSchema,
  type CombatRecord,
  type CombatSummary,
  type CombatView,
} from '../combat';
import { managesGame } from '../access';
import type { Repository } from './db';
import { DomainError } from './errors';
import { characterForViewer, requirePrivateCharacterAccess } from './visibility';
import {
  beginTurn,
  cardZones,
  damageOutcome,
  dealRound,
  newCombat,
  selectNext,
  startCombat,
  unitAlive,
  type CombatCharacters,
} from '../rules/combat';
import { cardInfo, jokerBonus } from '../combat';
import type { Character, CharacterRecord } from '../rules/model';
import { execute } from './commands';
import { derived } from '../rules/engine';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const random = () => randomInt(0x100000000) / 0x100000000;
export class CombatRepository {
  constructor(private repo: Repository) {
    this.transaction(() => {
      if (this.repo.db.prepare('SELECT 1 FROM schema_migrations WHERE version=6').get()) return;
      this.repo.db.exec(`
        CREATE TABLE combats(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL,document TEXT NOT NULL CHECK(json_valid(document)));
        CREATE TABLE combat_events(id INTEGER PRIMARY KEY,combat_id TEXT NOT NULL REFERENCES combats(id),actor_id TEXT NOT NULL REFERENCES users(id),command_id TEXT NOT NULL,command_hash TEXT NOT NULL,kind TEXT NOT NULL,date TEXT NOT NULL,round INTEGER NOT NULL,before_document TEXT,after_document TEXT NOT NULL,UNIQUE(actor_id,command_id));
        CREATE INDEX combat_events_combat ON combat_events(combat_id,id);
        INSERT INTO schema_migrations VALUES(6,datetime('now'));
      `);
    });
  }
  private transaction<T>(work: () => T): T {
    this.repo.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.repo.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.repo.db.exec('ROLLBACK');
      throw e;
    }
  }
  private manager(actorId: string) {
    const user = this.repo.identity.user(actorId);
    if (!managesGame(user)) throw new DomainError(403, 'Walkę prowadzi MG lub administrator.');
    return user;
  }
  read(id: string): CombatRecord {
    const row = this.repo.db.prepare('SELECT * FROM combats WHERE id=?').get(id);
    if (!row) throw new DomainError(404, 'Nie znaleziono starcia.');
    return {
      id: String(row.id),
      revision: Number(row.revision),
      createdBy: String(row.created_by),
      updatedAt: String(row.updated_at),
      document: combatDocumentSchema.parse(JSON.parse(String(row.document))),
    };
  }
  list(actorId: string): CombatSummary[] {
    this.repo.identity.user(actorId);
    return this.repo.db
      .prepare('SELECT * FROM combats ORDER BY updated_at DESC,id')
      .all()
      .map((row) => {
        const c = combatDocumentSchema.parse(JSON.parse(String(row.document)));
        return {
          id: String(row.id),
          name: c.name,
          revision: Number(row.revision),
          phase: c.phase,
          round: c.round,
          participants: c.participants.length,
          updatedAt: String(row.updated_at),
        };
      });
  }
  view(id: string, actorId: string, reveal = false): CombatView {
    const user = this.repo.identity.user(actorId),
      record = this.read(id),
      c = record.document;
    const sources = c.participants.map((p) => this.repo.read(p.characterId));
    const privateOther = sources.some(
      (r) => r.ownerId !== user.id && Object.values(r.document.privacy).some(Boolean),
    );
    const canReveal = user.role === 'admin' && privateOther;
    const canManage = managesGame(user) && (!canReveal || reveal);
    const { deck, discard: _discard, participants, reserve, ...shared } = c;
    return {
      ...shared,
      id,
      revision: record.revision,
      updatedAt: record.updatedAt,
      canManage,
      canReveal,
      revealed: canReveal && reveal,
      units: c.units.map((u) => ({ ...u, draws: canManage ? u.draws : [] })),
      participants: participants.map((p, index) => {
        const character = characterForViewer(sources[index], user, reveal);
        return {
          ...p,
          ...(character.redacted?.includes('statistics')
            ? {
                prone: false,
                defending: false,
                wildAttack: false,
                notes: '',
                recoveryRound: 0,
                fullDefense: null,
              }
            : {}),
          character,
        };
      }),
      reserve: canManage ? reserve : [],
      tacticianId: canManage ? c.tacticianId : null,
      remainingCards: canManage ? deck.length : null,
      history: this.repo.db
        .prepare(
          'SELECT kind,date,round FROM combat_events WHERE combat_id=? ORDER BY id DESC LIMIT 60',
        )
        .all(id) as CombatView['history'],
    };
  }
  private retry(actor: string, commandId: string, hash: string) {
    const event = this.repo.db
      .prepare('SELECT combat_id,command_hash FROM combat_events WHERE actor_id=? AND command_id=?')
      .get(actor, commandId);
    if (!event) return null;
    if (event.command_hash !== hash)
      throw new DomainError(409, 'Identyfikator działania został już użyty do innego żądania.');
    return this.read(String(event.combat_id));
  }
  private event(
    record: CombatRecord,
    actor: string,
    commandId: string,
    hash: string,
    kind: string,
    before: string | null,
  ) {
    this.repo.db
      .prepare(
        'INSERT INTO combat_events(combat_id,actor_id,command_id,command_hash,kind,date,round,before_document,after_document) VALUES(?,?,?,?,?,?,?,?,?)',
      )
      .run(
        record.id,
        actor,
        commandId,
        hash,
        kind,
        record.updatedAt,
        record.document.round,
        before,
        JSON.stringify(record.document),
      );
  }
  create(actor: string, input: unknown) {
    this.manager(actor);
    const { name, commandId } = createCombatSchema.parse(input),
      hash = digest({ type: 'create', name });
    return this.transaction(() => {
      const retry = this.retry(actor, commandId, hash);
      if (retry) return retry;
      const record: CombatRecord = {
        id: randomUUID(),
        revision: 1,
        createdBy: actor,
        updatedAt: new Date().toISOString(),
        document: newCombat(name),
      };
      this.repo.db
        .prepare('INSERT INTO combats VALUES(?,?,?,?,?)')
        .run(record.id, 1, actor, record.updatedAt, JSON.stringify(record.document));
      this.event(record, actor, commandId, hash, 'create', null);
      return record;
    });
  }
  private available(characterId: string, combatId: string) {
    for (const row of this.repo.db
      .prepare(
        "SELECT id,document FROM combats WHERE id!=? AND json_extract(document,'$.phase')='active'",
      )
      .all(combatId)) {
      const other = combatDocumentSchema.parse(JSON.parse(String(row.document)));
      if (other.participants.some((p) => p.characterId === characterId))
        throw new DomainError(409, 'Ta postać bierze już udział w innej trwającej walce.');
    }
  }
  change(actor: string, id: string, input: unknown, reveal = false) {
    const user = this.manager(actor),
      { revision, commandId, command } = combatChangeSchema.parse(input),
      hash = digest({ id, command });
    return this.transaction(() => {
      const record = this.read(id),
        c = record.document;
      const sources = new Map(
        c.participants.map((p) => [p.characterId, this.repo.read(p.characterId)]),
      );
      for (const source of sources.values()) requirePrivateCharacterAccess(source, user, reveal);
      const retried = this.retry(actor, commandId, hash);
      if (retried) return retried;
      if (record.revision !== revision)
        throw new DomainError(
          409,
          'Walka zmieniła się w innym oknie. Odśwież stan przed ponowną zmianą.',
        );
      if (c.phase === 'finished')
        throw new DomainError(422, 'Zakończone starcie jest tylko do odczytu.');
      const before = JSON.stringify(c);
      const characters: CombatCharacters = new Map(
        [...sources].map(([key, r]) => [key, r.document]),
      );
      const sourceFor = (characterId: string, expected?: number) => {
        const source = sources.get(characterId);
        if (!source) throw new DomainError(422, 'Nie znaleziono uczestnika walki.');
        if (source.status === 'archived')
          throw new DomainError(422, 'Najpierw przywróć zarchiwizowaną kartę postaci.');
        if (expected !== undefined && source.revision !== expected)
          throw new DomainError(
            409,
            'Karta postaci zmieniła się. Odśwież walkę przed zmianą stanu.',
          );
        return source;
      };
      const applyConditions = (source: CharacterRecord, conditions: Character['conditions']) => {
        const saved = this.repo.mutate(
          actor,
          source.id,
          source.revision,
          commandId,
          { type: 'combat', combatId: id, command },
          (r) => {
            r.document.conditions = conditions;
          },
        );
        sources.set(source.id, saved);
        characters.set(source.id, saved.document);
      };
      const spend = (source: CharacterRecord, pool: 'personal' | 'gm') => {
        const unit = c.units.find((u) => u.members.includes(source.id))!;
        if (pool === 'gm') {
          if (unit.side !== 'gm' && source.document.category !== 'extra')
            throw new DomainError(422, 'Pula MG służy Bohaterom Niezależnym.');
          if (!c.gmBennies) throw new DomainError(422, 'Brak fuksów w puli MG.');
          c.gmBennies--;
        } else {
          if (source.document.category === 'extra' || !source.document.conditions.bennies)
            throw new DomainError(422, 'Brak osobistego fuksa. Blotki korzystają z puli MG.');
          source.document.conditions.bennies--;
        }
      };
      const current = () => {
        const u = c.units.find((u) => u.id === c.currentId);
        if (!u) throw new DomainError(422, 'Nie trwa teraz żadna tura.');
        return u;
      };
      const held = (unitId: string) => {
        const u = c.units.find((u) => u.id === unitId);
        if (!u || u.state !== 'held' || !unitAlive(u, characters))
          throw new DomainError(422, 'Ta grupa nie ma gotowej wstrzymanej akcji.');
        if (c.afterCurrentId === unitId)
          throw new DomainError(422, 'Ta akcja czeka już na koniec bieżącej tury.');
        return u;
      };
      try {
        if (
          c.awaitingTactics &&
          ['complete', 'hold', 'activate', 'interrupt', 'nextRound', 'recover'].includes(
            command.type,
          )
        )
          throw new DomainError(422, 'Najpierw rozstrzygnij karty Taktyka i zatwierdź inicjatywę.');
        if (
          !['rename', 'add', 'remove', 'unit', 'start', 'finish', 'notes'].includes(command.type) &&
          c.phase !== 'active'
        )
          throw new DomainError(422, 'Najpierw rozpocznij walkę.');
        switch (command.type) {
          case 'rename':
            c.name = command.name;
            break;
          case 'add': {
            if (c.participants.some((p) => p.characterId === command.characterId))
              throw new DomainError(
                422,
                'Ta postać jest już w walce. Dla kolejnej Blotki utwórz osobną kopię karty.',
              );
            const source = this.repo.read(command.characterId);
            if (source.status !== 'active')
              throw new DomainError(422, 'Do walki dodaj zatwierdzoną, niezarchiwizowaną postać.');
            requirePrivateCharacterAccess(source, user, reveal);
            if (c.phase === 'active') this.available(source.id, id);
            const unit = command.unitId ? c.units.find((u) => u.id === command.unitId) : null;
            if (command.unitId && (!unit || c.phase !== 'setup'))
              throw new DomainError(422, 'Wspólne grupy ustaw przed rozpoczęciem walki.');
            if (unit) {
              if (source.document.category !== 'extra')
                throw new DomainError(
                  422,
                  'Każda Figura otrzymuje własną kartę. Do grupy dołącz Blotkę.',
                );
              if (unit.side !== command.side)
                throw new DomainError(422, 'Postacie grupy muszą mieć tego samego kontrolującego.');
              unit.members.push(source.id);
            } else
              c.units.push(
                initiativeUnitSchema.parse({
                  id: randomUUID(),
                  name: source.document.name,
                  members: [source.id],
                  leaderId: source.id,
                  side: command.side,
                }),
              );
            c.participants.push(participantSchema.parse({ characterId: source.id }));
            characters.set(source.id, source.document);
            break;
          }
          case 'remove': {
            const unit = c.units.find((u) => u.members.includes(command.characterId));
            if (!unit) throw new DomainError(422, 'Nie znaleziono uczestnika.');
            if (unit.id === c.currentId || c.simultaneousIds.includes(unit.id))
              throw new DomainError(422, 'Najpierw zakończ bieżącą turę grupy.');
            unit.members = unit.members.filter((member) => member !== command.characterId);
            if (!unit.members.length) {
              if (unit.card) c.discard.push(unit.card);
              c.units = c.units.filter((u) => u.id !== unit.id);
              c.resumeIds = c.resumeIds.filter((uid) => uid !== unit.id);
              if (c.afterCurrentId === unit.id) c.afterCurrentId = null;
            } else if (unit.leaderId === command.characterId) unit.leaderId = unit.members[0];
            c.participants = c.participants.filter((p) => p.characterId !== command.characterId);
            break;
          }
          case 'unit': {
            if (c.phase !== 'setup')
              throw new DomainError(422, 'Zaskoczenie i grupy ustaw przed walką.');
            const u = c.units.find((u) => u.id === command.unitId);
            if (!u) throw new DomainError(422, 'Nie znaleziono grupy.');
            Object.assign(u, {
              name: command.name,
              opening: command.opening,
              notice: command.notice,
            });
            break;
          }
          case 'start':
            for (const p of c.participants) this.available(p.characterId, id);
            c.gmBennies = command.gmBennies;
            startCombat(c, characters, random, command.tacticianId, command.tacticsResult);
            break;
          case 'ready':
            if (!c.awaitingTactics) throw new DomainError(422, 'Inicjatywa jest już zatwierdzona.');
            c.awaitingTactics = false;
            selectNext(c, characters);
            break;
          case 'nextRound':
            if (
              c.currentId ||
              c.simultaneousIds.length ||
              c.units.some((u) => u.state === 'waiting' && unitAlive(u, characters))
            )
              throw new DomainError(
                422,
                'Najpierw zakończ lub wstrzymaj wszystkie tury tej rundy.',
              );
            dealRound(c, characters, random);
            break;
          case 'complete':
            c.simultaneousIds = c.simultaneousIds.filter((uid) => uid !== current().id);
            current().state = 'done';
            c.actions++;
            selectNext(c, characters, true);
            break;
          case 'hold': {
            const u = current();
            if (
              u.members.some((member) => {
                const p = c.participants.find((p) => p.characterId === member)!;
                return characters.get(member)!.conditions.shaken && p.recoveryRound === c.round;
              })
            )
              throw new DomainError(
                422,
                'Po nieudanym wyjściu z Szoku zakończ turę; pozostały tylko akcje darmowe.',
              );
            u.state = 'held';
            c.actions++;
            selectNext(c, characters);
            break;
          }
          case 'activate': {
            const u = held(command.unitId);
            if (c.currentId) c.resumeIds.push(c.currentId);
            beginTurn(c, u);
            c.actions++;
            break;
          }
          case 'interrupt': {
            const u = held(command.unitId),
              other = current();
            if (c.simultaneousIds.length)
              throw new DomainError(422, 'Najpierw rozstrzygnij jednoczesne akcje.');
            if (c.afterCurrentId)
              throw new DomainError(422, 'Najpierw rozstrzygnij oczekujące przerwanie.');
            if (!jokerBonus(u, c.round) && command.agility < command.opponent) {
              c.afterCurrentId = u.id;
              break;
            }
            if (!jokerBonus(u, c.round) && command.agility === command.opponent)
              c.simultaneousIds = [u.id, other.id];
            c.resumeIds.push(other.id);
            beginTurn(c, u);
            c.actions++;
            break;
          }
          case 'tactic': {
            if (!c.awaitingTactics || !c.tacticianId || c.tacticUsedRound === c.round || c.actions)
              throw new DomainError(
                422,
                'Taktyk może przekazać jedną kartę na początku rundy, przed działaniami.',
              );
            const index = c.reserve.indexOf(command.card),
              unit = c.units.find((u) => u.id === command.unitId),
              tactician = c.units.find((u) => u.members.includes(c.tacticianId!));
            if (
              index < 0 ||
              !unit ||
              !tactician ||
              unit.side !== tactician.side ||
              !unit.card ||
              unit.cardRound !== c.round ||
              unit.state === 'done' ||
              unit.state === 'skipped'
            )
              throw new DomainError(422, 'Wybierz sojusznika z kartą otrzymaną w tej rundzie.');
            c.reserve.splice(index, 1);
            const members = command.memberIds ? [...new Set(command.memberIds)] : unit.members;
            if (members.some((id) => !unit.members.includes(id)))
              throw new DomainError(422, 'Wybierz członków wskazanej grupy.');
            const state = cardInfo(command.card).joker ? 'held' : 'waiting';
            if (members.length < unit.members.length) {
              if (members.some((id) => characters.get(id)!.category !== 'extra'))
                throw new DomainError(422, 'Osobną grupę z karty Taktyka tworzą Blotki.');
              unit.members = unit.members.filter((id) => !members.includes(id));
              if (!unit.members.includes(unit.leaderId)) unit.leaderId = unit.members[0];
              c.units.push(
                initiativeUnitSchema.parse({
                  id: randomUUID(),
                  name: members
                    .map((id) => characters.get(id)!.name)
                    .join(', ')
                    .slice(0, 160),
                  members,
                  leaderId: members[0],
                  side: unit.side,
                  returnTo: unit.id,
                  card: command.card,
                  cardRound: c.round,
                  state,
                }),
              );
            } else {
              c.discard.push(unit.card);
              unit.card = command.card;
              unit.draws = [];
              unit.state = state;
            }
            if (cardInfo(command.card).joker) c.shuffleAfterRound = true;
            c.tacticUsedRound = c.round;
            c.awaitingTactics = false;
            selectNext(c, characters);
            break;
          }
          case 'gmBenny':
            if (c.gmBennies + command.delta < 0 || c.gmBennies + command.delta > 10000)
              throw new DomainError(422, 'Pula fuksów wykracza poza dozwolony zakres.');
            c.gmBennies += command.delta;
            break;
          case 'tracker':
          case 'condition': {
            const source = sourceFor(command.characterId, command.characterRevision);
            const characterCommand =
              command.type === 'tracker'
                ? { type: 'tracker' as const, field: command.field, delta: command.delta }
                : { type: 'condition' as const, field: command.field, value: command.value };
            const saved = execute(this.repo, actor, source.id, {
              revision: source.revision,
              commandId,
              command: characterCommand,
            });
            characters.set(source.id, saved.document);
            break;
          }
          case 'fullDefense': {
            sourceFor(command.characterId);
            const p = c.participants.find((p) => p.characterId === command.characterId)!;
            p.fullDefense = command.result;
            p.defending = false;
            p.wildAttack = false;
            break;
          }
          case 'maneuver': {
            sourceFor(command.characterId);
            const p = c.participants.find((p) => p.characterId === command.characterId)!;
            p[command.field] = command.value;
            if (command.value && command.field !== 'prone') p.fullDefense = null;
            if (command.value && command.field === 'defending') p.wildAttack = false;
            if (command.value && command.field === 'wildAttack') p.defending = false;
            break;
          }
          case 'notes': {
            sourceFor(command.characterId);
            c.participants.find((p) => p.characterId === command.characterId)!.notes =
              command.notes;
            break;
          }
          case 'recover': {
            const source = sourceFor(command.characterId, command.characterRevision);
            const p = c.participants.find((p) => p.characterId === source.id)!;
            if (
              !current().members.includes(source.id) ||
              !source.document.conditions.shaken ||
              derived(source.document).incapacitated ||
              p.recoveryRound === c.round
            )
              throw new DomainError(
                422,
                'Test Ducha wykonaj raz na początku własnej tury w Szoku.',
              );
            p.recoveryRound = c.round;
            if (command.result >= 4)
              applyConditions(source, { ...source.document.conditions, shaken: false });
            break;
          }
          case 'unshake': {
            const source = sourceFor(command.characterId, command.characterRevision);
            if (!source.document.conditions.shaken)
              throw new DomainError(422, 'Postać nie jest w Szoku.');
            spend(source, command.pool);
            applyConditions(source, { ...source.document.conditions, shaken: false });
            break;
          }
          case 'damage': {
            const source = sourceFor(command.characterId, command.characterRevision);
            const outcome = damageOutcome(
              source.document,
              command.damage,
              command.toughness,
              command.soaked,
            );
            if (command.soaked && command.pool === 'none')
              throw new DomainError(422, 'Wyparowanie wymaga fuksa. Wybierz jego pulę.');
            if (command.pool !== 'none') {
              if (!outcome.inflicted)
                throw new DomainError(422, 'Wyparowanie służy zapobieganiu Ranom.');
              spend(source, command.pool);
              outcome.conditions.bennies = source.document.conditions.bennies;
            }
            applyConditions(source, outcome.conditions);
            break;
          }
          case 'finish':
            c.phase = 'finished';
            c.simultaneousIds = [];
            c.awaitingTactics = false;
            c.currentId = null;
            c.resumeIds = [];
            c.afterCurrentId = null;
            break;
        }
        if (c.phase === 'active') {
          for (const u of c.units)
            if (!unitAlive(u, characters) && !c.simultaneousIds.includes(u.id)) u.state = 'skipped';
          if (c.currentId && c.units.find((u) => u.id === c.currentId)?.state === 'skipped')
            selectNext(c, characters, true);
        }
        const cards = cardZones(c);
        if (cards.length !== 54 || new Set(cards).size !== 54) throw Error('Niespójna talia kart.');
        record.document = combatDocumentSchema.parse(c);
      } catch (e) {
        if (e instanceof DomainError || (e instanceof Error && e.name === 'ZodError')) throw e;
        throw new DomainError(422, e instanceof Error ? e.message : 'Nieprawidłowa zmiana walki.');
      }
      record.updatedAt = new Date().toISOString();
      record.revision++;
      this.repo.db
        .prepare('UPDATE combats SET revision=?,updated_at=?,document=? WHERE id=?')
        .run(record.revision, record.updatedAt, JSON.stringify(record.document), id);
      this.event(
        record,
        actor,
        commandId,
        hash,
        command.type === 'interrupt' && c.simultaneousIds.length ? 'interruptTie' : command.type,
        before,
      );
      return record;
    });
  }
}
