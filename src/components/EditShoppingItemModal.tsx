import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import {
  Modal,
  Portal,
  Text,
  TextInput,
  Button,
  IconButton,
  useTheme,
  Surface,
} from "react-native-paper";

interface EditShoppingItemModalProps {
  visible: boolean;
  item: {
    id: number;
    productName: string;
    quantity: number;
    price?: number;
  } | null;
  onSave: (quantity: number, price: number | undefined) => void;
  onDismiss: () => void;
}

export function EditShoppingItemModal({
  visible,
  item,
  onSave,
  onDismiss,
}: EditShoppingItemModalProps) {
  const theme = useTheme();
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity);
      setPrice(item.price ? item.price.toString() : "");
    }
  }, [item]);

  const handleSave = () => {
    const priceValue = price.trim() ? parseFloat(price.replace(",", ".")) : undefined;
    onSave(quantity, priceValue);
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  const totalPreview = price.trim()
    ? formatCurrency(quantity * parseFloat(price.replace(",", ".")))
    : null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <Surface style={styles.surface}>
          <Text style={styles.title}>{item?.productName}</Text>

          <View style={styles.section}>
            <Text style={styles.label}>Quantidade</Text>
            <View style={styles.quantityRow}>
              <IconButton
                icon="minus"
                size={24}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              />
              <TextInput
                mode="outlined"
                value={quantity.toString()}
                onChangeText={(value) => {
                  const num = parseInt(value, 10);
                  setQuantity(isNaN(num) ? 1 : Math.max(1, num));
                }}
                keyboardType="numeric"
                style={styles.quantityInput}
              />
              <IconButton
                icon="plus"
                size={24}
                onPress={() => setQuantity(quantity + 1)}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Preço unitário (opcional)</Text>
            <TextInput
              mode="outlined"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="R$ 0,00"
              style={styles.priceInput}
            />
          </View>

          {totalPreview && (
            <View style={styles.totalPreview}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{totalPreview}</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button onPress={onDismiss} style={styles.button}>
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.button}
            >
              Salvar
            </Button>
          </View>
        </Surface>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  surface: {
    padding: 24,
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityInput: {
    width: 80,
    textAlign: "center",
  },
  priceInput: {
    width: "100%",
  },
  totalPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    color: "#666",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2196F3",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  button: {
    marginLeft: 8,
  },
});
