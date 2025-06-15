import React, { useState } from 'react';
import { View } from 'react-native';
import { IconButton, TextInput, Text, useTheme } from 'react-native-paper';

interface EditableNameProps {
    name: string;
    handleSave: (name: string) => void;
    handleDelete: () => void;
}

export const EditableName: React.FC<EditableNameProps> = ({
    name,
    handleSave,
    handleDelete,
}) => {
    const theme = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [input, setInput] = useState(name);

    const handleEdit = () => {
        setIsEditing(true);
        setInput(name);
    };

    return (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            {isEditing ? (
                <>
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        style={{ flex: 1, marginRight: 8 }}
                        mode="outlined"
                        dense
                    />
                    <IconButton
                        icon="check"
                        iconColor={theme.colors.primary}
                        onPress={() => {
                            handleSave(input);
                            setIsEditing(false);
                        }}
                    />
                    <IconButton
                        icon="close"
                        iconColor={theme.colors.error}
                        onPress={() => setIsEditing(false)}
                    />
                </>
            ) : (
                <>
                    <Text variant="titleLarge" style={{ flex: 1 }}>
                        {name}
                    </Text>
                    <IconButton
                        icon="pencil"
                        iconColor={theme.colors.primary}
                        onPress={handleEdit}
                    />
                </>
            )}
            <IconButton
                icon="delete"
                iconColor={theme.colors.error}
                onPress={handleDelete}
            />
        </View>
    );
};