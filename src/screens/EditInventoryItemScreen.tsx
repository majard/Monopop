import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, ScrollView, StyleSheet, TextInput as RNTextInput,
  Alert, Pressable, Dimensions,
} from 'react-native';
import {
  Text, useTheme, Card, Chip, Divider, Button, IconButton,
} from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect, usePreventRemove } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  updateInventoryItem,
  getInventoryHistory,
  updateProductName,
  deleteInventoryItem,
  getLists,
  updateInventoryItemList,
  getCategories,
  addCategory,
  updateProductCategory,
  getLastUnitPriceForProduct,
  getLastUnitPriceForProductAtStore,
  addShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem,
  getProductConsumptionStats,
  getShoppingListItemForInventoryItem,
  getSetting,
  getStores,
  getPriceHistory,
} from '../database/database';
import { InventoryHistory } from '../database/models';
import { RootStackParamList } from '../types/navigation';
import ContextualHeader from '../components/ContextualHeader';
import { ItemPickerDialog } from '../components/ItemPickerDialog';
import { SearchablePickerDialog } from '../components/SearchablePickerDialog';
import { useInventoryItem } from '../hooks/useInventoryItem';
import QuantityHistorySection from '../components/QuantityHistorySection';
import PriceHistorySection from '../components/PriceHistorySection';
import { editInventoryItemStyles } from '../styles/EditInventoryItemStyles';

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
}

