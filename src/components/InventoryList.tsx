import React, { useCallback, useMemo, useState } from 'react';
import DraggableFlatList, {
    ScaleDecorator,
} from "react-native-draggable-flatlist";
import { SectionList, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { InventoryItemCard } from './InventoryItemCard';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { useTheme } from 'react-native-paper';
import { InventoryItem } from '../database/models';
import { SortOrder } from '../utils/sortUtils';

interface InventoryListProps {
    inventoryItems: InventoryItem[];
    handleInventoryItemOrderChange: (newOrder: InventoryItem[]) => void;
    onInventoryItemUpdated?: () => void;
    isSelectionMode?: boolean;
    selectedIds?: number[];
    onToggleSelect?: (id: number) => void;
    onLongPressStart?: () => void;
    sortOrder?: SortOrder;
}

export default function InventoryList({  
    inventoryItems, 
    handleInventoryItemOrderChange, 
    onInventoryItemUpdated,
    isSelectionMode = false,
    selectedIds = [],
    onToggleSelect,
    onLongPressStart,
    sortOrder = 'custom',
}: InventoryListProps) {
    const theme = useTheme();
    const styles = createHomeScreenStyles(theme);
    
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    const toggleCategory = useCallback((category: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) next.delete(category);
            else next.add(category);
            return next;
        });
    }, []);

    const categorySections = useMemo(() => {
        const grouped = new Map<string, InventoryItem[]>();
        for (const item of inventoryItems) {
            const key = item.categoryName ?? 'Sem categoria';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(item);
        }
        return Array.from(grouped.entries()).map(([title, data]) => ({ title, data }));
    }, [inventoryItems]);


    const renderInventoryItem = useCallback(({ item }: { item: InventoryItem }) => (
        <InventoryItemCard
            inventoryItem={item}
            drag={() => {}}
            isActive={false}
            onInventoryItemUpdated={onInventoryItemUpdated}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.includes(item.id)}
            onToggleSelect={onToggleSelect}
            onLongPressStart={onLongPressStart}
        />
    ), [isSelectionMode, selectedIds, onToggleSelect, onLongPressStart, onInventoryItemUpdated]);

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

    if (sortOrder === 'category') {
        return (
            <SectionList
                sections={categorySections.map(s => ({
                    ...s,
                    data: collapsedCategories.has(s.title) ? [] : s.data,
                }))}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderInventoryItem}
                renderSectionHeader={({ section }) => {
                    const fullCount = categorySections.find(s => s.title === section.title)?.data.length ?? 0;
                    const isCollapsed = collapsedCategories.has(section.title);
                    return (
                        <Pressable
                            onPress={() => toggleCategory(section.title)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                backgroundColor: theme.colors.surfaceVariant,
                                borderRadius: 8,
                                marginBottom: 4,
                                marginTop: 8,
                            }}
                        >
                            <Text variant="labelLarge" style={{
                                color: theme.colors.onSurfaceVariant,
                                textTransform: 'uppercase',
                                fontSize: 12,
                                fontWeight: '700',
                                letterSpacing: 0.8,
                            }}>
                                {section.title} ({fullCount})
                            </Text>
                            <MaterialCommunityIcons
                                name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                                size={20}
                                color={theme.colors.onSurfaceVariant}
                            />
                        </Pressable>
                    );
                }}
                contentContainerStyle={{ paddingBottom: 80, paddingTop: 8, paddingHorizontal: 16 }}
            />
        );
    }

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
