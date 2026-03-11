import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import {
  Modal,
  Portal,
  Text,
  Button,
  Surface,
  useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SearchablePickerDialog } from "./SearchablePickerDialog";
import { DateRangePickerModal } from './DateRangePickerModal';

export interface StoreOption {
  id: number;
  name: string;
}

interface ConfirmInvoiceModalProps {
  visible: boolean;
  stores: StoreOption[];
  defaultStoreName: string;
  total: number;
  onConfirm: (storeName: string, date: Date, updateReferencePrices: boolean) => void;
  onDismiss: () => void;
  loading?: boolean;
  updateReferencePrices?: boolean;
}

export function ConfirmInvoiceModal({
  visible,
  stores,
  defaultStoreName,
  total,
  onConfirm,
  onDismiss,
  loading,
  updateReferencePrices = true,
}: ConfirmInvoiceModalProps) {
  const theme = useTheme();
  const [storeName, setStoreName] = useState("");
  const [date, setDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [updateRef, setUpdateRef] = useState(true);

  useEffect(() => {
    if (visible) {
      setStoreName(defaultStoreName || '');
      setDate(new Date());
      setUpdateRef(true);
    }
  }, [visible, defaultStoreName]);

  const canConfirm = storeName.trim().length > 0;

  const handleStoreSelect = (storeId: number) => {
    const selectedStore = stores.find(s => s.id === storeId);
    if (selectedStore) {
      setStoreName(selectedStore.name);
    }
  };

  const handleCreateNew = (newStoreName: string) => {
    setStoreName(newStoreName);
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <Surface style={styles.surface}>
          <Text style={styles.title}>Confirmar compras</Text>

          <Text style={styles.label}>Loja</Text>
          <SearchablePickerDialog
            visible={visible}
            items={stores}
            selectedId={stores.find(s => s.name === storeName)?.id ?? null}
            onSelect={handleStoreSelect}
            onCreateNew={handleCreateNew}
            title="Selecionar loja"
            placeholder="Digite o nome da loja"
            embedded={true}
            onDismiss={() => { }}
          />

          {/* Total */}
          <View style={[styles.totalRow, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>Total registrado</Text>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 18 }}>
              R$ {total.toFixed(2).replace('.', ',')}
            </Text>
          </View>

          {/* Date */}
          <Text style={styles.label}>Data</Text>
          <Pressable
            onPress={() => setDatePickerVisible(true)}
            style={[styles.dateButton, { borderColor: theme.colors.outline }]}
          >
            <MaterialCommunityIcons name="calendar" size={18} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.onSurface, fontSize: 15 }}>
              {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setUpdateRef(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}
          >
            <MaterialCommunityIcons
              name={updateRef ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={20}
              color={updateRef ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text style={{ color: theme.colors.onSurface, fontSize: 14 }}>
              Atualizar preços de referência
            </Text>
          </Pressable>

          <View style={styles.buttonRow}>
            <Button onPress={onDismiss} style={styles.button}>
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={() => onConfirm(storeName, date, updateRef)}
              disabled={!canConfirm || !!loading}
              loading={!!loading}
              style={styles.button}
            >
              Concluir e registrar
            </Button>
          </View>
        </Surface>
      </Modal>
      <DateRangePickerModal
        visible={datePickerVisible}
        value={{ start: date, end: date }}
        onConfirm={(range) => {
          if (range.start) setDate(range.start);
          setDatePickerVisible(false);
        }}
        onDismiss={() => setDatePickerVisible(false)}
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
    maxWidth: 420,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  button: {
    marginLeft: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
});
