import React, { useEffect, useState } from 'react';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import BottomTabNavigator from '../navigation/BottomTabNavigator';

type MainScreenProps = RouteProp<RootStackParamList, 'MainTabs'>;

export default function MainScreen() {
  const route = useRoute<MainScreenProps>();
  const navigation = useNavigation();
  const [currentListId, setCurrentListId] = useState(route.params?.listId || 1);

  // Update the listId when route params change
  useEffect(() => {
    const newListId = route.params?.listId || 1;
    if (newListId !== currentListId) {
      console.log('MainScreen: listId changed from', currentListId, 'to', newListId);
      setCurrentListId(newListId);
      
      // Update the bottom tab navigator params
      navigation.setParams({ listId: newListId });
    }
  }, [route.params?.listId, currentListId, navigation]);

  console.log('MainScreen rendering with listId:', currentListId);

  return <BottomTabNavigator key={currentListId} listId={currentListId} />;
} 