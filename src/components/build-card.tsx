import { Pressable, StyleSheet, View } from 'react-native';

import { CivBadge } from '@/components/civ-badge';
import { GameIcon } from '@/components/game-icon';
import { Icon, Txt } from '@/components/ui';
import { getCiv } from '@/constants/civs';
import { buildDuration, formatTime } from '@/lib/time';
import type { BuildStep } from '@/lib/types';
import { useColors } from '@/theme/use-app-theme';

type Props = {
  title: string;
  civ: string;
  steps: BuildStep[];
  subtitle?: string;
  upvotes?: number;
  voted?: boolean;
  badge?: string;
  onPress: () => void;
};

export function BuildCard({ title, civ, steps, subtitle, upvotes, voted, badge, onPress }: Props) {
  const colors = useColors();
  // Preview strip: first distinct icons of the build.
  const preview = [...new Set(steps.flatMap((s) => s.icons))].slice(0, 6);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}>
      <View style={styles.top}>
        <CivBadge civ={civ} height={26} />
        <View style={{ flex: 1 }}>
          <Txt variant="heading" numberOfLines={2}>
            {title || 'Untitled build'}
          </Txt>
          <Txt variant="small" numberOfLines={1}>
            {[getCiv(civ).name, subtitle].filter(Boolean).join(' · ')}
          </Txt>
        </View>
        {upvotes != null && (
          <View style={[styles.votes, { borderColor: voted ? colors.primary : colors.border }]}>
            <Icon name={voted ? 'arrow-up-bold' : 'arrow-up-bold-outline'} size={16} color={voted ? colors.primary : colors.textMuted} />
            <Txt variant="small" color={voted ? colors.primary : colors.text} style={{ fontWeight: '700' }}>
              {upvotes}
            </Txt>
          </View>
        )}
      </View>
      <View style={styles.bottom}>
        <View style={styles.preview}>
          {preview.map((id) => (
            <GameIcon key={id} id={id} size={26} />
          ))}
        </View>
        <Txt variant="small">
          {steps.length} steps · {formatTime(buildDuration(steps))}
        </Txt>
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
          <Txt variant="small" style={{ fontWeight: '700' }}>
            {badge}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  preview: { flexDirection: 'row', gap: 4, flexShrink: 1, overflow: 'hidden' },
  votes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
  badge: { position: 'absolute', top: -8, right: 12, paddingHorizontal: 8, borderRadius: 8 },
});
