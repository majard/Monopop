// Mock the expo-sqlite module
jest.mock('expo-sqlite', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(),
    exec: jest.fn(),
  })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock react-navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock setImmediate for React Native tests
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => global.setTimeout(callback, 0, ...args);
}

// Suppress act() warnings
// These warnings happen because of animation timers
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    args[0]?.includes && (
      args[0].includes('Warning: An update to') &&
      args[0].includes('inside a test was not wrapped in act')
    )
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Mock Animated components to prevent act() warnings
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  
  // Mock Animated components
  rn.Animated = {
    ...rn.Animated,
    timing: () => ({
      start: (callback) => {
        if (callback) {
          callback({ finished: true });
        }
      },
    }),
    View: rn.View,
    Text: rn.Text,
    Image: rn.Image,
    createAnimatedComponent: (component) => component,
    event: () => () => {},
  };
  
  // Mock Clipboard
  rn.Clipboard = {
    setString: jest.fn(),
  };
  
  return rn;
});

// Mock expo-font
jest.mock('expo-font', () => ({
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(() => Promise.resolve()),
  __esModule: true,
  default: {
    isLoaded: jest.fn(() => true),
    loadAsync: jest.fn(() => Promise.resolve()),
  }
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const icons = {
    MaterialIcons: 'MaterialIcons',
    MaterialCommunityIcons: 'MaterialCommunityIcons',
    Ionicons: 'Ionicons',
    FontAwesome: 'FontAwesome',
    FontAwesome5: 'FontAwesome5',
  };
  
  return Object.keys(icons).reduce((acc, iconSet) => {
    acc[iconSet] = () => 'Icon';
    return acc;
  }, {});
});
