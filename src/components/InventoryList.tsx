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
    isSelectionMode?: boolean;
    selectedIds?: number[];
    onToggleSelect?: (id: number) => void;
    onLongPressStart?: () => void;
}

export default function InventoryList({  
    inventoryItems, 
    handleInventoryItemOrderChange, 
    onInventoryItemUpdated,
    isSelectionMode = false,
    selectedIds = [],
    onToggleSelect,
    onLongPressStart,
}: InventoryListProps) {
    const theme = useTheme();
    const styles = createHomeScreenStyles(theme);


    const renderItem = useCallback(
        ({ item, drag, isActive }) => (
            <ScaleDecorator>
                <InventoryItemCard
                    inventoryItem={item}
                    drag={drag}
                    isActive={isActive}
                    onInventoryItemUpdated={onInventoryItemUpdated}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={onToggleSelect}
                    onLongPressStart={onLongPressStart}
                />
            </ScaleDecorator>
        ),
        [isSelectionMode, selectedIds, onToggleSelect, onLongPressStart, onInventoryItemUpdated]
    );
    return (
        <DraggableFlatList
            data={inventoryItems}
            onDragEnd={({data}) => handleInventoryItemOrderChange(data)}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 80, paddingTop: 8 }}
            testID="draggable-flatlist"
        />
    );
}
