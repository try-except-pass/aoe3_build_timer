import { router, Stack, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CivBadge } from '@/components/civ-badge';
import { CivPicker } from '@/components/civ-picker';
import { GameIcon } from '@/components/game-icon';
import { IconPicker, MAX_ICONS_PER_STEP } from '@/components/icon-picker';
import { Button, Field, Icon, IconButton, Txt } from '@/components/ui';
import { getCiv } from '@/constants/civs';
import { confirm } from '@/lib/dialog';
import { emptyBuild, getBuild, saveBuild } from '@/lib/library';
import { effectiveTimes, formatTime, newId, parseTime, sortStepsByTime } from '@/lib/time';
import type { BuildOrder, BuildStep } from '@/lib/types';
import { useColors } from '@/theme/use-app-theme';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export default function EditBuildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<BuildOrder>(() => {
    const existing = isNew ? undefined : getBuild(id);
    return existing ? clone(existing) : emptyBuild();
  });
  const [dirty, setDirty] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [civOpen, setCivOpen] = useState(false);

  const update = (patch: Partial<BuildOrder>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setSteps = useCallback((fn: (steps: BuildStep[]) => BuildStep[]) => {
    setDraft((d) => ({ ...d, steps: fn(d.steps) }));
    setDirty(true);
  }, []);

  const updateStep = useCallback(
    (stepId: string, patch: Partial<BuildStep>) => setSteps((s) => s.map((x) => (x.id === stepId ? { ...x, ...patch } : x))),
    [setSteps]
  );
  const moveStep = useCallback(
    (index: number, dir: -1 | 1) =>
      setSteps((s) => {
        const j = index + dir;
        if (j < 0 || j >= s.length) return s;
        const next = [...s];
        [next[index], next[j]] = [next[j], next[index]];
        return next;
      }),
    [setSteps]
  );
  const removeStep = useCallback((stepId: string) => setSteps((s) => s.filter((x) => x.id !== stepId)), [setSteps]);
  const duplicateStep = useCallback(
    (index: number) => setSteps((s) => [...s.slice(0, index + 1), { ...s[index], id: newId() }, ...s.slice(index + 1)]),
    [setSteps]
  );

  const addStep = () =>
    setSteps((s) => {
      const times = effectiveTimes(s);
      const last = times.length ? times[times.length - 1] : -30;
      return [...s, { id: newId(), time: last + 30, icons: [], note: '' }];
    });

  const save = () => {
    const saved = saveBuild({
      ...draft,
      title: draft.title.trim() || 'Untitled build',
      steps: sortStepsByTime(draft.steps),
    });
    setDirty(false);
    if (isNew) router.replace({ pathname: '/build/[id]', params: { id: saved.id } });
    else router.back();
  };

  const cancel = useCallback(() => {
    if (!dirty) {
      router.back();
      return;
    }
    confirm({ title: 'Discard changes?', confirmText: 'Discard', cancelText: 'Keep editing', destructive: true }).then(
      (ok) => ok && router.back()
    );
  }, [dirty]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dirty) return false;
      cancel();
      return true;
    });
    return () => sub.remove();
  }, [dirty, cancel]);

  const pickerStep = draft.steps.find((s) => s.id === pickerFor);

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'New build' : 'Edit build',
          gestureEnabled: !dirty,
          headerBackVisible: false,
          headerLeft: () => <Button title="Cancel" variant="ghost" onPress={cancel} />,
          headerRight: () => <Button title="Save" onPress={save} />,
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Title" placeholder="e.g. Fast Fortress into Falconets" value={draft.title} onChangeText={(title) => update({ title })} maxLength={80} />

          <View style={{ gap: 6 }}>
            <Txt variant="small">Civilization</Txt>
            <Pressable
              onPress={() => setCivOpen(true)}
              style={[styles.civButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <CivBadge civ={draft.civ} height={22} />
              <Txt style={{ flex: 1, fontWeight: '600' }}>{getCiv(draft.civ).name}</Txt>
              <Icon name="chevron-down" color={colors.textMuted} />
            </Pressable>
          </View>

          <Field
            label="Description"
            placeholder="Matchups, map type, what to watch out for…"
            value={draft.description}
            onChangeText={(description) => update({ description })}
            multiline
            maxLength={2000}
          />

          <View style={styles.stepsHeader}>
            <Txt variant="heading" style={{ flex: 1 }}>
              Steps ({draft.steps.length})
            </Txt>
          </View>
          <Txt variant="small">
            Time is when the step should happen (m:ss). Leave it empty for a step that follows the previous one. Steps are sorted by time when you save.
          </Txt>

          {draft.steps.map((step, i) => (
            <StepEditor
              key={step.id}
              step={step}
              index={i}
              isFirst={i === 0}
              isLast={i === draft.steps.length - 1}
              onChange={updateStep}
              onMove={moveStep}
              onRemove={removeStep}
              onDuplicate={duplicateStep}
              onPickIcons={setPickerFor}
            />
          ))}

          <Button title="Add step" icon="plus" variant="secondary" onPress={addStep} />
        </ScrollView>
      </KeyboardAvoidingView>

      <IconPicker
        visible={!!pickerStep}
        civ={draft.civ}
        selected={pickerStep?.icons ?? []}
        onChange={(icons) => pickerStep && updateStep(pickerStep.id, { icons })}
        onClose={() => setPickerFor(null)}
      />
      <CivPicker visible={civOpen} value={draft.civ} onSelect={(civ) => update({ civ })} onClose={() => setCivOpen(false)} />
    </>
  );
}

