// Initialise i18next for component tests.
import '@/i18n';

// expo-notifications warns about Expo Go push support on import; tests only need stubs.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  useLastNotificationResponse: jest.fn(() => null),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));

// RevenueCat's native module isn't available in Jest.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(async () => ({})),
    logOut: jest.fn(async () => ({})),
    getOfferings: jest.fn(async () => ({ current: null, all: {} })),
    purchasePackage: jest.fn(async () => ({})),
    restorePurchases: jest.fn(async () => ({})),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    showManageSubscriptions: jest.fn(async () => undefined),
  },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: '1',
    PURCHASE_NOT_ALLOWED_ERROR: '3',
    NETWORK_ERROR: '10',
    PAYMENT_PENDING_ERROR: '20',
  },
}));

// Apple Health and Health Connect are native-only; tests use fakes of the few calls made.
jest.mock('@kingstinct/react-native-healthkit', () => ({
  CategoryValueSleepAnalysis: {
    inBed: 0,
    asleepUnspecified: 1,
    awake: 2,
    asleepCore: 3,
    asleepDeep: 4,
    asleepREM: 5,
  },
  isHealthDataAvailableAsync: jest.fn(async () => true),
  requestAuthorization: jest.fn(async () => true),
  queryCategorySamples: jest.fn(async () => []),
  queryStatisticsForQuantity: jest.fn(async () => ({ sources: [] })),
}));
jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
    SDK_AVAILABLE: 3,
  },
  SleepStageType: { UNKNOWN: 0, AWAKE: 1, SLEEPING: 2, OUT_OF_BED: 3, LIGHT: 4, DEEP: 5, REM: 6 },
  getSdkStatus: jest.fn(async () => 3),
  initialize: jest.fn(async () => true),
  requestPermission: jest.fn(async () => []),
  readRecords: jest.fn(async () => ({ records: [] })),
  aggregateRecord: jest.fn(async () => ({ COUNT_TOTAL: 0 })),
}));
