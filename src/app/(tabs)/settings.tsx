import { useAudioPlayer } from 'expo-audio';
import { useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { CivBadge } from '@/components/civ-badge';
import { ScreenHeader } from '@/components/screen-header';
import { Button, Card, Chip, Icon, Txt } from '@/components/ui';
import { ICON_LIST } from '@/data/icons.generated';
import { STEP_SOUNDS } from '@/data/sounds';
import { useAccount } from '@/lib/account';
import { errorMessage, notify } from '@/lib/dialog';
import { settingsStore, updateSettings } from '@/lib/settings';
import { savePrefs, usePrefsDirty } from '@/lib/sync';
import { THEME_ART } from '@/theme/art';
import { THEMES, type AppTheme } from '@/theme/themes';
import { useColors } from '@/theme/use-app-theme';

const WARN_OPTIONS = [5, 10, 15, 30];

export default function SettingsScreen() {
  const colors = useColors();
  const settings = settingsStore.useValue();
  const account = useAccount();
  const preview = useAudioPlayer(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {account && <SaveBar />}

        <Section title="Theme" hint="One for every Age of Empires III release.">
          <View style={styles.themeGrid}>
            {THEMES.map((t) => (
              <ThemeCard key={t.id} theme={t} selected={settings.themeId === t.id} onPress={() => updateSettings({ themeId: t.id })} />
            ))}
          </View>
        </Section>

        <Section title="Build player">
          <Card style={{ gap: 14 }}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Txt>Vibrate on new steps</Txt>
                <Txt variant="small">A buzz when a step starts, a tap shortly before.</Txt>
              </View>
              <Switch
                value={settings.haptics}
                onValueChange={(haptics) => updateSettings({ haptics })}
                trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Txt>Sound on new steps</Txt>
              <Txt variant="small">Tap a sound to hear it.</Txt>
              <View style={styles.row}>
                <Chip label="None" selected={settings.stepSound === 'none'} onPress={() => updateSettings({ stepSound: 'none' })} />
                {STEP_SOUNDS.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    selected={settings.stepSound === s.id}
                    left={<Icon name="volume-high" size={14} color={settings.stepSound === s.id ? colors.onPrimary : colors.textMuted} />}
                    onPress={() => {
                      updateSettings({ stepSound: s.id });
                      preview.replace(s.source);
                      preview.play();
                    }}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Txt>Warn before next step</Txt>
              <View style={styles.row}>
                {WARN_OPTIONS.map((s) => (
                  <Chip key={s} label={`${s}s`} selected={settings.warnSeconds === s} onPress={() => updateSettings({ warnSeconds: s })} />
                ))}
              </View>
            </View>
          </Card>
        </Section>

        <Section title="Player key" hint="Syncs your library, theme and sound across devices, and lets you publish and upvote.">
          <Card style={{ gap: 12 }}>
            {account ? (
              <Txt>
                Using your key as <Txt style={{ fontWeight: '800' }}>{account.authorName}</Txt>
              </Txt>
            ) : (
              <Txt variant="muted">No key on this device yet. Builds and settings stay on this device only.</Txt>
            )}
            <Button
              title={account ? 'Manage key' : 'Set up my key'}
              icon={account ? 'account-key' : 'key-plus'}
              variant={account ? 'secondary' : 'primary'}
              onPress={() => router.push('/account')}
            />
          </Card>
        </Section>

        <Section title="About">
          <Card style={{ gap: 8 }}>
            <Txt variant="muted">
              AoE3 Build Tracker is an unofficial fan app with {ICON_LIST.length.toLocaleString()} in-game icons.
            </Txt>
            <Txt variant="small">
              Age of Empires III: Definitive Edition © Microsoft Corporation. This app was created under Microsoft&apos;s
              &quot;Game Content Usage Rules&quot; using assets from Age of Empires III: Definitive Edition, and it is not
              endorsed by or affiliated with Microsoft.
            </Txt>
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}

/** Saves theme, sound and player settings to the player key so other devices load them. */
function SaveBar() {
  const colors = useColors();
  const dirty = usePrefsDirty();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await savePrefs();
    } catch (e) {
      notify('Could not save settings', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!dirty) {
    return (
      <View style={styles.savedRow}>
        <Icon name="check-circle" size={16} color={colors.textMuted} />
        <Txt variant="small">Settings saved to your key</Txt>
      </View>
    );
  }
  return (
    <Card style={[styles.saveCard, { borderColor: colors.primary }]}>
      <Txt style={{ flex: 1 }}>You have unsaved settings.</Txt>
      <Button title="Save" icon="content-save" onPress={save} loading={saving} />
    </Card>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View>
        <Txt variant="heading">{title}</Txt>
        {hint && <Txt variant="small">{hint}</Txt>}
      </View>
      {children}
    </View>
  );
}

function ThemeCard({ theme, selected, onPress }: { theme: AppTheme; selected: boolean; onPress: () => void }) {
  const c = theme.colors;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${theme.name} theme`}
      onPress={onPress}
      style={[styles.themeCard, { backgroundColor: c.background, borderColor: selected ? c.primary : c.border }]}>
      <Image source={THEME_ART[theme.id].thumb} style={styles.themeArt} contentFit="cover" />
      <View style={styles.themeTop}>
        <CivBadge civ={theme.emblemCiv} height={18} />
        <Txt variant="small" color={c.textMuted}>
          {theme.year}
        </Txt>
        {selected && (
          <View style={{ marginLeft: 'auto' }}>
            <Icon name="check-circle" size={18} color={c.primary} />
          </View>
        )}
      </View>
      <Txt color={c.text} style={{ fontWeight: '800', fontSize: 14 }} numberOfLines={2}>
        {theme.name}
      </Txt>
      <View style={styles.swatches}>
        {[c.primary, c.accent, c.surface, c.current].map((col, i) => (
          <View key={i} style={[styles.swatch, { backgroundColor: col, borderColor: c.border }]} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 120 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeCard: { flexBasis: '47%', flexGrow: 1, borderRadius: 12, borderWidth: 2, padding: 10, paddingTop: 0, gap: 8, overflow: 'hidden' },
  themeArt: { height: 64, marginHorizontal: -10 },
  themeTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatches: { flexDirection: 'row', gap: 6 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth },
});
