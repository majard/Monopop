import { useState, useEffect, useCallback, useRef } from "react";
import { updateProduct, deleteProduct } from "../database/database";
import { Alert } from "react-native";

interface UseProductProps {
  productId: number;
  initialQuantity: number;
  onProductUpdated?: () => void;
}

const updateDebounceDelay = 300; // Debounce delay for single product DB updates
const initialContinuousDelay = 300; // Delay before continuous adjustment starts repeating
const intervalContinuousDelay = 100; // Interval for continuous adjustment repeats

export const useProduct = ({
  productId,
  initialQuantity,
  onProductUpdated,
}: UseProductProps) => {
  const [quantity, setQuantity] = useState(initialQuantity);
  // Ref to hold the most current quantity for the final debounced DB update
  const latestQuantityRef = useRef(initialQuantity);

  // --- Debounced DB Update Logic ---
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedDbUpdate = useCallback(async (id: number, newQuantity: number) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateProduct(id, newQuantity);
      } catch (err) {
        console.error(`Erro ao atualizar produto ${id}:`, err);
      } finally {
        updateTimeoutRef.current = null;
      }
    }, updateDebounceDelay);
  }, []); // Empty dependencies because it acts on id and newQuantity args


  // --- Public Quantity Update Function (UI + Triggers Debounced DB Update) ---
  const updateProductQuantity = useCallback(
    (newQuantity: number) => {
      const clampedQuantity = Math.max(0, newQuantity); // Ensure quantity doesn't go below zero
      setQuantity(clampedQuantity); // Optimistic UI update
      latestQuantityRef.current = clampedQuantity; // Keep track of the latest quantity for DB update

      if (onProductUpdated) {
        onProductUpdated();
      }

      // Trigger the debounced DB update
      debouncedDbUpdate(productId, clampedQuantity);
    },
    [productId, onProductUpdated, debouncedDbUpdate]
  );

  // --- Continuous Adjustment States and Refs ---
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentIncrement, setAdjustmentIncrement] = useState(false);
  const continuousAdjustmentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const continuousAdjustmentInitialTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal quantity state if initialQuantity prop changes
  useEffect(() => {
    setQuantity(initialQuantity);
    latestQuantityRef.current = initialQuantity; // Also sync the ref
  }, [initialQuantity]);

  // --- Continuous Quantity Adjustment Effect ---
  useEffect(() => {
    // Cleanup function for previous intervals/timeouts
    const cleanup = () => {
      if (continuousAdjustmentInitialTimeoutRef.current) {
        clearTimeout(continuousAdjustmentInitialTimeoutRef.current);
        continuousAdjustmentInitialTimeoutRef.current = null;
      }
      if (continuousAdjustmentIntervalRef.current) {
        clearInterval(continuousAdjustmentIntervalRef.current);
        continuousAdjustmentIntervalRef.current = null;
      }
    };

    if (isAdjusting) {
      cleanup(); // Clear any existing timers before starting new ones

      continuousAdjustmentInitialTimeoutRef.current = setTimeout(() => {
        continuousAdjustmentIntervalRef.current = setInterval(() => {
          setQuantity((prevQuantity) => {
            const newQuantity = adjustmentIncrement
              ? prevQuantity + 1
              : Math.max(0, prevQuantity - 1);
            latestQuantityRef.current = newQuantity; // Update ref for eventual DB save
            return newQuantity;
          });
        }, intervalContinuousDelay);
      }, initialContinuousDelay);
    }

    return cleanup; // Cleanup on component unmount or `isAdjusting` becoming false
  }, [isAdjusting, adjustmentIncrement]);


  const startContinuousAdjustment = useCallback((increment: boolean) => {
    // Perform an immediate UI update on the initial press
    setQuantity((prevQuantity) => {
      const newQuantity = increment ? prevQuantity + 1 : Math.max(0, prevQuantity - 1);
      latestQuantityRef.current = newQuantity; // Update ref
      return newQuantity;
    });

    setAdjustmentIncrement(increment);
    setIsAdjusting(true);
  }, []); // Dependencies are empty as it sets flags and updates state

  const stopContinuousAdjustment = useCallback(() => {
    setIsAdjusting(false);
    // When adjustment stops, trigger a final debounced DB update with the latest quantity
    debouncedDbUpdate(productId, latestQuantityRef.current);
  }, [productId, debouncedDbUpdate]);


  // --- Remove Product Logic ---
  const confirmRemoveProduct = useCallback(() => {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja excluir este produto?",
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

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      // Clear any pending debounced updates if component unmounts
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      // Also clear continuous adjustment timers if active
      if (continuousAdjustmentInitialTimeoutRef.current) clearTimeout(continuousAdjustmentInitialTimeoutRef.current);
      if (continuousAdjustmentIntervalRef.current) clearInterval(continuousAdjustmentIntervalRef.current);
    };
  }, []);

  return {
    quantity,
    updateProductQuantity,
    confirmRemoveProduct,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  };
};