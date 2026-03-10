import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, Snackbar, Text, TextInput } from 'react-native-paper';

import { LoginFormValues, loginSchema } from '@/features/auth/schemas';
import { signIn } from '@/features/auth/service';
import { toUserErrorMessage } from '@/lib/errors';

export default function LoginScreen() {
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Precios Técnicos</Text>
      <Text variant="bodyMedium">Ingresá con tu usuario existente</Text>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            mode="outlined"
            label="Email"
            value={value}
            onChangeText={onChange}
            keyboardType="email-address"
            autoCapitalize="none"
            error={Boolean(errors.email)}
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
            secureTextEntry
            value={value}
            onChangeText={onChange}
            error={Boolean(errors.password)}
          />
        )}
      />
      {(errors.email || errors.password) && (
        <Text style={styles.error}>{errors.email?.message ?? errors.password?.message}</Text>
      )}
      <Button
        mode="contained"
        loading={isSubmitting}
        disabled={isSubmitting}
        onPress={handleSubmit(async (values) => {
          try {
            await signIn(values.email, values.password);
            router.replace('/(tabs)');
          } catch (error) {
            setAuthError(toUserErrorMessage(error, 'No se pudo iniciar sesión.'));
          }
        })}
      >
        Ingresar
      </Button>

      <Snackbar visible={Boolean(authError)} onDismiss={() => setAuthError(null)} duration={3000}>
        {authError}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16, gap: 12 },
  error: { color: '#B00020' },
});
