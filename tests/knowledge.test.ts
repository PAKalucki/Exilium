import { describe, it, expect } from 'vitest';
import { newCharacter } from '../src/lib/rules/model';
import { addKnowledgeSkill, renameKnowledge, removeKnowledge } from '../src/lib/rules/knowledge';
import { creationBudget, validateCreation } from '../src/lib/rules/engine';
describe('editing custom Knowledge fields', () => {
  it('renames a specialization without losing its die or targeted Edge references', () => {
    const c = newCharacter();
    addKnowledgeSkill(c, 'Elektronika');
    addKnowledgeSkill(c, 'Historia');
    c.build.skills['knowledge:Elektronika'] = 8;
    c.build.skills['knowledge:Historia'] = 8;
    c.build.edges = [{ id: 'scholar', target: 'knowledge:Elektronika|knowledge:Historia' }];
    const before = creationBudget(c).skillSpent;
    renameKnowledge(c, 'knowledge:Elektronika', 'Technika kolonialna');
    expect(c.build.skills['knowledge:Technika kolonialna']).toBe(8);
    expect(c.build.skills['knowledge:Elektronika']).toBeUndefined();
    expect(c.build.edges[0].target).toBe('knowledge:Technika kolonialna|knowledge:Historia');
    expect(creationBudget(c).skillSpent).toBe(before);
  });
  it('removes a specialization, refunds its cost and flags missing scholar choices', () => {
    const c = newCharacter();
    c.build.attributes.smarts = 8;
    addKnowledgeSkill(c, 'Elektronika');
    addKnowledgeSkill(c, 'Historia');
    c.build.skills['knowledge:Elektronika'] = 8;
    c.build.skills['knowledge:Historia'] = 8;
    c.build.edges = [{ id: 'scholar', target: 'knowledge:Elektronika|knowledge:Historia' }];
    const before = creationBudget(c).skillSpent;
    expect(removeKnowledge(c, 'knowledge:Elektronika')).toBe(true);
    expect(creationBudget(c).skillSpent).toBe(before - 3);
    expect(c.build.edges[0].target).toBe('|knowledge:Historia');
    expect(validateCreation(c).some((i) => i.code.includes('scholar.target'))).toBe(true);
  });
  it('rejects empty or duplicate names without changing existing skills', () => {
    const c = newCharacter();
    addKnowledgeSkill(c, 'Elektronika');
    addKnowledgeSkill(c, 'Historia');
    const before = JSON.stringify(c);
    expect(() => renameKnowledge(c, 'knowledge:Elektronika', 'historia')).toThrow('już istnieje');
    expect(() => renameKnowledge(c, 'knowledge:Elektronika', ' ')).toThrow();
    expect(() => removeKnowledge(c, 'fighting')).toThrow();
    expect(JSON.stringify(c)).toBe(before);
  });
});
