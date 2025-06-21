import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { initializeDatabase } from './src/database/database';
import HomeScreen from './src/screens/HomeScreen';
import AddProductScreen from './src/screens/AddProductScreen';
import EditProductScreen from './src/screens/EditProductScreen';
import ListsScreen from './src/screens/ListsScreen';
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
              name="Home" 
              component={HomeScreen} 
              options={{ title: 'Lista de Produção', headerShown : false }}
            />
            
            <Stack.Screen 
                name="Lists" 
                component={ListsScreen} 
                options={{ title: 'Listas', headerShown : false }}
              />
             <Stack.Screen 
                name="AddProduct" 
                component={AddProductScreen} 
                options={{ title: 'Adicionar Produto', headerShown: false }}
              />
              <Stack.Screen 
                name="EditProduct" 
                component={EditProductScreen} 
                // header was interfering with the other views placement
                options={{ title: 'Editar Produto', headerShown: false }}
              />
              <Stack.Screen
              name="AddList"
              options={{title: 'Adicionar Lista'}}
              component={AddListScreen}
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