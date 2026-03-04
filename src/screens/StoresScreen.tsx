import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Appbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { ManageableItemList } from '../components/ManageableItemList';
import {
  getStores,
  addStore,
  updateStoreName,
  deleteStore,
  getStoreAssociations,
} from '../database/database';

type StoresScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Stores'>;

interface Store {
  id: number;
  name: string;
}

export default function StoresScreen() {
  const navigation = useNavigation<StoresScreenNavigationProp>();
  const [stores, setStores] = useState<Store[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadStores = async () => {
    try {
      const data = await getStores();
      setStores(data);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStores();
    }, [])
  );

  const handleAdd = async (name: string) => {
    try {
      await addStore(name);
      await loadStores();
    } catch (error) {
      console.error('Error adding store:', error);
    }
  };

  const handleUpdate = async (id: number, name: string) => {
    try {
      await updateStoreName(id, name);
      await loadStores();
    } catch (error) {
      console.error('Error updating store:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStore(id);
      await loadStores();
    } catch (error) {
      console.error('Error deleting store:', error);
    }
  };

  const getAssociations = async (store: Store) => {
    const { invoiceCount } = await getStoreAssociations(store.id);
    let message = '';
    if (invoiceCount > 0) {
      message = `Esta loja possui ${invoiceCount} compra(s) registrada(s). Deseja realmente excluir?`;
    }
    return { count: invoiceCount, message };
  };

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.navigate('Config')} />
        <Appbar.Content title="Lojas" />
      </Appbar.Header>
      <ManageableItemList
        items={stores}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        getAssociations={getAssociations}
        title="Loja"
        addButtonLabel="Adicionar Loja"
        emptyMessage="Nenhuma loja cadastrada"
      />
    </>
  );
}
