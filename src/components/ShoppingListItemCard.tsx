import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  Surface,
  Checkbox,
  IconButton,
  useTheme,
} from "react-native-paper";

export interface ShoppingListItemCardItem {
  id: number;
  quantity: number;
  checked: boolean;
  productName: string;
  currentInventoryQuantity: number;
  price?: number;
}

interface ShoppingListItemCardProps {
  item: ShoppingListItemCardItem;
  onToggleChecked: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function ShoppingListItemCard({
  item,
  onToggleChecked,
  onDelete,
  onEdit,
}: ShoppingListItemCardProps) {
  const theme = useTheme();

  const formatCurrency = (value: number) => {
    return `R$ ${value ? value.toFixed(2).replace(".", ",") : "0,00"}`;
  };

  const itemTotal = item.price ? formatCurrency(item.quantity * item.price) : null;

  return (
    <Pressable onPress={onEdit}>
      <Surface style={cardStyles.card}>
        <View style={cardStyles.row}>
          {/* Checkbox with large hitSlop */}
          <Pressable
            onPress={onToggleChecked}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <Checkbox status={item.checked ? 'checked' : 'unchecked'} />
          </Pressable>

          {/* Name — left, takes remaining space */}
          <Text
            style={[
              cardStyles.name,
              { color: theme.colors.onSurface },
              item.checked && { textDecorationLine: 'line-through', color: theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={1}
          >
            {item.productName}
          </Text>

          {/* Right column: qty+price top, total middle, stock bottom */}
          <View style={cardStyles.rightCol}>
            <Text style={[cardStyles.detail, { color: theme.colors.onSurfaceVariant }]}>
              {item.quantity}× {item.price ? formatCurrency(item.price) : '—'}
            </Text>
            {itemTotal && item.checked && (
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
            onPress={onDelete}
            iconColor={theme.colors.onSurfaceVariant}
            style={{ margin: 0 }}
          />
        </View>
      </Surface>
    </Pressable>
  );
}

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
  detail: {
    fontSize: 13,
  },
  total: {
    fontSize: 13,
    fontWeight: '600',
  },
  stock: {
    fontSize: 11,
  },
});
