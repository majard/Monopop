import { getEmojiForProduct } from '../../utils/stringUtils';

describe('stringUtils', () => {
  describe('getEmojiForProduct', () => {
    test('returns potato emoji for "batata"', () => {
      expect(getEmojiForProduct('batata')).toBe('🥔');
      expect(getEmojiForProduct('Batata doce')).toBe('🥔');
      expect(getEmojiForProduct('BATATA frita')).toBe('🥔');
    });

    test('returns pumpkin emoji for "abóbora"', () => {
      expect(getEmojiForProduct('abóbora')).toBe('🎃');
      expect(getEmojiForProduct('Abóbora moranga')).toBe('🎃');
    });

    test('returns broccoli emoji for "brócolis"', () => {
      expect(getEmojiForProduct('brócolis')).toBe('🥦');
    });

    test('returns rice emoji for "arroz"', () => {
      expect(getEmojiForProduct('arroz')).toBe('🍚');
      expect(getEmojiForProduct('Arroz integral')).toBe('🍚');
    });

    test('returns pasta emoji for "risoto"', () => {
      expect(getEmojiForProduct('risoto')).toBe('🍝');
    });

    test('returns corn emoji for "milho"', () => {
      expect(getEmojiForProduct('milho')).toBe('🌽');
      expect(getEmojiForProduct('Milho verde')).toBe('🌽');
    });

    test('returns meat emoji for "picadinho"', () => {
      expect(getEmojiForProduct('picadinho')).toBe('🍖');
    });

    test('returns palm tree emoji for "tropical"', () => {
      expect(getEmojiForProduct('tropical')).toBe('🌴');
      expect(getEmojiForProduct('Suco tropical')).toBe('🌴');
    });

    test('returns pancake emoji for "panqueca"', () => {
      expect(getEmojiForProduct('panqueca')).toBe('🥞');
    });

    test('returns waffle emoji for "waffle"', () => {
      expect(getEmojiForProduct('waffle')).toBe('🧇');
    });

    test('returns bread emoji for "pão"', () => {
      expect(getEmojiForProduct('pão')).toBe('🍞');
      expect(getEmojiForProduct('Pão de forma')).toBe('🍞');
    });

    test('returns pasta emoji for "macarrão"', () => {
      expect(getEmojiForProduct('macarrão')).toBe('🍝');
    });

    test('returns default emoji for unknown products', () => {
      expect(getEmojiForProduct('produto desconhecido')).toBe('🍽️');
      expect(getEmojiForProduct('leite')).toBe('🍽️');
      expect(getEmojiForProduct('')).toBe('🍽️');
    });
  });
});
