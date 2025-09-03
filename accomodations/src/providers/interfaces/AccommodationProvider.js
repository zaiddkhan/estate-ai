/**
 * @fileoverview Interface definition for accommodation data providers.
 * This interface defines the contract that all accommodation data providers must implement.
 */

/**
 * Interface for accommodation data providers.
 * All accommodation data source implementations must implement these methods.
 *
 * @interface
 */
export class AccommodationProvider {
  /**
   * Initialize the provider with configuration options
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  async initialize(config) {
    throw new Error('Method not implemented: initialize()');
  }

  /**
   * Search for accommodations based on search criteria
   * @param {Object} searchParams - Parameters for the search
   * @param {string} searchParams.query - Text query (e.g., "hotels in Mumbai")
   * @param {Object} [searchParams.location] - Geographic location to search around
   * @param {number} [searchParams.location.latitude] - Latitude
   * @param {number} [searchParams.location.longitude] - Longitude
   * @param {number} [searchParams.radius] - Search radius in meters
   * @param {Array<string>} [searchParams.types] - Types of accommodations to search for
   * @param {string} [searchParams.region] - Region code (e.g., "in" for India)
   * @param {Object} [searchParams.filters] - Additional filters
   * @param {number} [searchParams.limit] - Maximum number of results to return
   * @param {string} [searchParams.pageToken] - Token for pagination
   * @returns {Promise<Object>} Search results with accommodations and pagination info
   */
  async searchAccommodations(searchParams) {
    throw new Error('Method not implemented: searchAccommodations()');
  }

  /**
   * Get detailed information about a specific accommodation
   * @param {string} accommodationId - Unique identifier for the accommodation
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Detailed accommodation information
   */
  async getAccommodationDetails(accommodationId, options = {}) {
    throw new Error('Method not implemented: getAccommodationDetails()');
  }

  /**
   * Get photos for a specific accommodation
   * @param {string} accommodationId - Unique identifier for the accommodation
   * @param {Object} [options] - Additional options
   * @param {number} [options.maxResults] - Maximum number of photos to return
   * @param {string} [options.photoType] - Type of photos to retrieve (e.g., "exterior", "room")
   * @returns {Promise<Array<Object>>} Array of photo objects
   */
  async getAccommodationPhotos(accommodationId, options = {}) {
    throw new Error('Method not implemented: getAccommodationPhotos()');
  }

  /**
   * Get reviews for a specific accommodation
   * @param {string} accommodationId - Unique identifier for the accommodation
   * @param {Object} [options] - Additional options
   * @param {number} [options.maxResults] - Maximum number of reviews to return
   * @param {string} [options.language] - Language code for reviews
   * @param {string} [options.sortBy] - Sorting criteria (e.g., "recent", "rating")
   * @returns {Promise<Array<Object>>} Array of review objects
   */
  async getAccommodationReviews(accommodationId, options = {}) {
    throw new Error('Method not implemented: getAccommodationReviews()');
  }

  /**
   * Get available regions or locations for accommodation search
   * @returns {Promise<Array<Object>>} Array of available regions/locations
   */
  async getAvailableLocations() {
    throw new Error('Method not implemented: getAvailableLocations()');
  }

  /**
   * Get accommodation types supported by this provider
   * @returns {Promise<Array<Object>>} Array of supported accommodation types
   */
  async getSupportedAccommodationTypes() {
    throw new Error('Method not implemented: getSupportedAccommodationTypes()');
  }

  /**
   * Test the provider connection
   * @returns {Promise<boolean>} True if the connection is successful
   */
  async testConnection() {
    throw new Error('Method not implemented: testConnection()');
  }

  /**
   * Release any resources held by the provider
   * @returns {Promise<void>}
   */
  async shutdown() {
    throw new Error('Method not implemented: shutdown()');
  }
}

/**
 * Standard accommodation object structure that all providers should return
 * @typedef {Object} Accommodation
 * @property {string} id - Unique identifier for the accommodation
 * @property {string} name - Name of the accommodation
 * @property {string} [description] - Description of the accommodation
 * @property {Array<string>} [types] - Types/categories of the accommodation
 * @property {Object} location - Geographic location
 * @property {number} location.latitude - Latitude
 * @property {number} location.longitude - Longitude
 * @property {Object} address - Address information
 * @property {string} [address.formatted] - Formatted address
 * @property {string} [address.street] - Street address
 * @property {string} [address.city] - City
 * @property {string} [address.state] - State/province
 * @property {string} [address.country] - Country
 * @property {string} [address.postalCode] - Postal/ZIP code
 * @property {number} [rating] - Rating (e.g., 0-5)
 * @property {number} [reviewCount] - Number of reviews
 * @property {number} [priceLevel] - Price level (e.g., 1-4)
 * @property {string} [phone] - Phone number
 * @property {string} [website] - Website URL
 * @property {Object} [openingHours] - Opening hours information
 * @property {boolean} [openingHours.openNow] - Whether the accommodation is currently open
 * @property {Array<Object>} [openingHours.periods] - Detailed opening periods
 * @property {Array<string>} [openingHours.weekdayText] - Text representation of opening hours
 * @property {Array<string>} [amenities] - Available amenities
 * @property {Array<Object>} [photos] - Photos information
 * @property {string} photos[].id - Unique identifier for the photo
 * @property {string} [photos[].url] - URL of the photo
 * @property {number} [photos[].width] - Width of the photo
 * @property {number} [photos[].height] - Height of the photo
 * @property {string} [photos[].attribution] - Attribution for the photo
 * @property {Array<Object>} [reviews] - Reviews
 * @property {Object} [provider] - Provider-specific information
 * @property {string} provider.id - Provider identifier
 * @property {string} provider.name - Provider name
 * @property {Object} provider.data - Provider-specific data
 */

/**
 * @typedef {Object} SearchResults
 * @property {Array<Accommodation>} accommodations - Array of accommodation objects
 * @property {string} [nextPageToken] - Token for fetching the next page of results
 * @property {number} totalResults - Total number of results available
 * @property {Object} [attribution] - Attribution information for the data source
 */
