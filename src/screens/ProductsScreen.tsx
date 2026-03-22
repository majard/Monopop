import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Appbar, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { ManageableItemList } from '../components/ManageableItemList';
import {
  getProducts,
  addProduct,
  updateProductName,
  deleteProduct,
  getProductAssociations,
  getCategories,
  updateProductCategory,
} from '../database/database';
import { Product, Category } from '../database/models';

type ProductsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Products'>;

interface ProductWithCategory extends Product {
  categoryName?: string;
}

export default function ProductsScreen() {
  const navigation = useNavigation<ProductsScreenNavigationProp>();
  const theme = useTheme();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);

      // Map categories to products
      const productsWithCategory = productsData.map(product => ({
        ...product,
        categoryName: categoriesData.find(c => c.id === product.categoryId)?.name,
      }));

      setProducts(productsWithCategory);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleAdd = async (name: string) => {
    try {
      await addProduct(name);
      await loadData();
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleUpdate = async (id: number, name: string) => {
    try {
      await updateProductName(id, name);
      await loadData();
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProduct(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const getAssociations = async (product: ProductWithCategory) => {
    const { inventoryCount, purchaseCount } = await getProductAssociations(product.id);
    const total = inventoryCount + purchaseCount;
    let message = '';
    if (inventoryCount > 0 && purchaseCount > 0) {
      message = `Este produto existe em ${inventoryCount} lista(s) e possui histórico de ${purchaseCount} compra(s). Deseja realmente excluir?`;
    } else if (inventoryCount > 0) {
      message = `Este produto existe em ${inventoryCount} lista(s). Deseja realmente excluir?`;
    } else if (purchaseCount > 0) {
      message = `Este produto possui histórico de ${purchaseCount} compra(s). Deseja realmente excluir?`;
    }
    return { count: total, message };
  };

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.navigate('Config')} />
        <Appbar.Content title="Produtos" />
      </Appbar.Header>
      <ManageableItemList
        items={products}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        getAssociations={getAssociations}
        title="Produto"
        addButtonLabel="Adicionar Produto"
        emptyMessage="Nenhum produto cadastrado"
      />
    </>
  );
}
