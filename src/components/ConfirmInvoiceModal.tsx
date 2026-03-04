import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import {
  Modal,
  Portal,
  Text,
  Button,
  Surface,
  useTheme,
} from "react-native-paper";
import { getSetting } from "../database/database";
import { SearchablePickerDialog } from "./SearchablePickerDialog";

export interface StoreOption {
  id: number;
  name: string;
}

interface ConfirmInvoiceModalProps {
  visible: boolean;
  stores: StoreOption[];
  defaultStoreName: string;
  onConfirm: (storeName: string) => void;
  onDismiss: () => void;
  loading?: boolean;
}

export function ConfirmInvoiceModal({
  visible,
  stores,
  defaultStoreName,
  onConfirm,
  onDismiss,
  loading,
}: ConfirmInvoiceModalProps) {
  const theme = useTheme();
  const [storeName, setStoreName] = useState("");
  const [defaultStoreMode, setDefaultStoreMode] = useState<'ask' | 'last' | 'fixed'>('ask');
  const [defaultStoreId, setDefaultStoreId] = useState<number | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const [storeMode, storeId] = await Promise.all([
        getSetting('defaultStoreMode'),
        getSetting('defaultStoreId')
      ]);

      setDefaultStoreMode((storeMode as 'ask' | 'last' | 'fixed') || 'ask');
      setDefaultStoreId(storeId ? parseInt(storeId) : null);
    };

    loadSettings();
  }, []);

  useEffect(() => {
    if (visible) {
      let initialStoreName = defaultStoreName || "";

      // Use default store mode to determine initial store
      if (defaultStoreMode !== 'ask' && defaultStoreId) {
        const defaultStore = stores.find(s => s.id === defaultStoreId);
        if (defaultStore) {
          initialStoreName = defaultStore.name;
        }
      }

      setStoreName(initialStoreName);
    }
  }, [visible, defaultStoreName, defaultStoreMode, defaultStoreId, stores]);

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
            onDismiss={() => {}}
          />

          <View style={styles.buttonRow}>
            <Button onPress={onDismiss} style={styles.button}>
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={() => onConfirm(storeName)}
              disabled={!canConfirm || !!loading}
              loading={!!loading}
              style={styles.button}
            >
              Concluir e registrar
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
});
