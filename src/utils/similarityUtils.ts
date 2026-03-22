import { Product } from "../database/database";



const commonOmittedWords = ["de", "do", "da", "e", "com"];

export const preprocessName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

export const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = preprocessName(str1);
  const s2 = preprocessName(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const pairs1 = getPairs(s1);
  const pairs2 = getPairs(s2);
  const union = pairs1.size + pairs2.size;
  const intersection = new Set([...pairs1].filter(x => pairs2.has(x))).size;

  return (2.0 * intersection) / union;
};

const getPairs = (str: string): Set<string> => {
  const pairs = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    pairs.add(str.slice(i, i + 2));
  }
  return pairs;
};

export const findSimilarProducts = (name: string, products: Product[], similarityThreshold: number = 0.8): Product[] => {
  const processedTargetName = preprocessName(name);
  
  return products
    .map(product => ({
      product,
      similarity: calculateSimilarity(processedTargetName, preprocessName(product.name))
    }))
    .filter(({ similarity }) => similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .map(({ product }) => product);
};
