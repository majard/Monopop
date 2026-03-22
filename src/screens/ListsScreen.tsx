import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, Modal, Pressable, TextInput, Alert } from "react-native";
import {
  FAB,
  useTheme,
  Text,
  List,
  Appbar,
  Divider,
} from "react-native-paper";
import { getLists, setSetting, deleteList, updateListName } from "../database/database";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { getEmojiForList } from "../utils/stringUtils";
import { useListContext } from "../context/ListContext";
import { EmojiAvatar } from "../components/EmojiAvatar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ListsScreenSkeleton from "../components/ListsScreenSkeleton";
import { ScreenContainer } from "../components/ScreenContainer";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { buildListExport, shareJsonFile, detectImportType, ListExportData } from '../utils/backupUtils';

type ListItem = {
  id: number;
  name: string;
};

export default function ListsScreen() {
  const [lists, setLists] = useState<ListItem[]>([]);
  const [actionTarget, setActionTarget] = useState<ListItem | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { setListId } = useListContext();
  const theme = useTheme();

  const [initialLoading, setInitialLoading] = useState(true);

  const loadLists = useCallback(async () => {
    try {
      const result = await getLists();
      setLists(result);
    } catch (error) {
      console.error('Error loading lists:', error);
      // Optionally set empty array or leave existing state
      setLists([]);
    } finally {
      setInitialLoading(false);
    }
  }, [getLists, setLists, setInitialLoading]);

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [loadLists])
  );

const handleListSelect = (listId: number) => {
  setListId(listId);
  navigation.navigate("MainTabs", { listId });
  void setSetting('lastOpenedListId', listId.toString()).catch((error) => {
    console.error("Erro ao salvar a última lista aberta:", error);
  });
};

  const handleLongPress = (item: ListItem) => {
    setActionTarget(item);
  };

  const renameTargetRef = useRef<ListItem | null>(null);

  const handleRename = () => {
    if (!actionTarget) return;
    renameTargetRef.current = actionTarget;
    setRenameInput(actionTarget.name);
    setActionTarget(null);
    setRenameVisible(true);
  };

  const handleRenameConfirm = async () => {
    if (!renameInput.trim() || !renameTargetRef.current) return;
    try {
      await updateListName(renameTargetRef.current.id, renameInput.trim());
      await loadLists();
    } catch (e) {
      Alert.alert("Erro", "Não foi possível renomear a lista.");
    } finally {
      setRenameVisible(false);
      setRenameInput("");
      renameTargetRef.current = null;
    }
  };

  const handleDelete = () => {
    if (!actionTarget) return;
    const target = actionTarget;
    setActionTarget(null);
    Alert.alert(
      "Excluir lista",
      `Tem certeza que deseja excluir "${target.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteList(target.id);
              await loadLists();
            } catch (e) {
              Alert.alert("Erro", "Não foi possível excluir a lista.");
            }
          },
        },
      ]
    );
  };

  const handleShareList = async (item: ListItem) => {
    setActionTarget(null);
    try {
      const { jsonString, fileName } = await buildListExport(item.id);
      await shareJsonFile(jsonString, fileName);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível exportar a lista.');
    }
  };

  const handleImportList = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
        const data = JSON.parse(content);
        const type = detectImportType(data);
        if (type !== 'list_export') {
          Alert.alert(
            'Arquivo inválido',
            'Este arquivo não é uma lista Monopop exportada. Para importar um backup completo vá em Configurações → Backup.'
          );
          return;
        }
        navigation.navigate('Backup', { pendingListImport: data as ListExportData });
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível ler o arquivo.');
    }
  };

  return (
    <ScreenContainer style={[styles.container]} withBottomInset>
      <Appbar.Header>
        <Appbar.Content title="Suas Listas" />
        <Appbar.Action icon="import" onPress={handleImportList} />
        <Appbar.Action icon="cog" onPress={() => navigation.navigate('Config')} />
      </Appbar.Header>

      {initialLoading ? <ListsScreenSkeleton /> : (lists.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8, textAlign: "center" }}>
            Nenhuma lista encontrada
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginBottom: 24, lineHeight: 24 }}>
            Crie sua primeira lista para começar a organizar seus produtos
          </Text>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 64 }}
          ItemSeparatorComponent={() => <Divider />}
          renderItem={({ item }) => (
            <List.Item
              title={item.name}
              titleStyle={{ fontSize: 17 }}
              left={() => (
                <View style={{ justifyContent: 'center', paddingLeft: 8 }}>
                  <EmojiAvatar emoji={getEmojiForList(item.name)} size="large" />
                </View>
              )}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => handleListSelect(item.id)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
        />)
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate("AddList")}
      />

      {/* Action bottom sheet */}
      <Modal
        visible={actionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTarget(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => setActionTarget(null)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 16,
              paddingBottom: 32,
              paddingTop: 12,
              elevation: 8,
            }}
            onPress={() => { }}
          >
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: theme.colors.outlineVariant,
              alignSelf: "center", marginBottom: 16,
            }} />
            <Text variant="titleSmall" style={{
              textTransform: "uppercase",
              letterSpacing: 1,
              color: theme.colors.onSurfaceVariant,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}>
              {actionTarget?.name}
            </Text>
            {[
              { icon: "share-variant", label: "Compartilhar lista", onPress: () => handleShareList(actionTarget!), destructive: false },
              { icon: "pencil-outline", label: "Renomear", onPress: handleRename, destructive: false },
              { icon: "delete-outline", label: "Excluir", onPress: handleDelete, destructive: true },
            ].map((action) => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  marginBottom: 2,
                  backgroundColor: pressed ? theme.colors.surfaceVariant : "transparent",
                })}
              >
                <MaterialCommunityIcons
                  name={action.icon as any}
                  size={20}
                  color={action.destructive ? theme.colors.error : theme.colors.onSurface}
                  style={{ marginRight: 12 }}
                />
                <Text style={{
                  fontSize: 15,
                  color: action.destructive ? theme.colors.error : theme.colors.onSurface,
                }}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename dialog */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", paddingHorizontal: 32 }}
          onPress={() => setRenameVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 16,
              padding: 24,
              elevation: 8,
            }}
            onPress={() => { }}
          >
            <Text variant="titleMedium" style={{ marginBottom: 16 }}>Renomear lista</Text>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              selectTextOnFocus
              style={{
                borderWidth: 1,
                borderColor: theme.colors.outline,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                fontSize: 16,
                color: theme.colors.onSurface,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <Pressable onPress={() => setRenameVisible(false)}>
                <Text style={{ color: theme.colors.onSurfaceVariant, paddingVertical: 8, paddingHorizontal: 12 }}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable onPress={handleRenameConfirm}>
                <Text style={{ color: theme.colors.primary, fontWeight: "600", paddingVertical: 8, paddingHorizontal: 12 }}>
                  Salvar
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 42,
  },
});