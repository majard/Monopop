import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import {
  Card,
  Searchbar,
  useTheme,
  FAB,
  Portal,
  Dialog,
  TextInput,
  Button,
  Text,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EditableName } from './EditableName';

interface ManageableItem {
  id: number;
  name: string;
  [key: string]: any;
}

interface ManageableItemListProps<T extends ManageableItem> {
  items: T[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAdd: (name: string, extraData?: any) => void;
  onUpdate: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  getAssociations?: (item: T) => Promise<{ count: number; message: string }>;
  extraFields?: {
    key: string;
    label: string;
    options: { label: string; value: any }[];
  };
  title: string;
  addButtonLabel: string;
  emptyMessage: string;
}

export function ManageableItemList<T extends ManageableItem>({
  items,
  searchQuery,
  onSearchChange,
  onAdd,
  onUpdate,
  onDelete,
  getAssociations,
  extraFields,
  title,
  addButtonLabel,
  emptyMessage,
}: ManageableItemListProps<T>) {
  const theme = useTheme();
  const [isAddDialogVisible, setIsAddDialogVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemExtra, setNewItemExtra] = useState<any>(null);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (item: T) => {
    if (getAssociations) {
      const { count, message } = await getAssociations(item);
      if (count > 0) {
        Alert.alert(
          'Confirmar Exclusão',
          message,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Excluir',
              style: 'destructive',
              onPress: () => onDelete(item.id),
            },
          ]
        );
        return;
      }
    }
    onDelete(item.id);
  };

  const handleAdd = () => {
    if (newItemName.trim()) {
      onAdd(newItemName.trim(), newItemExtra);
      setNewItemName('');
      setNewItemExtra(null);
      setIsAddDialogVisible(false);
    }
  };

  const renderItem = ({ item }: { item: T }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <EditableName
          name={item.name}
          handleSave={(name) => onUpdate(item.id, name)}
          handleDelete={() => handleDelete(item)}
        />
        {extraFields && item[extraFields.key] !== undefined && (
          <Text style={styles.extraField}>
            {extraFields.label}: {extraFields.options.find(o => o.value === item[extraFields.key])?.label || 'Nenhum'}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Buscar..."
        onChangeText={onSearchChange}
        value={searchQuery}
        style={styles.searchBar}
      />

      {filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
        />
      )}

      <FAB
        icon="plus"
        label={addButtonLabel}
        onPress={() => setIsAddDialogVisible(true)}
        style={styles.fab}
      />

      <Portal>
        <Dialog visible={isAddDialogVisible} onDismiss={() => setIsAddDialogVisible(false)}>
          <Dialog.Title>Adicionar {title}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nome"
              value={newItemName}
              onChangeText={setNewItemName}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsAddDialogVisible(false)}>Cancelar</Button>
            <Button onPress={handleAdd} disabled={!newItemName.trim()}>Adicionar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    margin: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  itemCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  extraField: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
