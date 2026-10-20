import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CivBadge } from '@/components/civ-badge';
import { Txt } from '@/components/ui';
import { THEME_ART } from '@/theme/art';
import { useAppTheme } from '@/theme/use-app-theme';

/** Header for tab screens: the theme's DLC artwork fading into the page, title on top. */
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const theme = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 56, borderColor: colors.primary }]}>
      <Image source={THEME_ART[theme.id].header} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      {/* Darken the top for the status bar and fade the bottom into the page colour. */}
      <LinearGradient
        colors={[`${colors.background}cc`, `${colors.background}33`, `${colors.background}ee`, colors.background]}
        locations={[0, 0.35, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <CivBadge civ={theme.emblemCiv} height={28} />
        <View style={{ flex: 1 }}>
          <Txt variant="title" style={styles.title} numberOfLines={1}>
            {title}
          </Txt>
          <Txt variant="small" color={colors.primary} style={styles.subtitle} numberOfLines={1}>
            {theme.name}
          </Txt>
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 2, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: {
    fontSize: 26,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
