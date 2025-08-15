import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

class S3Uploader {
  constructor(config = {}) {
    // Configure AWS SDK
    this.s3 = new AWS.S3({
      accessKeyId: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey:
        config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      region: config.region || process.env.AWS_REGION || "us-east-1",
    });

    this.bucketName = process.env.S3_BUCKET_NAME;
    this.keyPrefix = config.keyPrefix || "housing-data/";

    if (!this.bucketName) {
      throw new Error(
        "S3 bucket name is required. Set S3_BUCKET_NAME environment variable or pass bucketName in config.",
      );
    }

    console.log(`🪣 S3 Uploader initialized for bucket: ${this.bucketName}`);
  }

  /**
   * Upload cleaned property data to S3
   * @param {string} filePath - Local file path to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadCleanedData(filePath, options = {}) {
    try {
      console.log(`📤 Starting upload to S3: ${filePath}`);

      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read and validate JSON
      const fileContent = fs.readFileSync(filePath, "utf8");
      let data;

      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON file: ${parseError.message}`);
      }

      // Generate S3 key
      const fileName = path.basename(filePath, ".json");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const s3Key =
        options.key || `${this.keyPrefix}${fileName}_${timestamp}.json`;

      // Prepare metadata
      const metadata = {
        "upload-date": new Date().toISOString(),
        "original-filename": path.basename(filePath),
        "property-count": data.properties
          ? data.properties.length.toString()
          : "0",
        "data-version": data.version || "1.0",
        "cleaned-at": data.lastCleaned || new Date().toISOString(),
      };

      // Upload parameters
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: JSON.stringify(data, null, options.compact ? 0 : 2),
        ContentType: "application/json",
        Metadata: metadata,
        ServerSideEncryption: options.encryption || "AES256",
        StorageClass: options.storageClass || "STANDARD",
      };

      // Add public read if requested
      if (options.publicRead) {
        uploadParams.ACL = "public-read";
      }

      // Perform upload
      const result = await this.s3.upload(uploadParams).promise();

      return {
        success: true,
        location: result.Location,
        bucket: result.Bucket,
        key: result.Key,
        etag: result.ETag,
        propertyCount: data.properties?.length || 0,
        uploadedAt: new Date().toISOString(),
        fileSize: Buffer.byteLength(fileContent, "utf8"),
        metadata,
      };
    } catch (error) {
      console.error("❌ S3 upload failed:", error.message);

      return {
        success: false,
        error: error.message,
        code: error.code || "UNKNOWN_ERROR",
      };
    }
  }

  /**
   * Upload multiple property files to S3 with the same version
   * @param {Array<string>} filePaths - Array of file paths to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Batch upload results with version info
   */
  async uploadMultipleFiles(filePaths, options = {}) {
    try {
      console.log(
        `📤 Starting batch upload of ${filePaths.length} files to S3...`,
      );

      // Generate shared version info
      const version = await this.generateVersionInfo(filePaths);
      const versionKey = `v${version.major}.${version.minor}.${version.patch}`;

      console.log(`🏷️  Batch Version: ${versionKey}`);

      const results = [];
      let totalProperties = 0;
      let successCount = 0;

      for (const filePath of filePaths) {
        try {
          const fileName = path.basename(filePath, ".json");
          const s3Key = `${this.keyPrefix}versions/${versionKey}/${fileName}.json`;

          console.log(`📄 Uploading: ${fileName}...`);

          // Read file and count properties if applicable
          let fileContent;
          let propertyCount = 0;

          try {
            fileContent = fs.readFileSync(filePath, "utf8");
            if (fileName.endsWith(".json")) {
              const data = JSON.parse(fileContent);
              propertyCount = data.properties?.length || 0;
              totalProperties += propertyCount;
            }
          } catch (parseError) {
            // For non-JSON files or parsing errors, continue with raw content
            fileContent = fs.readFileSync(filePath, "utf8");
          }

          // Prepare metadata
          const metadata = {
            "batch-version": versionKey,
            "upload-date": version.timestamp,
            "property-count": propertyCount.toString(),
            "file-type": path.extname(filePath).substring(1) || "json",
            "batch-upload": "true",
          };

          // Upload parameters
          const uploadParams = {
            Bucket: this.bucketName,
            Key: s3Key,
            Body: fileContent,
            ContentType: fileName.endsWith(".json")
              ? "application/json"
              : "text/plain",
            Metadata: metadata,
            ServerSideEncryption: options.encryption || "AES256",
            StorageClass: options.storageClass || "STANDARD_IA",
          };

          // Perform upload
          const result = await this.s3.upload(uploadParams).promise();

          results.push({
            fileName: fileName,
            filePath: filePath,
            success: true,
            location: result.Location,
            key: result.Key,
            etag: result.ETag,
            propertyCount: propertyCount,
            fileSize: Buffer.byteLength(fileContent, "utf8"),
          });

          successCount++;
          console.log(
            `✅ ${fileName} uploaded successfully (${propertyCount} properties)`,
          );
        } catch (fileError) {
          console.error(
            `❌ Failed to upload ${path.basename(filePath)}: ${fileError.message}`,
          );

          results.push({
            fileName: path.basename(filePath),
            filePath: filePath,
            success: false,
            error: fileError.message,
          });
        }
      }

      console.log(
        `📊 Batch Upload Summary: ${successCount}/${filePaths.length} files uploaded successfully`,
      );
      console.log(`🏠 Total Properties: ${totalProperties}`);

      return {
        success: successCount > 0,
        version: version,
        versionKey: versionKey,
        totalFiles: filePaths.length,
        successfulUploads: successCount,
        failedUploads: filePaths.length - successCount,
        totalProperties: totalProperties,
        uploadedAt: new Date().toISOString(),
        results: results,
        s3Location: `s3://${this.bucketName}/${this.keyPrefix}versions/${versionKey}/`,
      };
    } catch (error) {
      console.error("❌ Batch upload failed:", error.message);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  }

  /**
   * Create a backup of existing data before uploading new data
   * @param {string} filePath - File to backup and upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Backup and upload results
   */
  async backupAndUpload(filePath, options = {}) {
    const results = { backup: null, current: null };

    try {
      // First, try to backup existing current version
      const currentKey = `${this.keyPrefix}current/mumbai_properties_current.json`;
      const backupKey = `${this.keyPrefix}backups/mumbai_properties_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      try {
        // Check if current version exists
        await this.s3
          .headObject({ Bucket: this.bucketName, Key: currentKey })
          .promise();

        // Copy current to backup
        await this.s3
          .copyObject({
            Bucket: this.bucketName,
            CopySource: `${this.bucketName}/${currentKey}`,
            Key: backupKey,
          })
          .promise();

        results.backup = { success: true, key: backupKey };
        console.log(`💾 Backup created: ${backupKey}`);
      } catch (backupError) {
        if (backupError.code !== "NotFound") {
          console.warn("⚠️ Backup failed:", backupError.message);
        }
        results.backup = { success: false, error: backupError.message };
      }

      // Upload new current version
      results.current = await this.uploadCleanedData(filePath, {
        ...options,
        key: currentKey,
      });

      return results;
    } catch (error) {
      console.error("❌ Backup and upload failed:", error.message);
      return {
        backup: { success: false, error: error.message },
        current: { success: false, error: error.message },
      };
    }
  }

  /**
   * Upload with automatic versioning
   * @param {string} filePath - File to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with versioning info
   */
  async uploadWithVersioning(filePath, options = {}) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

      // Generate version info
      const version = await this.generateVersionInfo([filePath]);

      // Add version to data
      const versionedData = {
        ...data,
        version: version,
      };

      // Upload with version in key
      const versionKey = `${this.keyPrefix}versions/v${version.major}.${version.minor}.${version.patch}/mumbai_properties.json`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: versionKey,
        Body: JSON.stringify(versionedData, null, 2),
        ContentType: "application/json",
        Metadata: {
          version: `${version.major}.${version.minor}.${version.patch}`,
          "property-count": version.propertyCount.toString(),
          "data-hash": version.dataHash,
          "upload-date": version.timestamp,
        },
      };

      const result = await this.s3.upload(uploadParams).promise();

      console.log(
        `✅ Versioned upload successful! Version: ${version.major}.${version.minor}.${version.patch}`,
      );

      return {
        success: true,
        version: version,
        location: result.Location,
        key: result.Key,
        etag: result.ETag,
      };
    } catch (error) {
      console.error("❌ Versioned upload failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload all files from output directory with same version
   * @param {string} outputDir - Output directory path
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Batch upload results
   */
  async uploadOutputDirectory(outputDir = "./output", options = {}) {
    try {
      console.log(`📁 Scanning output directory: ${outputDir}`);

      // Check if output directory exists
      if (!fs.existsSync(outputDir)) {
        throw new Error(`Output directory not found: ${outputDir}`);
      }

      // Get all JSON and other relevant files
      const files = fs.readdirSync(outputDir);
      const filesToUpload = files
        .filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return ext === ".json" || ext === ".csv" || ext === ".md";
        })
        .map((file) => path.join(outputDir, file));

      if (filesToUpload.length === 0) {
        console.log("⚠️ No files found to upload in output directory");
        return {
          success: false,
          error: "No uploadable files found in output directory",
        };
      }

      console.log(`📋 Found ${filesToUpload.length} files to upload:`);
      filesToUpload.forEach((file) => {
        console.log(`   📄 ${path.basename(file)}`);
      });

      // Upload all files with same version
      const result = await this.uploadMultipleFiles(filesToUpload, options);

      if (result.success) {
        console.log(`\n🎉 Output directory upload complete!`);
        console.log(`📍 S3 Location: ${result.s3Location}`);
        console.log(`🏷️  Version: ${result.versionKey}`);
        console.log(
          `📊 Files: ${result.successfulUploads}/${result.totalFiles} uploaded`,
        );
        console.log(`🏠 Total Properties: ${result.totalProperties}`);
      }

      return result;
    } catch (error) {
      console.error("❌ Output directory upload failed:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * List existing versions in S3
   * @returns {Promise<Array>} List of versions
   */
  async listVersions() {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: `${this.keyPrefix}versions/`,
      };

      const response = await this.s3.listObjectsV2(params).promise();

      const versions = response.Contents.filter((obj) =>
        obj.Key.endsWith(".json"),
      )
        .map((obj) => {
          const keyParts = obj.Key.split("/");
          const versionPart = keyParts.find((part) => part.startsWith("v"));
          const versionNumbers = versionPart?.substring(1).split(".") || [
            "0",
            "0",
            "0",
          ];

          return {
            key: obj.Key,
            lastModified: obj.LastModified,
            size: obj.Size,
            version: {
              major: parseInt(versionNumbers[0]),
              minor: parseInt(versionNumbers[1]),
              patch: parseInt(versionNumbers[2]),
            },
          };
        })
        .sort((a, b) => {
          // Sort by version (descending)
          if (a.version.major !== b.version.major)
            return b.version.major - a.version.major;
          if (a.version.minor !== b.version.minor)
            return b.version.minor - a.version.minor;
          return b.version.patch - a.version.patch;
        });

      return versions;
    } catch (error) {
      console.error("❌ Failed to list versions:", error.message);
      return [];
    }
  }

  /**
   * Generate version info for files
   * @param {Array<string>} filePaths - Array of file paths
   * @returns {Promise<Object>} Version information
   */
  async generateVersionInfo(filePaths) {
    try {
      // Calculate total properties across all JSON files
      let totalProperties = 0;
      let allPropertiesData = [];

      for (const filePath of filePaths) {
        try {
          if (filePath.endsWith(".json")) {
            const fileContent = fs.readFileSync(filePath, "utf8");
            const data = JSON.parse(fileContent);
            const properties = data.properties || [];
            totalProperties += properties.length;
            allPropertiesData = allPropertiesData.concat(properties);
          }
        } catch (parseError) {
          // Skip files that can't be parsed as JSON
          continue;
        }
      }

      // Generate version info
      const version = {
        major: 1,
        minor: 0,
        patch: 0,
        timestamp: new Date().toISOString(),
        propertyCount: totalProperties,
        filesCount: filePaths.length,
        dataHash: await this.generateDataHash({
          properties: allPropertiesData,
        }),
      };

      // Check for existing versions to increment
      try {
        const existingVersions = await this.listVersions();
        if (existingVersions.length > 0) {
          const latest = existingVersions[0];
          version.minor = latest.version.minor + 1;
        }
      } catch (listError) {
        console.warn(
          "⚠️ Could not check existing versions:",
          listError.message,
        );
      }

      return version;
    } catch (error) {
      console.warn("⚠️ Error generating version info:", error.message);
      // Return default version on error
      return {
        major: 1,
        minor: 0,
        patch: 0,
        timestamp: new Date().toISOString(),
        propertyCount: 0,
        filesCount: filePaths.length,
        dataHash: "unknown",
      };
    }
  }

  /**
   * Generate a simple hash for data comparison
   * @param {Object} data - Data to hash
   * @returns {Promise<string>} Hash string
   */
  async generateDataHash(data) {
    const crypto = await import("crypto");
    const content = JSON.stringify(data.properties || []);
    return crypto
      .createHash("md5")
      .update(content)
      .digest("hex")
      .substring(0, 8);
  }

  /**
   * Test S3 connection and bucket access
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      console.log("🔍 Testing S3 connection...");

      // Test bucket access
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      console.log("✅ S3 bucket accessible");

      // Test list permissions
      await this.s3
        .listObjectsV2({
          Bucket: this.bucketName,
          Prefix: this.keyPrefix,
          MaxKeys: 1,
        })
        .promise();
      console.log("✅ S3 list permissions OK");

      return { success: true, message: "S3 connection successful" };
    } catch (error) {
      console.error("❌ S3 connection test failed:", error);

      let suggestion = "";
      if (error.code === "NoSuchBucket") {
        suggestion = "Bucket does not exist or incorrect name.";
      } else if (error.code === "AccessDenied") {
        suggestion = "Check AWS credentials and bucket permissions.";
      } else if (error.code === "CredentialsError") {
        suggestion = "AWS credentials not found or invalid.";
      }

      return {
        success: false,
        error: error.message,
        code: error.code,
        suggestion,
      };
    }
  }
}

/**
 * Utility function to upload cleaned data with default configuration
 * @param {string} filePath - Path to cleaned JSON file
 * @param {Object} config - S3 configuration
 * @returns {Promise<Object>} Upload result
 */
export async function uploadToS3(
  filePath = "mumbai_properties_cleaned.json",
  config = {},
) {
  const uploader = new S3Uploader(config);

  // Test connection first
  const connectionTest = await uploader.testConnection();
  if (!connectionTest.success) {
    return connectionTest;
  }

  // Upload with versioning
  return await uploader.uploadWithVersioning(filePath, {
    storageClass: "STANDARD_IA", // Cheaper storage for archival
    encryption: "AES256",
  });
}

/**
 * Utility function to upload entire output directory
 * @param {string} outputDir - Output directory path
 * @param {Object} config - S3 configuration
 * @returns {Promise<Object>} Batch upload result
 */
export async function uploadOutputToS3(outputDir = "./output", config = {}) {
  const uploader = new S3Uploader(config);

  // Test connection first
  const connectionTest = await uploader.testConnection();
  if (!connectionTest.success) {
    return connectionTest;
  }

  // Upload entire output directory
  return await uploader.uploadOutputDirectory(outputDir, {
    storageClass: "STANDARD_IA", // Cheaper storage for archival
    encryption: "AES256",
  });
}

export default S3Uploader;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  const target = process.argv[3];

  console.log("🚀 S3 Uploader - Housing Data");

  if (mode === "--output-dir" || mode === "-d") {
    // Upload entire output directory
    const outputDir = target || "./output";
    console.log(`📁 Output Directory: ${outputDir}`);

    uploadOutputToS3(outputDir)
      .then((result) => {
        if (result.success) {
          console.log("\n🎉 Batch upload completed successfully!");
          console.log(`📍 S3 Location: ${result.s3Location}`);
          console.log(`🏷️ Version: ${result.versionKey}`);
          console.log(
            `📊 Files: ${result.successfulUploads}/${result.totalFiles} uploaded`,
          );
          console.log(`🏠 Total Properties: ${result.totalProperties}`);
        } else {
          console.error("\n❌ Batch upload failed:", result.error);
          process.exit(1);
        }
      })
      .catch((error) => {
        console.error("❌ Unexpected error:", error.message);
        process.exit(1);
      });
  } else {
    // Upload single file (default behavior)
    const filePath = mode || "mumbai_properties_cleaned.json";
    console.log(`📁 File: ${filePath}`);

    uploadToS3(filePath)
      .then((result) => {
        if (result.success) {
          console.log("\n🎉 Upload completed successfully!");
          console.log(`📍 Location: ${result.location}`);
          console.log(
            `🏷️ Version: ${result.version?.major}.${result.version?.minor}.${result.version?.patch}`,
          );
        } else {
          console.error("\n❌ Upload failed:", result.error);
          if (result.suggestion) {
            console.log("💡 Suggestion:", result.suggestion);
          }
          process.exit(1);
        }
      })
      .catch((error) => {
        console.error("❌ Unexpected error:", error.message);
        process.exit(1);
      });
  }
}
