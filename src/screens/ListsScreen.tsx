import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import {
  Card,
  IconButton,
  FAB,
  Button,
  useTheme,
} from "react-native-paper";
import { getLists } from "../database/database";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { getEmojiForList } from "../utils/stringUtils";
import { useListContext } from "../context/ListContext";

type ListItem = {
  id: number;
  name: string;
};

export default function ListsScreen() {
  const [lists, setLists] = useState<ListItem[]>([]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setListId } = useListContext();
  const theme = useTheme();

  const loadLists = async () => {
    const result = await getLists();
    setLists(result);
  };

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [])
  );

  const handleListSelect = (listId: number) => {
    setListId(listId);
    navigation.navigate("MainTabs", { listId });
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.primary }]}>
          Suas Listas
        </Text>
        <IconButton
          icon="cog"
          size={28}
          onPress={() => navigation.navigate('Config')}
          iconColor={theme.colors.primary}
        />
      </View>
      {lists.length === 0 ? (
        <View style={localStyles.emptyState}>
          <Text style={localStyles.emptyStateTitle}>
            Nenhuma lista encontrada
          </Text>
          <Text style={localStyles.emptyStateText}>
            Crie sua primeira lista para começar a organizar seus produtos
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate("AddList")}
            style={localStyles.emptyStateButton}
            icon="plus"
          >
            Criar Primeira Lista
          </Button>
        </View>
      ) : (
        <FlatList
          data={lists}
          renderItem={({ item }) => (
            <Card
              key={item.id}
              style={{ marginBottom: 16, borderRadius: 12, elevation: 2 }}
              onPress={() => handleListSelect(item.id)}
            >
              <Card.Content
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Text style={{ fontSize: 28, marginRight: 16 }}>
                  {getEmojiForList(item.name)}
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    flex: 1,
                    color: theme.colors.onSurface,
                  }}
                >
                  {item.name}
                </Text>
                <IconButton icon="chevron-right" size={28} />
              </Card.Content>
            </Card>
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 64 }}
        />
      )}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate("AddList")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

const localStyles = StyleSheet.create({
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyStateButton: {
    paddingHorizontal: 24,
  },
});
