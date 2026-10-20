import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { BuildCard } from '@/components/build-card';
import { CivBadge } from '@/components/civ-badge';
import { CivPicker } from '@/components/civ-picker';
import { ScreenHeader } from '@/components/screen-header';
import { Chip, EmptyState, Field, IconButton, Txt } from '@/components/ui';
import { getCiv, type CivId } from '@/constants/civs';
import { searchBuilds, type SortMode } from '@/lib/community';
import { useAccount } from '@/lib/account';
import type { CommunityBuild } from '@/lib/types';
import { useColors } from '@/theme/use-app-theme';

export default function CommunityScreen() {
  const colors = useColors();
  const account = useAccount();

  const [query, setQuery] = useState('');
  const [civ, setCiv] = useState<CivId | null>(null);
  const [sort, setSort] = useState<SortMode>('top');
  const [civOpen, setCivOpen] = useState(false);

  const [builds, setBuilds] = useState<CommunityBuild[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (nextPage: number, mode: 'replace' | 'append' | 'refresh') => {
      const req = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await searchBuilds({ query, civ, sort, page: nextPage });
        if (req !== requestId.current) return;
        setBuilds((prev) => (mode === 'append' ? [...prev, ...res.builds] : res.builds));
        setHasMore(res.hasMore);
        setPage(nextPage);
      } catch (e: any) {
        if (req === requestId.current) setError(e?.message ?? 'Could not load builds.');
      } finally {
        if (req === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [query, civ, sort]
  );

  // Reload (debounced, for typing) on filter changes and when the signed-in user changes,
  // since vote state differs per user.
  useEffect(() => {
    const t = setTimeout(() => load(0, 'replace'), 350);
    return () => clearTimeout(t);
  }, [load, account?.key]);

  const accountButton = (
    <IconButton
      icon={account ? 'account-key' : 'key-plus'}
      size={30}
      color={account ? colors.primary : colors.textMuted}
      label={account ? `Player key: ${account.authorName}` : 'Set up your player key'}
      onPress={() => router.push('/account')}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Community" right={accountButton} />
      <FlatList
        data={builds}
        keyExtractor={(b) => b.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(0, 'refresh')} tintColor={colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => hasMore && !loading && load(page + 1, 'append')}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <Field
              placeholder="Search builds (e.g. fast fortress, treaty, FF)"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Chip label="Top" selected={sort === 'top'} onPress={() => setSort('top')} />
              <Chip label="New" selected={sort === 'new'} onPress={() => setSort('new')} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Chip
                label={civ ? getCiv(civ).name : 'All civs'}
                selected={!!civ}
                onPress={() => setCivOpen(true)}
                left={civ ? <CivBadge civ={civ} height={16} /> : undefined}
              />
              {civ && <Chip label="Clear" onPress={() => setCiv(null)} />}
            </ScrollView>
            {error && (
              <Txt color={colors.danger} variant="muted">
                {error}
              </Txt>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState
              icon="magnify-close"
              title="No builds found"
              body="Try a different search, or publish one of your own from your library."
            />
          )
        }
        ListFooterComponent={loading && builds.length > 0 ? <ActivityIndicator color={colors.primary} /> : undefined}
        renderItem={({ item }) => (
          <BuildCard
            title={item.title}
            civ={item.civ}
            steps={item.steps}
            subtitle={`by ${item.author_name}`}
            upvotes={item.upvotes}
            voted={item.voted}
            onPress={() => router.push({ pathname: '/community/[id]', params: { id: item.id } })}
          />
        )}
      />
      <CivPicker visible={civOpen} value={civ} onSelect={setCiv} onClose={() => setCivOpen(false)} allowAny={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 14, paddingBottom: 120 },
  filters: { gap: 8, alignItems: 'center' },
  divider: { width: 1, height: 20, marginHorizontal: 4 },
});
