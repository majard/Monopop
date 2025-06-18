import DraggableFlatList, {
    ScaleDecorator,
} from "react-native-draggable-flatlist";
import { ProductCard } from './ProductCard';
import useProducts from '../hooks/useProducts';
import { useCallback } from 'react';
import { SortOrder } from '../utils/sortUtils';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { useTheme } from 'react-native-paper';
import { Product } from '../database/database';

interface ProductListProps {
    listId: number;
    sortOrder: SortOrder;
    searchQuery: string;
}

export default function ProductList({ listId, sortOrder, searchQuery }: ProductListProps) {
    const theme = useTheme();
    const styles = createHomeScreenStyles(theme);

    const {
        products,
        filteredProducts,
        loadProducts,
        handleProductOrderChange,
        saveProductHistory,
    } = useProducts(listId, sortOrder, searchQuery);


    const renderItem = useCallback(
        ({
            item,
            drag,
            isActive,
        }: {
            item: Product;
            drag: () => void;
            isActive: boolean;
        }) => (
            <ScaleDecorator>
                <ProductCard
                    item={item}
                    drag={drag}
                    isActive={isActive}
                />
            </ScaleDecorator>
        ),
        []
    );
    return (
        <DraggableFlatList
            data={filteredProducts}
            onDragEnd={handleProductOrderChange}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            testID="draggable-flatlist"
        />
    );
}
