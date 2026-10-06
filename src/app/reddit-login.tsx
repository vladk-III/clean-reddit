import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { Button, IconButton } from '@/components/ui';
import { fetchSignedInUser, resetFeedState } from '@/lib/reddit';
import { useStore } from '@/lib/store';
import { colors, radius, spacing, type } from '@/lib/theme';

const LOGIN_URL = 'https://www.reddit.com/login/';

export default function RedditLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateSettings } = useStore();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const done = useRef(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const confirm = async (manual: boolean) => {
    if (done.current) return;
    setChecking(true);
    const user = await fetchSignedInUser();
    setChecking(false);
    if (user) {
      done.current = true;
      resetFeedState(); // reload everything with full data
      updateSettings({ redditSession: true, redditUser: user, redditSessionExpired: false });
      close();
    } else if (manual) {
      setMessage('Not signed in yet. Finish logging in on the Reddit page above, then try again.');
    }
  };

  // Reddit sends you away from /login once you're in.
  const onNavigation = (nav: WebViewNavigation) => {
    if (nav.loading) return;
    if (/^https:\/\/(www\.)?reddit\.com\//.test(nav.url) && !/\/(login|register|account)/.test(nav.url)) confirm(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.nav, { paddingTop: (Platform.OS === 'ios' ? spacing.lg : insets.top) + spacing.sm }]}>
        <IconButton icon="x" variant="tile" size={44} accessibilityLabel="Close" onPress={close} />
        <Text style={styles.navTitle}>Sign in to Reddit</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.note}>
        <Feather name="shield" size={18} color={colors.accent} />
        <Text style={styles.noteText}>
          Use a spare account. Clean Reddit only reads posts. It never posts, votes or sends messages, and your sign-in stays on
          this phone.
        </Text>
      </View>

      {Platform.OS === 'web' ? (
        <Text style={[type.body, { padding: spacing.xl }]}>Signing in is only available in the Android app.</Text>
      ) : (
        <WebView
          source={{ uri: LOGIN_URL }}
          style={{ flex: 1 }}
          onNavigationStateChange={onNavigation}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => <ActivityIndicator color={colors.ink} style={StyleSheet.absoluteFill} />}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Button
          label={checking ? 'Checking…' : 'I’ve signed in'}
          variant="dark"
          disabled={checking}
          onPress={() => confirm(true)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  navTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  note: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  noteText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 19 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  message: { color: colors.danger, fontSize: 14, lineHeight: 19 },
});
