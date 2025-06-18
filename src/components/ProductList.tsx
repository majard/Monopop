import DraggableFlatList, {
    ScaleDecorator,
} from "react-native-draggable-flatlist";
import { ProductCard } from './ProductCard';
import { useCallback } from 'react';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { useTheme } from 'react-native-paper';
import { Product } from '../database/database';

interface ProductListProps {
    products: Product[];
    handleProductOrderChange: (newOrder: Product[]) => void;
}

export default function ProductList({  products, handleProductOrderChange }: ProductListProps) {
    const theme = useTheme();
    const styles = createHomeScreenStyles(theme);


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
            data={products}
            onDragEnd={({data}) => handleProductOrderChange(data)}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            testID="draggable-flatlist"
        />
    );
}
