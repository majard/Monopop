import React, { useEffect } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import BottomTabNavigator from '../navigation/BottomTabNavigator';
import { useListContext } from '../context/ListContext';

type MainScreenProps = RouteProp<RootStackParamList, 'MainTabs'>;

export default function MainScreen() {
  const route = useRoute<MainScreenProps>();
  const { listId, setListId } = useListContext();



  console.log('MainScreen rendering with listId:', listId);

  return <BottomTabNavigator key= {listId} listId={listId} />;
} 