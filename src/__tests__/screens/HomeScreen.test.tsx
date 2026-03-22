import React from 'react';
import { render, fireEvent, waitFor, screen, within, debug } from '@testing-library/react-native';
import { Alert } from 'react-native';
import HomeScreen from '../../screens/HomeScreen';
import {
  getProducts,
  updateProductQuantity,
  deleteProduct,
  updateProduct
} from '../../database/database';
import { Provider as PaperProvider } from 'react-native-paper'; // Import Provider

// Mock the navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: jest.fn(() => jest.fn()),
    setParams: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock the DraggableFlatList
jest.mock('react-native-draggable-flatlist', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ data, renderItem }) => (
      <View testID="draggable-flatlist">
        {data.map((item, index) => (
          <View key={item.id}>{renderItem({ item, index, drag: jest.fn() })}</View>
        ))}
      </View>
    ),
    ScaleDecorator: ({ children }) => children,
  };
});

// Mock the database functions
jest.mock('../../database/database', () => ({
  getProducts: jest.fn().mockResolvedValue([]),
  updateProductQuantity: jest.fn().mockResolvedValue(undefined),
  saveProductHistoryForSingleProduct: jest.fn().mockResolvedValue(undefined),
  deleteProduct: jest.fn().mockResolvedValue(undefined),
  updateProduct: jest.fn().mockResolvedValue(undefined),
  updateProductOrder: jest.fn().mockResolvedValue(undefined),
  saveProductHistory: jest.fn().mockResolvedValue(undefined),
  getProductHistory: jest.fn().mockResolvedValue([]),
  addProduct: jest.fn().mockResolvedValue(undefined),
  consolidateProductHistory: jest.fn().mockResolvedValue(undefined),
}));

