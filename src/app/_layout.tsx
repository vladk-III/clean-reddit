import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider } from '@/lib/store';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="note" options={{ presentation: 'modal' }} />
          <Stack.Screen name="quiz" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="subreddits" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reddit-login" options={{ presentation: 'modal' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
