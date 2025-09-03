/**
 * @fileoverview CSV Exporter utility for accommodation data
 * This utility provides functions to export accommodation data to separate CSV files
 * with proper foreign key relationships between accommodations, photos, and reviews
 */

import fs from "fs/promises";
import path from "path";
import { createObjectCsvWriter } from "csv-writer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Counter for generating auto-incrementing IDs
let idCounter = 1;

/**
 * Export accommodations to a CSV file (without photos and reviews)
 * @param {Array<Object>} accommodations - Array of accommodation objects to export
 * @param {Object} options - Export options
 * @param {string} [options.outputPath='./data/exports'] - Path to save the CSV file
 * @param {string} [options.filename] - Custom filename (default: 'accommodations-YYYY-MM-DD.csv')
 * @param {Array<string>} [options.fields] - Specific fields to include in the export
 * @param {boolean} [options.resetIdCounter=false] - Whether to reset the ID counter
 * @returns {Promise<string>} Path to the created CSV file
 */
export const exportAccommodationsToCSV = async (
  accommodations,
  options = {},
) => {
  try {
    // Default options
    const outputPath = options.outputPath || "./data/exports";
    const currentDate = new Date().toISOString().split("T")[0];
    const filename = options.filename || `accommodations-${currentDate}.csv`;

    // Ensure output directory exists
    await fs.mkdir(outputPath, { recursive: true });
    const filePath = path.join(outputPath, filename);

    // Reset ID counter if requested
    if (options.resetIdCounter) {
      idCounter = 1;
    }

    // Define fields to export (excluding photos and reviews)
    let fields = options.fields;
    if (!fields) {
      // Default fields to export - excluding photos and reviews
      fields = [
        "auto_place_id",
        "google_place_id",
        "name",
        "address",
        "addressComponents",
        "addressDescriptor",
        "location.latitude",
        "location.longitude",
        "types",
        "primary_type",
        "rating",
        "review_count",
        "price_level",
        "phone",
        "website",
        "reviewSummary",
        "business_status",
        "google_maps_uri",
        "opening_hours",
        "current_opening_hours",
        "editorial_summary",
        "source",
        "maps_links",
      ];
    }

    // Create CSV header
    const header = fields.map((field) => {
      const label = field.replace(/\./g, "_"); // Replace dots with underscores for the header
      return { id: field, title: label };
    });

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: header,
    });

    const records = [];
    let count = 0;

    console.log("Processing accommodation data for CSV export...");

    // Process each accommodation
    for (const accommodation of accommodations) {
      const record = {};

      // Add auto-incrementing ID and Google Place ID
      record["auto_place_id"] = idCounter++;
      record["google_place_id"] = accommodation.id;

      // Map fields from accommodation to flat structure for CSV
      fields.forEach((field) => {
        if (field === "auto_place_id" || field === "google_place_id") {
          // Skip, already added
          return;
        } else if (field.includes(".")) {
          // Handle nested fields
          const parts = field.split(".");
          let value = accommodation;
          for (const part of parts) {
            if (value && typeof value === "object") {
              value = value[part];
            } else {
              value = undefined;
              break;
            }
          }
          record[field] = formatValueForCsv(value);
        } else if (field === "types" || field === "amenities") {
          // Convert arrays to comma-separated strings
          record[field] = Array.isArray(accommodation[field])
            ? accommodation[field].join(", ")
            : "";
        } else if (field === "review_count") {
          // Map reviewCount to review_count
          record[field] = formatValueForCsv(accommodation.reviewCount);
        } else if (field === "price_level") {
          // Map priceLevel to price_level
          record[field] = formatValueForCsv(accommodation.priceLevel);
        } else if (field === "primary_type") {
          // Map primaryType to primary_type
          record[field] = formatValueForCsv(accommodation.primaryType);
        } else if (field === "business_status") {
          // Map businessStatus to business_status
          record[field] = formatValueForCsv(accommodation.businessStatus);
        } else if (field === "google_maps_uri") {
          // Map googleMapsUri to google_maps_uri
          record[field] = formatValueForCsv(accommodation.googleMapsUri);
        } else if (field === "editorial_summary") {
          // Map editorialSummary to editorial_summary
          record[field] = formatValueForCsv(accommodation.editorialSummary);
        } else if (field === "opening_hours") {
          // Handle opening hours object
          record[field] = accommodation.openingHours
            ? JSON.stringify(accommodation.openingHours)
            : "";
        } else if (field === "current_opening_hours") {
          // Handle current opening hours object
          record[field] = accommodation.currentOpeningHours
            ? JSON.stringify(accommodation.currentOpeningHours)
            : "";
        } else if (field === "reviewSummary") {
          // Handle review summary object
          record[field] = accommodation.reviewSummary
            ? JSON.stringify(accommodation.reviewSummary)
            : "";
        } else if (field === "addressComponents") {
          // Handle address components array
          record[field] = accommodation.addressComponents
            ? JSON.stringify(accommodation.addressComponents)
            : "";
        } else if (field === "addressDescriptor") {
          // Handle address descriptor object
          record[field] = accommodation.addressDescriptor
            ? JSON.stringify(accommodation.addressDescriptor)
            : "";
        } else if (field === "maps_links") {
          // Handle maps links object
          record[field] = accommodation.maps_links
            ? JSON.stringify(accommodation.maps_links)
            : "";
        } else {
          // Handle regular fields
          record[field] = formatValueForCsv(accommodation[field]);
        }
      });

      records.push(record);
      count++;

      // Write in batches to avoid memory issues with large datasets
      if (count % 1000 === 0) {
        await csvWriter.writeRecords(records.splice(0, records.length));
        console.log(`Processed ${count} records...`);
      }
    }

    // Write any remaining records
    if (records.length > 0) {
      await csvWriter.writeRecords(records);
    }

    console.log(
      `CSV export completed: ${count} records exported to ${filePath}`,
    );
    return filePath;
  } catch (error) {
    console.error("Error exporting accommodations to CSV:", error);
    throw error;
  }
};

