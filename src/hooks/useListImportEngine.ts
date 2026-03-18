// src/hooks/useListImportEngine.ts
import { useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { getProducts, addProduct, updateProductUnit } from '../database/database';
import { calculateSimilarity } from '../utils/similarityUtils';
import { ListExportData } from '../utils/backupUtils';
import { applyListImport, ProductResolution, ListImportResult } from '../utils/listImportUtils';
import { Product } from '../database/models';

const SIMILARITY_THRESHOLD = 0.55;

type MatchCandidate = {
  productId: number;
  productName: string;
  score: number;
};

type PendingProduct = {
  oldProductId: number;
  name: string;
  unit: string | null;
  standardPackageSize: number | null;
  categoryId: number | null;
};

type CurrentMatchItem = {
  pending: PendingProduct;
  bestMatch: MatchCandidate;
  allCandidates: MatchCandidate[];
  remaining: PendingProduct[];
};

export interface UseListImportEngineResult {
  startListImport: (data: ListExportData) => Promise<void>;
  confirmationVisible: boolean;
  currentMatchItem: CurrentMatchItem | null;
  setCurrentMatchItem: (item: CurrentMatchItem) => void;
  handleUseExisting: () => Promise<void>;
  handleCreateNew: () => Promise<void>;
  handleAcceptAll: () => Promise<void>;
  handleCancel: () => void;
  summaryVisible: boolean;
  summaryResult: ListImportResult | null;
  setSummaryVisible: (v: boolean) => void;
  progress: { current: number; total: number } | null;
}

export function useListImportEngine(onSuccess: () => Promise<void>): UseListImportEngineResult {
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [currentMatchItem, setCurrentMatchItem] = useState<CurrentMatchItem | null>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryResult, setSummaryResult] = useState<ListImportResult | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const resolutionsRef = useRef<ProductResolution[]>([]);
  const matchedNamesRef = useRef<{ oldName: string; newName: string }[]>([]);
  const createdNamesRef = useRef<string[]>([]);
  const dataRef = useRef<ListExportData | null>(null);
  const allProductsRef = useRef<Product[]>([]);

  const findCandidates = useCallback((name: string, allProducts: Product[]): MatchCandidate[] => {
    return allProducts
      .map(p => ({
        productId: p.id,
        productName: p.name,
        score: calculateSimilarity(p.name, name),
      }))
      .filter(c => c.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score);
  }, []);

  const finishImport = useCallback(async () => {
    if (!dataRef.current) return;
    try {
      const result = await applyListImport(
        dataRef.current,
        resolutionsRef.current,
        matchedNamesRef.current,
        createdNamesRef.current,
      );
      setConfirmationVisible(false);
      setCurrentMatchItem(null);
      setProgress(null);
      setSummaryResult(result);
      setSummaryVisible(true);
      await onSuccess();
    } catch (e) {
      console.error('Error applying list import:', e);
      Alert.alert('Erro', 'Falha ao importar a lista.');
    }
  }, [onSuccess]);

  const createProduct = useCallback(async (pending: PendingProduct) => {
    const newProductId = await addProduct(pending.name);
    if (pending.unit) {
      await updateProductUnit(newProductId, pending.unit, pending.standardPackageSize ?? null);
    }
    resolutionsRef.current.push({
      oldProductId: pending.oldProductId,
      newProductId,
    });
    createdNamesRef.current.push(pending.name);
    allProductsRef.current.push({
      id: newProductId,
      name: pending.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return newProductId;
  }, []);

  const processNext = useCallback(async (
    remaining: PendingProduct[],
    allProducts: Product[],
  ) => {
    if (remaining.length === 0) {
      await finishImport();
      return;
    }

    const total = (dataRef.current?.data.products.length ?? 0);
    const current = total - remaining.length + 1;
    setProgress({ current, total });

    const [next, ...rest] = remaining;

    // Exact match — silent
    const exact = allProducts.find(
      p => p.name.toLowerCase() === next.name.toLowerCase()
    );
    if (exact) {
      resolutionsRef.current.push({
        oldProductId: next.oldProductId,
        newProductId: exact.id,
      });
      matchedNamesRef.current.push({ oldName: next.name, newName: exact.name });
      await processNext(rest, allProducts);
      return;
    }

    // Fuzzy match — prompt
    const candidates = findCandidates(next.name, allProducts);
    if (candidates.length > 0) {
      setCurrentMatchItem({
        pending: next,
        bestMatch: candidates[0],
        allCandidates: candidates,
        remaining: rest,
      });
      setConfirmationVisible(true);
      return;
    }

    // No match — create
    await createProduct(next);
    await processNext(rest, allProductsRef.current);
  }, [findCandidates, finishImport, createProduct]);

  const startListImport = useCallback(async (data: ListExportData) => {
    try {
      dataRef.current = data;
      resolutionsRef.current = [];
      matchedNamesRef.current = [];
      createdNamesRef.current = [];

      const allProducts = await getProducts();
      allProductsRef.current = allProducts;

      const pendingProducts: PendingProduct[] = data.data.products.map(p => ({
        oldProductId: p.id,
        name: p.name,
        unit: p.unit ?? null,
        standardPackageSize: p.standardPackageSize ?? null,
        categoryId: p.categoryId ?? null,
      }));

      setProgress({ current: 0, total: pendingProducts.length });
      await processNext(pendingProducts, allProducts);
    } catch (e) {
      console.error('Error starting list import:', e);
      Alert.alert('Erro', 'Ocorreu um erro ao iniciar a importação.');
    }
  }, [processNext]);

  const handleUseExisting = useCallback(async () => {
    if (!currentMatchItem) return;
    resolutionsRef.current.push({
      oldProductId: currentMatchItem.pending.oldProductId,
      newProductId: currentMatchItem.bestMatch.productId,
    });
    matchedNamesRef.current.push({
      oldName: currentMatchItem.pending.name,
      newName: currentMatchItem.bestMatch.productName,
    });
    setConfirmationVisible(false);
    setCurrentMatchItem(null);
    await processNext(currentMatchItem.remaining, allProductsRef.current);
  }, [currentMatchItem, processNext]);

  const handleCreateNew = useCallback(async () => {
    if (!currentMatchItem) return;
    await createProduct(currentMatchItem.pending);
    setConfirmationVisible(false);
    setCurrentMatchItem(null);
    await processNext(currentMatchItem.remaining, allProductsRef.current);
  }, [currentMatchItem, processNext, createProduct]);

  const handleAcceptAll = useCallback(async () => {
    if (!currentMatchItem) return;
    // Accept best match for current
    resolutionsRef.current.push({
      oldProductId: currentMatchItem.pending.oldProductId,
      newProductId: currentMatchItem.bestMatch.productId,
    });
    matchedNamesRef.current.push({
      oldName: currentMatchItem.pending.name,
      newName: currentMatchItem.bestMatch.productName,
    });

    // Process remaining silently
    for (const pending of currentMatchItem.remaining) {
      const exact = allProductsRef.current.find(
        p => p.name.toLowerCase() === pending.name.toLowerCase()
      );
      if (exact) {
        resolutionsRef.current.push({
          oldProductId: pending.oldProductId,
          newProductId: exact.id,
        });
        matchedNamesRef.current.push({ oldName: pending.name, newName: exact.name });
        continue;
      }
      const candidates = findCandidates(pending.name, allProductsRef.current);
      if (candidates.length > 0) {
        resolutionsRef.current.push({
          oldProductId: pending.oldProductId,
          newProductId: candidates[0].productId,
        });
        matchedNamesRef.current.push({
          oldName: pending.name,
          newName: candidates[0].productName,
        });
      } else {
        await createProduct(pending);
      }
    }

    setConfirmationVisible(false);
    setCurrentMatchItem(null);
    await finishImport();
  }, [currentMatchItem, findCandidates, finishImport, createProduct]);

  const handleCancel = useCallback(() => {
    setConfirmationVisible(false);
    setCurrentMatchItem(null);
    setProgress(null);
    resolutionsRef.current = [];
    matchedNamesRef.current = [];
    createdNamesRef.current = [];
    dataRef.current = null;
  }, []);

  return {
    startListImport,
    confirmationVisible,
    currentMatchItem,
    setCurrentMatchItem,
    handleUseExisting,
    handleCreateNew,
    handleAcceptAll,
    handleCancel,
    summaryVisible,
    summaryResult,
    setSummaryVisible,
    progress,
  };
}