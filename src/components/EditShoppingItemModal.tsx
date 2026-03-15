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
import { UNITS, getPricePerPackageLabel, UnitFamily } from '../utils/units';
import type { RefPrice } from '../database/database';

// ─── PriceInput ───────────────────────────────────────────────────────────────

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
      onFocus={() => { setCents(0); centsRef.current = 0; onChangeCents(0); }}
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
  /** Non-null when user configured unit inline in this session (product had no unit before). */
  unit: string | null;
  /** The standardPackageSize entered inline. Non-null when unit is non-null above. */
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
  } | null;
  inventoryItem?: any;
  productUnit?: string | null;
  productStandardPackageSize?: number | null;
  refPrice?: RefPrice | null;
  manualOverrideActive?: boolean;
  onSave: (quantity: number, price: number | undefined, unitData?: UnitSaveData) => void;
  onToggleChecked: () => void;
  onDelete: () => void;
  onDismiss: () => void;
  onCategoryChange: () => void;
  categories: { id: number; name: string }[];
  onCategorySelect: (categoryId: number) => void;
  promptRef?: React.RefObject<
    ((prefill: number, unit: string, invoiceInfo: { storeName: string; createdAt: string; unitPrice: number } | null) => Promise<number | null>) | null
  >;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function formatPricePerUnitDisplay(pricePerUnit: number, unit: string): string {
  let val = pricePerUnit;
  let u = unit;
  if (unit === 'g') { val = pricePerUnit * 1000; u = 'kg'; }
  else if (unit === 'ml') { val = pricePerUnit * 1000; u = 'L'; }
  const s = val < 10
    ? val.toPrecision(4).replace(/\.?0+$/, '')
    : val.toFixed(2);
  return `R$ ${s.replace('.', ',')}/${u}`;
}

function formatPerStdPkg(pricePerUnit: number, unit: string, stdSize: number): string {
  const price = pricePerUnit * stdSize;
  let displaySize: string;
  if (unit === 'g' && stdSize === 1000) displaySize = 'kg';
  else if (unit === 'ml' && stdSize === 1000) displaySize = 'L';
  else if (unit === 'g' && stdSize % 1000 === 0) displaySize = `${stdSize / 1000}kg`;
  else if (unit === 'ml' && stdSize % 1000 === 0) displaySize = `${stdSize / 1000}L`;
  else displaySize = `${stdSize}${unit}`;
  return `R$ ${price.toFixed(2).replace('.', ',')}/${displaySize}`;
}

const FAMILIES: { key: UnitFamily; label: string }[] = [
  { key: 'massa', label: 'Peso' },
  { key: 'volume', label: 'Volume' },
  { key: 'contagem', label: 'Contagem' },
];

