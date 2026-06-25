const { withSentry } = require('@sentry/react-native/expo');
const appJson = require('./app.json');

const baseConfig = appJson.expo;
const buildProfile = process.env.EAS_BUILD_PROFILE || process.env.APP_VARIANT || 'development';
const isProduction = buildProfile === 'production';
const isDevelopmentClient = buildProfile === 'development';

const productionBundleId = 'com.emmaline.app';
const developmentBundleId = 'com.emmaline.app.dev';

module.exports = () => {
  const sentryOrganization = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;
  const plugins = Array.isArray(baseConfig.plugins)
    ? baseConfig.plugins.filter((plugin) => plugin !== 'expo-dev-client')
    : [];

  if (isDevelopmentClient) {
    plugins.splice(1, 0, 'expo-dev-client');
  }

  const config = {
    ...baseConfig,
    plugins,
    ios: {
      ...(baseConfig.ios || {}),
      bundleIdentifier: isProduction ? productionBundleId : developmentBundleId
    },
    android: {
      ...(baseConfig.android || {}),
      package: isProduction ? productionBundleId : developmentBundleId
    },
    extra: {
      ...(baseConfig.extra || {}),
      appVariant: isProduction ? 'production' : buildProfile,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || null
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