/**
 * @fileoverview Google Places API implementation of the Accommodation Provider.
 * This implementation uses Google Places (New) Text Search API to search for and retrieve accommodation data.
 */

import axios from "axios";
import { AccommodationProvider } from "../interfaces/AccommodationProvider.js";

/**
 * Implementation of the Accommodation Provider interface using Google Places (New) Text Search API
 * @implements {AccommodationProvider}
 */
export class GooglePlacesProvider extends AccommodationProvider {
  /**
   * Constructor
   */
  constructor() {
    super();
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
    this.placesBaseUrl = "https://places.googleapis.com/v1/places:searchText";
    this.placesDetailUrl = "https://places.googleapis.com/v1/places";
    this.placesPhotoUrl = "https://places.googleapis.com/v1";
    this.initialized = false;
    this.defaultLanguage = "en";
    this.defaultRegion = "IN";
    this.requestDelay = 200; // ms between requests to avoid rate limiting
    this.maxRetries = 3;
  }

  /**
   * Initialize the provider with configuration options
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey - Google Places API key
   * @param {string} [config.language='en'] - Language for results
   * @param {string} [config.region='IN'] - Region bias for search results
   * @param {number} [config.requestDelay=200] - Delay between requests in milliseconds
   * @param {number} [config.maxRetries=3] - Maximum number of retries for failed requests
   * @returns {Promise<void>}
   * @throws {Error} If the API key is not provided or initialization fails
   */
  async initialize(config) {
    if (!config.apiKey) {
      throw new Error("Google Places API key is required");
    }

    this.apiKey = config.apiKey || process.env.GOOGLE_PLACES_API_KEY;
    this.defaultLanguage = config.language || this.defaultLanguage;
    this.defaultRegion = config.region || this.defaultRegion;
    this.requestDelay = config.requestDelay || this.requestDelay;
    this.maxRetries = config.maxRetries || this.maxRetries;

    // Test the connection
    try {
      await this.testConnection();
      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Google Places provider: ${error.message}`,
      );
    }
  }

  /**
   * Ensure the provider is initialized before use
   * @private
   * @throws {Error} If the provider is not initialized
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error(
        "Google Places provider is not initialized. Call initialize() first.",
      );
    }
  }

  /**
   * Add a delay between API requests to avoid rate limiting
   * @private
   * @param {number} [delay] - Delay in milliseconds (defaults to this.requestDelay)
   * @returns {Promise<void>}
   */
  async _addRequestDelay(delay = null) {
    const ms = delay || this.requestDelay;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make an API request with retries
   * @private
   * @param {string} textQuery - Search text query
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} API response
   * @throws {Error} If the request fails after all retries
   */
  async _makeRequest(textQuery, options = {}) {
    this._ensureInitialized();

    const requestBody = {
      textQuery: textQuery,
      languageCode: options.language || this.defaultLanguage,
      regionCode: options.region || this.defaultRegion,
      maxResultCount: options.maxResultCount || 20,
      includedType: "lodging",
      locationBias: options.locationBias || {
        rectangle: {
          low: {
            latitude: 6.4627,
            longitude: 68.1097,
          },
          high: {
            latitude: 35.513327,
            longitude: 97.395561,
          },
        },
      },
    };

    const headers = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": this.apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.types,places.primaryType,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.internationalPhoneNumber,places.photos,places.reviews,places.businessStatus,places.googleMapsUri,places.regularOpeningHours,places.currentOpeningHours",
    };

    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          await this._addRequestDelay(this.requestDelay * attempt);
        }

        const response = await axios.post(this.placesBaseUrl, requestBody, {
          headers,
        });

        if (response.data.error) {
          throw new Error(`API Error: ${response.data.error.message}`);
        }

        return response.data;
      } catch (error) {
        lastError = error;

        if (error.response) {
          const status = error.response.status;
          const errorData = error.response.data;

          // Don't retry certain types of errors
          if (status === 400 || status === 401 || status === 403) {
            throw new Error(
              `API Error (${status}): ${errorData.error?.message || error.message}`,
            );
          }

          console.warn(
            `Request attempt ${attempt} failed with status ${status}: ${errorData.error?.message || error.message}`,
          );
        } else {
          console.warn(`Request attempt ${attempt} failed: ${error.message}`);
        }

        // If this was the last attempt, we'll throw the error after the loop
        if (attempt === this.maxRetries) {
          break;
        }
      }
    }

    throw new Error(
      `Request failed after ${this.maxRetries} attempts. Last error: ${lastError.message}`,
    );
  }

  /**
   * Search for accommodations using text queries
   * @param {Object} searchParams - Search parameters
   * @param {string} [searchParams.query] - Custom search query
   * @param {string} [searchParams.region] - Region for search (e.g., 'Mumbai', 'Delhi')
   * @param {Array<string>} [searchParams.types] - Types of accommodations to search for
   * @param {number} [searchParams.limit] - Maximum number of results to return
   * @returns {Promise<Object>} Search results with accommodations and pagination info
   */
  async searchAccommodations(searchParams) {
    this._ensureInitialized();

    try {
      let searchQuery;

      if (searchParams.query) {
        // Use custom query
        searchQuery = searchParams.query;
      } else {
        // Generate query based on region and types
        const region = searchParams.region || "India";
        const types = searchParams.types || ["hotels"];
        searchQuery = `${types.join(" ")} in ${region}`;
      }

      console.log(`Searching: ${searchQuery}`);

      const response = await this._makeRequest(searchQuery, {
        maxResultCount: Math.min(20, searchParams.limit || 20),
        region: this.defaultRegion,
      });

      let accommodations = [];

      if (response.places && response.places.length > 0) {
        accommodations = response.places
          .filter((place) => {
            // Filter for accommodation types
            return (
              place.types &&
              place.types.some((type) =>
                [
                  "lodging",
                  "hotel",
                  "motel",
                  "resort",
                  "guest_house",
                  "hostel",
                  "bed_and_breakfast",
                ].includes(type),
              )
            );
          })
          .map((place) => this._mapToStandardFormat(place));

        console.log(`Found ${accommodations.length} accommodations`);

        // Process photos for accommodations that have them
        if (accommodations.length > 0 && searchParams.includePhotos !== false) {
          console.log("Processing photos for accommodations...");
          await this._processAccommodationPhotos(accommodations, searchParams);
        }
      }

      // Apply limit if specified
      if (searchParams.limit && accommodations.length > searchParams.limit) {
        accommodations = accommodations.slice(0, searchParams.limit);
      }

      return {
        accommodations: accommodations,
        nextPageToken: null, // New API doesn't support pagination in the same way
        totalResults: accommodations.length,
        attribution: {
          source: "Google Places (New) API",
          terms: "Data provided by Google",
          url: "https://developers.google.com/maps/documentation/places/web-service/policies",
        },
      };
    } catch (error) {
      throw new Error(`Failed to search accommodations: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a specific accommodation
   * @param {string} accommodationId - Unique identifier for the accommodation (place ID)
   * @param {Object} [options] - Additional options
   * @param {Array<string>} [options.fields] - Specific fields to request
   * @param {string} [options.language] - Language for the results
   * @returns {Promise<Object>} Detailed accommodation information
   */
  async getAccommodationDetails(accommodationId, options = {}) {
    this._ensureInitialized();

    try {
      const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "*",
      };

      const response = await axios.get(
        `${this.placesDetailUrl}/${accommodationId}`,
        {
          headers,
          params: {
            languageCode: options.language || this.defaultLanguage,
          },
        },
      );

      console.log(response.data, "hehehee");

      if (response.data.error) {
        throw new Error(`API Error: ${response.data.error.message}`);
      }

      return this._mapToStandardFormat(response.data);
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        throw new Error(
          `Failed to get accommodation details (${status}): ${errorData.error?.message || error.message}`,
        );
      }
      throw new Error(`Failed to get accommodation details: ${error.message}`);
    }
  }

