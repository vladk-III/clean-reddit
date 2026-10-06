import { Platform } from 'react-native';
import RCTNetworking from 'react-native/Libraries/Network/RCTNetworking';

import { resetFeedState } from './reddit';

/**
 * Signs out of the in-app Reddit login by clearing the app's cookies (the login
 * web view and the app's own requests share them on Android).
 */
export function clearRedditSession(): Promise<void> {
  resetFeedState();
  if (Platform.OS === 'web') return Promise.resolve();
  return new Promise((resolve) => RCTNetworking.clearCookies(() => resolve()));
}
