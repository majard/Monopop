import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, ScrollView } from "react-native";
import {
  Modal,
  Portal,
  Text,
  TextInput,
  Button,
  Surface,
  useTheme,
  List,
} from "react-native-paper";

interface SearchablePickerDialogProps {
  visible: boolean;
  onDismiss: () => void;
  items: { id: number; name: string }[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreateNew: (name: string) => void;
  title: string;
  placeholder?: string;
  embedded?: boolean;
}

export function SearchablePickerDialog({
  visible,
  onDismiss,
  items,
  selectedId,
  onSelect,
  onCreateNew,
  title,
  placeholder = "Buscar...",
  embedded = false,
}: SearchablePickerDialogProps) {
  const theme = useTheme();
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (visible) {
      setSearchText("");
    }
  }, [visible]);

  const normalizedInput = searchText.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedInput) return items;
    return items.filter((item) =>
      item.name.toLowerCase().includes(normalizedInput)
    );
  }, [items, normalizedInput]);

  const exactMatch = useMemo(() => {
    if (!normalizedInput) return false;
    return items.some(
      (item) => item.name.toLowerCase() === normalizedInput
    );
  }, [items, normalizedInput]);

  const showCreateNew = normalizedInput.length > 0 && !exactMatch;

  const handleSelectItem = (id: number) => {
    onSelect(id);
    if (!embedded) {
      onDismiss();
    }
  };

  const handleCreateNew = () => {
    onCreateNew(searchText.trim());
    if (!embedded) {
      onDismiss();
    }
  };

  const renderItem = ({ item }: { item: { id: number; name: string } }) => (
    <List.Item
      title={item.name}
      onPress={() => handleSelectItem(item.id)}
      right={(props) =>
        selectedId === item.id && <List.Icon {...props} icon="check" />
      }
    />
  );

  const CreateNewItem = () => (
    <List.Item
      title={`Criar "${searchText.trim()}"`}
      onPress={handleCreateNew}
      left={(props) => <List.Icon {...props} icon="plus" />}
      titleStyle={{ color: theme.colors.primary }}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>
        Nenhum item encontrado. Digite para criar.
      </Text>
    </View>
  );

  const renderItemList = () => {
    if (filteredItems.length === 0 && !showCreateNew) {
      return renderEmptyState();
    }

    if (embedded) {
      return (
        <ScrollView style={styles.listContainer}>
          {filteredItems.map((item) => (
            <List.Item
              key={item.id}
              title={item.name}
              onPress={() => handleSelectItem(item.id)}
              right={(props) =>
                selectedId === item.id && <List.Icon {...props} icon="check" />
              }
            />
          ))}
          {showCreateNew && <CreateNewItem />}
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        style={styles.listContainer}
        ListFooterComponent={
          showCreateNew ? <CreateNewItem /> : null
        }
      />
    );
  };

  const content = (
    <>
      {!embedded && (
        <Text style={embedded ? styles.embeddedTitle : styles.title}>{title}</Text>
      )}

      <TextInput
        mode="outlined"
        value={searchText}
        onChangeText={setSearchText}
        placeholder={placeholder}
        autoFocus={visible && !embedded}
        style={styles.input}
        right={
          searchText.trim().length > 0 && (
            <TextInput.Icon
              icon="close"
              onPress={() => setSearchText("")}
              color={theme.colors.error}
            />
          )
        }
      />

      {renderItemList()}

      {!embedded && (
        <View style={styles.buttonRow}>
          <Button onPress={onDismiss} style={styles.button}>
            Cancelar
          </Button>
        </View>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <Surface style={styles.surface}>
          {content}
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
  embeddedSurface: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "white",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  embeddedTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    marginBottom: 16,
  },
  listContainer: {
    maxHeight: 240,
    marginBottom: 16,
  },
  list: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyStateText: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  button: {
    marginLeft: 8,
  },
});
