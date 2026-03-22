// src/hooks/useImportEngine.ts
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { calculateSimilarity } from '../utils/similarityUtils';
import { getProducts, getInventoryItems } from '../database/database';
import { InventoryItem, Product } from '../database/models';
import { parseImportDate, parseImportProducts } from '../utils/importParsers';
import { ImportResult } from '../components/ImportConfirmationModal';

const SIMILARITY_THRESHOLD = 0.55;

type ImportProduct = { originalName: string; quantity: number };

type MatchCandidate = {
  productId: number;
  productName: string;
  inventoryItemId: number | null;
  score: number;
  source: 'list' | 'global';
};

type CurrentImportItem = {
  importedProduct: ImportProduct;
  bestMatch: MatchCandidate;
  similarCandidates: MatchCandidate[];
  remainingProducts: ImportProduct[];
  importDate: Date | null;
};

interface UseImportEngineOptions {
  listId: number;
  loadItems: () => Promise<void>;
  // Called for exact + fuzzy matches — receives the resolved candidate
  applyMatch: (args: {
    productId: number;
    productName: string;
    inventoryItemId: number | null;
    product: ImportProduct;
    importDate: Date | null;
  }) => Promise<void>;
  // Called when no match found — should create product if needed and return productId
  applyNew: (args: {
    product: ImportProduct;
    importDate: Date | null;
  }) => Promise<{ productId: number; productName: string }>;
}

