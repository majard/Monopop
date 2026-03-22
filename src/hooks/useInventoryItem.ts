import { useState, useEffect, useCallback, useRef } from "react";
import { updateInventoryItem, deleteInventoryItem } from "../database/database";
import { Alert } from "react-native";

interface UseInventoryItemProps {
  inventoryItemId: number;
  initialQuantity: number;
  productName: string;
  onInventoryItemUpdated?: () => void;
}

const updateDebounceDelay = 150; // Debounce delay for single inventory item DB updates
const initialContinuousDelay = 300; // Delay before continuous adjustment starts repeating
const intervalContinuousDelay = 100; // Interval for continuous adjustment repeats

export const useInventoryItem = ({
  inventoryItemId,
  initialQuantity,
  productName,
  onInventoryItemUpdated,
}: UseInventoryItemProps) => {
  const [quantity, setQuantity] = useState(initialQuantity);
  // Ref to hold the most current quantity for the final debounced DB update
  const latestQuantityRef = useRef(initialQuantity);

  // --- Debounced DB Update Logic ---
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedDbUpdate = useCallback(async (id: number, newQuantity: number, skipDb: boolean = false) => {
    if (skipDb) return;
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateInventoryItem(id, newQuantity);
      } catch (err) {
        console.error(`Erro ao atualizar inventory item ${id}:`, err);
      } finally {
        updateTimeoutRef.current = null;
      }
    }, updateDebounceDelay);
  }, []); // Empty dependencies because it acts on id and newQuantity args


  // --- Public Quantity Update Function (UI + Triggers Debounced DB Update) ---
  const updateInventoryItemQuantity = useCallback(
    (newQuantity: number, skipDb: boolean = false) => {
      const clampedQuantity = Math.max(0, newQuantity); // Ensure quantity doesn't go below zero
      setQuantity(clampedQuantity); // Optimistic UI update
      latestQuantityRef.current = clampedQuantity; // Keep track of the latest quantity for DB update

      // Trigger the debounced DB update
      debouncedDbUpdate(inventoryItemId, clampedQuantity, skipDb);
    },
    [inventoryItemId, debouncedDbUpdate]
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


  const startContinuousAdjustment = useCallback((increment: boolean, skipDb: boolean = false) => {
    // Perform an immediate UI update on the initial press
    setQuantity((prevQuantity) => {
      const newQuantity = increment ? prevQuantity + 1 : Math.max(0, prevQuantity - 1);
      latestQuantityRef.current = newQuantity; // Update ref
      return newQuantity;
    });

    setAdjustmentIncrement(increment);
    setIsAdjusting(true);
  }, []); // Dependencies are empty as it sets flags and updates state

  const stopContinuousAdjustment = useCallback((skipDb: boolean = false) => {
    setIsAdjusting(false);
    // When adjustment stops, trigger a final debounced DB update with the latest quantity
    debouncedDbUpdate(inventoryItemId, latestQuantityRef.current, skipDb);
  }, [inventoryItemId, debouncedDbUpdate]);


  // --- Remove Inventory Item Logic ---
  const confirmRemoveInventoryItem = useCallback(() => {
    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja excluir "${productName}" do estoque?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteInventoryItem(inventoryItemId);
              // Trigger immediate parent refresh after successful deletion
              if (onInventoryItemUpdated) {
                onInventoryItemUpdated();
              }
            } catch (err) {
              console.error(`Erro ao deletar inventory item ${inventoryItemId}:`, err);
              Alert.alert("Erro", "Não foi possível excluir o item do estoque.");
            }
          },
        },
      ]
    );
  }, [inventoryItemId, onInventoryItemUpdated]);

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
    updateInventoryItemQuantity,
    confirmRemoveInventoryItem,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  };
};
