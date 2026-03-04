import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Appbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { ManageableItemList } from '../components/ManageableItemList';
import {
  getCategories,
  addCategory,
  updateCategoryName,
  deleteCategory,
  getCategoryAssociations,
} from '../database/database';
import { Category } from '../database/models';

type CategoriesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Categories'>;

export default function CategoriesScreen() {
  const navigation = useNavigation<CategoriesScreenNavigationProp>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [])
  );

  const handleAdd = async (name: string) => {
    try {
      await addCategory(name);
      await loadCategories();
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const handleUpdate = async (id: number, name: string) => {
    try {
      await updateCategoryName(id, name);
      await loadCategories();
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const getAssociations = async (category: Category) => {
    const { productCount } = await getCategoryAssociations(category.id);
    let message = '';
    if (productCount > 0) {
      message = `Esta categoria possui ${productCount} produto(s) associado(s). Deseja realmente excluir?`;
    }
    return { count: productCount, message };
  };

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.navigate('Config')} />
        <Appbar.Content title="Categorias" />
      </Appbar.Header>
      <ManageableItemList
        items={categories}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        getAssociations={getAssociations}
        title="Categoria"
        addButtonLabel="Adicionar Categoria"
        emptyMessage="Nenhuma categoria cadastrada"
      />
    </>
  );
}