// Mock react-native
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  rn.Alert = {
    alert: jest.fn(),
  };
  rn.StyleSheet = {
    create: jest.fn(styles => styles),
  };
  rn.View = jest.fn(props => <rn.View {...props} testID={props.testID}>{props.children}</rn.View>);
  rn.Text = jest.fn(props => <rn.Text {...props} testID={props.testID}>{props.children}</rn.Text>);
  rn.TextInput = jest.fn(props => <rn.TextInput {...props} testID={props.testID} value={props.value} onChangeText={props.onChangeText} />);
  rn.TouchableOpacity = jest.fn(props => <rn.TouchableOpacity {...props} onPress={props.onPress} testID={props.testID}>{props.children}</rn.TouchableOpacity>);
  rn.FlatList = jest.fn(props => (
    <rn.FlatList
      {...props}
      data={props.data}
      renderItem={props.renderItem}
      keyExtractor={props.keyExtractor}
    />
  ));
  rn.ScrollView = jest.fn(props => <rn.ScrollView {...props} testID={props.testID}>{props.children}</rn.ScrollView>);
  rn.Keyboard = {
    dismiss: jest.fn(),
  };
  rn.Clipboard = { // Include Clipboard mock here
    setString: jest.fn(),
  };
  // Mock other react-native modules and components as needed
  return rn;
});

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock default products
    (getProducts as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Batata', quantity: 5, order: 1 },
      { id: 2, name: 'Arroz', quantity: 3, order: 2 },
      { id: 3, name: 'Feijão', quantity: 2, order: 3 },
    ]);
  });

  test('renders correctly with products', async () => {
    const { findByText, queryByTestId } = render(<PaperProvider><HomeScreen /></PaperProvider>);

    // Wait for products to load
    await findByText(/Batata/);
    await findByText(/Arroz/);
    await findByText(/Feijão/);

    // Check if the FAB button is rendered
    expect(queryByTestId('draggable-flatlist')).toBeTruthy();
  });

  test('filters products based on search query', async () => {
    const { queryByText, getByPlaceholderText } = render(<PaperProvider><HomeScreen /></PaperProvider>);

    // Wait for products to load
    await screen.findByTestId('product-card-1'); // Assuming each product item has a unique testID

    // Enter search query
    const searchInput = getByPlaceholderText('Buscar produtos...');
    fireEvent.changeText(searchInput, 'Batata');

    // Check if only matching products are displayed
    await waitFor(() => {
      expect(queryByText(/Batata/)).toBeTruthy();
      expect(queryByText(/Arroz/)).toBeNull();
      expect(queryByText(/Feijão/)).toBeNull();
    });
  });

  test('handles quantity changes', async () => {
    render(<PaperProvider><HomeScreen /></PaperProvider>);
    await screen.findByText('Batata 🥔');

    const batataItem = await screen.findByTestId('product-card-1');
    const incrementButton = within(batataItem).getByTestId('increment-button-1');
    const quantityInput = within(batataItem).getByTestId('quantity-text-input-1');

    // Initial quantity should be 5
    expect(within(batataItem).getByDisplayValue('5')).toBeVisible();

    // Simulate pressing the increment button
    fireEvent.press(incrementButton);

    // Wait for the UI to update
    await waitFor(() => {
      expect(within(batataItem).getByDisplayValue('6')).toBeVisible();
    });

    // Wait for the setTimeout in handleQuantityChange to execute and call updateProduct
    await waitFor(() => {
      expect(updateProduct).toHaveBeenCalledWith(1, 6);
    }, { timeout: 300 }); // Adjust timeout if needed (200ms + a little buffer)
  });


  test('handles product deletion', async () => {
    const { findByText, getAllByTestId, queryByTestId } = render(<PaperProvider><HomeScreen /></PaperProvider>);

    // Mock the Alert.alert to automatically trigger the delete action
    const alertSpy = jest.spyOn(Alert, 'alert');
    alertSpy.mockImplementation((title, message, buttons) => {
      const deleteButton = buttons.find(button => button.text === 'Excluir');
      if (deleteButton && deleteButton.onPress) {
        deleteButton.onPress();
      }
      return null;
    });

    // Wait for the 'Batata' product to load and its delete button to be present
    const batataItem = await screen.findByTestId('product-card-1');
    const deleteButton = within(batataItem).getByTestId('delete-button-1');

    // Press the delete button for the 'Batata' product
    fireEvent.press(deleteButton);

    // Wait for the deleteProduct function to be called
    await waitFor(() => {
      expect(deleteProduct).toHaveBeenCalledWith(1);
    });

    // Check if the product is no longer visible
    await waitFor(async () => {
      expect(screen.queryByTestId('product-item-1')).toBeNull();
    });

    alertSpy.mockRestore(); // Clean up the mock
  });

  const assertProductOrder = async (expectedNameRegexes: RegExp[]) => {
    const productElements = await screen.findAllByTestId(/product-card/i);
    expect(productElements.length).toBe(expectedNameRegexes.length);

    for (let i = 0; i < expectedNameRegexes.length; i++) {
      const regex = expectedNameRegexes[i];
      const productCard = productElements[i];
      const nameElement = await within(productCard).findByText(regex);
      expect(nameElement).toBeVisible();
    }
  };

  test('sorts products alphabetically', async () => {
    // Mock the products in alphabetical order for the second call to getProducts
    (getProducts as jest.Mock)
      .mockResolvedValueOnce([
        { id: 2, name: 'Arroz', quantity: 3, order: 0 },
        { id: 1, name: 'Batata', quantity: 5, order: 1 },
        { id: 3, name: 'Feijão', quantity: 2, order: 2 }
      ])
      .mockResolvedValueOnce([ // Mock the final sorted list
        { id: 2, name: 'Arroz', quantity: 3, order: 1 },
        { id: 1, name: 'Batata', quantity: 5, order: 2 },
        { id: 3, name: 'Feijão', quantity: 2, order: 3 }
      ]);

    const { getByText } = render(<PaperProvider><HomeScreen /></PaperProvider>);

    // Open the sort menu
    const sortButton = getByText('Ordenar');
    fireEvent.press(sortButton);

    // Select alphabetical sorting
    const alphabeticalOption = getByText('Alfabética');
    fireEvent.press(alphabeticalOption);

    // Add a small delay to allow state updates
    await new Promise(resolve => setTimeout(resolve, 100));

    // Products should be sorted alphabetically (Arroz, Batata, Feijão)
    await waitFor(async () => {
      await assertProductOrder([/Arroz/, /Batata/, /Feijão/]);
    });
  });

  test('deletes a product and re-renders the list', async () => {
    
    const alertSpy = jest.spyOn(Alert, 'alert');
    alertSpy.mockImplementation((title, message, buttons) => {
        const deleteButton = buttons.find((button: any) => button.text === 'Excluir');
        if (deleteButton && deleteButton.onPress) {
            deleteButton.onPress();
        }
        return null;
    });

    // Initial products (including Batata) - Mocked for initial render
    
    (getProducts as jest.Mock).mockResolvedValueOnce([
      { id: 1, name: 'Batata', quantity: 5, order: 1 },
      { id: 2, name: 'Arroz', quantity: 3, order: 2 },
      { id: 3, name: 'Feijão', quantity: 2, order: 3 },
  ]);

  // Mock the subsequent call to getProducts (after deletion)
  (getProducts as jest.Mock).mockResolvedValueOnce([
      { id: 2, name: 'Arroz', quantity: 3, order: 2 },
      { id: 3, name: 'Feijão', quantity: 2, order: 3 },
  ]);

    // Mock deleteProduct to resolve successfully
    (deleteProduct as jest.Mock).mockResolvedValue(undefined);


    const { findByText, getByTestId, queryByTestId, findByTestId, debug } = render(
        <PaperProvider>
            <HomeScreen />
        </PaperProvider>
    );
    await findByText(/Batata/);
    const deleteButton = getByTestId('delete-button-1');
    fireEvent.press(deleteButton);

    // Assert that the confirmation alert was shown
    expect(alertSpy).toHaveBeenCalledWith(
        "Confirmar Exclusão",
        "Tem certeza que deseja excluir este produto?",
        expect.any(Array)
    );

    // Wait for deleteProduct to be called
    await waitFor(() => {
        expect(deleteProduct).toHaveBeenCalledWith(1);
    });

   // Wait for loadProducts to be called (which should happen after deleteProduct)
    await waitFor(() => {
        expect(getProducts).toHaveBeenCalledTimes(2); // Initial load + after delete
    });

    // Wait for the UI to re-render and the 'Batata' product to be gone
    await waitFor(() => {
        expect(queryByTestId('product-card-1')).toBeNull();
        expect(screen.queryByText(/Batata/)).toBeNull();
    }, { timeout: 500 });

    alertSpy.mockRestore();
});

  test('navigates to edit screen when a product is pressed', async () => {
    // Mock the database functions
    (getProducts as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Batata', quantity: 5, order: 0 }
    ]);

    const { findByText } = render(<PaperProvider><HomeScreen /></PaperProvider>);

    // Wait for products to load
    const productItem = await findByText(/Batata/);

    // Press the product
    fireEvent.press(productItem);

    // Verify that navigation.navigate was called with the correct parameters
    expect(mockNavigate).toHaveBeenCalledWith('EditProduct', { product: { id: 1, name: 'Batata', quantity: 5, order: 0 } });
  });
});