/**
 * Export accommodation photos to a separate CSV file with foreign key relationships
 * @param {Array<Object>} accommodations - Array of accommodation objects with photos
 * @param {Object} options - Export options
 * @param {string} [options.outputPath='./data/exports'] - Path to save the CSV file
 * @param {string} [options.filename] - Custom filename (default: 'accommodation-photos-YYYY-MM-DD.csv')
 * @param {Map} [options.placeIdMap] - Map of Google Place IDs to auto-generated place IDs
 * @returns {Promise<string>} Path to the created CSV file
 */
export const exportPhotosToCSV = async (accommodations, options = {}) => {
  try {
    // Default options
    const outputPath = options.outputPath || "./data/exports";
    const currentDate = new Date().toISOString().split("T")[0];
    const filename =
      options.filename || `accommodation-photos-${currentDate}.csv`;

    // Ensure output directory exists
    await fs.mkdir(outputPath, { recursive: true });
    const filePath = path.join(outputPath, filename);

    // Create CSV header for photos with foreign keys
    const header = [
      { id: "photo_id", title: "photo_id" },
      { id: "auto_place_id", title: "auto_place_id" },
      { id: "google_place_id", title: "google_place_id" },
      { id: "accommodation_name", title: "accommodation_name" },
      { id: "photo_reference", title: "photo_reference" },
      { id: "photo_url", title: "photo_url" },
      { id: "width_px", title: "width_px" },
      { id: "height_px", title: "height_px" },
      { id: "attributions", title: "attributions" },
      { id: "photo_type", title: "photo_type" },
      { id: "created_at", title: "created_at" },
    ];

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: header,
    });

    const records = [];
    let totalPhotos = 0;
    let processedAccommodations = 0;
    let photoAutoId = 1;
    const placeIdMap = options.placeIdMap || new Map();

    console.log("Processing accommodation photos for CSV export...");

    // Process each accommodation
    for (const accommodation of accommodations) {
      const currentAutoPlaceId = placeIdMap.get(accommodation.id) || 0;

      if (accommodation.photos && accommodation.photos.length > 0) {
        // Process each photo
        accommodation.photos.forEach((photo, index) => {
          records.push({
            photo_id: photoAutoId++,
            auto_place_id: currentAutoPlaceId,
            google_place_id: accommodation.id,
            accommodation_name: accommodation.name || "",
            photo_reference: photo.reference || photo.name || "",
            photo_url: photo.url || "",
            width_px: photo.width || photo.widthPx || "",
            height_px: photo.height || photo.heightPx || "",
            attributions: Array.isArray(photo.attributions)
              ? photo.attributions
                  .map((attr) => attr.displayName || attr)
                  .join("; ")
              : photo.attributions || "",
            photo_type: photo.type || "general",
            created_at: new Date().toISOString(),
          });
          totalPhotos++;
        });
      }

      processedAccommodations++;

      // Write in batches to avoid memory issues
      if (records.length >= 1000) {
        await csvWriter.writeRecords(records.splice(0, records.length));
        console.log(
          `Processed ${processedAccommodations} accommodations, ${totalPhotos} photos so far...`,
        );
      }
    }

    // Write any remaining records
    if (records.length > 0) {
      await csvWriter.writeRecords(records);
    }

    console.log(
      `CSV export completed: ${totalPhotos} photos from ${processedAccommodations} accommodations exported to ${filePath}`,
    );
    return filePath;
  } catch (error) {
    console.error("Error exporting photos to CSV:", error);
    throw error;
  }
};

