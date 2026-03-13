import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Alert, Modal } from 'react-native';
import { Button, Surface, TextInput, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
} from '../database/database';
import type { RefPrice } from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { ShoppingListItem } from '../database/models';
import { useListContext } from '../context/ListContext';
import { useListData } from '../context/ListDataContext';
import { useList } from '../hooks/useList';
import { EditShoppingItemModal } from '../components/EditShoppingItemModal';
import type { UnitSaveData } from '../components/EditShoppingItemModal';
import { ConfirmInvoiceModal, StoreOption } from '../components/ConfirmInvoiceModal';
import ContextualHeader from '../components/ContextualHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddItemButton } from '../components/AddItemButton';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { SortMenu } from '../components/SortMenu';
import { sortItems, SortOrder } from '../utils/sortUtils';
import { ShoppingListItemCard } from '../components/ShoppingListItemCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SearchBar from '../components/SearchBar';
import ShoppingListSkeleton from '../components/ShoppingListSkeleton';
import ImportModal from '../components/ImportModal';
import { StoreSelector } from '../components/StoreSelector';
import { generateShoppingListText } from '../utils/stringUtils';
import * as Clipboard from 'expo-clipboard';
import { ActionMenuButton } from '../components/ActionMenuButton';

type ListRow =
  | { type: 'section-header'; title: string; sectionType: 'pending' | 'cart' }
  | { type: 'category-header'; category: string; sectionType: 'pending' | 'cart' }
  | { type: 'item'; item: ShoppingListItemWithDetails; sectionType: 'pending' | 'cart' };

type ShoppingListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShoppingList'>;

interface ShoppingListItemWithDetails extends Omit<ShoppingListItem, 'checked'> {
  checked: boolean;
  productName: string;
  productId: number;
  currentInventoryQuantity: number;
  /** Display price (pricePerUnit × standardPackageSize for unit products; price_per_package for legacy). */
  price?: number;
  categoryName?: string | null;
  lowestPrice90d: { price: number; storeName: string } | null;
  /** Resolved reference price object. Set by updatePricesForStore. */
  refPrice?: RefPrice | null;
  /** Set when user edits in expanded triangle view. Written to invoice_items on conclude. */
  packageSize?: number | null;
  /** Set when user edits in expanded triangle view. Written to ref price tables on conclude. */
  pricePerUnit?: number | null;
}