export default function EditInventoryItem() {
  const route = useRoute<EditInventoryItemProps['route']>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const inventoryItem = route.params?.inventoryItem;
  const theme = useTheme();

  // Core fields
  const [name, setName] = useState(inventoryItem?.productName || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [notes, setNotes] = useState(inventoryItem?.notes || '');
  const [quantityInput, setQuantityInput] = useState('');

  // Category and list
  const [lists, setLists] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedListId, setSelectedListId] = useState(inventoryItem?.listId ?? 1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(inventoryItem?.categoryId ?? null);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // Shopping list
  const [shoppingListItem, setShoppingListItem] = useState<{ id: number; quantity: number; price?: number } | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<number>(0);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');

  // History
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [quantityHistoryCollapsed, setQuantityHistoryCollapsed] = useState(false);
  const [priceHistoryCollapsed, setPriceHistoryCollapsed] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(true);

  // Derived stats
  const [stats, setStats] = useState<ConsumptionStats | null>(null);

  // useInventoryItem hook for quantity management
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

  // Sync quantity input with live quantity
  useEffect(() => {
    setQuantityInput(liveQuantity.toString());
  }, [liveQuantity]);

  // Dirty tracking for beforeRemove
  const isDirtyRef = useRef(false);
  const mountedRef = useRef(false);
  const loadingRef = useRef(true); // starts true, set false after first load
  const savedRef = useRef(false);

  // Initial value refs for revert functionality
  const initialQuantityRef = useRef(inventoryItem?.quantity ?? 0);
  const initialPriceRef = useRef<number>(0);
  const initialShoppingListItemRef = useRef<{ id: number; quantity: number; price?: number } | null>(null);

  // Mark dirty on any field change (but not on initial mount)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (loadingRef.current) return;
    isDirtyRef.current = true;
  }, [name, notes, selectedCategoryId, selectedListId, liveQuantity, suggestedPrice, shoppingListItem]);

  const handleSave = useCallback(async () => {
    if (!inventoryItem?.id) return;
    try {
      const resolvedPrice = parseFloat(priceInput.replace(',', '.'));
      const finalPrice = isNaN(resolvedPrice) ? suggestedPrice : resolvedPrice;

      await updateInventoryItem(inventoryItem.id, liveQuantity, notes);

      if (name !== inventoryItem.productName) {
        await updateProductName(inventoryItem.productId, name);
      }
      if (selectedCategoryId !== (inventoryItem.categoryId ?? null)) {
        await updateProductCategory(inventoryItem.productId, selectedCategoryId!);
      }
      if (selectedListId !== inventoryItem.listId) {
        await updateInventoryItemList(inventoryItem.id, selectedListId);
      }

      // Handle price and shopping list changes
      if (finalPrice !== initialPriceRef.current && shoppingListItem?.id && shoppingListItem.id > 0) {
        await updateShoppingListItem(shoppingListItem.id, { price: finalPrice });
      }

      const originalSli = initialShoppingListItemRef.current;
      if (shoppingListItem === null && originalSli) {
        await deleteShoppingListItem(originalSli.id);
      }
      if (shoppingListItem?.id === -1 && !originalSli) {
        await addShoppingListItem(inventoryItem.listId, inventoryItem.productName, shoppingListItem.quantity, finalPrice);
      }

      savedRef.current = true;
      isDirtyRef.current = false;
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  }, [inventoryItem, liveQuantity, notes, name, selectedCategoryId, selectedListId, priceInput, suggestedPrice, shoppingListItem]);

  const handleSaveAndGoBack = useCallback(async () => {
    await handleSave();
    navigation.goBack();
  }, [handleSave, navigation]);

  const loadAll = useCallback(async () => {
    if (!inventoryItem) return;
    loadingRef.current = true;

    const [
      historyData,
      listsData,
      categoriesData,
      sli,
      consumptionStats,
      defaultStoreMode,
      defaultStoreId,
    ] = await Promise.all([
      getInventoryHistory(inventoryItem.id),
      getLists(),
      getCategories(),
      getShoppingListItemForInventoryItem(inventoryItem.id),
      getProductConsumptionStats(inventoryItem.id, inventoryItem.productId),
      getSetting('defaultStoreMode'),
      getSetting('defaultStoreId'),
    ]);

    setHistory(historyData);
    setLists(listsData);
    setCategories(categoriesData);
    setShoppingListItem(sli);
    setStats(consumptionStats);

    // Load price history
    const ph = await getPriceHistory(inventoryItem.productId);
    setPriceHistory(ph);

    // Determine suggested price
    if (sli?.price) {
      setSuggestedPrice(sli.price);
      setPriceInput(sli.price.toFixed(2));
    } else if (defaultStoreMode === 'fixed' && defaultStoreId) {
      const storePrice = await getLastUnitPriceForProductAtStore(inventoryItem.productId, parseInt(defaultStoreId));
      if (storePrice) { setSuggestedPrice(storePrice); setPriceInput(storePrice.toFixed(2)); return; }
    }
    const lastPrice = await getLastUnitPriceForProduct(inventoryItem.productId);
    if (lastPrice) { setSuggestedPrice(lastPrice); setPriceInput(lastPrice.toFixed(2)); }

    // Set initial refs after loadAll completes
    initialPriceRef.current = suggestedPrice;
    initialShoppingListItemRef.current = sli;

    // Reset dirty after load
    //workaround for the issue where the component is unmounted before the loadAll is completed
    isDirtyRef.current = false;
    setTimeout(() => {
      loadingRef.current = false;
    }, 0);
  }, [inventoryItem]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // beforeRemove guard
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirtyRef.current || savedRef.current) return;
      e.preventDefault();
      Alert.alert(
        'Sair sem salvar?',
        'Você tem alterações não salvas.',
        [
          {
            text: 'Descartar', style: 'destructive', onPress: () => {
              isDirtyRef.current = false;
              navigation.dispatch(e.data.action);
            }
          },
          {
            text: 'Salvar', onPress: async () => {
              await handleSave();
              navigation.dispatch(e.data.action);
            }
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, handleSave]);

  const handleChangeList = useCallback(async (newListId: number) => {
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
    const newCategoryId = await addCategory(categoryName);
    setSelectedCategoryId(newCategoryId);
    const updatedCategories = await getCategories();
    setCategories(updatedCategories);
    setCategoryModalVisible(false);
    isDirtyRef.current = true;
  }, []);

  const handleToggleShoppingList = useCallback(() => {
    if (!inventoryItem) return;
    setShoppingListItem(prev => prev ? null : { id: -1, quantity: 1, price: suggestedPrice || undefined });
    isDirtyRef.current = true;
  }, [inventoryItem, suggestedPrice]);

  const handlePriceSave = useCallback(() => {
    const parsed = parseFloat(priceInput.replace(',', '.'));
    if (isNaN(parsed)) return;
    setSuggestedPrice(parsed);
    setPriceInput(parsed.toFixed(2));
    setEditingPrice(false);
    isDirtyRef.current = true;
  }, [priceInput]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Confirmar Exclusão',
      `Excluir ${name} do estoque?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive', onPress: async () => {
            await deleteInventoryItem(inventoryItem!.id);
            navigation.goBack();
          }
        },
      ]
    );
  }, [name, inventoryItem, navigation]);

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const formatDate = (d: string) => format(parseISO(d.includes('T') ? d : d + 'T00:00:00'), 'dd/MM', { locale: ptBR });

  const chartData = {
    labels: [...history].reverse().slice(-7).map(h => formatDate(h.date)),
    datasets: [{ data: [...history].reverse().slice(-7).map(h => h.quantity) }],
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ContextualHeader
        listName={inventoryItem?.listId ? lists.find(l => l.id === inventoryItem.listId)?.name ?? '' : ''}
        onListDelete={handleDelete}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

        {/* Name row */}
        <View style={editInventoryItemStyles.nameRow}>
          {isEditingName ? (
            <RNTextInput
              value={name}
              onChangeText={setName}
              autoFocus
              onBlur={() => setIsEditingName(false)}
              style={[editInventoryItemStyles.nameInput, {
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.primary,
              }]}
            />
          ) : (
            <Pressable onPress={() => setIsEditingName(true)} style={{ flex: 1 }}>
              <Text style={[editInventoryItemStyles.nameText, { color: theme.colors.onSurface }]}>
                {name}
              </Text>
            </Pressable>
          )}
          <IconButton icon="pencil-outline" size={22} onPress={() => setIsEditingName(true)} />
          <IconButton icon="delete-outline" size={22} iconColor={theme.colors.error} onPress={handleDelete} />
        </View>

        {/* Quantity row */}
        <View style={editInventoryItemStyles.quantityRow}>
          <Text style={[editInventoryItemStyles.label, { color: theme.colors.onSurfaceVariant }]}>
            Quantidade
          </Text>
          <View style={editInventoryItemStyles.quantityControls}>
            <Pressable
              onPress={() => updateInventoryItemQuantity(Math.max(0, liveQuantity - 1), true)}
              onLongPress={() => startContinuousAdjustment(false, true)}
              onPressOut={() => stopContinuousAdjustment(true)}
              style={[editInventoryItemStyles.qtyButton, { borderColor: theme.colors.outline }]}
            >
              <MaterialCommunityIcons name="minus" size={20} color={theme.colors.primary} />
            </Pressable>
            <RNTextInput
              value={quantityInput}
              onChangeText={setQuantityInput}
              onBlur={() => updateInventoryItemQuantity(parseInt(quantityInput) || 0, true)}
              keyboardType="numeric"
              style={[editInventoryItemStyles.qtyInput, {
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline,
              }]}
            />
            <Pressable
              onPress={() => updateInventoryItemQuantity(liveQuantity + 1, true)}
              onLongPress={() => startContinuousAdjustment(true, true)}
              onPressOut={() => stopContinuousAdjustment(true)}
              style={[editInventoryItemStyles.qtyButton, { borderColor: theme.colors.outline }]}
            >
              <MaterialCommunityIcons name="plus" size={20} color={theme.colors.primary} />
            </Pressable>

            {/* Price + shopping list inline */}

            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 12, paddingLeft: 16 }}>
              {editingPrice ? (
                <RNTextInput
                  value={priceInput}
                  onChangeText={text => { setPriceInput(text); isDirtyRef.current = true; }}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={handlePriceSave}
                  style={[editInventoryItemStyles.priceInput, {
                    color: theme.colors.onSurface,
                    borderBottomColor: theme.colors.primary,
                  }]}
                />
              ) : (
                <Pressable onPress={() => setEditingPrice(true)}>
                  <Text style={{ color: theme.colors.onSurface, fontSize: 18, minWidth: 100 }}>
                    {suggestedPrice > 0 ? formatCurrency(suggestedPrice) : '—'}
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={handleToggleShoppingList}>
                <MaterialCommunityIcons
                  name={shoppingListItem ? 'cart-check' : 'cart-plus'}
                  size={28}
                  color={shoppingListItem ? theme.colors.primary : theme.colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Category + List chips */}
        <View style={editInventoryItemStyles.chipsRow}>
          <Chip
            icon="tag-outline"
            onPress={() => setCategoryModalVisible(true)}
            style={editInventoryItemStyles.chip}
            mode="outlined"
          >
            {categories.find(c => c.id === selectedCategoryId)?.name || 'Sem categoria'}
          </Chip>
          <Chip
            icon="format-list-bulleted"
            onPress={() => setListModalVisible(true)}
            style={editInventoryItemStyles.chip}
            mode="outlined"
          >
            {lists.find(l => l.id === selectedListId)?.name || 'Lista'}
          </Chip>
        </View>

        {/* Notes */}
        <RNTextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Observações..."
          placeholderTextColor={theme.colors.outline}
          multiline
          style={[editInventoryItemStyles.notesInput, {
            color: theme.colors.onSurface,
            borderColor: theme.colors.outlineVariant,
          }]}
        />

        {/* Save + Delete buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Button
            mode="contained"
            onPress={handleSaveAndGoBack}
            style={{ flex: 1 }}
            icon="content-save"
          >
            Salvar alterações
          </Button>
        </View>

        {/* Derived stats */}
        {stats && (
          <>
            <Pressable
              onPress={() => setStatsCollapsed(p => !p)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 16,
              }}
            >
              <Text
                variant="labelMedium"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Estatísticas
              </Text>
              <MaterialCommunityIcons
                name={statsCollapsed ? "chevron-down" : "chevron-up"}
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            </Pressable>
            {!statsCollapsed && (
              <View style={[editInventoryItemStyles.statsRow, { borderColor: theme.colors.outlineVariant }]}>
                {stats.avgWeeklyConsumption !== null && (
                  <View style={editInventoryItemStyles.statItem}>
                    <MaterialCommunityIcons name="trending-down" size={16} color={theme.colors.onSurfaceVariant} />
                    <Text style={[editInventoryItemStyles.statText, { color: theme.colors.onSurfaceVariant }]}>
                      Consumo médio: ~{stats.avgWeeklyConsumption.toFixed(1)}/semana
                    </Text>
                  </View>
                )}
                {stats.avgPrice90d !== null && (
                  <View style={editInventoryItemStyles.statItem}>
                    <MaterialCommunityIcons name="tag-outline" size={16} color={theme.colors.onSurfaceVariant} />
                    <Text style={[editInventoryItemStyles.statText, { color: theme.colors.onSurfaceVariant }]}>
                      Preço médio (90d): {formatCurrency(stats.avgPrice90d)}
                    </Text>
                  </View>
                )}
                {stats.lowestPrice90d !== null && (
                  <View style={editInventoryItemStyles.statItem}>
                    <MaterialCommunityIcons name="sale" size={16} color={theme.colors.onSurfaceVariant} />
                    <Text style={[editInventoryItemStyles.statText, { color: theme.colors.onSurfaceVariant }]}>
                      Menor preço (90d): {formatCurrency(stats.lowestPrice90d.price)} em {stats.lowestPrice90d.storeName}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        <Divider style={{ marginVertical: 16 }} />

        <QuantityHistorySection
          history={history}
          collapsed={quantityHistoryCollapsed}
          onToggle={() => setQuantityHistoryCollapsed(p => !p)}
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
    </SafeAreaView>
  );
}