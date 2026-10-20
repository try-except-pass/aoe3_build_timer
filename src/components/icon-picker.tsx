import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, Field, IconButton, Txt } from '@/components/ui';
import { ICON_CATEGORY_LABELS, type IconCategory, type IconDef } from '@/data/icon-types';
import { getIcon, hasCivIconData, searchIcons } from '@/data/icons';
import { getCiv } from '@/constants/civs';
import { CivBadge } from '@/components/civ-badge';
import { rememberIcon, settingsStore } from '@/lib/settings';
import { useColors } from '@/theme/use-app-theme';

export const MAX_ICONS_PER_STEP = 4;

type Filter = IconCategory | 'all' | 'recent';
const FILTERS: Filter[] = ['recent', 'all', 'age', 'eco', 'unit', 'building', 'card', 'tech', 'naval'];

type Props = {
  visible: boolean;
  /** The build's civ; only icons that civ can use are listed unless "All civs" is on. */
  civ: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
};

export function IconPicker({ visible, civ, selected, onChange, onClose }: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const recent = settingsStore.useValue((s) => s.recentIcons);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(recent.length ? 'recent' : 'all');
  const [allCivs, setAllCivs] = useState(false);
  const civFilterable = hasCivIconData(civ);
  const effectiveCiv = civFilterable && !allCivs ? civ : 'any';

  const columns = Math.max(4, Math.floor(Math.min(width, 700) / 88));
  const cell = (Math.min(width, 700) - 24) / columns;

  const results = useMemo<IconDef[]>(() => {
    if (filter === 'recent' && !query) return recent.map(getIcon).filter((i): i is IconDef => !!i);
    return searchIcons(query, filter === 'recent' ? 'all' : filter, effectiveCiv);
  }, [filter, query, recent, effectiveCiv]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
      return;
    }
    if (selected.length >= MAX_ICONS_PER_STEP) return;
    rememberIcon(id);
    onChange([...selected, id]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Txt variant="heading" style={{ flex: 1 }}>
              Pick icons ({selected.length}/{MAX_ICONS_PER_STEP})
            </Txt>
            <Button title="Done" onPress={onClose} />
          </View>

          <View style={styles.selectedRow}>
            {selected.length === 0 ? (
              <Txt variant="muted">Tap icons to add them to this step.</Txt>
            ) : (
              selected.map((id) => {
                const icon = getIcon(id);
                return (
                  <Pressable key={id} onPress={() => toggle(id)} accessibilityLabel={`Remove ${icon?.name ?? id}`}>
                    {icon && <Image source={icon.source} style={[styles.selectedIcon, { borderColor: colors.primary }]} />}
                  </Pressable>
                );
              })
            )}
          </View>

          {civFilterable && (
            <View style={styles.civRow}>
              <Chip
                label={`Only ${getCiv(civ).name}`}
                selected={!allCivs}
                onPress={() => setAllCivs(false)}
                left={<CivBadge civ={civ} height={14} />}
              />
              <Chip label="All civs" selected={allCivs} onPress={() => setAllCivs(true)} />
            </View>
          )}

          <View style={{ paddingHorizontal: 12 }}>
            <Field
              placeholder="Search units, buildings, cards, techs…"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>

          {/* Fixed-height row: a horizontal ScrollView alone can collapse and let the grid overlap it. */}
          <View style={styles.filtersBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {FILTERS.map((f) => (
                <Chip
                  key={f}
                  label={f === 'recent' ? 'Recent' : f === 'all' ? 'All' : ICON_CATEGORY_LABELS[f]}
                  selected={filter === f}
                  onPress={() => setFilter(f)}
                />
              ))}
            </ScrollView>
          </View>

          <FlatList
            style={styles.grid}
            key={columns}
            data={results}
            numColumns={columns}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={40}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
            ListEmptyComponent={
              <Txt variant="muted" style={{ textAlign: 'center', padding: 24 }}>
                {filter === 'recent' && !query ? 'Icons you use will show up here.' : 'No icons match.'}
              </Txt>
            }
            renderItem={({ item }) => {
              const isSelected = selected.includes(item.id);
              return (
                <Pressable
                  onPress={() => toggle(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [styles.cell, { width: cell, opacity: pressed ? 0.6 : 1 }]}>
                  <Image
                    source={item.source}
                    recyclingKey={item.id}
                    style={[
                      styles.cellIcon,
                      { borderColor: isSelected ? colors.primary : 'transparent' },
                    ]}
                  />
                  <Txt variant="small" numberOfLines={2} style={styles.cellLabel}>
                    {item.name}
                  </Txt>
                </Pressable>
              );
            }}
          />
          <View style={styles.closeCorner}>
            <IconButton icon="close" label="Close" onPress={onClose} color={colors.textMuted} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingRight: 56 },
  closeCorner: { position: 'absolute', top: 12, right: 8 },
  selectedRow: { flexDirection: 'row', gap: 8, minHeight: 60, alignItems: 'center', paddingHorizontal: 16 },
  selectedIcon: { width: 48, height: 48, borderRadius: 8, borderWidth: 2 },
  civRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  filtersBar: { height: 54, flexShrink: 0, justifyContent: 'center' },
  filters: { gap: 8, paddingHorizontal: 12, alignItems: 'center' },
  grid: { flex: 1 },
  cell: { alignItems: 'center', paddingVertical: 6, gap: 4 },
  cellIcon: { width: 56, height: 56, borderRadius: 8, borderWidth: 2 },
  cellLabel: { textAlign: 'center', paddingHorizontal: 2 },
});
