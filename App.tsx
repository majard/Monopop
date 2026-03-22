import React, { useState, useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { initializeDatabase, getSetting } from './src/database/database';
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
import PreferencesScreen from './src/screens/PreferencesScreen';
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

function AppContent() {
  const navigationRef = useNavigationContainerRef();
  const [initialRoute, setInitialRoute] = useState<'Lists' | 'MainTabs'>('Lists');
  const [initialParams, setInitialParams] = useState<any>({});
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);


  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initializeDatabase();

        // Read settings to determine initial route
        const [openLastList, listMode, lastOpenedListId, defaultListId] = await Promise.all([
          getSetting('openLastList'),
          getSetting('defaultListMode'),
          getSetting('lastOpenedListId'),
          getSetting('defaultListId')
        ]);

        // Check if we should open last list
        if (listMode) {
          let targetListId: number | null = null;

          if (listMode === 'last' && lastOpenedListId) {
            targetListId = parseInt(lastOpenedListId);
          } else if (listMode === 'fixed' && defaultListId) {
            targetListId = parseInt(defaultListId);
          }

          if (targetListId) {
            setInitialRoute('MainTabs');
            setInitialParams({ listId: targetListId });
          }
        }

        setIsReady(true);
      } catch (error) {
        setInitError(error as Error);
        setIsReady(true);
        console.error('Error initializing app:', error);
      }
    };

    initializeApp();
  }, []);

  if (initError) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <View style={styles.errorContainer}>
            <Text variant="headlineSmall">Erro ao inicializar</Text>
            <Text variant="bodyMedium" style={styles.errorMessage}>
              {initError.message}
            </Text>
            <Button
              mode="contained"
              onPress={() => { setInitError(null); setIsReady(false); }}
            >
              Tentar novamente
            </Button>
            <Text variant="bodySmall" style={styles.errorMessage}>
              Se o problema persistir, reinstale o aplicativo
            </Text>
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  if (!isReady) return null;

  return (
    <Stack.Navigator
      id="MainNavigator"
      initialRouteName={initialRoute}
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
        initialParams={initialParams}
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
        options={{ title: 'Adicionar Lista' }}
        component={AddListScreen}
      />
      <Stack.Screen
        name="AddInventoryItem"
        options={{ title: 'Adicionar Produto ao Estoque', headerShown: false }}
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
        name="Preferences"
        options={{ title: 'Preferências', headerShown: false }}
        component={PreferencesScreen}
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
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <ListProvider initialListId={1}>
            <NavigationContainer>
              <AppContent />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorMessage: {
    textAlign: 'center',
    opacity: 0.7,
  },
});