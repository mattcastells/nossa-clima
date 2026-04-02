import { useState } from 'react';
import { ScrollView, View, Platform } from 'react-native';
import { Button, Card, Paragraph, Title } from 'react-native-paper';
import * as Notifications from 'expo-notifications';

import {
  requestNotificationPermissions,
  cancelAllAppointmentReminders,
} from '@/services/notifications';
import { registerPushToken, listMyPushTokens } from '@/services/pushTokens';

/**
 * Small debug screen to inspect notification permissions, scheduled local
 * notifications and to fetch device/expo push tokens for quick testing.
 *
 * NOTE: Sending pushes from the device is only intended for ad-hoc tests.
 * In production you should send pushes from a trusted server (FCM / Expo Push
 * service) and not ship server credentials in the app.
 */
export default function NotificationsDebugScreen() {
  const [permissionInfo, setPermissionInfo] = useState<Notifications.NotificationPermissionsStatus | null>(null);
  const [scheduled, setScheduled] = useState<Notifications.NotificationRequest[] | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [devicePushToken, setDevicePushToken] = useState<string | null>(null);
  const [lastSendResult, setLastSendResult] = useState<string | null>(null);
  const [registeredTokens, setRegisteredTokens] = useState<Array<Record<string, unknown>> | null>(null);

  const loadPermissions = async () => {
    try {
      const perms = await Notifications.getPermissionsAsync();
      setPermissionInfo(perms);
    } catch (e) {
      setPermissionInfo(null);
    }
  };

  const loadScheduled = async () => {
    try {
      const list = await Notifications.getAllScheduledNotificationsAsync();
      setScheduled(list as Notifications.NotificationRequest[]);
    } catch (e) {
      setScheduled(null);
    }
  };

  const onRequestPermissions = async () => {
    const granted = await requestNotificationPermissions();
    await loadPermissions();
    return granted;
  };

  const onGetTokens = async () => {
    try {
      // expo push token (may throw if projectId is missing in some setups)
      // we call both helpers to show available values.
      const expo = await Notifications.getExpoPushTokenAsync().catch(() => null);
      const device = await Notifications.getDevicePushTokenAsync().catch(() => null);

      // expo can be an object like { data: 'ExponentPushToken[...]' } or a string
      if (expo && typeof expo === 'object' && 'data' in expo) {
        const maybe = expo as { data?: unknown };
        setExpoPushToken(maybe.data ? String(maybe.data) : null);
      } else if (expo) {
        setExpoPushToken(String(expo));
      } else {
        setExpoPushToken(null);
      }

      setDevicePushToken(device ? JSON.stringify(device) : null);
    } catch (e) {
      setExpoPushToken(null);
      setDevicePushToken(null);
    }
  };

  const onRegisterToken = async () => {
    try {
      await registerPushToken({ expo_token: expoPushToken ?? null, device_token: devicePushToken ? JSON.parse(devicePushToken) : null, platform: Platform.OS });
      setLastSendResult('Token registrado (o actualizado) en backend.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastSendResult(`Fallo al registrar token: ${msg}`);
    }
  };

  const onLoadRegistered = async () => {
    try {
      const list = await listMyPushTokens();
  setRegisteredTokens(list as Array<Record<string, unknown>>);
    } catch (e) {
      setRegisteredTokens(null);
    }
  };

  // copy-to-clipboard omitted to avoid adding a native dependency here.

  const onSendTestExpoPush = async () => {
    if (!expoPushToken) {
      setLastSendResult('No expo push token available. Run "Get tokens" first.');
      return;
    }

    try {
      const body = {
        to: expoPushToken,
        title: 'Test desde dispositivo',
        body: 'Este es un push de prueba enviado desde la app.',
        priority: 'high',
        data: { test: true },
      };

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      setLastSendResult(JSON.stringify(json));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastSendResult(msg);
    }
  };

  const onCancelAll = async () => {
    await cancelAllAppointmentReminders();
    await loadScheduled();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <Card style={{ marginBottom: 12 }}>
        <Card.Content>
          <Title>Permisos</Title>
          <Paragraph>Consulta y control de permisos de notificaciones.</Paragraph>
          <View style={{ marginTop: 8 }}>
            <Button mode="contained" onPress={loadPermissions} style={{ marginBottom: 8 }}>
              Cargar estado de permisos
            </Button>
            <Button mode="outlined" onPress={onRequestPermissions} style={{ marginBottom: 8 }}>
              Solicitar permisos
            </Button>
            {permissionInfo && (
              <Card style={{ marginTop: 8 }}>
                <Card.Content>
                  <Paragraph selectable>{JSON.stringify(permissionInfo, null, 2)}</Paragraph>
                </Card.Content>
              </Card>
            )}
          </View>
        </Card.Content>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Card.Content>
          <Title>Notificaciones programadas</Title>
          <Paragraph>Lista de notificaciones locales que tiene el dispositivo.</Paragraph>
          <View style={{ marginTop: 8 }}>
            <Button mode="contained" onPress={loadScheduled} style={{ marginBottom: 8 }}>
              Cargar programadas
            </Button>
            <Button mode="outlined" onPress={onCancelAll} style={{ marginBottom: 8 }}>
              Cancelar recordatorios de turnos
            </Button>
            {scheduled && scheduled.length === 0 && <Paragraph>No hay notificaciones programadas</Paragraph>}
            {scheduled && scheduled.length > 0 && (
              scheduled.map((s) => (
                <Card key={s.identifier} style={{ marginTop: 8 }}>
                  <Card.Content>
                    <Paragraph>id: {s.identifier}</Paragraph>
                    <Paragraph>title: {s.content?.title ?? '-'}</Paragraph>
                    <Paragraph>body: {s.content?.body ?? '-'}</Paragraph>
                    <Paragraph selectable>trigger: {JSON.stringify(s.trigger)}</Paragraph>
                  </Card.Content>
                </Card>
              ))
            )}
          </View>
        </Card.Content>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Card.Content>
          <Title>Tokens de push</Title>
          <Paragraph>Obtén tokens nativos / Expo para registrar en un backend o para pruebas.</Paragraph>
          <View style={{ marginTop: 8 }}>
            <Button mode="contained" onPress={onGetTokens} style={{ marginBottom: 8 }}>
              Get tokens
            </Button>
            {expoPushToken && (
              <View style={{ marginBottom: 8 }}>
                <Paragraph>Expo token:</Paragraph>
                <Paragraph selectable>{expoPushToken}</Paragraph>
                <Button mode="outlined" onPress={onRegisterToken} style={{ marginTop: 8 }}>
                  Registrar token en backend
                </Button>
              </View>
            )}
            {devicePushToken && (
              <View style={{ marginBottom: 8 }}>
                <Paragraph>Device token (raw):</Paragraph>
                <Paragraph selectable>{devicePushToken}</Paragraph>
              </View>
            )}

            <Button mode="contained" onPress={onSendTestExpoPush} style={{ marginTop: 8 }}>
              Enviar push de prueba (Expo push service)
            </Button>
            <Button mode="outlined" onPress={onLoadRegistered} style={{ marginTop: 8 }}>
              Cargar tokens registrados
            </Button>
            {registeredTokens && (
              <Card style={{ marginTop: 8 }}>
                <Card.Content>
                  <Paragraph selectable>{JSON.stringify(registeredTokens, null, 2)}</Paragraph>
                </Card.Content>
              </Card>
            )}
            {lastSendResult && (
              <Card style={{ marginTop: 8 }}>
                <Card.Content>
                  <Paragraph>Resultado:</Paragraph>
                  <Paragraph selectable>{lastSendResult}</Paragraph>
                </Card.Content>
              </Card>
            )}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
