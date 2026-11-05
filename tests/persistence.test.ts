import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Repository, DomainError } from '../src/lib/server/db';
import { execute, type Command } from '../src/lib/server/commands';
import { newItem } from '../src/lib/rules/model';
import { availableAdvances, effectiveBuild } from '../src/lib/rules/engine';
import { sample } from './fixtures';
let repo: Repository, owner: string, other: string, id: string;
const send = (
  command: Command,
  commandId = crypto.randomUUID(),
  revision = repo.get(owner, id).revision,
) => execute(repo, owner, id, { revision, commandId, command });
beforeEach(() => {
  repo = new Repository(':memory:');
  owner = repo.user('100000000000000001', 'A').id;
  other = repo.user('100000000000000002', 'B').id;
  id = repo.create(owner, 'Łucja', sample()).id;
});
afterEach(() => repo.db.close());
describe('private transactional character storage', () => {
  it('blocks another owner from reads, writes and history', () => {
    expect(() => repo.get(other, id)).toThrow(DomainError);
    expect(() => repo.history(other, id)).toThrow(DomainError);
    expect(() =>
      execute(repo, other, id, {
        revision: 1,
        commandId: crypto.randomUUID(),
        command: { type: 'tracker', field: 'bennies', delta: -1 },
      }),
    ).toThrow('Nie znaleziono');
    expect(repo.list(other)).toEqual([]);
    expect(repo.get(owner, id).revision).toBe(1);
  });
  it('deduplicates retries before the revision check, but rejects key reuse with a different command', () => {
    const commandId = crypto.randomUUID();
    send({ type: 'tracker', field: 'bennies', delta: -1 }, commandId, 1);
    send({ type: 'tracker', field: 'bennies', delta: -1 }, commandId, 1);
    expect(repo.get(owner, id).document.conditions.bennies).toBe(2);
    expect(repo.history(owner, id)).toHaveLength(1);
    expect(() => send({ type: 'tracker', field: 'bennies', delta: 1 }, commandId, 1)).toThrow(
      'innego żądania',
    );
  });
  it('rejects stale concurrent writes and preserves the first accepted update', () => {
    send({ type: 'tracker', field: 'wounds', delta: 1 });
    expect(() =>
      send({ type: 'tracker', field: 'wounds', delta: 1 }, crypto.randomUUID(), 1),
    ).toThrow('innej karcie');
    expect(repo.get(owner, id).document.conditions.wounds).toBe(1);
  });
  it('finalizes with 400 dollars minus equipment and locks the original build', () => {
    const c = sample();
    c.inventory.push({ ...newItem(), name: 'Sztylet', price: 25 });
    send({ type: 'saveDraft', document: c });
    let r = send({ type: 'finalize' });
    expect(r.document.cash).toBe(375);
    expect(r.status).toBe('active');
    expect(() => send({ type: 'saveDraft', document: c })).toThrow('zamknięta');
  });
  it('reloads atomically and does not generate rounds from a repeated request', () => {
    const item = {
      ...newItem(),
      kind: 'weapon' as const,
      name: 'Rewolwer',
      capacity: 6,
      loaded: 1,
      reserve: 8,
    };
    send({ type: 'item', item, purchase: false });
    const commandId = crypto.randomUUID(),
      revision = repo.get(owner, id).revision;
    send({ type: 'reload', id: item.id }, commandId, revision);
    send({ type: 'reload', id: item.id }, commandId, revision);
    expect(repo.get(owner, id).document.inventory[0]).toMatchObject({ loaded: 6, reserve: 3 });
    expect(() => send({ type: 'fire', id: item.id, rounds: 7 })).toThrow('Brak amunicji');
    expect(repo.get(owner, id).document.inventory[0].loaded).toBe(6);
  });
  it('rolls back an invalid monetary operation and creates no audit entry', () => {
    send({ type: 'finalize' });
    const before = repo.get(owner, id),
      events = repo.history(owner, id).length;
    expect(() => send({ type: 'money', currency: 'cash', delta: -401, note: 'Zakup' })).toThrow(
      'Brak środków',
    );
    expect(repo.get(owner, id)).toEqual(before);
    expect(repo.history(owner, id)).toHaveLength(events);
  });
  it('commits XP, advances and their audit/projection rows together', () => {
    send({ type: 'finalize' });
    send({ type: 'xp', amount: 5, note: 'Sesja 1' });
    let r = send({
      type: 'advance',
      choice: { kind: 'skill', target: 'fighting', second: '', edgeTarget: '', note: 'Trening' },
    });
    expect(effectiveBuild(r.document).skills.fighting).toBe(8);
    expect(availableAdvances(r.document)).toBe(0);
    expect(repo.db.prepare('SELECT count(*) n FROM xp_entries').get()?.n).toBe(1);
    expect(repo.db.prepare('SELECT count(*) n FROM advancements').get()?.n).toBe(1);
    expect(() => send({ type: 'xp', amount: -1, note: 'Korekta' })).toThrow('więcej wydanych');
  });
  it('undoes only the last change, including development projections', () => {
    send({ type: 'finalize' });
    send({ type: 'xp', amount: 5, note: 'Sesja' });
    send({
      type: 'advance',
      choice: { kind: 'attribute', target: 'agility', second: '', edgeTarget: '', note: '' },
    });
    const r = send({ type: 'undo' });
    expect(availableAdvances(r.document)).toBe(1);
    expect(effectiveBuild(r.document).attributes.agility).toBe(6);
    expect(repo.db.prepare('SELECT count(*) n FROM advancements').get()?.n).toBe(0);
    expect(() => send({ type: 'undo' })).toThrow('ostatnią zmianę');
  });
  it('preserves draft status through archive/restore and cannot bypass finalization', () => {
    send({ type: 'archive' });
    expect(() => send({ type: 'xp', amount: 5, note: 'Sesja' })).toThrow('tylko do odczytu');
    expect(send({ type: 'restore' }).status).toBe('draft');
  });
  it('session reset affects only Fuksy', () => {
    send({ type: 'tracker', field: 'wounds', delta: 2 });
    send({ type: 'condition', field: 'shaken', value: true });
    send({ type: 'tracker', field: 'bennies', delta: -2 });
    const r = send({ type: 'resetSession', confirmed: true });
    expect(r.document.conditions).toMatchObject({ wounds: 2, shaken: true, bennies: 3 });
  });
  it('revokes expired or disabled sessions', () => {
    const user = repo.user('100000000000000003', 'C'),
      token = repo.createSession(user);
    expect(repo.session(token)?.id).toBe(user.id);
    repo.db.prepare('UPDATE users SET enabled=0 WHERE id=?').run(user.id);
    expect(repo.session(token)).toBe(null);
  });
});
