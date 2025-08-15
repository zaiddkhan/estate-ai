import S3Uploader from "./s3Uploader.js";
import fs from "fs";

class S3IntegrationTest {
  constructor() {
    this.testResults = [];
    this.uploader = null;
  }

  async runAllTests() {
    console.log("🧪 Starting S3 Integration Tests\n");

    try {
      // Initialize S3 uploader
      this.uploader = new S3Uploader();

      // Run tests
      await this.testConnection();
      await this.testFileValidation();
      await this.testUpload();
      await this.testVersioning();
      await this.testBatchUpload();
      await this.testListVersions();

      // Show results
      this.showResults();
    } catch (error) {
      console.error("❌ Test suite failed:", error.message);
      process.exit(1);
    }
  }

  async testConnection() {
    console.log("🔍 Test 1: S3 Connection");

    try {
      const result = await this.uploader.testConnection();

      if (result.success) {
        console.log("✅ S3 connection successful");
        this.testResults.push({ test: "Connection", status: "PASS" });
      } else {
        console.log("❌ S3 connection failed:", result.error);
        this.testResults.push({
          test: "Connection",
          status: "FAIL",
          error: result.error,
        });
      }
    } catch (error) {
      console.log("❌ Connection test error:", error.message);
      this.testResults.push({
        test: "Connection",
        status: "ERROR",
        error: error.message,
      });
    }

    console.log("");
  }

  async testFileValidation() {
    console.log("📝 Test 2: File Validation");

    try {
      // Test with non-existent file
      const result1 = await this.uploader.uploadCleanedData(
        "non-existent-file.json",
      );

      if (!result1.success && result1.error.includes("File not found")) {
        console.log("✅ Non-existent file validation works");
        this.testResults.push({ test: "File Validation", status: "PASS" });
      } else {
        console.log("❌ File validation failed");
        this.testResults.push({ test: "File Validation", status: "FAIL" });
      }
    } catch (error) {
      console.log("❌ File validation test error:", error.message);
      this.testResults.push({
        test: "File Validation",
        status: "ERROR",
        error: error.message,
      });
    }

    console.log("");
  }

  async testUpload() {
    console.log("📤 Test 3: File Upload");

    try {
      // Create a test file
      const testData = {
        properties: [
          {
            title: "Test Property 1",
            rent: 25000,
            address: "Test Address, Mumbai",
            area: 800,
            bhk: "2 BHK",
          },
          {
            title: "Test Property 2",
            rent: 35000,
            address: "Another Test Address, Mumbai",
            area: 1200,
            bhk: "3 BHK",
          },
        ],
        lastCleaned: new Date().toISOString(),
        testRun: true,
      };

      const testFile = "test_properties.json";
      fs.writeFileSync(testFile, JSON.stringify(testData, null, 2));

      // Upload test file
      const result = await this.uploader.uploadCleanedData(testFile, {
        key: "test/test_properties_" + Date.now() + ".json",
      });

      if (result.success) {
        console.log("✅ File upload successful");
        console.log(`   Location: ${result.location}`);
        console.log(`   Properties: ${result.propertyCount}`);
        this.testResults.push({
          test: "Upload",
          status: "PASS",
          location: result.location,
        });
      } else {
        console.log("❌ File upload failed:", result.error);
        this.testResults.push({
          test: "Upload",
          status: "FAIL",
          error: result.error,
        });
      }

      // Clean up test file
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    } catch (error) {
      console.log("❌ Upload test error:", error.message);
      this.testResults.push({
        test: "Upload",
        status: "ERROR",
        error: error.message,
      });
    }

    console.log("");
  }

  async testVersioning() {
    console.log("🏷️  Test 4: Versioning");

    try {
      // Create a test file with version info
      const versionedData = {
        properties: [
          {
            title: "Versioned Test Property",
            rent: 30000,
            address: "Versioned Test Address, Mumbai",
            area: 1000,
            bhk: "2 BHK",
          },
        ],
        lastCleaned: new Date().toISOString(),
        testRun: true,
        versionTest: true,
      };

      const testFile = "test_versioned_properties.json";
      fs.writeFileSync(testFile, JSON.stringify(versionedData, null, 2));

      // Upload with versioning
      const result = await this.uploader.uploadWithVersioning(testFile);

      if (result.success && result.version) {
        console.log("✅ Versioned upload successful");
        console.log(
          `   Version: ${result.version.major}.${result.version.minor}.${result.version.patch}`,
        );
        console.log(`   Location: ${result.location}`);
        this.testResults.push({
          test: "Versioning",
          status: "PASS",
          version: `${result.version.major}.${result.version.minor}.${result.version.patch}`,
        });
      } else {
        console.log("❌ Versioned upload failed:", result.error);
        this.testResults.push({
          test: "Versioning",
          status: "FAIL",
          error: result.error,
        });
      }

      // Clean up test file
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    } catch (error) {
      console.log("❌ Versioning test error:", error.message);
      this.testResults.push({
        test: "Versioning",
        status: "ERROR",
        error: error.message,
      });
    }

    console.log("");
  }

  async testBatchUpload() {
    console.log("📦 Test 5: Batch Upload");

    try {
      // Create a test output directory
      const testOutputDir = "./test_output";
      if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir);
      }

      // Create multiple test files
      const testFiles = [
        {
          name: "area_test_1.json",
          data: {
            properties: [
              {
                title: "Test Property 1",
                rent: 20000,
                address: "Test Area 1, Mumbai",
              },
            ],
            area: "Test Area 1",
            testRun: true,
          },
        },
        {
          name: "area_test_2.json",
          data: {
            properties: [
              {
                title: "Test Property 2",
                rent: 25000,
                address: "Test Area 2, Mumbai",
              },
              {
                title: "Test Property 3",
                rent: 30000,
                address: "Test Area 2, Mumbai",
              },
            ],
            area: "Test Area 2",
            testRun: true,
          },
        },
        {
          name: "test_report.json",
          data: {
            summary: "Test market report",
            totalProperties: 3,
            testRun: true,
          },
        },
      ];

