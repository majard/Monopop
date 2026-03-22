import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput as RNTextInput } from 'react-native';
import { Text, Button, Dialog, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UnitSymbol, getUnitFactor } from '../utils/units';

interface InvoiceInfo {
  storeName: string;
  createdAt: string;
  unitPrice: number;
}

interface UseRetroPromptResult {
  promptForRetroPackageSize: (
    prefill: number,        // atomic value
    unit: string,
    invoiceInfo: InvoiceInfo | null
  ) => Promise<number | null>;  // resolves with atomic value or null
  retroDialogElement: React.ReactElement;
}

export function useRetroPrompt(): UseRetroPromptResult {
  const theme = useTheme();

  const [retroVisible, setRetroVisible] = useState(false);
  const [retroPackageSizeText, setRetroPackageSizeText] = useState('');
  const [retroUnit, setRetroUnit] = useState<string | null>(null);
  const [retroInvoiceInfo, setRetroInvoiceInfo] = useState<InvoiceInfo | null>(null);
  const retroResolveRef = useRef<((value: number | null) => void) | null>(null);

  const promptForRetroPackageSize = useCallback(async (
    prefill: number,
    unit: string,
    invoiceInfo: InvoiceInfo | null,
  ): Promise<number | null> => {
    // Resolve any previous resolver to prevent awaiting callers
    if (retroResolveRef.current) {
      retroResolveRef.current(null);
      retroResolveRef.current = null;
    }
    
    const factor = getUnitFactor(unit as UnitSymbol);
    setRetroInvoiceInfo(invoiceInfo);
    setRetroUnit(unit);
    setRetroPackageSizeText(String(prefill / factor));
    setRetroVisible(true);
    return new Promise(resolve => { retroResolveRef.current = resolve; });
  }, []);

  const handleDismiss = useCallback(() => {
    setRetroVisible(false);
    retroResolveRef.current?.(null);
    retroResolveRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => {
    const v = parseFloat((retroPackageSizeText ?? '').replace(',', '.'));
    if (!isFinite(v) || v <= 0) return;
    const factor = getUnitFactor((retroUnit ?? 'g') as UnitSymbol);
    setRetroVisible(false);
    retroResolveRef.current?.(v * factor);
    retroResolveRef.current = null;
  }, [retroPackageSizeText, retroUnit]);

  const confirmDisabled =
    !isFinite(parseFloat((retroPackageSizeText ?? '').replace(',', '.'))) ||
    parseFloat((retroPackageSizeText ?? '').replace(',', '.')) <= 0;

  const retroDialogElement = (
    <Dialog visible={retroVisible} onDismiss={handleDismiss}>
      <Dialog.Title>Qual era o tamanho da embalagem?</Dialog.Title>
      <Dialog.Content>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Confirme o tamanho da embalagem para criar uma referência.
        </Text>

        {retroInvoiceInfo && (
          <View style={[styles.invoiceCard, { backgroundColor: theme.colors.surfaceVariant }]}>
            <View style={styles.invoiceRow}>
              <MaterialCommunityIcons
                name="store-outline"
                size={14}
                color={theme.colors.onSurfaceVariant}
              />
              <Text style={[styles.invoiceText, { color: theme.colors.onSurfaceVariant }]}>
                {retroInvoiceInfo.storeName}
              </Text>
              <MaterialCommunityIcons
                name="calendar-outline"
                size={14}
                color={theme.colors.onSurfaceVariant}
              />
              <Text style={[styles.invoiceText, { color: theme.colors.onSurfaceVariant }]}>
                {new Date(retroInvoiceInfo.createdAt).toLocaleDateString('pt-BR')}
              </Text>
            </View>
            <Text style={[styles.invoicePrice, { color: theme.colors.onSurface }]}>
              R$ {retroInvoiceInfo.unitPrice.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <RNTextInput
            value={retroPackageSizeText}
            onChangeText={setRetroPackageSizeText}
            keyboardType="decimal-pad"
            autoFocus
            style={[
              styles.input,
              { borderColor: theme.colors.outline, color: theme.colors.onSurface },
            ]}
          />
          <Text style={[styles.unitLabel, { color: theme.colors.onSurfaceVariant }]}>
            {retroUnit ?? ''}
          </Text>
        </View>
      </Dialog.Content>

      <Dialog.Actions>
        <Button onPress={handleDismiss}>Cancelar</Button>
        <Button
          mode="contained"
          onPress={handleConfirm}
          disabled={confirmDisabled}
        >
          Confirmar
        </Button>
      </Dialog.Actions>
    </Dialog>
  );

  // Cleanup on unmount to resolve any remaining promises
  useEffect(() => {
    return () => {
      if (retroResolveRef.current) {
        retroResolveRef.current(null);
        retroResolveRef.current = null;
      }
    };
  }, []);

  return { promptForRetroPackageSize, retroDialogElement };
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  invoiceCard: { borderRadius: 8, padding: 12, marginBottom: 14 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  invoiceText: { fontSize: 12 },
  invoicePrice: { fontSize: 15, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 15 },
  unitLabel: { fontSize: 14, fontWeight: '500', minWidth: 28 },
});