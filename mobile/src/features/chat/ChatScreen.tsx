import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export default function ChatScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, padding: spacing.xl },
      ]}
    >
      <Text style={[typography.h1, { color: colors.primary }]}>Chat</Text>
      <Text
        style={[
          typography.body,
          { color: colors.textSecondary, marginTop: spacing.sm },
        ]}
      >
        Chat screen placeholder
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});