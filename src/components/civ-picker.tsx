import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { CivBadge } from '@/components/civ-badge';
import { IconButton, Txt } from '@/components/ui';
import { ANY_CIV, CIVS, type CivId } from '@/constants/civs';
import { THEMES } from '@/theme/themes';
import { useColors } from '@/theme/use-app-theme';

type Props = {
  visible: boolean;
  value: CivId | null;
  onSelect: (civ: CivId) => void;
  onClose: () => void;
  /** Shows an "Any civ" option (used for build orders that aren't civ-specific). */
  allowAny?: boolean;
};

/** Civilizations grouped by the expansion that introduced them. */
export function CivPicker({ visible, value, onSelect, onClose, allowAny = true }: Props) {
  const colors = useColors();

  const option = (id: CivId, name: string) => {
    const selected = value === id;
    return (
      <Pressable
        key={id}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => {
          onSelect(id);
          onClose();
        }}
        style={[
          styles.option,
          { backgroundColor: selected ? colors.current : colors.surface, borderColor: selected ? colors.primary : colors.border },
        ]}>
        <CivBadge civ={id} height={22} />
        <Txt numberOfLines={1} style={{ flexShrink: 1, fontWeight: '600' }}>
          {name}
        </Txt>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Txt variant="heading" style={{ flex: 1 }}>
              Civilization
            </Txt>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {allowAny && <View style={styles.grid}>{option(ANY_CIV.id, ANY_CIV.name)}</View>}
            {THEMES.map((dlc) => {
              const civs = CIVS.filter((c) => c.dlc === dlc.id);
              if (!civs.length) return null;
              return (
                <View key={dlc.id} style={{ gap: 8 }}>
                  <Txt variant="small" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    {dlc.name}
                  </Txt>
                  <View style={styles.grid}>{civs.map((c) => option(c.id, c.name))}</View>
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: '47%',
    flexGrow: 1,
    flexBasis: '47%',
  },
});
