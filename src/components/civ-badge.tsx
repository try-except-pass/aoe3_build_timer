import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { getCiv } from '@/constants/civs';
import { getCivFlag } from '@/data/icons';

/** Civ flag (3:2), or a coloured monogram for civs without bundled art. */
export function CivBadge({ civ, height = 24 }: { civ: string; height?: number }) {
  const c = getCiv(civ);
  const flag = getCivFlag(c.id);
  const size = { height, width: height * 1.5, borderRadius: height * 0.15 };
  if (flag) return <Image source={flag} style={[styles.base, size]} contentFit="cover" accessibilityLabel={c.name} />;
  return (
    <View style={[styles.base, size, styles.mono, { backgroundColor: c.color }]} accessibilityLabel={c.name}>
      <Text style={[styles.monoText, { fontSize: height * 0.5 }]}>{c.id === 'any' ? '★' : c.name.slice(0, 2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  mono: { alignItems: 'center', justifyContent: 'center' },
  monoText: { color: '#fff', fontWeight: '800' },
});
