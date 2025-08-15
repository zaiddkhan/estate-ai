import MumbaiPropertyExtractor from "./mumbaiExtractor.js";
import MumbaiAreasManager from "./mumbaiAreas.js";

// Configuration options
const EXTRACTION_OPTIONS = {
  // Extraction strategies:
  // 'all' - Extract from all areas (60+ areas)
  // 'high-priority' - Only high-priority areas (fastest, ~20 areas)
  // 'medium-priority' - High + medium priority areas (~35 areas)
  // 'south-mumbai' - Only South Mumbai areas
  // 'western-suburbs' - Only Western Suburbs
  // 'eastern-suburbs' - Only Eastern Suburbs
  // 'central-mumbai' - Only Central Mumbai
  // 'navi-mumbai' - Only Navi Mumbai
  strategy: process.env.EXTRACTION_STRATEGY || "all",

  // Performance settings
  batchSize: 3, // Number of areas to process concurrently
  delayBetweenRequests: 3000, // Delay between batches (ms)
  retryAttempts: 2, // Retry failed areas

  // Output settings
  outputDir: "./output",
};

// Command line argument parsing
function parseArguments() {
  const args = process.argv.slice(2);
  const options = { ...EXTRACTION_OPTIONS };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--strategy":
        options.strategy = args[++i];
        break;
      case "--all":
        options.strategy = "all";
        break;
      case "--south":
        options.strategy = "south-mumbai";
        break;
      case "--west":
        options.strategy = "western-suburbs";
        break;
      case "--east":
        options.strategy = "eastern-suburbs";
        break;
      case "--central":
        options.strategy = "central-mumbai";
        break;
      case "--navi":
        options.strategy = "navi-mumbai";
        break;
      case "--batch-size":
        options.batchSize = parseInt(args[++i]) || 3;
        break;
      case "--delay":
        options.delayBetweenRequests = parseInt(args[++i]) * 1000 || 3000;
        break;
      case "--help":
        showHelp();
        process.exit(0);
      default:
        break;
    }
  }

  return options;
}

// Show help message
function showHelp() {
  console.log(`
🏙️  Mumbai Property Extractor

USAGE:
  node index.js [OPTIONS]

STRATEGIES:
  --all              Extract from all Mumbai areas (60+ areas)
  --strategy high    High-priority areas only (default, ~20 areas)
  --strategy medium  High + medium priority areas (~35 areas)
  --south            South Mumbai only
  --west             Western Suburbs only
  --east             Eastern Suburbs only
  --central          Central Mumbai only
  --navi             Navi Mumbai only

OPTIONS:
  --batch-size N     Process N areas concurrently (default: 3)
  --delay N          Delay N seconds between batches (default: 3)
  --help             Show this help message

EXAMPLES:
  node index.js                        # High-priority areas
  node index.js --all                  # All Mumbai areas
  node index.js --west --batch-size 5  # Western suburbs, 5 concurrent
  node index.js --strategy south       # South Mumbai only

OUTPUT:
  All files are saved to ./output/ directory:
  - mumbai_properties_all.json         # Complete dataset
  - mumbai_properties_all.csv          # CSV format
  - mumbai_market_report.json          # Detailed analysis
  - mumbai_market_report.md            # Human-readable report
  - zone_*.json                        # Zone-specific data
  - area_*.json                        # Area-specific data
  `);
}

// Main execution function
async function main() {
  try {
    // Parse command line arguments
    const options = parseArguments();

    // Initialize areas manager to show strategy info
    const areasManager = new MumbaiAreasManager();
    const areasToProcess = areasManager.getExtractionAreas(options.strategy);

    console.log("🚀 Mumbai Property Extractor Starting...\n");
    console.log(`📋 Configuration:`);
    console.log(`   Strategy: ${options.strategy}`);
    console.log(`   Areas to process: ${areasToProcess.length}`);
    console.log(`   Batch size: ${options.batchSize}`);
    console.log(
      `   Delay between batches: ${options.delayBetweenRequests / 1000}s`,
    );
    console.log(`   Output directory: ${options.outputDir}`);

    // Show areas that will be processed
    console.log(`\n📍 Areas to be processed:`);
    areasToProcess.forEach((area, index) => {
      const details = areasManager.getAreaDetails(area);
      const icon =
        details.priority === "high"
          ? "🔥"
          : details.priority === "medium"
            ? "⭐"
            : "📍";
      console.log(`   ${icon} ${area} (${details.zone})`);
    });

    // Confirm if processing all areas
    if (options.strategy === "all" && areasToProcess.length > 40) {
      console.log(
        "\n⚠️  WARNING: You are about to extract from ALL Mumbai areas.",
      );
      console.log("   This will make 60+ requests and may take 30+ minutes.");
      console.log("   Consider using --strategy high for faster results.");

      if (process.env.NODE_ENV !== "production") {
        console.log(
          "   Press Ctrl+C to cancel, or wait 10 seconds to continue...\n",
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    // Initialize extractor with API key
    const apiKey =
      process.env.FIRECRAWL_API_KEY || "fc-94b374ced7e446ddba83c26ff4d23373";
    const extractor = new MumbaiPropertyExtractor(apiKey, options);

    console.log("\n🔍 Starting extraction...\n");

    // Start extraction
    const result = await extractor.extractAllAreas();

    if (result.success) {
      console.log("\n🎉 Extraction completed successfully!");
      console.log(`📊 Results summary:`);
      console.log(
        `   Total properties: ${result.totalProperties.toLocaleString()}`,
      );
      console.log(`   Areas processed: ${result.areasProcessed}`);
      console.log(`   Failed areas: ${result.errors}`);
      console.log(`   Duration: ${result.duration.toFixed(2)}s`);

      if (result.outputFiles.length > 0) {
        console.log(`\n📁 Output files:`);
        result.outputFiles.slice(0, 10).forEach((file) => {
          console.log(`   📄 ${file}`);
        });
        if (result.outputFiles.length > 10) {
          console.log(
            `   ... and ${result.outputFiles.length - 10} more files`,
          );
        }
      }

      console.log(`\n🔗 Next steps:`);
      console.log(
        `   📊 View detailed report: ./output/mumbai_market_report.md`,
      );
      console.log(`   📈 Analyze data: node dataAnalysis.js`);
      console.log(`   🧹 Clean data: node dataCleaner.js`);
    } else {
      console.error("\n❌ Extraction failed:", result.error);
      console.log(`📊 Partial results:`);
      console.log(`   Properties extracted: ${result.totalProperties}`);
      console.log(`   Areas processed: ${result.areasProcessed}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n💥 Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle process signals
process.on("SIGINT", () => {
  console.log("\n⚠️  Extraction interrupted by user");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Extraction terminated");
  process.exit(1);
});

// Run the extraction
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("💥 Unhandled error:", error);
    process.exit(1);
  });
}

export default main;
