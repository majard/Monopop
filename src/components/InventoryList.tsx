import React, { useCallback } from 'react';
import DraggableFlatList, {
    ScaleDecorator,
} from "react-native-draggable-flatlist";
import { InventoryItemCard } from './InventoryItemCard';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { useTheme } from 'react-native-paper';
import { InventoryItem } from '../database/models';

interface InventoryListProps {
    inventoryItems: InventoryItem[];
    handleInventoryItemOrderChange: (newOrder: InventoryItem[]) => void;
    onInventoryItemUpdated?: () => void;
}

export default function InventoryList({  inventoryItems, handleInventoryItemOrderChange, onInventoryItemUpdated }: InventoryListProps) {
    const theme = useTheme();
    const styles = createHomeScreenStyles(theme);


    const renderItem = useCallback(
        ({
            item,
            drag,
            isActive,
        }: {
            item: InventoryItem;
            drag: () => void;
            isActive: boolean;
        }) => (
            <ScaleDecorator>
                <InventoryItemCard
                    inventoryItem={item}
                    drag={drag}
                    isActive={isActive}
                    onInventoryItemUpdated={onInventoryItemUpdated}
                />
            </ScaleDecorator>
        ),
        []
    );
    return (
        <DraggableFlatList
            data={inventoryItems}
            onDragEnd={({data}) => handleInventoryItemOrderChange(data)}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            testID="draggable-flatlist"
        />
    );
}
