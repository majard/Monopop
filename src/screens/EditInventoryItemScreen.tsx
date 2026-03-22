import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, ScrollView, StyleSheet, TextInput as RNTextInput,
  Alert, Pressable,
} from 'react-native';
import {
  Text, useTheme, Chip, Divider, Button, IconButton, Portal,
} from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  updateInventoryItem,
  getInventoryHistory,
  updateProductName,
  deleteInventoryItem,
  getLists,
  getCategories,
  addCategory,
  updateProductCategory,
  addShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem,
  getProductConsumptionStats,
  getShoppingListItemForInventoryItem,
  getSetting,
  getStores,
  getPriceHistory,
  getReferencePriceForProduct,
  upsertProductStorePrice,
  upsertProductBasePrice,
  updateProductUnit,
  clearReferencePricesForProduct,
  getLastInvoiceItemForProduct,
  getLowestRefPricesPerUnit,
} from '../database/database';
import type { RefPrice } from '../database/database';
import { InventoryHistory } from '../database/models';
import { RootStackParamList } from '../types/navigation';
import ContextualHeader from '../components/ContextualHeader';
import { ItemPickerDialog } from '../components/ItemPickerDialog';
import { StoreSelector } from '../components/StoreSelector';
import { SearchablePickerDialog } from '../components/SearchablePickerDialog';
import { useInventoryItem } from '../hooks/useInventoryItem';
import { useRetroPrompt } from '../hooks/useRetroPrompt';
import QuantityHistorySection from '../components/QuantityHistorySection';
import PriceHistorySection from '../components/PriceHistorySection';
import { PriceTriangle, PriceTriangleHandle } from '../components/PriceTriangle';
import {
  UNITS, UNITS_BY_FAMILY, getUnitFactor, getFamilyOf,
  formatStandardPackageDisplay, formatPerStdPkg,
  UnitSymbol, UnitFamily,
} from '../utils/units';
import { useMoveToList } from '../hooks/useMoveToList';

type EditInventoryItemProps = NativeStackScreenProps<RootStackParamList, 'EditInventoryItem'>;

interface PriceHistory {
  date: string;
  price: number;
  storeName: string;
}

interface ConsumptionStats {
  avgWeeklyConsumption: number | null;
  avgPrice90d: number | null;
  lowestPrice90d: { price: number; storeName: string } | null;
  avgPricePerUnit90d: number | null;
  lowestPricePerUnit90d: { pricePerUnit: number; storeName: string } | null;
}

