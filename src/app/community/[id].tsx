import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { CivBadge } from '@/components/civ-badge';
import { StepRow } from '@/components/step-row';
import { Button, EmptyState, Txt } from '@/components/ui';
import { getCiv } from '@/constants/civs';
import { useAccount } from '@/lib/account';
import { fetchCommunityBuild, setVote } from '@/lib/community';
import { confirm, errorMessage, notify } from '@/lib/dialog';
import { importCommunityBuild, libraryStore } from '@/lib/library';
import { buildDuration, formatTime } from '@/lib/time';
import type { CommunityBuild } from '@/lib/types';
import { useColors } from '@/theme/use-app-theme';

export default function CommunityBuildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const account = useAccount();
  const [build, setBuild] = useState<CommunityBuild | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localCopy = libraryStore.useValue((list) => list.find((b) => b.remote?.id === id));

  useEffect(() => {
    let cancelled = false;
    fetchCommunityBuild(id)
      .then((b) => !cancelled && setBuild(b))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [id, account?.key]);

  if (error) return <EmptyState icon="alert-circle-outline" title="Could not load build" body={error} />;
  if (!build) return <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />;

  const isMine = account?.playerId === build.author_id;
  const openCopy = () => localCopy && router.push({ pathname: '/build/[id]', params: { id: localCopy.id } });

  const toggleVote = async () => {
    if (!account) {
      router.push('/account');
      return;
    }
    const prev = build;
    const voted = !build.voted;
    setBuild({ ...build, voted, upvotes: build.upvotes + (voted ? 1 : -1) });
    try {
      setBuild({ ...build, voted, upvotes: await setVote(build.id, voted) });
    } catch (e) {
      setBuild(prev);
      notify('Could not vote', errorMessage(e));
    }
  };

  const addToLibrary = async () => {
    if (localCopy) {
      const ok = await confirm({
        title: 'Update your copy?',
        message: 'Replaces your copy with the latest community version. Your own edits to it will be lost.',
        confirmText: 'Update',
        destructive: true,
      });
      if (!ok) return;
    }
    const saved = importCommunityBuild(build, account?.playerId);
    router.push({ pathname: '/build/[id]', params: { id: saved.id } });
  };

  return (
    <>
      <Stack.Screen options={{ title: getCiv(build.civ).name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <CivBadge civ={build.civ} height={36} />
          <View style={{ flex: 1 }}>
            <Txt variant="title" style={{ fontSize: 24 }}>
              {build.title}
            </Txt>
            <Txt variant="muted">
              by {build.author_name} · {build.steps.length} steps · {formatTime(buildDuration(build.steps))}
            </Txt>
          </View>
        </View>

        {!!build.description && <Txt variant="muted">{build.description}</Txt>}

        <View style={styles.actions}>
          <Button
            title={`${build.upvotes}`}
            icon={build.voted ? 'arrow-up-bold' : 'arrow-up-bold-outline'}
            variant={build.voted ? 'primary' : 'secondary'}
            onPress={toggleVote}
            disabled={isMine}
            accessibilityLabel={build.voted ? 'Remove upvote' : 'Upvote'}
          />
          {isMine ? (
            <Button title="Your build" icon="check" variant="secondary" disabled style={{ flex: 1 }} />
          ) : localCopy ? (
            <>
              <Button title="Open my copy" icon="book-open-variant" onPress={openCopy} style={{ flex: 1 }} />
              <Button title="Update" icon="refresh" variant="secondary" onPress={addToLibrary} />
            </>
          ) : (
            <Button title="Add to library" icon="plus" onPress={addToLibrary} style={{ flex: 1 }} />
          )}
        </View>

        <Txt variant="heading" style={{ marginTop: 8 }}>
          Steps
        </Txt>
        <View style={{ gap: 10 }}>
          {build.steps.map((s, i) => (
            <StepRow key={s.id || String(i)} step={s} />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actions: { flexDirection: 'row', gap: 10 },
});
