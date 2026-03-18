import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import { initializeDatabase, getSetting } from './src/database/database';
import { detectImportType, ListExportData } from './src/utils/backupUtils';
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
import { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator();

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2196F3',
    secondary: '#03DAC6',
  },
};

interface AppContentProps {
  navigationRef: ReturnType<typeof useNavigationContainerRef<RootStackParamList>>;
}

function AppContent({ navigationRef }: AppContentProps) {
  const [initialRoute, setInitialRoute] = useState<'Lists' | 'MainTabs'>('Lists');
  const [initialParams, setInitialParams] = useState<any>({});
  const [isReady, setIsReady] = useState(false);

  const handleIncomingFile = async (url: string) => {
    if (!url) return;
    try {
      const content = await FileSystem.readAsStringAsync(url);
      const data = JSON.parse(content);
      const type = detectImportType(data);

      if (type === 'invalid') {
        Alert.alert('Arquivo inválido', 'Este arquivo não é um backup ou lista Monopop.');
        return;
      }
      if (type === 'list_export') {
        navigationRef.current?.navigate('Backup', {
          pendingListImport: data as ListExportData,
        });
      } else {
        navigationRef.current?.navigate('Backup', {
          pendingBackupImport: data,
        });
      }
    } catch (e) {
      console.error('Error handling incoming file:', e);
      Alert.alert('Erro', 'Não foi possível ler o arquivo.');
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initializeDatabase();

        const [listMode, lastOpenedListId, defaultListId] = await Promise.all([
          getSetting('defaultListMode'),
          getSetting('lastOpenedListId'),
          getSetting('defaultListId'),
        ]);

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
        console.error('Error initializing app:', error);
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  // Handle incoming files via intent filter
  useEffect(() => {
    if (!isReady) return;

    // Cold start — app opened via file
    Linking.getInitialURL().then(url => {
      if (url) handleIncomingFile(url);
    });

    // Warm start — app already open, file opened
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingFile(url);
    });

    return () => subscription.remove();
  }, [isReady]);

  if (!isReady) return null;

  return (
    <Stack.Navigator
      id="MainNavigator"
      initialRouteName={initialRoute}
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="Lists" component={ListsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MainTabs" component={MainScreen} options={{ headerShown: false }} initialParams={initialParams} />
      <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditInventoryItem" component={EditInventoryItemScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddList" options={{ title: 'Adicionar Lista' }} component={AddListScreen} />
      <Stack.Screen name="AddInventoryItem" options={{ headerShown: false }} component={AddInventoryItemScreen} />
      <Stack.Screen name="AddProductToShoppingList" options={{ headerShown: false }} component={AddProductToShoppingListScreen} />
      <Stack.Screen name="Config" options={{ headerShown: false }} component={ConfigScreen} />
      <Stack.Screen name="Products" options={{ headerShown: false }} component={ProductsScreen} />
      <Stack.Screen name="Stores" options={{ headerShown: false }} component={StoresScreen} />
      <Stack.Screen name="Categories" options={{ headerShown: false }} component={CategoriesScreen} />
      <Stack.Screen name="Preferences" options={{ headerShown: false }} component={PreferencesScreen} />
      <Stack.Screen name="Invoices" options={{ headerShown: false }} component={InvoicesScreen} />
      <Stack.Screen name="InvoiceDetail" options={{ headerShown: false }} component={InvoiceDetailScreen} />
      <Stack.Screen name="Backup" options={{ headerShown: false }} component={BackupScreen} />
      <Stack.Screen name="About" options={{ headerShown: false }} component={AboutScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  // In App.tsx
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <ListProvider initialListId={1}>
            <NavigationContainer ref={navigationRef}>
              <AppContent navigationRef={navigationRef} />
            </NavigationContainer>
          </ListProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});