const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const logDevWarning = (...args: unknown[]): void => {
  if (!isDevelopment) return;
  console.warn(...args);
};
