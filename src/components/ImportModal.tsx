import { parse, parseISO, isSameDay } from "date-fns";
import { useState, useEffect } from "react";
import { calculateSimilarity } from "../utils/similarityUtils";
import { Modal, View, Text, ScrollView, Alert } from "react-native";
import {
  Button,
  TextInput as PaperTextInput,
  useTheme,
} from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import {
  updateInventoryItem,
  saveInventoryHistorySnapshot,
  getInventoryHistory,
  addSingleInventoryHistoryEntry,
  addProduct,
  getInventoryItems,
  addInventoryItem,
} from "../database/database";
import { InventoryItem, InventoryHistory } from "../database/models";
import { ConfirmationModal } from "./ImportConfirmationModal";

const similarityThreshold = 0.5;

export default function ImportModal({
  isImportModalVisible,
  setIsImportModalVisible,
  loadItems,
  listId,
}) {
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const [importText, setImportText] = useState("");
  const [confirmationModalVisible, setConfirmationModalVisible] =
    useState(false);
  const [currentImportItem, setCurrentImportItem] = useState<{
    importedProduct: { originalName: string; quantity: number };
    bestMatch: InventoryItem | null;
    importDate: Date | null;
    remainingProducts: { originalName: string; quantity: number }[];
    similarProducts: InventoryItem[];
  } | null>(null);

  const handleImportModalImport = () => {
    importStockList(importText);
    setIsImportModalVisible(false);
    setImportText("");
  };

  const handleImportModalCancel = () => {
    setIsImportModalVisible(false);
    setImportText("");
  };

  const checkDateExists = (array: InventoryHistory[], targetDate: Date) => {
    // Parse the target date
    const parsedTargetDate = parseISO(targetDate.toISOString());
    if (array.length === 0) return false;

    // Check if any object in the array has the same date
    return array.some((item) => {
      const itemDate = parseISO(item.date); // Parse the date from the item
      return isSameDay(itemDate, parsedTargetDate); // Compare the two dates
    });
  };

  const getLastHistoryDate = async (productHistory: InventoryHistory[]) => {
    if (productHistory.length === 0) return null;
    const sortedHistory = productHistory.sort(
      (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
    );
    return parseISO(sortedHistory[0].date);
  };

  const processNextProduct = async (
    remainingProducts: { originalName: string; quantity: number }[],
    importDate?: Date
  ) => {
    if (!remainingProducts || remainingProducts.length === 0) {
      setConfirmationModalVisible(false);
      setCurrentImportItem(null);
      await loadItems();
      return;
    }

    const [currentProduct, ...rest] = remainingProducts;
    const existingProducts = await getInventoryItems(listId);
    console.log('\n\nexistingProducts in processNextProduct', existingProducts);
    // First, check for exact name matches (case-insensitive)   
    const exactMatch = existingProducts.find(
      (p) => p.productName.toLowerCase() === currentProduct.originalName.toLowerCase()
    );

    if (exactMatch) {
      console.log('\n\nexactMatch', exactMatch);
      // Update quantity and history of exact match
      const productHistory = await getInventoryHistory(exactMatch.id);
      const lastHistoryDate = await getLastHistoryDate(productHistory);
      if (lastHistoryDate < importDate) {
        await updateInventoryItem(exactMatch.id, currentProduct.quantity);
      }
      if (importDate && !checkDateExists(productHistory, importDate)) {
        await saveInventoryHistorySnapshot(
          exactMatch.id,
          currentProduct.quantity,
          importDate
        );
      }
      await processNextProduct(rest, importDate);
      return;
    }

    // If no exact match, look for similar products
    const similarProducts = existingProducts
      .filter(
        (p) =>
          calculateSimilarity(p.productName, currentProduct.originalName) >=
          similarityThreshold
      )
      .sort(
        (product1, product2) =>
          calculateSimilarity(product2.productName, currentProduct.originalName) -
          calculateSimilarity(product1.productName, currentProduct.originalName)
      );

    if (similarProducts.length > 0) {
      setCurrentImportItem({
        importedProduct: currentProduct,
        bestMatch: similarProducts[0],
        similarProducts,
        remainingProducts: rest,
        importDate,
      });
      setConfirmationModalVisible(true);
    } else {
      // No similar products found, create new product
      await createNewProduct(currentProduct, importDate);
      await processNextProduct(rest, importDate);
    }
  };

  const createNewProduct = async (
    product: { originalName: string; quantity: number },
    importDate?: Date
  ) => {
    try {
      // Check for exact name match again (case-insensitive)
      const existingProducts = await getInventoryItems(listId);
      const exactMatch = existingProducts.find(
        (p) => p.productName.toLowerCase() === product.originalName.toLowerCase()
      );
      console.log('\n\nexactMatch in createNewProduct', exactMatch);

      if (exactMatch) {
        // Update quantity of exact match
        await updateInventoryItem(exactMatch.id, product.quantity);
        return exactMatch.id;
      }

      // No exact match found, create new product
      const productId = await addProduct(product.originalName);
      const inventoryItemId = await addInventoryItem(
        listId,
        productId,
        product.quantity,
      );  
      const productHistory = await getInventoryHistory(inventoryItemId);

      if (importDate && !checkDateExists(productHistory, importDate)) {
        await saveInventoryHistorySnapshot(
          inventoryItemId,
          product.quantity,
          importDate
        );
      }

      console.log('\n\n created new product', productId);

      return productId;
    } catch (error) {
      console.error("Error creating new product:", error);
      throw error;
    }
  };

  const importStockList = async (text: string) => {
    try {
      const lines = text.split("\n");
      const importDate = parseImportDate(lines);
      const importedProducts = parseImportProducts(lines);
      const existingProducts = await getInventoryItems(listId);
      console.log('\n\nimportedProducts', importedProducts);

      await processNextProduct(importedProducts, importDate);
    } catch (error) {
      console.error("Error importing stock list:", error);
      Alert.alert("Erro", "Ocorreu um erro ao importar a lista.");
    }
  };

  const handleAcceptAllSuggestions = async () => {
    try {
      if (!currentImportItem?.bestMatch || !currentImportItem?.similarProducts)
        return;

      // Accept the current bestMatch for the current imported product
      const { bestMatch, importedProduct, importDate, remainingProducts } = currentImportItem;
      const now = new Date();
      const historyDate = importDate ? importDate : now;
      const productHistory = await getInventoryHistory(bestMatch.id);
      const lastHistoryDate = await getLastHistoryDate(productHistory);

      // If there is an import date and it doesn't exist in the history, save the history
      if (importDate && !checkDateExists(productHistory, importDate)) {
        await addSingleInventoryHistoryEntry(
          bestMatch.id,
          importedProduct.quantity,
          importDate
        );
      }

      // If we have a history entry from the same day or the import is older, skip it
      if (
        isSameDay(lastHistoryDate, historyDate) ||
        historyDate < lastHistoryDate
      ) {
        console.log(
          `Skipping update: ${
            historyDate < lastHistoryDate ? "older import" : "same day entry"
          }`
        );
      } else {
        // Only update if the date is newer than the last history entry
        await updateInventoryItem(bestMatch.id, importedProduct.quantity);
      }

      // Process all remaining products automatically without showing confirmation modal
      const existingProducts = await getInventoryItems(listId);
      
      for (const product of remainingProducts) {
        // Check for exact name match first
        const exactMatch = existingProducts.find(
          (p) => p.productName.toLowerCase() === product.originalName.toLowerCase()
        );

        if (exactMatch) {
          // Update quantity and history of exact match
          const exactMatchHistory = await getInventoryHistory(exactMatch.id);
          const exactMatchLastDate = await getLastHistoryDate(exactMatchHistory);
          if (exactMatchLastDate < importDate) {
            await updateInventoryItem(exactMatch.id, product.quantity);
          }
          if (importDate && !checkDateExists(exactMatchHistory, importDate)) {
            await saveInventoryHistorySnapshot(
              exactMatch.id,
              product.quantity,
              importDate
            );
          }
        } else {
          // Look for similar products
          const similarProducts = existingProducts
            .filter(
              (p) =>
                calculateSimilarity(p.productName, product.originalName) >=
                similarityThreshold
            )
            .sort(
              (product1, product2) =>
                calculateSimilarity(product2.productName, product.originalName) -
                calculateSimilarity(product1.productName, product.originalName)
            );

          if (similarProducts.length > 0) {
            // Use the best match silently
            const bestSimilarMatch = similarProducts[0];
            await updateInventoryItem(bestSimilarMatch.id, product.quantity);
            
            if (importDate) {
              const similarHistory = await getInventoryHistory(bestSimilarMatch.id);
              if (!checkDateExists(similarHistory, importDate)) {
                await saveInventoryHistorySnapshot(
                  bestSimilarMatch.id,
                  product.quantity,
                  importDate
                );
              }
            }
          } else {
            // No match exists, create a new product
            await createNewProduct(product, importDate);
          }
        }
      }

      setConfirmationModalVisible(false);
      setCurrentImportItem(null);
      await loadItems();
    } catch (error) {
      console.error("Error accepting all suggestions:", error);
    }
  };

  const handleAddToExisting = async () => {
    if (!currentImportItem?.bestMatch) return;

    try {
      const { bestMatch, importedProduct, importDate, remainingProducts } =
        currentImportItem;
      const now = new Date();
      const historyDate = importDate ? importDate : now;
      const productHistory = await getInventoryHistory(bestMatch.id);
      const lastHistoryDate = await getLastHistoryDate(productHistory);

      // If there is an import date and it doesn't exist in the history, save the history
      if (importDate && !checkDateExists(productHistory, importDate)) {
        await addSingleInventoryHistoryEntry(
          bestMatch.id,
          importedProduct.quantity,
          importDate
        );
      }

      // If we have a history entry from the same day or the import is older, skip it
      if (
        isSameDay(lastHistoryDate, historyDate) ||
        historyDate < lastHistoryDate
      ) {
        console.log(
          `Skipping update: ${
            historyDate < lastHistoryDate ? "older import" : "same day entry"
          }`
        );
        setConfirmationModalVisible(false);
        await processNextProduct(remainingProducts, importDate);
        return;
      }

      // Only update if the date is newer than the last history entry
      await updateInventoryItem(bestMatch.id, importedProduct.quantity);

      setConfirmationModalVisible(false);
      await processNextProduct(remainingProducts, importDate);
    } catch (error) {
      console.error("Error updating product quantity:", error);
    }
  };

  const handleCreateNew = async () => {
    if (!currentImportItem) return;

    const { importedProduct, importDate, remainingProducts } =
      currentImportItem;
    await createNewProduct(importedProduct, importDate);

    setConfirmationModalVisible(false);
    await processNextProduct(remainingProducts, importDate);
  };

  const handleSkipImport = async () => {
    if (!currentImportItem) return;

    setConfirmationModalVisible(false);
    await processNextProduct(
      currentImportItem.remainingProducts,
      currentImportItem.importDate
    );
  };

  const handleCancelAllImports = () => {
    setConfirmationModalVisible(false);
    setCurrentImportItem(null);
  };

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
              style={[
                styles.textInput,
                { height: 150, textAlignVertical: "top" },
              ]}
              multiline
              value={importText}
              onChangeText={setImportText}
              placeholder="Cole aqui sua lista de produtos"
              mode="outlined"
              dense
            />
            <View style={styles.buttonRow}>
              <Button
                onPress={handleImportModalCancel}
                style={styles.stackedButton}
              >
                Cancelar
              </Button>
              <Button
                onPress={handleImportModalImport}
                style={styles.stackedButton}
              >
                Importar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={confirmationModalVisible}
        currentImportItem={currentImportItem}
        onAcceptAllSuggestions={handleAcceptAllSuggestions}
        onAddToExisting={handleAddToExisting}
        onCreateNew={handleCreateNew}
        onSkipImport={handleSkipImport}
        onCancelAllImports={handleCancelAllImports}
        onUpdateCurrentItem={setCurrentImportItem}
      />
    </View>
  );
}

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
          // For single digit dates, pad with zeros for parsing
          const paddedLine =
            i === 3
              ? `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`
              : line;

          const format = i === 3 ? "dd/MM" : dateFormats[i];
          const parsedDate = parse(paddedLine, format, new Date());

          if (parsedDate && !isNaN(parsedDate.getTime())) {
            if (i === 2 || i === 3) {
              // For dd/MM or d/M format
              const day = parseInt(match[1], 10);
              const month = parseInt(match[2], 10) - 1; // Month is 0-indexed

              // Determine the correct year
              let assumedYear = currentYear;
              const parsedMonth = month + 1;
              if (
                parsedMonth > currentMonth ||
                (parsedMonth === currentMonth && day > currentDate.getDate())
              ) {
                assumedYear--;
              }
              // Set time to 20:00
              return new Date(assumedYear, month, day, 20, 0, 0);
            }
            // Set time to 20:00 for all other date formats
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
): { originalName: string; quantity: number }[] => {
  return lines
    .filter((line) => line.trim()) // Remove empty lines
    .map((line) => {
      // First, check if there are multiple numbers in the line
      const numbers = line.match(/\d+/g);
      if (!numbers || numbers.length === 0) return null; // No numbers = not a product
      if (numbers.length > 1) return null; // Multiple numbers = likely a date or something else

      const quantity = parseInt(numbers[0], 10);
      if (isNaN(quantity) || quantity <= 0) return null;

      // Remove the quantity and any special characters to get the product name
      const nameWithoutQuantity = line.replace(numbers[0], "");
      // Clean the name: remove special characters, emojis, but keep spaces between words
      const cleanedName = nameWithoutQuantity
        .replace(/[-\/:_,;]/g, " ") // Replace separators with spaces
        .replace(
          /[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F700}-\u{1F77F}|\u{1F780}-\u{1F7FF}|\u{1F800}-\u{1F8FF}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FAFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu,
          ""
        ) // Remove emojis
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .trim(); // Remove leading/trailing spaces

      if (!cleanedName) return null;

      return {
        originalName: cleanedName,
        quantity,
      };
    })
    .filter((item) => item !== null);
};
