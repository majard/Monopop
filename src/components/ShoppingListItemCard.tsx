import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  Surface,
  IconButton,
  useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, runOnJS, interpolateColor } from 'react-native-reanimated';

export interface ShoppingListItemCardItem {
  id: number;
  quantity: number;
  checked: boolean;
  productName: string;
  currentInventoryQuantity: number;
  price?: number;
  showWarning: boolean;  // replaces lowestPrice90d
}

interface ShoppingListItemCardProps {
  item: ShoppingListItemCardItem;
  onToggleChecked: (item: ShoppingListItemCardItem) => void;
  onDelete: (item: ShoppingListItemCardItem) => void;
  onEdit: (item: ShoppingListItemCardItem) => void;
}

const formatCurrency = (value: number) => {
  return `R$ ${value ? value.toFixed(2).replace(".", ",") : "0,00"}`;
};

export const ShoppingListItemCard = React.memo(function ShoppingListItemCard({
  item,
  onToggleChecked,
  onDelete,
  onEdit,
}: ShoppingListItemCardProps) {
  const theme = useTheme();
  const [localChecked, setLocalChecked] = useState(item.checked);

  useEffect(() => {
    setLocalChecked(item.checked);
  }, [item.checked]);

  const progress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1, 2, 3],
      ['transparent', theme.colors.primaryContainer, theme.colors.primaryContainer, 'transparent']
    ),
    borderRadius: 8,
  }));

  const handleToggle = () => {
    if (!localChecked) {
      setLocalChecked(true);  // checkbox updates immediately
      progress.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(3, { duration: 100 }, () => runOnJS(onToggleChecked)(item))
      );
    } else {
      setLocalChecked(false);
      progress.value = withSequence(
        withTiming(1, { duration: 60 }),
        withTiming(3, { duration: 60 }, () => runOnJS(onToggleChecked)(item))
      );
    }
  };

  const itemTotal = item.price ? formatCurrency(item.quantity * item.price) : null;

  return (
    <Pressable onPress={() => onEdit(item)}>
      <Surface style={cardStyles.card}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, animatedStyle]}
          pointerEvents="none"
        />
        <View style={cardStyles.row}>
          {/* Checkbox with large hitSlop */}
          <Pressable
            onPress={handleToggle}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <MaterialCommunityIcons
              name={localChecked ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={localChecked ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          </Pressable>

          {/* Name — left, takes remaining space */}
          <Text
            style={[
              cardStyles.name,
              { color: theme.colors.onSurface },
              localChecked && { textDecorationLine: 'line-through', color: theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={1}
          >
            {item.productName}
          </Text>

          {/* Right column: qty+price top, total middle, stock bottom */}
          <View style={cardStyles.rightCol}>
            <View style={cardStyles.priceRow}>
              <Text style={[cardStyles.detail, { color: theme.colors.onSurfaceVariant }]}>
                {item.quantity}× {item.price ? formatCurrency(item.price) : '—'}
              </Text>
              {item.showWarning && (
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={14}
                  color="orange"
                  style={cardStyles.warningIcon}
                />
              )}
            </View>
            {itemTotal && localChecked && (
              <Text style={[cardStyles.total, { color: theme.colors.primary }]}>
                {itemTotal}
              </Text>
            )}
            <Text style={[cardStyles.stock, { color: theme.colors.outline }]}>
              estoque: {item.currentInventoryQuantity}
            </Text>
          </View>

          {/* Delete */}
          <IconButton
            icon="delete"
            size={18}
            onPress={() => onDelete(item)}
            iconColor={theme.colors.onSurfaceVariant}
            style={{ margin: 0 }}
          />
        </View>
      </Surface>
    </Pressable>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    marginBottom: 6,
    borderRadius: 8,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detail: {
    fontSize: 13,
  },
  warningIcon: {
    marginLeft: 2,
  },
  total: {
    fontSize: 13,
    fontWeight: '600',
  },
  stock: {
    fontSize: 11,
  },
});