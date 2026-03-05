import React, { useState, useCallback } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SortOrder } from '../utils/sortUtils';

type SortMenuMode = 'inventoryItem' | 'product' | 'shoppingList';

interface SortOption {
  label: string;
  value: SortOrder;
  icon: string;
}

const INVENTORY_ITEM_OPTIONS: SortOption[] = [
  { label: 'Ordem Personalizada', value: 'custom', icon: 'drag-horizontal-variant' },
  { label: 'Alfabética', value: 'alphabetical', icon: 'sort-alphabetical-ascending' },
  { label: 'Por Categoria', value: 'category', icon: 'tag-outline' },
  { label: 'Quantidade (Maior Primeiro)', value: 'quantityDesc', icon: 'sort-numeric-descending' },
  { label: 'Quantidade (Menor Primeiro)', value: 'quantityAsc', icon: 'sort-numeric-ascending' },
];

const SHOPPING_LIST_OPTIONS: SortOption[] = [
  { label: 'Alfabética', value: 'alphabetical', icon: 'sort-alphabetical-ascending' },
  { label: 'Por Categoria', value: 'category', icon: 'tag-outline' },
  { label: 'Qtd. desejada (maior)', value: 'quantityDesc', icon: 'sort-numeric-descending' },
  { label: 'Qtd. desejada (menor)', value: 'quantityAsc', icon: 'sort-numeric-ascending' },
  { label: 'Estoque (menor primeiro)', value: 'stockAsc', icon: 'warehouse' },
  { label: 'Estoque (maior primeiro)', value: 'stockDesc', icon: 'warehouse' },
];

const PRODUCT_OPTIONS: SortOption[] = [
  { label: 'Alfabética', value: 'alphabetical', icon: 'sort-alphabetical-ascending' },
  { label: 'Por Categoria', value: 'category', icon: 'tag-outline' },
];

interface SortMenuProps {
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  mode?: SortMenuMode;
  iconOnly?: boolean;
}

export const SortMenu = ({ sortOrder, setSortOrder, mode = 'inventoryItem', iconOnly = false }: SortMenuProps) => {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();

  const options = mode === 'product'
    ? PRODUCT_OPTIONS
    : mode === 'shoppingList'
      ? SHOPPING_LIST_OPTIONS
      : INVENTORY_ITEM_OPTIONS;
  const activeOption = options.find(o => o.value === sortOrder) ?? options[0];
  const isDefault = sortOrder === options[0].value;

  const handleSelect = useCallback((order: SortOrder) => {
    setSortOrder(order);
    setVisible(false);
  }, [setSortOrder]);

  return (
    <>
      {iconOnly ? (
        <Pressable
          onPress={() => setVisible(true)}
          style={({ pressed }) => ({
            padding: 8,
            borderRadius: 20,
            backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent',
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <MaterialCommunityIcons
              name="sort"
              size={18}
              color={isDefault ? theme.colors.onSurfaceVariant : theme.colors.primary}
            />
            <MaterialCommunityIcons
              name={activeOption.icon as any}
              size={18}
              color={isDefault ? theme.colors.onSurfaceVariant : theme.colors.primary}
            />
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setVisible(true)}
          style={({ pressed }) => [
            styles.trigger,
            {
              backgroundColor: pressed
                ? theme.colors.surfaceVariant
                : theme.colors.surface,
              borderColor: theme.colors.outline,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="sort"
            size={16}
            color={theme.colors.primary}
          />
          <Text style={[styles.triggerText, { color: theme.colors.primary }]}>
            {activeOption.label}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={16}
            color={theme.colors.primary}
          />
        </Pressable>
      )}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setVisible(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface }
            ]}
            onPress={() => { }} // prevent backdrop dismiss when tapping sheet
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
            <Text variant="titleSmall" style={[styles.sheetTitle, { color: theme.colors.onSurfaceVariant }]}>
              Ordenar por
            </Text>
            {options.map((option) => {
              const isActive = sortOrder === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleSelect(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: isActive
                        ? theme.colors.primaryContainer
                        : pressed
                          ? theme.colors.surfaceVariant
                          : 'transparent',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={option.icon as any}
                    size={20}
                    color={isActive ? theme.colors.primary : theme.colors.onSurface}
                    style={styles.optionIcon}
                  />
                  <Text style={[
                    styles.optionLabel,
                    {
                      color: isActive ? theme.colors.primary : theme.colors.onSurface,
                      fontWeight: isActive ? '700' : '400',
                    }
                  ]}>
                    {option.label}
                  </Text>
                  {isActive && (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={theme.colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
  },
});