/**
 * Export accommodation reviews to a separate CSV file with foreign key relationships
 * @param {Array<Object>} accommodations - Array of accommodation objects with reviews
 * @param {Object} options - Export options
 * @param {string} [options.outputPath='./data/exports'] - Path to save the CSV file
 * @param {string} [options.filename] - Custom filename (default: 'accommodation-reviews-YYYY-MM-DD.csv')
 * @param {Map} [options.placeIdMap] - Map of Google Place IDs to auto-generated place IDs
 * @returns {Promise<string>} Path to the created CSV file
 */
export const exportReviewsToCSV = async (accommodations, options = {}) => {
  try {
    // Default options
    const outputPath = options.outputPath || "./data/exports";
    const currentDate = new Date().toISOString().split("T")[0];
    const filename =
      options.filename || `accommodation-reviews-${currentDate}.csv`;

    // Ensure output directory exists
    await fs.mkdir(outputPath, { recursive: true });
    const filePath = path.join(outputPath, filename);

    // Create CSV header for reviews with foreign keys
    const header = [
      { id: "review_id", title: "review_id" },
      { id: "auto_place_id", title: "auto_place_id" },
      { id: "google_place_id", title: "google_place_id" },
      { id: "accommodation_name", title: "accommodation_name" },
      { id: "author_name", title: "author_name" },
      { id: "author_photo_url", title: "author_photo_url" },
      { id: "rating", title: "rating" },
      { id: "review_text", title: "review_text" },
      { id: "original_language", title: "original_language" },
      { id: "translated_text", title: "translated_text" },
      { id: "publish_time", title: "publish_time" },
      { id: "relative_time", title: "relative_time" },
      { id: "created_at", title: "created_at" },
    ];

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: header,
    });

    const records = [];
    let totalReviews = 0;
    let processedAccommodations = 0;
    let reviewAutoId = 1;
    const placeIdMap = options.placeIdMap || new Map();

    console.log("Processing accommodation reviews for CSV export...");

    // Process each accommodation
    for (const accommodation of accommodations) {
      const currentAutoPlaceId = placeIdMap.get(accommodation.id) || 0;

      if (accommodation.reviews && accommodation.reviews.length > 0) {
        // Process each review
        accommodation.reviews.forEach((review, index) => {
          records.push({
            review_id: reviewAutoId++,
            auto_place_id: currentAutoPlaceId,
            google_place_id: accommodation.id,
            accommodation_name: accommodation.name || "",
            author_name: review.author || review.authorName || "",
            author_photo_url: review.authorPhotoUrl || "",
            rating: review.rating || "",
            review_text: review.text
              ? review.text.replace(/\n/g, " ").replace(/\r/g, " ")
              : "",
            original_language: review.language || review.originalLanguage || "",
            translated_text: review.translatedText || "",
            publish_time: review.time
              ? review.time instanceof Date
                ? review.time.toISOString()
                : review.time
              : "",
            relative_time: review.relativeTime || "",
            created_at: new Date().toISOString(),
          });
          totalReviews++;
        });
      }

      processedAccommodations++;

      // Write in batches to avoid memory issues
      if (records.length >= 1000) {
        await csvWriter.writeRecords(records.splice(0, records.length));
        console.log(
          `Processed ${processedAccommodations} accommodations, ${totalReviews} reviews so far...`,
        );
      }
    }

    // Write any remaining records
    if (records.length > 0) {
      await csvWriter.writeRecords(records);
    }

    console.log(
      `CSV export completed: ${totalReviews} reviews from ${processedAccommodations} accommodations exported to ${filePath}`,
    );
    return filePath;
  } catch (error) {
    console.error("Error exporting reviews to CSV:", error);
    throw error;
  }
};

