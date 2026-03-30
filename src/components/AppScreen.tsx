import { useRouter, useSegments, type Href } from 'expo-router';
import { PropsWithChildren, ReactNode } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon, Text } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { useAppTheme } from '@/theme';

interface Props extends PropsWithChildren {
  title?: string;
  titleRight?: ReactNode;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  scrollable?: boolean;
}

export const AppScreen = ({ title, titleRight, children, showBackButton = true, showHomeButton = true, scrollable = true }: Props) => {
  const router = useRouter();
  const segments = useSegments();
  const theme = useAppTheme();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const inTabs = segments[0] === '(tabs)';
  const inAuth = segments[0] === '(auth)';
  const topLevelTabSection = inTabs && segments.length === 2;
  const nestedInTabs = inTabs && segments.length > 2;
  const outsideTabsAndAuth = !inTabs && !inAuth && segments.length > 0;
  const isHomeScreen = inTabs && segments.length === 2 && segments[1] === 'index';
  const isAssistantScreen = inTabs && segments.length === 2 && segments[1] === 'assistant';
  const showBottomNav = width < 768 && !inAuth && (inTabs || outsideTabsAndAuth);
  const showBack = showBackButton && (nestedInTabs || outsideTabsAndAuth);
  const shouldShowHomeButton = showHomeButton && showBackButton && !inAuth && !isHomeScreen && topLevelTabSection;
  const fallback: Href = inTabs && segments[1] ? (`/(tabs)/${segments[1]}` as Href) : '/(tabs)';
  const innerContent = (
    <AnimatedEntrance active={isFocused} delay={20} distance={16} style={scrollable ? styles.container : [styles.container, styles.flexContainer]}>
      {!showBottomNav && (showBack || shouldShowHomeButton) ? (
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
      ) : null}
      {title ? (
        <View style={styles.titleRow}>
          <Text variant="headlineSmall" style={[styles.title, titleRight ? styles.titleFlex : undefined]}>
            {title}
          </Text>
          {titleRight ? <View style={styles.titleRightContainer}>{titleRight}</View> : null}
        </View>
      ) : null}
      <View style={[styles.content, !scrollable && styles.flexContent]}>{children}</View>
    </AnimatedEntrance>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.screenShell}>
        {scrollable ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              showBottomNav && styles.scrollContentWithBottomNav,
              { backgroundColor: theme.colors.background },
            ]}
          >
            {innerContent}
          </ScrollView>
        ) : (
          <View style={[styles.fixedWrapper, { backgroundColor: theme.colors.background }]}>{innerContent}</View>
        )}

        {showBottomNav ? (
          <View style={[styles.bottomNav, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.borderSoft }]}>
            <NavButton
              icon="arrow-left"
              label="Atras"
              active={false}
              onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
            />
            <NavButton
              icon="home-outline"
              label="Inicio"
              active={isHomeScreen}
              onPress={() => router.replace('/(tabs)')}
            />
            <NavButton
              icon="robot-outline"
              label="Asistente"
              active={isAssistantScreen}
              onPress={() => router.replace('/(tabs)/assistant')}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const NavButton = ({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) => {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bottomNavButton,
        active && { backgroundColor: theme.colors.softBlue },
        pressed && styles.bottomNavButtonPressed,
      ]}
    >
      <Icon source={icon} size={20} color={active ? theme.colors.primary : theme.colors.onSurface} />
      <Text style={[styles.bottomNavLabel, { color: active ? theme.colors.primary : theme.colors.onSurface }]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screenShell: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 12 },
  scrollContentWithBottomNav: { paddingBottom: 96 },
  fixedWrapper: { flex: 1 },
  container: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  flexContainer: { flex: 1, paddingBottom: 24 },
  navRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, minHeight: 34 },
  backButton: { alignSelf: 'flex-start', marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18 },
  titleFlex: { flex: 1 },
  titleRightContainer: { marginLeft: 8, paddingBottom: 2 },
  title: { marginBottom: 0 },
  content: { gap: 16 },
  flexContent: { flex: 1, minHeight: 0 },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  bottomNavButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bottomNavButtonPressed: {
    opacity: 0.82,
  },
  bottomNavLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
