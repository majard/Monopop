import React from 'react';
import { ScrollView } from 'react-native';
import { Dialog, Portal, List, Button } from 'react-native-paper';

interface StorePickerDialogProps {
  visible: boolean;
  onDismiss: () => void;
  stores: { id: number; name: string }[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function StorePickerDialog({
  visible,
  onDismiss,
  stores,
  selectedId,
  onSelect,
}: StorePickerDialogProps) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Escolher loja</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView>
            {stores.map(store => (
              <List.Item
                key={store.id}
                title={store.name}
                onPress={() => {
                  onSelect(store.id);
                  onDismiss();
                }}
                right={props => selectedId === store.id &&
                  <List.Icon {...props} icon="check" />
                }
              />
            ))}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancelar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
