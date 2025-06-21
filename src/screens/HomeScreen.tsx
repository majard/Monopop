import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ViewStyle,
  TextStyle,
  Pressable,
  Clipboard,
} from "react-native";
import {
  TextInput as PaperTextInput,
  Button,
  useTheme,
  Text,
  Card,
  IconButton,
  FAB,
  Menu,
  Divider,
} from "react-native-paper";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, {
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { parse, isSameDay, parseISO, set } from "date-fns";
import {
  getProducts,
  Product,
  updateProductQuantity,
  saveProductHistoryForSingleProduct,
  deleteProduct,
  updateProduct,
  updateProductOrder,
  saveProductHistory,
  getProductHistory,
  addProduct,
  consolidateProductHistory,
  QuantityHistory,
  getListById,
  updateListName,
  deleteList,
} from "../database/database";
import { calculateSimilarity, preprocessName } from "../utils/similarityUtils";
import { RootStackParamList } from "../types/navigation";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { getEmojiForProduct } from "../utils/stringUtils";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;
type HomeScreenProps = NativeStackScreenProps<RootStackParamList, "Home">;

type Styles = {
  container: ViewStyle;
  header: ViewStyle;
  searchContainer: ViewStyle;
  searchInput: ViewStyle;
  buttonRow: ViewStyle;
  button: ViewStyle;
  buttonText: TextStyle;
  list: ViewStyle;
  card: ViewStyle;
  cardHeader: ViewStyle;
  dragHandle: ViewStyle;
  cardContent: ViewStyle;
  quantityContainer: ViewStyle;
  quantityButtons: ViewStyle;
  quantityInputContainer: ViewStyle;
  input: ViewStyle;
  cardActions: ViewStyle;
  fab: ViewStyle;
  modalOverlay: ViewStyle;
  modalContainer: ViewStyle;
  modalTitle: TextStyle;
  confirmationContent: ViewStyle;
  textInput: TextStyle;
  productInfo: ViewStyle;
  existingProduct: ViewStyle;
  similarProducts: ViewStyle;
  productCompareContainer: ViewStyle;
  productInfoColumn: ViewStyle;
  similarProductsScroll: ViewStyle;
  similarProductItemContainer: ViewStyle;
  quantityText: TextStyle;
  dateText: TextStyle;
  similarProductsContainer: ViewStyle;
  buttonContainer: ViewStyle;
  sectionTitle: TextStyle;
};

const similarityThreshold = 0.5; // Define your similarity threshold
const searchSimilarityThreshold = 0.4; // Define your similarity threshold

const commonOmittedWords = ["de", "do", "da", "e", "com"]; // Add more as needed

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

export default function HomeScreen() {
  const route = useRoute<HomeScreenProps["route"]>();
  const listId = route.params?.listId ?? 1;
  const [listName, setListName] = useState("");
  const [isEditingListName, setIsEditingListName] = useState(false);
  const [listNameInput, setListNameInput] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentId, setAdjustmentId] = useState<number | null>(null);
  const [adjustmentIncrement, setAdjustmentIncrement] = useState(false);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const theme = useTheme();
  const [isMounted, setIsMounted] = useState(true);
  const [sortOrder, setSortOrder] = useState<
    "custom" | "alphabetical" | "quantityAsc" | "quantityDesc"
  >("custom");
  const [menuVisible, setMenuVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importText, setImportText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmationModalVisible, setConfirmationModalVisible] =
    useState(false);
  const [currentImportItem, setCurrentImportItem] = useState<{
    importedProduct: { originalName: string; quantity: number };
    bestMatch: Product | null;
    importDate: Date | null;
    remainingProducts: { originalName: string; quantity: number }[];
    similarProducts: Product[];
  } | null>(null);

  console.log("listId:", listId);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const sortProducts = (productsToSort: Product[]) => {
    let sortedProducts = [...productsToSort];

    // If there's a search query, sort by similarity
    if (searchQuery.trim()) {
      const processedQuery = preprocessName(searchQuery);
      sortedProducts.sort((a, b) => {
        const similarityA = calculateSimilarity(
          processedQuery,
          preprocessName(a.name)
        );
        const similarityB = calculateSimilarity(
          processedQuery,
          preprocessName(b.name)
        );
        return similarityB - similarityA;
      });
      return sortedProducts;
    }

    // Otherwise use the selected sort order
    switch (sortOrder) {
      case "alphabetical":
        sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "quantityAsc":
        sortedProducts.sort((a, b) => a.quantity - b.quantity);
        break;
      case "quantityDesc":
        sortedProducts.sort((a, b) => b.quantity - a.quantity);
        break;
      default:
        sortedProducts.sort((a, b) => a.order - b.order);
        break;
    }
    return sortedProducts;
  };

  const loadProducts = async () => {
    try {
      const loadedProducts = await getProducts(listId);
      if (isMounted) {
        setProducts(loadedProducts);
      }
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    }
  };

  const getLastHistoryDate = async (productHistory: QuantityHistory[]) => {
    if (productHistory.length === 0) return null;
    const sortedHistory = productHistory.sort(
      (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
    );
    return parseISO(sortedHistory[0].date);
  };

  const handleImportButtonClick = () => {
    setIsImportModalVisible(true);
  };

  const handleImportModalImport = () => {
    importStockList(importText);
    setIsImportModalVisible(false);
    setImportText("");
  };

  const handleImportModalCancel = () => {
    setIsImportModalVisible(false);
    setImportText("");
  };

  useEffect(() => {
    const loadAndSortProducts = async () => {
      try {
        const loadedProducts = await getProducts(listId);
        if (isMounted) {
          const sortedProducts = sortProducts(loadedProducts);
          setProducts([...sortedProducts]);
        }
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);
      }
    };
    loadAndSortProducts();
  }, [sortOrder]);

  useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAdjusting && adjustmentId !== null) {
      const initialTimeout = setTimeout(() => {
        interval = setInterval(() => {
          setProducts((prevProducts) =>
            prevProducts.map((product) => {
              if (product.id === adjustmentId) {
                const newQuantity = adjustmentIncrement
                  ? product.quantity + 1
                  : Math.max(0, product.quantity - 1);

                // Update product in database after UI update
                setTimeout(() => {
                  updateProduct(adjustmentId, newQuantity).catch(console.error);
                }, 0);

                return { ...product, quantity: newQuantity };
              }
              return product;
            })
          );
        }, 100);
      }, 300);
      return () => {
        clearTimeout(initialTimeout);
        if (interval) clearInterval(interval);
      };
    }
  }, [isAdjusting, adjustmentId, adjustmentIncrement]);

  const handleDelete = async (id: number) => {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja excluir este produto?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(id);
              loadProducts();
            } catch (error) {
              console.error("Erro ao deletar produto:", error);
            }
          },
        },
      ]
    );
  };

  const handleQuantityInput = (id: number, value: string) => {
    // Update UI immediately
    setProducts((prevProducts) =>
      prevProducts.map((product) => {
        if (product.id === id) {
          const newQuantity = value === "" ? 0 : parseInt(value, 10);
          if (!isNaN(newQuantity) && newQuantity >= 0) {
            // Schedule database update with minimal delay
            setTimeout(() => {
              updateProduct(id, newQuantity).catch((error) =>
                console.error("Erro ao atualizar quantidade:", error)
              );
            }, 200);

            return { ...product, quantity: newQuantity };
          }
        }
        return product;
      })
    );
  };

  const handleQuantityChange = (
    id: number,
    currentQuantity: number,
    increment: boolean
  ) => {
    const newQuantity = increment
      ? currentQuantity + 1
      : Math.max(0, currentQuantity - 1);

    // Update UI immediately
    setProducts((prevProducts) =>
      prevProducts.map((product) =>
        product.id === id ? { ...product, quantity: newQuantity } : product
      )
    );

    // Schedule database update with minimal delay
    setTimeout(() => {
      updateProduct(id, newQuantity).catch((error) =>
        console.error("Erro ao atualizar quantidade:", error)
      );
    }, 200);
  };

  const startContinuousAdjustment = (
    id: number,
    currentQuantity: number,
    increment: boolean
  ) => {
    handleQuantityChange(id, currentQuantity, increment);
    setAdjustmentId(id);
    setAdjustmentIncrement(increment);
    setIsAdjusting(true);
  };

  const stopContinuousAdjustment = () => {
    setIsAdjusting(false);
    setAdjustmentId(null);
  };

  const generateAndCopyStockList = async () => {
    try {
      await saveProductHistory();
      const today = new Date();
      const dateStr = today.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      let text = `Boa noite! ${dateStr}\n\n`;
      text += "Aqui está a lista de produção do dia:\n\n";
      products.forEach((product) => {
        const emoji = getEmojiForProduct(product.name);
        text += `- ${product.name}: ${product.quantity} ${emoji}\n`;
      });
      await Clipboard.setString(text);
    } catch (error) {
      console.error("Erro ao salvar histórico e copiar lista:", error);
    }
  };

  const handleDragEnd = async ({ data }: { data: Product[] }) => {
    try {
      setProducts(data);
      const updates = data.map((product, index) => ({
        id: product.id,
        order: index,
      }));
      await updateProductOrder(updates);
    } catch (error) {
      console.error("Erro ao reordenar produtos:", error);
      loadProducts();
    }
  };

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

  const renderItem = ({
    item,
    drag,
    isActive,
  }: {
    item: Product;
    drag: () => void;
    isActive: boolean;
  }) => {
    return (
      <ScaleDecorator>
        <Card style={[styles.card, { opacity: isActive ? 0.5 : 1 }]}>
          <Pressable
            onPress={() =>
              navigation.navigate("EditProduct", { product: item })
            }
            onLongPress={drag}
            testID={`product-card-${item.id}`}
          >
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.dragHandle}>
                  <Text variant="titleMedium">
                    {item.name + " " + getEmojiForProduct(item.name)}
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() =>
                      navigation.navigate("EditProduct", { product: item })
                    }
                    iconColor={theme.colors.primary}
                  />
                  <IconButton
                    icon="delete"
                    size={20}
                    onPress={() => handleDelete(item.id)}
                    iconColor={theme.colors.error}
                    testID={`delete-button-${item.id}`}
                  />
                </View>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.quantityContainer}>
                  <View style={styles.quantityInputContainer}>
                    <Text variant="bodyMedium">Quantidade: </Text>
                    <PaperTextInput
                      mode="outlined"
                      dense
                      value={item.quantity.toString()}
                      onChangeText={(value) =>
                        handleQuantityInput(item.id, value)
                      }
                      keyboardType="numeric"
                      style={styles.input}
                      testID={`quantity-text-input-${item.id}`}
                    />
                  </View>
                  <View style={styles.quantityButtons}>
                    <IconButton
                      icon="minus"
                      size={20}
                      onPress={() =>
                        handleQuantityChange(item.id, item.quantity, false)
                      }
                      onLongPress={() =>
                        startContinuousAdjustment(item.id, item.quantity, false)
                      }
                      onPressOut={stopContinuousAdjustment}
                    />
                    <IconButton
                      icon="plus"
                      size={20}
                      onPress={() =>
                        handleQuantityChange(item.id, item.quantity, true)
                      }
                      onLongPress={() =>
                        startContinuousAdjustment(item.id, item.quantity, true)
                      }
                      onPressOut={stopContinuousAdjustment}
                      testID={`increment-button-${item.id}`}
                    />
                  </View>
                </View>
              </View>
            </Card.Content>
          </Pressable>
        </Card>
      </ScaleDecorator>
    );
  };

  const filteredProducts = products.filter((product) => {
    const processedProductName = preprocessName(product.name);
    const processedSearchQuery = preprocessName(searchQuery);

    // If search query is empty, return all products
    if (!processedSearchQuery) {
      return true;
    }

    // Calculate the length threshold
    const nameLength = processedProductName.length;
    const queryLength = processedSearchQuery.length;
    const lengthThreshold = Math.ceil(nameLength * 0.5); // 50% of the product name length

    // Use a simple substring match if the query is less than 50% of the product name length
    if (queryLength < lengthThreshold) {
      return processedProductName.includes(processedSearchQuery);
    }

    // Calculate similarity if the query meets the length requirement
    const similarity = calculateSimilarity(
      processedProductName,
      processedSearchQuery
    );

    return similarity >= searchSimilarityThreshold;
  });

  const styles = createHomeScreenStyles(theme);

  useEffect(() => {
    getListById(listId).then((list) => {
      if (list) setListName(list.name);
    });
  }, [listId]);

  const handleListNameEdit = () => {
    setIsEditingListName(true);
    setListNameInput(listName);
  };

  const handleListNameSave = async () => {
    if (listNameInput.trim()) {
      await updateListName(listId, listNameInput.trim());
      setListName(listNameInput.trim());
      setIsEditingListName(false);
    }
  };

  const handleListDelete = async () => {
    Alert.alert("Excluir Lista", "Tem certeza que deseja excluir esta lista?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await deleteList(listId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          {isEditingListName ? (
            <>
              <PaperTextInput
                value={listNameInput}
                onChangeText={setListNameInput}
                style={{ flex: 1, marginRight: 8 }}
                mode="outlined"
                dense
              />
              <IconButton icon="check" iconColor={theme.colors.primary} onPress={handleListNameSave} />
              <IconButton
                icon="close"
                iconColor={theme.colors.error}
                onPress={() => setIsEditingListName(false)}
              />
            </>
          ) : (
            <>
              <Text variant="titleLarge" style={{ flex: 1 }}>
                {listName}
              </Text>
              <IconButton
                icon="pencil"
                iconColor={theme.colors.primary}
                onPress={handleListNameEdit}
              />
            </>
          )}
          <IconButton
            icon="delete"
            iconColor={theme.colors.error}
            onPress={handleListDelete}
          />
        </View>
        <View style={styles.searchContainer}>
          <PaperTextInput
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            mode="outlined"
            style={styles.searchInput}
            right={
              searchQuery.trim() ? (
                <PaperTextInput.Icon
                  icon="close"
                  size={24}
                  onPress={() => setSearchQuery("")}
                  color={theme.colors.error}
                />
              ) : undefined
            }
          />
        </View>
        <View style={styles.buttonRow}>
          <Button
            mode="contained"
            onPress={generateAndCopyStockList}
            style={styles.button}
            icon="content-copy"
            labelStyle={styles.buttonText}
          >
            Salvar
          </Button>

          <Button
            mode="contained"
            onPress={handleImportButtonClick}
            icon="import"
            style={styles.button}
            labelStyle={styles.buttonText}
          >
            Importar
          </Button>

          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={
              <Button
                icon="sort"
                onPress={openMenu}
                style={styles.button}
                labelStyle={styles.buttonText}
              >
                Ordenar
              </Button>
            }
          >
            <Menu.Item
              onPress={() => {
                setSortOrder("custom");
                closeMenu();
              }}
              title="Ordem Personalizada"
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setSortOrder("alphabetical");
                closeMenu();
              }}
              title="Alfabética"
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setSortOrder("quantityDesc");
                closeMenu();
              }}
              title="Quantidade (Maior Primeiro)"
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setSortOrder("quantityAsc");
                closeMenu();
              }}
              title="Quantidade (Menor Primeiro)"
            />
          </Menu>
        </View>
      </View>
      <DraggableFlatList
        data={filteredProducts}
        onDragEnd={handleDragEnd}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        extraData={products}
        testID="draggable-flatlist"
      />
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate("AddProduct", { listId })}
        label="Adicionar Produto"
      />
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
    </SafeAreaView>
  );
}
