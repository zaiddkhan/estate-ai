/**
 * @fileoverview Accommodation service facade that abstracts provider implementation details.
 * This service acts as a high-level API for all accommodation-related operations,
 * hiding the details of which provider is used behind the scenes.
 */

import { getDefaultProvider, getProvider } from "../providers/registry.js";

import { exportAllDataToCSV } from "../utils/csvExporter.js";

/**
 * Accommodation Service - facade for provider implementations
 */
export class AccommodationService {
  /**
   * Constructor
   * @param {Object} [options] - Service options
   * @param {string} [options.defaultProviderId] - Default provider ID
   */
  constructor(options = {}) {
    this.defaultProviderId = options.defaultProviderId;
    this.initialized = false;
  }

  /**
   * Initialize the service
   * @param {Object} [config] - Configuration options
   * @returns {Promise<void>}
   */
  async initialize(config = {}) {
    // Get the default provider
    this.provider = await (this.defaultProviderId
      ? getProvider(this.defaultProviderId, config)
      : getDefaultProvider(config));

    // Initialize the in-memory cache
    this.accommodationsCache = [];

    this.initialized = true;
  }

  /**
   * Ensure the service is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error(
        "Accommodation service is not initialized. Call initialize() first.",
      );
    }
  }

  /**
   * Search for accommodations based on criteria
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchAccommodations(searchParams) {
    this._ensureInitialized();
    return this.provider.searchAccommodations(searchParams);
  }

  /**
   * Get details for a specific accommodation
   * @param {string} accommodationId - Unique ID of the accommodation
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Accommodation details
   */
  async getAccommodationDetails(accommodationId, options = {}) {
    this._ensureInitialized();

    // If this is a numeric ID, it's probably our internal ID
    if (
      !isNaN(accommodationId) &&
      parseInt(accommodationId) == accommodationId
    ) {
      // Look up the accommodation by numeric ID in our in-memory cache
      if (this.accommodationsCache && this.accommodationsCache.length > 0) {
        try {
          const accommodation = this.accommodationsCache.find(
            (a) => a.numericId === parseInt(accommodationId),
          );
          if (accommodation) {
            return accommodation;
          }
        } catch (err) {
          console.error(
            `Error looking up accommodation by ID ${accommodationId}:`,
            err,
          );
        }
      }
    }

    // Otherwise, proceed with provider-based lookup
    return this.provider.getAccommodationDetails(accommodationId, options);
  }

  /**
   * Transform a database model to standard accommodation format
   * @private
   * @param {Object} hotel - Hotel document from database
   * @returns {Object} Standardized accommodation object
   */
  _transformFromDatabaseModel(hotel) {
    // Create the standard accommodation object from database model
    return {
      id: hotel.place_id, // Use place_id as the external ID
      numericId: hotel.id, // Store the numeric ID separately
      name: hotel.name,
      types: hotel.types || [],
      location: {
        latitude: hotel.address?.lat,
        longitude: hotel.address?.lng,
      },
      address: {
        formatted: hotel.address?.formatted_address,
        street: hotel.address?.street_number,
        city: hotel.address?.locality,
        state: hotel.address?.administrative_area_level_1,
        country: hotel.address?.country,
        postalCode: hotel.address?.postal_code,
      },
      phone: hotel.formatted_phone_number,
      website: hotel.website,
      url: hotel.url,
      rating: hotel.rating,
      reviewCount: hotel.user_ratings_total,
      priceLevel: hotel.price_level,
      photos:
        hotel.photos?.map((photo) => ({
          id: photo.reference,
          width: photo.width,
          height: photo.height,
          attribution: photo.html_attributions?.join(", "),
          s3_url: photo.s3_url,
          url: photo.original_url,
        })) || [],
      reviews:
        hotel.reviews?.map((review) => ({
          authorName: review.author_name,
          rating: review.rating,
          relativeTime: review.relative_time_description,
          time: review.time,
          text: review.text,
        })) || [],
      openingHours: hotel.opening_hours
        ? {
            openNow: hotel.opening_hours.open_now,
            periods: hotel.opening_hours.periods,
            weekdayText: hotel.opening_hours.weekday_text,
          }
        : null,
      amenities: hotel.amenities || [],
      description: hotel.description,
      provider: {
        id: "database",
        name: "Database",
        data: {
          id: hotel.id,
          place_id: hotel.place_id,
        },
      },
    };
  }

  /**
   * Get photos for a specific accommodation
   * @param {string} accommodationId - Unique ID of the accommodation
   * @param {Object} [options] - Additional options
   * @returns {Promise<Array<Object>>} Array of photo objects
   */
  async getAccommodationPhotos(accommodationId, options = {}) {
    this._ensureInitialized();
    return this.provider.getAccommodationPhotos(accommodationId, options);
  }

