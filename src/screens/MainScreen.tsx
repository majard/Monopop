import React, { useEffect } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import BottomTabNavigator from '../navigation/BottomTabNavigator';
import { useListContext } from '../context/ListContext';
import { ListDataProvider } from '../context/ListDataContext';
import { useLists } from '../hooks/useLists';

type MainScreenProps = RouteProp<RootStackParamList, 'MainTabs'>;

export default function MainScreen() {
  const route = useRoute<MainScreenProps>();
  const { listId, setListId } = useListContext();
  const { lists } = useLists();

  useEffect(() => {
    if (route.params?.listId !== undefined) {
      setListId(route.params.listId);
    } else if (lists.length > 0 && route.params?.screen === 'Lists') {
      setListId(lists[0].id);
    }
  }, [route.params?.listId, route.params?.screen, setListId, lists]);



  return (
    <ListDataProvider>
      <BottomTabNavigator key={listId} listId={listId} />
    </ListDataProvider>
  );
} 