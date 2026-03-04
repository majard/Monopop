import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import {
  Card,
  IconButton,
  FAB,
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
      <Text style={[styles.title, { color: theme.colors.primary }]}>
        Suas Listas
      </Text>
      {lists.length === 0 ? (
        <Text
          style={{
            textAlign: "center",
            color: theme.colors.onBackground,
            marginTop: 32,
          }}
        >
          Nenhuma lista encontrada.
        </Text>
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
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
