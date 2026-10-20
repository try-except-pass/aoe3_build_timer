import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { BuildCard } from '@/components/build-card';
import { ScreenHeader } from '@/components/screen-header';
import { Button, EmptyState, Field, IconButton } from '@/components/ui';
import { getCiv } from '@/constants/civs';
import { useLibrary } from '@/lib/library';
import { useColors } from '@/theme/use-app-theme';

export default function LibraryScreen() {
  const colors = useColors();
  const library = useLibrary();
  const [query, setQuery] = useState('');

  const builds = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? library.filter((b) => `${b.title} ${getCiv(b.civ).name} ${b.description}`.toLowerCase().includes(q))
      : library;
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [library, query]);

  const newBuild = () => router.push('/edit/new');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Build Library"
        right={<IconButton icon="plus-circle" size={30} color={colors.primary} label="New build" onPress={newBuild} />}
      />
      <FlatList
        data={builds}
        keyExtractor={(b) => b.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          library.length > 3 ? (
            <Field placeholder="Search your builds" value={query} onChangeText={setQuery} clearButtonMode="while-editing" />
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon="script-text-outline"
            title={query ? 'No builds match' : 'Your library is empty'}
            body={query ? undefined : 'Create a build order, or grab one from the Community tab.'}
            action={!query && <Button title="New build" icon="plus" onPress={newBuild} />}
          />
        }
        renderItem={({ item }) => (
          <BuildCard
            title={item.title}
            civ={item.civ}
            steps={item.steps}
            subtitle={item.remote && !item.remote.mine ? `by ${item.remote.authorName}` : undefined}
            badge={item.remote ? (item.remote.mine ? 'Published' : 'Imported') : undefined}
            onPress={() => router.push({ pathname: '/build/[id]', params: { id: item.id } })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 14, paddingBottom: 120 },
});
