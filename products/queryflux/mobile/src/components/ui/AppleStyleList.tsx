import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ListRenderItem,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@context';
import { ChevronRight } from 'lucide-react-native';

// Apple HIG List Styles
type ListVariant = 'plain' | 'grouped' | 'insetGrouped';
type ListItemType = 'default' | 'subtitle' | 'value' | 'destructive' | 'navigation';

interface ListItemData {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  icon?: React.ReactNode;
  type?: ListItemType;
  disabled?: boolean;
  onPress?: () => void;
  accessory?: React.ReactNode;
}

interface AppleStyleListProps {
  data: ListItemData[];
  variant?: ListVariant;
  refreshing?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
  emptyMessage?: string;
  showsVerticalScrollIndicator?: boolean;
  ListHeaderComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
  stickyHeaderIndices?: number[];
  ItemSeparatorComponent?: React.ReactNode;
  keyExtractor?: (item: ListItemData, index: number) => string;
}

const AppleStyleList: React.FC<AppleStyleListProps> = ({
  data,
  variant = 'plain',
  refreshing = false,
  onRefresh,
  loading = false,
  emptyMessage = 'No items found',
  showsVerticalScrollIndicator = false,
  ListHeaderComponent,
  ListFooterComponent,
  stickyHeaderIndices,
  ItemSeparatorComponent,
  keyExtractor,
}) => {
  const { theme } = useTheme();

  const keyExtractorDefault = (item: ListItemData) => item.id;

  const renderListItem: ListRenderItem<ListItemData> = ({ item, index }) => {
    const getItemStyles = () => {
      const baseStyles = {
        backgroundColor: theme.colors.surface,
      };

      switch (item.type) {
        case 'destructive':
          return {
            ...baseStyles,
            backgroundColor: theme.colors.error + '10', // Apple HIG destructive background
          };
        default:
          return baseStyles;
      }
    };

    const getTitleColor = () => {
      if (item.disabled) return theme.colors.textSecondary;
      if (item.type === 'destructive') return theme.colors.error;
      return theme.colors.text;
    };

    const getSubtitleColor = () => {
      if (item.disabled) return theme.colors.textSecondary;
      return theme.colors.textSecondary;
    };

    const getValueColor = () => {
      if (item.disabled) return theme.colors.textSecondary;
      return theme.colors.textSecondary;
    };

    const styles = StyleSheet.create({
      itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        minHeight: 44, // Apple HIG minimum touch target
        backgroundColor: getItemStyles().backgroundColor,
        ...Platform.select({
          ios: {
            // iOS list item styling
            justifyContent: 'space-between',
          },
          android: {
            // Android list item styling
            justifyContent: 'space-between',
          },
        }),
      },
      groupedItem: {
        backgroundColor: theme.colors.surface,
        marginHorizontal: theme.spacing.md,
        borderRadius: 10,
        marginTop: index === 0 ? theme.spacing.sm : 0,
        marginBottom: index === data.length - 1 ? theme.spacing.sm : 0,
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
          },
          android: {
            elevation: 1,
          },
        }),
      },
      insetGroupedItem: {
        backgroundColor: theme.colors.surface,
        marginHorizontal: theme.spacing.xl * 2,
        borderRadius: 10,
        marginTop: index === 0 ? theme.spacing.sm : 0,
        marginBottom: index === data.length - 1 ? theme.spacing.sm : 0,
      },
      content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
      },
      iconContainer: {
        marginRight: theme.spacing.md,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
      },
      textContainer: {
        flex: 1,
      },
      title: {
        fontSize: 16,
        fontWeight: '400',
        color: getTitleColor(),
        ...Platform.select({
          ios: {
            fontFamily: 'System',
            fontWeight: item.type === 'navigation' ? '600' : '400',
          },
          android: {
            fontFamily: 'Roboto',
            fontWeight: item.type === 'navigation' ? '500' : '400',
          },
        }),
      },
      subtitle: {
        fontSize: 14,
        color: getSubtitleColor(),
        marginTop: 2,
        ...Platform.select({
          ios: {
            fontFamily: 'System',
          },
          android: {
            fontFamily: 'Roboto',
          },
        }),
      },
      valueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      value: {
        fontSize: 16,
        color: getValueColor(),
        marginRight: theme.spacing.sm,
        ...Platform.select({
          ios: {
            fontFamily: 'System',
          },
          android: {
            fontFamily: 'Roboto',
          },
        }),
      },
      accessory: {
        marginLeft: theme.spacing.sm,
      },
      chevron: {
        color: theme.colors.textSecondary,
        opacity: item.disabled ? 0.5 : 1,
      },
    });

    const isGrouped = variant === 'grouped' || variant === 'insetGrouped';
    const isLastItem = index === data.length - 1;
    const isFirstItem = index === 0;

    const itemStyle = [
      styles.itemContainer,
      isGrouped && styles.groupedItem,
      variant === 'insetGrouped' && styles.insetGroupedItem,
    ];

    // Add rounded corners for grouped lists
    if (isGrouped) {
      if (isFirstItem) {
        itemStyle.push({
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
        });
      }
      if (isLastItem) {
        itemStyle.push({
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
        });
      }
    }

    return (
      <TouchableOpacity
        style={itemStyle}
        onPress={item.onPress}
        disabled={item.disabled}
        activeOpacity={item.disabled ? 1 : 0.6}
        accessibilityRole="button"
        accessibilityState={{ disabled: item.disabled }}
      >
        <View style={styles.content}>
          {item.icon && (
            <View style={styles.iconContainer}>
              {item.icon}
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.title}>{item.title}</Text>
            {item.subtitle && (
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            )}
          </View>
          <View style={styles.valueContainer}>
            {item.value && (
              <Text style={styles.value}>{item.value}</Text>
            )}
            {item.accessory && (
              <View style={styles.accessory}>
                {item.accessory}
              </View>
            )}
            {item.type === 'navigation' && (
              <ChevronRight size={16} style={styles.chevron} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const DefaultSeparator = () => (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginLeft: variant === 'plain' ? 0 : theme.spacing.lg,
        marginRight: variant === 'plain' ? 0 : theme.spacing.lg,
      }}
    />
  );

  const renderSectionHeader = ({ section }: any) => {
    if (!section.title) return null;

    const styles = StyleSheet.create({
      sectionHeader: {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        backgroundColor: theme.colors.background,
      },
      sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        ...Platform.select({
          ios: {
            fontFamily: 'System',
            fontWeight: '600',
          },
          android: {
            fontFamily: 'Roboto',
            fontWeight: '600',
          },
        }),
      },
    });

    if (variant === 'grouped' || variant === 'insetGrouped') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      );
    }

    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    );
  };

  const EmptyComponent = () => (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl * 2,
    }}>
      <Text style={{
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
      }}>
        {emptyMessage}
      </Text>
    </View>
  );

  const LoadingComponent = () => (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl * 2,
    }}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
    </View>
  );

  return (
    <FlatList
      data={data}
      renderItem={renderListItem}
      keyExtractor={keyExtractor || keyExtractorDefault}
      ItemSeparatorComponent={ItemSeparatorComponent || DefaultSeparator}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      SectionSeparatorComponent={
        variant === 'plain' ? null : (
          <View style={{ height: theme.spacing.sm }} />
        )
      }
      stickyHeaderIndices={stickyHeaderIndices}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        ) : undefined
      }
      ListEmptyComponent={loading ? LoadingComponent : EmptyComponent}
      contentContainerStyle={
        data.length === 0 && !loading
          ? { flex: 1 }
          : undefined
      }
    />
  );
};

export default AppleStyleList;