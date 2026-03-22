import React from 'react';
import { ScrollView } from 'react-native';
import { Dialog, Portal, List, Button } from 'react-native-paper';

interface Item {
  id: number;
  name: string;
}

interface ItemPickerDialogProps {
  visible: boolean;
  onDismiss: () => void;
  items: Item[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  title: string;
  withNullOption?: boolean;
  nullOptionLabel?: string
}

export function ItemPickerDialog({
  visible,
  onDismiss,
  items,
  selectedId,
  onSelect,
  title,
  withNullOption = false,
  nullOptionLabel = 'Nenhuma',
}: ItemPickerDialogProps) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView>
            {withNullOption && (
              <List.Item
                title={nullOptionLabel}
                onPress={() => { onSelect(null); onDismiss(); }}
                right={props => selectedId === null && <List.Icon {...props} icon="check" />}
              />
            )}
            {items.map(item => (
              <List.Item
                key={item.id}
                title={item.name}
                onPress={() => {
                  onSelect(item.id);
                  onDismiss();
                }}
                right={props => selectedId === item.id &&
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
