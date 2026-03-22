import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import EditProductScreen from '../../screens/EditProductScreen';
import {
  updateProduct,
  getProductHistory,
  updateProductName,
  deleteProduct
} from '../../database/database';
import { PaperProvider } from 'react-native-paper'; // Import PaperProvider

// Mock the database functions
jest.mock('../../database/database', () => ({
  updateProduct: jest.fn(() => Promise.resolve()), // Mock to resolve promise
  getProductHistory: jest.fn(() => Promise.resolve([])), // Mock to resolve promise with empty array by default
  updateProductName: jest.fn(() => Promise.resolve()), // Mock to resolve promise
  deleteProduct: jest.fn(() => Promise.resolve()), // Mock to resolve promise
}));

// Mock the navigation and route
const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    setParams: mockSetParams,
  }),
  useRoute: () => ({
    params: {
      product: {
        id: 1,
        name: 'Test Product',
        quantity: 5,
        order: 1
      }
    }
  }),
}));

// Mock the LineChart component
jest.mock('react-native-chart-kit', () => ({
  LineChart: () => null
}));

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
  const deleteButton = buttons && buttons.find(button => button.text === 'Excluir');
  if (deleteButton && deleteButton.onPress) {
    deleteButton.onPress();
  }
  return null;
});

describe('EditProductScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getProductHistory to return some data
    (getProductHistory as jest.Mock).mockResolvedValue([
      { id: 1, productId: 1, quantity: 5, date: '2025-04-01T00:00:00.000Z' },
      { id: 2, productId: 1, quantity: 8, date: '2025-04-02T00:00:00.000Z' },
    ]);
  });

  test('renders correctly with product data', async () => {
    const { findByText, getByDisplayValue } = render(
      <PaperProvider>
        <EditProductScreen />
      </PaperProvider>
    );

    // Check if product name is displayed
    await findByText('Test Product');

    // Check if quantity input has the correct value
    expect(getByDisplayValue('5')).toBeTruthy();

    // Check if buttons are rendered
    await findByText('Atualizar Quantidade');
  });

  test('updates product quantity', async () => {
    const { getByTestId } = render(
      <PaperProvider>
        <EditProductScreen />
      </PaperProvider>
    );

    await waitFor(() => expect(getByTestId('quantity-input')).toBeTruthy());

    const quantityInput = getByTestId('quantity-input');
    fireEvent.changeText(quantityInput, '6');
    fireEvent.changeText(quantityInput, '7');

    // Directly trigger the update
    const updateButton = getByTestId('update-button');
    fireEvent.press(updateButton);

    // Verify updateProduct was called with the correct value
    await waitFor(() => {
      expect(updateProduct).toHaveBeenCalledWith(1, 7);
    });
  });

  test('enables name editing mode', async () => {
    const { getByTestId } = render(
      <PaperProvider>
        <EditProductScreen />
      </PaperProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(getByTestId('name-container')).toBeTruthy();
    });

    // Find the edit name button and press it
    const editNameButton = getByTestId('edit-name-button');
    fireEvent.press(editNameButton);

    // Check if the save name button is visible
    await waitFor(() => {
      expect(getByTestId('save-name-button')).toBeTruthy();
    });
  });

  test('updates product name', async () => {
    // Mock updateProductName to resolve successfully
    (updateProductName as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId, getByDisplayValue } = render(
      <PaperProvider>
        <EditProductScreen />
      </PaperProvider>
    );

    // Enter edit mode
    const editButton = getByTestId('edit-name-button');
    fireEvent.press(editButton);

    // Find the name input and change its value
    const nameInput = getByDisplayValue('Test Product');
    fireEvent.changeText(nameInput, 'Updated Product');

    // Find and press the save button
    const saveButton = getByTestId('save-name-button');
    fireEvent.press(saveButton);

    // Check if updateProductName was called
    await waitFor(() => {
      expect(updateProductName).toHaveBeenCalledWith(1, 'Updated Product');
    });

    // Check if setParams was called
    await waitFor(() => {
      expect(mockSetParams).toHaveBeenCalledWith({ product: { id: 1, name: 'Updated Product', quantity: 5, order: 1 } });
    });
  });

  test('cancels name editing', async () => {
    const { findByText, getByTestId } = render(
      <PaperProvider>
        <EditProductScreen />
      </PaperProvider>
    );

    // Enter edit mode
    const editButton = await getByTestId('edit-name-button');
    fireEvent.press(editButton);

    // Find and press the cancel button
    const cancelButton = await getByTestId('cancel-name-button');
    fireEvent.press(cancelButton);

    // Check if we're back to view mode
    await findByText('Test Product');
  });

  test('deletes a product', async () => {
    const { findByTestId } = render(
      <PaperProvider>
        <EditProductScreen />
      </PaperProvider>
    );

    // Find and press the delete button
    const deleteButton = await findByTestId('delete-button');
    fireEvent.press(deleteButton);

    // Check if Alert.alert was called
    expect(Alert.alert).toHaveBeenCalledWith(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este produto?',
      expect.any(Array),
      { cancelable: true }
    );

    // Check if deleteProduct was called with the correct ID
    await waitFor(() => {
      expect(deleteProduct).toHaveBeenCalledWith(1);
    });

    // Check if navigation was called
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Home', { shouldRefresh: true });
    });
  });

  test('loads product history on mount', async () => {
    render(
      <PaperProvider>
        <EditProductScreen />
      </PaperProvider>
    );

    // Check if getProductHistory was called
    await waitFor(() => {
      expect(getProductHistory).toHaveBeenCalledWith('Test Product');
    });
  });

  test('displays history data when available', async () => {
    const { findByText } = render(
      <PaperProvider>
        <EditProductScreen />
      </PaperProvider>
    );

    // Wait for history data to load
    await waitFor(() => {
      expect(getProductHistory).toHaveBeenCalled();
    });

    // Check if history items are displayed
    await findByText('Quantidade: 5');
    await findByText('Quantidade: 8');
  });
});