      // Write test files
      testFiles.forEach((file) => {
        const filePath = `${testOutputDir}/${file.name}`;
        fs.writeFileSync(filePath, JSON.stringify(file.data, null, 2));
      });

      // Test batch upload
      const result = await this.uploader.uploadOutputDirectory(testOutputDir, {
        storageClass: "STANDARD",
        encryption: "AES256",
      });

      if (result.success) {
        console.log("✅ Batch upload successful");
        console.log(`   Version: ${result.versionKey}`);
        console.log(
          `   Files: ${result.successfulUploads}/${result.totalFiles}`,
        );
        console.log(`   Properties: ${result.totalProperties}`);
        console.log(`   Location: ${result.s3Location}`);
        this.testResults.push({
          test: "Batch Upload",
          status: "PASS",
          version: result.versionKey,
          files: `${result.successfulUploads}/${result.totalFiles}`,
        });
      } else {
        console.log("❌ Batch upload failed:", result.error);
        this.testResults.push({
          test: "Batch Upload",
          status: "FAIL",
          error: result.error,
        });
      }

      // Clean up test files
      testFiles.forEach((file) => {
        const filePath = `${testOutputDir}/${file.name}`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      if (fs.existsSync(testOutputDir)) {
        fs.rmdirSync(testOutputDir);
      }
    } catch (error) {
      console.log("❌ Batch upload test error:", error.message);
      this.testResults.push({
        test: "Batch Upload",
        status: "ERROR",
        error: error.message,
      });
    }

    console.log("");
  }

  async testListVersions() {
    console.log("📋 Test 6: List Versions");

    try {
      const versions = await this.uploader.listVersions();

      if (Array.isArray(versions)) {
        console.log(
          `✅ Version listing successful - Found ${versions.length} versions`,
        );

        if (versions.length > 0) {
          console.log("   Latest versions:");
          versions.slice(0, 3).forEach((v) => {
            console.log(
              `   - v${v.version.major}.${v.version.minor}.${v.version.patch} (${v.size} bytes)`,
            );
          });
        }

        this.testResults.push({
          test: "List Versions",
          status: "PASS",
          count: versions.length,
        });
      } else {
        console.log("❌ Version listing failed - Invalid response");
        this.testResults.push({ test: "List Versions", status: "FAIL" });
      }
    } catch (error) {
      console.log("❌ List versions test error:", error.message);
      this.testResults.push({
        test: "List Versions",
        status: "ERROR",
        error: error.message,
      });
    }

    console.log("");
  }

  showResults() {
    console.log("📊 Test Results Summary");
    console.log("=".repeat(50));

    let passCount = 0;
    let failCount = 0;
    let errorCount = 0;

    this.testResults.forEach((result) => {
      const status =
        result.status === "PASS"
          ? "✅"
          : result.status === "FAIL"
            ? "❌"
            : "⚠️";

      console.log(`${status} ${result.test}: ${result.status}`);

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.location) {
        console.log(`   Location: ${result.location}`);
      }
      if (result.version) {
        console.log(`   Version: ${result.version}`);
      }
      if (result.count !== undefined) {
        console.log(`   Count: ${result.count}`);
      }
      if (result.version) {
        console.log(`   Version: ${result.version}`);
      }
      if (result.files) {
        console.log(`   Files: ${result.files}`);
      }

      if (result.status === "PASS") passCount++;
      else if (result.status === "FAIL") failCount++;
      else errorCount++;
    });

    console.log("=".repeat(50));
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Errors: ${errorCount}`);

    const successRate = Math.round((passCount / this.testResults.length) * 100);
    console.log(`Success Rate: ${successRate}%`);

    if (failCount > 0 || errorCount > 0) {
      console.log("\n🔧 Troubleshooting Tips:");
      console.log("1. Check your AWS credentials in .env file");
      console.log("2. Verify S3 bucket name and permissions");
      console.log("3. Ensure AWS region is correct");
      console.log("4. Review IAM policy permissions");
      console.log("5. Check network connectivity");
    }

    console.log("\n🎉 S3 Integration Test Complete!");

    // Exit with error code if tests failed
    if (failCount > 0 || errorCount > 0) {
      process.exit(1);
    }
  }

  // Utility method for manual testing
  static async quickTest() {
    console.log("🚀 Quick S3 Test");

    try {
      const uploader = new S3Uploader();
      const connectionTest = await uploader.testConnection();

      if (connectionTest.success) {
        console.log("✅ S3 is configured correctly!");
        console.log('💡 Run "npm run test:s3:full" for complete tests');
        return true;
      } else {
        console.log("❌ S3 configuration issue:", connectionTest.error);
        console.log("💡 Check your .env file and AWS credentials");
        return false;
      }
    } catch (error) {
      console.log("❌ S3 test failed:", error.message);
      return false;
    }
  }
}

// Export for use as module
export default S3IntegrationTest;

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const testMode = process.argv[2];

  if (testMode === "--quick" || testMode === "-q") {
    // Quick test mode
    S3IntegrationTest.quickTest()
      .then((success) => {
        process.exit(success ? 0 : 1);
      })
      .catch((error) => {
        console.error("❌ Quick test failed:", error.message);
        process.exit(1);
      });
  } else {
    // Full test suite
    const tester = new S3IntegrationTest();
    tester.runAllTests().catch((error) => {
      console.error("❌ Test suite failed:", error.message);
      process.exit(1);
    });
  }
}
