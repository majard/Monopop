import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { Text, Card, Surface, Chip, IconButton, useTheme, Divider } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { useListContext } from '../context/ListContext';
import { useListData } from '../context/ListDataContext';
import { useList } from '../hooks/useList';
import ContextualHeader from '../components/ContextualHeader';
import SearchBar from '../components/SearchBar';
import { Invoice, InventoryItem } from '../database/models';
import { getDb } from '../database/database';
import { preprocessName, calculateSimilarity } from '../utils/similarityUtils';

type HistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type HistoryEvent =
  | { type: 'purchase'; id: number; date: string; store: string; total: number; items: InvoiceItemDetail[] }
  | { type: 'inventory'; id: number; date: string; changes: InventoryChange[] };

interface InvoiceItemDetail {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
  productId: number;
}

interface InventoryChange {
  id: number;
  productName: string;
  previousQuantity: number;
  currentQuantity: number;
  change: number;
  productId: number;
}

interface MonthSummary {
  totalSpent: number;
  mostUsedStore: string | null;
  purchaseCount: number;
}

export default function HistoryScreen() {
  const { listId } = useListContext();
  const { listName, handleListNameSave, handleListDelete } = useList(listId);
  const { findByProductId, inventoryItems } = useListData();
  const navigation = useNavigation<HistoryScreenNavigationProp>();
  const theme = useTheme();

  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [monthSummary, setMonthSummary] = useState<MonthSummary>({ totalSpent: 0, mostUsedStore: null, purchaseCount: 0 });
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'month' | 'week'>('all');

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
  const formatDate = (dateString: string) =>
    format(parseISO(dateString), "dd 'de' MMM yyyy", { locale: ptBR });

  // Fuzzy search on inventory items
  const matchedProductIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const threshold = 0.4;
    const processedQuery = preprocessName(searchQuery);
    const matched = inventoryItems.filter((item: InventoryItem) => {
      const name = preprocessName(item.productName);
      if (!processedQuery) return true;
      if (processedQuery.length < Math.ceil(name.length * 0.5)) return name.includes(processedQuery);
      return calculateSimilarity(name, processedQuery) >= threshold;
    });
    return new Set(matched.map((i: InventoryItem) => i.productId));
  }, [inventoryItems, searchQuery]);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Period filter
    const now = new Date();
    if (selectedPeriod === 'month') {
      result = result.filter(e => {
        const d = parseISO(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (selectedPeriod === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(e => parseISO(e.date) >= oneWeekAgo);
    }

    // Search filter
    if (matchedProductIds) {
      result = result.filter(e => {
        if (e.type === 'purchase') {
          return e.store.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.items.some(item => matchedProductIds.has(item.productId));
        }
        return e.changes.some(c => matchedProductIds.has(c.productId));
      });
    }

    return result;
  }, [events, selectedPeriod, matchedProductIds, searchQuery]);

  const loadHistory = useCallback(async () => {
    try {
      const db = getDb();

      // Load purchases
      const invoices = await db.getAllAsync<Invoice & { storeName: string }>(
        `SELECT i.*, s.name as storeName
         FROM invoices i
         JOIN stores s ON i.storeId = s.id
         WHERE i.listId = ?
         ORDER BY i.createdAt DESC`,
        [listId]
      );

      const purchaseEvents: Extract<HistoryEvent, { type: 'purchase' }>[] = await Promise.all(
        invoices.map(async (invoice) => {
          const items = await db.getAllAsync<InvoiceItemDetail>(
            `SELECT ii.*, p.name as productName
             FROM invoice_items ii
             JOIN products p ON ii.productId = p.id
             WHERE ii.invoiceId = ?`,
            [invoice.id]
          );
          return { type: 'purchase', id: invoice.id, date: invoice.createdAt, store: invoice.storeName, total: invoice.total, items };
        })
      );

      // Fix N+1: use LAG via self-join to get previous quantity in one query
      const inventoryHistory = await db.getAllAsync<{
        date: string;
        inventoryItemId: number;
        quantity: number;
        prevQuantity: number | null;
        productName: string;
        productId: number;
      }>(
        `SELECT
           ih.date,
           ih.inventoryItemId,
           ih.quantity,
           prev.quantity as prevQuantity,
           p.name as productName,
           p.id as productId
         FROM inventory_history ih
         JOIN inventory_items ii ON ih.inventoryItemId = ii.id
         JOIN products p ON ii.productId = p.id
         LEFT JOIN inventory_history prev ON prev.inventoryItemId = ih.inventoryItemId
           AND prev.date = (
             SELECT MAX(date) FROM inventory_history
             WHERE inventoryItemId = ih.inventoryItemId AND date < ih.date
           )
         WHERE ii.listId = ?
           AND (ih.notes IS NULL OR (ih.notes NOT LIKE '%Comprou%' AND ih.notes NOT LIKE '%Purchased%'))
         ORDER BY ih.date DESC`,
        [listId]
      );

      // Group by date
      const inventoryEventsMap = new Map<string, InventoryChange[]>();
      for (const entry of inventoryHistory) {
        const previousQuantity = entry.prevQuantity ?? 0;
        const change = entry.quantity - previousQuantity;
        if (change === 0) continue;
        if (!inventoryEventsMap.has(entry.date)) inventoryEventsMap.set(entry.date, []);
        inventoryEventsMap.get(entry.date)!.push({
          id: entry.inventoryItemId,
          productName: entry.productName,
          previousQuantity,
          currentQuantity: entry.quantity,
          change,
          productId: entry.productId,
        });
      }

      const inventoryEvents: HistoryEvent[] = Array.from(inventoryEventsMap.entries())
        .filter(([, changes]) => changes.length > 0)
        .map(([date, changes], index) => ({
          type: 'inventory' as const,
          id: 1000000 + index,
          date: date.includes('T') ? date : date + 'T00:00:00',
          changes,
        }));

      const allEvents = [...purchaseEvents, ...inventoryEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setEvents(allEvents);

      // Month summary
      const now = new Date();
      const thisMonth = purchaseEvents.filter(e => {
        const d = parseISO(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });

      const storeCount = new Map<string, number>();
      thisMonth.forEach(e => storeCount.set(e.store, (storeCount.get(e.store) || 0) + 1));

      let mostUsedStore: string | null = null;
      let maxCount = 0;
      storeCount.forEach((count, store) => { if (count > maxCount) { maxCount = count; mostUsedStore = store; } });

      setMonthSummary({
        totalSpent: thisMonth.reduce((s, e) => s + e.total, 0),
        mostUsedStore,
        purchaseCount: thisMonth.length,
      });
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }, [listId]);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const toggleExpand = useCallback((id: number) => {
    setExpandedEventId(prev => prev === id ? null : id);
  }, []);

  const handleItemPress = useCallback((productId: number) => {
    const item = findByProductId(productId);
    if (item) navigation.navigate('EditInventoryItem', { inventoryItem: item });
  }, [findByProductId, navigation]);

  const renderEvent = useCallback(({ item }: { item: HistoryEvent }) => {
    const isExpanded = expandedEventId === item.id;

    if (item.type === 'purchase') {
      return (
        <Surface style={[localStyles.card, { backgroundColor: theme.colors.surface }]}>
          <Pressable onPress={() => toggleExpand(item.id)} style={localStyles.cardHeader}>
            <View style={localStyles.cardHeaderLeft}>
              <MaterialCommunityIcons name="cart-outline" size={16} color={theme.colors.primary} />
              <View style={{ marginLeft: 8 }}>
                <Text style={[localStyles.cardDate, { color: theme.colors.onSurface }]}>
                  {formatDate(item.date)}
                </Text>
                <Text style={[localStyles.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {item.store}
                </Text>
              </View>
            </View>
            <View style={localStyles.cardHeaderRight}>
              <Text style={[localStyles.totalValue, { color: theme.colors.primary }]}>
                {formatCurrency(item.total)}
              </Text>
              <MaterialCommunityIcons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          </Pressable>

          <Text style={[localStyles.countLabel, { color: theme.colors.onSurfaceVariant }]}>
            {item.items.length} {item.items.length === 1 ? 'item' : 'itens'}
          </Text>

          {isExpanded && (
            <>
              <Divider style={{ marginVertical: 8 }} />
              {item.items.map(listItem => (
                <Pressable
                  key={listItem.id}
                  style={localStyles.itemRow}
                  onPress={() => handleItemPress(listItem.productId)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[localStyles.itemName, { color: theme.colors.onSurface }]}>
                      {listItem.productName}
                    </Text>
                    <Text style={[localStyles.itemDetail, { color: theme.colors.onSurfaceVariant }]}>
                      {listItem.quantity}× {listItem.unitPrice ? formatCurrency(listItem.unitPrice) : '—'}
                    </Text>
                  </View>
                  <Text style={[localStyles.itemTotal, { color: theme.colors.onSurface }]}>
                    {formatCurrency(listItem.lineTotal)}
                  </Text>
                </Pressable>
              ))}
            </>
          )}
        </Surface>
      );
    }

    return (
      <Surface style={[localStyles.card, { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.secondary, borderLeftWidth: 3 }]}>
        <Pressable onPress={() => toggleExpand(item.id)} style={localStyles.cardHeader}>
          <View style={localStyles.cardHeaderLeft}>
            <MaterialCommunityIcons name="package-variant" size={16} color={theme.colors.secondary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={[localStyles.cardDate, { color: theme.colors.onSurface }]}>
                {formatDate(item.date)}
              </Text>
              <Text style={[localStyles.cardSubtitle, { color: theme.colors.secondary }]}>
                Estoque atualizado
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>

        <Text style={[localStyles.countLabel, { color: theme.colors.onSurfaceVariant }]}>
          {item.changes.length} {item.changes.length === 1 ? 'alteração' : 'alterações'}
        </Text>

        {isExpanded && (
          <>
            <Divider style={{ marginVertical: 8 }} />
            {item.changes.map(change => (
              <Pressable
                key={change.id}
                style={localStyles.itemRow}
                onPress={() => handleItemPress(change.productId)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[localStyles.itemName, { color: theme.colors.onSurface }]}>
                    {change.productName}
                  </Text>
                  <Text style={[localStyles.itemDetail, { color: theme.colors.onSurfaceVariant }]}>
                    {change.previousQuantity} → {change.currentQuantity}
                  </Text>
                </View>
                <View style={[
                  localStyles.changeBadge,
                  { backgroundColor: change.change > 0 ? theme.colors.primaryContainer : theme.colors.errorContainer }
                ]}>
                  <Text style={[localStyles.changeText, {
                    color: change.change > 0 ? theme.colors.primary : theme.colors.error
                  }]}>
                    {change.change > 0 ? '+' : ''}{change.change}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </Surface>
    );
  }, [expandedEventId, theme, toggleExpand, handleItemPress]);

  return (
    <SafeAreaView style={[localStyles.container, { backgroundColor: theme.colors.background }]}>
      <ContextualHeader
        listName={listName}
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />

      {/* Month Summary */}
      <Surface style={[localStyles.summaryCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[localStyles.summaryTitle, { color: theme.colors.onSurface }]}>Este mês</Text>
        <View style={localStyles.summaryRow}>
          <View style={localStyles.summaryItem}>
            <Text style={[localStyles.summaryValue, { color: theme.colors.primary }]}>
              {formatCurrency(monthSummary.totalSpent)}
            </Text>
            <Text style={[localStyles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
              Total gasto
            </Text>
          </View>
          <View style={localStyles.summaryItem}>
            <Text style={[localStyles.summaryValue, { color: theme.colors.primary }]}>
              {monthSummary.purchaseCount}
            </Text>
            <Text style={[localStyles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
              Compras
            </Text>
          </View>
          <View style={localStyles.summaryItem}>
            <Text style={[localStyles.summaryValue, { color: theme.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {monthSummary.mostUsedStore || '—'}
            </Text>
            <Text style={[localStyles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
              Loja principal
            </Text>
          </View>
        </View>
      </Surface>

      {/* Filters */}
      <View style={[localStyles.filterRow, { borderBottomColor: theme.colors.outlineVariant }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {(['all', 'month', 'week'] as const).map(period => (
            <Chip
              key={period}
              selected={selectedPeriod === period}
              onPress={() => setSelectedPeriod(period)}
              style={{ marginRight: 8 }}
              compact
            >
              {period === 'all' ? 'Tudo' : period === 'month' ? 'Este mês' : 'Esta semana'}
            </Chip>
          ))}
        </ScrollView>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder="Buscar por produto ou loja..."
        />
      </View>

      {filteredEvents.length === 0 ? (
        <View style={localStyles.emptyState}>
          <MaterialCommunityIcons name="history" size={48} color={theme.colors.onSurfaceVariant} />
          <Text style={[localStyles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}>
            Nenhum histórico encontrado
          </Text>
          <Text style={[localStyles.emptySubtitle, { color: theme.colors.outline }]}>
            Suas compras e atualizações de estoque aparecerão aqui
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          renderItem={renderEvent}
          keyExtractor={item => `${item.type}-${item.id}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1 },
  summaryCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  summaryTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  summaryLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  card: {
    marginBottom: 10,
    borderRadius: 10,
    elevation: 1,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDate: { fontSize: 15, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, marginTop: 2 },
  totalValue: { fontSize: 16, fontWeight: 'bold' },
  countLabel: { fontSize: 12, marginTop: 6 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemDetail: { fontSize: 12, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '600' },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  changeText: { fontSize: 13, fontWeight: 'bold' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
});