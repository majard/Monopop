import React, {
    useRef,
    useState,
    useCallback,
    useMemo,
    useEffect,
    useImperativeHandle,
    forwardRef,
} from 'react';
import { View, StyleSheet, TextInput as RNTextInput, Pressable } from 'react-native';
import { Text, Chip, useTheme, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    UNITS,
    UNITS_BY_FAMILY,
    getUnitFactor,
    getPricePerPackageLabel,
    formatPricePerUnitDisplay,
    formatPerStdPkg,
    formatStandardPackageDisplay,
    UnitSymbol,
    UnitFamily,
    Unit,
} from '../utils/units';
import type { RefPrice } from '../database/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriangleValue {
    pricePaid: number | undefined;
    packageSize: number | null;       // atomic (grams / ml / un)
    updateRefPrice: boolean;
    updateStdSize: boolean;
    unitConfigData: {
        unit: UnitSymbol;               // display unit chosen (e.g. 'kg')
        newStandardPackageSize: number; // atomic (e.g. 1000 for 1kg)
    } | null;
}

export interface PriceTriangleHandle {
    getValue: () => TriangleValue;
    seed: (data: SeedData) => void;
    reset: () => void;
}

export interface SeedData {
    pricePerPkg: number;          // R$ for one standard package
    packageSize: number;          // atomic
    pricePaid: number;            // R$
    unit: UnitSymbol;
    standardPackageSize: number;  // atomic
}

interface PriceTriangleProps {
    productUnit: UnitSymbol | null;
    productStandardPackageSize: number | null;  // atomic
    refPrice?: RefPrice | null;
    manualOverrideActive?: boolean;
    initialPrice?: number;
    initialPackageSize?: number | null;         // atomic
    quantity: number;
    onQuantityChange: (q: number) => void;
    lowestRefPricePerUnit?: { pricePerUnit: number; storeName: string } | null;
    selectedStoreName?: string | null;
    onUnitConfigured?: () => void;
}

// ─── PriceInput ───────────────────────────────────────────────────────────────

const PriceInput = React.memo(forwardRef<RNTextInput, {
    onChangeCents: (cents: number) => void;
    borderColor: string;
    textColor: string;
    initialCents: number;
    fontSize?: number;
    autoFocus?: boolean;
    clearOnFocus?: boolean;
}>(({ onChangeCents, borderColor, textColor, initialCents, fontSize = 15, autoFocus, clearOnFocus = true }, ref) => {
    const [cents, setCents] = useState(initialCents);
    const centsRef = useRef(initialCents);

    const formatted = useMemo(() => {
        const int = Math.floor(cents / 100);
        const dec = cents % 100;
        return `${int},${dec.toString().padStart(2, '0')}`;
    }, [cents]);

    const handleKeyPress = useCallback((e: any) => {
        const key = e.nativeEvent.key;
        let next = centsRef.current;

        if (key >= '0' && key <= '9') {
            next = centsRef.current * 10 + (key.charCodeAt(0) - 48);
            if (next > 999999999) return;
        } else if (key === 'Backspace') {
            next = Math.floor(centsRef.current / 10);
        } else {
            return;
        }

        centsRef.current = next;
        setCents(next);
        onChangeCents(next);
    }, [onChangeCents]);

    return (
        <RNTextInput
            ref={ref}
            value={formatted}
            keyboardType="number-pad"
            onKeyPress={handleKeyPress}
            selection={{ start: formatted.length, end: formatted.length }}
            onFocus={() => {
                if (!clearOnFocus) return;
                centsRef.current = 0;
                setCents(0);
                onChangeCents(0);
            }}
            contextMenuHidden
            selectTextOnFocus={false}
            caretHidden
            autoFocus={autoFocus}
            style={[styles.priceInput, { borderColor, color: textColor, fontSize }]}
        />
    );
}));
// ─── Component ────────────────────────────────────────────────────────────────

