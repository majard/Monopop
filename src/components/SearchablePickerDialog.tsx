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
  onCreateNew: (name: string) => void | Promise<void>;
  title: string;
  placeholder?: string;
  embedded?: boolean;
  selectedName?: string | null; // fallback when selectedId is null
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
  selectedName,
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
    const list = !normalizedInput
      ? items
      : items.filter(item => item.name.toLowerCase().includes(normalizedInput));

    return [...list].sort((a, b) => {
      if (a.id === selectedId) return -1;
      if (b.id === selectedId) return 1;
      return 0;
    });
  }, [items, normalizedInput, selectedId]);

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

  const handleCreateNew = async () => {
    try {
      await onCreateNew(searchText.trim());
      if (!embedded) {
        onDismiss();
      } else {
        setSearchText(''); // clear so full list shows
      }
    } catch (error) {
      console.error('Error creating new item:', error);
      // Keep modal open on error so user can try again or cancel
    }
  };

  const renderItem = ({ item }: { item: { id: number; name: string } }) => (
    <List.Item
      title={item.name}
      onPress={() => handleSelectItem(item.id)}
      right={(props) =>
        (selectedId === item.id || (!selectedId && selectedName === item.name))
        && <List.Icon {...props} icon="check" />
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
      const newStoreEntry = selectedName && !items.find(i => i.name === selectedName)
        ? { id: -1, name: selectedName }
        : null;

      return (
        <ScrollView style={styles.listContainer}>
          {newStoreEntry && (
            <List.Item
              key="new-store"
              title={newStoreEntry.name}
              right={(props) => <List.Icon {...props} icon="check" />}
              titleStyle={{ color: theme.colors.primary }}
              left={(props) => <List.Icon {...props} icon="store-plus" />}
            />
          )}
          {filteredItems.map((item) => (
            <List.Item
              key={item.id}
              title={item.name}
              onPress={() => handleSelectItem(item.id)}
              right={(props) =>
                (selectedId === item.id || selectedName === item.name)
                  ? <List.Icon {...props} icon="check" />
                  : null
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
