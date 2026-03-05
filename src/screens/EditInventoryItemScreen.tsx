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

  // Mark dirty on any field change (but not on initial mount)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (loadingRef.current) return;
    isDirtyRef.current = true;
  }, [name, notes, selectedCategoryId, selectedListId]);

  const handleSave = useCallback(async () => {
    if (!inventoryItem?.id) return;
    try {
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

      savedRef.current = true;
      isDirtyRef.current = false;
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  }, [inventoryItem, liveQuantity, notes, name, selectedCategoryId, selectedListId]);

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

    // Reset dirty after load
    isDirtyRef.current = false;
    loadingRef.current = false;
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
          { text: 'Descartar', style: 'destructive', onPress: () => {
            isDirtyRef.current = false;
            navigation.dispatch(e.data.action);
          }},
          { text: 'Salvar', onPress: async () => {
            await handleSave();
            navigation.dispatch(e.data.action);
          }},
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

  const handleToggleShoppingList = useCallback(async () => {
    if (!inventoryItem) return;
    if (shoppingListItem) {
      await deleteShoppingListItem(shoppingListItem.id);
      setShoppingListItem(null);
    } else {
      await addShoppingListItem(inventoryItem.listId, inventoryItem.productName, 1, suggestedPrice || undefined);
      const sli = await getShoppingListItemForInventoryItem(inventoryItem.id);
      setShoppingListItem(sli);
    }
  }, [inventoryItem, shoppingListItem, suggestedPrice]);

  const handlePriceSave = useCallback(async () => {
    const parsed = parseFloat(priceInput.replace(',', '.'));
    if (isNaN(parsed)) return;
    setSuggestedPrice(parsed);
    setEditingPrice(false);
    if (shoppingListItem) {
      await updateShoppingListItem(shoppingListItem.id, { price: parsed });
      setShoppingListItem(prev => prev ? { ...prev, price: parsed } : null);
    }
  }, [priceInput, shoppingListItem]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Confirmar Exclusão',
      `Excluir ${name} do estoque?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: async () => {
          await deleteInventoryItem(inventoryItem!.id);
          navigation.goBack();
        }},
      ]
    );
  }, [name, inventoryItem, navigation]);

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const formatDate = (d: string) => format(parseISO(d.includes('T') ? d : d + 'T00:00:00'), 'dd/MM', { locale: ptBR });
  const formatFullDate = (d: string) => format(parseISO(d.includes('T') ? d : d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });

  const chartData = {
    labels: [...history].reverse().slice(-7).map(h => formatDate(h.date)),
    datasets: [{ data: [...history].reverse().slice(-7).map(h => h.quantity) }],
  };

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(${hexToRgb(theme.colors.primary)}, ${opacity})`,
    labelColor: () => theme.colors.onSurfaceVariant,
    propsForDots: { r: '4', strokeWidth: '2', stroke: theme.colors.primary },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ContextualHeader
        listName={inventoryItem?.listId ? lists.find(l => l.id === inventoryItem.listId)?.name ?? '' : ''}
        onListDelete={handleDelete}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

        {/* Name row */}
        <View style={localStyles.nameRow}>
          {isEditingName ? (
            <RNTextInput
              value={name}
              onChangeText={setName}
              autoFocus
              onBlur={() => setIsEditingName(false)}
              style={[localStyles.nameInput, { 
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.primary,
              }]}
            />
          ) : (
            <Pressable onPress={() => setIsEditingName(true)} style={{ flex: 1 }}>
              <Text style={[localStyles.nameText, { color: theme.colors.onSurface }]}>
                {name}
              </Text>
            </Pressable>
          )}
          <IconButton icon="pencil-outline" size={20} onPress={() => setIsEditingName(true)} />
          <IconButton icon="delete-outline" size={20} iconColor={theme.colors.error} onPress={handleDelete} />
        </View>

        {/* Quantity row */}
        <View style={localStyles.quantityRow}>
          <Text style={[localStyles.label, { color: theme.colors.onSurfaceVariant }]}>
            Quantidade
          </Text>
          <View style={localStyles.quantityControls}>
            <Pressable
              onPress={() => updateInventoryItemQuantity(Math.max(0, liveQuantity - 1))}
              onLongPress={() => startContinuousAdjustment(false)}
              onPressOut={stopContinuousAdjustment}
              style={[localStyles.qtyButton, { borderColor: theme.colors.outline }]}
            >
              <MaterialCommunityIcons name="minus" size={20} color={theme.colors.primary} />
            </Pressable>
            <RNTextInput
              value={quantityInput}
              onChangeText={setQuantityInput}
              onBlur={() => updateInventoryItemQuantity(parseInt(quantityInput) || 0)}
              keyboardType="numeric"
              style={[localStyles.qtyInput, { 
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline,
              }]}
            />
            <Pressable
              onPress={() => updateInventoryItemQuantity(liveQuantity + 1)}
              onLongPress={() => startContinuousAdjustment(true)}
              onPressOut={stopContinuousAdjustment}
              style={[localStyles.qtyButton, { borderColor: theme.colors.outline }]}
            >
              <MaterialCommunityIcons name="plus" size={20} color={theme.colors.primary} />
            </Pressable>

            {/* Price + shopping list inline */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <MaterialCommunityIcons name="currency-usd" size={16} color={theme.colors.onSurfaceVariant} />
              {editingPrice ? (
                <RNTextInput
                  value={priceInput}
                  onChangeText={setPriceInput}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={handlePriceSave}
                  style={[localStyles.priceInput, { 
                    color: theme.colors.onSurface,
                    borderBottomColor: theme.colors.primary,
                  }]}
                />
              ) : (
                <Pressable onPress={() => setEditingPrice(true)}>
                  <Text style={{ color: theme.colors.onSurface, fontSize: 14 }}>
                    {suggestedPrice > 0 ? formatCurrency(suggestedPrice) : '—'}
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={handleToggleShoppingList}>
                <MaterialCommunityIcons
                  name={shoppingListItem ? 'cart-check' : 'cart-plus'}
                  size={22}
                  color={shoppingListItem ? theme.colors.primary : theme.colors.onSurfaceVariant}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Category + List chips */}
        <View style={localStyles.chipsRow}>
          <Chip
            icon="tag-outline"
            onPress={() => setCategoryModalVisible(true)}
            style={localStyles.chip}
            mode="outlined"
          >
            {categories.find(c => c.id === selectedCategoryId)?.name || 'Sem categoria'}
          </Chip>
          <Chip
            icon="format-list-bulleted"
            onPress={() => setListModalVisible(true)}
            style={localStyles.chip}
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
          style={[localStyles.notesInput, { 
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
          <View style={[localStyles.statsRow, { borderColor: theme.colors.outlineVariant }]}>
            {stats.avgWeeklyConsumption !== null && (
              <View style={localStyles.statItem}>
                <MaterialCommunityIcons name="trending-down" size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={[localStyles.statText, { color: theme.colors.onSurfaceVariant }]}>
                  ~{stats.avgWeeklyConsumption.toFixed(1)}/semana
                </Text>
              </View>
            )}
            {stats.avgPrice90d !== null && (
              <View style={localStyles.statItem}>
                <MaterialCommunityIcons name="tag-outline" size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={[localStyles.statText, { color: theme.colors.onSurfaceVariant }]}>
                  Média: {formatCurrency(stats.avgPrice90d)}
                </Text>
              </View>
            )}
            {stats.lowestPrice90d !== null && (
              <View style={localStyles.statItem}>
                <MaterialCommunityIcons name="sale" size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={[localStyles.statText, { color: theme.colors.onSurfaceVariant }]}>
                  Menor: {formatCurrency(stats.lowestPrice90d.price)} ({stats.lowestPrice90d.storeName})
                </Text>
              </View>
            )}
          </View>
        )}

        <Divider style={{ marginVertical: 16 }} />

        {/* Quantity history chart */}
        <Pressable
          onPress={() => setQuantityHistoryCollapsed(p => !p)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}
        >
          <Text variant="labelMedium" style={{ 
            color: theme.colors.onSurfaceVariant,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Histórico de Quantidades
          </Text>
          <MaterialCommunityIcons
            name={quantityHistoryCollapsed ? 'chevron-down' : 'chevron-up'}
            size={18}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
        {!quantityHistoryCollapsed && history.length > 1 && (
          <>
            <LineChart
              data={chartData}
              width={Dimensions.get('window').width - 32}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={{ borderRadius: 8, marginBottom: 12 }}
            />
            {history.map((item, index) => {
              const next = history[index + 1];
              const diff = next ? item.quantity - next.quantity : null;
              return (
                <View key={item.id} style={[localStyles.historyRow, { borderBottomColor: theme.colors.outlineVariant }]}>
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>
                    {formatDate(item.date)}
                  </Text>
                  <Text style={{ color: theme.colors.onSurface, fontSize: 13, fontWeight: '500' }}>
                    {item.quantity}
                  </Text>
                  {diff !== null && (
                    <Text style={{ 
                      fontSize: 12, 
                      color: diff > 0 ? theme.colors.error : diff < 0 ? '#4CAF50' : theme.colors.outline,
                      fontWeight: '600',
                    }}>
                      {diff > 0 ? `-${diff}` : diff < 0 ? `+${Math.abs(diff)}` : '—'}
                    </Text>
                  )}
                  {item.notes ? (
                    <Text style={{ color: theme.colors.outline, fontSize: 11, fontStyle: 'italic', flex: 1, textAlign: 'right' }}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
        {!quantityHistoryCollapsed && history.length <= 1 && (
          <Text style={{ color: theme.colors.outline, textAlign: 'center', marginVertical: 16 }}>
            Histórico insuficiente
          </Text>
        )}

        {/* Price history — collapsible */}
        <Pressable
          onPress={() => setPriceHistoryCollapsed(p => !p)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}
        >
          <Text variant="labelMedium" style={{ 
            color: theme.colors.onSurfaceVariant,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Histórico de Preços
          </Text>
          <MaterialCommunityIcons
            name={priceHistoryCollapsed ? 'chevron-down' : 'chevron-up'}
            size={18}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
        {!priceHistoryCollapsed && (
          <View>
            {priceHistory.length > 0 ? priceHistory.map((item, index) => (
              <View key={index} style={[localStyles.historyRow, { borderBottomColor: theme.colors.outlineVariant }]}>
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>
                  {formatFullDate(item.date)}
                </Text>
                <Text style={{ color: theme.colors.onSurface, fontSize: 13 }}>
                  {formatCurrency(item.price)}
                </Text>
                <Text style={{ color: theme.colors.outline, fontSize: 12, fontStyle: 'italic' }}>
                  {item.storeName || '—'}
                </Text>
              </View>
            )) : (
              <Text style={{ color: theme.colors.outline, textAlign: 'center', marginVertical: 16 }}>
                Nenhum histórico de preços
              </Text>
            )}
          </View>
        )}

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

// Helper to convert hex color to rgb for chart
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
    : '0, 0, 0';
}

const localStyles = StyleSheet.create({
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
  },
  nameInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingBottom: 4,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quantityRow: {
    marginBottom: 16,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyInput: {
    width: 64,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  priceInput: {
    fontSize: 15,
    borderBottomWidth: 2,
    minWidth: 80,
    paddingBottom: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 60,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
});