// hooks/useMoveToList.ts
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { getInventoryItems, moveInventoryItemToList } from '../database/database';

interface InventoryItemRef {
  id: number;
  productId: number;
  productName: string;
}

interface List {
  id: number;
  name: string;
}

export function useMoveToList(onSuccess: () => Promise<void>) {
  const moveItems = useCallback(async (
    items: InventoryItemRef[],
    targetList: List,
  ) => {
    // Check for conflicts
    const existingItems = await getInventoryItems(targetList.id);
    const existingProductIds = new Set(existingItems.map(i => i.productId));

    const conflicts = items.filter(i => existingProductIds.has(i.productId));

    if (conflicts.length > 0) {
      const names = conflicts.map(c => c.productName).join(', ');
      const confirmed = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Produto já existe na lista',
          `${names} já ${conflicts.length === 1 ? 'existe' : 'existem'} em "${targetList.name}". Deseja substituir?`,
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Substituir', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });
      if (!confirmed) return;
    }

    for (const item of items) {
      await moveInventoryItemToList(item.id, targetList.id);
    }

    await onSuccess();
  }, [onSuccess]);

  return { moveItems };
}