import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { Text, Surface, Chip, IconButton, Divider, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { parseISO, format, isWithinInterval, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from 'date-fns';
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
import { DateRangePickerModal, DateRange } from '../components/DateRangePickerModal';

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

interface PeriodSummary {
  totalSpent: number;
  mostUsedStore: string | null;
  purchaseCount: number;
  label: string;
  trend: number | null;
  prevTotal: number;
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
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
  const formatDate = (dateString: string) =>
    format(parseISO(dateString), "dd 'de' MMM yyyy", { locale: ptBR });

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

    if (dateRange.start) {
      const start = startOfDay(dateRange.start);
      const end = endOfDay(dateRange.end ?? dateRange.start);
      result = result.filter(e => isWithinInterval(parseISO(e.date), { start, end }));
    }

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
  }, [events, dateRange, matchedProductIds, searchQuery]);

  // Summary reacts to the current filter
  const summary = useMemo((): PeriodSummary => {
    const purchases = filteredEvents.filter(e => e.type === 'purchase') as Extract<HistoryEvent, { type: 'purchase' }>[];
    const storeCount = new Map<string, number>();
    purchases.forEach(e => storeCount.set(e.store, (storeCount.get(e.store) || 0) + 1));

    let mostUsedStore: string | null = null;
    let maxCount = 0;
    storeCount.forEach((count, store) => { if (count > maxCount) { maxCount = count; mostUsedStore = store; } });

    let label = 'Todo o tempo';
    if (dateRange.start && dateRange.end) {
      label = `${format(dateRange.start, 'dd/MM')} – ${format(dateRange.end, 'dd/MM')}`;
    } else if (dateRange.start) {
      label = `A partir de ${format(dateRange.start, 'dd/MM')}`;
    }

    const totalSpent = purchases.reduce((s, e) => s + e.total, 0);

    // Determine previous period interval
    let prevStart: Date | null = null;
    let prevEnd: Date | null = null;

    if (dateRange.start) {
      const rangeMs = (endOfDay(dateRange.end ?? dateRange.start)).getTime() 
                    - startOfDay(dateRange.start).getTime();
      prevEnd = new Date(startOfDay(dateRange.start).getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - rangeMs);
    } else {
      // Default: current month vs previous month
      const now = new Date();
      prevStart = startOfMonth(subMonths(now, 1));
      prevEnd = endOfMonth(subMonths(now, 1));
    }

    const prevPurchases = events.filter(e => {
      if (e.type !== 'purchase') return false;
      const d = parseISO(e.date);
      return isWithinInterval(d, { start: prevStart!, end: prevEnd! });
    }) as Extract<HistoryEvent, { type: 'purchase' }>[];

    const prevTotal = prevPurchases.reduce((s, e) => s + e.total, 0);
    const trend = prevTotal > 0 ? ((totalSpent - prevTotal) / prevTotal) * 100 : null;

    return {
      totalSpent,
      mostUsedStore,
      purchaseCount: purchases.length,
      label,
      trend,
      prevTotal,
    };
  }, [filteredEvents, dateRange, events]);

  const loadHistory = useCallback(async () => {
    try {
      const db = getDb();

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

      const inventoryHistory = await db.getAllAsync<{
        date: string;
        inventoryItemId: number;
        quantity: number;
        prevQuantity: number | null;
        productName: string;
        productId: number;
      }>(
        `SELECT
           ih.date, ih.inventoryItemId, ih.quantity,
           prev.quantity as prevQuantity,
           p.name as productName, p.id as productId
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

      setEvents([...purchaseEvents, ...inventoryEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[localStyles.itemTotal, { color: theme.colors.onSurface }]}>
                      {formatCurrency(listItem.lineTotal)}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={14} color={theme.colors.outline} />
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </Surface>
      );
    }

    return (
      <Surface style={[localStyles.card, {
        backgroundColor: theme.colors.surface,
        borderLeftColor: theme.colors.secondary,
        borderLeftWidth: 3,
      }]}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
                  <MaterialCommunityIcons name="chevron-right" size={14} color={theme.colors.outline} />
                </View>
              </Pressable>
            ))}
          </>
        )}
      </Surface>
    );
  }, [expandedEventId, theme, toggleExpand, handleItemPress]);

  const hasActiveFilter = dateRange.start !== null;

  return (
    <SafeAreaView style={[localStyles.container, { backgroundColor: theme.colors.background }]}>
      <ContextualHeader
        listName={listName}
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />

      {/* Summary — reacts to active filter */}
      <Surface style={[localStyles.summaryCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[localStyles.summaryTitle, { color: theme.colors.onSurfaceVariant }]}>
          {summary.label}
        </Text>
        <View style={localStyles.summaryRow}>
          <View style={localStyles.summaryItem}>
            <Text style={[localStyles.summaryValue, { color: theme.colors.primary }]}>
              {formatCurrency(summary.totalSpent)}
            </Text>
            <Text style={[localStyles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
              Total gasto
            </Text>
          </View>
          <View style={localStyles.summaryItem}>
            <Text style={[localStyles.summaryValue, { color: theme.colors.primary }]}>
              {summary.purchaseCount}
            </Text>
            <Text style={[localStyles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
              Compras
            </Text>
          </View>
          <View style={localStyles.summaryItem}>
            <Text
              style={[localStyles.summaryValue, { color: theme.colors.primary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {summary.mostUsedStore || '—'}
            </Text>
            <Text style={[localStyles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
              Loja principal
            </Text>
          </View>
        </View>
        {summary.trend !== null && (
          <View style={[localStyles.trendRow, { borderTopColor: theme.colors.outlineVariant }]}>
            <MaterialCommunityIcons
              name={summary.trend > 0 ? 'trending-up' : summary.trend < 0 ? 'trending-down' : 'trending-neutral'}
              size={16}
              color={summary.trend > 0 ? theme.colors.error : theme.colors.primary}
            />
            <Text style={[localStyles.trendText, {
              color: summary.trend > 0 ? theme.colors.error : theme.colors.primary
            }]}>
              {summary.trend > 0 ? '+' : ''}{summary.trend.toFixed(1)}% vs período anterior
              {' '}({formatCurrency(summary.prevTotal)})
            </Text>
          </View>
        )}
      </Surface>

      {/* Filter bar */}
      <View style={[localStyles.filterRow, { borderBottomColor: theme.colors.outlineVariant }]}>

        <Pressable
          onPress={() => setDatePickerVisible(true)}
          style={[localStyles.dateButton, {
            borderColor: hasActiveFilter ? theme.colors.primary : theme.colors.outline,
            backgroundColor: hasActiveFilter ? theme.colors.primaryContainer : 'transparent',
          }]}
        >
          <MaterialCommunityIcons
            name="calendar-range"
            size={15}
            color={hasActiveFilter ? theme.colors.primary : theme.colors.onSurfaceVariant}
          />
          <Text style={[localStyles.dateButtonText, {
            color: hasActiveFilter ? theme.colors.primary : theme.colors.onSurfaceVariant,
          }]}>
            {hasActiveFilter
              ? `${format(dateRange.start!, 'dd/MM')}${dateRange.end ? ` → ${format(dateRange.end, 'dd/MM')}` : ''}`
              : 'Período'}
          </Text>
          {hasActiveFilter && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); setDateRange({ start: null, end: null }); }}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="close-circle" size={15} color={theme.colors.primary} />
            </Pressable>
          )}
        </Pressable>

        <View style={{ flex: 1 }}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Produto ou loja..."
          />
        </View>
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

      <DateRangePickerModal
        visible={datePickerVisible}
        value={dateRange}
        onConfirm={(range) => { setDateRange(range); setDatePickerVisible(false); }}
        onDismiss={() => setDatePickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1 },
  summaryCard: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  summaryLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateButtonText: { fontSize: 13 },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trendText: { fontSize: 12, fontWeight: '500' },
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