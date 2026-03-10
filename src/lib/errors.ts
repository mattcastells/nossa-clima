const authMessageMap: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña inválidos.',
  'Email not confirmed': 'Tu email todavía no está confirmado.',
};

export const toUserErrorMessage = (error: unknown, fallback = 'Ocurrió un error. Intentá nuevamente.'): string => {
  if (error instanceof Error) {
    const mapped = authMessageMap[error.message];
    if (mapped) return mapped;

    if (error.message.toLowerCase().includes('jwt') || error.message.toLowerCase().includes('permission')) {
      return 'No tenés permisos para esta acción o tu sesión expiró.';
    }

    return error.message;
  }

  return fallback;
};
