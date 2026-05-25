import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const API_BASE_URL: string =
  (extra.apiBaseUrl as string) || 'https://api.pushci.dev';

export const APP_URL: string =
  (extra.appUrl as string) || 'https://app.pushci.dev';
