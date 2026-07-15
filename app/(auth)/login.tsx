import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, TextInput } from 'react-native-paper';

import { useToastMessageEffect } from '@/components/AppToastProvider';
import { LoginFormValues, loginSchema } from '@/features/auth/schemas';
import { signIn } from '@/features/auth/service';
import { useAuthStore } from '@/features/auth/store';
import { toUserErrorMessage } from '@/lib/errors';
import { BRAND_BLUE, FONT_SANS_EXTRABOLD, useAppTheme } from '@/theme';

export default function LoginScreen() {
  const [authError, setAuthError] = useState<string | null>(null);
  const theme = useAppTheme();
  useToastMessageEffect(authError, () => setAuthError(null), 'error');
  const pendingPath = useAuthStore((s) => s.pendingPath);
  const clearPendingPath = useAuthStore((s) => s.clearPendingPath);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  return (
    <View style={[styles.root, { backgroundColor: BRAND_BLUE }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.brand}>
          <Image source={require('../../assets/nc-logo-dark.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleLarge" style={[styles.cardTitle, { color: theme.colors.titleOnSoft }]}>
            Ingresá
          </Text>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <TextInput
                mode="outlined"
                label="Email"
                left={<TextInput.Icon icon="email-outline" />}
                value={value}
                onChangeText={onChange}
                keyboardType="email-address"
                autoCapitalize="none"
                error={Boolean(errors.email)}
                outlineStyle={styles.inputOutline}
                activeOutlineColor={theme.colors.accent}
                outlineColor={theme.colors.outline}
                style={styles.input}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <TextInput
                mode="outlined"
                label="Contraseña"
                left={<TextInput.Icon icon="lock-outline" />}
                secureTextEntry
                value={value}
                onChangeText={onChange}
                error={Boolean(errors.password)}
                outlineStyle={styles.inputOutline}
                activeOutlineColor={theme.colors.accent}
                outlineColor={theme.colors.outline}
                style={styles.input}
              />
            )}
          />
          {(errors.email || errors.password) && (
            <Text style={[styles.error, { color: theme.colors.error }]}>{errors.email?.message ?? errors.password?.message}</Text>
          )}

          <Button
            mode="contained"
            buttonColor={theme.colors.accent}
            textColor={theme.colors.onAccent}
            style={styles.submit}
            contentStyle={styles.submitContent}
            loading={isSubmitting}
            disabled={isSubmitting}
            onPress={handleSubmit(async (values) => {
              try {
                await signIn(values.email, values.password);
                const destination = pendingPath ?? '/(tabs)';
                clearPendingPath();
                router.replace(destination as never);
              } catch (error) {
                setAuthError(toUserErrorMessage(error, 'No se pudo iniciar sesión.'));
              }
            })}
          >
            Ingresar
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, justifyContent: 'space-between' },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logo: { width: '78%', maxWidth: 300, height: 90 },
  card: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  cardTitle: { fontFamily: FONT_SANS_EXTRABOLD, marginBottom: 2 },
  // El diseño usa inputs blancos sobre la tarjeta; paper los tiñe de gris por defecto.
  input: { backgroundColor: 'transparent' },
  inputOutline: { borderRadius: 12 },
  submit: { borderRadius: 12, marginTop: 4 },
  submitContent: { minHeight: 48 },
  error: { fontSize: 13 },
});
