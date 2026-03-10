import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';

interface ContextualHeaderProps {
  listName: string;
  onListNameSave?: (name: string) => void;
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

  const handleBack = () => {
    const tabScreens = ['Inventory', 'ShoppingList', 'History'];
    if (tabScreens.includes(route.name)) {
      navigation.navigate('Lists');
    } else {
      navigation.goBack();
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setInput(listName);
  };

  const handleSave = () => {
    if (onListNameSave && input.trim()) {
      onListNameSave(input.trim());
    }
    setIsEditing(false);
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
        onPress={handleBack}
        style={styles.iconButton}
      />

      <View style={styles.centerContent}>
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              style={styles.input}
              autoFocus
              selectTextOnFocus
            />
            <IconButton icon="check" size={18} iconColor="#fff" onPress={handleSave} style={styles.iconButton} />
            <IconButton icon="close" size={18} iconColor="rgba(255,255,255,0.7)" onPress={handleCancel} style={styles.iconButton} />
          </View>
        ) : (
          <View style={styles.nameRow}>

            <Text style={styles.tabName}>{getTabName()}</Text>
            <Text style={styles.separator}>|</Text>
            <Pressable onPress={handleEdit} style={styles.listNamePressable}>
              <Text style={styles.listName} numberOfLines={1}>{listName}</Text>
              <MaterialCommunityIcons
                name="pencil-outline"
                size={18}
                color="rgba(255,255,255,0.7)"
                style={{ marginLeft: 4 }}
              />
            </Pressable>
          </View>
        )}
      </View>

      {!isEditing && onListDelete ? (
        <IconButton
          icon="delete"
          size={20}
          iconColor="rgba(255,255,255,0.6)"
          onPress={onListDelete}
          style={styles.iconButton}
        />
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    minHeight: 52,
  },
  iconButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    minWidth: '70%',
  },
  listNamePressable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    opacity: 0.85,
    letterSpacing: 0.5,

  },
  separator: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  listName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    flexShrink: 1,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#fff',
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 140,
    maxWidth: 200,
  },
});
