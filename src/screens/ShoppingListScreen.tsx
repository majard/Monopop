import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  Pressable,
  Alert,
  Modal,
} from "react-native";
import {
  Button,
  Surface,
  useTheme,
} from "react-native-paper";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  getShoppingListItemsByListId,
  updateShoppingListItem,
  deleteShoppingListItem,
  setSetting,
  getLowestPriceForProducts,
  updateProductCategory,
  addProduct,
  addShoppingListItem,
  getReferencePricesForProducts,
  upsertProductStorePrice,
  upsertProductBasePrice,
  updateProductUnit,
  getLastInvoiceItemForProduct,
  clearReferencePricesForProduct,
  concludeShoppingForListWithInvoiceV2,
  getLowestRefPricesPerUnit,
} from "../database/database";
import type { RefPrice } from "../database/database";
import { RootStackParamList } from "../types/navigation";
import { ShoppingListItem } from "../database/models";
import { useListContext } from "../context/ListContext";
import { useListData } from "../context/ListDataContext";
import { useList } from "../hooks/useList";
import { EditShoppingItemModal } from "../components/EditShoppingItemModal";
import type { UnitSaveData } from "../components/EditShoppingItemModal";
import {
  ConfirmInvoiceModal,
} from "../components/ConfirmInvoiceModal";
import ContextualHeader from "../components/ContextualHeader";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddItemButton } from "../components/AddItemButton";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { SortMenu } from "../components/SortMenu";
import { sortItems, SortOrder } from "../utils/sortUtils";
import { ShoppingListItemCard } from "../components/ShoppingListItemCard";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import SearchBar from "../components/SearchBar";
import ShoppingListSkeleton from "../components/ShoppingListSkeleton";
import ImportModal from "../components/ImportModal";
import { StoreSelector } from "../components/StoreSelector";
import { generateShoppingListText } from "../utils/stringUtils";
import * as Clipboard from "expo-clipboard";
import { ActionMenuButton } from "../components/ActionMenuButton";
import { preprocessName, calculateSimilarity } from '../utils/similarityUtils';
import { UnitSymbol, getUnitFactor } from "../utils/units";


type ListRow =
  | { type: "section-header"; title: string; sectionType: "pending" | "cart" }
  | {
    type: "category-header";
    category: string;
    sectionType: "pending" | "cart";
  }
  | {
    type: "item";
    item: ShoppingListItemWithDetails;
    sectionType: "pending" | "cart";
  };

type ShoppingListScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ShoppingList"
>;

interface ShoppingListItemWithDetails extends Omit<
  ShoppingListItem,
  "checked"
> {
  checked: boolean;
  productName: string;
  productId: number;
  currentInventoryQuantity: number;
  /** Display price (suggested paid price for one package in the current store/base context). */
  price?: number;
  categoryName?: string | null;
  lowestPrice90d: { price: number; storeName: string } | null;
  /** Resolved reference price object. Set by updatePricesForStore. */
  refPrice?: RefPrice | null;
  /** Set when user edits in expanded triangle view. Written to invoice_items on conclude. */
  packageSize?: number | null;
  lowestRefPricePerUnit?: { pricePerUnit: number; storeName: string } | null;
  showWarning: boolean;
}

