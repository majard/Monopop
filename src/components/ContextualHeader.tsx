import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

interface ContextualHeaderProps {
  listName: string;
  onListNameSave?: (name: string) => Promise<void> | void;
  onListDelete?: () => void;
}

export default function ContextualHeader({ 
  listName, 
  onListNameSave, 
  onListDelete 
}: ContextualHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState(listName);

  const handleBackToLists = () => {
    navigation.navigate('Lists');
  };

  const handleEdit = () => {
    setIsEditing(true);
    setInput(listName);
  };


  const handleSave = async () => {
    const nextName = input.trim();
    if (!nextName) return;

    try {
      if (onListNameSave) {
        await onListNameSave(nextName);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving list name:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInput(listName);
  };

  const getTabName = () => {
    const routeName = route.name;
    if (routeName === 'Inventory') return 'ESTOQUE';
    if (routeName === 'ShoppingList') return 'COMPRAS';
    if (routeName === 'History') return 'HISTÓRICO';
    return '';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
      <IconButton
        icon="arrow-left"
        size={24}
        iconColor="#fff"
        onPress={handleBackToLists}
      />
      
      <View style={styles.centerContent}>
        <Text style={styles.tabName}>{getTabName()}</Text>
        
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              style={styles.input}
              autoFocus
              selectTextOnFocus
            />
            <IconButton
              icon="check"
              size={20}
              iconColor="#fff"
              onPress={handleSave}
            />
            <IconButton
              icon="close"
              size={20}
              iconColor={theme.colors.error}
              onPress={handleCancel}
            />
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={styles.listName} numberOfLines={1}>
              {listName}
            </Text>
            <IconButton
              icon="pencil"
              size={18}
              iconColor="#fff"
              onPress={handleEdit}
              style={styles.editButton}
            />
          </View>
        )}
      </View>
      
      {!isEditing && onListDelete && (
        <IconButton
          icon="delete"
          size={20}
          iconColor={theme.colors.error}
          onPress={onListDelete}
        />
      )}
      {isEditing && <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    paddingTop: 12,
    minHeight: 64,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
  },
  tabName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  editButton: {
    margin: 0,
    marginLeft: 2,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 150,
    maxWidth: 200,
  },
  placeholder: {
    width: 40,
  },
});
