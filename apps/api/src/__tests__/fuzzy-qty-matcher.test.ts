import { describe, it, expect } from 'vitest';
import { Logger } from '@nestjs/common';
import { matchByQuantityAndKeywords } from '../domain/matching/fuzzy-qty-matcher';
import type { LineItemPairing } from '../domain/matching/matching.types';

const logger = new Logger('TestFuzzyMatcher');

const makeItem = (desc: string, qty: number, unitPrice = 0, cat = '') => ({
  description: desc,
  catalogNumber: cat,
  quantity: qty,
  unitPrice,
  totalPrice: qty * unitPrice,
  unit: 'מר',
});

describe('matchByQuantityAndKeywords', () => {
  it('matches PO→DN by keyword overlap, not just quantity distance', () => {
    // The real prod4 scenario: "שברון" (82.5) should match "שברון" (167.38)
    // not "שכבתי" (83.952) which has closer qty
    const poItems = [
      makeItem('Grigio Dolomite 12.5/90/540גמר לכה Elegant אלון שברון', 82.5, 691.86),
      makeItem('12.5/90/490-1200 אלון Elegant Grigio Dolomite שכבתי', 41, 516),
    ];
    const dnItems = [
      makeItem('אלון שברון Elegant Grigio Dolomite 12.5/90/540 גמר לכה', 167.38, 691.86),
      makeItem('אלון שכבתי Elegant Grigio Dolomite ,12.5/90/490-1200 לכה', 83.952, 516),
    ];

    const itemMap = new Map<string, { po?: any; dn?: any; inv?: any }>();
    const pairings: LineItemPairing[] = [];
    const matchedPo = new Set<number>();
    const matchedDn = new Set<number>();
    const matchedInv = new Set<number>();

    matchByQuantityAndKeywords(
      poItems, dnItems, [], itemMap, pairings,
      matchedPo, matchedDn, matchedInv, logger,
    );

    expect(pairings.length).toBe(2);

    // שברון → שברון (not שכבתי)
    const shabronPairing = pairings.find(p => p.po?.index === 0);
    expect(shabronPairing).toBeDefined();
    expect(shabronPairing!.dn!.index).toBe(0);
    expect(shabronPairing!.dn!.description).toContain('שברון');

    // שכבתי → שכבתי
    const shichvatiPairing = pairings.find(p => p.po?.index === 1);
    expect(shichvatiPairing).toBeDefined();
    expect(shichvatiPairing!.dn!.index).toBe(1);
    expect(shichvatiPairing!.dn!.description).toContain('שכבתי');
  });

  it('matches הובלה correctly', () => {
    const poItems = [
      makeItem('הובלה', 1, 600),
    ];
    const dnItems = [
      makeItem('הובלה, (אזור מרכז: נתניה -ת"א) - עד 7 טון', 1, 600),
    ];

    const itemMap = new Map<string, { po?: any; dn?: any; inv?: any }>();
    const pairings: LineItemPairing[] = [];
    const matchedPo = new Set<number>();
    const matchedDn = new Set<number>();
    const matchedInv = new Set<number>();

    matchByQuantityAndKeywords(
      poItems, dnItems, [], itemMap, pairings,
      matchedPo, matchedDn, matchedInv, logger,
    );

    expect(pairings.length).toBe(1);
    expect(pairings[0].po!.index).toBe(0);
    expect(pairings[0].dn!.index).toBe(0);
  });

  it('does not match unrelated items', () => {
    const poItems = [
      makeItem('צינור PVC', 100, 50),
    ];
    const dnItems = [
      makeItem('ברזל 10 מ"מ', 100, 25),
    ];

    const itemMap = new Map<string, { po?: any; dn?: any; inv?: any }>();
    const pairings: LineItemPairing[] = [];
    const matchedPo = new Set<number>();
    const matchedDn = new Set<number>();
    const matchedInv = new Set<number>();

    matchByQuantityAndKeywords(
      poItems, dnItems, [], itemMap, pairings,
      matchedPo, matchedDn, matchedInv, logger,
    );

    expect(pairings.length).toBe(0);
  });

  it('prefers keyword overlap over quantity closeness', () => {
    // Two DN items: one with close qty (102) but wrong product,
    // one with far qty (200) but correct product
    const poItems = [
      makeItem('אריחי גרניט אפור 60x60', 100, 35),
    ];
    const dnItems = [
      makeItem('אריחי שיש לבן 60x60', 102, 40),        // close qty, different product
      makeItem('אריחי גרניט אפור 60x60 מאט', 200, 35), // far qty, correct product
    ];

    const itemMap = new Map<string, { po?: any; dn?: any; inv?: any }>();
    const pairings: LineItemPairing[] = [];
    const matchedPo = new Set<number>();
    const matchedDn = new Set<number>();
    const matchedInv = new Set<number>();

    matchByQuantityAndKeywords(
      poItems, dnItems, [], itemMap, pairings,
      matchedPo, matchedDn, matchedInv, logger,
    );

    expect(pairings.length).toBe(1);
    // Should pick the one with better keyword match (גרניט אפור)
    expect(pairings[0].dn!.description).toContain('גרניט');
    expect(pairings[0].dn!.description).toContain('אפור');
  });

  it('skips already matched items', () => {
    const poItems = [
      makeItem('ברזל 10 מ"מ', 100, 25),
      makeItem('ברזל 12 מ"מ', 80, 30),
    ];
    const dnItems = [
      makeItem('ברזל 10 מ"מ', 100, 25),
      makeItem('ברזל 12 מ"מ', 80, 30),
    ];

    const itemMap = new Map<string, { po?: any; dn?: any; inv?: any }>();
    const pairings: LineItemPairing[] = [];
    const matchedPo = new Set<number>([0]); // PO[0] already matched
    const matchedDn = new Set<number>([0]); // DN[0] already matched
    const matchedInv = new Set<number>();

    matchByQuantityAndKeywords(
      poItems, dnItems, [], itemMap, pairings,
      matchedPo, matchedDn, matchedInv, logger,
    );

    // Should only match the unmatched PO[1] → DN[1]
    expect(pairings.length).toBe(1);
    expect(pairings[0].po!.index).toBe(1);
    expect(pairings[0].dn!.index).toBe(1);
  });
});
