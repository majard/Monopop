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
      <Surface style={cardStyles.shoppingItemCard}>
        <View style={cardStyles.shoppingItemContent}>
          <View style={cardStyles.shoppingItemLeft}>
            <Checkbox
              status={item.checked ? "checked" : "unchecked"}
              onPress={onToggleChecked}
            />
            <View style={cardStyles.shoppingItemInfo}>
              <Text
                style={[
                  cardStyles.shoppingItemName,
                  item.checked && cardStyles.checkedItem,
                ]}
              >
                {item.productName}
              </Text>
              <View style={cardStyles.detailsRow}>
                <Text style={cardStyles.quantityText}>
                  Qtd: {item.quantity}
                </Text>
                {item.price !== undefined && (
                  <>
                    <Text style={cardStyles.separator}>•</Text>
                    <Text style={cardStyles.priceText}>
                      {formatCurrency(item.price)} un
                    </Text>
                  </>
                )}
              </View>
              {itemTotal && item.checked && (
                <Text style={cardStyles.totalText}>Total: {itemTotal}</Text>
              )}
              <Text style={cardStyles.stockLabel}>
                Estoque: {item.currentInventoryQuantity}
              </Text>
            </View>
          </View>
          <View style={cardStyles.shoppingItemActions}>
            <IconButton
              icon="pencil"
              size={20}
              onPress={onEdit}
              iconColor={theme.colors.primary}
            />
            <IconButton
              icon="delete"
              size={20}
              onPress={onDelete}
              iconColor={theme.colors.error}
            />
          </View>
        </View>
      </Surface>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  shoppingItemCard: {
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
  },
  shoppingItemContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  shoppingItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  shoppingItemInfo: {
    flex: 1,
    marginLeft: 8,
  },
  shoppingItemName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  checkedItem: {
    textDecorationLine: "line-through",
    color: "#888",
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  quantityText: {
    fontSize: 14,
    color: "#666",
  },
  priceText: {
    fontSize: 14,
    color: "#666",
  },
  separator: {
    fontSize: 14,
    color: "#999",
    marginHorizontal: 6,
  },
  totalText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2196F3",
    marginTop: 2,
  },
  stockLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  shoppingItemActions: {
    flexDirection: "row",
    alignItems: "center",
  },
});
