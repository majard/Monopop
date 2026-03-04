import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

interface ContextualHeaderProps {
  listName: string;
}

export default function ContextualHeader({ listName }: ContextualHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();

  const handleBackToLists = () => {
    navigation.navigate('Lists');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
      <IconButton
        icon="arrow-left"
        size={24}
        iconColor="#fff"
        onPress={handleBackToLists}
      />
      <View style={styles.titleContainer}>
        <Text style={styles.title} numberOfLines={1}>{listName}</Text>
      </View>
      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingTop: 12,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
});