function stdSizePlaceholder(unit: string): string {
  switch (unit) {
    case 'g': return '400';
    case 'ml': return '500';
    case 'un': return '12';
    default: return '';
  }
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
  onSave,
  onToggleChecked,
  onDelete,
  onDismiss,
  onCategoryChange,
  categories,
  onCategorySelect,
  promptRef
}: EditShoppingItemModalProps) {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ─── Legacy price state ─────────────────────────────────────────────────────
  const initialPrice = item?.price ? Math.round(item.price * 100) : 0;
  const priceCentsRef = useRef(initialPrice);
  const [quantity, setQuantity] = useState(1);
  const [priceCents, setPriceCents] = useState(initialPrice);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  const handlePriceChange = useCallback((cents: number) => {
    priceCentsRef.current = cents;
    setPriceCents(cents);
  }, []);

  // ─── Expand ─────────────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false);

  // ─── Inline unit config ─────────────────────────────────────────────────────
  const [localUnit, setLocalUnit] = useState<string | null>(productUnit ?? null);
  const [localStdSizeStr, setLocalStdSizeStr] = useState<string>(
    productStandardPackageSize ? String(productStandardPackageSize) : ''
  );
  const [confirmedStdSizeStr, setConfirmedStdSizeStr] = useState<string>(
    productStandardPackageSize ? String(productStandardPackageSize) : ''
  );
  const [selectedFamily, setSelectedFamily] = useState<UnitFamily | null>(
    productUnit ? (UNITS.find(u => u.symbol === productUnit)?.family ?? null) : null
  );

  const effectiveUnit = localUnit;
  const effectiveStdSize = parseFloat(confirmedStdSizeStr) || null;
  const hasUnit = !!effectiveUnit && !!effectiveStdSize;
  const unitConfiguredInline = hasUnit && !productUnit;

  // ─── Triangle state ─────────────────────────────────────────────────────────
  const [pricePerPkgCents, setPricePerPkgCents] = useState(0);
  const [pricePerPkgKey, setPricePerPkgKey] = useState(0);
  const [packageSizeStr, setPackageSizeStr] = useState('');
  const [pricePaidCents, setPricePaidCents] = useState(0);
  const [pricePaidKey, setPricePaidKey] = useState(0);
  const [updateRefPrice, setUpdateRefPrice] = useState(true);
  const [updateStdSize, setUpdateStdSize] = useState(false);


  // Retroactive package size input
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
    setRetroPackageSizeText(String(prefill));
    setRetroVisible(true);
    return new Promise(resolve => { retroResolveRef.current = resolve; });
  }, []);

  const pricePerPkgRef = useRef(0);
  const pricePaidRef = useRef(0);
  const packageSizeRef = useRef(0);
  const lastTouchedRef = useRef<('pkg' | 'size' | 'paid')[]>([]);

  const touchField = useCallback((field: 'pkg' | 'size' | 'paid') => {
    const filtered = lastTouchedRef.current.filter(f => f !== field).slice(-1);
    lastTouchedRef.current = [...filtered, field];
  }, []);

  const deriveThird = useCallback((std: number) => {
    if (std === 0) return;
    const touched = lastTouchedRef.current;
    const deriveKey = touched.length >= 2 ? `${touched[0]}+${touched[1]}` : touched[0] ?? null;

    if (deriveKey === 'paid+size' || deriveKey === 'size+paid') {
      if (packageSizeRef.current > 0 && pricePaidRef.current > 0) {
        const ppu = (pricePaidRef.current / 100) / packageSizeRef.current;
        const pkg = Math.round(ppu * std * 100);
        pricePerPkgRef.current = pkg;
        setPricePerPkgCents(pkg);
        setPricePerPkgKey(k => k + 1);
      }
      return;
    }

    if (deriveKey === 'pkg+size' || deriveKey === 'size+pkg') {
      if (pricePerPkgRef.current > 0 && packageSizeRef.current > 0) {
        const ppu = (pricePerPkgRef.current / 100) / std;
        const paid = Math.round(ppu * packageSizeRef.current * 100);
        pricePaidRef.current = paid;
        setPricePaidCents(paid);
        setPricePaidKey(k => k + 1);
      }
      return;
    }

    if (deriveKey === 'pkg+paid' || deriveKey === 'paid+pkg') {
      if (pricePaidRef.current > 0 && pricePerPkgRef.current > 0) {
        const size = ((pricePaidRef.current / 100) * std) / (pricePerPkgRef.current / 100);
        const sizeRounded = Math.round(size * 100) / 100;
        packageSizeRef.current = sizeRounded;
        setPackageSizeStr(String(sizeRounded));
      }
      return;
    }

    if (deriveKey === 'paid') {
      if (packageSizeRef.current > 0 && pricePaidRef.current > 0) {
        const ppu = (pricePaidRef.current / 100) / packageSizeRef.current;
        const pkg = Math.round(ppu * std * 100);
        pricePerPkgRef.current = pkg;
        setPricePerPkgCents(pkg);
        setPricePerPkgKey(k => k + 1);
      }
      return;
    }

    if (deriveKey === 'size') {
      if (pricePaidRef.current > 0 && packageSizeRef.current > 0) {
        const ppu = (pricePaidRef.current / 100) / packageSizeRef.current;
        const pkg = Math.round(ppu * std * 100);
        pricePerPkgRef.current = pkg;
        setPricePerPkgCents(pkg);
        setPricePerPkgKey(k => k + 1);
      } else if (pricePerPkgRef.current > 0 && packageSizeRef.current > 0) {
        const ppu = (pricePerPkgRef.current / 100) / std;
        const paid = Math.round(ppu * packageSizeRef.current * 100);
        pricePaidRef.current = paid;
        setPricePaidCents(paid);
        setPricePaidKey(k => k + 1);
      }
      return;
    }

    if (deriveKey === 'pkg') {
      if (pricePerPkgRef.current > 0 && packageSizeRef.current > 0) {
        const ppu = (pricePerPkgRef.current / 100) / std;
        const paid = Math.round(ppu * packageSizeRef.current * 100);
        pricePaidRef.current = paid;
        setPricePaidCents(paid);
        setPricePaidKey(k => k + 1);
      }
      return;
    }

    if (packageSizeRef.current > 0 && pricePaidRef.current > 0) {
      const ppu = (pricePaidRef.current / 100) / packageSizeRef.current;
      const pkg = Math.round(ppu * std * 100);
      pricePerPkgRef.current = pkg;
      setPricePerPkgCents(pkg);
      setPricePerPkgKey(k => k + 1);
    }
  }, []);

  const resetTriangle = useCallback(() => {
    pricePerPkgRef.current = 0;
    packageSizeRef.current = 0;
    pricePaidRef.current = 0;
    setPricePerPkgCents(0);
    setPricePerPkgKey(k => k + 1);
    setPackageSizeStr('');
    setPricePaidCents(0);
    setPricePaidKey(k => k + 1);
    lastTouchedRef.current = [];
  }, []);

  // ─── Init on item change ────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[DIAG:modal:itemEffect] item changed', {
      itemId: item?.id,
      itemPrice: item?.price,
      productUnit,
      productStandardPackageSize,
      refPrice,
    });
    if (item) {
      setQuantity(item.quantity);
      const newPriceCents = item.price ? Math.round(item.price * 100) : 0;
      setPriceCents(newPriceCents);
      priceCentsRef.current = newPriceCents;
      setChecked(item.checked);
    }
    setExpanded(false);
    setLocalUnit(productUnit ?? null);
    setLocalStdSizeStr(productStandardPackageSize ? String(productStandardPackageSize) : '');
    setConfirmedStdSizeStr(productStandardPackageSize ? String(productStandardPackageSize) : '');
    setSelectedFamily(productUnit ? (UNITS.find(u => u.symbol === productUnit)?.family ?? null) : null);
    setUpdateRefPrice(true);
    setUpdateStdSize(false);

    if (productUnit && productStandardPackageSize && item?.price && item.price > 0 && manualOverrideActive) {
      const initPackageSize = item.packageSize ?? refPrice?.packageSize ?? productStandardPackageSize;
      const initPricePaid = Math.round(item.price * 100);
      const ppu = initPackageSize > 0 ? item.price / initPackageSize : 0;
      const initPricePerPkg = Math.round(ppu * productStandardPackageSize * 100);
      pricePerPkgRef.current = initPricePerPkg;
      packageSizeRef.current = initPackageSize;
      pricePaidRef.current = initPricePaid;
      setPricePerPkgCents(initPricePerPkg);
      setPricePerPkgKey(k => k + 1);
      setPackageSizeStr(String(initPackageSize));
      setPricePaidCents(initPricePaid);
      setPricePaidKey(k => k + 1);
      lastTouchedRef.current = [];
    } else if (productUnit && productStandardPackageSize && refPrice && refPrice.packageSize != null && refPrice.packageSize > 0) {
      // Pre-fill triangle from existing ref price
      const refPricePerUnit = refPrice.price / refPrice.packageSize;
      const initPricePerPkg = Math.round(refPricePerUnit * productStandardPackageSize * 100);
      const initPackageSize = item.packageSize ?? refPrice.packageSize ?? productStandardPackageSize;
      const initPricePaid = initPackageSize === refPrice.packageSize
        ? Math.round(refPrice.price * 100)
        : Math.round(refPricePerUnit * initPackageSize * 100);
      pricePerPkgRef.current = initPricePerPkg;
      packageSizeRef.current = initPackageSize;
      pricePaidRef.current = initPricePaid;
      setPricePerPkgCents(initPricePerPkg);
      setPricePerPkgKey(k => k + 1);
      setPackageSizeStr(String(initPackageSize));
      setPricePaidCents(initPricePaid);
      setPricePaidKey(k => k + 1);
      lastTouchedRef.current = [];
    } else {
      resetTriangle();
      if (productUnit && productStandardPackageSize && item?.price && item.price > 0) {
        const initPackageSize = item.packageSize ?? productStandardPackageSize;
        const initPricePaid = Math.round(item.price * 100);
        const ppu = initPackageSize > 0 ? item.price / initPackageSize : 0;
        const initPricePerPkg = Math.round(ppu * productStandardPackageSize * 100);
        pricePerPkgRef.current = initPricePerPkg;
        packageSizeRef.current = initPackageSize;
        pricePaidRef.current = initPricePaid;
        setPricePerPkgCents(initPricePerPkg);
        setPricePerPkgKey(k => k + 1);
        setPackageSizeStr(String(initPackageSize));
        setPricePaidCents(initPricePaid);
        setPricePaidKey(k => k + 1);
        lastTouchedRef.current = [];
      } else if (item?.price && item.price > 0) {
        // Legacy product (no unit): seed only price paid
        const initPaid = Math.round(item.price * 100);
        pricePaidRef.current = initPaid;
        setPricePaidCents(initPaid);
        setPricePaidKey(k => k + 1);
      }
      console.log('[DIAG:modal:itemEffect] seeded triangle', {
        pricePerPkgRef: pricePerPkgRef.current,
        packageSizeRef: packageSizeRef.current,
        pricePaidRef: pricePaidRef.current,
      });
    }
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  // When inline unit config becomes complete, seed packageSize with stdSize (empty triangle).
  const prevHasUnit = useRef(false);
  useEffect(() => {
    console.log('[DIAG:modal:hasUnitEffect]', {
      hasUnit,
      prevHasUnit: prevHasUnit.current,
      productUnit,
      effectiveStdSize,
      itemPrice: item?.price,
    });
    if (hasUnit && !prevHasUnit.current && !productUnit) {
      resetTriangle();
      packageSizeRef.current = effectiveStdSize!;
      setPackageSizeStr(String(effectiveStdSize!));
      // Re-seed pricePaid from item.price (wiped by resetTriangle above)
      if (item?.price && item.price > 0) {
        const initPaid = Math.round(item.price * 100);
        pricePaidRef.current = initPaid;
        setPricePaidCents(initPaid);
        setPricePaidKey(k => k + 1);
      }
      // Derive pricePerPkg from packageSize + pricePaid now that both are seeded
      deriveThird(effectiveStdSize!);
    }
    prevHasUnit.current = hasUnit;
  }, [hasUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (promptRef) promptRef.current = promptForRetroPackageSize;
  }, [promptRef, promptForRetroPackageSize]);

  // ─── Triangle handlers ──────────────────────────────────────────────────────
  const handlePricePerPkgChange = useCallback((cents: number) => {
    pricePerPkgRef.current = cents;
    setPricePerPkgCents(cents);
    touchField('pkg');
    if (effectiveStdSize) deriveThird(effectiveStdSize);
  }, [touchField, deriveThird, effectiveStdSize]);

  const handlePackageSizeChange = useCallback((text: string) => {
    setPackageSizeStr(text);
    const val = parseFloat(text);
    packageSizeRef.current = isNaN(val) ? 0 : val;
    touchField('size');
    if (effectiveStdSize) deriveThird(effectiveStdSize);
  }, [touchField, deriveThird, effectiveStdSize]);

  const handlePricePaidChange = useCallback((cents: number) => {
    pricePaidRef.current = cents;
    setPricePaidCents(cents);
    touchField('paid');
    if (effectiveStdSize) deriveThird(effectiveStdSize);
  }, [touchField, deriveThird, effectiveStdSize]);

  // ─── Derived display ────────────────────────────────────────────────────────
  const currentPackageSize = parseFloat(packageSizeStr) || 0;
  const derivedPricePerUnit = (hasUnit && currentPackageSize > 0 && pricePaidCents > 0)
    ? (pricePaidCents / 100) / currentPackageSize
    : null;

  // ─── Save ───────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (checked !== item?.checked) onToggleChecked();

    if (expanded && hasUnit && effectiveStdSize) {
      const price = pricePaidRef.current > 0 ? pricePaidRef.current / 100 : undefined;
      const unitDataForLog = {
        packageSize: packageSizeRef.current > 0 ? packageSizeRef.current : null,
        updateReferencePrice: updateRefPrice,
        updateStandardPackageSize: updateStdSize,
        unit: unitConfiguredInline ? effectiveUnit : null,
        newStandardPackageSize: unitConfiguredInline ? effectiveStdSize : null,
      };
      console.log('[DIAG:modal:handleSave]', {
        expanded,
        hasUnit,
        effectiveStdSize,
        pricePerPkgRef: pricePerPkgRef.current,
        packageSizeRef: packageSizeRef.current,
        pricePaidRef: pricePaidRef.current,
        unitData: unitDataForLog,
      });
      onSave(quantity, price, unitDataForLog);
    } else {
      const price = priceCentsRef.current > 0 ? priceCentsRef.current / 100 : undefined;
      onSave(quantity, price);
    }
  };

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
  const totalPreview = priceCents > 0 ? formatCurrency(quantity * (priceCents / 100)) : null;
  const selectedCategoryId = item?.categoryName
    ? categories.find(cat => cat.name === item.categoryName)?.id
    : undefined;
  const unitsForFamily = selectedFamily ? UNITS.filter(u => u.family === selectedFamily) : [];

  // ─── Render ─────────────────────────────────────────────────────────────────
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
                  if (inventoryItem) { onDismiss(); navigation.navigate('EditInventoryItem', { inventoryItem }); }
                }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}
              >
                <Text style={styles.productName} numberOfLines={1}>{item?.productName}</Text>
                {inventoryItem && (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} style={{ marginTop: 2 }} />
                )}
              </Pressable>
              <Chip icon="tag-outline" mode="outlined" onPress={() => setCategoryModalVisible(true)} compact textStyle={styles.categoryChipText}>
                {item?.categoryName ?? 'Sem categoria'}
              </Chip>
            </View>

            {/* CONTEXT ROW */}
            <View style={styles.contextRow}>
              <View style={styles.contextLeft}>
                <MaterialCommunityIcons name="package-variant" size={13} color={theme.colors.onSurfaceVariant} />
                <Text style={styles.contextText}>Estoque: {item?.currentInventoryQuantity} un.</Text>
              </View>
              {item?.lowestPrice90d && item.price && item.price > item.lowestPrice90d.price && (
                <View style={styles.contextRight}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={13} color="orange" />
                  <Text style={styles.warningText}>Preço acima do menor (90d)</Text>
                </View>
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

            {/* COLLAPSED CONTROLS */}
            {!expanded && (
              <View style={styles.controlsRow}>
                <View style={styles.controlHalf}>
                  <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>QUANTIDADE</Text>
                  <View style={styles.quantityRow}>
                    <Pressable style={[styles.quantityButton, { borderColor: theme.colors.outline }]} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                      <MaterialCommunityIcons name="minus" size={18} color={theme.colors.primary} />
                    </Pressable>
                    <RNTextInput
                      style={[styles.quantityInput, { color: theme.colors.onSurface }]}
                      value={quantity.toString()}
                      onChangeText={(v) => { const n = parseInt(v, 10); setQuantity(isNaN(n) ? 1 : Math.max(1, n)); }}
                      keyboardType="numeric" selectTextOnFocus returnKeyType="done"
                      onBlur={() => { if (isNaN(quantity) || quantity < 1) setQuantity(1); }}
                    />
                    <Pressable style={[styles.quantityButton, { borderColor: theme.colors.outline }]} onPress={() => setQuantity(quantity + 1)}>
                      <MaterialCommunityIcons name="plus" size={18} color={theme.colors.primary} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.controlHalf}>
                  <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>PREÇO PAGO</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceSymbol, { color: theme.colors.onSurface }]}>R$</Text>
                    <PriceInput onChangeCents={handlePriceChange} borderColor={theme.colors.outline} textColor={theme.colors.onSurface} placeholderColor={theme.colors.onSurfaceVariant} initialCents={priceCents} />
                  </View>
                  {item?.lowestPrice90d && item.price && item.price > item.lowestPrice90d.price && (
                    <Text style={styles.lowestPriceInfo}>Mín. 90d: R$ {item.lowestPrice90d.price.toFixed(2).replace('.', ',')} em {item.lowestPrice90d.storeName}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Unit summary line (collapsed + unit configured) */}
            {!expanded && hasUnit && refPrice && refPrice.packageSize != null && refPrice.packageSize > 0 && (
              <Text style={[styles.unitSummary, { color: theme.colors.onSurfaceVariant }]}>
                {formatPricePerUnitDisplay(refPrice.price / refPrice.packageSize, effectiveUnit!)} · {formatPerStdPkg(refPrice.price / refPrice.packageSize, effectiveUnit!, effectiveStdSize!)}
              </Text>
            )}

            {/* MOSTRAR MAIS — always visible */}
            <Pressable onPress={() => setExpanded(e => !e)} style={[styles.expandToggle, { borderColor: theme.colors.outlineVariant }]}>
              <Text style={[styles.expandToggleText, { color: theme.colors.primary }]}>
                {expanded ? 'Ocultar detalhes' : 'Mostrar mais'}
              </Text>
              <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.primary} />
            </Pressable>

            {/* EXPANDED */}
            {expanded && (
              <View>

                {/* ── Unit picker (no unit configured yet) ── */}
                {!hasUnit && (
                  <View style={styles.unitConfigSection}>
                    <Text style={[styles.unitConfigHint, { color: theme.colors.onSurfaceVariant }]}>
                      Configure a unidade para comparar preços por quantidade.
                    </Text>

                    <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>TIPO</Text>
                    <View style={[styles.chipRow, { marginBottom: 12 }]}>
                      {FAMILIES.map(f => (
                        <Chip key={f.key} selected={selectedFamily === f.key}
                          onPress={() => { setSelectedFamily(f.key); setLocalUnit(null); }}
                          compact style={styles.chip}
                        >{f.label}</Chip>
                      ))}
                    </View>

                    {selectedFamily && (
                      <>
                        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>UNIDADE</Text>
                        <View style={[styles.chipRow, { marginBottom: 12 }]}>
                          {unitsForFamily.map(u => (
                            <Chip key={u.symbol} selected={localUnit === u.symbol}
                              onPress={() => setLocalUnit(u.symbol)}
                              compact style={styles.chip}
                            >{u.label} ({u.symbol})</Chip>
                          ))}
                        </View>
                      </>
                    )}

                    {localUnit && (
                      <View>
                        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                          EMBALAGEM PADRÃO ({localUnit.toUpperCase()})
                        </Text>
                        <View style={styles.stdSizeRow}>
                          <RNTextInput
                            style={[styles.expandedTextInput, { borderColor: theme.colors.outline, color: theme.colors.onSurface, flex: 1 }]}
                            value={localStdSizeStr}
                            onChangeText={setLocalStdSizeStr}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                            returnKeyType="done"
                            placeholder={stdSizePlaceholder(localUnit)}
                            placeholderTextColor={theme.colors.onSurfaceVariant}
                            onSubmitEditing={() => setConfirmedStdSizeStr(localStdSizeStr)}
                          />
                          <Text style={[styles.unitSuffix, { color: theme.colors.onSurfaceVariant }]}>{localUnit}</Text>
                          <Pressable
                            onPress={() => setConfirmedStdSizeStr(localStdSizeStr)}
                            style={[styles.confirmSizeButton, { backgroundColor: theme.colors.primary }]}
                            disabled={!localStdSizeStr || parseFloat(localStdSizeStr) <= 0}
                          >
                            <MaterialCommunityIcons name="check" size={16} color={theme.colors.onPrimary} />
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* ── Triangle ── */}
                {hasUnit && effectiveStdSize && (
                  <View>
                    {unitConfiguredInline && (
                      <View style={[styles.inlineConfigBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                        <MaterialCommunityIcons name="check-circle-outline" size={14} color={theme.colors.onPrimaryContainer} />
                        <Text style={[styles.inlineConfigBadgeText, { color: theme.colors.onPrimaryContainer }]}>
                          {effectiveUnit} · emb. padrão {effectiveStdSize}{effectiveUnit}
                        </Text>
                      </View>
                    )}

                    <View style={styles.expandedField}>
                      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                        {getPricePerPackageLabel(effectiveUnit, effectiveStdSize).toUpperCase()}
                      </Text>
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceSymbol, { color: theme.colors.onSurface }]}>R$</Text>
                        <PriceInput key={pricePerPkgKey} initialCents={pricePerPkgCents} onChangeCents={handlePricePerPkgChange}
                          borderColor={theme.colors.outline} textColor={theme.colors.onSurface} placeholderColor={theme.colors.onSurfaceVariant} />
                      </View>
                    </View>

                    <View style={styles.expandedField}>
                      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                        QUANTIDADE ({effectiveUnit!.toUpperCase()})
                      </Text>
                      <View style={styles.stdSizeRow}>
                        <RNTextInput
                          style={[styles.expandedTextInput, { borderColor: theme.colors.outline, color: theme.colors.onSurface, flex: 1 }]}
                          value={packageSizeStr}
                          onChangeText={handlePackageSizeChange}
                          keyboardType="decimal-pad" selectTextOnFocus returnKeyType="done"
                        />
                        <Text style={[styles.unitSuffix, { color: theme.colors.onSurfaceVariant }]}>{effectiveUnit}</Text>
                      </View>
                    </View>

                    <View style={styles.expandedField}>
                      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>PREÇO PAGO</Text>
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceSymbol, { color: theme.colors.onSurface }]}>R$</Text>
                        <PriceInput key={pricePaidKey} initialCents={pricePaidCents} onChangeCents={handlePricePaidChange}
                          borderColor={theme.colors.outline} textColor={theme.colors.onSurface} placeholderColor={theme.colors.onSurfaceVariant} />
                      </View>
                    </View>

                    {derivedPricePerUnit !== null && (
                      <View style={[styles.derivedBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <View style={styles.derivedRow}>
                          <Text style={[styles.derivedLabel, { color: theme.colors.onSurfaceVariant }]}>Preço por unidade</Text>
                          <Text style={[styles.derivedValue, { color: theme.colors.primary }]}>{formatPricePerUnitDisplay(derivedPricePerUnit, effectiveUnit!)}</Text>
                        </View>
                        <View style={styles.derivedRow}>
                          <Text style={[styles.derivedLabel, { color: theme.colors.onSurfaceVariant }]}>Por emb. padrão</Text>
                          <Text style={[styles.derivedValue, { color: theme.colors.primary }]}>{formatPerStdPkg(derivedPricePerUnit, effectiveUnit!, effectiveStdSize)}</Text>
                        </View>
                        {pricePaidCents > 0 && (
                          <View style={styles.derivedRow}>
                            <Text style={[styles.derivedLabel, { color: theme.colors.onSurfaceVariant }]}>Total</Text>
                            <Text style={[styles.derivedValue, { color: theme.colors.primary }]}>{formatCurrency((pricePaidCents / 100) * quantity)}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    <View style={[styles.expandedField, { marginTop: 4 }]}>
                      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>QTD. DE EMBALAGENS</Text>
                      <View style={styles.quantityRow}>
                        <Pressable style={[styles.quantityButton, { borderColor: theme.colors.outline }]} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                          <MaterialCommunityIcons name="minus" size={18} color={theme.colors.primary} />
                        </Pressable>
                        <RNTextInput
                          style={[styles.quantityInput, { color: theme.colors.onSurface }]}
                          value={quantity.toString()}
                          onChangeText={(v) => { const n = parseInt(v, 10); setQuantity(isNaN(n) ? 1 : Math.max(1, n)); }}
                          keyboardType="numeric" selectTextOnFocus returnKeyType="done"
                          onBlur={() => { if (isNaN(quantity) || quantity < 1) setQuantity(1); }}
                        />
                        <Pressable style={[styles.quantityButton, { borderColor: theme.colors.outline }]} onPress={() => setQuantity(quantity + 1)}>
                          <MaterialCommunityIcons name="plus" size={18} color={theme.colors.primary} />
                        </Pressable>
                      </View>
                    </View>

                    <Pressable onPress={() => setUpdateRefPrice(v => !v)} style={styles.checkboxRow}>
                      <MaterialCommunityIcons name={updateRefPrice ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={theme.colors.primary} />
                      <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Atualizar preço de referência</Text>
                    </Pressable>

                    {currentPackageSize > 0 && currentPackageSize !== effectiveStdSize && !unitConfiguredInline && (
                      <Pressable onPress={() => setUpdateStdSize(v => !v)} style={styles.checkboxRow}>
                        <MaterialCommunityIcons name={updateStdSize ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={theme.colors.primary} />
                        <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>
                          Atualizar embalagem padrão para {packageSizeStr}{effectiveUnit}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* TOTAL PREVIEW (collapsed only) */}
            {!expanded && totalPreview && (
              <View style={[styles.totalPreview, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={[styles.totalLabel, { color: theme.colors.onSurfaceVariant }]}>Total</Text>
                <Text style={[styles.totalValue, { color: theme.colors.primary }]}>{totalPreview}</Text>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

            <Button mode="outlined" icon={checked ? "cart-minus" : "cart-plus"} onPress={() => setChecked(prev => !prev)} style={styles.cartButton}>
              {checked ? "Remover do carrinho" : "Mover pro carrinho"}
            </Button>

            <View style={styles.actionRow}>
              <Button mode="contained" onPress={handleSave} style={styles.actionButton}>Salvar</Button>
              <Button mode="contained-tonal" onPress={onDismiss} style={styles.actionButton}>Cancelar</Button>
            </View>

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
            <Text
              style={{
                fontSize: 12,
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                marginBottom: 10,
              }}
            >
              Confirme o tamanho da embalagem da compra abaixo para criar uma
              referência.
            </Text>
            {retroInvoiceInfo && (
              <Text
                style={{
                  fontSize: 12,
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                {retroInvoiceInfo.storeName} •{" "}
                {new Date(retroInvoiceInfo.createdAt).toLocaleDateString(
                  "pt-BR",
                )}{" "}
                • R$ {retroInvoiceInfo.unitPrice.toFixed(2).replace(".", ",")}
              </Text>
            )}

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <RNTextInput
                value={retroPackageSizeText}
                onChangeText={setRetroPackageSizeText}
                keyboardType="decimal-pad"
                style={{ flex: 1 }}
                autoFocus
              />
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontSize: 14,
                  minWidth: 28,
                }}
              >
                {retroUnit ?? ""}
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setRetroVisible(false);
                retroResolveRef.current?.(null);
                retroResolveRef.current = null;
              }}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                const v = parseFloat(
                  (retroPackageSizeText ?? "").replace(",", "."),
                );
                if (!isFinite(v) || v <= 0) return;
                setRetroVisible(false);
                retroResolveRef.current?.(v);
                retroResolveRef.current = null;
              }}
              disabled={
                !isFinite(
                  parseFloat((retroPackageSizeText ?? "").replace(",", ".")),
                ) ||
                parseFloat((retroPackageSizeText ?? "").replace(",", ".")) <= 0
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

const styles = StyleSheet.create({
  modalContainer: { padding: 20, justifyContent: "center", alignItems: "center" },
  surface: { padding: 20, borderRadius: 12, width: "100%", maxWidth: 400, elevation: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  productName: { fontSize: 18, fontWeight: "700", textAlign: "left" },
  categoryChipText: { fontSize: 11 },
  contextRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 4 },
  contextLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  contextRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  contextText: { fontSize: 12 },
  warningText: { fontSize: 11, color: "orange" },
  divider: { marginVertical: 12, height: 1 },
  controlsRow: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  controlHalf: { flex: 1 },
  label: { fontSize: 10, letterSpacing: 0.6, marginBottom: 8 },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  quantityButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  quantityInput: { height: 32, borderWidth: 1, borderRadius: 6, textAlign: "center", fontSize: 16, flex: 1, minWidth: 0, paddingBottom: 4 },
  priceInput: { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 15, flex: 1 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  priceSymbol: { fontSize: 15 },
  lowestPriceInfo: { fontSize: 10, color: "orange", fontStyle: "italic", marginTop: 3 },
  unitSummary: { fontSize: 11, marginTop: 6, fontStyle: "italic" },
  expandToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  expandToggleText: { fontSize: 13, fontWeight: '500' },
  unitConfigSection: { marginBottom: 8 },
  unitConfigHint: { fontSize: 12, marginBottom: 12, fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {},
  stdSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitSuffix: { fontSize: 14, fontWeight: '500', minWidth: 24 },
  inlineConfigBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 14 },
  inlineConfigBadgeText: { fontSize: 12 },
  expandedField: { marginBottom: 14 },
  expandedTextInput: { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 15 },
  derivedBox: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, gap: 4 },
  derivedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  derivedLabel: { fontSize: 12 },
  derivedValue: { fontSize: 13, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  checkboxLabel: { fontSize: 13, marginLeft: 8, flex: 1 },
  totalPreview: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 14 },
  totalLabel: { fontSize: 12 },
  totalValue: { fontSize: 16, fontWeight: "700" },
  cartButton: { marginTop: 8 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionButton: { flex: 1 },
  deleteLink: { alignSelf: "center", marginTop: 10 },
  deleteText: { fontSize: 12 },
  confirmSizeButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
