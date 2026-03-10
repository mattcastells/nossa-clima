import { useRouter, useSegments, type Href } from 'expo-router';
import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from 'react-native-paper';

interface Props extends PropsWithChildren {
  title: string;
  showBackButton?: boolean;
}

export const AppScreen = ({ title, children, showBackButton = true }: Props) => {
  const router = useRouter();
  const segments = useSegments();
  const inTabs = segments[0] === '(tabs)';
  const inAuth = segments[0] === '(auth)';
  const nestedInTabs = inTabs && segments.length > 2;
  const outsideTabsAndAuth = !inTabs && !inAuth && segments.length > 0;
  const showBack = showBackButton && (nestedInTabs || outsideTabsAndAuth);
  const fallback: Href = inTabs && segments[1] ? (`/(tabs)/${segments[1]}` as Href) : '/(tabs)';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
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
          <Text variant="headlineSmall" style={styles.title}>
            {title}
          </Text>
          <View style={styles.content}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  container: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 96 },
  backButton: { alignSelf: 'flex-start', marginBottom: 4 },
  title: { marginBottom: 18 },
  content: { gap: 16 },
});