  /**
   * Get photos for a specific accommodation
   * @param {string} accommodationId - Unique identifier for the accommodation
   * @param {Object} [options] - Additional options
   * @param {number} [options.maxPhotos=5] - Maximum number of photos to fetch
   * @param {number} [options.maxWidthPx=800] - Maximum width of photos in pixels
   * @param {number} [options.maxHeightPx=600] - Maximum height of photos in pixels
   * @returns {Promise<Array>} Array of photo objects with URLs
   */
  async getAccommodationPhotos(accommodationId, options = {}) {
    this._ensureInitialized();

    try {
      const maxPhotos = options.maxPhotos || 5;
      const maxWidthPx = options.maxWidthPx || 800;
      const maxHeightPx = options.maxHeightPx || 600;

      // First get the accommodation details to get photo names
      const details = await this.getAccommodationDetails(
        accommodationId,
        options,
      );

      if (!details.photos || details.photos.length === 0) {
        return [];
      }

      // Limit the number of photos to process
      const photoReferences = details.photos.slice(0, maxPhotos);
      const photoPromises = photoReferences.map(async (photo, index) => {
        // Add delay between requests to avoid rate limiting
        await this._addRequestDelay(index * 100);

        try {
          const photoUrl = await this._getPhotoUrl(photo.reference, {
            maxWidthPx,
            maxHeightPx,
          });

          return {
            id: photo.reference,
            url: photoUrl,
            width: photo.width,
            height: photo.height,
            attributions: photo.attributions || [],
            accommodation: {
              id: accommodationId,
              name: details.name,
            },
            provider: {
              id: "google-places-new",
              reference: photo.reference,
            },
          };
        } catch (photoError) {
          console.error(
            `Error processing photo ${index} for ${accommodationId}:`,
            photoError,
          );
          return null;
        }
      });

      const photos = await Promise.all(photoPromises);
      return photos.filter(Boolean); // Remove any null entries
    } catch (error) {
      throw new Error(`Failed to get accommodation photos: ${error.message}`);
    }
  }

