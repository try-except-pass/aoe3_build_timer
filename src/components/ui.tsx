import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { useColors } from '@/theme/use-app-theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const colors = useColors();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? colors.text} />;
}

type TxtProps = TextProps & { variant?: 'title' | 'heading' | 'body' | 'muted' | 'small' | 'mono'; color?: string };

export function Txt({ variant = 'body', color, style, ...rest }: TxtProps) {
  const colors = useColors();
  const base = variant === 'muted' || variant === 'small' ? colors.textMuted : colors.text;
  return <Text style={[textStyles[variant], { color: color ?? base }, style]} {...rest} />;
}

const textStyles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', letterSpacing: 0.2 },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  muted: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 16 },
  mono: { fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '700' },
});

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, icon, variant = 'primary', size = 'md', loading, disabled, style, ...rest }: ButtonProps) {
  const colors = useColors();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surfaceAlt
          : 'transparent';
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? '#fff' : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' && styles.buttonLg,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        variant === 'secondary' && { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} color={fg} size={size === 'lg' ? 22 : 18} />}
          <Text style={[styles.buttonText, size === 'lg' && styles.buttonTextLg, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 22,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: disabled ? 0.3 : pressed ? 0.5 : 1 }]}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  left,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  left?: ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}>
      {left}
      <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      {label && <Txt variant="small">{label}</Txt>}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border },
          rest.multiline && styles.inputMultiline,
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={48} color={colors.textMuted} />
      <Txt variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {body && (
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          {body}
        </Txt>
      )}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: 10,
  },
  buttonLg: { minHeight: 56, borderRadius: 14, paddingHorizontal: 22 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  buttonTextLg: { fontSize: 18, fontWeight: '800' },
  iconButton: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  field: { gap: 6 },
  input: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, minHeight: 44, fontSize: 16 },
  inputMultiline: { paddingTop: 10, paddingBottom: 10, minHeight: 80, textAlignVertical: 'top' },
  empty: { alignItems: 'center', gap: 10, padding: 32 },
});
