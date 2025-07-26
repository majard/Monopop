import DraggableFlatList, {
    ScaleDecorator,
} from "react-native-draggable-flatlist";
import { InventoryItemCard } from './InventoryItemCard';
import { useCallback } from 'react';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { useTheme } from 'react-native-paper';
import { InventoryItem } from '../database/models';

interface InventoryListProps {
    inventoryItems: InventoryItem[];
    handleInventoryItemOrderChange: (newOrder: InventoryItem[]) => void;
}

export default function InventoryList({  inventoryItems, handleInventoryItemOrderChange }: InventoryListProps) {
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
