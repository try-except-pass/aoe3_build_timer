import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GameIcon } from '@/components/game-icon';
import { formatTime } from '@/lib/time';
import type { BuildStep } from '@/lib/types';
import { useColors } from '@/theme/use-app-theme';

export type StepState = 'idle' | 'done' | 'current' | 'next' | 'upcoming';

type Props = {
  step: BuildStep;
  state?: StepState;
  /** Seconds until this step is due; shown on the "next" step in the player. */
  countdown?: number;
  large?: boolean;
};

/** One build-order step: time + game icons on the left, notes on the right. */
export const StepRow = memo(function StepRow({ step, state = 'idle', countdown, large }: Props) {
  const colors = useColors();
  const iconSize = large ? 46 : 38;
  const highlight = state === 'current';

  return (
    <View
      style={[
        styles.row,
        { borderColor: colors.border, backgroundColor: colors.surface },
        highlight && { backgroundColor: colors.current, borderColor: colors.primary, borderWidth: 2 },
        state === 'next' && { borderColor: colors.accent },
        state === 'done' && styles.done,
      ]}>
      <View style={[styles.left, { width: iconSize * 2 + 12 }]}>
        <Text
          style={[
            styles.time,
            { color: highlight ? colors.primary : colors.textMuted },
            large && styles.timeLarge,
          ]}>
          {step.time == null ? '—' : formatTime(step.time)}
        </Text>
        <View style={styles.icons}>
          {step.icons.length === 0 ? (
            <View style={{ width: iconSize, height: iconSize }} />
          ) : (
            step.icons.map((id, i) => <GameIcon key={`${id}-${i}`} id={id} size={iconSize} />)
          )}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.note, { color: colors.text }, large && styles.noteLarge]}>{step.note}</Text>
        {state === 'next' && countdown != null && (
          <Text style={[styles.countdown, { color: colors.accent }]}>in {formatTime(countdown)}</Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  done: { opacity: 0.4 },
  left: { gap: 4 },
  time: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeLarge: { fontSize: 15 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  right: { flex: 1, justifyContent: 'center', gap: 4 },
  note: { fontSize: 15, lineHeight: 21 },
  noteLarge: { fontSize: 17, lineHeight: 24 },
  countdown: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
