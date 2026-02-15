import { useState, useEffect, useCallback, useRef } from "react";
import { updateShoppingListItem } from "../database/database";

interface UseShoppingListItemProps {
  shoppingListItemId: number;
  initialQuantity: number;
}

const updateDebounceDelay = 300;
const initialContinuousDelay = 300;
const intervalContinuousDelay = 100;

export const useShoppingListItem = ({
  shoppingListItemId,
  initialQuantity,
}: UseShoppingListItemProps) => {
  const [quantity, setQuantity] = useState(initialQuantity);
  const latestQuantityRef = useRef(initialQuantity);

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedDbUpdate = useCallback(async (id: number, newQuantity: number) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateShoppingListItem(id, { quantity: newQuantity });
      } catch (err) {
        console.error(`Erro ao atualizar item da lista ${id}:`, err);
      } finally {
        updateTimeoutRef.current = null;
      }
    }, updateDebounceDelay);
  }, []);

  const updateQuantity = useCallback(
    (newQuantity: number) => {
      const clampedQuantity = Math.max(1, newQuantity);
      setQuantity(clampedQuantity);
      latestQuantityRef.current = clampedQuantity;
      debouncedDbUpdate(shoppingListItemId, clampedQuantity);
    },
    [shoppingListItemId, debouncedDbUpdate]
  );

  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentIncrement, setAdjustmentIncrement] = useState(false);
  const continuousAdjustmentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const continuousAdjustmentInitialTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuantity(initialQuantity);
    latestQuantityRef.current = initialQuantity;
  }, [initialQuantity]);

  useEffect(() => {
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
      cleanup();
      continuousAdjustmentInitialTimeoutRef.current = setTimeout(() => {
        continuousAdjustmentIntervalRef.current = setInterval(() => {
          setQuantity((prev) => {
            const newQuantity = adjustmentIncrement
              ? prev + 1
              : Math.max(1, prev - 1);
            latestQuantityRef.current = newQuantity;
            return newQuantity;
          });
        }, intervalContinuousDelay);
      }, initialContinuousDelay);
    }

    return cleanup;
  }, [isAdjusting, adjustmentIncrement]);

  const startContinuousAdjustment = useCallback((increment: boolean) => {
    setQuantity((prev) => {
      const newQuantity = increment ? prev + 1 : Math.max(1, prev - 1);
      latestQuantityRef.current = newQuantity;
      return newQuantity;
    });
    setAdjustmentIncrement(increment);
    setIsAdjusting(true);
  }, []);

  const stopContinuousAdjustment = useCallback(() => {
    setIsAdjusting(false);
    debouncedDbUpdate(shoppingListItemId, latestQuantityRef.current);
  }, [shoppingListItemId, debouncedDbUpdate]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (continuousAdjustmentInitialTimeoutRef.current) {
        clearTimeout(continuousAdjustmentInitialTimeoutRef.current);
      }
      if (continuousAdjustmentIntervalRef.current) {
        clearInterval(continuousAdjustmentIntervalRef.current);
      }
    };
  }, []);

  return {
    quantity,
    updateQuantity,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  };
};
