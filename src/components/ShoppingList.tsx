import React, { useState, useCallback, useMemo } from 'react';
import { SectionList, FlatList, Pressable, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ShoppingListItemCard } from './ShoppingListItemCard';
import { SortOrder } from '../utils/sortUtils';

export interface ShoppingListItem {
  id: number;
  quantity: number;
  checked: boolean;
  productName: string;
  productId: number;
  inventoryItemId: number;
  currentInventoryQuantity: number;
  price?: number;
  categoryName?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ShoppingListProps {
  items: ShoppingListItem[];
  sortOrder: SortOrder;
  onToggleChecked: (item: ShoppingListItem) => void;
  onDelete: (item: ShoppingListItem) => void;
  onEdit: (item: ShoppingListItem) => void;
}

export default function ShoppingList({
  items,
  sortOrder,
  onToggleChecked,
  onDelete,
  onEdit,
}: ShoppingListProps) {
  const theme = useTheme();
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const categorySections = useMemo(() => {
    const grouped = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const key = item.categoryName ?? 'Sem categoria';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
    return Array.from(grouped.entries()).map(([title, data]) => ({ title, data }));
  }, [items]);

  const renderItem = useCallback((item: ShoppingListItem) => (
    <ShoppingListItemCard
      item={item}
      onToggleChecked={() => onToggleChecked(item)}
      onDelete={() => onDelete(item)}
      onEdit={() => onEdit(item)}
    />
  ), [onToggleChecked, onDelete, onEdit]);

  if (sortOrder === 'category') {
    return (
      <SectionList
        sections={categorySections.map(s => ({
          ...s,
          data: collapsedCategories.has(s.title) ? [] : s.data,
        }))}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => renderItem(item)}
        scrollEnabled={false}
        renderSectionHeader={({ section }) => {
          const fullCount = categorySections.find(s => s.title === section.title)?.data.length ?? 0;
          const isCollapsed = collapsedCategories.has(section.title);
          return (
            <Pressable
              onPress={() => toggleCategory(section.title)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: theme.colors.surfaceVariant,
                borderRadius: 8,
                marginBottom: 4,
                marginTop: 6,
              }}
            >
              <Text style={{
                color: theme.colors.onSurfaceVariant,
                textTransform: 'uppercase',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.8,
              }}>
                {section.title} ({fullCount})
              </Text>
              <MaterialCommunityIcons
                name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            </Pressable>
          );
        }}
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => renderItem(item)}
      scrollEnabled={false}
    />
  );
}
