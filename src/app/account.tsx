import * as Clipboard from 'expo-clipboard';
import { useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Txt } from '@/components/ui';
import { createKey, forgetKey, formatKey, maskKey, setDisplayName, signInWithKey, useAccount } from '@/lib/account';
import { confirm, errorMessage, notify } from '@/lib/dialog';
import { applyRemotePrefs, getSyncStatus, subscribeSyncStatus, syncNow } from '@/lib/sync';
import { useColors } from '@/theme/use-app-theme';

export default function AccountScreen() {
  const account = useAccount();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {account ? <KeyDetails /> : <NoKey />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NoKey() {
  const colors = useColors();
  const [name, setName] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState<'create' | 'use' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy('create');
    setError(null);
    try {
      await createKey(name);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const use = async () => {
    setBusy('use');
    setError(null);
    try {
      applyRemotePrefs(await signInWithKey(typed));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Txt variant="muted">
        Your player key is all you need — no email, no password. It keeps your build library, theme and sound in sync
        between your phone and the website, and lets you publish and upvote builds.
      </Txt>

      <Card style={{ gap: 12 }}>
        <Txt variant="heading">New here?</Txt>
        <Field
          label="Name on your published builds (optional)"
          value={name}
          onChangeText={setName}
          maxLength={24}
          autoCorrect={false}
          placeholder="e.g. FortressFanatic"
        />
        <Button title="Create my key" icon="key-plus" onPress={create} loading={busy === 'create'} disabled={!!busy} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt variant="heading">Already have a key?</Txt>
        <Field
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
          style={styles.keyInput}
          onSubmitEditing={use}
        />
        <Button
          title="Use this key"
          icon="login"
          variant="secondary"
          onPress={use}
          loading={busy === 'use'}
          disabled={!!busy || formatKey(typed).length < 24}
        />
        <Txt variant="small">Builds already on this device are kept and merged into the key&apos;s library.</Txt>
      </Card>

      {error && <Txt color={colors.danger}>{error}</Txt>}
    </>
  );
}

function KeyDetails() {
  const colors = useColors();
  const account = useAccount()!;
  const sync = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const [revealed, setRevealed] = useState(false);
  const [name, setName] = useState(account.displayName ?? '');
  const [savingName, setSavingName] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(account.key);
    notify('Key copied', 'Keep it somewhere safe, like a password manager or a note.');
  };

  const share = async () => {
    if (Platform.OS === 'web') return copy();
    await Share.share({ message: `My AoE3 Build Tracker key: ${account.key}` });
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      await setDisplayName(name);
    } catch (e) {
      notify('Could not save name', errorMessage(e));
    } finally {
      setSavingName(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Remove key from this device?',
      message: 'Your builds stay on this device and on the server. Without the key you cannot get the synced library back, so make sure you saved it.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) forgetKey();
  };

  return (
    <>
      <Card style={{ gap: 12 }}>
        <Txt variant="heading">Your player key</Txt>
        <Text selectable style={[styles.key, { color: colors.primary }]}>
          {revealed ? account.key : maskKey(account.key)}
        </Text>
        <View style={styles.row}>
          <Button
            title={revealed ? 'Hide' : 'Show'}
            icon={revealed ? 'eye-off' : 'eye'}
            variant="secondary"
            onPress={() => setRevealed(!revealed)}
            style={styles.flex}
          />
          <Button title="Copy" icon="content-copy" variant="secondary" onPress={copy} style={styles.flex} />
          {Platform.OS !== 'web' && <Button title="Share" icon="share-variant" variant="secondary" onPress={share} style={styles.flex} />}
        </View>
        <Txt variant="small" color={colors.accent}>
          Save this key. It is the only way to get your library back on another device — there is no email or
          password reset.
        </Txt>
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt variant="heading">Name on published builds</Txt>
        <Field value={name} onChangeText={setName} maxLength={24} placeholder={account.authorName} autoCorrect={false} />
        <Button
          title="Save name"
          variant="secondary"
          onPress={saveName}
          loading={savingName}
          disabled={name.trim() === (account.displayName ?? '') || (name.trim().length > 0 && name.trim().length < 2)}
        />
        <Txt variant="small">Shown as “{account.authorName}” right now.</Txt>
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt variant="heading">Sync</Txt>
        <Txt variant="muted">
          {sync.syncing
            ? 'Syncing…'
            : sync.error
              ? `Last sync failed: ${sync.error}`
              : sync.lastSyncedAt
                ? `Library and preferences synced at ${new Date(sync.lastSyncedAt).toLocaleTimeString()}.`
                : 'Your library and preferences sync automatically.'}
        </Txt>
        <Button title="Sync now" icon="sync" variant="secondary" onPress={() => syncNow()} loading={sync.syncing} />
      </Card>

      <Button title="Remove key from this device" icon="logout" variant="ghost" onPress={remove} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  key: { fontSize: 22, fontWeight: '800', letterSpacing: 1.5, fontVariant: ['tabular-nums'], textAlign: 'center' },
  keyInput: { fontSize: 18, letterSpacing: 1.2, fontWeight: '700' },
});
