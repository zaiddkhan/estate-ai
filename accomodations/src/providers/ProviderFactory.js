/**
 * @fileoverview Factory for creating and managing accommodation data providers.
 * This factory allows the application to dynamically select and instantiate
 * appropriate data providers without coupling to specific implementations.
 */

/**
 * Factory for accommodation data providers
 */
class ProviderFactory {
  /**
   * Constructor
   */
  constructor() {
    /**
     * Registry of available provider implementations
     * @private
     */
    this._providerRegistry = new Map();

    /**
     * Cache of instantiated providers
     * @private
     */
    this._providerInstances = new Map();

    /**
     * Default provider ID
     * @private
     */
    this._defaultProviderId = null;
  }

  /**
   * Register a provider implementation
   * @param {string} providerId - Unique identifier for the provider
   * @param {Object} providerInfo - Information about the provider
   * @param {string} providerInfo.name - Human-readable name
   * @param {string} providerInfo.description - Description of the provider
   * @param {Function} providerInfo.implementationClass - Constructor for the provider implementation
   * @param {Object} [providerInfo.defaultConfig] - Default configuration
   * @returns {ProviderFactory} - Returns this factory for method chaining
   */
  registerProvider(providerId, providerInfo) {
    if (this._providerRegistry.has(providerId)) {
      console.warn(`Provider with ID '${providerId}' already registered. Overwriting.`);
    }

    this._providerRegistry.set(providerId, {
      id: providerId,
      name: providerInfo.name,
      description: providerInfo.description,
      implementationClass: providerInfo.implementationClass,
      defaultConfig: providerInfo.defaultConfig || {}
    });

    // If this is the first provider or explicitly marked as default, set as default
    if (!this._defaultProviderId || providerInfo.isDefault) {
      this._defaultProviderId = providerId;
    }

    return this;
  }

  /**
   * Set the default provider
   * @param {string} providerId - ID of the provider to set as default
   * @returns {ProviderFactory} - Returns this factory for method chaining
   * @throws {Error} If the provider is not registered
   */
  setDefaultProvider(providerId) {
    if (!this._providerRegistry.has(providerId)) {
      throw new Error(`Provider with ID '${providerId}' is not registered`);
    }

    this._defaultProviderId = providerId;
    return this;
  }

  /**
   * Get a provider instance
   * @param {string} [providerId] - ID of the provider to get. If not provided, the default provider is used.
   * @param {Object} [config] - Configuration for the provider. If not provided, default config is used.
   * @returns {Promise<Object>} - Provider instance
   * @throws {Error} If the provider is not registered or cannot be instantiated
   */
  async getProvider(providerId, config = {}) {
    // Use default provider if no ID provided
    const id = providerId || this._defaultProviderId;

    if (!id) {
      throw new Error('No provider ID specified and no default provider set');
    }

    if (!this._providerRegistry.has(id)) {
      throw new Error(`Provider with ID '${id}' is not registered`);
    }

    // Check if we already have an instance for this provider and config
    const cacheKey = `${id}:${JSON.stringify(config)}`;

    if (this._providerInstances.has(cacheKey)) {
      return this._providerInstances.get(cacheKey);
    }

    // Create a new instance
    const providerInfo = this._providerRegistry.get(id);
    const ProviderClass = providerInfo.implementationClass;

    try {
      // Merge default config with provided config
      const mergedConfig = {
        ...providerInfo.defaultConfig,
        ...config
      };

      // Instantiate the provider
      const provider = new ProviderClass();

      // Initialize the provider with the merged config
      await provider.initialize(mergedConfig);

      // Cache the instance
      this._providerInstances.set(cacheKey, provider);

      return provider;
    } catch (error) {
      throw new Error(`Failed to instantiate provider '${id}': ${error.message}`);
    }
  }

  /**
   * Get the default provider instance
   * @param {Object} [config] - Configuration for the provider
   * @returns {Promise<Object>} - Default provider instance
   */
  async getDefaultProvider(config = {}) {
    return this.getProvider(this._defaultProviderId, config);
  }

  /**
   * Get information about all registered providers
   * @returns {Array<Object>} - Array of provider information objects
   */
  getRegisteredProviders() {
    return Array.from(this._providerRegistry.values()).map(info => ({
      id: info.id,
      name: info.name,
      description: info.description,
      isDefault: info.id === this._defaultProviderId
    }));
  }

  /**
   * Check if a provider is registered
   * @param {string} providerId - ID of the provider to check
   * @returns {boolean} - True if the provider is registered
   */
  hasProvider(providerId) {
    return this._providerRegistry.has(providerId);
  }

  /**
   * Remove a provider from the registry and destroy any instances
   * @param {string} providerId - ID of the provider to unregister
   * @returns {boolean} - True if the provider was unregistered
   */
  unregisterProvider(providerId) {
    if (!this._providerRegistry.has(providerId)) {
      return false;
    }

    // Remove from registry
    this._providerRegistry.delete(providerId);

    // Remove any instances
    for (const [key, provider] of this._providerInstances.entries()) {
      if (key.startsWith(`${providerId}:`)) {
        // Call shutdown if available
        if (typeof provider.shutdown === 'function') {
          try {
            provider.shutdown().catch(err => {
              console.error(`Error shutting down provider '${providerId}':`, err);
            });
          } catch (error) {
            console.error(`Error shutting down provider '${providerId}':`, error);
          }
        }
        this._providerInstances.delete(key);
      }
    }

    // If this was the default provider, reset the default
    if (this._defaultProviderId === providerId) {
      this._defaultProviderId = this._providerRegistry.size > 0
        ? Array.from(this._providerRegistry.keys())[0]
        : null;
    }

    return true;
  }

  /**
   * Clear all providers and instances
   */
  clear() {
    // Shutdown all provider instances
    for (const [key, provider] of this._providerInstances.entries()) {
      if (typeof provider.shutdown === 'function') {
        try {
          provider.shutdown().catch(err => {
            console.error(`Error shutting down provider '${key}':`, err);
          });
        } catch (error) {
          console.error(`Error shutting down provider '${key}':`, error);
        }
      }
    }

    this._providerRegistry.clear();
    this._providerInstances.clear();
    this._defaultProviderId = null;
  }
}

// Create and export a singleton instance
const providerFactory = new ProviderFactory();
export default providerFactory;
