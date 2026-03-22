import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { MD3Theme } from 'react-native-paper';

export interface Styles {
  container: ViewStyle;
  header: ViewStyle;
  searchContainer: ViewStyle;
  searchInput: ViewStyle;
  buttonRow: ViewStyle;
  button: ViewStyle;
  buttonText: TextStyle;
  list: ViewStyle;
  card: ViewStyle;
  cardHeader: ViewStyle;
  dragHandle: ViewStyle;
  cardContent: ViewStyle;
  quantityContainer: ViewStyle;
  quantityButtons: ViewStyle;
  quantityInputContainer: ViewStyle;
  input: ViewStyle;
  cardActions: ViewStyle;
  fab: ViewStyle;
  modalOverlay: ViewStyle;
  modalContainer: ViewStyle;
  modalTitle: TextStyle;
  confirmationContent: ViewStyle;
  textInput: TextStyle;
  productInfo: ViewStyle;
  existingProduct: ViewStyle;
  similarProducts: ViewStyle;
  similarProductItemContainer: ViewStyle;
  similarProductItemText: TextStyle;
  productLabel: TextStyle;
  productValue: TextStyle;
  quantityText: TextStyle;
  dateText: TextStyle;
  modalButtonsContainer: ViewStyle;
  stackedButton: ViewStyle;
  actionButton: ViewStyle;
  buttonLabelStyle: TextStyle;
  skipButtonLabel: TextStyle;
  cancelButtonLabel: TextStyle;
  productCompareContainer: ViewStyle;
  productInfoColumn: ViewStyle;
  similarProductsScroll: ViewStyle;
  similarProductsContainer: ViewStyle;
  buttonContainer: ViewStyle;
  sectionTitle: TextStyle;
}

export const createHomeScreenStyles = (theme: MD3Theme) => StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: 'white',
    borderRadius: 5,
    paddingHorizontal: 10,
    height: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  button: {
    marginRight: 4,
    minHeight: 28,
    minWidth: 80,
  },
  buttonText: {
    fontSize: 12,
    marginVertical: 6,
    marginHorizontal: 16,
    marginLeft: 24
  },
  list: { 
    padding: 16, 
    paddingBottom: 192
  },
  card: { 
    marginBottom: 16 
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dragHandle: { 
    flexDirection: "row", 
    alignItems: "center" 
  },
  cardContent: { 
    marginTop: 8 
  },
  quantityContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  quantityButtons: { 
    flexDirection: "row" 
  },
  quantityInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  input: { 
    flex: 1, 
    marginHorizontal: 8 
  },
  cardActions: { 
    flexDirection: "row" 
  },
  fab: { 
    position: "absolute", 
    margin: 16, 
    right: 0, 
    bottom: 16 
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    padding: 20,
    borderRadius: 12,
    width: '100%',
    minWidth: 320,
    maxHeight: '100%',
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#333",
  },
  confirmationContent: {
    marginBottom: 12,
    minHeight: 120,
    maxHeight: 300,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  productInfo: {
    padding: 8,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    marginBottom: 8,
  },
  existingProduct: {
    backgroundColor: "#e9ecef",
  },
  similarProducts: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  similarProductItemContainer: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  similarProductItemText: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
    marginLeft: 8,
  },
  productLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  productValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    marginBottom: 4,
  },
  quantityText: {
    fontSize: 12,
    color: "#666",
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalButtonsContainer: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  stackedButton: {
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
  },
  actionButton: {
    marginBottom: 4,
  },
  buttonLabelStyle: {
    fontSize: 13,
  },
  skipButtonLabel: {
    color: "#666",
  },
  cancelButtonLabel: {
    color: "#dc3545",
  },
  productCompareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    flex: 1,
    minHeight: 100,
  },
  productInfoColumn: {
    flex: 1,
    minHeight: 100,
  },
  similarProductsScroll: {
    maxHeight: 150,
    marginTop: 8,
  },
  similarProductsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
    width: '100%',
    height: 196,
  },
  buttonContainer: {
    gap: 10,
    marginTop: 96,
    height: 256,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
});
