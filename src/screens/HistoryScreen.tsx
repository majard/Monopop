import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import {
  Card,
  Searchbar,
  useTheme,
  Chip,
  IconButton,
  Button,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RootStackParamList } from '../types/navigation';
import { useListContext } from '../context/ListContext';
import { useListData } from '../context/ListDataContext';
import { useList } from '../hooks/useList';
import { SafeAreaView } from 'react-native-safe-area-context';
import ContextualHeader from '../components/ContextualHeader';
import { Invoice, InvoiceItem, InventoryItem } from '../database/models';
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
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<HistoryEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [monthSummary, setMonthSummary] = useState<MonthSummary>({ totalSpent: 0, mostUsedStore: null, purchaseCount: 0 });
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'month' | 'week'>('all');
  const navigation = useNavigation<HistoryScreenNavigationProp>();
  const theme = useTheme();
  
  // Use context data for fuzzy search and finding items
  const { findByProductId, inventoryItems } = useListData();
  
  // Local fuzzy search logic (same as useInventory)
  const filteredInventoryItems = useMemo(() => {
    const searchSimilarityThreshold = 0.4;
    const filtered = inventoryItems.filter((inventoryItem: InventoryItem) => {
      const processedInventoryItemName = preprocessName(inventoryItem.productName);
      const processedSearchQuery = preprocessName(searchQuery);

      if (!processedSearchQuery) {
        return true;
      }

      const nameLength = processedInventoryItemName.length;
      const queryLength = processedSearchQuery.length;
      const lengthThreshold = Math.ceil(nameLength * 0.5);

      if (queryLength < lengthThreshold) {
        return processedInventoryItemName.includes(processedSearchQuery);
      }

      const similarity = calculateSimilarity(processedInventoryItemName, processedSearchQuery);
      return similarity >= searchSimilarityThreshold;
    });
    return filtered;
  }, [inventoryItems, searchQuery]);

  const loadHistory = async () => {
    try {
      const db = getDb();
      
      // Load invoices (purchases) for this list
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
          
          return {
            type: 'purchase',
            id: invoice.id,
            date: invoice.createdAt,
            store: invoice.storeName,
            total: invoice.total,
            items,
          };
        })
      );

      // Load inventory save events - group by date (exclude purchase-related entries)
      const inventoryHistory = await db.getAllAsync<{
        date: string;
        inventoryItemId: number;
        quantity: number;
        notes: string | null;
        productName: string;
        productId: number;
      }>(
        `SELECT ih.date, ih.inventoryItemId, ih.quantity, ih.notes, p.name as productName, p.id as productId
         FROM inventory_history ih
         JOIN inventory_items ii ON ih.inventoryItemId = ii.id
         JOIN products p ON ii.productId = p.id
         WHERE ii.listId = ? AND (ih.notes IS NULL OR (ih.notes NOT LIKE '%Comprou%' AND ih.notes NOT LIKE '%Purchased%'))
         ORDER BY ih.date DESC`,
        [listId]
      );

      // Group inventory saves by date
      const inventoryEventsMap = new Map<string, InventoryChange[]>();
      
      for (const entry of inventoryHistory) {
        if (!inventoryEventsMap.has(entry.date)) {
          inventoryEventsMap.set(entry.date, []);
        }
        
        // Get previous quantity to calculate change
        const prevEntry = await db.getFirstAsync<{ quantity: number }>(
          `SELECT quantity FROM inventory_history 
           WHERE inventoryItemId = ? AND date < ? 
           ORDER BY date DESC LIMIT 1`,
          [entry.inventoryItemId, entry.date]
        );
        
        const previousQuantity = prevEntry?.quantity ?? 0;
        const change = entry.quantity - previousQuantity;
        
        if (change !== 0) {
          inventoryEventsMap.get(entry.date)!.push({
            id: entry.inventoryItemId,
            productName: entry.productName,
            previousQuantity,
            currentQuantity: entry.quantity,
            change,
            productId: entry.productId,
          });
        }
      }

      const inventoryEvents: HistoryEvent[] = Array.from(inventoryEventsMap.entries())
        .filter(([, changes]) => changes.length > 0)
        .map(([date, changes], index) => ({
          type: 'inventory' as const,
          id: 1000000 + index, // Unique ID for inventory events
          date: date.includes('T') ? date : date + 'T00:00:00',
          changes,
        }));

      // Combine and sort by date
      const allEvents: HistoryEvent[] = [...purchaseEvents, ...inventoryEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setEvents(allEvents);
      
      // Calculate month summary
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const thisMonthPurchases = purchaseEvents.filter(e => {
        const date = parseISO(e.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });

      const totalSpent = thisMonthPurchases.reduce((sum, e) => sum + e.total, 0);
      
      const storeCount = new Map<string, number>();
      thisMonthPurchases.forEach(e => {
        storeCount.set(e.store, (storeCount.get(e.store) || 0) + 1);
      });
      
      let mostUsedStore: string | null = null;
      let maxCount = 0;
      storeCount.forEach((count, store) => {
        if (count > maxCount) {
          maxCount = count;
          mostUsedStore = store;
        }
      });

      setMonthSummary({
        totalSpent,
        mostUsedStore,
        purchaseCount: thisMonthPurchases.length,
      });

      applyFilter(allEvents, searchQuery, selectedPeriod);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const applyFilter = (allEvents: HistoryEvent[], query: string, period: 'all' | 'month' | 'week') => {
    let filtered = [...allEvents];
    
    // Apply period filter
    const now = new Date();
    if (period === 'month') {
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      filtered = filtered.filter(e => {
        const date = parseISO(e.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });
    } else if (period === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(e => parseISO(e.date) >= oneWeekAgo);
    }
    
    // Apply search filter using fuzzy matching from useInventory
    if (query.trim()) {
      // Get the set of product IDs that match the fuzzy search
      const matchedProductIds = new Set(filteredInventoryItems.map(item => item.productId));
      
      filtered = filtered.filter(e => {
        if (e.type === 'purchase') {
          return e.store.toLowerCase().includes(query.toLowerCase()) ||
            e.items.some(item => matchedProductIds.has(item.productId));
        } else {
          return e.changes.some(change => matchedProductIds.has(change.productId));
        }
      });
    }
    
    setFilteredEvents(filtered);
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [listId])
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilter(events, query, selectedPeriod);
  };

  const handlePeriodChange = (period: 'all' | 'month' | 'week') => {
    setSelectedPeriod(period);
    applyFilter(events, searchQuery, period);
  };

  const toggleExpand = (eventId: number) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
  
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return format(date, 'dd MMM yyyy', { locale: ptBR });
  };

  const handleItemPress = (productId: number) => {
    // Find full inventory item using findByProductId
    const inventoryItem = findByProductId(productId);
    if (inventoryItem) {
      navigation.navigate('EditInventoryItem', { inventoryItem });
    }
  };

  const renderEvent = ({ item }: { item: HistoryEvent }) => {
    const isExpanded = expandedEventId === item.id;
    
    if (item.type === 'purchase') {
      return (
        <Card style={styles.eventCard}>
          <TouchableOpacity onPress={() => toggleExpand(item.id)}>
            <Card.Content>
              <View style={styles.eventHeader}>
                <View>
                  <Text style={styles.eventDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.eventStore}>{item.store}</Text>
                </View>
                <View style={styles.eventTotal}>
                  <Text style={styles.totalValue}>{formatCurrency(item.total)}</Text>
                  <IconButton
                    icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    style={styles.expandIcon}
                  />
                </View>
              </View>
              <Text style={styles.itemCount}>{item.items.length} itens</Text>
            </Card.Content>
          </TouchableOpacity>
          
          {isExpanded && (
            <Card.Content style={styles.expandedContent}>
              {item.items.map((listItem) => (
                <TouchableOpacity
                  key={listItem.id}
                  style={styles.itemRow}
                  onPress={() => handleItemPress(listItem.productId)}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{listItem.productName}</Text>
                    <Text style={styles.itemDetail}>
                      {listItem.quantity}x {listItem.unitPrice ? formatCurrency(listItem.unitPrice) : 'Preço não informado'}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatCurrency(listItem.lineTotal)}</Text>
                </TouchableOpacity>
              ))}
            </Card.Content>
          )}
        </Card>
      );
    } else {
      // Inventory event
      return (
        <Card style={[styles.eventCard, styles.inventoryCard]}>
          <TouchableOpacity onPress={() => toggleExpand(item.id)}>
            <Card.Content>
              <View style={styles.eventHeader}>
                <View>
                  <Text style={styles.eventDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.inventoryLabel}>Salvamento de Estoque</Text>
                </View>
                <IconButton
                  icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  style={styles.expandIcon}
                />
              </View>
              <Text style={styles.itemCount}>{item.changes.length} alterações</Text>
            </Card.Content>
          </TouchableOpacity>
          
          {isExpanded && (
            <Card.Content style={styles.expandedContent}>
              {item.changes.map((change) => (
                <TouchableOpacity
                  key={change.id}
                  style={styles.itemRow}
                  onPress={() => handleItemPress(change.productId)}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{change.productName}</Text>
                    <Text style={styles.itemDetail}>
                      {change.previousQuantity} → {change.currentQuantity}
                    </Text>
                  </View>
                  <View style={[styles.changeBadge, change.change > 0 ? styles.increase : styles.decrease]}>
                    <Text style={styles.changeText}>
                      {change.change > 0 ? '+' : ''}{change.change}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Card.Content>
          )}
        </Card>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ContextualHeader 
        listName={listName}
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />
      
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Este Mês</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatCurrency(monthSummary.totalSpent)}</Text>
            <Text style={styles.summaryLabel}>Total Gasto</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{monthSummary.purchaseCount}</Text>
            <Text style={styles.summaryLabel}>Compras</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {monthSummary.mostUsedStore || '-'}
            </Text>
            <Text style={styles.summaryLabel}>Loja Principal</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodFilter}>
          <Chip
            selected={selectedPeriod === 'all'}
            onPress={() => handlePeriodChange('all')}
            style={styles.chip}
          >
            Tudo
          </Chip>
          <Chip
            selected={selectedPeriod === 'month'}
            onPress={() => handlePeriodChange('month')}
            style={styles.chip}
          >
            Este Mês
          </Chip>
          <Chip
            selected={selectedPeriod === 'week'}
            onPress={() => handlePeriodChange('week')}
            style={styles.chip}
          >
            Esta Semana
          </Chip>
        </ScrollView>
        
        <Searchbar
          placeholder="Buscar por produto, loja..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      {filteredEvents.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Nenhum histórico encontrado</Text>
          <Text style={styles.emptyStateSubtext}>
            Suas compras e salvamentos de estoque aparecerão aqui
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          renderItem={renderEvent}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filterSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  periodFilter: {
    marginBottom: 12,
  },
  chip: {
    marginRight: 8,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  eventCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  inventoryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eventDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  eventStore: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  inventoryLabel: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 2,
    fontWeight: '500',
  },
  eventTotal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  expandIcon: {
    margin: 0,
    marginLeft: 4,
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 12,
    paddingTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    color: '#333',
  },
  itemDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  increase: {
    backgroundColor: '#E8F5E9',
  },
  decrease: {
    backgroundColor: '#FFEBEE',
  },
  changeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
