import { parse, parseISO, isSameDay } from "date-fns";
import React, { useState, useRef } from "react";
import { calculateSimilarity } from "../utils/similarityUtils";
import { Modal, View, Text, Alert } from "react-native";
import {
  Button,
  TextInput as PaperTextInput,
  useTheme,
  Snackbar,
} from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import {
  updateInventoryItem,
  saveInventoryHistorySnapshot,
  getInventoryHistory,
  addProduct,
  getInventoryItems,
  addInventoryItem,
  getProducts,
} from "../database/database";
import { InventoryItem, InventoryHistory, Product } from "../database/models";
import { ConfirmationModal, ImportSummaryModal, ImportResult } from "./ImportConfirmationModal";

const SIMILARITY_THRESHOLD = 0.55;

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportProduct = { originalName: string; quantity: number };

// Enriched match candidate — carries both the global product and,
// if it already exists in the current list, the inventory item id.
type MatchCandidate = {
  productId: number;
  productName: string;
  inventoryItemId: number | null; // null = exists globally but not in this list
  score: number;
  source: "list" | "global";
};

type CurrentImportItem = {
  importedProduct: ImportProduct;
  bestMatch: MatchCandidate;
  similarCandidates: MatchCandidate[];
  remainingProducts: ImportProduct[];
  importDate: Date | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const checkDateExists = (array: InventoryHistory[], targetDate: Date) => {
  if (array.length === 0) return false;
  const parsedTarget = parseISO(targetDate.toISOString());
  return array.some((item) => isSameDay(parseISO(item.date), parsedTarget));
};

const getLastHistoryDate = (productHistory: InventoryHistory[]): Date | null => {
  if (productHistory.length === 0) return null;
  const sorted = [...productHistory].sort(
    (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
  );
  return parseISO(sorted[0].date);
};

// Apply quantity + history to an existing inventory item.
const applyImportToInventoryItem = async (
  inventoryItemId: number,
  quantity: number,
  importDate: Date | null
) => {
  const productHistory = await getInventoryHistory(inventoryItemId);
  const lastHistoryDate = getLastHistoryDate(productHistory);
  const now = new Date();
  const historyDate = importDate ?? now;

  // Only update current quantity if import date is newer than last entry
  const shouldUpdate =
    !lastHistoryDate ||
    (!isSameDay(lastHistoryDate, historyDate) && historyDate > lastHistoryDate);

  if (shouldUpdate) {
    await updateInventoryItem(inventoryItemId, quantity);
  }

  // Always save history entry for the import date (if not duplicate)
  if (importDate && !checkDateExists(productHistory, importDate)) {
    await saveInventoryHistorySnapshot(inventoryItemId, quantity, importDate);
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportModal({
  isImportModalVisible,
  setIsImportModalVisible,
  loadItems,
  listId,
}) {
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const [importText, setImportText] = useState("");
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    imported: number;
  } | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const importedCountRef = useRef(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const importResultsRef = useRef<ImportResult[]>([]);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [currentImportItem, setCurrentImportItem] = useState<CurrentImportItem | null>(null);

  // ─── Pool helpers ───────────────────────────────────────────────────────────

  // Build a map of productId → inventoryItemId for the current list.
  const buildListMap = (listItems: InventoryItem[]): Map<number, number> => {
    const map = new Map<number, number>();
    for (const ii of listItems) {
      map.set(ii.productId, ii.id);
    }
    return map;
  };

  // Find the best match candidates for a product name against the global pool.
  const findCandidates = (
    name: string,
    allProducts: Product[],
    listMap: Map<number, number>
  ): MatchCandidate[] => {
    return allProducts
      .map((p) => {
        const score = calculateSimilarity(p.name, name);
        const inventoryItemId = listMap.get(p.id) ?? null;
        const source: "list" | "global" = inventoryItemId !== null ? "list" : "global";
        return { productId: p.id, productName: p.name, inventoryItemId, score, source };
      })
      .filter((c) => c.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score);
  };

  // ─── Core processing ────────────────────────────────────────────────────────

  const processNextProduct = async (
    remainingProducts: ImportProduct[],
    allProducts: Product[],
    listMap: Map<number, number>,
    importDate: Date | null
  ) => {
    if (!remainingProducts || remainingProducts.length === 0) {
      setConfirmationModalVisible(false);
      setCurrentImportItem(null);
      setImportProgress(null);

      setImportResults(importResultsRef.current);
      setSummaryModalVisible(true);
      
      // keep the snackbar as fallback only if results are empty
      if (importResultsRef.current.length === 0) {
        const message = `${importedCountRef.current} produto${importedCountRef.current !== 1 ? "s" : ""} importado${importedCountRef.current !== 1 ? "s" : ""} com sucesso`;
        setSnackbarMessage(message);
        setSnackbarVisible(true);
      }

      await loadItems();
      return;
    }

    const [currentProduct, ...rest] = remainingProducts;

    setImportProgress((prev) =>
      prev ? { ...prev, current: prev.total - rest.length } : null
    );

    // 1. Exact match in global products (case-insensitive)
    const exactGlobalMatch = allProducts.find(
      (p) => p.name.toLowerCase() === currentProduct.originalName.toLowerCase()
    );

    if (exactGlobalMatch) {
      const existingIIId = listMap.get(exactGlobalMatch.id) ?? null;

      if (existingIIId !== null) {
        // Already in this list → update
        await applyImportToInventoryItem(existingIIId, currentProduct.quantity, importDate);
      } else {
        // Exists globally but not in this list → add inventory item
        const newIIId = await addInventoryItem(listId, exactGlobalMatch.id, currentProduct.quantity);
        if (importDate) {
          await saveInventoryHistorySnapshot(newIIId, currentProduct.quantity, importDate);
        }
        listMap.set(exactGlobalMatch.id, newIIId);
      }

      importedCountRef.current += 1;
      setImportProgress((prev) => prev ? { ...prev, imported: importedCountRef.current } : null);
      
      importResultsRef.current.push({
        originalName: currentProduct.originalName,
        quantity: currentProduct.quantity,
        outcome: 'exact',
        matchedName: exactGlobalMatch.name,
        quantityExtracted: currentProduct.quantity > 0,
        importDate,
      });

      await processNextProduct(rest, allProducts, listMap, importDate);
      return;
    }

    // 2. No exact match → look for similar candidates
    const candidates = findCandidates(currentProduct.originalName, allProducts, listMap);

    if (candidates.length > 0) {
      setCurrentImportItem({
        importedProduct: currentProduct,
        bestMatch: candidates[0],
        similarCandidates: candidates,
        remainingProducts: rest,
        importDate,
      });
      setConfirmationModalVisible(true);
      // Processing pauses here — resumes via modal callbacks
      return;
    }

    // 3. No match at all → create new product + inventory item
    const { newProduct, newIIId } = await createAndAddProduct(
      currentProduct,
      importDate
    );
    allProducts.push(newProduct);
    listMap.set(newProduct.id, newIIId);

    importedCountRef.current += 1;
    setImportProgress((prev) => prev ? { ...prev, imported: importedCountRef.current } : null);
    
    importResultsRef.current.push({
      originalName: currentProduct.originalName,
      quantity: currentProduct.quantity,
      outcome: 'created',
      quantityExtracted: currentProduct.quantity > 0,
      importDate,
    });

    setCurrentImportItem(null);
    await processNextProduct(rest, allProducts, listMap, importDate);
  };

  // Creates a new global product and adds it to the current list.
  const createAndAddProduct = async (
    product: ImportProduct,
    importDate: Date | null
  ): Promise<{ newProduct: Product; newIIId: number }> => {
    const productId = await addProduct(product.originalName);
    const newIIId = await addInventoryItem(listId, productId, product.quantity);

    if (importDate) {
      await saveInventoryHistorySnapshot(newIIId, product.quantity, importDate);
    }

    const newProduct: Product = {
      id: productId,
      name: product.originalName,
      categoryId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { newProduct, newIIId };
  };

  // Applies a confirmed candidate match (from modal) to the list.
  const applyCandidate = async (
    candidate: MatchCandidate,
    importedProduct: ImportProduct,
    importDate: Date | null
  ) => {
    if (candidate.inventoryItemId !== null) {
      // Already in list → update
      await applyImportToInventoryItem(candidate.inventoryItemId, importedProduct.quantity, importDate);
    } else {
      // Global product not yet in list → add inventory item
      const newIIId = await addInventoryItem(listId, candidate.productId, importedProduct.quantity);
      if (importDate) {
        await saveInventoryHistorySnapshot(newIIId, importedProduct.quantity, importDate);
      }
    }
  };

  // ─── Import entry point ─────────────────────────────────────────────────────

  const importStockList = async (text: string) => {
    try {
      const lines = text.split("\n");
      const importDate = parseImportDate(lines);
      const importedProducts = parseImportProducts(lines);

      if (importedProducts.length === 0) {
        Alert.alert("Aviso", "Nenhum produto encontrado na lista.");
        return;
      }

      // Load both pools once
      const [allProducts, listItems] = await Promise.all([
        getProducts(),
        getInventoryItems(listId),
      ]);
      const listMap = buildListMap(listItems);

      importedCountRef.current = 0;
      importResultsRef.current = [];
      setImportProgress({ current: 0, total: importedProducts.length, imported: 0 });

      await processNextProduct(importedProducts, allProducts, listMap, importDate);
    } catch (error) {
      console.error("Error importing stock list:", error);
      Alert.alert("Erro", "Ocorreu um erro ao importar a lista.");
      setImportProgress(null);
    }
  };

  // ─── Modal callbacks ────────────────────────────────────────────────────────

  // User accepted the bestMatch for the current product, process all remaining silently.
  const handleAcceptAllSuggestions = async () => {
    if (!currentImportItem) return;

    try {
      const { bestMatch, importedProduct, importDate, remainingProducts } = currentImportItem;

      await applyCandidate(bestMatch, importedProduct, importDate);
      importedCountRef.current += 1;
      
      importResultsRef.current.push({
        originalName: importedProduct.originalName,
        quantity: importedProduct.quantity,
        outcome: 'similar',
        matchedName: bestMatch.productName,
        quantityExtracted: importedProduct.quantity > 0,
        importDate,
      });

      // Load fresh pools for the silent processing pass
      const [allProducts, listItems] = await Promise.all([
        getProducts(),
        getInventoryItems(listId),
      ]);
      const listMap = buildListMap(listItems);

      // Process remaining silently (no modal)
      for (const product of remainingProducts) {
        const exactGlobalMatch = allProducts.find(
          (p) => p.name.toLowerCase() === product.originalName.toLowerCase()
        );

        if (exactGlobalMatch) {
          const existingIIId = listMap.get(exactGlobalMatch.id) ?? null;
          if (existingIIId !== null) {
            await applyImportToInventoryItem(existingIIId, product.quantity, importDate);
          } else {
            const newIIId = await addInventoryItem(listId, exactGlobalMatch.id, product.quantity);
            if (importDate) {
              await saveInventoryHistorySnapshot(newIIId, product.quantity, importDate);
            }
            listMap.set(exactGlobalMatch.id, newIIId);
          }
          importedCountRef.current += 1;
          importResultsRef.current.push({
            originalName: product.originalName,
            quantity: product.quantity,
            outcome: 'exact',
            matchedName: exactGlobalMatch.name,
            quantityExtracted: product.quantity > 0,
            importDate,
          });
        } else {
          const candidates = findCandidates(product.originalName, allProducts, listMap);
          if (candidates.length > 0) {
            // Silent best-match acceptance
            await applyCandidate(candidates[0], product, importDate);
            importedCountRef.current += 1;
            
            importResultsRef.current.push({
              originalName: product.originalName,
              quantity: product.quantity,
              outcome: 'similar',
              matchedName: candidates[0].productName,
              quantityExtracted: product.quantity > 0,
              importDate,
            });
          } else {
            const { newProduct, newIIId } = await createAndAddProduct(product, importDate);
            allProducts.push(newProduct);
            listMap.set(newProduct.id, newIIId);
            importedCountRef.current += 1;
            
            importResultsRef.current.push({
              originalName: product.originalName,
              quantity: product.quantity,
              outcome: 'created',
              quantityExtracted: product.quantity > 0,
              importDate,
            });
          }
        }
      }

      setConfirmationModalVisible(false);
      setCurrentImportItem(null);
      setImportProgress(null);

      setImportResults(importResultsRef.current);
      setSummaryModalVisible(true);
      
      // keep the snackbar as fallback only if results are empty
      if (importResultsRef.current.length === 0) {
        const message = `${importedCountRef.current} produto${importedCountRef.current !== 1 ? "s" : ""} importado${importedCountRef.current !== 1 ? "s" : ""} com sucesso`;
        setSnackbarMessage(message);
        setSnackbarVisible(true);
      }

      await loadItems();
    } catch (error) {
      console.error("Error in handleAcceptAllSuggestions:", error);
    }
  };

  // User accepted bestMatch for current product only, continue normally.
  const handleAddToExisting = async () => {
    if (!currentImportItem) return;

    try {
      const { bestMatch, importedProduct, importDate, remainingProducts } = currentImportItem;

      await applyCandidate(bestMatch, importedProduct, importDate);
      importedCountRef.current += 1;
      setImportProgress((prev) => prev ? { ...prev, imported: importedCountRef.current } : null);
      
      importResultsRef.current.push({
        originalName: importedProduct.originalName,
        quantity: importedProduct.quantity,
        outcome: 'similar',
        matchedName: bestMatch.productName,
        quantityExtracted: importedProduct.quantity > 0,
        importDate,
      });

      const [allProducts, listItems] = await Promise.all([
        getProducts(),
        getInventoryItems(listId),
      ]);
      const listMap = buildListMap(listItems);

      setConfirmationModalVisible(false);
      setCurrentImportItem(null);
      await processNextProduct(remainingProducts, allProducts, listMap, importDate);
    } catch (error) {
      console.error("Error in handleAddToExisting:", error);
    }
  };

  // User wants to create a new product instead of using any suggestion.
  const handleCreateNew = async () => {
    if (!currentImportItem) return;

    try {
      const { importedProduct, importDate, remainingProducts } = currentImportItem;

      const [allProducts, listItems] = await Promise.all([
        getProducts(),
        getInventoryItems(listId),
      ]);
      const listMap = buildListMap(listItems);

      const { newProduct, newIIId } = await createAndAddProduct(importedProduct, importDate);
      allProducts.push(newProduct);
      listMap.set(newProduct.id, newIIId);

      importedCountRef.current += 1;
      setImportProgress((prev) => prev ? { ...prev, imported: importedCountRef.current } : null);

      importResultsRef.current.push({
        originalName: importedProduct.originalName,
        quantity: importedProduct.quantity,
        outcome: 'created',
        quantityExtracted: importedProduct.quantity > 0,
        importDate,
      });

      setConfirmationModalVisible(false);
      setCurrentImportItem(null);
      await processNextProduct(remainingProducts, allProducts, listMap, importDate);
    } catch (error) {
      console.error("Error in handleCreateNew:", error);
    }
  };

  // User skips this product entirely.
  const handleSkipImport = async () => {
    if (!currentImportItem) return;

    try {
      const { importDate, remainingProducts } = currentImportItem;

      const [allProducts, listItems] = await Promise.all([
        getProducts(),
        getInventoryItems(listId),
      ]);
      const listMap = buildListMap(listItems);
      
      importResultsRef.current.push({
        originalName: currentImportItem.importedProduct.originalName,
        quantity: currentImportItem.importedProduct.quantity,
        outcome: 'skipped',
        quantityExtracted: true,
        importDate,
      });

      setConfirmationModalVisible(false);
      await processNextProduct(remainingProducts, allProducts, listMap, importDate);
    } catch (error) {
      console.error("Error in handleSkipImport:", error);
    }
  };

  const handleCancelAllImports = () => {
    setConfirmationModalVisible(false);
    setCurrentImportItem(null);
    setImportProgress(null);
  };

  // ─── Import entry modal handlers ────────────────────────────────────────────

  const handleImportModalImport = () => {
    const text = importText;
    setIsImportModalVisible(false);
    setImportText("");
    importStockList(text);
  };

  const handleImportModalCancel = () => {
    setIsImportModalVisible(false);
    setImportText("");
  };

  const handleSummaryModalDismiss = () => {
    setSummaryModalVisible(false);
    setImportResults([]);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View>
      <Modal
        visible={isImportModalVisible}
        onRequestClose={() => setIsImportModalVisible(false)}
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Importar Lista</Text>
            <PaperTextInput
              style={[styles.textInput, { height: 150, textAlignVertical: "top" }]}
              multiline
              value={importText}
              onChangeText={setImportText}
              placeholder="Cole aqui sua lista de produtos"
              mode="outlined"
              dense
            />
            <View style={styles.buttonRow}>
              <Button onPress={handleImportModalCancel} style={styles.stackedButton}>
                Cancelar
              </Button>
              <Button onPress={handleImportModalImport} style={styles.stackedButton}>
                Importar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={confirmationModalVisible}
        currentImportItem={currentImportItem}
        progress={importProgress}
        onAcceptAllSuggestions={handleAcceptAllSuggestions}
        onAddToExisting={handleAddToExisting}
        onCreateNew={handleCreateNew}
        onSkipImport={handleSkipImport}
        onCancelAllImports={handleCancelAllImports}
        onUpdateCurrentItem={setCurrentImportItem}
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>

      <ImportSummaryModal
        visible={summaryModalVisible}
        results={importResults}
        onDismiss={handleSummaryModalDismiss}
      />
    </View>
  );
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

const parseImportDate = (lines: string[]): Date | null => {
  const dateFormats = ["dd/MM/yyyy", "dd/MM/yy", "dd/MM", "d/M"];
  const dateRegexes = [
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\d{2})\/(\d{2})\/(\d{2})/,
    /(\d{2})\/(\d{2})/,
    /(\d{1,2})\/(\d{1,2})/,
  ];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  for (const line of lines) {
    for (let i = 0; i < dateFormats.length; i++) {
      const match = line.match(dateRegexes[i]);
      if (match) {
        try {
          const paddedLine =
            i === 3
              ? `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`
              : line;

          const format = i === 3 ? "dd/MM" : dateFormats[i];
          const parsedDate = parse(paddedLine, format, new Date());

          if (parsedDate && !isNaN(parsedDate.getTime())) {
            if (i === 2 || i === 3) {
              const day = parseInt(match[1], 10);
              const month = parseInt(match[2], 10) - 1;
              let assumedYear = currentYear;
              const parsedMonth = month + 1;
              if (
                parsedMonth > currentMonth ||
                (parsedMonth === currentMonth && day > currentDate.getDate())
              ) {
                assumedYear--;
              }
              return new Date(assumedYear, month, day, 20, 0, 0);
            }
            parsedDate.setHours(20, 0, 0, 0);
            return parsedDate;
          }
        } catch (error) {
          console.error("Error parsing date:", error);
        }
      }
    }
  }
  return null;
};

const parseImportProducts = (
  lines: string[]
): ImportProduct[] => {
  return lines
    .filter((line) => line.trim())
    .filter((line) => {
      const trimmed = line.trim();
      if (/^[\[✖✨*]/.test(trimmed)) return false;
      if (/\d{1,2}\/\d{1,2}(\/\d{2,4})?/.test(trimmed)) return false;
      if (/\d/.test(trimmed) && trimmed.length > 60) return false;
      if (!/\d/.test(trimmed) && trimmed.length > 36) return false;
      return true;
    })
    .map((line) => {
      let processedLine = line.trim();

      // Remove price-like patterns
      processedLine = processedLine
        .replace(/\b\d+\s*(gramas?|grama|kgs?|kg|ml|litros?|litro|gr|g|l)\b/gi, "")
        .replace(/\b\d+[.,]\d{1,2}\b/g, "")
        .replace(/R\$\s*\d+(\.\d+)?([.,]\d{1,2})?/g, "")
        .replace(/-\s*\d+(\.\d+)?([.,]\d{1,2})?/g, "")
        .replace(/-\s*\d+[.,]\d{1,2}/g, "");

      let quantity = 0;
      let productName = processedLine;

      const parenthesesMatch = processedLine.match(/\((\d+)\)/);
      if (parenthesesMatch) {
        quantity = parseInt(parenthesesMatch[1], 10);
        productName = processedLine.replace(/\(\d+\)/, "");
      } else {
        const colonMatch = processedLine.match(/:\s*(\d+)/);
        if (colonMatch) {
          quantity = parseInt(colonMatch[1], 10);
          productName = processedLine.replace(/:\s*\d+/, "");
        } else {
          const allNumbers = processedLine.match(/(?<!\d)(\d+)(?!\d)/g);
          if (allNumbers && allNumbers.length > 0) {
            const lastNumber = allNumbers[allNumbers.length - 1];
            const lastNumberIndex = processedLine.lastIndexOf(lastNumber);
            const precedingChar = processedLine[lastNumberIndex - 1];
            if (
              lastNumberIndex === processedLine.length - lastNumber.length ||
              precedingChar === " " ||
              precedingChar === ":" ||
              precedingChar === "-" ||
              precedingChar === undefined
            ) {
              const followingChars = processedLine
                .substring(lastNumberIndex + lastNumber.length)
                .toLowerCase();
              if (!followingChars.match(/^(g|ml|l|kg|gr)/)) {
                quantity = parseInt(lastNumber, 10);
                productName =
                  processedLine.substring(0, lastNumberIndex) +
                  processedLine.substring(lastNumberIndex + lastNumber.length);
              }
            }
          }
        }
      }

      productName = productName
        .replace(/\b(reais|real|centavos?)\b/gi, "")
        .replace(/\d+/g, "")
        .replace(/[-\/:_,;]/g, " ")
        .replace(
          /[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F700}-\u{1F77F}|\u{1F780}-\u{1F7FF}|\u{1F800}-\u{1F8FF}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FAFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu,
          ""
        )
        .replace(/\s+/g, " ")
        .trim();

      if (!productName) return null;

      return { originalName: productName, quantity };
    })
    .filter((item): item is ImportProduct => item !== null);
};