import { describe, expect, it } from 'vitest';
import { mapColumns, orderKey, parseCsv, parseDate, parseImport, parseNumber } from './import';
import { ordersToCsv } from './orders';

describe('parseCsv', () => {
  it('point-virgule, guillemets doublés, BOM, lignes vides', () => {
    expect(parseCsv('\uFEFFa;b\r\n"x;1";"dit ""oui"""\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'dit "oui"'],
    ]);
  });
  it('virgule et tabulation détectées', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2')[1]).toEqual(['1', '2']);
  });
});

describe('parseNumber', () => {
  it.each([
    ['1 234,56', 1234.56],
    ['1234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['12,5 €', 12.5],
    ['', null],
    ['abc', null],
  ])('%s → %s', (raw, expected) => {
    expect(parseNumber(raw)).toBe(expected);
  });
});

describe('parseDate', () => {
  it.each([
    ['2026-01-05T09:30:00.000Z', '2026-01-05T09:30:00.000Z'],
    ['2026-01-05 10:30', '2026-01-05T09:30:00.000Z'],
    ['05/01/2026 10h30', '2026-01-05T09:30:00.000Z'],
    ['5/1/2026', '2026-01-05T11:00:00.000Z'],
    ['2026-07-01', '2026-07-01T10:00:00.000Z'],
  ])('%s → %s', (raw, iso) => {
    expect(parseDate(raw)?.toISOString()).toBe(iso);
  });
  it.each(['31/02/2026x', 'hier', ''])('refuse %s', (raw) => {
    expect(parseDate(raw)).toBeNull();
  });
});

describe('mapColumns', () => {
  it('en-têtes de courtier (accents, casse, ponctuation)', () => {
    expect(
      mapColumns([
        'Date d’exécution',
        'Code ISIN',
        'Libellé',
        'Opération',
        'Qté',
        'Cours',
        'Commission',
      ]),
    ).toEqual({ date: 0, isin: 1, name: 2, side: 3, quantity: 4, price: 5, fees: 6 });
  });
});

describe('parseImport', () => {
  it("relit l'export de l'application", () => {
    const csv = ordersToCsv([
      {
        executed_at: '2026-01-05T09:30:00Z',
        symbol: 'CW8.PA',
        name: 'World',
        side: 'buy',
        quantity: 10,
        unit_price: 100.5,
        fees: 1.25,
        note: null,
        portfolio: 'PEA',
      },
    ]);
    const { lines, error } = parseImport(csv);
    expect(error).toBeUndefined();
    expect(lines).toEqual([
      {
        ok: true,
        row: {
          line: 2,
          executedAt: '2026-01-05T09:30:00.000Z',
          symbol: 'CW8.PA',
          isin: null,
          name: 'World',
          side: 'buy',
          quantity: 10,
          unitPrice: 100.5,
          fees: 1.25,
          note: null,
          portfolio: 'PEA',
        },
      },
    ]);
  });

  it('format courtier : ISIN, sens en toutes lettres, erreurs ligne par ligne', () => {
    const csv = [
      'Date;ISIN;Sens;Quantité;Cours;Frais',
      '05/01/2026;FR0000120271;Achat comptant;10;50,10;1,99',
      '06/01/2026;FR0000120271;Dividende;1;2;0',
      '07/01/2026;FR0000120272;Vente;1;2;0',
      '08/01/2026;FR0000120271;Vente;-3;2;0',
    ].join('\n');
    const { lines } = parseImport(csv);
    expect(lines[0]).toMatchObject({
      ok: true,
      row: { isin: 'FR0000120271', side: 'buy', fees: 1.99 },
    });
    expect(lines[1]).toMatchObject({
      ok: false,
      line: 3,
      error: expect.stringContaining('sens inconnu'),
    });
    expect(lines[2]).toMatchObject({ ok: false, error: expect.stringContaining('ISIN invalide') });
    expect(lines[3]).toMatchObject({ ok: false, error: 'quantité invalide' });
  });

  it('colonnes obligatoires manquantes', () => {
    expect(parseImport('date;quantite\n2026-01-05;1').error).toContain('Colonnes introuvables');
    expect(parseImport('').error).toContain('vide');
  });
});

describe('orderKey', () => {
  it("indépendante du format de l'instant", () => {
    const base = { instrumentId: 'i', side: 'buy', quantity: 1, unitPrice: 2 };
    expect(orderKey({ ...base, executedAt: '2026-01-05T09:30:00Z' })).toBe(
      orderKey({ ...base, executedAt: '2026-01-05T10:30:00+01:00' }),
    );
  });
});