/**
 * Format a value for CSV output
 * @private
 * @param {*} value - The value to format
 * @returns {string} Formatted value
 */
function formatValueForCsv(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Export all accommodation data to separate CSV files with proper foreign key relationships
 * @param {Array<Object>} accommodations - Array of accommodation objects
 * @param {Object} options - Export options
 * @param {string} [options.outputPath='./data/exports'] - Path to save the CSV files
 * @param {boolean} [options.includePhotos=true] - Whether to export photos
 * @param {boolean} [options.includeReviews=true] - Whether to export reviews
 * @param {boolean} [options.resetIdCounter=false] - Whether to reset the ID counter
 * @returns {Promise<Object>} Object with paths to created CSV files
 */
export const exportAllDataToCSV = async (accommodations, options = {}) => {
  try {
    const outputPath = options.outputPath || "./data/exports";
    const includePhotos = options.includePhotos !== false;
    const includeReviews = options.includeReviews !== false;
    const resetIdCounter = options.resetIdCounter || false;

    console.log(
      `Starting export of accommodation data to CSV (output path: ${outputPath})`,
    );

    // Reset ID counter if requested
    if (resetIdCounter) {
      idCounter = 1;
    }

    // Create a map of Google Place IDs to auto-generated place IDs
    const placeIdMap = new Map();
    let currentAutoId = idCounter;
    accommodations.forEach((accommodation) => {
      placeIdMap.set(accommodation.id, currentAutoId++);
    });

    // Export accommodations (without photos and reviews)
    const accommodationsCsvPath = await exportAccommodationsToCSV(
      accommodations,
      { outputPath, resetIdCounter },
    );

    const result = {
      accommodations: accommodationsCsvPath,
    };

    // Export photos if requested
    if (includePhotos) {
      const photosCsvPath = await exportPhotosToCSV(accommodations, {
        outputPath,
        placeIdMap,
      });
      result.photos = photosCsvPath;
    }

    // Export reviews if requested
    if (includeReviews) {
      const reviewsCsvPath = await exportReviewsToCSV(accommodations, {
        outputPath,
        placeIdMap,
      });
      result.reviews = reviewsCsvPath;
    }

    console.log("All exports completed successfully");
    console.log("Exported files:");
    console.log(JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error("Error in exportAllDataToCSV:", error);
    throw error;
  }
};

export default {
  exportAccommodationsToCSV,
  exportPhotosToCSV,
  exportReviewsToCSV,
  exportAllDataToCSV,
};
