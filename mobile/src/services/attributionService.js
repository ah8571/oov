import { Platform } from 'react-native';
import appsFlyer from 'react-native-appsflyer';

const IOS_ATT_WAIT_SECONDS = 10;

const isMeaningfulValue = (value) => {
  if (value === null || value === undefined || typeof value === 'object') {
    return false;
  }

  const normalizedValue = String(value).trim();

  return Boolean(
    normalizedValue
    && normalizedValue.toLowerCase() !== 'null'
    && normalizedValue.toLowerCase() !== 'undefined'
    && normalizedValue !== '[object Object]'
  );
};

export const shouldInitializeAttribution = ({ appVariant = '', appsFlyerDevKey = '' } = {}) => {
  return isMeaningfulValue(appsFlyerDevKey)
    && String(appVariant).trim().toLowerCase() !== 'development';
};

export const initializeAttribution = async ({
  appVariant = '',
  appsFlyerDevKey = '',
  appsFlyerIosAppId = '',
  isDebug = false,
  onReady,
  onError
} = {}) => {
  if (!shouldInitializeAttribution({ appVariant, appsFlyerDevKey })) {
    return {
      success: false,
      skipped: true
    };
  }

  const initOptions = {
    devKey: appsFlyerDevKey,
    appId: isMeaningfulValue(appsFlyerIosAppId) ? appsFlyerIosAppId : undefined,
    isDebug,
    onInstallConversionDataListener: false,
    onDeepLinkListener: false
  };

  if (Platform.OS === 'ios') {
    appsFlyer.disableSKAD(false);
    initOptions.timeToWaitForATTUserAuthorization = IOS_ATT_WAIT_SECONDS;
  }

  return new Promise((resolve) => {
    appsFlyer.initSdk(
      initOptions,
      (result) => {
        if (typeof onReady === 'function') {
          Promise.resolve(onReady(result)).catch(() => {
            // Attribution follow-up is best-effort and should not fail SDK boot.
          });
        }

        resolve({
          success: true,
          result
        });
      },
      (error) => {
        if (typeof onError === 'function') {
          onError(error);
        }

        resolve({
          success: false,
          error
        });
      }
    );
  });
};