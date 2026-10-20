import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CivBadge } from '@/components/civ-badge';
import { StepRow, type StepState } from '@/components/step-row';
import { Button, EmptyState, Icon, IconButton, Txt } from '@/components/ui';
import { getStepSound } from '@/data/sounds';
import { confirm } from '@/lib/dialog';
import { useBuild } from '@/lib/library';
import { settingsStore } from '@/lib/settings';
import { effectiveTimes, formatTime } from '@/lib/time';
import { THEME_ART } from '@/theme/art';
import { useAppTheme } from '@/theme/use-app-theme';

/** How long auto-follow stays paused after the user scrolls by hand. */
const FOLLOW_RESUME_MS = 8000;

type Clock = { running: boolean; baseMs: number; since: number };

export default function PlayScreen() {
  useKeepAwake('player');
  const { id } = useLocalSearchParams<{ id: string }>();
  const build = useBuild(id);
  const theme = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { haptics, warnSeconds, stepSound } = settingsStore.useValue();

  const clock = useBuildClock();
  const { elapsed, started } = clock;
  const nudge = (deltaSeconds: number) => clock.setElapsed(elapsed + deltaSeconds);

  // --- step states ---------------------------------------------------------------------------
  const steps = useMemo(() => build?.steps ?? [], [build]);
  const times = useMemo(() => effectiveTimes(steps), [steps]);

  const { currentTime, nextTime, groupStart } = useMemo(() => {
    if (!started) return { currentTime: null, nextTime: times[0] ?? null, groupStart: -1 };
    let cur: number | null = null;
    for (const t of times) if (t <= elapsed) cur = t;
    const next = times.find((t) => t > elapsed) ?? null;
    return { currentTime: cur, nextTime: next, groupStart: cur == null ? -1 : times.indexOf(cur) };
  }, [times, elapsed, started]);

  const stateOf = (i: number): StepState => {
    if (!started) return 'idle';
    const t = times[i];
    if (currentTime != null && t === currentTime) return 'current';
    if (currentTime != null && t < currentTime) return 'done';
    if (nextTime != null && t === nextTime) return 'next';
    return 'upcoming';
  };

  const countdown = nextTime != null ? nextTime - elapsed : null;
  const warning = started && countdown != null && countdown <= warnSeconds;
  const finished = started && nextTime == null;

  // --- haptics + step sound -------------------------------------------------------------------
  const soundPlayer = useAudioPlayer(getStepSound(stepSound)?.source ?? null);
  const lastGroup = useRef(-1);
  useEffect(() => {
    if (groupStart !== lastGroup.current && groupStart >= 0 && clock.running) {
      if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (stepSound !== 'none') {
        soundPlayer.seekTo(0).catch(() => {});
        soundPlayer.play();
      }
    }
    lastGroup.current = groupStart;
  }, [groupStart, clock.running, haptics, stepSound, soundPlayer]);

  const warnedFor = useRef<number | null>(null);
  useEffect(() => {
    if (warning && clock.running && haptics && warnedFor.current !== nextTime) {
      warnedFor.current = nextTime;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [warning, nextTime, clock.running, haptics]);

  // --- auto-follow scrolling -------------------------------------------------------------------
  // Keeps the active step pinned near the top so everything coming up is on screen. If the user
  // scrolls by hand, following pauses for a few seconds (or until they tap "Follow").
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const rowY = useRef<number[]>([]);
  const [followPaused, setFollowPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToStep = useCallback((index: number, animated = true) => {
    const y = index <= 0 ? 0 : (rowY.current[index] ?? 0) - 12;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated });
  }, []);

  // While not started, follow the step that is about to happen instead.
  const followIndex = groupStart >= 0 ? groupStart : 0;
  useEffect(() => {
    if (!followPaused && started) scrollToStep(followIndex);
  }, [followIndex, followPaused, started, scrollToStep]);

  const onUserScroll = () => {
    if (!started) return;
    setFollowPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setFollowPaused(false), FOLLOW_RESUME_MS);
  };
  const resumeFollow = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setFollowPaused(false);
    scrollToStep(followIndex);
  };
  useEffect(() => () => void (resumeTimer.current && clearTimeout(resumeTimer.current)), []);

  // --- leaving / resetting ---------------------------------------------------------------------
  const leave = useCallback(() => {
    if (!clock.running) {
      router.back();
      return;
    }
    confirm({ title: 'Leave this build?', message: 'The timer will stop.', confirmText: 'Leave', cancelText: 'Stay', destructive: true }).then(
      (ok) => ok && router.back()
    );
  }, [clock.running]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  const reset = async () => {
    if (!(await confirm({ title: 'Reset timer?', confirmText: 'Reset', destructive: true }))) return;
    clock.reset();
    setFollowPaused(false);
    scrollToStep(0);
  };

  const jumpTo = async (i: number) => {
    const ok = await confirm({
      title: `Set timer to ${formatTime(times[i])}?`,
      message: 'Use this to line up with the in-game clock.',
      confirmText: 'Set',
    });
    if (ok) clock.setElapsed(times[i]);
  };

  if (!build) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <EmptyState icon="alert-circle-outline" title="Build not found" action={<Button title="Back" onPress={() => router.back()} />} />
      </View>
    );
  }

  const nextStep = nextTime != null ? steps[times.indexOf(nextTime)] : undefined;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top bar + clock */}
      <View style={[styles.top, { paddingTop: insets.top + 4, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Image source={THEME_ART[theme.id].header} style={StyleSheet.absoluteFill} contentFit="cover" />
        {/* Heavy tint: the art is decoration, the clock has to stay readable. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, opacity: 0.86 }]} />
        <View style={styles.topRow}>
          <IconButton icon="chevron-left" size={30} label="Back" onPress={leave} color={colors.primary} />
          <CivBadge civ={build.civ} height={20} />
          <Txt variant="heading" numberOfLines={1} style={{ flex: 1 }}>
            {build.title}
          </Txt>
          <IconButton icon="restore" label="Reset timer" onPress={reset} disabled={!started} />
        </View>
        <View style={styles.clockRow}>
          <Text style={[styles.clock, { color: clock.running ? colors.text : colors.textMuted }]}>{formatTime(elapsed)}</Text>
          <View style={styles.nextBox}>
            {!started ? (
              <Txt variant="muted">Press Start when the match begins.</Txt>
            ) : finished ? (
              <Txt variant="muted" color={colors.primary} style={{ fontWeight: '700' }}>
                Build order complete — good luck!
              </Txt>
            ) : (
              <>
                <Txt variant="small" color={warning ? colors.accent : colors.textMuted} style={{ fontWeight: '700' }}>
                  NEXT IN {formatTime(Math.ceil(countdown ?? 0))}
                </Txt>
                <Txt numberOfLines={2} style={{ fontSize: 14 }}>
                  {nextStep?.note || '—'}
                </Txt>
              </>
            )}
          </View>
        </View>
        {started && !finished && nextTime != null && (
          <ProgressBar
            from={currentTime ?? 0}
            to={nextTime}
            value={elapsed}
            color={warning ? colors.accent : colors.primary}
            track={colors.surfaceAlt}
          />
        )}
      </View>

      {/* Steps */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.steps, { paddingBottom: height * 0.6 }]}
        onScrollBeginDrag={onUserScroll}
        scrollEventThrottle={64}>
        {steps.map((step, i) => (
          <Pressable
            key={step.id}
            onLongPress={() => jumpTo(i)}
            delayLongPress={400}
            onLayout={(e: LayoutChangeEvent) => {
              rowY.current[i] = e.nativeEvent.layout.y;
            }}>
            <StepRow
              step={step}
              state={stateOf(i)}
              countdown={stateOf(i) === 'next' && countdown != null ? Math.ceil(countdown) : undefined}
              large
            />
          </Pressable>
        ))}
        <Txt variant="small" style={{ textAlign: 'center', marginTop: 8 }}>
          Long-press a step to set the timer to it.
        </Txt>
      </ScrollView>

      {followPaused && (
        <Pressable
          onPress={resumeFollow}
          style={[styles.follow, { backgroundColor: colors.accent, bottom: insets.bottom + 96 }]}
          accessibilityRole="button">
          <Icon name="crosshairs-gps" size={16} color="#fff" />
          <Text style={styles.followText}>Follow</Text>
        </Pressable>
      )}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 12, backgroundColor: colors.surface, borderColor: colors.border }]}>
        {!started ? (
          <Button title="Start build" icon="play" size="lg" onPress={clock.start} style={{ flex: 1 }} />
        ) : (
          <>
            <Button title="−10s" variant="secondary" size="lg" onPress={() => nudge(-10)} />
            <Button
              title={clock.running ? 'Pause' : 'Resume'}
              icon={clock.running ? 'pause' : 'play'}
              size="lg"
              variant={clock.running ? 'secondary' : 'primary'}
              onPress={clock.running ? clock.pause : clock.start}
              style={{ flex: 1 }}
            />
            <Button title="+10s" variant="secondary" size="lg" onPress={() => nudge(10)} />
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Match timer. Based on wall-clock timestamps rather than counting ticks, so it stays correct
 * if the app is backgrounded or the JS thread stalls.
 */
function useBuildClock() {
  const [clock, setClock] = useState<Clock>({ running: false, baseMs: 0, since: 0 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!clock.running) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [clock.running]);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setClock((c) => ({ running: true, baseMs: c.baseMs, since: t }));
  }, []);

  const pause = useCallback(() => {
    const t = Date.now();
    setClock((c) => ({ running: false, baseMs: c.baseMs + t - c.since, since: 0 }));
  }, []);

  const setElapsed = useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setClock((c) => ({ ...c, baseMs: Math.max(0, seconds) * 1000, since: t }));
  }, []);

  const reset = useCallback(() => setClock({ running: false, baseMs: 0, since: 0 }), []);

  const elapsedMs = clock.baseMs + (clock.running ? Math.max(0, now - clock.since) : 0);
  return {
    running: clock.running,
    started: clock.running || clock.baseMs > 0,
    elapsed: elapsedMs / 1000,
    start,
    pause,
    setElapsed,
    reset,
  };
}

function ProgressBar({ from, to, value, color, track }: { from: number; to: number; value: number; color: string; track: string }) {
  const pct = to > from ? Math.min(1, Math.max(0, (value - from) / (to - from))) : 0;
  return (
    <View style={[styles.progressTrack, { backgroundColor: track }]}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 6 },
  clock: { fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  nextBox: { flex: 1, gap: 2 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginHorizontal: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  steps: { padding: 12, gap: 10 },
  follow: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
  },
  followText: { color: '#fff', fontWeight: '800' },
  controls: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