export default function ShoppingListScreen() {
  const { listId } = useListContext();
  const { listName, handleListNameSave, handleListDelete } = useList(listId);
  const {
    categories,
    stores,
    defaultStoreMode,
    defaultStoreId,
    lastStoreName,
    refreshStoreSettings,
    findByProductId,
  } = useListData();
  const [shoppingListItems, setShoppingListItems] = useState<
    ShoppingListItemWithDetails[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingItem, setEditingItem] =
    useState<ShoppingListItemWithDetails | null>(null);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [defaultStoreName, setDefaultStoreName] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [lastStoreId, setLastStoreId] = useState<number | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical");
  const [actionsVisible, setActionsVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const navigation = useNavigation<ShoppingListScreenNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const isFirstLoadRef = useRef(true);

  const loadDataRef = useRef<(() => Promise<void>) | null>(null);
  const manualOverridesRef = useRef<
    Map<string, Map<number, { price: number; packageSize: number | null }>>
  >(new Map());

  const updatePricesForStoreRef = useRef<
    | ((
      storeId: number | null,
      items: ShoppingListItemWithDetails[],
    ) => Promise<void>)
    | null
  >(null);

  const getStoreKey = useCallback(
    (storeId: number | null) => (storeId === null ? "base" : String(storeId)),
    [],
  );

  const getManualOverride = useCallback(
    (storeId: number | null, productId: number) => {
      const map = manualOverridesRef.current.get(getStoreKey(storeId));
      return map?.get(productId) ?? null;
    },
    [getStoreKey],
  );

  const hasManualOverride = useCallback(
    (storeId: number | null, productId: number) => {
      return getManualOverride(storeId, productId) != null;
    },
    [getManualOverride],
  );

  const setManualOverride = useCallback(
    (
      storeId: number | null,
      productId: number,
      override: { price: number; packageSize: number | null },
    ) => {
      const key = getStoreKey(storeId);
      const existing = manualOverridesRef.current.get(key);
      if (existing) {
        existing.set(productId, override);
        return;
      }
      manualOverridesRef.current.set(key, new Map([[productId, override]]));
    },
    [getStoreKey],
  );

  const clearManualOverride = useCallback(
    (storeId: number | null, productId: number) => {
      const key = getStoreKey(storeId);
      const existing = manualOverridesRef.current.get(key);
      if (!existing) return;
      existing.delete(productId);
      if (existing.size === 0) manualOverridesRef.current.delete(key);
    },
    [getStoreKey],
  );


  useEffect(() => {
    if (!shoppingListItems.length) return;

    loadPricesAsync(shoppingListItems, selectedStoreId);
  }, [selectedStoreId]);


  useFocusEffect(
    useCallback(() => {
      loadDataRef.current?.();
      return;
    }, [listId]),
  );

  useEffect(() => {
    if (!initialLoading) {
      loadDataRef.current?.();
    }
  }, [sortOrder, initialLoading]);

  const retroPromptRef = useRef<
    ((prefill: number, unit: string, invoiceInfo: { storeName: string; createdAt: string; unitPrice: number } | null) => Promise<number | null>) | null
  >(null);

  const loadData = useCallback(async () => {
    try {
      // 1. Get data
      const [shopping] = await Promise.all([
        getShoppingListItemsByListId(listId),
      ]);

      // 2. Build everything in plain JS (no setState!)
      const items: ShoppingListItemWithDetails[] = shopping.map(item => ({
        ...item,
        checked: Boolean(item.checked),
        productName: item.productName || 'Unknown Product',
        productId: item.productId || 0,
        currentInventoryQuantity: item.currentInventoryQuantity || 0,
        price: item.price,
        categoryName: item.categoryName ?? null,
        lowestPrice90d: null,
        refPrice: null,
        packageSize: item.packageSize ?? null,
        productUnit: item.productUnit ?? null,
        productStandardPackageSize: item.productStandardPackageSize ?? null,
        lowestRefPricePerUnit: null,
        showWarning: false,
      }));


      // 4. SINGLE STATE UPDATE - show UI immediately
      setShoppingListItems(items);
      setInitialLoading(false);

      // 5. Set default store on first load
      let priceStoreId = selectedStoreId;

      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;

        if (defaultStoreMode === 'last') {
          const lastStoreObj = stores.find(s => s.name === lastStoreName);
          priceStoreId = lastStoreObj?.id ?? null;
          setLastStoreId(priceStoreId);
          setSelectedStoreId(priceStoreId);
          setDefaultStoreName(lastStoreName ?? '');
        } else if (defaultStoreMode === 'fixed' && defaultStoreId) {
          const fixedStore = stores.find(s => s.id === parseInt(defaultStoreId));
          priceStoreId = fixedStore?.id ?? null;
          setSelectedStoreId(priceStoreId);
          setDefaultStoreName(fixedStore?.name ?? '');
        }
      }

      setTimeout(() => {
        loadPricesAsync(items, priceStoreId);
      }, 0);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setInitialLoading(false);
    }
  }, [listId, selectedStoreId, stores, defaultStoreMode, defaultStoreId, lastStoreName]);

  const loadPricesAsync = useCallback(
    async (items: ShoppingListItemWithDetails[], storeId: number | null) => {
      console.log('loadPricesAsync', storeId)
      const productIds = items
        .map(i => i.productId)
        .filter(id => id > 0);

      if (productIds.length === 0) return;

      try {
        const unitProductIds = items
          .filter(i => i.productUnit != null)
          .map(i => i.productId)
          .filter(id => id > 0);

        const legacyProductIds = items
          .filter(i => i.productUnit == null)
          .map(i => i.productId)
          .filter(id => id > 0);

        const [lowestMap, refMap, lowestRefMap] = await Promise.all([
          getLowestPriceForProducts(legacyProductIds),
          getReferencePricesForProducts(productIds, storeId),
          getLowestRefPricesPerUnit(unitProductIds),
        ]);

        setShoppingListItems(prev => {
          let changed = false;
          const next = prev.map(item => {
            const lowest = item.productUnit == null
              ? lowestMap.get(item.productId)
              : undefined;
            const ref = refMap.get(item.productId);
            const lowestRef = item.productUnit != null
              ? lowestRefMap.get(item.productId)
              : undefined;

            if (!lowest && !ref && !lowestRef) return item;

            const manual = getManualOverride(storeId, item.productId);

            let price = item.price;
            let packageSize = item.packageSize;

            if (manual) {
              price = manual.price;
              packageSize = manual.packageSize;
            } else if (ref) {
              price = ref.price;
              packageSize = ref.packageSize;
            }

            const lowestChanged = lowest
              ? JSON.stringify(lowest) !== JSON.stringify(item.lowestPrice90d)
              : item.lowestPrice90d !== null && item.productUnit == null;
            const refChanged = ref
              ? JSON.stringify(ref) !== JSON.stringify(item.refPrice)
              : item.refPrice !== null;
            const lowestRefChanged = lowestRef
              ? JSON.stringify(lowestRef) !== JSON.stringify(item.lowestRefPricePerUnit)
              : item.lowestRefPricePerUnit !== null && item.productUnit != null;
            const priceChanged = price !== item.price;
            const packageSizeChanged = packageSize !== item.packageSize;
            const showWarning = item.productUnit != null
              ? !!(lowestRef && ref?.packageSize && ref.packageSize > 0 &&
                (ref.price / ref.packageSize) > lowestRef.pricePerUnit)
              : !!(price && lowest && price > lowest.price);

            const warningChanged = showWarning !== item.showWarning;

            if (!lowestChanged && !refChanged && !lowestRefChanged && !priceChanged && !packageSizeChanged && !warningChanged) {
              return item;
            }

            changed = true;
            return {
              ...item,
              lowestPrice90d: item.productUnit == null
                ? (lowest ?? item.lowestPrice90d)
                : null,
              refPrice: ref ?? item.refPrice,
              lowestRefPricePerUnit: item.productUnit != null
                ? (lowestRef ?? item.lowestRefPricePerUnit)
                : null,
              price,
              packageSize,
              showWarning,
            };
          });

          return changed ? next : prev;
        });
      } catch (error) {
        console.error('Error loading prices:', error);
      }

    },
    [getManualOverride]
  );

  loadDataRef.current = loadData;

  updatePricesForStoreRef.current = async (storeId: number | null, items: ShoppingListItemWithDetails[]) => {
    await loadPricesAsync(items, storeId);
  };

  const handleStoreSelect = useCallback((storeId: number) => {
    setSelectedStoreId(storeId);

    const selectedStore = stores.find(s => s.id === storeId);
    setDefaultStoreName(selectedStore?.name ?? "");

    // Trigger price reload using functional update to get fresh state
    setShoppingListItems(prev => {
      if (prev.length > 0) {
        loadPricesAsync(prev, storeId);
      }
      return prev;
    });
  }, [stores, loadPricesAsync]);


  const handleToggleChecked = useCallback(
    async (item: ShoppingListItemWithDetails) => {

      const newChecked = !item.checked

      setShoppingListItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? { ...i, checked: newChecked }
            : i
        )
      )

      try {
        await updateShoppingListItem(item.id, { checked: newChecked })
      } catch {

        setShoppingListItems(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, checked: item.checked }
              : i
          )
        )

      }

    },
    []
  )

  const handleDeleteItem = useCallback(
    async (item: ShoppingListItemWithDetails) => {
      try {
        await deleteShoppingListItem(item.id);
        await loadData();
      } catch (error) {
        console.error("Erro ao deletar item:", error);
      }
    },
    [loadData],
  );

  const handleEditItem = useCallback(
    (item: ShoppingListItemWithDetails) => {
      setEditingItem(item);
    },
    [],
  );

  const handleSaveEdit = useCallback(
    async (
      quantity: number,
      price: number | undefined,
      unitData?: UnitSaveData,
    ) => {
      console.log("[DIAG:handleSaveEdit] called", {
        editingItemId: editingItem?.id,
        editingItemProductId: editingItem?.productId,
        quantity,
        price,
        unitData,
      });
      if (!editingItem) return;

      // Store needed data before closing modal
      const itemProductId = editingItem.productId;
      const itemId = editingItem.id;

      /*       // Close edit modal immediately
            setEditingItem(null); */
      try {
        if (unitData?.unit && unitData.newStandardPackageSize != null) {
          const formatCurrency = (v: number) =>
            `R$ ${v.toFixed(2).replace(".", ",")}`;
          const formatDateTime = (iso: string) => {
            const d = new Date(iso);
            return (
              d.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }) +
              " " +
              d.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            );
          };

          const last = await getLastInvoiceItemForProduct(
            itemProductId,
          );
          const msg = last
            ? `Última compra encontrada:\n\n• Loja: ${last.storeName}\n• Data: ${formatDateTime(last.createdAt)}\n• Preço: ${formatCurrency(last.unitPrice)}\n\nQuer usar essa compra para preencher uma referência? Você só precisa confirmar o tamanho da embalagem.`
            : "Nenhuma compra anterior foi encontrada para este produto. Você pode continuar sem calcular uma referência histórica.";

          const choice = await new Promise<"cancel" | "no" | "yes">(
            (resolve) => {
              Alert.alert("Calcular referência histórica?", msg, [
                {
                  text: "Cancelar",
                  style: "cancel",
                  onPress: () => resolve("cancel"),
                },
                { text: "Não", onPress: () => resolve("no") },
                { text: "Sim", onPress: () => resolve("yes") },
              ]);
            },
          );

          if (choice === "cancel") {
            unitData = undefined;
          } else {
            await updateProductUnit(
              itemProductId,
              unitData.unit,
              unitData.newStandardPackageSize,
            );
            await clearReferencePricesForProduct(itemProductId);

            if (choice === "yes" && last) {
              const enteredSize = await retroPromptRef.current?.(
                unitData.newStandardPackageSize,
                unitData.unit,
                {
                  storeName: last.storeName,
                  createdAt: last.createdAt,
                  unitPrice: last.unitPrice,
                },
              );
              if (enteredSize != null && enteredSize > 0) {
                await upsertProductStorePrice(
                  itemProductId,
                  last.storeId,
                  last.unitPrice,
                  enteredSize,
                );
                await upsertProductBasePrice(
                  itemProductId,
                  last.unitPrice,
                  enteredSize,
                );
                const displaySize = enteredSize / getUnitFactor(unitData.unit as UnitSymbol);

                Alert.alert(
                  "Referência criada",
                  `${last.storeName} • ${formatDateTime(last.createdAt)}\nPreço: ${formatCurrency(last.unitPrice)}\nTamanho: ${String(displaySize).replace(".", ",")} ${unitData.unit}`,
                );
              }
            }
          }
        }

        const updates: Parameters<typeof updateShoppingListItem>[1] = {
          quantity,
        };
        if (price !== undefined) updates.price = price;
        if (!unitData && price !== undefined && price > 0) {
          const inv = findByProductId(itemProductId);
          const standardPackageSize = inv?.standardPackageSize ?? null;
          const unit = inv?.unit ?? null;
          if (unit && standardPackageSize && standardPackageSize > 0) {
            updates.packageSize =
              editingItem.packageSize ?? standardPackageSize;
          }
        }
        if (unitData) {
          updates.packageSize = unitData.packageSize ?? null;
        }

        await updateShoppingListItem(itemId, updates);

        if (unitData) {
          if (unitData.updateReferencePrice && price != null && price > 0) {
            if (selectedStoreId !== null) {
              await upsertProductStorePrice(
                itemProductId,
                selectedStoreId,
                price,
                unitData.packageSize ?? null,
              );
            } else {
              await upsertProductBasePrice(
                itemProductId,
                price,
                unitData.packageSize ?? null,
              );
            }
            clearManualOverride(selectedStoreId, itemProductId);
          } else {
            if (price !== undefined && unitData.packageSize != null) {
              setManualOverride(selectedStoreId, itemProductId, {
                price,
                packageSize: unitData.packageSize,
              });
            }
          }
          if (
            unitData.updateStandardPackageSize &&
            unitData.packageSize != null
          ) {
            const inv = findByProductId(itemProductId);
            const unit = inv?.unit ?? null;
            if (unit) {
              await updateProductUnit(
                itemProductId,
                unit,
                unitData.packageSize,
              );
            }
          }
          console.log("[DIAG] handleSaveEdit", {
            productId: itemProductId,
            selectedStoreId,
            packageSize: unitData?.packageSize,
            updateReferencePrice: unitData?.updateReferencePrice,
          });
        } else if (price && price > 0) {
          const inv = findByProductId(itemProductId);
          const isUnitConfigured =
            !!inv?.unit && inv?.standardPackageSize != null;
          if (isUnitConfigured) {
            const standardPackageSize = inv?.standardPackageSize ?? null;
            if (standardPackageSize && standardPackageSize > 0) {
              const packageSize =
                editingItem.packageSize ?? standardPackageSize;
              if (selectedStoreId !== null) {
                await upsertProductStorePrice(
                  itemProductId,
                  selectedStoreId,
                  price,
                  packageSize,
                );
              } else {
                await upsertProductBasePrice(
                  itemProductId,
                  price,
                  packageSize,
                );
              }
              clearManualOverride(selectedStoreId, itemProductId);
            }
          } else {
            if (selectedStoreId !== null) {
              await upsertProductStorePrice(
                itemProductId,
                selectedStoreId,
                price,
              );
            } else {
              await upsertProductBasePrice(itemProductId, price);
            }
          }
        }

        console.log("[DIAG:handleSaveEdit] about to loadData", {
          selectedStoreId,
        });
        await loadData();
        setEditingItem(null);
      } catch (error) {
        console.error("Erro ao atualizar item:", error);
      }
    },
    [
      editingItem,
      clearManualOverride,
      findByProductId,
      selectedStoreId,
      setManualOverride,
    ],
  );

  const handleCategorySelect = useCallback(
    async (categoryId: number) => {
      if (!editingItem) return;
      try {
        await updateProductCategory(editingItem.productId, categoryId);
        await loadData();
        const selectedCategory = categories.find((c) => c.id === categoryId);
        setEditingItem((prev) =>
          prev
            ? { ...prev, categoryName: selectedCategory?.name ?? null }
            : null,
        );
      } catch (error) {
        console.error("Erro ao atualizar categoria:", error);
      }
    },
    [editingItem, loadData, categories],
  );

  const toggleCategory = useCallback((key: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const sortShoppingItems = useCallback(
    (items: ShoppingListItemWithDetails[]) => {
      const mapped = items.map((item) => ({
        ...item,
        productName: item.productName,
        quantity: item.quantity,
        stockQuantity: item.currentInventoryQuantity,
        sortOrder: 0,
        categoryName: item.categoryName ?? null,
      }));
      return sortItems(mapped, sortOrder, "") as ShoppingListItemWithDetails[];
    },
    [sortOrder],
  );

  const rows = useMemo((): ListRow[] => {

    const pending = shoppingListItems.filter(i => !i.checked)
    const cart = shoppingListItems.filter(i => i.checked)

    const sortedPending = sortShoppingItems(pending)
    const sortedCart = sortShoppingItems(cart)

    const buildRows = (
      items: ShoppingListItemWithDetails[],
      sectionType: "pending" | "cart"
    ): ListRow[] => {
      const result: ListRow[] = []
      let lastCat: string | null = null
      let currentCatCollapsed = false

      for (const item of items) {
        const cat = item.categoryName ?? "Sem categoria"

        if (sortOrder === "category" && cat !== lastCat) {
          const collapseKey = `${sectionType}:${cat}`
          currentCatCollapsed = collapsedCategories.has(collapseKey)
          result.push({ type: "category-header", category: cat, sectionType })
          lastCat = cat
        }

        if (sortOrder === "category" && currentCatCollapsed) continue

        result.push({ type: "item", item, sectionType })
      }

      return result
    }

    return [
      {
        type: "section-header",
        title: `Pendentes (${sortedPending.length})`,
        sectionType: "pending"
      },
      ...buildRows(sortedPending, "pending"),

      {
        type: "section-header",
        title: `No carrinho (${sortedCart.length})`,
        sectionType: "cart"
      },

      ...(isCartCollapsed ? [] : buildRows(sortedCart, "cart"))
    ]

  }, [
    shoppingListItems,
    sortOrder,
    isCartCollapsed,
    collapsedCategories
  ])


  const searchSimilarityThreshold = 0.4;

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;

    const processedQuery = preprocessName(searchQuery);

    return rows.filter(row => {
      if (row.type !== 'item') return true; // Keep headers

      const processedName = preprocessName(row.item.productName);
      const nameLength = processedName.length;
      const queryLength = processedQuery.length;
      const lengthThreshold = Math.ceil(nameLength * 0.5);

      // Short query: use substring match
      if (queryLength < lengthThreshold) {
        return processedName.includes(processedQuery);
      }

      // Long query: use similarity
      const similarity = calculateSimilarity(processedName, processedQuery);
      return similarity >= searchSimilarityThreshold;
    });
  }, [rows, searchQuery]);

  const isItemRow = (row: ListRow): row is { type: 'item'; item: ShoppingListItemWithDetails; sectionType: 'pending' | 'cart' } =>
    row.type === 'item';

  const checkedItems = useMemo(() =>
    rows
      .filter(isItemRow)
      .filter(row => row.item.checked)
      .map(row => row.item),
    [rows]
  );


  const renderRow = useCallback(
    ({ item: row }: { item: ListRow }) => {

      if (row.type === "section-header") {
        if (row.sectionType === "cart") {
          return (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 8,
                paddingHorizontal: 20,
              }}
            >
              <Text
                style={[
                  localStyles.subsectionTitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {row.title}
              </Text>
              <Button
                mode="text"
                onPress={() => setIsCartCollapsed(!isCartCollapsed)}
                compact
              >
                {isCartCollapsed ? "Mostrar" : "Ocultar"}
              </Button>
            </View>
          );
        }
        return (
          <Text
            style={[
              localStyles.subsectionTitle,
              {
                color: theme.colors.onSurfaceVariant,
                paddingVertical: 8,
                paddingHorizontal: 20,
              },
            ]}
          >
            {row.title}
          </Text>
        );
      }

      if (row.type === "category-header") {
        const collapseKey = `${row.sectionType}:${row.category}`;
        const isCollapsed = collapsedCategories.has(collapseKey);
        return (
          <Pressable
            onPress={() => toggleCategory(collapseKey)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: theme.colors.surfaceVariant,
              borderRadius: 8,
              marginBottom: 4,
              marginTop: 8,
            }}
          >
            <Text
              style={{
                color: theme.colors.onSurfaceVariant,
                textTransform: "uppercase",
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.8,
              }}
            >
              {row.category}
            </Text>
            <MaterialCommunityIcons
              name={isCollapsed ? "chevron-down" : "chevron-up"}
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          </Pressable>
        );
      }

      return (
        <ShoppingListItemCard
          item={row.item}
          onToggleChecked={handleToggleChecked}
          onDelete={handleDeleteItem}
          onEdit={handleEditItem}
        />
      );
    },
    [
      theme,
      isCartCollapsed,
      collapsedCategories,
      toggleCategory,
      handleToggleChecked,
      handleDeleteItem,
    ],
  );

  const listEmptyComponent = useCallback(
    () => (
      <View style={{ paddingHorizontal: 16 }}>
        <Surface style={localStyles.emptyState}>
          <Text
            style={{
              textAlign: "center",
              color: theme.colors.onSurfaceVariant,
              fontSize: 16,
              lineHeight: 24,
            }}
          >
            Sua lista de compras está vazia.{"\n"}
            Toque no botão abaixo para adicionar produtos!
          </Text>
        </Surface>
      </View>
    ),
    [theme],
  );

  const openConfirmConclude = useCallback(() => {
    if (checkedItems.length === 0) return;
    setConfirmVisible(true);
  }, [checkedItems.length]);

  const handleConfirmConclude = useCallback(
    async (storeName: string, date: Date, updateReferencePrices: boolean) => {
      if (checkedItems.length === 0) return;
      setLoading(true);
      try {
        // Build per-item overrides with unit data from local state
        const overrides = new Map<
          number,
          {
            packageSize: number | null;
            standardPackageSize: number | null;
            updateReferencePrice: boolean;
          }
        >();
        for (const item of checkedItems) {
          overrides.set(item.id, {
            packageSize: item.packageSize ?? null,
            standardPackageSize: item.productStandardPackageSize ?? null,  // ← from item
            updateReferencePrice:
              updateReferencePrices &&
              !!item.productUnit &&                                          // ← from item
              item.price != null &&
              item.price > 0,
          });
        }

        await concludeShoppingForListWithInvoiceV2(
          listId,
          storeName,
          date,
          overrides,
        );

        const store = stores.find((s) => s.name === storeName);

        // Update defaultStoreId setting for store selector memory
        if (store) {
          await setSetting("defaultStoreId", store.id.toString());
        }

        // Legacy fallback: products without unit configured still get ref price updated per package.
        if (updateReferencePrices && store) {
          for (const item of checkedItems) {
            if (!item.productUnit && item.productId && item.price && item.price > 0) {
              await upsertProductStorePrice(
                item.productId,
                store.id,
                item.price,
              );
            }
          }
        }

        setConfirmVisible(false);
        await refreshStoreSettings();
        await loadData();
      } catch (error) {
        console.error("Erro ao concluir compras:", error);
      } finally {
        setLoading(false);
      }
    },
    [
      checkedItems,
      listId,
      stores,
      loadData,
      refreshStoreSettings,
    ],
  );

  const totalCheckedPrice = checkedItems.reduce((total, item) => {
    if (item.price) return total + item.quantity * item.price;
    return total;
  }, 0);

  const formatCurrency = (value: number) =>
    `R$ ${value.toFixed(2).replace(".", ",")}`;

  const copyShoppingList = useCallback(async () => {
    const text = generateShoppingListText(shoppingListItems);
    await Clipboard.setStringAsync(text);
    Alert.alert("Lista copiada!", "Pronta para importar no estoque.");
  }, [shoppingListItems]);

  // Derive unit props for the editing item
  const editingInventoryItem = editingItem
    ? findByProductId(editingItem.productId)
    : undefined;
  const editingProductUnit = editingItem?.productUnit ?? null;
  const editingProductStdSize = editingItem?.productStandardPackageSize ?? null;

  const bottomBarHeight = checkedItems.length > 0 ? 64 : 0;

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: -96 }]}>
      <ContextualHeader
        listName={listName}
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />

      <View
        style={[
          localStyles.topRow,
          { borderBottomColor: theme.colors.outlineVariant },
        ]}
      >
        <StoreSelector
          stores={stores}
          selectedStoreId={selectedStoreId}
          onStoreChange={(id) => {
            if (id === null) {
              setSelectedStoreId(null);
              setDefaultStoreName("");
              updatePricesForStoreRef.current?.(null, shoppingListItems);
            } else {
              handleStoreSelect(id);
            }
          }}
          nullOptionLabel="Sem loja"
        />

        <View style={localStyles.searchWrapper}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </View>

        <SortMenu
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          mode="shoppingList"
          iconOnly
        />
        <ActionMenuButton onPress={() => setActionsVisible(true)} />
      </View>

      {initialLoading ? (
        <ShoppingListSkeleton />
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(row) => {
            if (row.type === "item") return `item-${row.item.id}`
            if (row.type === "section-header") return `section-${row.sectionType}`
            return `category-${row.sectionType}-${row.category}`
          }}
          renderItem={renderRow}
          ListEmptyComponent={listEmptyComponent}
          contentContainerStyle={{ paddingBottom: bottomBarHeight + 96 }}
          initialNumToRender={10}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
        />
      )}

      <AddItemButton
        onPress={() =>
          navigation.navigate("AddProductToShoppingList", { listId })
        }
        label="Adicionar à Lista de Compras"
        style={
          checkedItems.length > 0 ? { bottom: bottomBarHeight } : undefined
        }
      />

      <EditShoppingItemModal
        visible={editingItem !== null}
        item={editingItem}
        inventoryItem={editingInventoryItem}
        productUnit={editingProductUnit}
        productStandardPackageSize={editingProductStdSize}
        refPrice={editingItem?.refPrice ?? null}
        manualOverrideActive={
          editingItem
            ? hasManualOverride(selectedStoreId, editingItem.productId)
            : false
        }
        selectedStoreName={defaultStoreName || null}
        lowestRefPricePerUnit={editingItem?.lowestRefPricePerUnit ?? null}
        onSave={handleSaveEdit}
        onToggleChecked={async () => {
          if (!editingItem) return;
          const updated = { ...editingItem, checked: !editingItem.checked };
          setEditingItem(updated);
          await handleToggleChecked(editingItem);
        }}
        onDelete={() => {
          handleDeleteItem(editingItem!);
          setEditingItem(null);
        }}
        onDismiss={() => setEditingItem(null)}
        onCategoryChange={() => { }}
        categories={categories}
        onCategorySelect={handleCategorySelect}
        promptRef={retroPromptRef}

        key={editingItem?.id ?? "none"}
      />

      <Modal
        visible={actionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={() => setActionsVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 16,
              paddingBottom: 32,
              paddingTop: 12,
              elevation: 8,
            }}
            onPress={() => { }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.outlineVariant,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                textTransform: "uppercase",
                letterSpacing: 1,
                color: theme.colors.onSurfaceVariant,
                marginBottom: 8,
                paddingHorizontal: 4,
              }}
            >
              Ações
            </Text>
            {[
              {
                icon: "content-copy",
                label: "Copiar lista",
                onPress: copyShoppingList,
              },
              {
                icon: "import",
                label: "Importar lista",
                onPress: () => setImportModalVisible(true),
              },
              {
                icon: "cart-remove",
                label: "Limpar carrinho",
                onPress: async () => {
                  const unchecked = shoppingListItems.map((i) => ({
                    ...i,
                    checked: false,
                  }));
                  setShoppingListItems(unchecked);
                  await Promise.all(
                    shoppingListItems
                      .filter((i) => i.checked)
                      .map((i) =>
                        updateShoppingListItem(i.id, { checked: false }),
                      ),
                  );
                },
              },
            ].map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  setActionsVisible(false);
                  action.onPress();
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  marginBottom: 2,
                  backgroundColor: pressed
                    ? theme.colors.surfaceVariant
                    : "transparent",
                })}
              >
                <MaterialCommunityIcons
                  name={action.icon as any}
                  size={20}
                  color={theme.colors.onSurface}
                  style={{ marginRight: 12 }}
                />
                <Text style={{ fontSize: 15, color: theme.colors.onSurface }}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <ImportModal
        isImportModalVisible={importModalVisible}
        setIsImportModalVisible={setImportModalVisible}
        loadItems={loadData}
        listId={listId}
        applyMatch={async ({ productName, product }) => {
          await addShoppingListItem(listId, productName, product.quantity);
        }}
        applyNew={async ({ product }) => {
          const productId = await addProduct(product.originalName);
          await addShoppingListItem(
            listId,
            product.originalName,
            product.quantity,
          );
          return { productId, productName: product.originalName };
        }}
      />

      {checkedItems.length > 0 && (
        <View
          style={[
            localStyles.bottomBar,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <View style={localStyles.bottomBarSummary}>
            <Text
              style={[
                localStyles.bottomBarLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Total no carrinho:
            </Text>
            <Text
              style={[
                localStyles.bottomBarValue,
                { color: theme.colors.primary },
              ]}
            >
              {formatCurrency(totalCheckedPrice)}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={openConfirmConclude}
            disabled={loading}
            loading={loading}
            icon="cart-check"
            style={localStyles.bottomBarButton}
          >
            Concluir compras
          </Button>
        </View>
      )}

      <ConfirmInvoiceModal
        visible={confirmVisible}
        stores={stores}
        defaultStoreName={defaultStoreName}
        total={totalCheckedPrice}
        onConfirm={handleConfirmConclude}
        onDismiss={() => setConfirmVisible(false)}
        loading={loading}
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 8,
  },
  storeButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchWrapper: {
    flex: 1,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
    margin: 16,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bottomBarSummary: {
    flex: 1,
  },
  bottomBarLabel: {
    fontSize: 12,
  },
  bottomBarValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  bottomBarButton: {
    borderRadius: 8,
  },
});
