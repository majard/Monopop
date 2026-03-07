import { Product } from "../database/models";

const SIMILARITY_THRESHOLD = 0.55;

// ─── Preprocessing ────────────────────────────────────────────────────────────

// Words that carry no semantic weight in product names
const STOP_WORDS = new Set(["de", "do", "da", "dos", "das", "e", "com", "sem", "em", "o", "a"]);

export const preprocessName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, "")    // keep only letters, digits, spaces
    .trim();
};

const tokenize = (name: string): string[] => {
  return preprocessName(name)
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
};

// ─── Bigram helpers ───────────────────────────────────────────────────────────

const getBigrams = (str: string): Set<string> => {
  const pairs = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    pairs.add(str.slice(i, i + 2));
  }
  return pairs;
};

const diceCoefficient = (a: string, b: string): number => {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const pairsA = getBigrams(a);
  const pairsB = getBigrams(b);
  const union = pairsA.size + pairsB.size;
  const intersection = [...pairsA].filter((x) => pairsB.has(x)).length;

  return (2.0 * intersection) / union;
};

// ─── Token overlap ────────────────────────────────────────────────────────────

// For each token in the smaller set, find the best matching token in the larger
// set using bigram similarity. Returns a score between 0 and 1.
const tokenOverlapScore = (tokensA: string[], tokensB: string[]): number => {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const [shorter, longer] =
    tokensA.length <= tokensB.length
      ? [tokensA, tokensB]
      : [tokensB, tokensA];

  let totalScore = 0;
  for (const tokenS of shorter) {
    // Best bigram match for this token against all tokens in the longer set
    const best = Math.max(...longer.map((tokenL) => diceCoefficient(tokenS, tokenL)));
    totalScore += best;
  }

  // Normalize: divide by longer length to penalize large size differences
  // (a single matching token shouldn't score high against a 5-token string)
  return totalScore / longer.length;
};

// ─── Levenshtein (edit distance) ─────────────────────────────────────────────

const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
};

const editSimilarity = (a: string, b: string): number => {
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
};

// ─── Containment bonus ───────────────────────────────────────────────────────

const containmentBonus = (a: string, b: string): number => {
  const pa = preprocessName(a).replace(/\s+/g, "");
  const pb = preprocessName(b).replace(/\s+/g, "");

  // Minimum length of 5 to avoid "maca" matching inside "macarroes"
  const shorter = pa.length <= pb.length ? pa : pb;
  if (shorter.length < 5) return 0;

  if (pa.includes(pb) || pb.includes(pa)) return 0.15;
  return 0;
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const calculateSimilarity = (str1: string, str2: string): number => {
  const p1 = preprocessName(str1);
  const p2 = preprocessName(str2);

  if (p1 === p2) return 1;
  if (p1.length === 0 || p2.length === 0) return 0;

  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);

  const tokenScore = tokenOverlapScore(tokens1, tokens2);
  const fullBigram = diceCoefficient(p1.replace(/\s+/g, ""), p2.replace(/\s+/g, ""));
  const base = Math.max(tokenScore, fullBigram);
  const bonus = containmentBonus(str1, str2);

  let score = Math.min(1, base + bonus);

  // For single-token pairs, blend in edit similarity:
  // catches typos ("wafel"/"waffle") and penalizes coincidental bigram matches ("wafel"/"cafe")
  if (tokens1.length === 1 && tokens2.length === 1) {
    const edit = editSimilarity(p1, p2);
    score = 0.5 * score + 0.5 * edit;
  }

  return score;
};

// ─── Batch helper (used by AddInventoryItem, AddProductToShoppingList, etc.) ──

export const findSimilarProducts = (
  name: string,
  products: Product[],
  similarityThreshold: number = SIMILARITY_THRESHOLD
): Product[] => {
  return products
    .map((product) => ({
      product,
      similarity: calculateSimilarity(name, product.name),
    }))
    .filter(({ similarity }) => similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .map(({ product }) => product);
};