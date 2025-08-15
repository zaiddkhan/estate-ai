import fs from "fs";
import S3Uploader, { uploadOutputToS3 } from "./s3Uploader.js";

class PropertyDataCleaner {
  constructor() {
    this.cleanedCount = 0;
    this.removedCount = 0;
    this.errors = [];
  }

  // Main cleaning function
  async cleanPropertyData(inputFile, outputFile = null, uploadToS3 = false) {
    try {
      console.log(`🧹 Starting data cleaning process for: ${inputFile}`);

      // Load data
      const rawData = JSON.parse(fs.readFileSync(inputFile, "utf8"));
      const properties = rawData.properties || [];

      console.log(`📊 Original dataset: ${properties.length} properties`);

      // Clean properties
      const cleanedProperties = this.processProperties(properties);

      // Update summary
      const cleanedData = {
        ...rawData,
        properties: cleanedProperties,
        cleaningReport: this.generateCleaningReport(),
        lastCleaned: new Date().toISOString(),
      };

      // Save cleaned data
      const outputPath =
        outputFile || inputFile.replace(".json", "_cleaned.json");
      fs.writeFileSync(outputPath, JSON.stringify(cleanedData, null, 2));

      console.log(`✅ Cleaning complete! Saved to: ${outputPath}`);
      console.log(`📈 Properties retained: ${this.cleanedCount}`);
      console.log(`❌ Properties removed: ${this.removedCount}`);

      let s3Result = null;

      // Upload to S3 if requested
      if (uploadToS3) {
        try {
          console.log("\n🌐 Uploading all output files to S3...");

          // Check if output directory exists and upload all files
          if (fs.existsSync("./output")) {
            s3Result = await uploadOutputToS3("./output", {
              storageClass: "STANDARD_IA",
              encryption: "AES256",
            });

            if (s3Result.success) {
              console.log(
                `✅ Batch S3 Upload successful! Location: ${s3Result.s3Location}`,
              );
              console.log(`🏷️ Version: ${s3Result.versionKey}`);
              console.log(
                `📊 Files: ${s3Result.successfulUploads}/${s3Result.totalFiles} uploaded`,
              );
              console.log(`🏠 Total Properties: ${s3Result.totalProperties}`);
            } else {
              console.error(`❌ Batch S3 Upload failed: ${s3Result.error}`);
            }
          } else {
            // Fallback to single file upload if no output directory
            console.log(
              "📁 No output directory found, uploading cleaned file only...",
            );
            const uploader = new S3Uploader();
            s3Result = await uploader.uploadWithVersioning(outputPath, {
              storageClass: "STANDARD_IA",
              encryption: "AES256",
            });

            if (s3Result.success) {
              console.log(
                `✅ S3 Upload successful! Location: ${s3Result.location}`,
              );
              console.log(
                `🏷️ Version: ${s3Result.version?.major}.${s3Result.version?.minor}.${s3Result.version?.patch}`,
              );
            } else {
              console.error(`❌ S3 Upload failed: ${s3Result.error}`);
            }
          }
        } catch (s3Error) {
          console.error(`❌ S3 Upload error: ${s3Error.message}`);
          s3Result = { success: false, error: s3Error.message };
        }
      }

      return {
        success: true,
        inputCount: properties.length,
        outputCount: cleanedProperties.length,
        cleanedCount: this.cleanedCount,
        removedCount: this.removedCount,
        outputFile: outputPath,
        s3Upload: s3Result,
      };
    } catch (error) {
      console.error("❌ Cleaning failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Process all properties
  processProperties(properties) {
    const cleaned = [];

    properties.forEach((property, index) => {
      try {
        const cleanedProperty = this.cleanSingleProperty(property, index);

        if (this.validateProperty(cleanedProperty)) {
          cleaned.push(cleanedProperty);
          this.cleanedCount++;
        } else {
          this.removedCount++;
          this.errors.push({
            index,
            title: property.title || "Unknown",
            reason: "Failed validation",
          });
        }
      } catch (error) {
        this.removedCount++;
        this.errors.push({
          index,
          title: property.title || "Unknown",
          reason: `Processing error: ${error.message}`,
        });
      }
    });

    return cleaned;
  }

  // Clean individual property
  cleanSingleProperty(property, index) {
    const cleaned = { ...property };

    // Clean title
    if (cleaned.title) {
      cleaned.title = this.cleanText(cleaned.title);
      // Remove excessive capitalization
      if (cleaned.title === cleaned.title.toUpperCase()) {
        cleaned.title = this.titleCase(cleaned.title);
      }
    }

    // Clean address
    if (cleaned.address) {
      cleaned.address = this.cleanAddress(cleaned.address);
    }

    // Clean and validate rent
    if (cleaned.rent) {
      cleaned.rent = this.cleanNumericValue(cleaned.rent);
      if (cleaned.rent < 1000 || cleaned.rent > 1000000) {
        cleaned.rent = null; // Invalid rent
      }
    }

    // Clean and validate deposit
    if (cleaned.deposit) {
      cleaned.deposit = this.cleanNumericValue(cleaned.deposit);
      if (cleaned.deposit < 1000 || cleaned.deposit > 10000000) {
        cleaned.deposit = null; // Invalid deposit
      }
    }

    // Clean and validate area
    if (cleaned.area) {
      cleaned.area = this.cleanNumericValue(cleaned.area);
      if (cleaned.area < 50 || cleaned.area > 10000) {
        cleaned.area = null; // Invalid area
      }
    }

    // Clean BHK format
    if (cleaned.bhk) {
      cleaned.bhk = this.cleanBHK(cleaned.bhk);
    }

    // Clean furnishing
    if (cleaned.furnishing) {
      cleaned.furnishing = this.cleanFurnishing(cleaned.furnishing);
    }

    // Clean preferred tenants
    if (cleaned.preferredTenants) {
      cleaned.preferredTenants = this.cleanText(cleaned.preferredTenants);
    }

    // Clean owner name
    if (cleaned.owner) {
      cleaned.owner = this.cleanOwnerName(cleaned.owner);
    }

    // Clean maintenance info
    if (cleaned.maintenance) {
      cleaned.maintenance = this.cleanText(cleaned.maintenance);
    }

    // Validate and clean URL
    if (cleaned.url) {
      cleaned.url = this.cleanURL(cleaned.url);
    }

    // Clean image URLs
    if (cleaned.images && Array.isArray(cleaned.images)) {
      cleaned.images = cleaned.images
        .map((img) => this.cleanURL(img))
        .filter((img) => img && this.isValidImageURL(img));
    }

    // Add computed fields
    if (cleaned.rent && cleaned.area) {
      cleaned.rentPerSqft = Math.round(cleaned.rent / cleaned.area);
    }

    // Add cleaning metadata
    cleaned._cleaned = {
      at: new Date().toISOString(),
      index: index,
    };

    return cleaned;
  }

  // Text cleaning utilities
  cleanText(text) {
    if (!text || typeof text !== "string") return null;

    return text
      .replace(/\s+/g, " ") // Multiple spaces to single
      .replace(/\n+/g, " ") // Newlines to spaces
      .replace(/\t+/g, " ") // Tabs to spaces
      .replace(/[^\w\s.,()-]/g, "") // Remove special chars except basic punctuation
      .trim();
  }

  // Clean address specifically
  cleanAddress(address) {
    if (!address) return null;

    let cleaned = this.cleanText(address);

    // Remove common address artifacts
    cleaned = cleaned
      .replace(/\[.*?\]\(.*?\)/g, "") // Remove markdown links
      .replace(/Mumbai,\s*Maharashtra.*$/i, "Mumbai, Maharashtra")
      .replace(/,\s*INDIA.*$/i, "")
      .replace(/,\s*India.*$/i, "")
      .replace(/\s*400\d{3}.*$/g, "") // Remove pin codes and after
      .trim();

    return cleaned || null;
  }

  // Clean BHK format
  cleanBHK(bhk) {
    if (!bhk) return null;

    const cleaned = bhk.toString().toUpperCase().trim();

    // Standardize format
    if (cleaned.includes("1") && cleaned.includes("RK")) return "1 RK";
    if (cleaned.includes("1") && cleaned.includes("BHK")) return "1 BHK";
    if (cleaned.includes("2") && cleaned.includes("BHK")) return "2 BHK";
    if (cleaned.includes("3") && cleaned.includes("BHK")) return "3 BHK";
    if (cleaned.includes("4") && cleaned.includes("BHK")) return "4 BHK";
    if (cleaned.includes("5") && cleaned.includes("BHK")) return "5 BHK";

    return cleaned;
  }

  // Clean furnishing status
  cleanFurnishing(furnishing) {
    if (!furnishing) return null;

    const cleaned = furnishing.toString().toLowerCase().trim();

    if (cleaned.includes("fully") || cleaned.includes("full"))
      return "Fully Furnished";
    if (cleaned.includes("semi")) return "Semi Furnished";
    if (cleaned.includes("unfurnished") || cleaned.includes("bare"))
      return "Unfurnished";

    return this.titleCase(furnishing);
  }

  // Clean owner name
  cleanOwnerName(owner) {
    if (!owner) return null;

    let cleaned = this.cleanText(owner);

    // Remove common artifacts
    cleaned = cleaned.replace(/\d+/g, "").trim();

    // Validate it looks like a name
    if (cleaned.length < 3 || cleaned.length > 50) return null;
    if (cleaned.split(" ").length > 5) return null; // Too many parts

    return this.titleCase(cleaned);
  }

  // Clean numeric values
  cleanNumericValue(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.]/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  // Clean URLs
  cleanURL(url) {
    if (!url || typeof url !== "string") return null;

    url = url.trim();

    // Must be a valid URL format
    if (!url.startsWith("http")) return null;
    if (url.length > 500) return null; // Too long

    return url;
  }

  // Validate image URLs
  isValidImageURL(url) {
    if (!url) return false;
    return (
      url.includes("nobroker.in") &&
      (url.includes(".jpg") || url.includes(".png") || url.includes(".jpeg"))
    );
  }

  // Convert to title case
  titleCase(str) {
    if (!str) return null;

    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Validate cleaned property
  validateProperty(property) {
    // Must have essential fields
    if (!property.title || property.title.length < 10) return false;
    if (!property.rent || property.rent <= 0) return false;
    if (!property.address || property.address.length < 10) return false;

    // Rent should be reasonable for Mumbai
    if (property.rent < 5000 || property.rent > 500000) return false;

    // Area should be reasonable if provided
    if (property.area && (property.area < 100 || property.area > 5000))
      return false;

    return true;
  }

  // Generate cleaning report
  generateCleaningReport() {
    return {
      totalProcessed: this.cleanedCount + this.removedCount,
      cleaned: this.cleanedCount,
      removed: this.removedCount,
      successRate: Math.round(
        (this.cleanedCount / (this.cleanedCount + this.removedCount)) * 100,
      ),
      errors: this.errors.slice(0, 10), // First 10 errors
      cleaningRules: [
        "Removed properties with invalid rent (< ₹5,000 or > ₹5,00,000)",
        "Removed properties with invalid area (< 100 or > 5,000 sqft)",
        "Standardized BHK formats (1 RK, 1 BHK, 2 BHK, etc.)",
        "Cleaned address formatting and removed artifacts",
        "Standardized furnishing categories",
        "Validated and cleaned URLs",
        "Added computed rent per sqft field",
        "Removed properties with insufficient data",
      ],
    };
  }

  // Deduplicate properties
  deduplicateProperties(properties) {
    const seen = new Set();
    const unique = [];

    properties.forEach((property) => {
      // Create a hash based on title, rent, and area
      const hash = `${property.title}-${property.rent}-${property.area}`;

      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(property);
      }
    });

    console.log(
      `🔍 Deduplication: ${properties.length - unique.length} duplicates removed`,
    );
    return unique;
  }

  // Quality score for properties
  calculateQualityScore(property) {
    let score = 0;
    const maxScore = 100;

    // Essential fields (40 points)
    if (property.title) score += 10;
    if (property.rent) score += 10;
    if (property.address) score += 10;
    if (property.area) score += 10;

    // Additional fields (30 points)
    if (property.bhk) score += 10;
    if (property.furnishing) score += 10;
    if (property.owner) score += 10;

    // Quality indicators (30 points)
    if (property.images && property.images.length > 0) score += 10;
    if (property.url && property.url.includes("detail")) score += 10;
    if (property.deposit) score += 10;

    property._qualityScore = score;
    return score;
  }

  // Filter properties by quality threshold
  filterByQuality(properties, minScore = 70) {
    return properties.filter((property) => {
      const score = this.calculateQualityScore(property);
      return score >= minScore;
    });
  }
}

// Usage example and main execution
async function main() {
  const cleaner = new PropertyDataCleaner();

  // Check if S3 upload is requested
  const uploadToS3 =
    process.argv.includes("--upload-s3") || process.argv.includes("-s3");

  // Clean the main property file
  const result = await cleaner.cleanPropertyData(
    "mumbai_properties.json",
    null,
    uploadToS3,
  );

  if (result.success) {
    console.log("\n🎉 Data cleaning completed successfully!");
    console.log(
      `📊 Summary: ${result.cleanedCount}/${result.inputCount} properties retained`,
    );

    // S3 upload summary
    if (result.s3Upload) {
      if (result.s3Upload.success) {
        console.log(`☁️ S3 Upload: ✅ Success`);
        if (result.s3Upload.s3Location) {
          // Batch upload
          console.log(`📍 S3 Location: ${result.s3Upload.s3Location}`);
          console.log(`🏷️ Version: ${result.s3Upload.versionKey}`);
          console.log(
            `📊 Files Uploaded: ${result.s3Upload.successfulUploads}/${result.s3Upload.totalFiles}`,
          );
        } else {
          // Single file upload
          console.log(`📍 S3 Location: ${result.s3Upload.location}`);
        }
      } else {
        console.log(`☁️ S3 Upload: ❌ Failed - ${result.s3Upload.error}`);
      }
    }

    // Load cleaned data and show quality distribution
    const cleanedData = JSON.parse(fs.readFileSync(result.outputFile, "utf8"));
    const qualityDistribution = {};

    cleanedData.properties.forEach((property) => {
      const score = cleaner.calculateQualityScore(property);
      const tier =
        score >= 90
          ? "Excellent"
          : score >= 80
            ? "Good"
            : score >= 70
              ? "Fair"
              : "Poor";
      qualityDistribution[tier] = (qualityDistribution[tier] || 0) + 1;
    });

    console.log("\n📈 Quality Distribution:");
    Object.entries(qualityDistribution).forEach(([tier, count]) => {
      console.log(`   ${tier}: ${count} properties`);
    });
  } else {
    console.error("❌ Data cleaning failed:", result.error);
  }
}

export default PropertyDataCleaner;

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
