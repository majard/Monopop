import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ItemPickerDialog } from './ItemPickerDialog';
import { SearchablePickerDialog } from './SearchablePickerDialog';

interface Store {
    id: number;
    name: string;
}

interface StoreSelectorProps {
    stores: Store[];
    selectedStoreId: number | null;
    onStoreChange: (storeId: number | null) => void;
    referencePrice?: number | null;   // shown as hint below the button when set
    nullOptionLabel?: string;         // defaults to 'Sem loja'
    style?: object;
    iconOnly?: boolean;                // default false
    onCreateStore?: (name: string) => Promise<void>;
}

export function StoreSelector({
    stores,
    selectedStoreId,
    onStoreChange,
    referencePrice,
    nullOptionLabel = 'Sem loja',
    style,
    iconOnly = false,
    onCreateStore,
}: StoreSelectorProps) {
    const theme = useTheme();
    const [pickerVisible, setPickerVisible] = React.useState(false);

    const selectedStore = stores.find(s => s.id === selectedStoreId);
    const hasStore = selectedStoreId !== null;

    const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

    return (
        <>
            <View style={style}>
                <Pressable
                    onPress={() => setPickerVisible(true)}
                    style={({ pressed }) => [
                        iconOnly ? localStyles.buttonIconOnly : localStyles.button,
                        {
                            borderColor: hasStore ? theme.colors.primary : theme.colors.outline,
                            backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent',
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="store-edit-outline"
                        size={18}
                        color={hasStore ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                    {!iconOnly && (
                        <>
                            <Text
                                style={[
                                    localStyles.label,
                                    { color: hasStore ? theme.colors.primary : theme.colors.onSurfaceVariant },
                                ]}
                                numberOfLines={1}
                            >
                                {(selectedStore?.name ?? nullOptionLabel).slice(0, 8).toUpperCase()}
                            </Text>
                            <MaterialCommunityIcons
                                name="chevron-down"
                                size={16}
                                color={hasStore ? theme.colors.primary : theme.colors.onSurfaceVariant}
                            />
                        </>
                    )}
                </Pressable>

                {referencePrice != null && referencePrice > 0 && (
                    <Text style={[localStyles.hint, { color: theme.colors.onSurfaceVariant }]}>
                        Referência: {formatCurrency(referencePrice)}
                    </Text>
                )}
            </View>

            {onCreateStore ? (
                <SearchablePickerDialog
                    visible={pickerVisible}
                    onDismiss={() => setPickerVisible(false)}
                    items={stores}
                    selectedId={selectedStoreId}
                    onSelect={(id) => {
                        onStoreChange(id);
                        setPickerVisible(false);
                    }}
                    onCreateNew={async (name) => {
                        await onCreateStore(name);
                        setPickerVisible(false);
                    }}
                    title="Escolher loja"
                    placeholder="Buscar ou criar loja..."
                />
            ) : (
                <ItemPickerDialog
                    visible={pickerVisible}
                    onDismiss={() => setPickerVisible(false)}
                    items={stores}
                    selectedId={selectedStoreId}
                    onSelect={(id) => {
                        onStoreChange(id);
                        setPickerVisible(false);
                    }}
                    title="Escolher loja"
                    withNullOption
                    nullOptionLabel={nullOptionLabel}
                />
            )}

        </>
    );
}

const localStyles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
        paddingHorizontal: 0,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    buttonIconOnly: {
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 8,
        fontWeight: '500',
        maxWidth: 42,
        margin: 0
    },
    hint: {
        fontSize: 11,
        marginTop: 3,
        marginLeft: 4,
    },
});