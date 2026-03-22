import { useState, useEffect, useCallback } from "react";
import { deleteProduct } from "../database/database";
import { Alert } from "react-native";

interface UseProductProps {
  productId: number;
  onProductUpdated?: () => void;
}

export const useProduct = ({
  productId,
  onProductUpdated,
}: UseProductProps) => {

  // --- Remove Product Logic ---
  const confirmRemoveProduct = useCallback(() => {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja excluir este produto? Isso irá remover o produto de todas as listas.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(productId);
              if (onProductUpdated) {
                onProductUpdated();
              }
            } catch (err) {
              console.error(`Erro ao deletar produto ${productId}:`, err);
              Alert.alert("Erro", "Não foi possível excluir o produto.");
            }
          },
        },
      ]
    );
  }, [productId, onProductUpdated]);

  return {
    confirmRemoveProduct,
  };
};