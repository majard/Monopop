import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { getListById, updateListName, deleteList } from '../database/database';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { Alert } from 'react-native';

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

export const useList = (listId: number) => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [listName, setListName] = useState("");

  useEffect(() => {
    getListById(listId).then((list) => {
      if (list) setListName(list.name);
    });
  }, [listId]);

  const handleListNameSave = useCallback(async (listNameInput: string) => {
    if (listNameInput.trim()) {
      await updateListName(listId, listNameInput.trim());
      setListName(listNameInput.trim());
    }
  }, [listId]);

  const handleListDelete = useCallback(() => {
    Alert.alert("Excluir Lista", "Tem certeza que deseja excluir esta lista?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await deleteList(listId);
          navigation.goBack();
        },
      },
    ]);
  }, [listId, navigation]);

  return {
    listName,
    handleListNameSave,
    handleListDelete,
  };
};