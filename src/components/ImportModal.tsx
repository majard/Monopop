import { parse, parseISO, isSameDay } from "date-fns";
import { useState, useEffect } from "react";
import { calculateSimilarity } from "../utils/similarityUtils";
import { Modal, View, Text, TextInput, ScrollView, Alert } from "react-native";
import {
  Button,
  TextInput as PaperTextInput,
  useTheme,
} from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import {
  getProducts,
  Product,
  updateProductQuantity,
  saveProductHistoryForSingleProduct,
  getProductHistory,
  addProduct,
  consolidateProductHistory,
  QuantityHistory,
} from "../database/database";
const similarityThreshold = 0.5;

export default function ImportModal({
  isImportModalVisible,
  setIsImportModalVisible,
  loadProducts,
  listId,
}) {
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const [importText, setImportText] = useState("");
  const [confirmationModalVisible, setConfirmationModalVisible] =
    useState(false);
  const [currentImportItem, setCurrentImportItem] = useState<{
    importedProduct: { originalName: string; quantity: number };
    bestMatch: Product | null;
    importDate: Date | null;
    remainingProducts: { originalName: string; quantity: number }[];
    similarProducts: Product[];
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

  const checkDateExists = (array: QuantityHistory[], targetDate: Date) => {
    // Parse the target date
    const parsedTargetDate = parseISO(targetDate.toISOString());
    if (array.length === 0) return false;

    // Check if any object in the array has the same date
    return array.some((item) => {
      const itemDate = parseISO(item.date); // Parse the date from the item
      return isSameDay(itemDate, parsedTargetDate); // Compare the two dates
    });
  };

  
  const getLastHistoryDate = async (productHistory: QuantityHistory[]) => {
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
      await loadProducts();
      return;
    }

    const [currentProduct, ...rest] = remainingProducts;
    const existingProducts = await getProducts(listId);
    // First, check for exact name matches (case-insensitive)
    const exactMatch = existingProducts.find(
      (p) => p.name.toLowerCase() === currentProduct.originalName.toLowerCase()
    );

    if (exactMatch) {
      // Update quantity and history of exact match
      const productHistory = await getProductHistory(exactMatch.id.toString());
      const lastHistoryDate = await getLastHistoryDate(productHistory);
      if (lastHistoryDate < importDate) {
        await updateProductQuantity(exactMatch.id, currentProduct.quantity);
      }
      if (importDate && !checkDateExists(productHistory, importDate)) {
        await saveProductHistoryForSingleProduct(
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
          calculateSimilarity(p.name, currentProduct.originalName) >=
          similarityThreshold
      )
      .sort(
        (product1, product2) =>
          calculateSimilarity(product2.name, currentProduct.originalName) -
          calculateSimilarity(product1.name, currentProduct.originalName)
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
      const existingProducts = await getProducts(listId);
      const productHistory = await getProductHistory(product.originalName);
      const exactMatch = existingProducts.find(
        (p) => p.name.toLowerCase() === product.originalName.toLowerCase()
      );

      if (exactMatch) {
        // Update quantity of exact match
        await updateProductQuantity(exactMatch.id, product.quantity);
        return exactMatch.id;
      }

      // No exact match found, create new product
      const productId = await addProduct(
        product.originalName,
        product.quantity,
        listId
      );

      if (importDate && !checkDateExists(productHistory, importDate)) {
        await saveProductHistoryForSingleProduct(
          productId,
          product.quantity,
          importDate
        );
      }

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
      const existingProducts = await getProducts(listId);

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

      // Update all similar products to match the best match
      for (const product of currentImportItem.similarProducts.slice(1)) {
        await consolidateProductHistory(
          product.id,
          currentImportItem.bestMatch.id
        );
      }

      // Update the quantity of the best match
      await updateProductQuantity(
        currentImportItem.bestMatch.id,
        currentImportItem.importedProduct.quantity
      );

      setConfirmationModalVisible(false);
      await processNextProduct(
        currentImportItem.remainingProducts,
        currentImportItem.importDate
      );
    } catch (error) {
      console.error("Error accepting all similar products:", error);
    }
  };

  const handleAcceptAllSimilar = async () => {
    try {
      if (!currentImportItem) return;
      const existingProducts = await getProducts(listId);

      // Get all remaining products that have similar matches
      const productsToUpdate = currentImportItem.remainingProducts.filter(
        (product) => {
          const similarProducts = existingProducts.filter(
            (p) =>
              calculateSimilarity(p.name, product.originalName) >=
              similarityThreshold
          );
          return similarProducts.length > 0;
        }
      );

      // Update all products
      for (const product of productsToUpdate) {
        const similarProducts = existingProducts.filter(
          (p) =>
            calculateSimilarity(p.name, product.originalName) >=
            similarityThreshold
        );
        if (similarProducts.length > 0) {
          const bestMatch = similarProducts[0];
          await updateProductQuantity(bestMatch.id, product.quantity);
        }
      }

      // Filter out the updated products and continue with the rest
      const remainingProducts = currentImportItem.remainingProducts.filter(
        (product) => {
          const similarProducts = existingProducts.filter(
            (p) =>
              calculateSimilarity(p.name, product.originalName) >=
              similarityThreshold
          );
          return similarProducts.length === 0;
        }
      );

      setConfirmationModalVisible(false);
      await processNextProduct(remainingProducts, currentImportItem.importDate);
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
      const productHistory = await getProductHistory(bestMatch.id.toString());
      const lastHistoryDate = await getLastHistoryDate(productHistory);

      // If there is an import date and it doesn't exist in the history, save the history
      if (importDate && !checkDateExists(productHistory, importDate)) {
        await saveProductHistoryForSingleProduct(
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
      await updateProductQuantity(bestMatch.id, importedProduct.quantity);

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

  const ConfirmationModal = () => {
    if (!currentImportItem) return null;

    const { importedProduct, bestMatch, similarProducts, importDate } =
      currentImportItem;
    const [isNewerOrSameDate, setIsNewerOrSameDate] = useState(false);

    useEffect(() => {
      const checkHistory = async () => {
        const history = await getProductHistory(bestMatch.id.toString());
        if (history.length === 0) {
          setIsNewerOrSameDate(true);
          return;
        }

        const sortedHistory = history.sort(
          (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
        );

        const lastHistoryDate = parseISO(sortedHistory[0].date);
        const historyDate = importDate || new Date();

        // Check if the import date is the same or newer than the last history entry
        setIsNewerOrSameDate(historyDate >= lastHistoryDate);
      };

      checkHistory();
    }, [bestMatch.id, importDate]);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return (
      <Modal
        visible={confirmationModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          >
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Produtos de Nomes Parecidos</Text>
              <View style={styles.confirmationContent}>
                <View style={styles.productCompareContainer}>
                  <View style={styles.productInfoColumn}>
                    <Text style={styles.productLabel}>Produto Importado:</Text>
                    <Text style={styles.productValue}>
                      {importedProduct.originalName}
                    </Text>
                    <Text style={styles.quantityText}>
                      Quantidade: {importedProduct.quantity}
                    </Text>
                    {importDate && (
                      <Text style={styles.dateText}>
                        Data: {formatDate(importDate)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.productInfoColumn}>
                    <Text style={styles.productLabel}>Produto Existente:</Text>
                    <Text style={styles.productValue}>{bestMatch.name}</Text>
                    <Text style={styles.quantityText}>
                      Quantidade: {bestMatch.quantity}
                    </Text>
                  </View>
                </View>

                {similarProducts.length > 1 && (
                  <View style={styles.similarProductsContainer}>
                    <Text style={styles.sectionTitle}>
                      Outros Produtos Similares:
                    </Text>
                    <ScrollView
                      style={styles.similarProductsScroll}
                      nestedScrollEnabled={true}
                    >
                      {similarProducts.slice(1).map((product, index) => (
                        // This is a hack to make the selected product the best match

                        <Pressable
                          key={product.id}
                          onPress={() => {
                            const updatedSimilarProducts = [
                              product,
                              ...similarProducts.filter(
                                (p) => p.id !== product.id
                              ),
                            ];

                            setCurrentImportItem({
                              ...currentImportItem,
                              bestMatch: product,
                              similarProducts: updatedSimilarProducts,
                            });
                          }}
                        >
                          <View
                            key={index}
                            style={styles.similarProductItemContainer}
                          >
                            <Text style={styles.productValue}>
                              {product.name}
                            </Text>
                            <Text style={styles.quantityText}>
                              Quantidade: {product.quantity}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              <View style={styles.buttonContainer}>
                <Button
                  mode="contained"
                  onPress={handleAddToExisting}
                  style={[styles.stackedButton, styles.actionButton]}
                  labelStyle={styles.buttonLabelStyle}
                >
                  Produtos iguais
                </Button>
                <Button
                  mode="contained"
                  onPress={handleCreateNew}
                  style={[styles.stackedButton, styles.actionButton]}
                  labelStyle={styles.buttonLabelStyle}
                >
                  Produtos diferentes
                </Button>
                <Button
                  mode="contained"
                  onPress={handleAcceptAllSuggestions}
                  style={[styles.stackedButton, styles.actionButton]}
                  labelStyle={styles.buttonLabelStyle}
                >
                  Aceitar Todas as Sugestões de Substituição
                </Button>
                <Button
                  mode="text"
                  onPress={handleSkipImport}
                  style={styles.stackedButton}
                  labelStyle={[styles.buttonLabelStyle, styles.skipButtonLabel]}
                >
                  Pular
                </Button>
                <Button
                  mode="text"
                  onPress={handleCancelAllImports}
                  style={styles.stackedButton}
                  labelStyle={[
                    styles.buttonLabelStyle,
                    styles.cancelButtonLabel,
                  ]}
                >
                  Cancelar Todos
                </Button>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
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

      <ConfirmationModal />
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