export function useImportEngine({
  listId,
  loadItems,
  applyMatch,
  applyNew,
}: UseImportEngineOptions) {
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; imported: number } | null>(null);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [currentImportItem, setCurrentImportItem] = useState<CurrentImportItem | null>(null);

  const importedCountRef = useRef(0);
  const importResultsRef = useRef<ImportResult[]>([]);

  const buildListMap = (listItems: InventoryItem[]) => {
    const map = new Map<number, number>();
    for (const ii of listItems) map.set(ii.productId, ii.id);
    return map;
  };

  const findCandidates = (
    name: string,
    allProducts: Product[],
    listMap: Map<number, number>
  ): MatchCandidate[] =>
    allProducts
      .map(p => ({
        productId: p.id,
        productName: p.name,
        inventoryItemId: listMap.get(p.id) ?? null,
        score: calculateSimilarity(p.name, name),
        source: (listMap.has(p.id) ? 'list' : 'global') as 'list' | 'global',
      }))
      .filter(c => c.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score);

  const finishImport = async () => {
    setConfirmationModalVisible(false);
    setCurrentImportItem(null);
    setImportProgress(null);
    setImportResults(importResultsRef.current);
    setSummaryModalVisible(true);
    await loadItems();
  };

  const processNextProduct = async (
    remainingProducts: ImportProduct[],
    allProducts: Product[],
    listMap: Map<number, number>,
    importDate: Date | null
  ) => {
    if (!remainingProducts.length) { await finishImport(); return; }

    const [current, ...rest] = remainingProducts;
    setImportProgress(prev => prev ? { ...prev, current: prev.total - rest.length } : null);

    // 1. Exact match
    const exact = allProducts.find(p => p.name.toLowerCase() === current.originalName.toLowerCase());
    if (exact) {
      await applyMatch({ productId: exact.id, productName: exact.name, inventoryItemId: listMap.get(exact.id) ?? null, product: current, importDate });
      importedCountRef.current += 1;
      importResultsRef.current.push({ originalName: current.originalName, quantity: current.quantity, outcome: 'exact', matchedName: exact.name, quantityExtracted: current.quantity > 0, importDate });
      await processNextProduct(rest, allProducts, listMap, importDate);
      return;
    }

    // 2. Fuzzy match → pause for modal
    const candidates = findCandidates(current.originalName, allProducts, listMap);
    if (candidates.length > 0) {
      setCurrentImportItem({ importedProduct: current, bestMatch: candidates[0], similarCandidates: candidates, remainingProducts: rest, importDate });
      setConfirmationModalVisible(true);
      return;
    }

    // 3. No match → create
    const { productId, productName } = await applyNew({ product: current, importDate });
    allProducts.push({ id: productId, name: productName, categoryId: null, createdAt: '', updatedAt: '' });
    listMap.set(productId, -1);
    importedCountRef.current += 1;
    importResultsRef.current.push({ originalName: current.originalName, quantity: current.quantity, outcome: 'created', quantityExtracted: current.quantity > 0, importDate });
    await processNextProduct(rest, allProducts, listMap, importDate);
  };

  const startImport = async (text: string) => {
    try {
      const lines = text.split('\n');
      const importDate = parseImportDate(lines);
      const products = parseImportProducts(lines);
      if (!products.length) { Alert.alert('Aviso', 'Nenhum produto encontrado.'); return; }

      const [allProducts, listItems] = await Promise.all([getProducts(), getInventoryItems(listId)]);
      const listMap = buildListMap(listItems);

      importedCountRef.current = 0;
      importResultsRef.current = [];
      setImportProgress({ current: 0, total: products.length, imported: 0 });

      await processNextProduct(products, allProducts, listMap, importDate);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Ocorreu um erro ao importar a lista.');
      setImportProgress(null);
    }
  };

  const handleAcceptAllSuggestions = async () => {
    if (!currentImportItem) return;
    const { bestMatch, importedProduct, importDate, remainingProducts } = currentImportItem;
    await applyMatch({ productId: bestMatch.productId, productName: bestMatch.productName, inventoryItemId: bestMatch.inventoryItemId, product: importedProduct, importDate });
    importedCountRef.current += 1;
    importResultsRef.current.push({ originalName: importedProduct.originalName, quantity: importedProduct.quantity, outcome: 'similar', matchedName: bestMatch.productName, quantityExtracted: importedProduct.quantity > 0, importDate });

    const [allProducts, listItems] = await Promise.all([getProducts(), getInventoryItems(listId)]);
    const listMap = buildListMap(listItems);

    for (const product of remainingProducts) {
      const exact = allProducts.find(p => p.name.toLowerCase() === product.originalName.toLowerCase());
      if (exact) {
        await applyMatch({ productId: exact.id, productName: exact.name, inventoryItemId: listMap.get(exact.id) ?? null, product, importDate });
        importedCountRef.current += 1;
        importResultsRef.current.push({ originalName: product.originalName, quantity: product.quantity, outcome: 'exact', matchedName: exact.name, quantityExtracted: product.quantity > 0, importDate });
      } else {
        const candidates = findCandidates(product.originalName, allProducts, listMap);
        if (candidates.length > 0) {
          await applyMatch({ productId: candidates[0].productId, productName: candidates[0].productName, inventoryItemId: candidates[0].inventoryItemId, product, importDate });
          importedCountRef.current += 1;
          importResultsRef.current.push({ originalName: product.originalName, quantity: product.quantity, outcome: 'similar', matchedName: candidates[0].productName, quantityExtracted: product.quantity > 0, importDate });
        } else {
          const { productId, productName } = await applyNew({ product, importDate });
          allProducts.push({ id: productId, name: productName, categoryId: null, createdAt: '', updatedAt: '' });
          listMap.set(productId, -1);
          importedCountRef.current += 1;
          importResultsRef.current.push({ originalName: product.originalName, quantity: product.quantity, outcome: 'created', quantityExtracted: product.quantity > 0, importDate });
        }
      }
    }
    await finishImport();
  };

  const handleAddToExisting = async () => {
    if (!currentImportItem) return;
    const { bestMatch, importedProduct, importDate, remainingProducts } = currentImportItem;
    await applyMatch({ productId: bestMatch.productId, productName: bestMatch.productName, inventoryItemId: bestMatch.inventoryItemId, product: importedProduct, importDate });
    importedCountRef.current += 1;
    importResultsRef.current.push({ originalName: importedProduct.originalName, quantity: importedProduct.quantity, outcome: 'similar', matchedName: bestMatch.productName, quantityExtracted: importedProduct.quantity > 0, importDate });
    const [allProducts, listItems] = await Promise.all([getProducts(), getInventoryItems(listId)]);
    setConfirmationModalVisible(false);
    setCurrentImportItem(null);
    await processNextProduct(remainingProducts, allProducts, buildListMap(listItems), importDate);
  };

  const handleCreateNew = async () => {
    if (!currentImportItem) return;
    const { importedProduct, importDate, remainingProducts } = currentImportItem;
    const { productId, productName } = await applyNew({ product: importedProduct, importDate });
    importedCountRef.current += 1;
    importResultsRef.current.push({ originalName: importedProduct.originalName, quantity: importedProduct.quantity, outcome: 'created', quantityExtracted: importedProduct.quantity > 0, importDate });
    const [allProducts, listItems] = await Promise.all([getProducts(), getInventoryItems(listId)]);
    const listMap = buildListMap(listItems);
    allProducts.push({ id: productId, name: productName, categoryId: null, createdAt: '', updatedAt: '' });
    listMap.set(productId, -1);
    setConfirmationModalVisible(false);
    setCurrentImportItem(null);
    await processNextProduct(remainingProducts, allProducts, listMap, importDate);
  };

  const handleSkipImport = async () => {
    if (!currentImportItem) return;
    const { importedProduct, importDate, remainingProducts } = currentImportItem;
    importResultsRef.current.push({ originalName: importedProduct.originalName, quantity: importedProduct.quantity, outcome: 'skipped', quantityExtracted: true, importDate });
    const [allProducts, listItems] = await Promise.all([getProducts(), getInventoryItems(listId)]);
    setConfirmationModalVisible(false);
    await processNextProduct(remainingProducts, allProducts, buildListMap(listItems), importDate);
  };

  const handleCancelAllImports = () => {
    setConfirmationModalVisible(false);
    setCurrentImportItem(null);
    setImportProgress(null);
  };

  return {
    startImport,
    confirmationModalVisible,
    importProgress,
    summaryModalVisible,
    importResults,
    currentImportItem,
    setCurrentImportItem,
    setSummaryModalVisible,
    setImportResults,
    handleAcceptAllSuggestions,
    handleAddToExisting,
    handleCreateNew,
    handleSkipImport,
    handleCancelAllImports,
  };
}