const authMessageMap: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña inválidos.',
  'Email not confirmed': 'Tu email todavía no está confirmado.',
};

export const toUserErrorMessage = (error: unknown, fallback = 'Ocurrió un error. Intentá nuevamente.'): string => {
  if (error instanceof Error) {
    const mapped = authMessageMap[error.message];
    if (mapped) return mapped;

    const message = error.message.toLowerCase();

    if (
      message.includes('tiempo de espera agotado')
      || message.includes('timed out')
      || message.includes('network request failed')
      || message.includes('failed to fetch')
    ) {
      return 'No se pudo conectar con Supabase. Revisá internet, URL y ANON KEY.';
    }

    if (
      message.includes('jwt')
      || message.includes('permission')
      || message.includes('row-level security')
      || message.includes('rls')
    ) {
      return 'No tenés permisos para esta acción o tu sesión expiró.';
    }

    if (message.includes('foreign key') || message.includes('violates foreign key constraint')) {
      return 'No se puede borrar este servicio porque ya fue usado en presupuestos.';
    }

    return error.message;
  }

  return fallback;
};
