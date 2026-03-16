import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

interface ToastPayload {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

interface AppToastContextValue {
  showToast: (message: string, tone?: ToastPayload['tone']) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const TOAST_DURATION_MS = 1800;
const CAN_USE_NATIVE_DRIVER = Platform.OS !== 'web';

const AppToastContext = createContext<AppToastContextValue | null>(null);

export const AppToastProvider = ({ children }: PropsWithChildren) => {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const translateY = useRef(new Animated.Value(-64)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const clearHideTimeout = useCallback(() => {
    if (!hideTimeoutRef.current) return;
    clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = null;
  }, []);

  const hideToast = useCallback(
    (id?: number) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: CAN_USE_NATIVE_DRIVER,
        }),
        Animated.timing(translateY, {
          toValue: -64,
          duration: 180,
          useNativeDriver: CAN_USE_NATIVE_DRIVER,
        }),
      ]).start(() => {
        setToast((current) => {
          if (!current) return current;
          if (id != null && current.id !== id) return current;
          return null;
        });
      });
    },
    [opacity, translateY],
  );

  const showToast = useCallback(
    (message: string, tone: ToastPayload['tone'] = 'success') => {
      clearHideTimeout();

      const nextToast = {
        id: Date.now(),
        message,
        tone,
      };

      setToast(nextToast);
      translateY.setValue(-64);
      opacity.setValue(0);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: CAN_USE_NATIVE_DRIVER,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 210,
          mass: 0.8,
          useNativeDriver: CAN_USE_NATIVE_DRIVER,
        }),
      ]).start();

      hideTimeoutRef.current = setTimeout(() => {
        hideToast(nextToast.id);
      }, TOAST_DURATION_MS);
    },
    [clearHideTimeout, hideToast, opacity, translateY],
  );

  useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

  const value = useMemo<AppToastContextValue>(
    () => ({
      showToast,
      success: (message) => showToast(message, 'success'),
      error: (message) => showToast(message, 'error'),
    }),
    [showToast],
  );

  const toneStyle =
    toast?.tone === 'error'
      ? {
          backgroundColor: theme.colors.toastErrorSurface,
          borderColor: theme.colors.error,
        }
      : {
          backgroundColor: theme.colors.toastSuccessSurface,
          borderColor: theme.colors.primary,
        };
  const toneTextStyle = toast?.tone === 'error' ? { color: theme.colors.toastErrorText } : { color: theme.colors.toastSuccessText };

  return (
    <AppToastContext.Provider value={value}>
      {children}
      <View style={[StyleSheet.absoluteFill, styles.pointerBoxNone]}>
        {toast ? (
          <Animated.View
            style={[
              styles.toastShell,
              styles.pointerNone,
              {
                top: insets.top + 10,
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={[styles.toast, toneStyle]}>
              <Text variant="bodyMedium" style={[styles.toastText, toneTextStyle]}>
                {toast.message}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </AppToastContext.Provider>
  );
};

export const useAppToast = (): AppToastContextValue => {
  const context = useContext(AppToastContext);
  if (!context) {
    throw new Error('useAppToast must be used inside AppToastProvider.');
  }
  return context;
};

const resolveToastTone = (message: string): ToastPayload['tone'] => {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return 'success';

  const errorPrefixes = ['no ', 'escribi', 'ingresa', 'selecciona', 'completa', 'si ', 'probalo'];
  const errorFragments = ['no se pudo', 'cancelada', 'obligatorio', 'invalida', 'invalido', 'error'];

  if (errorPrefixes.some((prefix) => normalized.startsWith(prefix)) || errorFragments.some((fragment) => normalized.includes(fragment))) {
    return 'error';
  }

  return 'success';
};

export const useToastMessageEffect = (
  message: string | null,
  clearMessage: () => void,
  tone?: ToastPayload['tone'],
) => {
  const toast = useAppToast();

  useEffect(() => {
    if (!message) return;
    toast.showToast(message, tone ?? resolveToastTone(message));
    clearMessage();
  }, [clearMessage, message, toast, tone]);
};

const styles = StyleSheet.create({
  toastShell: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 5,
    ...Platform.select({
      web: {
        boxShadow: '0px 6px 12px rgba(15, 23, 42, 0.12)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: {
          width: 0,
          height: 6,
        },
      },
    }),
  },
  toastText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  pointerBoxNone: {
    pointerEvents: 'box-none',
  },
  pointerNone: {
    pointerEvents: 'none',
  },
});
