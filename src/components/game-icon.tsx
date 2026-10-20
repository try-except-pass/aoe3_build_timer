import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { getIcon } from '@/data/icons';
import { useColors } from '@/theme/use-app-theme';

type Props = { id: string; size?: number };

/** Renders a bundled game icon; unknown ids (e.g. from a newer app version) show a placeholder. */
export function GameIcon({ id, size = 40 }: Props) {
  const colors = useColors();
  const icon = getIcon(id);
  const frame = { width: size, height: size, borderRadius: size * 0.16, borderColor: colors.border };

  if (!icon) {
    return (
      <View style={[styles.frame, frame, styles.missing, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={{ color: colors.textMuted, fontSize: size * 0.4 }}>?</Text>
      </View>
    );
  }
  return (
    <Image
      source={icon.source}
      style={[styles.frame, frame]}
      contentFit="cover"
      accessibilityLabel={icon.name}
      recyclingKey={id}
    />
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  missing: { alignItems: 'center', justifyContent: 'center' },
});
