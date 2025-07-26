import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { initializeDatabase } from './src/database/database';
import MainScreen from './src/screens/MainScreen';
import AddProductScreen from './src/screens/AddProductScreen';
import AddInventoryItemScreen from './src/screens/AddInventoryItemScreen';
import EditInventoryItemScreen from './src/screens/EditInventoryItemScreen';
import AddListScreen from './src/screens/AddListScreen';

const Stack = createNativeStackNavigator();

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2196F3',
    secondary: '#03DAC6',
  },
};

export default function App() {
  React.useEffect(() => {
    initializeDatabase().catch(console.error);
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="MainTabs"
              screenOptions={{
                headerStyle: {
                  backgroundColor: theme.colors.primary,
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
              <Stack.Screen 
                name="MainTabs" 
                component={MainScreen}
                options={{ headerShown: false }}
                initialParams={{ listId: 1 }}
              />
              
              <Stack.Screen 
                name="AddProduct" 
                component={AddProductScreen} 
                options={{ title: 'Adicionar Produto', headerShown: false }}
              />
              <Stack.Screen 
                name="EditInventoryItem" 
                component={EditInventoryItemScreen}  
                options={{ title: 'Editar Produto', headerShown: false }}
              />
              <Stack.Screen
                name="AddList"
                options={{title: 'Adicionar Lista'}}
                component={AddListScreen}
              />
              <Stack.Screen
                name="AddInventoryItem"
                options={{title: 'Adicionar Produto ao Estoque', headerShown: false}}
                component={AddInventoryItemScreen}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 