import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import ShoppingListScreen from '../screens/ShoppingListScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { BottomTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<BottomTabParamList>();

interface BottomTabNavigatorProps {
  listId?: number;
}

export default function BottomTabNavigator({ listId = 1 }: BottomTabNavigatorProps) {
  
  return (
    <Tab.Navigator
      id={undefined}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof MaterialCommunityIcons.glyphMap;

          if (route.name === 'Inventory') {
            iconName = focused ? 'package-variant-closed' : 'package-variant';
          } else if (route.name === 'ShoppingList') {
            iconName = focused ? 'cart' : 'cart-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'history' : 'history';
          } else {
            iconName = 'help';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: 80,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen 
        name="Inventory" 
        component={HomeScreen}
        options={{ 
          title: 'Estoque',
          tabBarLabel: 'Estoque',
        }}
        initialParams={{ listId }}
      />
      <Tab.Screen 
        name="ShoppingList" 
        component={ShoppingListScreen}
        options={{ 
          title: 'Compras',
          tabBarLabel: 'Compras'
        }}
        initialParams={{ listId }}
      />
      <Tab.Screen 
        name="History" 
        component={HistoryScreen}
        options={{ 
          title: 'Histórico',
          tabBarLabel: 'Histórico'
        }}
        initialParams={{ listId }}
      />
    </Tab.Navigator>
  );
} 