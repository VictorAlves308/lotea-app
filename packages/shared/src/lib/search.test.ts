import { describe, expect, it } from 'vitest';

import { buildProductSearchTerms, normalizeSearchText } from './search';

describe('normalizeSearchText', () => {
  it('strips accents', () => {
    expect(normalizeSearchText('Água de Cheiro')).toBe('agua de cheiro');
  });

  it('lowercases', () => {
    expect(normalizeSearchText('KAIAK Tradicional')).toBe('kaiak tradicional');
  });

  it('collapses repeated whitespace and trims', () => {
    expect(normalizeSearchText('  Kaiak   Masculino  ')).toBe('kaiak masculino');
  });
});

describe('buildProductSearchTerms', () => {
  it('joins every searchable field, normalized', () => {
    expect(
      buildProductSearchTerms({
        name: 'Kaiak Tradicional',
        brand: 'Natura',
        category: 'Perfumaria',
        sku: 'NAT-KAIAK-100',
        volume: '100ml',
        variant: 'Masculino',
      }),
    ).toBe('kaiak tradicional natura perfumaria nat-kaiak-100 100ml masculino');
  });

  it('skips null/empty fields without leaving extra whitespace', () => {
    expect(
      buildProductSearchTerms({
        name: 'Batom Ultra Color',
        brand: null,
        category: null,
        sku: null,
        volume: null,
        variant: null,
      }),
    ).toBe('batom ultra color');
  });
});
