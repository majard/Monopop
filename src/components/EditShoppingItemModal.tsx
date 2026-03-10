import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SearchablePickerDialog } from './SearchablePickerDialog';

const PriceInput = React.memo(({ onChangeCents, borderColor, textColor, placeholderColor, initialCents }: {
  onChangeCents: (cents: number) => void;
  borderColor: string;
  textColor: string;
  placeholderColor: string;
  initialCents: number;
}) => {
  const [cents, setCents] = useState(initialCents);
  const centsRef = useRef(initialCents);

  const formatted = useMemo(() => {
    const int = Math.floor(cents / 100);
    const dec = cents % 100;
    return `${int},${dec.toString().padStart(2, '0')}`;
  }, [cents]);

  const handleKeyPress = useCallback((e: any) => {
    const key = e.nativeEvent.key;
    setCents(prev => {
      let next = prev;
      if (key >= '0' && key <= '9') {
        next = prev * 10 + (key.charCodeAt(0) - 48);
        if (next > 999999999) return prev;
      } else if (key === 'Backspace') {
        next = Math.floor(prev / 10);
      }
      centsRef.current = next;
      return next;
    });
  }, []);

  return (
    <RNTextInput
      value={formatted}
      keyboardType="number-pad"
      onKeyPress={handleKeyPress}
      onFocus={() => { setCents(0); centsRef.current = 0; }}
      onBlur={() => onChangeCents(centsRef.current)}
      selection={{ start: formatted.length, end: formatted.length }}
      contextMenuHidden
      selectTextOnFocus={false}
      caretHidden
      style={[styles.priceInput, { borderColor, color: textColor }]}
    />
  );
});

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
  inventoryItem?: any; // pass the full inventoryItem object from parent
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
  inventoryItem,
  onSave,
  onToggleChecked,
  onDelete,
  onDismiss,
  onCategoryChange,
  categories,
  onCategorySelect,
}: EditShoppingItemModalProps) {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const priceCentsRef = useRef(0);
  const [quantity, setQuantity] = useState(1);
  const [priceCents, setPriceCents] = useState(0);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  const handlePriceChange = useCallback((cents: number) => {
    priceCentsRef.current = cents;
    setPriceCents(cents);
  }, []);

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity);
      const newPriceCents = item.price ? Math.round(item.price * 100) : 0;
      setPriceCents(newPriceCents);
      priceCentsRef.current = newPriceCents;
      setChecked(item.checked);
    }
  }, [item]);

  const handleSave = () => {
    const price = priceCentsRef.current > 0 ? priceCentsRef.current / 100 : undefined;
    if (checked !== item?.checked) {
      onToggleChecked();
    }
    onSave(quantity, price);
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  const formatPriceDisplay = (cents: number) => {
    return (cents / 100).toFixed(2).replace('.', ',');
  };

  const totalPreview = priceCents > 0 ? formatCurrency(quantity * (priceCents / 100)) : null;

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
            <Pressable
              onPress={() => {
                if (inventoryItem) {
                  onDismiss();
                  navigation.navigate('EditInventoryItem', { inventoryItem });
                }
              }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}
            >
              <Text style={styles.productName} numberOfLines={1}>
                {item?.productName}
              </Text>
              {inventoryItem && (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                  style={{ marginTop: 2}}
                />
              )}
            </Pressable>
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
                  style={[styles.quantityInput, { color: theme.colors.onSurface }]}
                  value={quantity.toString()}
                  onChangeText={(value) => {
                    const num = parseInt(value, 10);
                    setQuantity(isNaN(num) ? 1 : Math.max(1, num));
                  }}
                  keyboardType="numeric"
                  selectTextOnFocus
                  returnKeyType="done"
                  onBlur={() => {
                    if (isNaN(quantity) || quantity < 1) {
                      setQuantity(1);
                    }
                  }}
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
                <PriceInput
                  onChangeCents={handlePriceChange}
                  borderColor={theme.colors.outline}
                  textColor={theme.colors.onSurface}
                  placeholderColor={theme.colors.onSurfaceVariant}
                  initialCents={priceCents}
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
        onCreateNew={() => { }}
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