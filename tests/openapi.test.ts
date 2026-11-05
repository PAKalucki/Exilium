import { it, expect } from 'vitest';
import { openApiDocument } from '../src/lib/server/openapi';
import { equipmentDocumentSchema, equipmentCommandSchema } from '../src/lib/compendium';
it('publishes resolvable OpenAPI schemas, live contract examples, and scope/role semantics', () => {
  const spec = openApiDocument('0.2.0');
  expect(spec.openapi).toBe('3.1.0');
  expect(spec.info.version).toBe('0.2.0');
  expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if ('$ref' in value) {
      const path = String(value.$ref);
      expect(path.startsWith('#/')).toBe(true);
      let resolved: unknown = spec;
      for (const key of path.slice(2).split('/'))
        resolved = (resolved as Record<string, unknown>)[
          key.replaceAll('~1', '/').replaceAll('~0', '~')
        ];
      expect(resolved).toBeDefined();
    }
    Object.values(value).forEach(walk);
  };
  walk(spec);
  equipmentDocumentSchema.parse(
    spec.paths['/api/compendium'].post.requestBody.content['application/json'].example.document,
  );
  for (const example of Object.values(
    spec.paths['/api/compendium/{id}'].post.requestBody.content['application/json'].examples,
  ))
    equipmentCommandSchema.parse(example.value.command);
  expect(spec.paths['/api/compendium'].post['x-required-scopes']).toEqual(['compendium:write']);
  expect(spec.paths['/api/characters/{id}'].get['x-required-scopes']).toEqual(['read']);
  expect(spec.paths['/api/diagnostics'].get.description).toContain('MG');
  expect(spec.paths['/api/health'].get.security).toEqual([]);
});