export const PriceTriangle = forwardRef<PriceTriangleHandle, PriceTriangleProps>(
    function PriceTriangle(
        {
            productUnit,
            productStandardPackageSize,
            refPrice,
            manualOverrideActive = false,
            initialPrice,
            initialPackageSize,
            quantity,
            onQuantityChange,
            lowestRefPricePerUnit,
            selectedStoreName,
            onUnitConfigured,
        },
        ref
    ) {
        const theme = useTheme();

        // ─── Triangle refs ────────────────────────────────────────────────────────
        const pricePerPkgRef = useRef(0);   // cents, in display units
        const packageSizeRef = useRef(0);   // in display units (atomic / factor)
        const pricePaidRef = useRef(0);     // cents
        const lastTouchedRef = useRef<('pkg' | 'size' | 'paid')[]>([]);
        const [lastTouchedState, setLastTouchedState] = useState<('pkg' | 'size' | 'paid')[]>([]);

        // ─── Triangle render state ────────────────────────────────────────────────
        const [pricePerPkgCents, setPricePerPkgCents] = useState(0);
        const [pricePerPkgKey, setPricePerPkgKey] = useState(0);
        const [packageSizeStr, setPackageSizeStr] = useState('');
        const [pricePaidCents, setPricePaidCents] = useState(0);
        const [pricePaidKey, setPricePaidKey] = useState(0);

        // ─── Unit configurator state (setup mode) ─────────────────────────────────
        const [selectedFamily, setSelectedFamily] = useState<UnitFamily | null>(null);
        const [selectedUnitSymbol, setSelectedUnitSymbol] = useState<UnitSymbol | null>(null);
        const [stdSizeInputStr, setStdSizeInputStr] = useState('');
        const [confirmedConfig, setConfirmedConfig] = useState<{
            unit: UnitSymbol;
            newStandardPackageSize: number;
        } | null>(null);

        // ─── Options ──────────────────────────────────────────────────────────────
        const [updateRefPrice, setUpdateRefPrice] = useState(true);
        const [updateStdSize, setUpdateStdSize] = useState(false);

        // ─── Derived values ───────────────────────────────────────────────────────

        // The active unit — from product or from inline config
        const activeUnit: Unit | null = useMemo(() => {
            const sym = productUnit ?? confirmedConfig?.unit ?? null;
            return sym ? (UNITS.find(u => u.symbol === sym) ?? null) : null;
        }, [productUnit, confirmedConfig]);

        const factor = activeUnit?.factor ?? 1;

        // Effective stdSize for triangle math (in display units)
        const effectiveAtomicStdSize = productStandardPackageSize ?? confirmedConfig?.newStandardPackageSize ?? null;
        const displayStdSize = effectiveAtomicStdSize != null ? effectiveAtomicStdSize / factor : null;

        useEffect(() => {
            if (!productUnit || !productStandardPackageSize) return;
            if (pricePerPkgRef.current !== 0 || pricePaidRef.current !== 0) return;

            const f = getUnitFactor(productUnit);

            if (refPrice && refPrice.packageSize && refPrice.packageSize > 0) {
                const refPPU = refPrice.price / refPrice.packageSize;
                const pricePerPkg = refPPU * productStandardPackageSize;
                const initAtomicPkgSize = initialPackageSize ?? refPrice.packageSize;
                const initPaid = initAtomicPkgSize === refPrice.packageSize
                    ? refPrice.price
                    : refPPU * initAtomicPkgSize;

                pricePerPkgRef.current = Math.round(pricePerPkg * 100);
                packageSizeRef.current = initAtomicPkgSize / f;
                pricePaidRef.current = Math.round(initPaid * 100);
            } else if (initialPrice && initialPrice > 0) {
                // No refPrice but item has a price — seed from item.price directly
                const initAtomicPkgSize = initialPackageSize ?? productStandardPackageSize;
                const atomicPPU = initialPrice / initAtomicPkgSize;
                const pricePerPkg = atomicPPU * productStandardPackageSize;

                pricePerPkgRef.current = Math.round(pricePerPkg * 100);
                packageSizeRef.current = initAtomicPkgSize / f;
                pricePaidRef.current = Math.round(initialPrice * 100);
            } else {
                // No price data — pre-fill packageSize with stdSize so user only needs to enter price
                packageSizeRef.current = productStandardPackageSize / f;
                setPackageSizeStr(String(packageSizeRef.current));
            }

            setPricePerPkgCents(pricePerPkgRef.current);
            setPricePerPkgKey(k => k + 1);
            setPackageSizeStr(String(packageSizeRef.current));
            setPricePaidCents(pricePaidRef.current);
            setPricePaidKey(k => k + 1);
        }, []); // eslint-disable-line react-hooks/exhaustive-deps

        // Which field is currently derived
        const derivedField: 'pkg' | 'size' | 'paid' | null = useMemo(() => {
            if (lastTouchedState.length < 2) return null;
            const all: ('pkg' | 'size' | 'paid')[] = ['pkg', 'size', 'paid'];
            return all.find(f => !lastTouchedState.includes(f)) ?? null;
        }, [lastTouchedState]);

        // Derived display values
        const currentDisplayPkgSize = parseFloat(packageSizeStr) || 0;
        const currentAtomicPkgSize = currentDisplayPkgSize * factor;
        const atomicPPU = (pricePaidRef.current > 0 && currentAtomicPkgSize > 0)
            ? (pricePaidRef.current / 100) / currentAtomicPkgSize
            : null;
        const showDerivedBox = atomicPPU !== null && activeUnit !== null && effectiveAtomicStdSize !== null;

        const showWarning = !!(
            showDerivedBox &&
            lowestRefPricePerUnit &&
            atomicPPU! > lowestRefPricePerUnit.pricePerUnit
        );

        // updateStdSize checkbox visibility
        const atomicPackageSizeForCheck = currentDisplayPkgSize * factor;
        const showUpdateStdSize = !!(
            confirmedConfig === null &&
            productUnit !== null &&
            effectiveAtomicStdSize !== null &&
            atomicPackageSizeForCheck > 0 &&
            Math.abs(atomicPackageSizeForCheck - effectiveAtomicStdSize) > 0.001
        );

        // Checkbox label
        const refCheckboxLabel = useMemo(() => {
            if (manualOverrideActive && selectedStoreName) {
                return `Substituir ajuste manual e salvar em ${selectedStoreName}`;
            }
            if (selectedStoreName) return `Salvar referência em ${selectedStoreName}`;
            return 'Salvar como preço base';
        }, [manualOverrideActive, selectedStoreName]);

        const refCheckboxHint = manualOverrideActive
            ? 'Preço não será salvo — ajuste manual mantido'
            : 'Preço não será salvo como referência';

        // ─── Triangle logic ───────────────────────────────────────────────────────

        const touchField = useCallback((field: 'pkg' | 'size' | 'paid') => {
            const filtered = lastTouchedRef.current.filter(f => f !== field).slice(-1);
            const next = [...filtered, field];
            lastTouchedRef.current = next;    // for constraint logic — synchronous
            setLastTouchedState(next);        // for visual indicator — triggers render
        }, []);

        const deriveThird = useCallback((std: number) => {
            if (std === 0) return;
            const touched = lastTouchedRef.current;
            const deriveKey = touched.length >= 2
                ? `${touched[0]}+${touched[1]}`
                : touched[0] ?? null;

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
            // fallback
            if (packageSizeRef.current > 0 && pricePaidRef.current > 0) {
                const ppu = (pricePaidRef.current / 100) / packageSizeRef.current;
                const pkg = Math.round(ppu * std * 100);
                pricePerPkgRef.current = pkg;
                setPricePerPkgCents(pkg);
                setPricePerPkgKey(k => k + 1);
            }
        }, []);

        // ─── Triangle handlers ────────────────────────────────────────────────────

        const handlePricePerPkgChange = useCallback((cents: number) => {
            pricePerPkgRef.current = cents;
            setPricePerPkgCents(cents);
            touchField('pkg');
            if (displayStdSize) deriveThird(displayStdSize);
        }, [touchField, deriveThird, displayStdSize]);

        const handlePackageSizeChange = useCallback((text: string) => {
            setPackageSizeStr(text);
            const val = parseFloat(text.replace(',', '.'));
            packageSizeRef.current = isNaN(val) ? 0 : val;
            touchField('size');
            if (displayStdSize) deriveThird(displayStdSize);
        }, [touchField, deriveThird, displayStdSize]);

        const handlePricePaidChange = useCallback((cents: number) => {
            pricePaidRef.current = cents;
            setPricePaidCents(cents);
            touchField('paid');
            if (displayStdSize) deriveThird(displayStdSize);
        }, [touchField, deriveThird, displayStdSize]);

        // ─── Imperative handle ────────────────────────────────────────────────────

        useImperativeHandle(ref, () => ({
            getValue(): TriangleValue {
                const pricePaid = pricePaidRef.current > 0
                    ? pricePaidRef.current / 100
                    : undefined;
                const atomicPackageSize = packageSizeRef.current > 0
                    ? packageSizeRef.current * factor
                    : null;
                return {
                    pricePaid,
                    packageSize: atomicPackageSize,
                    updateRefPrice,
                    updateStdSize,
                    unitConfigData: confirmedConfig ?? null,
                };
            },

            seed(data: SeedData) {
                const unit = UNITS.find(u => u.symbol === data.unit);
                if (!unit) return;
                const f = unit.factor;
                const displayPkgSize = data.packageSize / f;
                const displayStd = data.standardPackageSize / f;

                // pricePerPkg is already R$ for one standard package
                pricePerPkgRef.current = Math.round(data.pricePerPkg * 100);
                packageSizeRef.current = displayPkgSize;
                pricePaidRef.current = Math.round(data.pricePaid * 100);

                setPricePerPkgCents(pricePerPkgRef.current);
                setPricePerPkgKey(k => k + 1);
                setPackageSizeStr(String(displayPkgSize));
                setPricePaidCents(pricePaidRef.current);
                setPricePaidKey(k => k + 1);
                lastTouchedRef.current = [];
            },

            reset() {
                pricePerPkgRef.current = 0;
                packageSizeRef.current = 0;
                pricePaidRef.current = 0;
                setPricePerPkgCents(0);
                setPricePerPkgKey(k => k + 1);
                setPackageSizeStr('');
                setPricePaidCents(0);
                setPricePaidKey(k => k + 1);
                lastTouchedRef.current = [];
                setLastTouchedState([]);
            },
        }), [factor, updateRefPrice, updateStdSize, confirmedConfig]);

        // ─── Setup mode handlers ──────────────────────────────────────────────────

        const handleFamilySelect = useCallback((family: UnitFamily) => {
            setSelectedFamily(family);
            setSelectedUnitSymbol(null);
            setStdSizeInputStr('');
        }, []);

        const handleUnitSelect = useCallback((sym: UnitSymbol) => {
            setSelectedUnitSymbol(sym);
            setStdSizeInputStr('');
        }, []);

        const handleConfirmStdSize = useCallback(() => {
            if (!selectedUnitSymbol) return;
            const unit = UNITS.find(u => u.symbol === selectedUnitSymbol)!;
            const displayVal = parseFloat(stdSizeInputStr.replace(',', '.')) || unit.defaultStdSize;
            const atomicStdSize = displayVal * unit.factor;
            setConfirmedConfig({ unit: selectedUnitSymbol, newStandardPackageSize: atomicStdSize });

            // Seed triangle from initialPrice if available
            if (initialPrice && initialPrice > 0) {
                const displayPkgSize = (initialPackageSize ?? atomicStdSize) / unit.factor;
                const displayStd = atomicStdSize / unit.factor;
                const ppu = initialPrice / displayPkgSize;
                const pricePerPkg = ppu * displayStd;

                pricePerPkgRef.current = Math.round(pricePerPkg * 100);
                packageSizeRef.current = displayPkgSize;
                pricePaidRef.current = Math.round(initialPrice * 100);

                setPricePerPkgCents(pricePerPkgRef.current);
                setPricePerPkgKey(k => k + 1);
                setPackageSizeStr(String(displayPkgSize));
                setPricePaidCents(pricePaidRef.current);
                setPricePaidKey(k => k + 1);
                lastTouchedRef.current = [];
            }

            onUnitConfigured?.();
        }, [selectedUnitSymbol, stdSizeInputStr, initialPrice, initialPackageSize, onUnitConfigured]);

        const handleEditConfig = useCallback(() => {
            setConfirmedConfig(null);
        }, []);

        // ─── Field style helper ───────────────────────────────────────────────────

        const fieldStyle = (field: 'pkg' | 'size' | 'paid') => ({
            backgroundColor: derivedField === field
                ? theme.colors.surfaceVariant
                : 'transparent',
            borderRadius: 8,
            padding: 4,
        });

        const fieldLabelPrefix = (field: 'pkg' | 'size' | 'paid') =>
            derivedField === field ? '≈ ' : '';

        // ─── Render: setup mode ───────────────────────────────────────────────────

        const isConfigured = !!productUnit || !!confirmedConfig;

        if (!isConfigured) {
            const unitsForFamily = selectedFamily
                ? UNITS_BY_FAMILY[selectedFamily]
                : [];
            const selectedUnitObj = selectedUnitSymbol
                ? UNITS.find(u => u.symbol === selectedUnitSymbol)
                : null;

            return (
                <View style={styles.setupContainer}>
                    <Text style={[styles.setupTitle, { color: theme.colors.onSurfaceVariant }]}>
                        Como medir este produto?
                    </Text>

                    <View style={styles.chipRow}>
                        {(['massa', 'volume', 'contagem'] as UnitFamily[]).map(family => {
                            const labels: Record<UnitFamily, string> = {
                                massa: 'Peso',
                                volume: 'Volume',
                                contagem: 'Contagem',
                            };
                            return (
                                <Chip
                                    key={family}
                                    selected={selectedFamily === family}
                                    onPress={() => handleFamilySelect(family)}
                                    style={styles.chip}
                                >
                                    {labels[family]}
                                </Chip>
                            );
                        })}
                    </View>

                    {selectedFamily && (
                        <>
                            <View style={[styles.chipRow, { marginTop: 8 }]}>
                                {unitsForFamily.map(u => (
                                    <Chip
                                        key={u.symbol}
                                        selected={selectedUnitSymbol === u.symbol}
                                        onPress={() => handleUnitSelect(u.symbol)}
                                        style={styles.chip}
                                    >
                                        {u.symbol}
                                    </Chip>
                                ))}
                            </View>

                            {selectedUnitSymbol && (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
                                        EMBALAGEM PADRÃO
                                    </Text>
                                    <View style={styles.stdSizeRow}>
                                        <RNTextInput
                                            value={stdSizeInputStr}
                                            onChangeText={setStdSizeInputStr}
                                            keyboardType="decimal-pad"
                                            placeholder={String(selectedUnitObj?.defaultStdSize ?? '')}
                                            placeholderTextColor={theme.colors.onSurfaceVariant}
                                            style={[
                                                styles.stdSizeInput,
                                                {
                                                    borderColor: theme.colors.outline,
                                                    color: theme.colors.onSurface,
                                                },
                                            ]}
                                            returnKeyType="done"
                                            onSubmitEditing={handleConfirmStdSize}
                                        />
                                        <Text style={[styles.unitSuffix, { color: theme.colors.onSurfaceVariant }]}>
                                            {selectedUnitSymbol}
                                        </Text>
                                        <Pressable
                                            onPress={handleConfirmStdSize}
                                            style={[
                                                styles.confirmButton,
                                                { backgroundColor: theme.colors.primary },
                                            ]}
                                        >
                                            <MaterialCommunityIcons
                                                name="check"
                                                size={16}
                                                color={theme.colors.onPrimary}
                                            />
                                        </Pressable>
                                    </View>
                                    <Text style={[styles.setupHint, { color: theme.colors.onSurfaceVariant }]}>
                                        Deixe em branco para usar o padrão ({selectedUnitObj?.defaultStdSize}{selectedUnitSymbol})
                                    </Text>
                                </View>
                            )}
                        </>
                    )}
                </View>
            );
        }

        // ─── Render: configured mode ──────────────────────────────────────────────

        const unitSym = (productUnit ?? confirmedConfig?.unit)!;
        const atomicStd = effectiveAtomicStdSize!;
        const displayStd = atomicStd / factor;

        return (
            <View>
                {/* Inline config badge */}
                {confirmedConfig && (
                    <View style={[styles.configBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                        <MaterialCommunityIcons
                            name="check-circle-outline"
                            size={14}
                            color={theme.colors.onPrimaryContainer}
                        />
                        <Text style={[styles.configBadgeText, { color: theme.colors.onPrimaryContainer }]}>
                            {unitSym} · emb. padrão {formatStandardPackageDisplay(unitSym, atomicStd)}
                        </Text>
                        <Pressable onPress={handleEditConfig}>
                            <Text style={[styles.editLink, { color: theme.colors.primary }]}>
                                editar
                            </Text>
                        </Pressable>
                    </View>
                )}

                {/* Top row: pricePerPkg + packageSize */}
                <View style={styles.topRow}>
                    {/* Price per package */}
                    <View style={[styles.fieldHalf, fieldStyle('pkg')]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
                            {fieldLabelPrefix('pkg')}{getPricePerPackageLabel(unitSym, atomicStd).toUpperCase()}
                        </Text>
                        <View style={styles.priceRow}>
                            <Text style={[styles.priceSymbol, { color: theme.colors.onSurface }]}>R$</Text>
                            <PriceInput
                                key={pricePerPkgKey}
                                initialCents={pricePerPkgCents}
                                onChangeCents={handlePricePerPkgChange}
                                borderColor={theme.colors.outline}
                                textColor={theme.colors.onSurface}
                            />
                        </View>
                    </View>

                    {/* Package size */}
                    <View style={[styles.fieldHalf, fieldStyle('size')]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
                            {fieldLabelPrefix('size')}TAMANHO
                        </Text>
                        <View style={styles.sizeRow}>
                            <RNTextInput
                                value={packageSizeStr}
                                onChangeText={handlePackageSizeChange}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                                returnKeyType="done"
                                style={[
                                    styles.sizeInput,
                                    {
                                        borderColor: derivedField === 'size'
                                            ? theme.colors.outline
                                            : theme.colors.outline,
                                        color: theme.colors.onSurface,
                                    },
                                ]}
                            />
                            <Text style={[styles.unitSuffix, { color: theme.colors.onSurfaceVariant }]}>
                                {unitSym}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Bottom row: pricePaid + quantity */}
                <View style={[styles.bottomRow, { marginTop: 12 }]}>
                    {/* Price paid — primary field */}
                    <View style={[styles.fieldThreeFifths, fieldStyle('paid')]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
                            {fieldLabelPrefix('paid')}PREÇO PAGO
                        </Text>
                        <View style={styles.priceRow}>
                            <Text style={[styles.priceSymbolLarge, { color: theme.colors.onSurface }]}>R$</Text>
                            <PriceInput
                                key={pricePaidKey}
                                initialCents={pricePaidCents}
                                onChangeCents={handlePricePaidChange}
                                borderColor={theme.colors.outline}
                                textColor={theme.colors.onSurface}
                                fontSize={18}
                                autoFocus={!!productUnit && !confirmedConfig}
                                clearOnFocus={false}
                            />
                        </View>
                    </View>

                    {/* Quantity stepper */}
                    <View style={styles.fieldTwoFifths}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
                            QTD
                        </Text>
                        <View style={styles.quantityRow}>
                            <Pressable
                                style={[styles.qtyButton, { borderColor: theme.colors.outline }]}
                                onPress={() => onQuantityChange(Math.max(1, quantity - 1))}
                            >
                                <MaterialCommunityIcons name="minus" size={16} color={theme.colors.primary} />
                            </Pressable>
                            <RNTextInput
                                value={String(quantity)}
                                onChangeText={v => {
                                    const n = parseInt(v, 10);
                                    onQuantityChange(isNaN(n) ? 1 : Math.max(1, n));
                                }}
                                keyboardType="numeric"
                                selectTextOnFocus
                                style={[styles.qtyInput, { color: theme.colors.onSurface }]}
                            />
                            <Pressable
                                style={[styles.qtyButton, { borderColor: theme.colors.outline }]}
                                onPress={() => onQuantityChange(quantity + 1)}
                            >
                                <MaterialCommunityIcons name="plus" size={16} color={theme.colors.primary} />
                            </Pressable>
                        </View>
                    </View>
                </View>

                {/* Derived info box */}
                {showDerivedBox && (
                    <View style={[styles.derivedBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <View style={styles.derivedRow}>
                            <Text style={[styles.derivedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Preço por unidade
                            </Text>
                            <Text style={[styles.derivedValue, { color: theme.colors.primary }]}>
                                {formatPricePerUnitDisplay(atomicPPU!, unitSym)}
                            </Text>
                        </View>
                        <View style={styles.derivedRow}>
                            <Text style={[styles.derivedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Por emb. padrão
                            </Text>
                            <Text style={[styles.derivedValue, { color: theme.colors.primary }]}>
                                {formatPerStdPkg(atomicPPU!, unitSym, atomicStd)}
                            </Text>
                        </View>
                        {pricePaidCents > 0 && (
                            <View style={styles.derivedRow}>
                                <Text style={[styles.derivedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Total
                                </Text>
                                <Text style={[styles.derivedValue, { color: theme.colors.primary }]}>
                                    {`R$ ${((pricePaidCents / 100) * quantity).toFixed(2).replace('.', ',')}`}
                                </Text>
                            </View>
                        )}
                        {showWarning && lowestRefPricePerUnit && (
                            <View style={[styles.derivedRow, { marginTop: 4 }]}>
                                <MaterialCommunityIcons
                                    name="alert-circle-outline"
                                    size={13}
                                    color="orange"
                                />
                                <Text style={[styles.warningText, { color: 'orange' }]}>
                                    {' '}Mín. ref: {formatPerStdPkg(lowestRefPricePerUnit.pricePerUnit, unitSym, atomicPackageSizeForCheck)} em {lowestRefPricePerUnit.storeName}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Options */}
                <View style={{ marginTop: 8 }}>
                    <Pressable
                        onPress={() => setUpdateRefPrice(v => !v)}
                        style={styles.checkboxRow}
                    >
                        <MaterialCommunityIcons
                            name={updateRefPrice ? 'checkbox-marked' : 'checkbox-blank-outline'}
                            size={20}
                            color={theme.colors.primary}
                        />
                        <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>
                            {refCheckboxLabel}
                        </Text>
                    </Pressable>
                    {!updateRefPrice && (
                        <Text style={[styles.checkboxHint, { color: theme.colors.onSurfaceVariant }]}>
                            {refCheckboxHint}
                        </Text>
                    )}

                    {showUpdateStdSize && (
                        <Pressable
                            onPress={() => setUpdateStdSize(v => !v)}
                            style={styles.checkboxRow}
                        >
                            <MaterialCommunityIcons
                                name={updateStdSize ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                size={20}
                                color={theme.colors.primary}
                            />
                            <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>
                                Atualizar emb. padrão para {formatStandardPackageDisplay(unitSym, atomicPackageSizeForCheck)}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    }
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // Setup mode
    setupContainer: { gap: 8 },
    setupTitle: { fontSize: 14, marginBottom: 8 },
    setupHint: { fontSize: 11, fontStyle: 'italic', marginTop: 4 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {},
    stdSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stdSizeInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        fontSize: 15,
    },
    confirmButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Configured mode layout
    topRow: { flexDirection: 'row', gap: 12 },
    bottomRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
    fieldHalf: { flex: 1 },
    fieldThreeFifths: { flex: 1.5 },
    fieldTwoFifths: { flex: 1 },

    // Field internals
    fieldLabel: { fontSize: 10, letterSpacing: 0.6, marginBottom: 6 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    priceSymbol: { fontSize: 15 },
    priceSymbolLarge: { fontSize: 18 },
    priceInput: { borderWidth: 1, borderRadius: 8, padding: 8, flex: 1 },
    sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sizeInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        fontSize: 15,
    },
    unitSuffix: { fontSize: 14, fontWeight: '500', minWidth: 24 },

    // Quantity stepper
    quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    qtyButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyInput: {
        height: 48,
        minWidth: 32,
        textAlign: 'center',
        fontSize: 14,
        paddingHorizontal: 4,
    },

    // Derived box
    derivedBox: {
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 12,
        gap: 4,
    },
    derivedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    derivedLabel: { fontSize: 12 },
    derivedValue: { fontSize: 13, fontWeight: '600' },
    warningText: { fontSize: 12, flex: 1 },

    // Config badge
    configBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 12,
    },
    configBadgeText: { fontSize: 12, flex: 1 },
    editLink: { fontSize: 12, textDecorationLine: 'underline' },

    // Checkboxes
    checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    checkboxLabel: { fontSize: 13, marginLeft: 8, flex: 1 },
    checkboxHint: { fontSize: 11, marginLeft: 28, marginBottom: 4, fontStyle: 'italic' },
});