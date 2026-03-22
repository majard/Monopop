import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddProductScreen from '../../screens/AddProductScreen';
import { addProduct } from '../../database/database';

// Mock the database functions
jest.mock('../../database/database', () => ({
  addProduct: jest.fn(),
}));

// Mock the navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

describe('AddProductScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders correctly with empty fields', () => {
    const { getByText, getByTestId } = render(<AddProductScreen />);
    
    // Check if input fields are rendered
    expect(getByTestId('product-name-input')).toBeTruthy();
    expect(getByTestId('product-quantity-input')).toBeTruthy();
    
    // Check if button is rendered and disabled
    const addButton = getByText('Adicionar Produto');
    expect(addButton).toBeTruthy();
    expect(addButton).toBeDisabled();
  });

  test('enables button when fields are filled', () => {
    const { getByTestId, getByText } = render(<AddProductScreen />);
    
    // Fill in the input fields
    const nameInput = getByTestId('product-name-input');
    const quantityInput = getByTestId('product-quantity-input');
    
    fireEvent.changeText(nameInput, 'Test Product');
    fireEvent.changeText(quantityInput, '5');
    
    // Check if button is enabled
    const addButton = getByText('Adicionar Produto');
    expect(addButton).not.toBeDisabled();
  });

  test('submits form and navigates to Home screen', async () => {
    (addProduct as jest.Mock).mockResolvedValue(123); // Mock successful product addition
    
    const { getByTestId, getByText } = render(<AddProductScreen />);
    
    // Fill in the input fields
    const nameInput = getByTestId('product-name-input');
    const quantityInput = getByTestId('product-quantity-input');
    
    fireEvent.changeText(nameInput, 'Test Product');
    fireEvent.changeText(quantityInput, '5');
    
    // Submit the form
    const addButton = getByText('Adicionar Produto');
    fireEvent.press(addButton);
    
    // Check if addProduct was called with correct arguments
    await waitFor(() => {
      expect(addProduct).toHaveBeenCalledWith('Test Product', 5);
    });
    
    // Check if navigation was called
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Home', { shouldRefresh: true });
    });
  });

  test('handles errors during product addition', async () => {
    // Mock console.error to prevent error messages in test output
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    // Mock addProduct to throw an error
    (addProduct as jest.Mock).mockRejectedValue(new Error('Test error'));
    
    const { getByTestId, getByText } = render(<AddProductScreen />);
    
    // Fill in the input fields
    const nameInput = getByTestId('product-name-input');
    const quantityInput = getByTestId('product-quantity-input');
    
    fireEvent.changeText(nameInput, 'Test Product');
    fireEvent.changeText(quantityInput, '5');
    
    // Submit the form
    const addButton = getByText('Adicionar Produto');
    fireEvent.press(addButton);
    
    // Check if addProduct was called
    await waitFor(() => {
      expect(addProduct).toHaveBeenCalledWith('Test Product', 5);
    });
    
    // Check if error was logged
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Erro ao adicionar produto:', expect.any(Error));
    });
    
    // Check that navigation was not called
    expect(mockNavigate).not.toHaveBeenCalled();
    
    // Restore console.error
    console.error = originalConsoleError;
  });
});
