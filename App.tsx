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
import AddProductToShoppingListScreen from './src/screens/AddProductToShoppingListScreen';
import ListsScreen from './src/screens/ListsScreen';
import ConfigScreen from './src/screens/ConfigScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import StoresScreen from './src/screens/StoresScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import InvoicesScreen from './src/screens/InvoicesScreen';
import InvoiceDetailScreen from './src/screens/InvoiceDetailScreen';
import BackupScreen from './src/screens/BackupScreen';
import AboutScreen from './src/screens/AboutScreen';
import { ListProvider } from './src/context/ListContext';

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
          <ListProvider initialListId={1}>
            <NavigationContainer>
              <Stack.Navigator
                id="MainNavigator"
                initialRouteName="Lists"
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
                  name="Lists" 
                  component={ListsScreen}
                  options={{ title: 'Suas Listas', headerShown: false }}
                />
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
                <Stack.Screen
                  name="AddProductToShoppingList"
                  options={{ title: 'Adicionar à Lista de Compras', headerShown: false }}
                  component={AddProductToShoppingListScreen}
                />
                <Stack.Screen
                  name="Config"
                  options={{ title: 'Configurações', headerShown: false }}
                  component={ConfigScreen}
                />
                <Stack.Screen
                  name="Products"
                  options={{ title: 'Produtos', headerShown: false }}
                  component={ProductsScreen}
                />
                <Stack.Screen
                  name="Stores"
                  options={{ title: 'Lojas', headerShown: false }}
                  component={StoresScreen}
                />
                <Stack.Screen
                  name="Categories"
                  options={{ title: 'Categorias', headerShown: false }}
                  component={CategoriesScreen}
                />
                <Stack.Screen
                  name="Invoices"
                  options={{ title: 'Compras', headerShown: false }}
                  component={InvoicesScreen}
                />
                <Stack.Screen
                  name="InvoiceDetail"
                  options={{ title: 'Detalhes da Compra', headerShown: false }}
                  component={InvoiceDetailScreen}
                />
                <Stack.Screen
                  name="Backup"
                  options={{ title: 'Backup', headerShown: false }}
                  component={BackupScreen}
                />
                <Stack.Screen
                  name="About"
                  options={{ title: 'Sobre', headerShown: false }}
                  component={AboutScreen}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </ListProvider>
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