  /**
   * Get reviews for a specific accommodation
   * @param {string} accommodationId - Unique ID of the accommodation
   * @param {Object} [options] - Additional options
   * @returns {Promise<Array<Object>>} Array of review objects
   */
  async getAccommodationReviews(accommodationId, options = {}) {
    this._ensureInitialized();
    return this.provider.getAccommodationReviews(accommodationId, options);
  }

  /**
   * Collect accommodation data for a region or query
   * @param {Object} params - Collection parameters
   * @param {string} [params.query] - Text query (e.g., "hotels in Mumbai")
   * @param {Array<string>} [params.regions] - Regions to collect data for
   * @param {Array<string>} [params.accommodationTypes] - Types of accommodations to collect
   * @param {boolean} [params.includeDetails=true] - Whether to fetch detailed information
   * @param {boolean} [params.includePhotos=true] - Whether to fetch and process photos
   * @param {boolean} [params.saveToDatabase=true] - Whether to save results in memory
   * @param {boolean} [params.exportToCsv=false] - Whether to export results to CSV
   * @param {string} [params.exportPath='./data/exports'] - Path for CSV exports
   * @param {number} [params.limit] - Maximum number of accommodations to collect
   * @returns {Promise<Array<Object>>} Collected accommodation data
   */
  async collectAccommodationData(params) {
    this._ensureInitialized();

    const results = [];
    const processedIds = new Set();

    // Default parameters
    const exportToCsv = params.exportToCsv === true;
    const exportPath = params.exportPath || "./data/exports";

    // Process regions if provided
    if (params.regions && params.regions.length > 0) {
      for (const region of params.regions) {
        for (const type of params.accommodationTypes || ["lodging"]) {
          const query = `${type} in ${region}`;
          console.log(`Collecting data for query: ${query}`);

          // Search for accommodations
          const searchResults = await this.searchAccommodations({
            query,
            region: region,
            limit: params.limit,
            includePhotos: true,
            maxPhotos: params.maxPhotos || 3,
            maxWidthPx: params.maxWidthPx || 800,
            maxHeightPx: params.maxHeightPx || 600,
          });

          // Process results
          await this._processSearchResults(
            searchResults.accommodations,
            processedIds,
            results,
          );
        }
      }
    }
    // Process direct query if provided
    else if (params.query) {
      console.log(`Collecting data for query: ${params.query}`);

      // Search for accommodations
      const searchResults = await this.searchAccommodations({
        query: params.query,
        region: "India",
        limit: params.limit,
        includePhotos: true,
        maxPhotos: params.maxPhotos || 3,
        maxWidthPx: params.maxWidthPx || 800,
        maxHeightPx: params.maxHeightPx || 600,
      });

      // Process results
      await this._processSearchResults(
        searchResults.accommodations,
        processedIds,
        results,
      );
    } else {
      throw new Error(
        "Either regions or query must be provided for data collection",
      );
    }

    console.log(`Collected data for ${results.length} unique accommodations`);

    // Export to CSV if requested
    if (exportToCsv && results.length > 0) {
      try {
        console.log(`Exporting data to CSV in ${exportPath}...`);
        const csvFiles = await exportAllDataToCSV(results, {
          outputPath: exportPath,
          includePhotos: true,
          includeReviews: true,
        });
 
        console.log("CSV export completed successfully:");
        console.log(JSON.stringify(csvFiles, null, 2));
      } catch (error) {
        console.error("Error exporting to CSV:", error);
      }
    }

    return results;
  }

