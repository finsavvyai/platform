import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, touchTarget } from '../../theme/tokens';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleRow({ label, description, value, onValueChange }: ToggleRowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { borderBottomColor: colors.borderColor }]}>
      <View style={styles.textCol}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        {description && <Text style={[styles.desc, { color: colors.textMuted }]}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.bgTertiary, true: `${colors.accentPrimary}80` }}
        thumbColor={value ? colors.accentPrimary : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: touchTarget.minHeight,
  },
  textCol: { flex: 1, marginRight: spacing.md },
  label: { ...typography.body },
  desc: { ...typography.caption1, marginTop: 2 },
});
