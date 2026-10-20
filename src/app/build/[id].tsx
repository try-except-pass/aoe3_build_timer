import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CivBadge } from '@/components/civ-badge';
import { StepRow } from '@/components/step-row';
import { Button, Card, EmptyState, IconButton, Txt } from '@/components/ui';
import { getCiv } from '@/constants/civs';
import { useAccount } from '@/lib/account';
import { fetchCommunityBuild, publishBuild, setVote, unpublishBuild } from '@/lib/community';
import { confirm, errorMessage, notify } from '@/lib/dialog';
import { deleteBuild, duplicateBuild, useBuild } from '@/lib/library';
import { buildDuration, formatTime } from '@/lib/time';
import { useColors } from '@/theme/use-app-theme';

export default function BuildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const build = useBuild(id);
  const colors = useColors();
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [vote, setVoteState] = useState<{ voted: boolean; upvotes: number } | null>(null);

  const remoteId = build?.remote?.id;
  // Published by this player (on any device that uses the same key).
  const isMine = !!build?.remote && (build.remote.mine || build.remote.authorId === account?.playerId);
  const isImported = !!build?.remote && !isMine;

  // Imported builds show their live vote count and let you upvote from here.
  useEffect(() => {
    if (!remoteId) return;
    let cancelled = false;
    fetchCommunityBuild(remoteId)
      .then((cb) => !cancelled && setVoteState({ voted: !!cb.voted, upvotes: cb.upvotes }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [remoteId, account?.key]);

  if (!build) {
    return <EmptyState icon="alert-circle-outline" title="Build not found" />;
  }

  const confirmDelete = async () => {
    const ok = await confirm({
      title: 'Delete build?',
      message: isMine ? 'It stays published in the community until you unpublish it.' : undefined,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    router.back();
    deleteBuild(build.id);
  };

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) notify(success);
    } catch (e) {
      notify('Something went wrong', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    if (!account) {
      router.push('/account');
      return;
    }
    run(() => publishBuild(build), isMine ? 'Community copy updated.' : 'Published to the community!');
  };

  const unpublish = async () => {
    const ok = await confirm({
      title: 'Unpublish?',
      message: 'Removes it from the community, including its upvotes. Your local copy stays.',
      confirmText: 'Unpublish',
      destructive: true,
    });
    if (ok) run(() => unpublishBuild(build));
  };

  const toggleVote = async () => {
    if (!remoteId || !vote) return;
    if (!account) {
      router.push('/account');
      return;
    }
    const next = !vote.voted;
    setVoteState({ voted: next, upvotes: vote.upvotes + (next ? 1 : -1) });
    try {
      setVoteState({ voted: next, upvotes: await setVote(remoteId, next) });
    } catch (e) {
      setVoteState(vote);
      notify('Could not vote', errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: getCiv(build.civ).name,
          headerRight: () => (
            <IconButton
              icon="pencil"
              label="Edit"
              color={colors.primary}
              onPress={() => router.push({ pathname: '/edit/[id]', params: { id: build.id } })}
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <CivBadge civ={build.civ} height={36} />
          <View style={{ flex: 1 }}>
            <Txt variant="title" style={{ fontSize: 24 }}>
              {build.title || 'Untitled build'}
            </Txt>
            <Txt variant="muted">
              {build.steps.length} steps · {formatTime(buildDuration(build.steps))}
              {isImported ? ` · by ${build.remote!.authorName}` : ''}
            </Txt>
          </View>
        </View>

        {!!build.description && <Txt variant="muted">{build.description}</Txt>}

        <Button
          title="Start build"
          icon="play"
          size="lg"
          onPress={() => router.push({ pathname: '/play/[id]', params: { id: build.id } })}
          disabled={build.steps.length === 0}
        />

        <View style={styles.actions}>
          <Button title="Duplicate" icon="content-copy" variant="secondary" onPress={() => {
            const copy = duplicateBuild(build.id);
            if (copy) router.replace({ pathname: '/build/[id]', params: { id: copy.id } });
          }} style={styles.action} />
          <Button title="Delete" icon="trash-can-outline" variant="secondary" onPress={confirmDelete} style={styles.action} />
        </View>

        <Card style={{ gap: 10 }}>
          <Txt variant="heading">Community</Txt>
          {isImported ? (
            <>
              <Txt variant="muted">Imported from {build.remote!.authorName}. Upvote it if it helped you.</Txt>
              <View style={styles.actions}>
                <Button
                  title={vote ? `${vote.voted ? 'Upvoted' : 'Upvote'} · ${vote.upvotes}` : 'Upvote'}
                  icon={vote?.voted ? 'arrow-up-bold' : 'arrow-up-bold-outline'}
                  variant={vote?.voted ? 'primary' : 'secondary'}
                  onPress={toggleVote}
                  disabled={!vote}
                  style={styles.action}
                />
                <Button
                  title="View"
                  icon="open-in-new"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/community/[id]', params: { id: remoteId! } })}
                  style={styles.action}
                />
              </View>
              <Txt variant="small">Your edits stay in your library; the community version doesn&apos;t change.</Txt>
            </>
          ) : isMine ? (
            <>
              <Txt variant="muted">Published. Push your latest edits, or take it down.</Txt>
              <View style={styles.actions}>
                <Button title="Update" icon="cloud-upload-outline" onPress={publish} loading={busy} style={styles.action} />
                <Button title="Unpublish" icon="cloud-off-outline" variant="secondary" onPress={unpublish} disabled={busy} style={styles.action} />
              </View>
            </>
          ) : (
            <>
              <Txt variant="muted">Share this build so other players can find, use and upvote it.</Txt>
              <Button title={account ? 'Publish' : 'Set up your key to publish'} icon="cloud-upload-outline" onPress={publish} loading={busy} />
            </>
          )}
        </Card>

        <Txt variant="heading" style={{ marginTop: 8 }}>
          Steps
        </Txt>
        <View style={{ gap: 10 }}>
          {build.steps.map((s) => (
            <StepRow key={s.id} step={s} />
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
  action: { flex: 1 },
});