  /**
   * Process search results
   * @private
   * @param {Array<Object>} accommodations - Accommodations from search
   * @param {Set<string>} processedIds - Set of already processed IDs
   * @param {Array<Object>} results - Results array to append to
   * @param {boolean} includeDetails - Whether to fetch detailed information
   * @param {boolean} includePhotos - Whether to fetch and process photos
   * @param {boolean} saveToDatabase - Whether to save to database
   * @returns {Promise<void>}
   */
  async _processSearchResults(accommodations, processedIds, results) {
    // Process in batches to avoid overloading the API
    const BATCH_SIZE = 5;

    for (let i = 0; i < accommodations.length; i += BATCH_SIZE) {
      const batch = accommodations.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(accommodations.length / BATCH_SIZE)}`,
      );

      const batchPromises = batch.map(async (accommodation) => {
        try {
          // Skip if already processed
          if (processedIds.has(accommodation.id)) {
            return null;
          }
          processedIds.add(accommodation.id);

          let detailedAccommodation = accommodation;

          // Fetch detailed information

          detailedAccommodation = await this.getAccommodationDetails(
            accommodation.id,
          );

          // Process photos if requested
          if (
            detailedAccommodation.photos &&
            detailedAccommodation.photos.length > 0
          ) {
            const processedPhotos = await this._processAccommodationPhotos(
              detailedAccommodation,
            );
            detailedAccommodation.photos = processedPhotos;
          }

          return detailedAccommodation;
        } catch (error) {
          console.error(
            `Error processing accommodation ${accommodation.name}:`,
            error,
          );
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean));

      // Add delay between batches
      if (i + BATCH_SIZE < accommodations.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Process accommodation photos - download and upload to S3
   * @private
   * @param {Object} accommodation - Accommodation with photos
   * @returns {Promise<Array<Object>>} Processed photos
   */
  async _processAccommodationPhotos(accommodation) {
    try {
      // Limit the number of photos to process
      const MAX_PHOTOS = 5;
      const photosToProcess = accommodation.photos.slice(0, MAX_PHOTOS);

      const processedPhotos = [];

      for (const photo of photosToProcess) {
        try {
          // Simply return the photo with Google URL - no S3 processing needed
          processedPhotos.push({
            reference: photo.reference || photo.name,
            url: photo.url,
            width: photo.width,
            widthPx: photo.widthPx,
            height: photo.height,
            heightPx: photo.heightPx,
            attributions: photo.attributions || [],
            name: photo.name,
            id: photo.reference || photo.name,
          });
        } catch (photoError) {
          console.error(
            `Error processing photo for ${accommodation.name}:`,
            photoError,
          );
          // Continue with other photos
        }
      }

      return processedPhotos;
    } catch (error) {
      console.error(
        `Error processing photos for ${accommodation.name}:`,
        error,
      );
      return accommodation.photos || [];
    }
  }

  /**
   * Save accommodation data to storage (in-memory or export to CSV)
   * @private
   * @param {Object} accommodation - Accommodation data
   * @returns {Promise<Object>} Processed accommodation data
   */
  async _saveToDatabase(accommodation) {
    try {
      // Generate a unique ID if not already present
      if (!accommodation.numericId) {
        // Simple numeric ID generation - in a real app, use a more robust approach
        accommodation.numericId = Date.now() + Math.floor(Math.random() * 1000);
      }

      // Store in memory cache - in real implementation you might want to use a persistent store
      if (!this.accommodationsCache) {
        this.accommodationsCache = [];
      }

      // Check if accommodation already exists in cache
      const existingIndex = this.accommodationsCache.findIndex(
        (a) => a.id === accommodation.id,
      );

      if (existingIndex >= 0) {
        // Update existing entry
        this.accommodationsCache[existingIndex] = accommodation;
      } else {
        // Add new entry
        this.accommodationsCache.push(accommodation);
      }

      return accommodation;
    } catch (error) {
      console.error(`Error saving accommodation data:`, error);
      return accommodation; // Return original data even if save failed
    }
  }

  /**
   * Transform accommodation data for storage format
   * @private
   * @param {Object} accommodation - Standardized accommodation data
   * @returns {Object} Transformed accommodation data
   */
  _transformToHotelSchema(accommodation) {
    // Simply return the accommodation data as is
    // We no longer need to transform it to match a MongoDB schema
    return accommodation;
  }

  /**
   * Generate a description for an accommodation
   * @private
   * @param {Object} accommodation - Accommodation data
   * @returns {string} Generated description
   */
  _generateDescription(accommodation) {
    let description = `${accommodation.name} is `;

    // Add location information
    if (accommodation.address.formatted) {
      description += `located at ${accommodation.address.formatted}. `;
    }

    // Add rating information
    if (accommodation.rating) {
      description += `This ${accommodation.types.includes("hotel") ? "hotel" : "accommodation"} has a rating of ${accommodation.rating} out of 5 `;

      if (accommodation.reviewCount) {
        description += `based on ${accommodation.reviewCount} reviews. `;
      } else {
        description += `. `;
      }
    }

    // Add price level information
    if (accommodation.priceLevel) {
      const priceDescription =
        ["budget-friendly", "moderately priced", "upscale", "luxury"][
          accommodation.priceLevel - 1
        ] || "";
      if (priceDescription) {
        description += `It is a ${priceDescription} option for travelers. `;
      }
    }

    // Add amenities
    if (accommodation.amenities && accommodation.amenities.length > 0) {
      description += `Amenities include ${accommodation.amenities.slice(0, 3).join(", ")}`;

      if (accommodation.amenities.length > 3) {
        description += ` and more`;
      }

      description += `. `;
    }

    // Add a generic closing statement
    description += `Guests can find more information by visiting their website or calling directly.`;

    return description;
  }

  /**
   * Get supported accommodation types
   * @returns {Promise<Array<Object>>} Supported accommodation types
   */
  async getSupportedAccommodationTypes() {
    this._ensureInitialized();
    return this.provider.getSupportedAccommodationTypes();
  }

  /**
   * Get available locations
   * @returns {Promise<Array<Object>>} Available locations
   */
  async getAvailableLocations() {
    this._ensureInitialized();
    return this.provider.getAvailableLocations();
  }

  /**
   * Change the active provider
   * @param {string} providerId - ID of the provider to use
   * @param {Object} [config] - Provider configuration
   * @returns {Promise<void>}
   */
  async changeProvider(providerId, config = {}) {
    this.provider = await getProvider(providerId, config);
  }
}

// Create and export a singleton instance
const accommodationService = new AccommodationService();
export default accommodationService;