  /**
   * Get the URL for a Google Places photo using the new Photos API
   * @private
   * @param {string} photoName - Photo resource name from Places API
   * @param {Object} [options] - Photo options
   * @param {number} [options.maxWidthPx=800] - Maximum width of the photo
   * @param {number} [options.maxHeightPx=600] - Maximum height of the photo
   * @param {boolean} [options.skipHttpRedirect=false] - Skip redirect and return JSON
   * @returns {Promise<string>} Photo URL or JSON response
   */
  async _getPhotoUrl(photoName, options = {}) {
    this._ensureInitialized();

    const maxWidthPx = options.maxWidthPx || 800;
    const maxHeightPx = options.maxHeightPx || 600;
    const skipHttpRedirect = options.skipHttpRedirect || false;

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        maxWidthPx: maxWidthPx,
        maxHeightPx: maxHeightPx,
        skipHttpRedirect: skipHttpRedirect,
      });

      const photoUrl = `${this.placesPhotoUrl}/${photoName}/media?${params.toString()}`;

      if (skipHttpRedirect) {
        // Make a request to get JSON response with photo details
        const response = await axios.get(photoUrl);
        return response.data.photoUri;
      } else {
        // Return the direct URL for HTTP redirect
        return photoUrl;
      }
    } catch (error) {
      throw new Error(`Failed to get photo URL: ${error.message}`);
    }
  }

  /**
   * Get reviews for a specific accommodation
   * @param {string} accommodationId - Unique identifier for the accommodation
   * @param {Object} [options] - Additional options
   * @returns {Promise<Array>} Array of reviews
   */
  async getAccommodationReviews(accommodationId, options = {}) {
    this._ensureInitialized();

    try {
      const details = await this.getAccommodationDetails(
        accommodationId,
        options,
      );
      return details.reviews || [];
    } catch (error) {
      throw new Error(`Failed to get accommodation reviews: ${error.message}`);
    }
  }

  /**
   * Map a place from Google Places API response to our standard format
   * @private
   * @param {Object} place - Place object from Google Places API
   * @returns {Object} Standardized place object
   */
  _mapToStandardFormat(place) {
    const getNestedValue = (obj, path) => {
      return path
        .split(".")
        .reduce((current, key) => current && current[key], obj);
    };

    return {
      id: place.id,
      name: getNestedValue(place, "displayName.text") || place.displayName,
      address: place.adrFormatAddress,
      addressComponents: place.addressComponents,
      addressDescriptor: place.addressDescriptor,
      location: place.location
        ? {
            latitude: place.location.latitude,
            longitude: place.location.longitude,
          }
        : null,
      types: place.types || [],
      primaryType: place.primaryType,
      rating: place.rating,
      reviewCount: place.userRatingCount,
      priceLevel: place.priceLevel,
      phone: place.internationalPhoneNumber,
      website: place.websiteUri,
      photos: place.photos
        ? place.photos.map((photo) => ({
            reference: photo.name,
            name: photo.name,
            width: photo.widthPx,
            height: photo.heightPx,
            widthPx: photo.widthPx,
            heightPx: photo.heightPx,
            attributions: photo.authorAttributions,
            url: `${this.placesPhotoUrl}/${photo.name}/media?key=${this.apiKey}&maxWidthPx=800&maxHeightPx=600`,
          }))
        : [],
      reviews: place.reviews
        ? place.reviews.map((review) => ({
            author: review.authorAttribution?.displayName,
            rating: review.rating,
            text: getNestedValue(review, "text.text"),
            time: review.publishTime,
            language: review.originalText?.languageCode,
          }))
        : [],
      reviewSummary: place.reviewSummary,
      photoUrls: [], // Will be populated by photo processing
      businessStatus: place.businessStatus,
      googleMapsUri: place.googleMapsUri,
      openingHours: place.regularOpeningHours,
      currentOpeningHours: place.currentOpeningHours,
      editorialSummary: getNestedValue(place, "editorialSummary.text"),
      source: "google_places_new",
      maps_links: place.googleMapsLinks,
    };
  }

  /**
   * Process and fetch photos for accommodations
   * @private
   * @param {Array} accommodations - Array of accommodation objects
   * @param {Object} options - Processing options
   */
  async _processAccommodationPhotos(accommodations, options = {}) {
    const maxPhotos = options.maxPhotos || 3;

    for (let i = 0; i < accommodations.length; i++) {
      const accommodation = accommodations[i];

      if (accommodation.photos && accommodation.photos.length > 0) {
        try {
          console.log(`Processing photos for: ${accommodation.name}`);

          // Get photo URLs for this accommodation
          const photoData = await this.getAccommodationPhotos(
            accommodation.id,
            {
              maxPhotos,
              maxWidthPx: options.maxWidthPx || 800,
              maxHeightPx: options.maxHeightPx || 600,
            },
          );

          // Add photo URLs to the accommodation object
          accommodation.photoUrls = photoData.map((photo) => photo.url);

          console.log(
            `Added ${accommodation.photoUrls.length} photos for ${accommodation.name}`,
          );

          // Add delay between processing accommodations
          await this._addRequestDelay(200);
        } catch (error) {
          console.warn(
            `Failed to process photos for ${accommodation.name}: ${error.message}`,
          );
          accommodation.photoUrls = [];
        }
      } else {
        accommodation.photoUrls = [];
      }
    }
  }

  /**
   * Test the connection to Google Places API
   * @private
   * @returns {Promise<void>}
   * @throws {Error} If the connection test fails
   */
  async testConnection() {
    try {
      // Make a simple request to verify the API key works
      const response = await axios.post(
        this.placesBaseUrl,
        {
          textQuery: "hotel in Mumbai, India",
          maxResultCount: 1,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName",
          },
        },
      );

      // If we get a valid response (even empty results), the connection works
      if (response.status === 200) {
        console.log("Google Places API connection test successful");
        return;
      }

      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 401) {
          throw new Error("Invalid API key or authentication failed");
        } else if (status === 403) {
          throw new Error(
            "API key does not have permission to access Google Places API",
          );
        } else {
          throw new Error(
            `API Error (${status}): ${errorData.error?.message || error.message}`,
          );
        }
      }

      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Get available regions or locations for accommodation search
   * @returns {Promise<Array<Object>>} Array of available regions/locations
   */
  async getAvailableLocations() {
    // Return common locations in India
    return [
      {
        id: "mumbai",
        name: "Mumbai",
        country: "India",
        coordinates: { latitude: 19.076, longitude: 72.8777 },
      },
      {
        id: "delhi",
        name: "Delhi",
        country: "India",
        coordinates: { latitude: 28.6139, longitude: 77.209 },
      },
      {
        id: "bangalore",
        name: "Bangalore",
        country: "India",
        coordinates: { latitude: 12.9716, longitude: 77.5946 },
      },
      {
        id: "hyderabad",
        name: "Hyderabad",
        country: "India",
        coordinates: { latitude: 17.385, longitude: 78.4867 },
      },
      {
        id: "chennai",
        name: "Chennai",
        country: "India",
        coordinates: { latitude: 13.0827, longitude: 80.2707 },
      },
      {
        id: "kolkata",
        name: "Kolkata",
        country: "India",
        coordinates: { latitude: 22.5726, longitude: 88.3639 },
      },
      {
        id: "jaipur",
        name: "Jaipur",
        country: "India",
        coordinates: { latitude: 26.9124, longitude: 75.7873 },
      },
      {
        id: "goa",
        name: "Goa",
        country: "India",
        coordinates: { latitude: 15.2993, longitude: 74.124 },
      },
    ];
  }

  /**
   * Get accommodation types supported by this provider
   * @returns {Promise<Array<Object>>} Array of supported accommodation types
   */
  async getSupportedAccommodationTypes() {
    return [
      { id: "lodging", name: "All Accommodations" },
      { id: "hotel", name: "Hotels" },
      { id: "resort", name: "Resorts" },
      { id: "guest_house", name: "Guest Houses" },
      { id: "hostel", name: "Hostels" },
      { id: "motel", name: "Motels" },
      { id: "bed_and_breakfast", name: "Bed & Breakfast" },
    ];
  }

  /**
   * Release any resources held by the provider
   * @returns {Promise<void>}
   */
  async shutdown() {
    // No specific resources to release for this provider
    this.initialized = false;
    return Promise.resolve();
  }

  /**
   * Get provider-specific metadata
   * @returns {Object} Provider metadata
   */
  getProviderInfo() {
    return {
      id: "google_places_new",
      name: "Google Places (New) API",
      version: "1.0",
      description: "Google Places API using the new Text Search endpoint",
      supportedFeatures: ["text_search", "place_details", "photos", "reviews"],
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerDay: 100000,
      },
    };
  }
}

export default GooglePlacesProvider;
