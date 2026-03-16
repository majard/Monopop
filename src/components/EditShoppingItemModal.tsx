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
  Dialog,
} from "react-native-paper";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SearchablePickerDialog } from './SearchablePickerDialog';
import type { RefPrice } from '../database/database';
import { PriceTriangle, PriceTriangleHandle, TriangleValue } from './PriceTriangle';
import { UnitSymbol, getUnitFactor } from '../utils/units';

// ─── PriceInput (legacy path only) ───────────────────────────────────────────

const PriceInput = React.memo(({ onChangeCents, borderColor, textColor, initialCents }: {
  onChangeCents: (cents: number) => void;
  borderColor: string;
  textColor: string;
  initialCents: number;
}) => {
  const [cents, setCents] = useState(initialCents);

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
      onChangeCents(next);
      return next;
    });
  }, [onChangeCents]);

  return (
    <RNTextInput
      value={formatted}
      keyboardType="number-pad"
      onKeyPress={handleKeyPress}
      selection={{ start: formatted.length, end: formatted.length }}
      onFocus={() => { setCents(0); onChangeCents(0); }}
      contextMenuHidden
      selectTextOnFocus={false}
      caretHidden
      style={[styles.priceInput, { borderColor, color: textColor }]}
    />
  );
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnitSaveData {
  packageSize: number | null;
  updateReferencePrice: boolean;
  updateStandardPackageSize: boolean;
  /** Non-null when user configured unit inline this session */
  unit: string | null;
  /** Atomic value. Non-null when unit is non-null above. */
  newStandardPackageSize: number | null;
}

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
    packageSize?: number | null;
    showWarning?: boolean;
  } | null;
  inventoryItem?: any;
  productUnit?: UnitSymbol | null;
  productStandardPackageSize?: number | null;  // atomic
  refPrice?: RefPrice | null;
  manualOverrideActive?: boolean;
  selectedStoreName?: string | null;
  lowestRefPricePerUnit?: { pricePerUnit: number; storeName: string } | null;
  onSave: (quantity: number, price: number | undefined, unitData?: UnitSaveData) => void;
  onToggleChecked: () => void;
  onDelete: () => void;
  onDismiss: () => void;
  onCategoryChange: () => void;
  categories: { id: number; name: string }[];
  onCategorySelect: (categoryId: number) => void;
  promptRef?: React.RefObject<
    ((prefill: number, unit: string, invoiceInfo: {
      storeName: string; createdAt: string; unitPrice: number
    } | null) => Promise<number | null>) | null
  >;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditShoppingItemModal({
  visible,
  item,
  inventoryItem,
  productUnit,
  productStandardPackageSize,
  refPrice,
  manualOverrideActive = false,
  selectedStoreName,
  lowestRefPricePerUnit,
  onSave,
  onToggleChecked,
  onDelete,
  onDismiss,
  onCategoryChange,
  categories,
  onCategorySelect,
  promptRef,
}: EditShoppingItemModalProps) {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ─── Shared state ─────────────────────────────────────────────────────────
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [checked, setChecked] = useState(item?.checked ?? false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // ─── Legacy price state (State A only) ───────────────────────────────────
  const initialPriceCents = item?.price ? Math.round(item.price * 100) : 0;
  const priceCentsRef = useRef(initialPriceCents);
  const [priceCents, setPriceCents] = useState(initialPriceCents);

  const handleLegacyPriceChange = useCallback((cents: number) => {
    priceCentsRef.current = cents;
    setPriceCents(cents);
  }, []);

  // ─── Triangle ref ─────────────────────────────────────────────────────────
  const triangleRef = useRef<PriceTriangleHandle>(null);

  // ─── State A / B / C management ──────────────────────────────────────────
  // State A: legacy (no unit, setup not started)
  // State B: unit configured (productUnit set, or inline setup completed)
  // State C: first-time unit setup in progress
  const [setupStarted, setSetupStarted] = useState(false);
  const [inlineSetupDone, setInlineSetupDone] = useState(false);

  const isUnitConfigured = !!productUnit;
  const showTriangle = isUnitConfigured || inlineSetupDone;
  const showSetup = !isUnitConfigured && setupStarted && !inlineSetupDone;
  const showLegacy = !showTriangle && !showSetup;

  // ─── Retro dialog ─────────────────────────────────────────────────────────
  const [retroVisible, setRetroVisible] = useState(false);
  const [retroPackageSizeText, setRetroPackageSizeText] = useState('');
  const [retroUnit, setRetroUnit] = useState<string | null>(null);
  const [retroInvoiceInfo, setRetroInvoiceInfo] = useState<{
    storeName: string; createdAt: string; unitPrice: number;
  } | null>(null);
  const retroResolveRef = useRef<((value: number | null) => void) | null>(null);

  const promptForRetroPackageSize = useCallback(async (
    prefill: number,
    unit: string,
    invoiceInfo: { storeName: string; createdAt: string; unitPrice: number } | null,
  ): Promise<number | null> => {
    setRetroInvoiceInfo(invoiceInfo);
    setRetroUnit(unit);
    // Convert atomic prefill to display value for the input
    const factor = getUnitFactor(unit as UnitSymbol);
    setRetroPackageSizeText(String(prefill / factor));
    setRetroVisible(true);
    return new Promise(resolve => { retroResolveRef.current = resolve; });
  }, []);

  // Wire promptRef so parent can call this
  useEffect(() => {
    if (promptRef) promptRef.current = promptForRetroPackageSize;
  }, [promptRef, promptForRetroPackageSize]);

  // ─── Init on item change ──────────────────────────────────────────────────
  useEffect(() => {
    if (!item) return;

    setQuantity(item.quantity);
    setChecked(item.checked);
    setSetupStarted(false);
    setInlineSetupDone(false);

    // Reset legacy price state
    const newCents = item.price ? Math.round(item.price * 100) : 0;
    setPriceCents(newCents);
    priceCentsRef.current = newCents;

    // Seed triangle if unit is configured
    if (productUnit && productStandardPackageSize) {
      // Determine seed values from refPrice or item price
      if (refPrice && refPrice.packageSize != null && refPrice.packageSize > 0) {
        const factor = getUnitFactor(productUnit);
        const displayStd = productStandardPackageSize / factor;
        const refPPU = refPrice.price / refPrice.packageSize; // R$ per atomic
        const pricePerPkg = refPPU * productStandardPackageSize; // R$ for std package

        const initPackageSize = item.packageSize ?? refPrice.packageSize;
        const initPricePaid = initPackageSize === refPrice.packageSize
          ? refPrice.price
          : refPPU * initPackageSize;

        triangleRef.current?.seed({
          pricePerPkg,
          packageSize: initPackageSize,
          pricePaid: initPricePaid,
          unit: productUnit,
          standardPackageSize: productStandardPackageSize,
        });
      } else if (item.price && item.price > 0) {
        const initPackageSize = item.packageSize ?? productStandardPackageSize;
        const ppu = item.price / initPackageSize;
        const pricePerPkg = ppu * productStandardPackageSize;

        triangleRef.current?.seed({
          pricePerPkg,
          packageSize: initPackageSize,
          pricePaid: item.price,
          unit: productUnit,
          standardPackageSize: productStandardPackageSize,
        });
      } else {
        triangleRef.current?.reset();
      }
    }
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    // Intentional: Save commits cart state changes made during this session.
    // If user toggled checked and taps Save, the toggle is preserved.
    if (checked !== item?.checked) onToggleChecked();

    if (showTriangle) {
      const value = triangleRef.current?.getValue();
      onSave(quantity, value?.pricePaid, {
        packageSize: value?.packageSize ?? null,
        updateReferencePrice: value?.updateRefPrice ?? true,
        updateStandardPackageSize: value?.updateStdSize ?? false,
        unit: value?.unitConfigData?.unit ?? null,
        newStandardPackageSize: value?.unitConfigData?.newStandardPackageSize ?? null,
      });
    } else {
      const price = priceCentsRef.current > 0 ? priceCentsRef.current / 100 : undefined;
      onSave(quantity, price);
    }
  }, [checked, item?.checked, onToggleChecked, showTriangle, quantity, onSave]);

  // ─── Derived display ──────────────────────────────────────────────────────
  const totalPreview = (priceCents > 0 && showLegacy)
    ? `R$ ${(quantity * priceCents / 100).toFixed(2).replace('.', ',')}`
    : null;

  const selectedCategoryId = item?.categoryName
    ? categories.find(cat => cat.name === item.categoryName)?.id
    : undefined;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={handleSave}
          contentContainerStyle={styles.modalContainer}
        >
          <Surface style={styles.surface}>

            {/* HEADER */}
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
                    style={{ marginTop: 2 }}
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
              {item?.showWarning && (
                <View style={styles.contextRight}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={13}
                    color="orange"
                  />
                </View>
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

            {/* STATE A — legacy product */}
            {showLegacy && (
              <>
                <View style={styles.controlsRow}>
                  {/* Quantity */}
                  <View style={styles.controlHalf}>
                    <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                      QUANTIDADE
                    </Text>
                    <View style={styles.quantityRow}>
                      <Pressable
                        style={[styles.quantityButton, { borderColor: theme.colors.outline }]}
                        onPress={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        <MaterialCommunityIcons name="minus" size={18} color={theme.colors.primary} />
                      </Pressable>
                      <RNTextInput
                        style={[styles.quantityInput, { color: theme.colors.onSurface }]}
                        value={quantity.toString()}
                        onChangeText={v => {
                          const n = parseInt(v, 10);
                          setQuantity(isNaN(n) ? 1 : Math.max(1, n));
                        }}
                        keyboardType="numeric"
                        selectTextOnFocus
                        returnKeyType="done"
                        onBlur={() => { if (isNaN(quantity) || quantity < 1) setQuantity(1); }}
                      />
                      <Pressable
                        style={[styles.quantityButton, { borderColor: theme.colors.outline }]}
                        onPress={() => setQuantity(quantity + 1)}
                      >
                        <MaterialCommunityIcons name="plus" size={18} color={theme.colors.primary} />
                      </Pressable>
                    </View>
                  </View>
                  {/* Price paid */}
                  <View style={styles.controlHalf}>
                    <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                      PREÇO PAGO
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.priceSymbol, { color: theme.colors.onSurface }]}>R$</Text>
                      <PriceInput
                        onChangeCents={handleLegacyPriceChange}
                        borderColor={theme.colors.outline}
                        textColor={theme.colors.onSurface}
                        initialCents={priceCents}
                      />
                    </View>
                    {item?.showWarning && item?.lowestPrice90d && (
                      <Text style={[styles.lowestPriceHint, { color: 'orange' }]}>
                        Mín. 90d: R$ {item.lowestPrice90d.price.toFixed(2).replace('.', ',')} em {item.lowestPrice90d.storeName}
                      </Text>
                    )}
                  </View>
                </View>

                {totalPreview && (
                  <View style={[styles.totalPreview, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text style={[styles.totalLabel, { color: theme.colors.onSurfaceVariant }]}>
                      Total
                    </Text>
                    <Text style={[styles.totalValue, { color: theme.colors.primary }]}>
                      {totalPreview}
                    </Text>
                  </View>
                )}

                {/* Configure unit button */}
                <Pressable
                  onPress={() => setSetupStarted(true)}
                  style={[styles.configureUnitButton, { borderColor: theme.colors.outlineVariant }]}
                >
                  <View>
                    <Text style={[styles.configureUnitLabel, { color: theme.colors.primary }]}>
                      Configurar unidade
                    </Text>
                    <Text style={[styles.configureUnitHint, { color: theme.colors.onSurfaceVariant }]}>
                      Ative comparação por g, kg, L…
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={18}
                    color={theme.colors.primary}
                  />
                </Pressable>
              </>
            )}

            {(showSetup || showTriangle) && (
              <PriceTriangle
                ref={triangleRef}
                productUnit={productUnit ?? null}
                productStandardPackageSize={productStandardPackageSize ?? null}
                refPrice={refPrice}
                manualOverrideActive={manualOverrideActive}
                initialPrice={item?.price}
                initialPackageSize={item?.packageSize}
                quantity={quantity}
                onQuantityChange={setQuantity}
                selectedStoreName={selectedStoreName}
                lowestRefPricePerUnit={lowestRefPricePerUnit}
                onUnitConfigured={() => setInlineSetupDone(true)}
              />
            )}

            <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant, marginTop: 16 }]} />

            {/* Cart toggle */}
            <Button
              mode="outlined"
              icon={checked ? "cart-minus" : "cart-plus"}
              onPress={() => setChecked(prev => !prev)}
              style={styles.cartButton}
            >
              {checked ? "Remover do carrinho" : "Mover pro carrinho"}
            </Button>

            {/* Actions */}
            <View style={styles.actionRow}>
              <Button mode="contained" onPress={handleSave} style={styles.actionButton}>
                Salvar
              </Button>
              <Button mode="contained-tonal" onPress={onDismiss} style={styles.actionButton}>
                Cancelar
              </Button>
            </View>

            <Pressable onPress={onDelete} style={styles.deleteLink}>
              <Text style={[styles.deleteText, { color: theme.colors.error }]}>
                Remover da lista
              </Text>
            </Pressable>
          </Surface>
        </Modal>

        <SearchablePickerDialog
          visible={categoryModalVisible}
          items={categories}
          selectedId={selectedCategoryId}
          onSelect={id => { onCategorySelect(id); setCategoryModalVisible(false); }}
          onDismiss={() => setCategoryModalVisible(false)}
          title="Categoria"
          placeholder="Buscar categoria..."
          onCreateNew={() => { }}
        />
      </Portal>

      {/* Retro dialog — separate Portal so it renders above the modal */}
      <Portal>
        <Dialog
          visible={retroVisible}
          onDismiss={() => {
            setRetroVisible(false);
            retroResolveRef.current?.(null);
            retroResolveRef.current = null;
          }}
        >
          <Dialog.Title>Qual era o tamanho da embalagem?</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.retroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Confirme o tamanho da embalagem para criar uma referência.
            </Text>

            {retroInvoiceInfo && (
              <View style={[styles.invoiceCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View style={styles.invoiceRow}>
                  <MaterialCommunityIcons name="store-outline" size={14} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.invoiceText, { color: theme.colors.onSurfaceVariant }]}>
                    {retroInvoiceInfo.storeName}
                  </Text>
                  <MaterialCommunityIcons name="calendar-outline" size={14} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.invoiceText, { color: theme.colors.onSurfaceVariant }]}>
                    {new Date(retroInvoiceInfo.createdAt).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <Text style={[styles.invoicePrice, { color: theme.colors.onSurface }]}>
                  R$ {retroInvoiceInfo.unitPrice.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            )}

            <View style={styles.retroInputRow}>
              <RNTextInput
                value={retroPackageSizeText}
                onChangeText={setRetroPackageSizeText}
                keyboardType="decimal-pad"
                style={[
                  styles.retroInput,
                  {
                    borderColor: theme.colors.outline,
                    color: theme.colors.onSurface,
                  }
                ]}
                autoFocus
              />
              <Text style={[styles.retroUnit, { color: theme.colors.onSurfaceVariant }]}>
                {retroUnit ?? ''}
              </Text>
            </View>
          </Dialog.Content>

          <Dialog.Actions>
            <Button onPress={() => {
              setRetroVisible(false);
              retroResolveRef.current?.(null);
              retroResolveRef.current = null;
            }}>
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                const v = parseFloat((retroPackageSizeText ?? '').replace(',', '.'));
                if (!isFinite(v) || v <= 0) return;
                // Convert display value back to atomic before resolving
                const factor = getUnitFactor((retroUnit ?? 'g') as UnitSymbol);
                setRetroVisible(false);
                retroResolveRef.current?.(v * factor);
                retroResolveRef.current = null;
              }}
              disabled={
                !isFinite(parseFloat((retroPackageSizeText ?? '').replace(',', '.'))) ||
                parseFloat((retroPackageSizeText ?? '').replace(',', '.')) <= 0
              }
            >
              Confirmar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modalContainer: { padding: 20, justifyContent: "center", alignItems: "center" },
  surface: { padding: 20, borderRadius: 12, width: "100%", maxWidth: 400, elevation: 4 },

  // Header
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  productName: { fontSize: 18, fontWeight: "700", textAlign: "left" },
  categoryChipText: { fontSize: 11 },

  // Context
  contextRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 4 },
  contextLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  contextRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  contextText: { fontSize: 12 },

  divider: { marginVertical: 12, height: 1 },

  // State A — legacy controls
  controlsRow: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  controlHalf: { flex: 1 },
  label: { fontSize: 10, letterSpacing: 0.6, marginBottom: 8 },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  quantityButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  quantityInput: { height: 32, borderWidth: 1, borderRadius: 6, textAlign: "center", fontSize: 16, flex: 1, minWidth: 0, paddingBottom: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  priceSymbol: { fontSize: 15 },
  priceInput: { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 15, flex: 1 },
  lowestPriceHint: { fontSize: 10, fontStyle: 'italic', marginTop: 3 },

  // Total preview
  totalPreview: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 14 },
  totalLabel: { fontSize: 12 },
  totalValue: { fontSize: 16, fontWeight: "700" },

  // Configure unit button
  configureUnitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  configureUnitLabel: { fontSize: 13, fontWeight: '500' },
  configureUnitHint: { fontSize: 11, marginTop: 2 },

  // Actions
  cartButton: { marginTop: 8 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionButton: { flex: 1 },
  deleteLink: { alignSelf: "center", marginTop: 10 },
  deleteText: { fontSize: 12 },

  // Retro dialog
  retroSubtitle: { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  invoiceCard: { borderRadius: 8, padding: 12, marginBottom: 14 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  invoiceText: { fontSize: 12 },
  invoicePrice: { fontSize: 15, fontWeight: '600' },
  retroInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  retroInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 15 },
  retroUnit: { fontSize: 14, fontWeight: '500', minWidth: 28 },
});