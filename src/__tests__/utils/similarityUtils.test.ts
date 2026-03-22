import { preprocessName, calculateSimilarity, findSimilarProducts } from '../../utils/similarityUtils';
import { Product } from '../../database/database';

describe('similarityUtils', () => {
  describe('preprocessName', () => {
    test('converts to lowercase', () => {
      expect(preprocessName('BATATA')).toBe('batata');
      expect(preprocessName('Arroz')).toBe('arroz');
    });

    test('removes accents', () => {
      expect(preprocessName('abóbora')).toBe('abobora');
      expect(preprocessName('maçã')).toBe('maca');
      expect(preprocessName('açúcar')).toBe('acucar');
    });

    test('removes special characters', () => {
      expect(preprocessName('arroz-feijão')).toBe('arrozfeijao');
      expect(preprocessName('leite (integral)')).toBe('leiteintegral');
      expect(preprocessName('café & açúcar')).toBe('cafeacucar');
    });

    test('trims whitespace', () => {
      expect(preprocessName('  batata  ')).toBe('batata');
      expect(preprocessName(' arroz ')).toBe('arroz');
    });

    test('handles empty strings', () => {
      expect(preprocessName('')).toBe('');
    });

    test('handles complex cases', () => {
      expect(preprocessName('Açúcar Refinado (1kg)')).toBe('acucarrefinado1kg');
      expect(preprocessName('MAÇÃ-VERDE & PÊRA')).toBe('macaverdepera');
    });
  });

  describe('calculateSimilarity', () => {
    test('returns 1 for identical strings', () => {
      expect(calculateSimilarity('batata', 'batata')).toBe(1);
      expect(calculateSimilarity('Batata', 'batata')).toBe(1);
      expect(calculateSimilarity('BATATA', 'batata')).toBe(1);
    });

    test('returns 0 for empty strings', () => {
      expect(calculateSimilarity('', '')).toBe(1);
      expect(calculateSimilarity('batata', '')).toBe(0);
      expect(calculateSimilarity('', 'batata')).toBe(0);
    });

    test('handles accented characters', () => {
      expect(calculateSimilarity('abóbora', 'abobora')).toBe(1);
      expect(calculateSimilarity('maçã', 'maca')).toBe(1);
    });

    test('calculates similarity for similar strings', () => {
      // These should have high similarity
      expect(calculateSimilarity('batata', 'batatas')).toBeGreaterThan(0.8);
      expect(calculateSimilarity('arroz', 'arros')).toBeGreaterThan(0.7);
      
      // These should have moderate similarity
      expect(calculateSimilarity('batata', 'batata doce')).toBeGreaterThan(0.4);
      expect(calculateSimilarity('arroz', 'arroz integral')).toBeGreaterThan(0.4);
      
      // These should have low similarity
      expect(calculateSimilarity('batata', 'cenoura')).toBeLessThan(0.3);
      expect(calculateSimilarity('arroz', 'feijão')).toBeLessThan(0.3);
    });
  });

  describe('findSimilarProducts', () => {
    const mockProducts: Product[] = [
      { id: 1, name: 'Batata', quantity: 5, order: 1 },
      { id: 2, name: 'Batata Doce', quantity: 3, order: 2 },
      { id: 3, name: 'Arroz', quantity: 2, order: 3 },
      { id: 4, name: 'Arroz Integral', quantity: 1, order: 4 },
      { id: 5, name: 'Feijão', quantity: 4, order: 5 },
    ];

    test('finds exact matches', () => {
      const result = findSimilarProducts('Batata', mockProducts, 1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('finds similar matches with default threshold', () => {
      const result = findSimilarProducts('Batata', mockProducts);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('finds similar matches with custom threshold', () => {
      const result = findSimilarProducts('Batata', mockProducts, 0.4);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    test('returns empty array when no matches found', () => {
      const result = findSimilarProducts('Cenoura', mockProducts);
      expect(result).toHaveLength(0);
    });

    test('handles accented characters', () => {
      const result = findSimilarProducts('Feijão', mockProducts, 0.8);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(5);
    });

    test('sorts results by similarity', () => {
      const result = findSimilarProducts('Arroz', mockProducts, 0.4);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(3); // Exact match should be first
      expect(result[1].id).toBe(4); // Similar match should be second
    });
  });
});
