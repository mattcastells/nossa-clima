import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

interface Props extends PropsWithChildren {
  title: string;
}

export const AppScreen = ({ title, children }: Props) => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text variant="headlineSmall" style={styles.title}>
      {title}
    </Text>
    <View style={styles.content}>{children}</View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 36 },
  title: { marginBottom: 12 },
  content: { gap: 12 },
});
