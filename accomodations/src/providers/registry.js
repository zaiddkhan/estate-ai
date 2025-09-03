/**
 * @fileoverview Registry for accommodation data providers.
 * This file registers all available accommodation data providers with the provider factory.
 * New provider implementations should be registered here.
 */

import providerFactory from './ProviderFactory.js';
import { GooglePlacesProvider } from './implementations/GooglePlacesProvider.js';
// Import other provider implementations as they are created
// import { SomeOtherProvider } from './implementations/SomeOtherProvider.js';

/**
 * Register all available accommodation providers
 */
export const registerProviders = () => {
  // Register Google Places provider
  providerFactory.registerProvider('google-places', {
    name: 'Google Places API',
    description: 'Search for accommodations using Google Places API',
    implementationClass: GooglePlacesProvider,
    defaultConfig: {
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
      language: 'en',
      region: 'in', // India
      requestDelay: 200,
      maxRetries: 3
    },
    isDefault: true
  });

  // Example of registering another provider
  /*
  providerFactory.registerProvider('other-provider', {
    name: 'Other Provider',
    description: 'Alternative data source for accommodations',
    implementationClass: SomeOtherProvider,
    defaultConfig: {
      // Provider-specific configuration
    }
  });
  */

  console.log(`Registered ${providerFactory.getRegisteredProviders().length} accommodation providers`);
};

/**
 * Get the provider factory instance
 * @returns {Object} Provider factory
 */
export const getProviderFactory = () => providerFactory;

/**
 * Get a provider instance by ID
 * @param {string} [providerId] - Provider ID, defaults to the default provider
 * @param {Object} [config] - Optional configuration override
 * @returns {Promise<Object>} Provider instance
 */
export const getProvider = async (providerId, config = {}) => {
  return providerFactory.getProvider(providerId, config);
};

/**
 * Get the default provider instance
 * @param {Object} [config] - Optional configuration override
 * @returns {Promise<Object>} Default provider instance
 */
export const getDefaultProvider = async (config = {}) => {
  return providerFactory.getDefaultProvider(config);
};

// Register providers on module import
registerProviders();

export default {
  getProviderFactory,
  getProvider,
  getDefaultProvider,
  registerProviders
};
