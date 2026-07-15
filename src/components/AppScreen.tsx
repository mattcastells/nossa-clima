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

type TabDef = { key: string; icon: string; label: string; href: Href };

const TABS: TabDef[] = [
  { key: 'index', icon: 'home-variant-outline', label: 'Inicio', href: '/(tabs)' },
  { key: 'quotes', icon: 'briefcase-outline', label: 'Trabajos', href: '/(tabs)/quotes' },
  { key: 'calendar', icon: 'calendar-month-outline', label: 'Agenda', href: '/(tabs)/calendar' },
  { key: 'items', icon: 'cube-outline', label: 'Materiales', href: '/(tabs)/items' },
  { key: 'assistant', icon: 'robot-outline', label: 'Asistente', href: '/(tabs)/assistant' },
];

export const AppScreen = ({ title, titleRight, children, showBackButton = true, scrollable = true }: Props) => {
  const router = useRouter();
  const segments = useSegments();
  const theme = useAppTheme();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const inTabs = segments[0] === '(tabs)';
  const inAuth = segments[0] === '(auth)';
  const nestedInTabs = inTabs && segments.length > 2;
  const outsideTabsAndAuth = !inTabs && !inAuth && segments.length > 0;
  const activeSection = inTabs ? (segments[1] ?? 'index') : null;
  const showTabBar = width < 768 && !inAuth && (inTabs || outsideTabsAndAuth);
  const showBack = showBackButton && (nestedInTabs || outsideTabsAndAuth);
  const fallback: Href = inTabs && segments[1] ? (`/(tabs)/${segments[1]}` as Href) : '/(tabs)';

  const innerContent = (
    <AnimatedEntrance active={isFocused} delay={20} distance={16} style={scrollable ? styles.container : [styles.container, styles.flexContainer]}>
      {showBack ? (
        <View style={styles.navRow}>
          <Button
            mode="text"
            compact
            icon="arrow-left"
            textColor={theme.colors.primary}
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
          >
            Volver
          </Button>
        </View>
      ) : null}
      {title ? (
        <View style={styles.titleRow}>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.titleOnSoft }, titleRight ? styles.titleFlex : undefined]}>
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
              showTabBar && styles.scrollContentWithBottomNav,
              { backgroundColor: theme.colors.background },
            ]}
          >
            {innerContent}
          </ScrollView>
        ) : (
          <View style={[styles.fixedWrapper, { backgroundColor: theme.colors.background }]}>{innerContent}</View>
        )}

        {showTabBar ? (
          <View style={[styles.bottomNav, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.borderSoft }]}>
            {TABS.map((tab) => (
              <NavButton
                key={tab.key}
                icon={tab.icon}
                label={tab.label}
                active={activeSection === tab.key}
                onPress={() => router.replace(tab.href)}
              />
            ))}
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
      style={({ pressed }) => [styles.bottomNavButton, pressed && styles.bottomNavButtonPressed]}
    >
      <View style={[styles.bottomNavIcon, active && { backgroundColor: theme.colors.accentSoft }]}>
        <Icon source={icon} size={22} color={active ? theme.colors.accentStrong : theme.colors.textMuted} />
      </View>
      <Text style={[styles.bottomNavLabel, { color: active ? theme.colors.accentStrong : theme.colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screenShell: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 12 },
  scrollContentWithBottomNav: { paddingBottom: 96 },
  fixedWrapper: { flex: 1 },
  container: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  flexContainer: { flex: 1, paddingBottom: 24 },
  navRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, minHeight: 34 },
  backButton: { alignSelf: 'flex-start', marginLeft: -6, marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18 },
  titleFlex: { flex: 1 },
  titleRightContainer: { marginLeft: 8, paddingBottom: 2 },
  title: { marginBottom: 0, fontWeight: '800' },
  content: { gap: 16 },
  flexContent: { flex: 1, minHeight: 0 },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  bottomNavButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bottomNavButtonPressed: {
    opacity: 0.7,
  },
  bottomNavIcon: {
    width: 46,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
});
