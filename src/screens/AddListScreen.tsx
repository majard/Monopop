import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  TextInput as PaperTextInput,
  Button,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addList } from '../database/database'; 
import { RootStackParamList } from '../types/navigation';

type AddListScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'AddList'
>;

/**
 * Screen component that lets the user enter a list name and add it to the database.
 *
 * Renders an outlined text input for the list name and a submit button; the button is disabled when the trimmed name is empty. Submitting attempts to persist the list and navigates to the "Lists" screen on success.
 *
 * @returns A JSX element rendering the Add List screen with input and submit controls.
 */
export default function AddListScreen() {
  const [name, setName] = useState('');
  const navigation = useNavigation<AddListScreenNavigationProp>();
  const theme = useTheme();

  const handleSubmit = async () => {
    try {
      await addList(name);
      navigation.navigate('Lists');
    } catch (error) {
      console.error('Erro ao adicionar lista:', error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <PaperTextInput
          label="Nome da Lista"
          value={name}
          onChangeText={setName}
          style={styles.input}
          mode="outlined"
          autoFocus
          blurOnSubmit={false}
          returnKeyType="done"
          testID="list-name-input"
        />

        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.button}
          disabled={!name.trim()}
          testID="add-list-button"
        >
          Adicionar Lista
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});
