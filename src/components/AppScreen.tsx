import { useRouter, useSegments, type Href } from 'expo-router';
import { PropsWithChildren } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, useTheme } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';

interface Props extends PropsWithChildren {
  title?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  scrollable?: boolean;
}

export const AppScreen = ({ title, children, showBackButton = true, showHomeButton = true, scrollable = true }: Props) => {
  const router = useRouter();
  const segments = useSegments();
  const theme = useTheme();
  const isFocused = useIsFocused();
  const inTabs = segments[0] === '(tabs)';
  const inAuth = segments[0] === '(auth)';
  const topLevelTabSection = inTabs && segments.length === 2;
  const nestedInTabs = inTabs && segments.length > 2;
  const outsideTabsAndAuth = !inTabs && !inAuth && segments.length > 0;
  const isHomeScreen = inTabs && segments.length === 2 && segments[1] === 'index';
  const showBack = showBackButton && (nestedInTabs || outsideTabsAndAuth);
  const shouldShowHomeButton = showHomeButton && showBackButton && !inAuth && !isHomeScreen && topLevelTabSection;
  const fallback: Href = inTabs && segments[1] ? (`/(tabs)/${segments[1]}` as Href) : '/(tabs)';
  const innerContent = (
    <AnimatedEntrance active={isFocused} delay={20} distance={16} style={scrollable ? styles.container : [styles.container, styles.flexContainer]}>
      <View style={styles.navRow}>
        {showBack && (
          <Button
            mode="text"
            compact
            icon="arrow-left"
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
          >
            Volver
          </Button>
        )}
        {shouldShowHomeButton && (
          <Button
            mode="text"
            compact
            icon="home-outline"
            style={styles.backButton}
            onPress={() => router.replace('/(tabs)')}
          >
            Volver al Inicio
          </Button>
        )}
      </View>
      {title ? (
        <Text variant="headlineSmall" style={styles.title}>
          {title}
        </Text>
      ) : null}
      <View style={[styles.content, !scrollable && styles.flexContent]}>{children}</View>
    </AnimatedEntrance>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {scrollable ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.background }]}>
          {innerContent}
        </ScrollView>
      ) : (
        <View style={[styles.fixedWrapper, { backgroundColor: theme.colors.background }]}>{innerContent}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  fixedWrapper: { flex: 1 },
  container: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 96 },
  flexContainer: { flex: 1, paddingBottom: 24 },
  navRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, minHeight: 34 },
  backButton: { alignSelf: 'flex-start', marginBottom: 4 },
  title: { marginBottom: 18 },
  content: { gap: 16 },
  flexContent: { flex: 1, minHeight: 0 },
});