export default function ShoppingListScreen() {
  const { listId } = useListContext();
  const { listName, handleListNameSave, handleListDelete } = useList(listId);
  const { categories, stores, defaultStoreMode, defaultStoreId, lastStoreName, refreshStoreSettings, findByProductId } = useListData();
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItemWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ShoppingListItemWithDetails | null>(null);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [defaultStoreName, setDefaultStoreName] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [lastStoreId, setLastStoreId] = useState<number | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>('alphabetical');
  const [actionsVisible, setActionsVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [retroVisible, setRetroVisible] = useState(false);
  const [retroPackageSizeText, setRetroPackageSizeText] = useState('');
  const [retroUnit, setRetroUnit] = useState<string | null>(null);
  const navigation = useNavigation<ShoppingListScreenNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const isFirstLoad = useRef(true);
  const manualOverridesRef = useRef<Map<string, Set<number>>>(new Map());

  const getStoreKey = useCallback((storeId: number | null) => (storeId === null ? 'base' : String(storeId)), []);

  const hasManualOverride = useCallback((storeId: number | null, productId: number) => {
    const set = manualOverridesRef.current.get(getStoreKey(storeId));
    return !!set?.has(productId);
  }, [getStoreKey]);

  const markManualOverride = useCallback((storeId: number | null, productId: number) => {
    const key = getStoreKey(storeId);
    const existing = manualOverridesRef.current.get(key);
    if (existing) {
      existing.add(productId);
      return;
    }
    manualOverridesRef.current.set(key, new Set([productId]));
  }, [getStoreKey]);

  const clearManualOverride = useCallback((storeId: number | null, productId: number) => {
    const key = getStoreKey(storeId);
    const existing = manualOverridesRef.current.get(key);
    if (!existing) return;
    existing.delete(productId);
    if (existing.size === 0) {
      manualOverridesRef.current.delete(key);
    }
  }, [getStoreKey]);

  useEffect(() => {
    if (!editingItem) return;
    const fresh = shoppingListItems.find(i => i.id === editingItem.id);
    if (!fresh) return;
    setEditingItem(prev => {
      if (!prev || prev.id !== fresh.id) return prev;
      return { ...prev, ...fresh };
    });
  }, [editingItem?.id, shoppingListItems]);

  const retroResolveRef = useRef<((value: number | null) => void) | null>(null);
  const promptForRetroPackageSize = useCallback(async (prefill: number, unit: string): Promise<number | null> => {
    setRetroUnit(unit);
    setRetroPackageSizeText(String(prefill));
    setRetroVisible(true);
    return await new Promise(resolve => {
      retroResolveRef.current = resolve;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [listId])
  );

  const loadData = useCallback(async () => {
    try {
      const [shopping] = await Promise.all([
        getShoppingListItemsByListId(listId),
      ]);

      const enhancedShoppingItems = shopping.map(item => ({
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
        pricePerUnit: item.pricePerUnit ?? null,
      } as ShoppingListItemWithDetails));

      setShoppingListItems(enhancedShoppingItems);
      console.log('[DIAG:loadData] raw items', enhancedShoppingItems.map(item => ({ productId: item.productId, price: item.price })));

      // Load lowest prices in background without blocking
      const productIds = enhancedShoppingItems.map(item => item.productId).filter(id => id > 0);
      if (productIds.length > 0) {
        getLowestPriceForProducts(productIds).then(lowestPriceMap => {
          setShoppingListItems(prev => prev.map(item => ({
            ...item,
            lowestPrice90d: lowestPriceMap.get(item.productId) ?? null,
          })));
        }).catch(error => {
          console.error('Error loading lowest prices:', error);
        });
      }

      let storeIdToSet: number | null = null;

      if (isFirstLoad.current) {
        const lastStoreObj = stores.find(s => s.name === lastStoreName);
        setLastStoreId(lastStoreObj?.id ?? null);

        let storeNameToSet = '';
        if (defaultStoreMode === 'last') {
          storeNameToSet = lastStoreName ?? '';
          storeIdToSet = lastStoreObj?.id ?? null;
        } else if (defaultStoreMode === 'fixed' && defaultStoreId) {
          const defaultStore = stores.find(s => s.id === parseInt(defaultStoreId));
          storeNameToSet = defaultStore?.name ?? '';
          storeIdToSet = defaultStore?.id ?? null;
        }

        setDefaultStoreName(storeNameToSet);
        setSelectedStoreId(storeIdToSet);
        isFirstLoad.current = false;
        console.log('[DIAG:loadData] calling updatePricesForStore', { storeId: storeIdToSet, isFirstLoad: isFirstLoad.current });
        await updatePricesForStore(storeIdToSet, enhancedShoppingItems);
      } else {
        console.log('[DIAG:loadData] calling updatePricesForStore', { storeId: selectedStoreId, isFirstLoad: isFirstLoad.current });
        await updatePricesForStore(selectedStoreId, enhancedShoppingItems);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setInitialLoading(false);
    }
  }, [listId, stores, defaultStoreMode, defaultStoreId, lastStoreName, selectedStoreId, updatePricesForStore]);

  const resolveDisplayPrice = (item: ShoppingListItemWithDetails, refPrice: RefPrice | null, unit: string | null, standardPackageSize: number | null): number | undefined => {
    if (!unit || !standardPackageSize) return item.price;
    if (!refPrice) return item.price;
    const packageSize = item.packageSize ?? refPrice.packageSize ?? standardPackageSize;
    return refPrice.price * packageSize;
  };

  const updatePricesForStore = useCallback(async (storeId: number | null, items: ShoppingListItemWithDetails[]) => {
    try {
      const productIds = items.map(item => item.productId).filter(id => id > 0);
      if (productIds.length === 0) return;

      // Returns Map<productId, RefPrice> — price is pricePerUnit for unit products, price_per_package for legacy.
      const referencePriceMap = await getReferencePricesForProducts(productIds, storeId);
      console.log('[DIAG] updatePricesForStore', {
        storeId,
        entries: [...referencePriceMap.entries()].map(([id, ref]) => ({ id, ...ref })),
      });

      const updatedItems = items.map(item => {
        if (item.productId === 0) return item;
        const refPrice = referencePriceMap.get(item.productId);
        if (!refPrice) return item;

        if (hasManualOverride(storeId, item.productId)) {
          return { ...item, price: item.price, refPrice };
        }

        const inv = findByProductId(item.productId);
        const standardPackageSize = inv?.standardPackageSize ?? null;
        const unit = inv?.unit ?? null;

        const displayPrice = resolveDisplayPrice(item, refPrice, unit, standardPackageSize);

        if (unit && standardPackageSize) {
          console.log('[DIAG] displayPrice for product', item.productId, {
            refPrice,
            standardPackageSize,
            displayPrice,
            itemPriceBefore: item.price,
          });
        }

        return { ...item, price: displayPrice, refPrice };
      });

      // Log each item that has a unit
      updatedItems.forEach(item => {
        const inv = findByProductId(item.productId);
        const unit = inv?.unit ?? null;
        if (unit) {
          console.log('[DIAG:updatePricesForStore] item result', {
            productId: item.productId,
            unit,
            standardPackageSize: inv?.standardPackageSize ?? null,
            refPrice: item.refPrice,
            displayPrice: item.price,
            itemPriceBefore: item.price,
          });
        }
      });

      setShoppingListItems(updatedItems);
      if (editingItem) {
        const fresh = updatedItems.find(i => i.id === editingItem.id);
        if (fresh) setEditingItem(fresh);
      }
    } catch (error) {
      console.error('Error updating prices for store:', error);
    }
  }, [editingItem, findByProductId, hasManualOverride]);

  const handleStoreSelect = useCallback((storeId: number) => {
    setSelectedStoreId(storeId);
    const selectedStore = stores.find(s => s.id === storeId);
    setDefaultStoreName(selectedStore?.name ?? '');
    updatePricesForStore(storeId, shoppingListItems);
  }, [stores, shoppingListItems, updatePricesForStore]);

  const handleToggleChecked = useCallback(async (item: ShoppingListItemWithDetails) => {
    setShoppingListItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, checked: !item.checked } : i
    ));
    try {
      await updateShoppingListItem(item.id, { checked: !item.checked });
    } catch (error) {
      setShoppingListItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, checked: item.checked } : i
      ));
      console.error('Erro ao atualizar item:', error);
    }
  }, []);

  const handleDeleteItem = useCallback(async (item: ShoppingListItemWithDetails) => {
    try {
      await deleteShoppingListItem(item.id);
      await loadData();
    } catch (error) {
      console.error('Erro ao deletar item:', error);
    }
  }, [loadData]);

  const handleSaveEdit = useCallback(async (
    quantity: number,
    price: number | undefined,
    unitData?: UnitSaveData,
  ) => {
    console.log('[DIAG:handleSaveEdit] called', {
      editingItemId: editingItem?.id,
      editingItemProductId: editingItem?.productId,
      quantity,
      price,
      unitData,
    });
    if (!editingItem) return;
    try {
      if (unitData?.unit && unitData.newStandardPackageSize != null) {
        const choice = await new Promise<'cancel' | 'no' | 'yes'>(resolve => {
          Alert.alert(
            'Calcular preço por unidade histórico?',
            'Encontramos sua última compra deste produto. Você pode usar o tamanho da embalagem que comprou para calcular o preço por unidade automaticamente.',
            [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve('cancel') },
              { text: 'Não', onPress: () => resolve('no') },
              { text: 'Sim', onPress: () => resolve('yes') },
            ]
          );
        });

        if (choice === 'cancel') {
          unitData = undefined;
        } else {
          await updateProductUnit(editingItem.productId, unitData.unit, unitData.newStandardPackageSize);
          await clearReferencePricesForProduct(editingItem.productId);

          if (choice === 'yes') {
            const last = await getLastInvoiceItemForProduct(editingItem.productId);
            if (last) {
              const enteredSize = await promptForRetroPackageSize(unitData.newStandardPackageSize, unitData.unit);
              if (enteredSize != null && enteredSize > 0) {
                const pricePerUnit = last.unitPrice / enteredSize;
                await upsertProductStorePrice(editingItem.productId, last.storeId, pricePerUnit, enteredSize);
                await upsertProductBasePrice(editingItem.productId, pricePerUnit, enteredSize);
              }
            }
          }
        }
      }

      const updates: Parameters<typeof updateShoppingListItem>[1] = { quantity };
      if (price !== undefined) updates.price = price;
      if (!unitData && price !== undefined && price > 0) {
        const inv = findByProductId(editingItem.productId);
        const standardPackageSize = inv?.standardPackageSize ?? null;
        const unit = inv?.unit ?? null;
        if (unit && standardPackageSize && standardPackageSize > 0) {
          updates.packageSize = standardPackageSize;
          updates.pricePerUnit = price / standardPackageSize;
        }
      }
      if (unitData) {
        updates.packageSize = unitData.packageSize ?? null;
        updates.pricePerUnit = unitData.pricePerUnit ?? null;
      }

      await updateShoppingListItem(editingItem.id, updates);

      if (unitData) {
        // Unit item: conditionally update reference price with pricePerUnit
        if (unitData.updateReferencePrice && unitData.pricePerUnit != null) {
          if (selectedStoreId !== null) {
            await upsertProductStorePrice(editingItem.productId, selectedStoreId, unitData.pricePerUnit, unitData.packageSize ?? null);
          } else {
            await upsertProductBasePrice(editingItem.productId, unitData.pricePerUnit, unitData.packageSize ?? null);
          }
          clearManualOverride(selectedStoreId, editingItem.productId);
        } else {
          markManualOverride(selectedStoreId, editingItem.productId);
        }
        if (unitData.updateStandardPackageSize && unitData.packageSize != null) {
          const inv = findByProductId(editingItem.productId);
          const unit = inv?.unit ?? null;
          if (unit) {
            await updateProductUnit(editingItem.productId, unit, unitData.packageSize);
          }
        }
        console.log('[DIAG] handleSaveEdit', {
          productId: editingItem.productId,
          selectedStoreId,
          pricePerUnit: unitData?.pricePerUnit,
          packageSize: unitData?.packageSize,
          updateReferencePrice: unitData?.updateReferencePrice,
        });
      } else if (price && price > 0) {
        const inv = findByProductId(editingItem.productId);
        const isUnitConfigured = !!inv?.unit && inv?.standardPackageSize != null;
        if (isUnitConfigured) {
          const standardPackageSize = inv?.standardPackageSize ?? null;
          if (standardPackageSize && standardPackageSize > 0) {
            const pricePerUnit = price / standardPackageSize;
            if (selectedStoreId !== null) {
              await upsertProductStorePrice(editingItem.productId, selectedStoreId, pricePerUnit, standardPackageSize);
            } else {
              await upsertProductBasePrice(editingItem.productId, pricePerUnit, standardPackageSize);
            }
            clearManualOverride(selectedStoreId, editingItem.productId);
          }
        } else {
          if (selectedStoreId !== null) {
            await upsertProductStorePrice(editingItem.productId, selectedStoreId, price);
          } else {
            await upsertProductBasePrice(editingItem.productId, price);
          }
        }
      }

      console.log('[DIAG:handleSaveEdit] about to loadData', { selectedStoreId });
      await loadData();

      setEditingItem(null);
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
    }
  }, [editingItem, clearManualOverride, findByProductId, markManualOverride, promptForRetroPackageSize, selectedStoreId]);

  const handleCategorySelect = useCallback(async (categoryId: number) => {
    if (!editingItem) return;
    try {
      await updateProductCategory(editingItem.productId, categoryId);
      await loadData();
      const selectedCategory = categories.find(c => c.id === categoryId);
      setEditingItem(prev => prev ? { ...prev, categoryName: selectedCategory?.name ?? null } : null);
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
    }
  }, [editingItem, loadData, categories]);

  const toggleCategory = useCallback((key: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const sortShoppingItems = useCallback((items: ShoppingListItemWithDetails[]) => {
    const mapped = items.map(item => ({
      ...item,
      productName: item.productName,
      quantity: item.quantity,
      stockQuantity: item.currentInventoryQuantity,
      sortOrder: 0,
      categoryName: item.categoryName ?? null,
    }));
    return sortItems(mapped, sortOrder, '') as ShoppingListItemWithDetails[];
  }, [sortOrder]);

  const filteredShoppingItems = useMemo(() => {
    if (!searchQuery.trim()) return shoppingListItems;
    const q = searchQuery.toLowerCase().trim();
    return shoppingListItems.filter(item =>
      item.productName.toLowerCase().includes(q)
    );
  }, [shoppingListItems, searchQuery]);

  const checkedItems = filteredShoppingItems.filter(item => item.checked);
  const uncheckedItems = filteredShoppingItems.filter(item => !item.checked);

  const rows = useMemo((): ListRow[] => {
    const result: ListRow[] = [];

    const buildSection = (
      items: ShoppingListItemWithDetails[],
      sectionType: 'pending' | 'cart',
      title: string,
      collapsed: boolean
    ) => {
      result.push({ type: 'section-header', title, sectionType });
      if (collapsed) return;

      if (sortOrder === 'category') {
        const grouped = new Map<string, ShoppingListItemWithDetails[]>();
        for (const item of items) {
          const key = item.categoryName ?? 'Sem categoria';
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(item);
        }
        for (const [category, catItems] of grouped) {
          const collapseKey = `${sectionType}:${category}`;
          result.push({ type: 'category-header', category, sectionType });
          if (!collapsedCategories.has(collapseKey)) {
            for (const item of catItems) {
              result.push({ type: 'item', item, sectionType });
            }
          }
        }
      } else {
        for (const item of items) {
          result.push({ type: 'item', item, sectionType });
        }
      }
    };

    buildSection(uncheckedItems, 'pending', `Pendentes (${uncheckedItems.length})`, false);
    buildSection(checkedItems, 'cart', `No carrinho (${checkedItems.length})`, isCartCollapsed);

    return result;
  }, [uncheckedItems, checkedItems, sortOrder, collapsedCategories, isCartCollapsed]);

  const renderRow = useCallback(({ item: row }: { item: ListRow }) => {
    if (row.type === 'section-header') {
      if (row.sectionType === 'cart') {
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 20 }}>
            <Text style={[localStyles.subsectionTitle, { color: theme.colors.onSurfaceVariant }]}>
              {row.title}
            </Text>
            <Button mode="text" onPress={() => setIsCartCollapsed(!isCartCollapsed)} compact>
              {isCartCollapsed ? 'Mostrar' : 'Ocultar'}
            </Button>
          </View>
        );
      }
      return (
        <Text style={[localStyles.subsectionTitle, { color: theme.colors.onSurfaceVariant, paddingVertical: 8, paddingHorizontal: 20 }]}>
          {row.title}
        </Text>
      );
    }

    if (row.type === 'category-header') {
      const collapseKey = `${row.sectionType}:${row.category}`;
      const isCollapsed = collapsedCategories.has(collapseKey);
      return (
        <Pressable
          onPress={() => toggleCategory(collapseKey)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.colors.surfaceVariant, borderRadius: 8, marginBottom: 4, marginTop: 8 }}
        >
          <Text style={{ color: theme.colors.onSurfaceVariant, textTransform: 'uppercase', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>
            {row.category}
          </Text>
          <MaterialCommunityIcons
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
      );
    }

    return (
      <ShoppingListItemCard
        item={row.item}
        onToggleChecked={() => handleToggleChecked(row.item)}
        onDelete={() => handleDeleteItem(row.item)}
        onEdit={() => setEditingItem(row.item)}
      />
    );
  }, [theme, isCartCollapsed, collapsedCategories, toggleCategory, handleToggleChecked, handleDeleteItem]);

  const listEmptyComponent = useCallback(() => (
    <View style={{ paddingHorizontal: 16 }}>
      <Surface style={localStyles.emptyState}>
        <Text style={{
          textAlign: 'center',
          color: theme.colors.onSurfaceVariant,
          fontSize: 16,
          lineHeight: 24
        }}>
          Sua lista de compras está vazia.{'\n'}
          Toque no botão abaixo para adicionar produtos!
        </Text>
      </Surface>
    </View>
  ), [theme]);

  const openConfirmConclude = useCallback(() => {
    if (checkedItems.length === 0) return;
    setConfirmVisible(true);
  }, [checkedItems.length]);

  const handleConfirmConclude = useCallback(async (storeName: string, date: Date, updateReferencePrices: boolean) => {
    if (checkedItems.length === 0) return;
    setLoading(true);
    try {
      // Build per-item overrides with unit data from local state
      const overrides = new Map<number, {
        packageSize: number | null;
        pricePerUnit: number | null;
        standardPackageSize: number | null;
        updateReferencePrice: boolean;
      }>();
      for (const item of checkedItems) {
        const inv = findByProductId(item.productId);
        overrides.set(item.id, {
          packageSize: item.packageSize ?? null,
          pricePerUnit: item.pricePerUnit ?? null,
          standardPackageSize: inv?.standardPackageSize ?? null,
          // Unit items: update ref price only if pricePerUnit was set in this session
          updateReferencePrice: updateReferencePrices && item.pricePerUnit != null,
        });
      }

      await concludeShoppingForListWithInvoiceV2(listId, storeName, date, overrides);

      const store = stores.find(s => s.name === storeName);

      // Update defaultStoreId setting for store selector memory
      if (store) {
        await setSetting('defaultStoreId', store.id.toString());
      }

      // Legacy fallback: items without pricePerUnit (no unit configured) still get ref price
      // updated via the old per-package price path.
      if (updateReferencePrices && store) {
        for (const item of checkedItems) {
          const inv = findByProductId(item.productId);
          if (!inv?.unit && item.productId && item.price && item.price > 0) {
            await upsertProductStorePrice(item.productId, store.id, item.price);
          }
        }
      }

      setConfirmVisible(false);
      await refreshStoreSettings();
      await loadData();
    } catch (error) {
      console.error('Erro ao concluir compras:', error);
    } finally {
      setLoading(false);
    }
  }, [checkedItems, listId, stores, findByProductId, loadData, refreshStoreSettings]);

  const totalCheckedPrice = checkedItems.reduce((total, item) => {
    if (item.price) return total + item.quantity * item.price;
    return total;
  }, 0);

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

  const copyShoppingList = useCallback(async () => {
    const text = generateShoppingListText(shoppingListItems);
    await Clipboard.setStringAsync(text);
    Alert.alert('Lista copiada!', 'Pronta para importar no estoque.');
  }, [shoppingListItems]);

  // Derive unit props for the editing item
  const editingInventoryItem = editingItem ? findByProductId(editingItem.productId) : undefined;
  const editingProductUnit = editingInventoryItem?.unit ?? null;
  const editingProductStdSize = editingInventoryItem?.standardPackageSize ?? null;

  const bottomBarHeight = checkedItems.length > 0 ? 64 : 0;

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: -96 }]}>
      <ContextualHeader
        listName={listName}
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />

      <View style={[localStyles.topRow, { borderBottomColor: theme.colors.outlineVariant }]}>
        <StoreSelector
          stores={stores}
          selectedStoreId={selectedStoreId}
          onStoreChange={(id) => {
            if (id === null) {
              setSelectedStoreId(null);
              setDefaultStoreName('');
              updatePricesForStore(null, shoppingListItems);
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
          data={rows}
          keyExtractor={(row, index) =>
            row.type === 'item' ? row.item.id.toString() : `${row.type}-${index}`
          }
          renderItem={renderRow}
          ListEmptyComponent={listEmptyComponent}
          contentContainerStyle={{ paddingBottom: bottomBarHeight + 96 }}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
        />
      )}

      <AddItemButton
        onPress={() => navigation.navigate('AddProductToShoppingList', { listId })}
        label="Adicionar à Lista de Compras"
        style={checkedItems.length > 0 ? { bottom: bottomBarHeight } : undefined}
      />

      <EditShoppingItemModal
        visible={editingItem !== null}
        item={editingItem}
        inventoryItem={editingInventoryItem}
        productUnit={editingProductUnit}
        productStandardPackageSize={editingProductStdSize}
        refPrice={editingItem?.refPrice ?? null}
        manualOverrideActive={editingItem ? hasManualOverride(selectedStoreId, editingItem.productId) : false}
        onSave={handleSaveEdit}
        onToggleChecked={async () => {
          if (!editingItem) return;
          const updated = { ...editingItem, checked: !editingItem.checked };
          setEditingItem(updated);
          await handleToggleChecked(editingItem);
        }}
        onDelete={() => { handleDeleteItem(editingItem!); setEditingItem(null); }}
        onDismiss={() => setEditingItem(null)}
        onCategoryChange={() => { }}
        categories={categories}
        onCategorySelect={handleCategorySelect}
        key={editingItem?.id ?? 'none'}
      />

      <Modal
        visible={retroVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRetroVisible(false);
          retroResolveRef.current?.(null);
          retroResolveRef.current = null;
        }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}
          onPress={() => {
            setRetroVisible(false);
            retroResolveRef.current?.(null);
            retroResolveRef.current = null;
          }}
        >
          <Pressable
            style={{ width: '100%' }}
            onPress={() => { }}
          >
            <Surface style={{ padding: 16, borderRadius: 12, elevation: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 10 }}>
                Qual era o tamanho da embalagem?
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 12 }}>
                Use o tamanho da sua última compra para calcular o preço por unidade.
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  mode="outlined"
                  value={retroPackageSizeText}
                  onChangeText={setRetroPackageSizeText}
                  keyboardType="decimal-pad"
                  style={{ flex: 1 }}
                  autoFocus
                />
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14, minWidth: 28 }}>
                  {retroUnit ?? ''}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <Button
                  onPress={() => {
                    setRetroVisible(false);
                    retroResolveRef.current?.(null);
                    retroResolveRef.current = null;
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    const v = parseFloat((retroPackageSizeText ?? '').replace(',', '.'));
                    if (!isFinite(v) || v <= 0) return;
                    setRetroVisible(false);
                    retroResolveRef.current?.(v);
                    retroResolveRef.current = null;
                  }}
                  disabled={!isFinite(parseFloat((retroPackageSizeText ?? '').replace(',', '.'))) || parseFloat((retroPackageSizeText ?? '').replace(',', '.')) <= 0}
                >
                  Confirmar
                </Button>
              </View>
            </Surface>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={actionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
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
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: theme.colors.outlineVariant,
              alignSelf: 'center', marginBottom: 16,
            }} />
            <Text style={{
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: theme.colors.onSurfaceVariant,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}>
              Ações
            </Text>
            {[
              { icon: 'content-copy', label: 'Copiar lista', onPress: copyShoppingList },
              { icon: 'import', label: 'Importar lista', onPress: () => setImportModalVisible(true) },
              {
                icon: 'cart-remove',
                label: 'Limpar carrinho',
                onPress: async () => {
                  const unchecked = shoppingListItems.map(i => ({ ...i, checked: false }));
                  setShoppingListItems(unchecked);
                  await Promise.all(
                    shoppingListItems.filter(i => i.checked).map(i =>
                      updateShoppingListItem(i.id, { checked: false })
                    )
                  );
                }
              },
            ].map(action => (
              <Pressable
                key={action.label}
                onPress={() => { setActionsVisible(false); action.onPress(); }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  marginBottom: 2,
                  backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent',
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
          await addShoppingListItem(listId, product.originalName, product.quantity);
          return { productId, productName: product.originalName };
        }}
      />

      {checkedItems.length > 0 && (
        <View style={[localStyles.bottomBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
          <View style={localStyles.bottomBarSummary}>
            <Text style={[localStyles.bottomBarLabel, { color: theme.colors.onSurfaceVariant }]}>Total no carrinho:</Text>
            <Text style={[localStyles.bottomBarValue, { color: theme.colors.primary }]}>{formatCurrency(totalCheckedPrice)}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 8,
  },
  storeButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchWrapper: {
    flex: 1,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    margin: 16,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontWeight: 'bold',
  },
  bottomBarButton: {
    borderRadius: 8,
  },
});
