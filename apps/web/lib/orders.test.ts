import { describe, expect, it } from 'vitest';
import { dbErrorMessage, ordersToCsv, parseOrderForm } from './orders';

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

const valid = {
  symbol: 'CW8.PA',
  side: 'buy',
  quantity: '10',
  unitPrice: '100,5',
  fees: '1,25',
  executedAt: '2026-01-05T10:30',
  note: '',
};

describe('parseOrderForm', () => {
  it('accepte une saisie valide (virgule décimale, heure de Paris)', () => {
    const { data, error } = parseOrderForm(form(valid));
    expect(error).toBeUndefined();
    expect(data).toMatchObject({
      symbol: 'CW8.PA',
      side: 'buy',
      quantity: 10,
      unitPrice: 100.5,
      fees: 1.25,
      note: null,
    });
    expect(data!.executedAt.toISOString()).toBe('2026-01-05T09:30:00.000Z');
  });

  it('frais vides = 0', () => {
    expect(parseOrderForm(form({ ...valid, fees: '' })).data!.fees).toBe(0);
  });

  it.each([
    [{ symbol: '' }, /instrument/i],
    [{ quantity: '0' }, /Quantité/],
    [{ quantity: 'abc' }, /Quantité/],
    [{ unitPrice: '-1' }, /Prix/],
    [{ fees: '-2' }, /Frais/],
    [{ side: 'hold' }, /Sens/],
    [{ executedAt: 'hier' }, /Date/],
    [{ executedAt: '2999-01-01T10:00' }, /futur/],
  ])('rejette %j', (patch, msg) => {
    const { data, error } = parseOrderForm(form({ ...valid, ...patch }));
    expect(data).toBeUndefined();
    expect(error).toMatch(msg);
  });
});

describe('dbErrorMessage', () => {
  it('traduit la vente à découvert', () => {
    expect(dbErrorMessage({ code: '23514', message: 'Vente à découvert interdite : …' })).toMatch(
      /négative/,
    );
  });
});

describe('ordersToCsv', () => {
  it('produit un CSV européen avec BOM, échappe et neutralise les formules', () => {
    const csv = ordersToCsv([
      {
        executed_at: '2026-01-05T09:30:00Z',
        symbol: 'CW8.PA',
        name: 'Amundi; "World"',
        side: 'buy',
        quantity: 10,
        unit_price: 100.5,
        fees: 1.25,
        note: '=HYPERLINK("x")',
      },
    ]);
    expect(csv.startsWith('﻿date;symbole')).toBe(true);
    expect(csv).toContain('"Amundi; ""World"""');
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain(';achat;10;100.5;1.25;');
  });
});
