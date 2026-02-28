import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import {
  Modal,
  Portal,
  Text,
  TextInput,
  Button,
  Surface,
  useTheme,
} from "react-native-paper";

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

  useEffect(() => {
    if (visible) {
      setStoreName(defaultStoreName || "");
    }
  }, [visible, defaultStoreName]);

  const normalizedInput = storeName.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!normalizedInput) return stores.slice(0, 8);
    return stores
      .filter((s) => s.name.toLowerCase().includes(normalizedInput))
      .slice(0, 8);
  }, [stores, normalizedInput]);

  const canConfirm = storeName.trim().length > 0;

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
          <TextInput
            mode="outlined"
            value={storeName}
            onChangeText={setStoreName}
            placeholder="Digite o nome da loja"
            autoCapitalize="words"
            style={styles.input}
          />

          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.id.toString()}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setStoreName(item.name)}
                    style={styles.suggestionRow}
                  >
                    <Text style={styles.suggestionText}>{item.name}</Text>
                  </Pressable>
                )}
              />
            </View>
          )}

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
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  input: {
    width: "100%",
  },
  suggestionsContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    overflow: "hidden",
    maxHeight: 180,
  },
  suggestionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "white",
  },
  suggestionText: {
    fontSize: 14,
    color: "#333",
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