export default function EditInventoryItem() {
  const route = useRoute<EditInventoryItemProps['route']>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const inventoryItem = route.params?.inventoryItem;
  const theme = useTheme();

  // ─── Core fields ────────────────────────────────────────────────────────────
  const [name, setName] = useState(inventoryItem?.productName || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [notes, setNotes] = useState(inventoryItem?.notes || '');

  // ─── Category and list ───────────────────────────────────────────────────────
  const [lists, setLists] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedListId, setSelectedListId] = useState(inventoryItem?.listId ?? 1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(inventoryItem?.categoryId ?? null);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // ─── Unit management ─────────────────────────────────────────────────────────
  const [unitExpanded, setUnitExpanded] = useState(false);
  const [localUnit, setLocalUnit] = useState<UnitSymbol | null>(
    inventoryItem?.unit ?? null
  );
  const [selectedFamily, setSelectedFamily] = useState<UnitFamily | null>(
    inventoryItem?.unit ? getFamilyOf(inventoryItem.unit) : null
  );
  const [selectedUnitSymbol, setSelectedUnitSymbol] = useState<UnitSymbol | null>(
    inventoryItem?.unit ?? null
  );
  const [stdSizeInputStr, setStdSizeInputStr] = useState<string>(
    inventoryItem?.unit && inventoryItem?.standardPackageSize
      ? String(inventoryItem.standardPackageSize / getUnitFactor(inventoryItem.unit))
      : ''
  );

  // Effective atomic stdSize — always computed from local state
  const selectedUnitObj = selectedUnitSymbol
    ? UNITS.find(u => u.symbol === selectedUnitSymbol) ?? null
    : null;
  const displayStdSizeVal = parseFloat(stdSizeInputStr) || selectedUnitObj?.defaultStdSize || 0;
  const effectiveAtomicStdSize = selectedUnitObj && displayStdSizeVal > 0
    ? displayStdSizeVal * selectedUnitObj.factor
    : null;

  // ─── Price ───────────────────────────────────────────────────────────────────
  const triangleRef = useRef<PriceTriangleHandle>(null);
  const [currentRefPrice, setCurrentRefPrice] = useState<RefPrice | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<number>(0);
  const [priceInput, setPriceInput] = useState('');
  const [editingPrice, setEditingPrice] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [stores, setStores] = useState<{ id: number; name: string }[]>([]);
  const [lowestRefPricePerUnit, setLowestRefPricePerUnit] = useState<{
    pricePerUnit: number; storeName: string;
  } | null>(null);

  // ─── Shopping list ───────────────────────────────────────────────────────────
  const [shoppingListItem, setShoppingListItem] = useState<{
    id: number; quantity: number; price?: number;
  } | null>(null);
  const initialShoppingListItemRef = useRef<typeof shoppingListItem>(null);
  const [slQuantity, setSlQuantity] = useState(shoppingListItem?.quantity ?? 1);


  // ─── History & stats ─────────────────────────────────────────────────────────
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [stats, setStats] = useState<ConsumptionStats | null>(null);
  const [statsCollapsed, setStatsCollapsed] = useState(false);
  const [qtyHistoryCollapsed, setQtyHistoryCollapsed] = useState(false);
  const [priceHistoryCollapsed, setPriceHistoryCollapsed] = useState(false);

  // ─── Quantity (useInventoryItem hook) ────────────────────────────────────────
  const {
    quantity: liveQuantity,
    updateInventoryItemQuantity,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  } = useInventoryItem({
    inventoryItemId: inventoryItem?.id ?? 0,
    initialQuantity: inventoryItem?.quantity ?? 0,
    productName: inventoryItem?.productName ?? '',
  });

  const [quantityInput, setQuantityInput] = useState(liveQuantity.toString());
  useEffect(() => { setQuantityInput(liveQuantity.toString()); }, [liveQuantity]);

  // ─── Dirty tracking ──────────────────────────────────────────────────────────
  const isDirtyRef = useRef(false);
  const mountedRef = useRef(false);
  const loadingRef = useRef(true);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (loadingRef.current) return;
    isDirtyRef.current = true;
  }, [name, notes, selectedCategoryId, selectedListId, liveQuantity,
    suggestedPrice, shoppingListItem, localUnit, effectiveAtomicStdSize]);

  // ─── Retro prompt hook ───────────────────────────────────────────────────────
  const { promptForRetroPackageSize, retroDialogElement } = useRetroPrompt();

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const formatDate = (d: string) =>
    format(parseISO(d.includes('T') ? d : d + 'T00:00:00'), 'dd/MM/yy', { locale: ptBR });
  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const selectedStoreName = useMemo(
    () => stores.find(s => s.id === selectedStoreId)?.name ?? null,
    [stores, selectedStoreId]
  );

  // ─── loadAll ─────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!inventoryItem) return;
    loadingRef.current = true;

    const [
      historyData, listsData, categoriesData, sli, consumptionStats,
      defaultStoreMode, defaultStoreId, storesData, historyPrice,
    ] = await Promise.all([
      getInventoryHistory(inventoryItem.id),
      getLists(),
      getCategories(),
      getShoppingListItemForInventoryItem(inventoryItem.id),
      getProductConsumptionStats(inventoryItem.id, inventoryItem.productId),
      getSetting('defaultStoreMode'),
      getSetting('defaultStoreId'),
      getStores(),
      getPriceHistory(inventoryItem.productId),
    ]);

    setHistory(historyData);
    setLists(listsData);
    setCategories(categoriesData);
    setShoppingListItem(sli);
    initialShoppingListItemRef.current = sli;
    setSlQuantity(sli?.quantity ?? 1);
    setStats(consumptionStats);
    setStores(storesData);
    setPriceHistory(historyPrice);

    const initialStoreId = defaultStoreMode === 'fixed' && defaultStoreId
      ? parseInt(defaultStoreId) : null;
    setSelectedStoreId(initialStoreId);

    const refPrice = await getReferencePriceForProduct(inventoryItem.productId, initialStoreId);
    setCurrentRefPrice(refPrice);
    if (sli?.price) {
      setSuggestedPrice(sli.price);
      setPriceInput(sli.price.toFixed(2));
    } else if (refPrice) {
      setSuggestedPrice(refPrice.price);
      setPriceInput(refPrice.price.toFixed(2));
    }

    const lowestRefMap = await getLowestRefPricesPerUnit([inventoryItem.productId]);
    setLowestRefPricePerUnit(lowestRefMap.get(inventoryItem.productId) ?? null);

    isDirtyRef.current = false;
    setTimeout(() => { loadingRef.current = false; }, 0);
  }, [inventoryItem]);

  const { moveItems } = useMoveToList(loadAll);


  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // ─── Store select ─────────────────────────────────────────────────────────────
  const handleStoreSelect = useCallback(async (storeId: number | null) => {
    setSelectedStoreId(storeId);
    if (!inventoryItem) return;
    const refPrice = await getReferencePriceForProduct(inventoryItem.productId, storeId);
    setCurrentRefPrice(refPrice);
    setSuggestedPrice(refPrice?.price ?? 0);
    setPriceInput(refPrice ? refPrice.price.toFixed(2) : '');
    isDirtyRef.current = true;
  }, [inventoryItem]);

  // ─── Unit management ─────────────────────────────────────────────────────────
  const handleFamilySelect = useCallback((family: UnitFamily) => {
    setSelectedFamily(family);
    setSelectedUnitSymbol(null);
    setStdSizeInputStr('');
  }, []);

  const handleUnitSelect = useCallback((sym: UnitSymbol) => {
    setSelectedUnitSymbol(sym);
    setStdSizeInputStr('');
  }, []);

  const handleConfirmStdSize = useCallback(() => {
    if (!selectedUnitSymbol) return;
    const unit = UNITS.find(u => u.symbol === selectedUnitSymbol)!;
    const displayVal = parseFloat(stdSizeInputStr.replace(',', '.')) || unit.defaultStdSize;
    setStdSizeInputStr(String(displayVal));
    setLocalUnit(selectedUnitSymbol);
    setUnitExpanded(false);
    isDirtyRef.current = true;
  }, [selectedUnitSymbol, stdSizeInputStr]);

  const handleRemoveUnit = useCallback(() => {
    Alert.alert(
      'Remover unidade?',
      'As referências de preço existentes serão removidas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive', onPress: () => {
            setLocalUnit(null);
            setStdSizeInputStr('');
            setSelectedFamily(null);
            setSelectedUnitSymbol(null);
            setUnitExpanded(false);
            isDirtyRef.current = true;
          },
        },
      ]
    );
  }, []);

  // ─── Price save (legacy) ─────────────────────────────────────────────────────
  const handlePriceSave = useCallback(() => {
    const parsed = parseFloat(priceInput.replace(',', '.'));
    if (isNaN(parsed)) return;
    setSuggestedPrice(parsed);
    setPriceInput(parsed.toFixed(2));
    setEditingPrice(false);
    isDirtyRef.current = true;
  }, [priceInput]);

  // ─── handleSave ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!inventoryItem?.id) return false;
    try {
      // Core inventory
      await updateInventoryItem(inventoryItem.id, liveQuantity, notes);
      if (name !== inventoryItem.productName) {
        await updateProductName(inventoryItem.productId, name);
      }
      if (selectedCategoryId !== (inventoryItem.categoryId ?? null)) {
        await updateProductCategory(inventoryItem.productId, selectedCategoryId!);
      }

      if (selectedListId !== inventoryItem.listId) {
        const targetList = lists.find(l => l.id === selectedListId)!;
        await moveItems(
          [{ id: inventoryItem.id, productId: inventoryItem.productId, productName: name }],
          targetList,
        );
      }

      // ── Unit changes — all DB writes deferred until after alerts ──────────────
      const unitChanged = localUnit !== inventoryItem.unit ||
        effectiveAtomicStdSize !== inventoryItem.standardPackageSize;

      if (!localUnit && inventoryItem.unit) {
        // Removing unit
        await updateProductUnit(inventoryItem.productId, null, null);
        await clearReferencePricesForProduct(inventoryItem.productId);

      } else if (unitChanged && localUnit && effectiveAtomicStdSize) {
        // New or changed unit — show alert FIRST, write to DB after choice
        const last = await getLastInvoiceItemForProduct(inventoryItem.productId);

        if (last) {
          const choice = await new Promise<'cancel' | 'no' | 'yes'>(resolve => {
            Alert.alert(
              'Calcular referência histórica?',
              `Última compra:\n• ${last.storeName}\n• ${formatDateTime(last.createdAt)}\n• ${formatCurrency(last.unitPrice)}\n\nUsar para calcular referência histórica?`,
              [
                { text: 'Não salvar unidade', style: 'cancel', onPress: () => resolve('cancel') },
                { text: 'Não', onPress: () => resolve('no') },
                { text: 'Sim', onPress: () => resolve('yes') },
              ]
            );
          });

          if (choice === 'cancel') {
            // Revert local unit state, do not save
            setLocalUnit(inventoryItem.unit ?? null);
            setSelectedUnitSymbol(inventoryItem.unit ?? null);
            setSelectedFamily(inventoryItem.unit ? getFamilyOf(inventoryItem.unit) : null);
            setStdSizeInputStr(
              inventoryItem.unit && inventoryItem.standardPackageSize
                ? String(inventoryItem.standardPackageSize / getUnitFactor(inventoryItem.unit))
                : ''
            );
            isDirtyRef.current = false;
            return false;
          }

          // Write unit + clear refs
          await updateProductUnit(inventoryItem.productId, localUnit, effectiveAtomicStdSize);
          await clearReferencePricesForProduct(inventoryItem.productId);

          if (choice === 'yes') {
            const enteredSize = await promptForRetroPackageSize(
              effectiveAtomicStdSize,
              localUnit,
              { storeName: last.storeName, createdAt: last.createdAt, unitPrice: last.unitPrice }
            );
            if (enteredSize != null && enteredSize > 0) {
              await upsertProductStorePrice(inventoryItem.productId, last.storeId, last.unitPrice, enteredSize);
              await upsertProductBasePrice(inventoryItem.productId, last.unitPrice, enteredSize);
              Alert.alert(
                'Referência criada',
                `${last.storeName} • ${formatDateTime(last.createdAt)}\nPreço: ${formatCurrency(last.unitPrice)}\nTamanho: ${String(enteredSize / getUnitFactor(localUnit)).replace('.', ',')} ${localUnit}`,
              );
            }
          }
          // 'no' → unit saved, refs cleared, no retro

        } else {
          // No purchase history
          const confirmed = await new Promise<boolean>(resolve => {
            Alert.alert(
              'Configurar unidade',
              'Nenhuma compra anterior encontrada. As referências de preço existentes serão removidas.',
              [
                { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Confirmar', onPress: () => resolve(true) },
              ]
            );
          });
          if (!confirmed) {
            setLocalUnit(inventoryItem.unit ?? null);
            setSelectedUnitSymbol(inventoryItem.unit ?? null);
            isDirtyRef.current = false;
            return false;
          }
          await updateProductUnit(inventoryItem.productId, localUnit, effectiveAtomicStdSize);
          await clearReferencePricesForProduct(inventoryItem.productId);
        }
      }

      // ── Price ────────────────────────────────────────────────────────────────
      if (localUnit && triangleRef.current) {
        const value = triangleRef.current.getValue();
        if (value.updateRefPrice && value.pricePaid && value.pricePaid > 0) {
          const pkgSize = value.packageSize ?? effectiveAtomicStdSize ?? null;
          if (selectedStoreId !== null) {
            await upsertProductStorePrice(inventoryItem.productId, selectedStoreId, value.pricePaid, pkgSize);
          } else {
            await upsertProductBasePrice(inventoryItem.productId, value.pricePaid, pkgSize);
          }
        }
        if (value.updateStdSize && value.packageSize != null && localUnit) {
          await updateProductUnit(inventoryItem.productId, localUnit, value.packageSize);
        }
      } else if (!localUnit) {
        // Legacy price
        const resolvedPrice = parseFloat(priceInput.replace(',', '.'));
        const finalPrice = isNaN(resolvedPrice) ? suggestedPrice : resolvedPrice;
        if (finalPrice > 0) {
          if (selectedStoreId !== null) {
            await upsertProductStorePrice(inventoryItem.productId, selectedStoreId, finalPrice, null);
          } else {
            await upsertProductBasePrice(inventoryItem.productId, finalPrice, null);
          }
        }
      }

      // ── Shopping list ────────────────────────────────────────────────────────
      const originalSli = initialShoppingListItemRef.current;
      const slPrice = localUnit && triangleRef.current
        ? triangleRef.current.getValue().pricePaid
        : suggestedPrice || undefined;

      if (shoppingListItem?.id && shoppingListItem.id > 0) {
        await updateShoppingListItem(shoppingListItem.id, {
          quantity: slQuantity ?? 1,
          price: slPrice,
        });
      }
      if (shoppingListItem === null && originalSli) {
        await deleteShoppingListItem(originalSli.id);
      }
      if (shoppingListItem?.id === -1 && !originalSli) {
        await addShoppingListItem(
          selectedListId !== inventoryItem.listId ? selectedListId : inventoryItem.listId,
          name,
          slQuantity ?? 1,
          slPrice,
        );
      }

      isDirtyRef.current = false;
      return true;
    } catch (error) {
      console.error('Erro ao salvar:', error);
      return false;
    }
  }, [
    inventoryItem, liveQuantity, notes, name, selectedCategoryId, selectedListId,
    localUnit, effectiveAtomicStdSize, priceInput, suggestedPrice, shoppingListItem,
    selectedStoreId, promptForRetroPackageSize,
  ]);

  const handleSaveAndGoBack = useCallback(async () => {
    const success = await handleSave();
    if (success) {
      savedRef.current = true;
      navigation.goBack();
    }
  }, [handleSave, navigation]);

  // ─── beforeRemove guard ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (!isDirtyRef.current || savedRef.current) return;
      // @ts-ignore - preventDefault exists on the event object
      (e as any).preventDefault();
      Alert.alert('Sair sem salvar?', 'Você tem alterações não salvas.', [
        {
          text: 'Descartar', style: 'destructive', onPress: () => {
            isDirtyRef.current = false;
            navigation.dispatch(e.data.action);
          },
        },
        {
          text: 'Salvar', onPress: async () => {
            const success = await handleSave();
            if (success) {
              savedRef.current = true;
              navigation.dispatch(e.data.action);
            }
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, handleSave]);

  // ─── Triangle seed effect ────────────────────────────────────────────────────

  useEffect(() => {
    if (!localUnit || !effectiveAtomicStdSize) return;

    if (currentRefPrice && currentRefPrice.packageSize && currentRefPrice.packageSize > 0) {
      const refPPU = currentRefPrice.price / currentRefPrice.packageSize;
      const pricePerPkg = refPPU * effectiveAtomicStdSize;

      triangleRef.current?.seed({
        pricePerPkg,
        packageSize: currentRefPrice.packageSize,
        pricePaid: currentRefPrice.price,
        unit: localUnit,
        standardPackageSize: effectiveAtomicStdSize,
      });
    } else if (currentRefPrice && currentRefPrice.price > 0) {
      // Ref price exists but no packageSize — seed pricePaid only, use stdSize as default
      const pricePerPkg = currentRefPrice.price;
      triangleRef.current?.seed({
        pricePerPkg,
        packageSize: effectiveAtomicStdSize,
        pricePaid: currentRefPrice.price,
        unit: localUnit,
        standardPackageSize: effectiveAtomicStdSize,
      });
    } else {
      triangleRef.current?.reset();
    }
  }, [currentRefPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Category / list handlers ────────────────────────────────────────────────
  const handleChangeList = useCallback((newListId: number) => {
    setSelectedListId(newListId);
    setListModalVisible(false);
    isDirtyRef.current = true;
  }, []);

  const handleCategorySelect = useCallback((categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setCategoryModalVisible(false);
    isDirtyRef.current = true;
  }, []);

  const handleCategoryCreate = useCallback(async (categoryName: string) => {
    const newId = await addCategory(categoryName);
    setSelectedCategoryId(newId);
    const updated = await getCategories();
    setCategories(updated);
    setCategoryModalVisible(false);
    isDirtyRef.current = true;
  }, []);

  // ─── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    Alert.alert('Confirmar Exclusão', `Excluir ${name} do estoque?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          await deleteInventoryItem(inventoryItem!.id);
          navigation.goBack();
        },
      },
    ]);
  }, [name, inventoryItem, navigation]);

  // ─── Chart data ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => ({
    labels: [...history].reverse().slice(-7).map(h =>
      format(parseISO(h.date.includes('T') ? h.date : h.date + 'T00:00:00'), 'dd/MM', { locale: ptBR })
    ),
    datasets: [{ data: [...history].reverse().slice(-7).map(h => h.quantity) }],
  }), [history]);

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const unitLabel = localUnit && effectiveAtomicStdSize
    ? formatStandardPackageDisplay(localUnit, effectiveAtomicStdSize)
    : null;

  const unitsForFamily = selectedFamily ? UNITS_BY_FAMILY[selectedFamily] : [];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <ContextualHeader
        listName={lists.find(l => l.id === inventoryItem?.listId)?.name ?? ''}
        onListDelete={handleDelete}
      />

      <ScrollView contentContainerStyle={s.scroll}>

        {/* ── Name ─────────────────────────────────────────────────────────── */}
        <View style={s.nameRow}>
          {isEditingName ? (
            <RNTextInput
              value={name}
              onChangeText={setName}
              autoFocus
              onBlur={() => setIsEditingName(false)}
              style={[s.nameInput, { color: theme.colors.onSurface, borderBottomColor: theme.colors.primary }]}
            />
          ) : (
            <Pressable onPress={() => setIsEditingName(true)} style={{ flex: 1 }}>
              <Text style={[s.nameText, { color: theme.colors.onSurface }]}>{name}</Text>
            </Pressable>
          )}
          <IconButton icon="pencil-outline" size={20} onPress={() => setIsEditingName(true)} />
          <IconButton icon="delete-outline" size={20} iconColor={theme.colors.error} onPress={handleDelete} />
        </View>

        {/* ── Quantity + unit row ──────────────────────────────────────────── */}
        <View style={s.qtyUnitRow}>
          {/* Stepper */}
          <View style={s.stepperGroup}>
            <Pressable
              style={[s.stepBtn, { borderColor: theme.colors.outline }]}
              onPress={() => updateInventoryItemQuantity(Math.max(0, liveQuantity - 1), true)}
              onLongPress={() => startContinuousAdjustment(false, true)}
              onPressOut={() => stopContinuousAdjustment(true)}
            >
              <MaterialCommunityIcons name="minus" size={18} color={theme.colors.primary} />
            </Pressable>
            <RNTextInput
              value={quantityInput}
              onChangeText={setQuantityInput}
              onBlur={() => updateInventoryItemQuantity(parseInt(quantityInput) || 0, true)}
              keyboardType="numeric"
              style={[s.qtyInput, { color: theme.colors.onSurface, borderColor: theme.colors.outline }]}
            />
            <Pressable
              style={[s.stepBtn, { borderColor: theme.colors.outline }]}
              onPress={() => updateInventoryItemQuantity(liveQuantity + 1, true)}
              onLongPress={() => startContinuousAdjustment(true, true)}
              onPressOut={() => stopContinuousAdjustment(true)}
            >
              <MaterialCommunityIcons name="plus" size={18} color={theme.colors.primary} />
            </Pressable>
          </View>

          {/* Unit chip / configure button */}
          {unitLabel ? (
            <Pressable
              style={[s.unitChip, { borderColor: theme.colors.outline }]}
              onPress={() => setUnitExpanded(e => !e)}
            >
              <Text style={[s.unitChipText, { color: theme.colors.onSurface }]}>
                {unitLabel}
              </Text>
              <MaterialCommunityIcons
                name={unitExpanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={theme.colors.onSurfaceVariant}
              />
            </Pressable>
          ) : (
            <Pressable
              style={[s.configureUnitBtn, { borderColor: theme.colors.outlineVariant }]}
              onPress={() => setUnitExpanded(true)}
            >
              <MaterialCommunityIcons name="ruler" size={14} color={theme.colors.primary} />
              <Text style={[s.configureUnitText, { color: theme.colors.primary }]}>
                + unidade
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Inline unit editor ───────────────────────────────────────────── */}
        {unitExpanded && (
          <View style={[s.unitEditor, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}>
            <Text style={[s.unitEditorTitle, { color: theme.colors.onSurfaceVariant }]}>
              Como medir este produto?
            </Text>

            <View style={s.chipRow}>
              {(['massa', 'volume', 'contagem'] as UnitFamily[]).map(family => {
                const labels: Record<UnitFamily, string> = { massa: 'Peso', volume: 'Volume', contagem: 'Contagem' };
                return (
                  <Chip
                    key={family}
                    selected={selectedFamily === family}
                    onPress={() => handleFamilySelect(family)}
                    compact
                  >
                    {labels[family]}
                  </Chip>
                );
              })}
            </View>

            {selectedFamily && (
              <View style={[s.chipRow, { marginTop: 8 }]}>
                {unitsForFamily.map(u => (
                  <Chip
                    key={u.symbol}
                    selected={selectedUnitSymbol === u.symbol}
                    onPress={() => handleUnitSelect(u.symbol)}
                    compact
                  >
                    {u.symbol}
                  </Chip>
                ))}
              </View>
            )}

            {selectedUnitSymbol && (
              <View style={{ marginTop: 10 }}>
                <Text style={[s.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
                  EMBALAGEM PADRÃO
                </Text>
                <View style={s.stdSizeRow}>
                  <RNTextInput
                    value={stdSizeInputStr}
                    onChangeText={setStdSizeInputStr}
                    keyboardType="decimal-pad"
                    placeholder={String(selectedUnitObj?.defaultStdSize ?? '')}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    returnKeyType="done"
                    onSubmitEditing={handleConfirmStdSize}
                    style={[s.stdSizeInput, { borderColor: theme.colors.outline, color: theme.colors.onSurface }]}
                  />
                  <Text style={[s.unitSuffix, { color: theme.colors.onSurfaceVariant }]}>
                    {selectedUnitSymbol}
                  </Text>
                  <Pressable
                    onPress={handleConfirmStdSize}
                    style={[s.confirmBtn, { backgroundColor: theme.colors.primary }]}
                  >
                    <MaterialCommunityIcons name="check" size={16} color={theme.colors.onPrimary} />
                  </Pressable>
                </View>
                <Text style={[s.unitHint, { color: theme.colors.onSurfaceVariant }]}>
                  Vazio = padrão ({selectedUnitObj?.defaultStdSize}{selectedUnitSymbol})
                </Text>
              </View>
            )}

            {inventoryItem?.unit && (
              <Pressable onPress={handleRemoveUnit} style={s.removeUnitLink}>
                <Text style={[s.removeUnitText, { color: theme.colors.error }]}>
                  Remover unidade
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Notes ───────────────────────────────────────────────────────── */}
        <RNTextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Observações..."
          placeholderTextColor={theme.colors.outline}
          multiline
          style={[s.notes, { color: theme.colors.onSurface, borderColor: theme.colors.outlineVariant }]}
        />

        {/* ── Produto: category + list ──────────────────────────────────── */}
        <View style={s.chipsRow}>
          {/* Category chip with label on border */}
          <View style={s.labeledChipWrap}>
            <Text style={[s.chipFloatLabel, { color: theme.colors.onSurfaceVariant, backgroundColor: theme.colors.background }]}>
              Categoria
            </Text>
            <Chip icon="tag-outline" onPress={() => setCategoryModalVisible(true)} mode="outlined" style={s.chip}>
              {categories.find(c => c.id === selectedCategoryId)?.name || 'Sem categoria'}
            </Chip>
          </View>

          {/* List chip with label on border */}
          <View style={s.labeledChipWrap}>
            <Text style={[s.chipFloatLabel, { color: theme.colors.onSurfaceVariant, backgroundColor: theme.colors.background }]}>
              Lista
            </Text>
            <Chip icon="format-list-bulleted" onPress={() => setListModalVisible(true)} mode="outlined" style={s.chip}>
              {lists.find(l => l.id === selectedListId)?.name || 'Lista'}
            </Chip>
          </View>
        </View>

        <Divider style={s.divider} />

        {/* ── Preço de referência ──────────────────────────────────────────── */}
        <Text style={[s.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>PREÇO DE REFERÊNCIA</Text>

        <View style={s.storeSelectorRow}>
          <StoreSelector
            stores={stores}
            selectedStoreId={selectedStoreId}
            onStoreChange={handleStoreSelect}
            nullOptionLabel="Qualquer loja"
          />
        </View>

        {localUnit && effectiveAtomicStdSize ? (
          <PriceTriangle
            ref={triangleRef}
            productUnit={localUnit}
            productStandardPackageSize={effectiveAtomicStdSize}
            refPrice={currentRefPrice}
            manualOverrideActive={false}
            initialPrice={suggestedPrice || undefined}
            initialPackageSize={currentRefPrice?.packageSize ?? null}
            quantity={slQuantity}
            onQuantityChange={setSlQuantity}
            selectedStoreName={selectedStoreName}
            lowestRefPricePerUnit={lowestRefPricePerUnit}
          />
        ) : (
          /* Legacy price field */
          <View style={s.legacyPriceRow}>
            {editingPrice ? (
              <RNTextInput
                value={priceInput}
                onChangeText={text => { setPriceInput(text); isDirtyRef.current = true; }}
                keyboardType="decimal-pad"
                autoFocus
                onBlur={handlePriceSave}
                style={[s.legacyPriceInput, { color: theme.colors.onSurface, borderBottomColor: theme.colors.primary }]}
              />
            ) : (
              <Pressable onPress={() => setEditingPrice(true)}>
                <Text style={[s.legacyPriceText, { color: theme.colors.onSurface }]}>
                  {suggestedPrice > 0 ? formatCurrency(suggestedPrice) : '—'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Shopping list row ─────────────────────────────────────────────── */}
        <View style={s.slRow}>
          {shoppingListItem ? (
            <View style={[s.slActiveRow, { borderColor: theme.colors.primary }]}>
              <MaterialCommunityIcons name="cart-check" size={18} color={theme.colors.primary} />
              <Text style={[s.slActiveText, { color: theme.colors.primary }]}>
                Na lista · {shoppingListItem.quantity} emb.
              </Text>
              <Pressable
                onPress={() => { setShoppingListItem(null); isDirtyRef.current = true; }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={16} color={theme.colors.onSurfaceVariant} />
              </Pressable>
            </View>
          ) : (
            <Button
              mode="outlined"
              icon="cart-plus"
              onPress={() => { setShoppingListItem({ id: -1, quantity: 1 }); isDirtyRef.current = true; }}
              style={s.slButton}
            >
              Adicionar à lista de compras
            </Button>
          )}
        </View>

        {/* ── Save button ──────────────────────────────────────────────────── */}
        <Button
          mode="contained"
          onPress={handleSaveAndGoBack}
          icon="content-save"
          style={s.saveButton}
        >
          Salvar alterações
        </Button>

        <Divider style={s.divider} />

        {/* ── Stats (collapsible) ──────────────────────────────────────────── */}
        <Pressable
          style={s.collapsibleHeader}
          onPress={() => setStatsCollapsed(p => !p)}
        >
          <Text style={[s.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>ESTATÍSTICAS</Text>
          <MaterialCommunityIcons
            name={statsCollapsed ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>

        {!statsCollapsed && stats && (
          <View style={[s.statsBox, { borderColor: theme.colors.outlineVariant }]}>
            {stats.avgWeeklyConsumption !== null && (
              <StatRow
                icon="trending-down"
                label="Consumo médio"
                value={`~${stats.avgWeeklyConsumption.toFixed(1)}/semana`}
                theme={theme}
              />
            )}

            {/* Price stats — PPU if available, nominal fallback */}
            {localUnit && effectiveAtomicStdSize && stats.avgPricePerUnit90d != null ? (
              <StatRow
                icon="tag-outline"
                label="Preço médio (90d)"
                value={formatPerStdPkg(stats.avgPricePerUnit90d, localUnit, effectiveAtomicStdSize)}
                theme={theme}
              />
            ) : stats.avgPrice90d != null ? (
              <StatRow
                icon="tag-outline"
                label="Preço médio (90d)"
                value={formatCurrency(stats.avgPrice90d)}
                theme={theme}
              />
            ) : null}

            {localUnit && effectiveAtomicStdSize && stats.lowestPricePerUnit90d != null ? (
              <StatRow
                icon="sale"
                label="Menor compra (90d)"
                value={`${formatPerStdPkg(stats.lowestPricePerUnit90d.pricePerUnit, localUnit, effectiveAtomicStdSize)} em ${stats.lowestPricePerUnit90d.storeName}`}
                theme={theme}
              />
            ) : stats.lowestPrice90d != null ? (
              <StatRow
                icon="sale"
                label="Menor compra (90d)"
                value={`${formatCurrency(stats.lowestPrice90d.price)} em ${stats.lowestPrice90d.storeName}`}
                theme={theme}
              />
            ) : null}

            {localUnit && effectiveAtomicStdSize && lowestRefPricePerUnit != null && (
              <StatRow
                icon="store-check-outline"
                label="Menor ref. cadastrada"
                value={`${formatPerStdPkg(lowestRefPricePerUnit.pricePerUnit, localUnit, effectiveAtomicStdSize)} em ${lowestRefPricePerUnit.storeName}`}
                theme={theme}
              />
            )}
          </View>
        )}

        <Divider style={s.divider} />

        {/* ── History sections ─────────────────────────────────────────────── */}
        <QuantityHistorySection
          history={history}
          collapsed={qtyHistoryCollapsed}
          onToggle={() => setQtyHistoryCollapsed(p => !p)}
          chartData={chartData}
          themeColors={{
            onSurfaceVariant: theme.colors.onSurfaceVariant,
            onSurface: theme.colors.onSurface,
            outline: theme.colors.outline,
            outlineVariant: theme.colors.outlineVariant,
            error: theme.colors.error,
            primary: theme.colors.primary,
            surface: theme.colors.surface,
          }}
        />

        <Divider style={s.divider} />

        <PriceHistorySection
          priceHistory={priceHistory}
          collapsed={priceHistoryCollapsed}
          onToggle={() => setPriceHistoryCollapsed(p => !p)}
          themeColors={{
            onSurfaceVariant: theme.colors.onSurfaceVariant,
            onSurface: theme.colors.onSurface,
            outline: theme.colors.outline,
            outlineVariant: theme.colors.outlineVariant,
          }}
        />

      </ScrollView>

      {/* Pickers */}
      <ItemPickerDialog
        visible={listModalVisible}
        onDismiss={() => setListModalVisible(false)}
        items={lists}
        selectedId={selectedListId}
        onSelect={handleChangeList}
        title="Escolher Lista"
      />
      <SearchablePickerDialog
        visible={categoryModalVisible}
        onDismiss={() => setCategoryModalVisible(false)}
        items={categories}
        selectedId={selectedCategoryId}
        onSelect={handleCategorySelect}
        onCreateNew={handleCategoryCreate}
        title="Escolher Categoria"
        placeholder="Buscar categoria..."
      />

      {/* Retro dialog */}
      <Portal>
        {retroDialogElement}
      </Portal>
    </SafeAreaView>
  );
}

// ─── StatRow helper ───────────────────────────────────────────────────────────

function StatRow({ icon, label, value, theme }: {
  icon: string; label: string; value: string; theme: any;
}) {
  return (
    <View style={s.statRow}>
      <MaterialCommunityIcons name={icon as any} size={14} color={theme.colors.onSurfaceVariant} />
      <Text style={[s.statLabel, { color: theme.colors.onSurfaceVariant }]}>{label}:</Text>
      <Text style={[s.statValue, { color: theme.colors.onSurface }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },

  // Name
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  nameInput: { flex: 1, fontSize: 20, fontWeight: '600', borderBottomWidth: 1.5, paddingVertical: 4 },
  nameText: { flex: 1, fontSize: 20, fontWeight: '600', paddingVertical: 4 },

  // Quantity + unit row
  qtyUnitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  stepperGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  qtyInput: { width: 52, height: 36, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 16, includeFontPadding: false, },
  unitChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  unitChipText: { fontSize: 13, fontWeight: '500' },
  configureUnitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed' },
  configureUnitText: { fontSize: 12 },

  // Unit editor
  unitEditor: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 12, gap: 4 },
  unitEditorTitle: { fontSize: 13, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldLabel: { fontSize: 10, letterSpacing: 0.6, marginBottom: 6 },
  stdSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stdSizeInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 15 },
  unitSuffix: { fontSize: 14, fontWeight: '500', minWidth: 24 },
  confirmBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  unitHint: { fontSize: 10, fontStyle: 'italic', marginTop: 4 },
  removeUnitLink: { marginTop: 12, alignSelf: 'flex-start' },
  removeUnitText: { fontSize: 12 },

  // Notes
  notes: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, minHeight: 56, marginBottom: 4, textAlignVertical: 'top' },

  // Section
  divider: { marginVertical: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  // Product chips (labeled)
  chipsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  labeledChipWrap: { position: 'relative', paddingTop: 6 },
  chipFloatLabel: { position: 'absolute', top: 0, left: 10, zIndex: 1, fontSize: 9, paddingHorizontal: 3, letterSpacing: 0.4 },
  chip: {},

  // Price
  storeSelectorRow: { marginBottom: 12 },
  legacyPriceRow: { paddingVertical: 8 },
  legacyPriceInput: { fontSize: 20, borderBottomWidth: 1.5, paddingVertical: 4 },
  legacyPriceText: { fontSize: 20, fontWeight: '500' },

  // Shopping list
  slRow: { marginTop: 14 },
  slActiveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  slActiveText: { flex: 1, fontSize: 13, fontWeight: '500' },
  slButton: { borderRadius: 8 },

  // Save
  saveButton: { marginTop: 16, borderRadius: 8 },

  // Stats
  collapsibleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsBox: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginTop: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 12, fontWeight: '500', flex: 1 },
});

