import { describe, expect, it } from 'vitest';
import { ANALYTICS_ORIGIN, buildCsp, cspHeaderName, newNonce, supabaseOrigins } from './csp';

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1);

describe('buildCsp', () => {
  const csp = buildCsp({ nonce: 'abc123', supabaseUrl: 'https://proj.supabase.co' });

  it('scripts : nonce de la requête, strict-dynamic, statistiques ; pas de eval en production', () => {
    expect(directive(csp, 'script-src')).toEqual([
      "'self'",
      "'nonce-abc123'",
      "'strict-dynamic'",
      ANALYTICS_ORIGIN,
    ]);
    expect(csp).not.toContain('unsafe-eval');
  });

  it('requêtes : site, Supabase en https et wss (Realtime), statistiques', () => {
    expect(directive(csp, 'connect-src')).toEqual([
      "'self'",
      'https://proj.supabase.co',
      'wss://proj.supabase.co',
      ANALYTICS_ORIGIN,
    ]);
  });

  it('protections de base', () => {
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'img-src')).toEqual(["'self'", 'data:', 'blob:']);
  });

  it('développement : eval autorisé', () => {
    expect(directive(buildCsp({ nonce: 'n', dev: true }), 'script-src')).toContain("'unsafe-eval'");
  });
});

describe('supabaseOrigins', () => {
  it('Supabase local en http : ws', () => {
    expect(supabaseOrigins('http://127.0.0.1:55321')).toEqual([
      'http://127.0.0.1:55321',
      'ws://127.0.0.1:55321',
    ]);
  });
  it('URL absente ou invalide : rien', () => {
    expect(supabaseOrigins(undefined)).toEqual([]);
    expect(supabaseOrigins('pas une url')).toEqual([]);
  });
});

describe('newNonce', () => {
  it('base64, différent à chaque requête', () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(a).not.toBe(newNonce());
  });
});

describe('cspHeaderName', () => {
  it('Report-Only par défaut, bloquant avec CSP_ENFORCE=1', () => {
    expect(cspHeaderName(undefined)).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeaderName('1')).toBe('Content-Security-Policy');
    expect(cspHeaderName('true')).toBe('Content-Security-Policy');
  });
});
