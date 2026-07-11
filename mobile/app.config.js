const { withSentry } = require('@sentry/react-native/expo');
const appJson = require('./app.json');

const baseConfig = appJson.expo;
const buildProfile = process.env.EAS_BUILD_PROFILE || process.env.APP_VARIANT || 'development';
const appVariant = process.env.APP_VARIANT || buildProfile;
const isProduction = appVariant === 'production';
const isDevelopmentClient = appVariant === 'development';
const liveCallsEnabled = String(process.env.EXPO_PUBLIC_ENABLE_LIVE_CALLS || 'false').trim().toLowerCase() === 'true';

const productionBundleId = 'com.emmaline.app';
const developmentBundleId = 'com.emmaline.app.dev';

function normalizeOptionalConfigValue(value) {
  if (value === null || value === undefined || typeof value === 'object') {
    return '';
  }

  const normalizedValue = String(value).trim();

  if (!normalizedValue || normalizedValue.toLowerCase() === 'null' || normalizedValue.toLowerCase() === 'undefined' || normalizedValue === '[object Object]') {
    return '';
  }

  return normalizedValue;
}

function parseDelimitedConfigValues(value) {
  return normalizeOptionalConfigValue(value)
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildSkAdNetworkItems(existingItems = [], networkIds = []) {
  const seen = new Set();
  const items = [];

  const addItem = (networkId) => {
    const normalizedId = normalizeOptionalConfigValue(networkId);
    const dedupeKey = normalizedId.toLowerCase();

    if (!normalizedId || seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    items.push({
      SKAdNetworkIdentifier: normalizedId
    });
  };

  existingItems.forEach((item) => {
    if (typeof item === 'string') {
      addItem(item);
      return;
    }

    addItem(item && item.SKAdNetworkIdentifier);
  });

  networkIds.forEach(addItem);

  return items;
}

function getAppDisplayName(baseName, variant) {
  if (variant === 'production') {
    return baseName;
  }

  if (variant === 'preview') {
    return `${baseName} Preview`;
  }

  return `${baseName} Dev`;
}

module.exports = () => {
  const sentryOrganization = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;
  const iosInfoPlist = (baseConfig.ios && baseConfig.ios.infoPlist) || {};
  const skAdNetworkItems = buildSkAdNetworkItems(
    Array.isArray(iosInfoPlist.SKAdNetworkItems) ? iosInfoPlist.SKAdNetworkItems : [],
    parseDelimitedConfigValues(process.env.EXPO_PUBLIC_IOS_SKADNETWORK_IDS || process.env.IOS_SKADNETWORK_IDS)
  );
  const plugins = Array.isArray(baseConfig.plugins)
    ? baseConfig.plugins.filter((plugin) => plugin !== 'expo-dev-client')
    : [];

  const filteredPlugins = plugins.filter((plugin) => {
    if (plugin === './plugins/withTwilioVoiceApplicationProxy') {
      return liveCallsEnabled;
    }

    if (Array.isArray(plugin) && plugin[0] === './plugins/withTwilioVoiceApplicationProxy') {
      return liveCallsEnabled;
    }

    return true;
  });

  if (isDevelopmentClient) {
    filteredPlugins.splice(1, 0, 'expo-dev-client');
  }

  if (!filteredPlugins.includes('expo-web-browser')) {
    filteredPlugins.push('expo-web-browser');
  }

  if (!filteredPlugins.includes('expo-apple-authentication')) {
    filteredPlugins.push('expo-apple-authentication');
  }

  const hasAppsFlyerPlugin = filteredPlugins.some((plugin) => {
    if (Array.isArray(plugin)) {
      return plugin[0] === 'react-native-appsflyer';
    }

    return plugin === 'react-native-appsflyer';
  });

  if (!hasAppsFlyerPlugin) {
    filteredPlugins.push([
      'react-native-appsflyer',
      {
        preferAppsFlyerBackupRules: false
      }
    ]);
  }

  const config = {
    ...baseConfig,
    name: getAppDisplayName(baseConfig.name || 'Emmaline', appVariant),
    scheme: baseConfig.scheme || 'emmaline',
    plugins: filteredPlugins,
    ios: {
      ...(baseConfig.ios || {}),
      infoPlist: {
        ...iosInfoPlist,
        ...(skAdNetworkItems.length > 0
          ? {
            SKAdNetworkItems: skAdNetworkItems
          }
          : {})
      },
      bundleIdentifier: isProduction ? productionBundleId : developmentBundleId
    },
    android: {
      ...(baseConfig.android || {}),
      blockedPermissions: [
        ...new Set([
          ...((baseConfig.android && Array.isArray(baseConfig.android.blockedPermissions))
            ? baseConfig.android.blockedPermissions
            : []),
          'android.permission.USE_FULL_SCREEN_INTENT',
          'android.permission.FOREGROUND_SERVICE_MICROPHONE'
        ])
      ],
      package: isProduction ? productionBundleId : developmentBundleId
    },
    extra: {
      ...(baseConfig.extra || {}),
      appVariant,
      enableLiveCalls: liveCallsEnabled,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || null,
      appsflyerDevKey: process.env.APPSFLYER_DEV_KEY || null,
      appsflyerIosAppId: process.env.APPSFLYER_IOS_APP_ID || '6783906612'
    }
  };

  if (!sentryOrganization || !sentryProject) {
    return config;
  }

  return withSentry(config, {
    url: process.env.SENTRY_URL || 'https://sentry.io/',
    organization: sentryOrganization,
    project: sentryProject
  });
};