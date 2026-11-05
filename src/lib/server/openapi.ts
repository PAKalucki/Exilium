import { z } from 'zod';
import { equipmentDocumentSchema, equipmentCommandSchema } from '../compendium';
import { characterSchema, newItem } from '../rules/model';

const schema = (value: z.ZodType) =>
  z.toJSONSchema(value, { target: 'draft-2020-12', unrepresentable: 'any' });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const content = (value: unknown) => ({ 'application/json': { schema: value } });
const response = (description: string, value: unknown) => ({
  description,
  content: content(value),
});
const errorResponses = {
  401: response('Brak, nieprawidłowe lub wygasłe uwierzytelnienie.', ref('ApiError')),
  403: response('Niedozwolona rola, zakres tokena lub Origin.', ref('ApiError')),
  404: response('Nie znaleziono zasobu dostępnego dla tej osoby.', ref('ApiError')),
};
const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'UUID zasobu.',
  schema: { type: 'string', format: 'uuid' },
};
export function openApiDocument(version: string) {
  const documentExample = {
    category: 'Narzędzia',
    source: 'Exilium — propozycja gracza',
    item: {
      ...newItem(),
      name: 'Przenośne imadło',
      price: 20,
      notes: 'Propozycja do uzgodnienia z MG.',
    },
  };
  const reads = <T extends Record<string, unknown> = Record<never, never>>(
    summary: string,
    tag: string,
    value: unknown,
    extra: T = {} as T,
  ) => ({
    summary,
    tags: [tag],
    security: [{ bearerAuth: [] }],
    'x-required-scopes': ['read'],
    responses: { 200: response('Odczyt zakończony powodzeniem.', value), ...errorResponses },
    ...extra,
  });
  const writeResponses = {
    ...errorResponses,
    409: response(
      'Konflikt rewizji lub ponowne użycie commandId dla innego działania. Wczytaj aktualne dane.',
      ref('ApiError'),
    ),
    413: response('Za duży dokument.', ref('ApiError')),
    422: response('Nieprawidłowe wartości lub niedozwolone przejście stanu.', ref('ApiError')),
  };
  return {
    openapi: '3.1.0',
    info: {
      title: 'Exilium API',
      version,
      description:
        'API automatyzacji Exilium. Utwórz token w Moje konto → API. Zakres read pozwala czytać, compendium:write zmienia kompendium. Bieżąca rola właściciela tokena jest sprawdzana przy każdym żądaniu. Gracz zgłasza przedmioty do zatwierdzenia przez MG/Admin. Prywatność kart obowiązuje także w API i eksportach. Publiczny host jest dostępny z Polski; klienci poza Polską mogą użyć reverse proxy. Zarządzanie kontami, rolami, tokenami i zapis kart wymaga sesji przeglądarki i nie należy do API automatyzacji.',
    },
    servers: [
      {
        url: '/',
        description:
          'Bieżący host aplikacji (HTTPS publiczne lub reverse proxy; lokalnie również HTTP)',
      },
    ],
    tags: [
      { name: 'Status', description: 'Stan aplikacji i tożsamość' },
      { name: 'Postacie', description: 'Odczyt kart z prywatnością według roli' },
      { name: 'Kompendium', description: 'Odczyt, zgłoszenia i moderacja przedmiotów' },
      { name: 'Diagnostyka', description: 'Odczyt dla MG i administratora' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Personal API token (exi_...)',
          description:
            'Wklej sam token z /account, bez prefiksu Bearer. Nie jest to token Discord.',
        },
      },
      schemas: {
        Character: schema(characterSchema),
        CharacterRecord: {
          type: 'object',
          required: ['id', 'ownerId', 'ownerName', 'revision', 'status', 'updatedAt', 'document'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            ownerId: { type: 'string', format: 'uuid' },
            ownerName: { type: 'string' },
            revision: { type: 'integer', minimum: 1 },
            status: { enum: ['draft', 'active', 'archived'] },
            updatedAt: { type: 'string', format: 'date-time' },
            document: ref('Character'),
            redacted: { type: 'array', items: { enum: ['background', 'origin', 'equipment'] } },
            visibleStats: {
              type: 'object',
              description: 'Publiczne współczynniki z pełnej karty, gdy ekwipunek jest ukryty.',
              properties: Object.fromEntries(
                [
                  'parry',
                  'totalToughness',
                  'toughness',
                  'armor',
                  'pace',
                  'running',
                  'charisma',
                ].map((key) => [key, { type: 'number' }]),
              ),
            },
          },
        },
        EquipmentDocument: schema(equipmentDocumentSchema),
        EquipmentRecord: {
          type: 'object',
          required: ['id', 'revision', 'status', 'approvalStatus', 'document'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            revision: { type: 'integer', minimum: 1 },
            status: { enum: ['active', 'archived'] },
            approvalStatus: { enum: ['pending', 'approved', 'rejected'] },
            reviewNote: { type: 'string' },
            createdBy: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            createdByName: { type: 'string' },
            updatedByName: { type: 'string' },
            document: ref('EquipmentDocument'),
          },
        },
        EquipmentEvent: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            kind: { enum: ['create', 'update', 'archive', 'restore', 'approve', 'reject'] },
            date: { type: 'string', format: 'date-time' },
            actorName: { type: 'string' },
            reviewNote: { type: 'string' },
            before: { anyOf: [ref('EquipmentDocument'), { type: 'null' }] },
            after: ref('EquipmentDocument'),
          },
        },
        CreateEquipment: schema(
          z.object({ commandId: z.string().uuid(), document: equipmentDocumentSchema }).strict(),
        ),
        ChangeEquipment: schema(
          z
            .object({
              commandId: z.string().uuid(),
              revision: z.number().int().min(1),
              command: equipmentCommandSchema,
            })
            .strict(),
        ),
        ApiError: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: { field: { type: 'string' }, message: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    paths: {
      '/api/health': {
        get: reads(
          'Stan i wersja aplikacji',
          'Status',
          {
            type: 'object',
            properties: {
              status: { enum: ['ok', 'error'] },
              version: { type: 'string', example: version },
              authenticationConfigured: { type: 'boolean' },
            },
          },
          {
            security: [],
            'x-required-scopes': [],
            responses: {
              200: response('Aplikacja działa.', {
                type: 'object',
                properties: {
                  status: { const: 'ok' },
                  version: { type: 'string', example: version },
                  authenticationConfigured: { type: 'boolean' },
                },
              }),
              503: response('Baza danych niedostępna.', {
                type: 'object',
                properties: { status: { const: 'error' } },
              }),
            },
          },
        ),
      },
      '/api/me': {
        get: reads('Bieżący użytkownik, rola i zakresy tokena', 'Status', {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                role: { enum: ['player', 'gm', 'admin'] },
              },
            },
            scopes: { type: ['array', 'null'], items: { enum: ['read', 'compendium:write'] } },
          },
        }),
      },
      '/api/characters': {
        get: reads('Wszystkie karty dostępne użytkownikowi', 'Postacie', {
          type: 'array',
          items: ref('CharacterRecord'),
        }),
      },
      '/api/characters/{id}': {
        get: reads(
          'Karta postaci; ukryte sekcje są usuwane z odpowiedzi',
          'Postacie',
          ref('CharacterRecord'),
          { parameters: [idParameter] },
        ),
      },
      '/api/characters/{id}/pdf': {
        get: reads(
          'Eksport PDF z prywatnością według roli',
          'Postacie',
          {},
          {
            parameters: [idParameter],
            responses: {
              200: {
                description: 'Dokument PDF.',
                content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
              },
              ...errorResponses,
            },
          },
        ),
      },
      '/api/characters/{id}/portrait': {
        get: reads(
          'Portret zapisanej postaci',
          'Postacie',
          {},
          {
            parameters: [
              idParameter,
              {
                name: 'v',
                in: 'query',
                schema: { type: 'string', format: 'uuid' },
                description: 'Opcjonalny identyfikator aktualnego portretu.',
              },
              {
                name: 'If-None-Match',
                in: 'header',
                schema: { type: 'string' },
                description: 'ETag poprzedniej odpowiedzi.',
              },
            ],
            responses: {
              200: {
                description: 'Portret JPEG; Cache-Control: private, no-cache.',
                headers: { ETag: { schema: { type: 'string' } } },
                content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } } },
              },
              304: { description: 'Portret bez zmian, po ponownym sprawdzeniu uwierzytelnienia.' },
              ...errorResponses,
            },
          },
        ),
      },
      '/api/compendium': {
        get: reads(
          'Zatwierdzone aktywne przedmioty; opcjonalnie archiwum i widoczne zgłoszenia',
          'Kompendium',
          { type: 'array', items: ref('EquipmentRecord') },
          {
            parameters: [
              {
                name: 'archived',
                in: 'query',
                schema: { type: 'string', enum: ['0', '1'], default: '0' },
                description:
                  '1: dodaj zatwierdzone archiwum i własne zgłoszenia; MG/Admin widzi wszystkie zgłoszenia.',
              },
            ],
          },
        ),
        post: {
          summary: 'Zgłoś przedmiot (Gracz) lub opublikuj go (MG/Admin)',
          tags: ['Kompendium'],
          security: [{ bearerAuth: [] }],
          'x-required-scopes': ['compendium:write'],
          description:
            'Gracz otrzymuje approvalStatus=pending. Tylko zatwierdzone aktywne wpisy pojawiają się w kreatorze. Użyj nowego UUID commandId dla nowego działania. Ponowienie po utracie odpowiedzi musi mieć identyczny commandId i dokument. Zmiana kompendium nie modyfikuje kopii na kartach.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: ref('CreateEquipment'),
                example: { commandId: crypto.randomUUID(), document: documentExample },
              },
            },
          },
          responses: {
            201: response('Utworzono lub odtworzono wynik ponowienia.', ref('EquipmentRecord')),
            ...writeResponses,
          },
        },
      },
      '/api/compendium/{id}': {
        get: reads(
          'Wpis i ostatnie 100 zmian; cudze niezatwierdzone zgłoszenia są ukryte dla Graczy',
          'Kompendium',
          {
            type: 'object',
            properties: {
              record: ref('EquipmentRecord'),
              history: { type: 'array', items: ref('EquipmentEvent') },
            },
          },
          { parameters: [idParameter] },
        ),
        post: {
          summary: 'Zmień, zatwierdź, odrzuć, archiwizuj lub przywróć wpis',
          tags: ['Kompendium'],
          security: [{ bearerAuth: [] }],
          'x-required-scopes': ['compendium:write'],
          parameters: [idParameter],
          description:
            'Użyj aktualnej revision z GET i nowego commandId. Gracz może edytować lub archiwizować tylko swoje niezatwierdzone zgłoszenie. Edycja odrzuconego zgłasza je ponownie. Pozostałe działania wymagają MG/Admin. Odrzucenie wymaga note (3–1000 znaków). Edycja przez MG/Admin publikuje ich wersję. 409 wymaga odczytu i porównania danych, a nie ślepego ponowienia.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: ref('ChangeEquipment'),
                examples: {
                  approve: {
                    summary: 'MG/Admin: zatwierdź bieżące zgłoszenie',
                    value: {
                      commandId: crypto.randomUUID(),
                      revision: 1,
                      command: { type: 'approve' },
                    },
                  },
                  reject: {
                    summary: 'MG/Admin: odrzuć z powodem',
                    value: {
                      commandId: crypto.randomUUID(),
                      revision: 1,
                      command: { type: 'reject', note: 'Uzgodnij cenę i parametry z MG.' },
                    },
                  },
                  update: {
                    summary: 'Pełny dokument po edycji',
                    value: {
                      commandId: crypto.randomUUID(),
                      revision: 1,
                      command: { type: 'update', document: documentExample },
                    },
                  },
                  archive: {
                    summary: 'Archiwizuj',
                    value: {
                      commandId: crypto.randomUUID(),
                      revision: 1,
                      command: { type: 'archive' },
                    },
                  },
                  restore: {
                    summary: 'MG/Admin: przywróć',
                    value: {
                      commandId: crypto.randomUUID(),
                      revision: 1,
                      command: { type: 'restore' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: response(
              'Zapisano zmianę lub odtworzono wynik ponowienia.',
              ref('EquipmentRecord'),
            ),
            ...writeResponses,
          },
        },
      },
      '/api/diagnostics': {
        get: reads(
          'Diagnostyka MG/Admin bez sekretów ani treści kart',
          'Diagnostyka',
          {
            type: 'object',
            properties: {
              version: { type: 'string' },
              schema: { type: 'integer' },
              database: { type: 'string' },
              counts: {
                type: 'object',
                properties: Object.fromEntries(
                  ['users', 'characters', 'equipment', 'pendingEquipment'].map((key) => [
                    key,
                    { type: 'integer' },
                  ]),
                ),
              },
            },
          },
          { description: 'Wymaga zakresu read i bieżącej roli MG lub Administratora.' },
        ),
      },
      '/api/openapi.json': {
        get: reads('Specyfikacja OpenAPI tej wersji aplikacji', 'Status', { type: 'object' }),
      },
    },
  };
}
