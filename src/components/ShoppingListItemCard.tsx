import { View, Text, StyleSheet } from "react-native";
import {
  TextInput as PaperTextInput,
  Surface,
  Checkbox,
  IconButton,
  useTheme,
} from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { useShoppingListItem } from "../hooks/useShoppingListItem";

export interface ShoppingListItemCardItem {
  id: number;
  quantity: number;
  checked: boolean;
  productName: string;
  currentInventoryQuantity: number;
}

interface ShoppingListItemCardProps {
  item: ShoppingListItemCardItem;
  onToggleChecked: () => void;
  onDelete: () => void;
}

export function ShoppingListItemCard({
  item,
  onToggleChecked,
  onDelete,
}: ShoppingListItemCardProps) {
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const {
    quantity,
    updateQuantity,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  } = useShoppingListItem({
    shoppingListItemId: item.id,
    initialQuantity: item.quantity,
  });

  return (
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
            <View style={styles.quantityContainer}>
              <View style={styles.quantityInputContainer}>
                <Text variant="bodyMedium">Quantidade: </Text>
                <PaperTextInput
                  mode="outlined"
                  dense
                  value={quantity.toString()}
                  onChangeText={(value) =>
                    updateQuantity(value === "" ? 1 : parseInt(value, 10))
                  }
                  keyboardType="numeric"
                  style={styles.input}
                  testID={`quantity-text-input-shopping-${item.id}`}
                />
              </View>
              <View style={styles.quantityButtons}>
                <IconButton
                  icon="minus"
                  size={20}
                  onPress={() => updateQuantity(Math.max(1, quantity - 1))}
                  onLongPress={() => startContinuousAdjustment(false)}
                  onPressOut={stopContinuousAdjustment}
                />
                <IconButton
                  icon="plus"
                  size={20}
                  onPress={() => updateQuantity(quantity + 1)}
                  onLongPress={() => startContinuousAdjustment(true)}
                  onPressOut={stopContinuousAdjustment}
                  testID={`increment-button-shopping-${item.id}`}
                />
              </View>
            </View>
            <Text style={cardStyles.stockLabel}>
              Estoque: {item.currentInventoryQuantity}
            </Text>
          </View>
        </View>
        <View style={cardStyles.shoppingItemActions}>
          <IconButton
            icon="delete"
            size={20}
            onPress={onDelete}
          />
        </View>
      </View>
    </Surface>
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
  stockLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  shoppingItemActions: {
    flexDirection: "row",
  },
});
