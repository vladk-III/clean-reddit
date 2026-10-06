// React Native's networking module isn't part of its public types. We only use clearCookies.
declare module 'react-native/Libraries/Network/RCTNetworking' {
  const RCTNetworking: { clearCookies(callback: (cleared: boolean) => void): void };
  export default RCTNetworking;
}
