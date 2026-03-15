import * as Application from 'expo-application';
import appConfig from '../../app.json';

export const getAppVersion = (): string => {
  return Application.nativeApplicationVersion ?? appConfig.expo?.version ?? '0.0.0';
};
