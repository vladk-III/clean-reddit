import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconName, Pill } from '@/components/ui';
import { BUILT_IN_PROXY } from '@/lib/reddit';
import { clearRedditSession } from '@/lib/session';
import { useStore } from '@/lib/store';
import { colors, radius, spacing, type } from '@/lib/theme';

function Section({ title, children, footer }: { title: string; children: ReactNode; footer?: string }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
  last,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.icon}>
        <Feather name={icon} size={18} color={colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.accent, false: colors.border }}
      thumbColor="#fff"
      {...(Platform.OS === 'web' ? { activeThumbColor: '#fff' } : {})}
    />
  );
}

function confirm(title: string, message: string, onYes: () => void, yesLabel = 'Delete') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: yesLabel, style: 'destructive', onPress: onYes },
  ]);
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, updateSettings, clearAllData, notes } = useStore();
  const [words, setWords] = useState(settings.blockedWords.join(', '));

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingBottom: insets.bottom + 120,
      }}
      keyboardShouldPersistTaps="handled">
      <Text style={[type.hero, { color: colors.ink }]}>Settings</Text>
      <Text style={[type.hero, { color: colors.muted, marginBottom: spacing.xl }]}>Make it yours</Text>

      <Section title="Profile">
        <Row
          icon="user"
          title="Your name"
          subtitle="Used in the greeting"
          last
          right={
            <TextInput
              style={styles.inlineInput}
              value={settings.displayName}
              onChangeText={(displayName) => updateSettings({ displayName })}
              placeholder="Optional"
              placeholderTextColor={colors.muted}
              maxLength={20}
            />
          }
        />
      </Section>

      <Section
        title="Clean content"
        footer="Adult and quarantined communities don’t load and can’t be added, and adult words, sites and communities are always filtered. Keyword filtering is a safety net and can occasionally miss or over-block.">
        <Row
          icon="shield"
          title="Adult content"
          subtitle="Always hidden"
          right={<Feather name="lock" size={18} color={colors.muted} />}
        />
        <Row
          icon="filter"
          title="Strict filter"
          subtitle="Also hide suggestive posts (swimwear, 'rate me', dating…)"
          right={<Toggle value={settings.strictFilter} onChange={(strictFilter) => updateSettings({ strictFilter })} />}
        />
        <Row
          icon="image"
          title="Text only"
          subtitle="Hide all images and thumbnails"
          right={<Toggle value={settings.hideImages} onChange={(hideImages) => updateSettings({ hideImages })} />}
        />
        <Row
          icon="list"
          title="Subreddits"
          subtitle={`${settings.subreddits.length} in your feed`}
          onPress={() => router.push('/subreddits')}
          right={<Feather name="chevron-right" size={20} color={colors.muted} />}
        />
        <View style={styles.block}>
          <Text style={styles.rowTitle}>Extra blocked words</Text>
          <Text style={styles.rowSubtitle}>Comma separated. Posts and comments containing them are hidden.</Text>
          <TextInput
            style={styles.input}
            value={words}
            onChangeText={setWords}
            onBlur={() =>
              updateSettings({
                blockedWords: words
                  .split(',')
                  .map((w) => w.trim())
                  .filter(Boolean),
              })
            }
            placeholder="e.g. politics, spoilers"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>
      </Section>

      <Section title="Learning">
        <View style={[styles.block, styles.rowBorder]}>
          <Text style={styles.rowTitle}>Knowledge check</Text>
          <Text style={styles.rowSubtitle}>Offer a quick quiz after reading this many posts</Text>
          <View style={styles.pills}>
            {[0, 3, 5, 10].map((n) => (
              <Pill
                key={n}
                label={n === 0 ? 'Off' : String(n)}
                active={settings.quizEvery === n}
                onPress={() => updateSettings({ quizEvery: n })}
              />
            ))}
          </View>
        </View>
        <Row
          icon="feather"
          title="Note after reading"
          subtitle="When you leave a post, open a note so you can capture takeaways or to-dos"
          right={
            <Toggle
              value={settings.promptNoteAfterReading}
              onChange={(promptNoteAfterReading) => updateSettings({ promptNoteAfterReading })}
            />
          }
        />
        <Row
          icon="cpu"
          title="AI questions"
          subtitle="Use Claude to write comprehension questions (needs your own Anthropic API key)"
          last={!settings.aiQuizzes}
          right={<Toggle value={settings.aiQuizzes} onChange={(aiQuizzes) => updateSettings({ aiQuizzes })} />}
        />
        {settings.aiQuizzes ? (
          <View style={styles.block}>
            <TextInput
              style={styles.input}
              value={settings.anthropicKey}
              onChangeText={(anthropicKey) => updateSettings({ anthropicKey: anthropicKey.trim() })}
              placeholder="sk-ant-…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.rowSubtitle}>
              Stored only on this device and sent only to api.anthropic.com. Without a key, questions are generated offline from
              the post text.
            </Text>
          </View>
        ) : null}
      </Section>

      {Platform.OS === 'web' ? (
        <Section
          title="Reddit connection"
          footer={
            BUILT_IN_PROXY
              ? 'This site already has a relay set up. Only change this if you run your own.'
              : 'Reddit blocks websites from loading its posts directly, so the website needs a small relay. See “Website setup” in the README.'
          }>
          <View style={styles.block}>
            <Text style={styles.rowTitle}>Relay URL</Text>
            <TextInput
              style={styles.input}
              value={settings.redditProxy}
              onChangeText={(redditProxy) => updateSettings({ redditProxy: redditProxy.trim() })}
              placeholder={BUILT_IN_PROXY || 'https://clean-reddit-proxy.your-name.workers.dev'}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </Section>
      ) : (
        <>
          <Section
            title="Reddit account"
            footer="Optional. Signing in brings back full comment threads, vote counts and Reddit’s own NSFW flag, with fewer “short break” pauses. Use a spare account: Clean Reddit only reads, and never posts, votes or messages. If the sign-in stops working, the app goes back to logged-out mode by itself.">
            {settings.redditSession ? (
              <Row
                icon="user-check"
                title={`Signed in as u/${settings.redditUser}`}
                subtitle="Loading full Reddit data"
                last
                right={
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      confirm(
                        'Sign out of Reddit?',
                        'The app will go back to logged-out mode.',
                        async () => {
                          await clearRedditSession();
                          updateSettings({ redditSession: false, redditUser: '', redditSessionExpired: false });
                        },
                        'Sign out',
                      )
                    }>
                    <Text style={styles.link}>Sign out</Text>
                  </Pressable>
                }
              />
            ) : (
              <Row
                icon="log-in"
                title="Sign in to Reddit"
                subtitle={settings.redditSessionExpired ? 'Your last sign-in expired. Sign in again.' : 'Use a spare account'}
                last
                onPress={() => router.push('/reddit-login')}
                right={<Feather name="chevron-right" size={20} color={colors.muted} />}
              />
            )}
          </Section>

          <Section
            title="Reddit API (advanced)"
            footer="Only if you already have one: the client ID of a Reddit “installed app”. Reddit no longer lets people create new ones.">
            <View style={styles.block}>
              <TextInput
                style={styles.input}
                value={settings.redditClientId}
                onChangeText={(redditClientId) => updateSettings({ redditClientId: redditClientId.trim() })}
                placeholder="Reddit client ID"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </Section>
        </>
      )}

      <Section title="Data">
        <Row
          icon="trash-2"
          title="Clear all data"
          subtitle={`Deletes ${notes.length} notes, history, quiz cards and settings`}
          last
          onPress={() =>
            confirm('Clear all data?', 'This cannot be undone. It also signs you out of Reddit.', async () => {
              await clearRedditSession();
              await clearAllData();
            })
          }
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  footer: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: spacing.sm, marginHorizontal: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md + 2 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  rowSubtitle: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  block: { paddingVertical: spacing.md + 2, gap: spacing.sm },
  input: {
    backgroundColor: colors.tile,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
  inlineInput: {
    width: 130,
    textAlign: 'right',
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.tile,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pills: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  link: { color: colors.accent, fontWeight: '600', fontSize: 14 },
});
