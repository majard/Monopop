import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, TextInput as RNTextInput } from "react-native";
import {
  Modal,
  Portal,
  Surface,
  Text,
  Button,
  Chip,
  useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SearchablePickerDialog } from './SearchablePickerDialog';

interface EditShoppingItemModalProps {
  visible: boolean;
  item: {
    id: number;
    productName: string;
    quantity: number;
    price?: number;
    checked: boolean;
    currentInventoryQuantity: number;
    categoryName?: string | null;
    lowestPrice90d: { price: number; storeName: string } | null;
  } | null;
  onSave: (quantity: number, price: number | undefined) => void;
  onToggleChecked: () => void;
  onDelete: () => void;
  onDismiss: () => void;
  onCategoryChange: () => void;
  categories: { id: number; name: string }[];
  onCategorySelect: (categoryId: number) => void;
}

export function EditShoppingItemModal({
  visible,
  item,
  onSave,
  onToggleChecked,
  onDelete,
  onDismiss,
  onCategoryChange,
  categories,
  onCategorySelect,
}: EditShoppingItemModalProps) {
  const theme = useTheme();
  const [quantity, setQuantity] = useState(1);
  const [priceInput, setPriceInput] = useState("");
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity);
      setPriceInput(item.price ? item.price.toFixed(2).replace('.', ',') : "");
      setChecked(item.checked);
    }
  }, [item]);

  const handleSave = () => {
    const parsedPrice = priceInput.trim() ? parseFloat(priceInput.replace(",", ".")) : undefined;
    onSave(quantity, parsedPrice);
    if (checked !== item?.checked) {
      onToggleChecked();
    }
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  const parsedPrice = priceInput.trim() ? parseFloat(priceInput.replace(",", ".")) : null;
  const totalPreview = parsedPrice && parsedPrice > 0 ? formatCurrency(quantity * parsedPrice) : null;
  
  // Find category ID from categories list based on categoryName
  const selectedCategoryId = item?.categoryName ? categories.find(cat => cat.name === item.categoryName)?.id : undefined;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <Surface style={styles.surface}>
          {/* HEADER ROW */}
          <View style={styles.headerRow}>
            <Text style={styles.productName}>{item?.productName}</Text>
            <Chip
              icon="tag-outline"
              mode="outlined"
              onPress={() => setCategoryModalVisible(true)}
              compact
              textStyle={styles.categoryChipText}
            >
              {item?.categoryName ?? 'Sem categoria'}
            </Chip>
          </View>

          {/* CONTEXT ROW */}
          <View style={styles.contextRow}>
            <View style={styles.contextLeft}>
              <MaterialCommunityIcons
                name="package-variant"
                size={13}
                color={theme.colors.onSurfaceVariant}
              />
              <Text style={styles.contextText}>
                Estoque: {item?.currentInventoryQuantity} un.
              </Text>
            </View>
            {item?.lowestPrice90d && item.price && item.price > item.lowestPrice90d.price && (
              <View style={styles.contextRight}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={13}
                  color="orange"
                />
                <Text style={styles.warningText}>
                  Preço acima do menor (90d)
                </Text>
              </View>
            )}
          </View>

          {/* DIVIDER */}
          <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

          {/* CONTROLS ROW */}
          <View style={styles.controlsRow}>
            {/* LEFT - Quantidade */}
            <View style={styles.controlHalf}>
              <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>QUANTIDADE</Text>
              <View style={styles.quantityRow}>
                <Pressable
                  style={[styles.quantityButton, { borderColor: theme.colors.outline }]}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <MaterialCommunityIcons
                    name="minus"
                    size={18}
                    color={theme.colors.primary}
                  />
                </Pressable>
                <RNTextInput
                  style={styles.quantityInput}
                  value={quantity.toString()}
                  onChangeText={(value) => {
                    const num = parseInt(value, 10);
                    setQuantity(isNaN(num) ? 1 : Math.max(1, num));
                  }}
                  keyboardType="numeric"
                />
                <Pressable
                  style={[styles.quantityButton, { borderColor: theme.colors.outline }]}
                  onPress={() => setQuantity(quantity + 1)}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={18}
                    color={theme.colors.primary}
                  />
                </Pressable>
              </View>
            </View>

            {/* RIGHT - Preço unit. */}
            <View style={styles.controlHalf}>
              <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>PREÇO UNIT.</Text>
              <View style={styles.priceRow}>
                <Text style={[styles.priceSymbol, { color: theme.colors.onSurface }]}>R$</Text>
                <RNTextInput
                  style={[styles.priceInput, { borderColor: theme.colors.outline }]}
                  value={priceInput}
                  onChangeText={setPriceInput}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                />
              </View>
              {item?.lowestPrice90d && item.price && item.price > item.lowestPrice90d.price && (
                <Text style={styles.lowestPriceInfo}>
                  Mín. 90d: R$ {item.lowestPrice90d.price.toFixed(2).replace('.', ',')} em {item.lowestPrice90d.storeName}
                </Text>
              )}
            </View>
          </View>

          {/* TOTAL PREVIEW */}
          {totalPreview && (
            <View style={[styles.totalPreview, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={[styles.totalLabel, { color: theme.colors.onSurfaceVariant }]}>Total</Text>
              <Text style={[styles.totalValue, { color: theme.colors.primary }]}>{totalPreview}</Text>
            </View>
          )}

          {/* DIVIDER */}
          <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

          {/* CART TOGGLE BUTTON */}
          <Button
            mode="outlined"
            icon={checked ? "cart-minus" : "cart-plus"}
            onPress={() => setChecked(prev => !prev)}
            style={styles.cartButton}
          >
            {checked ? "Remover do carrinho" : "Mover pro carrinho"}
          </Button>

          {/* ACTION ROW */}
          <View style={styles.actionRow}>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.actionButton}
            >
              Salvar
            </Button>
            <Button
              mode="contained-tonal"
              onPress={onDismiss}
              style={styles.actionButton}
            >
              Cancelar
            </Button>
          </View>

          {/* DELETE LINK */}
          <Pressable onPress={onDelete} style={styles.deleteLink}>
            <Text style={[styles.deleteText, { color: theme.colors.error }]}>Remover da lista</Text>
          </Pressable>
        </Surface>
      </Modal>
      
      <SearchablePickerDialog
        visible={categoryModalVisible}
        items={categories}
        selectedId={selectedCategoryId}
        onSelect={(id) => { onCategorySelect(id); setCategoryModalVisible(false); }}
        onDismiss={() => setCategoryModalVisible(false)}
        title="Categoria"
        placeholder="Buscar categoria..."
        onCreateNew={() => {}}
      />
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
    padding: 20,
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productName: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "left",
    flex: 1,
  },
  categoryChipText: {
    fontSize: 11,
  },
  contextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  contextLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  contextRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  contextText: {
    fontSize: 12,
  },
  warningText: {
    fontSize: 11,
    color: "orange",
  },
  divider: {
    marginVertical: 12,
    height: 1,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 24,
  },
  controlHalf: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityInput: {
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    textAlign: "center",
    fontSize: 16,
    flex: 1,
    minWidth: 0,
    paddingBottom: 4,
  },
  priceInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priceSymbol: {
    fontSize: 15,
  },
  lowestPriceInfo: {
    fontSize: 10,
    color: "orange",
    fontStyle: "italic",
    marginTop: 3,
  },
  totalPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
  },
  totalLabel: {
    fontSize: 12,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  cartButton: {
    marginTop: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  deleteLink: {
    alignSelf: "center",
    marginTop: 10,
  },
  deleteText: {
    fontSize: 12,
  },
});