type StepEditorProps = {
  step: BuildStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (id: string, patch: Partial<BuildStep>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onDuplicate: (index: number) => void;
  onPickIcons: (id: string) => void;
};

const StepEditor = memo(function StepEditor({ step, index, isFirst, isLast, onChange, onMove, onRemove, onDuplicate, onPickIcons }: StepEditorProps) {
  const colors = useColors();
  return (
    <View style={[styles.step, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.stepTop}>
        <TimeInput value={step.time} onChange={(time) => onChange(step.id, { time })} />
        <View style={styles.stepActions}>
          <IconButton icon="arrow-up" label="Move up" onPress={() => onMove(index, -1)} disabled={isFirst} size={20} />
          <IconButton icon="arrow-down" label="Move down" onPress={() => onMove(index, 1)} disabled={isLast} size={20} />
          <IconButton icon="content-copy" label="Duplicate step" onPress={() => onDuplicate(index)} size={18} />
          <IconButton icon="trash-can-outline" label="Delete step" onPress={() => onRemove(step.id)} color={colors.danger} size={20} />
        </View>
      </View>
      <View style={styles.stepBody}>
        <Pressable onPress={() => onPickIcons(step.id)} style={styles.iconSlot} accessibilityLabel="Choose icons">
          {step.icons.map((iconId, i) => (
            <GameIcon key={`${iconId}-${i}`} id={iconId} size={40} />
          ))}
          {step.icons.length < MAX_ICONS_PER_STEP && (
            <View style={[styles.addIcon, { borderColor: colors.border }]}>
              <Icon name="plus" color={colors.textMuted} />
            </View>
          )}
        </Pressable>
        <TextInput
          value={step.note}
          onChangeText={(note) => onChange(step.id, { note })}
          placeholder="What to do…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={300}
          style={[styles.note, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        />
      </View>
    </View>
  );
});

function TimeInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const colors = useColors();
  const format = (v: number | null) => (v == null ? '' : formatTime(v));
  const [text, setText] = useState(format(value));
  const [invalid, setInvalid] = useState(false);

  // Re-sync the text when the value changes from outside (e.g. a reorder).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(format(value));
  }

  const commit = () => {
    const parsed = parseTime(text);
    if (parsed === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(format(parsed));
    if (parsed !== value) onChange(parsed);
  };

  return (
    <View style={styles.timeWrap}>
      <Icon name="clock-outline" size={16} color={invalid ? colors.danger : colors.textMuted} />
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setInvalid(false);
        }}
        onEndEditing={commit}
        onBlur={commit}
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
        returnKeyType="done"
        selectTextOnFocus
        maxLength={8}
        style={[
          styles.timeInput,
          { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: invalid ? colors.danger : colors.border },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 80 },
  civButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  stepsHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  step: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8 },
  stepTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepActions: { flexDirection: 'row', alignItems: 'center' },
  stepBody: { flexDirection: 'row', gap: 10 },
  iconSlot: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: 88, alignContent: 'flex-start' },
  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flex: 1,
    minHeight: 84,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: {
    width: 76,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});
