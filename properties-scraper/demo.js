import MumbaiPropertyExtractor from "./mumbaiExtractor.js";
import MumbaiAreasManager from "./mumbaiAreas.js";

// Demo script to showcase Mumbai Property Extractor capabilities
async function runDemo() {
    console.log('🚀 Mumbai Property Extractor - DEMO');
    console.log('=' .repeat(50));

    // Initialize areas manager
    const areasManager = new MumbaiAreasManager();

    // Show system capabilities
    console.log('\n📊 SYSTEM OVERVIEW:');
    console.log(`✅ Total Mumbai Areas Covered: ${areasManager.getAllAreas().length}`);

    const summary = areasManager.getSummary();
    console.log('\n🌍 Zone Coverage:');
    Object.entries(summary.byZone).forEach(([zone, count]) => {
        console.log(`   ${zone}: ${count} areas`);
    });

    console.log('\n🎯 Priority Levels:');
    Object.entries(summary.byPriority).forEach(([priority, count]) => {
        const icon = priority === 'high' ? '🔥' : priority === 'medium' ? '⭐' : '📍';
        console.log(`   ${icon} ${priority.toUpperCase()}: ${count} areas`);
    });

    // Show sample areas by zone
    console.log('\n📍 SAMPLE AREAS BY ZONE:');

    console.log('\n🏙️ South Mumbai (Premium):');
    areasManager.getAreasByZone('South Mumbai').slice(0, 4).forEach(area => {
        const details = areasManager.getAreaDetails(area);
        console.log(`   🔥 ${area} (${details.priority} priority)`);
    });

    console.log('\n🌊 Western Suburbs (Popular):');
    areasManager.getAreasByZone('Western Suburbs').slice(0, 5).forEach(area => {
        const details = areasManager.getAreaDetails(area);
        const icon = details.priority === 'high' ? '🔥' : details.priority === 'medium' ? '⭐' : '📍';
        console.log(`   ${icon} ${area} (${details.priority} priority)`);
    });

    console.log('\n🏗️ Eastern Suburbs (Tech Hubs):');
    areasManager.getAreasByZone('Eastern Suburbs').slice(0, 4).forEach(area => {
        const details = areasManager.getAreaDetails(area);
        const icon = details.priority === 'high' ? '🔥' : details.priority === 'medium' ? '⭐' : '📍';
        console.log(`   ${icon} ${area} (${details.priority} priority)`);
    });

    // Show extraction strategies
    console.log('\n🎯 EXTRACTION STRATEGIES:');

    const strategies = [
        { name: 'high-priority', desc: 'Key areas only (~20 areas, 15-20 min)' },
        { name: 'medium-priority', desc: 'High + medium areas (~35 areas, 25-35 min)' },
        { name: 'all', desc: 'Complete Mumbai coverage (60+ areas, 45-60 min)' },
        { name: 'south-mumbai', desc: 'Premium locations only (~7 areas, 8-12 min)' },
        { name: 'western-suburbs', desc: 'Popular rental areas (~21 areas, 20-25 min)' }
    ];

    strategies.forEach(strategy => {
        const areas = areasManager.getExtractionAreas(strategy.name);
        console.log(`   📋 ${strategy.name}: ${areas.length} areas - ${strategy.desc}`);
    });

    // Show sample URLs
    console.log('\n🔗 SAMPLE GENERATED URLS:');
    const sampleAreas = ['Bandra West', 'Andheri West', 'Powai'];
    sampleAreas.forEach(area => {
        const url = areasManager.generateURL(area);
        console.log(`   ${area}: ${url.substring(0, 80)}...`);
    });

    // Usage examples
    console.log('\n💡 USAGE EXAMPLES:');
    console.log('   📋 Basic extraction:');
    console.log('      npm run extract                    # High-priority areas');
    console.log('      node index.js --all               # All Mumbai areas');
    console.log('      node index.js --west              # Western Suburbs only');

    console.log('\n   ⚡ Performance tuning:');
    console.log('      node index.js --batch-size 5      # 5 concurrent requests');
    console.log('      node index.js --delay 2           # 2 second delays');
    console.log('      npm run extract:fast              # Fast extraction preset');

    console.log('\n   📊 Analysis:');
    console.log('      npm run analyze                    # Market analysis');
    console.log('      npm run clean                      # Data cleaning');
    console.log('      npm run full-process:all           # Complete pipeline');

    // Expected output
    console.log('\n📁 EXPECTED OUTPUT FILES:');
    const outputFiles = [
        'mumbai_properties_all.json     # Complete dataset',
        'mumbai_properties_all.csv      # CSV format',
        'mumbai_market_report.json      # Detailed analytics',
        'mumbai_market_report.md        # Human-readable report',
        'zone_south_mumbai.json         # Zone-specific data',
        'zone_western_suburbs.json      # Zone-specific data',
        'area_bandra_west.json          # Area-specific data',
        'area_andheri_west.json         # Area-specific data'
    ];

    outputFiles.forEach(file => {
        console.log(`   📄 ${file}`);
    });

    // Performance metrics
    console.log('\n⚡ PERFORMANCE EXPECTATIONS:');
    console.log('   Strategy         | Time     | Properties | Best For');
    console.log('   -----------------|----------|------------|------------------');
    console.log('   high-priority    | 15-20min | 800-1,200  | Quick overview');
    console.log('   medium-priority  | 25-35min | 1,500-2,000| Balanced coverage');
    console.log('   all             | 45-60min | 2,500-3,500| Complete analysis');
    console.log('   south-mumbai    | 8-12min  | 200-400    | Premium focus');
    console.log('   western-suburbs | 20-25min | 1,000-1,500| Popular areas');

    // Rate limiting info
    console.log('\n🚨 RATE LIMITING:');
    console.log('   ✅ Built-in rate limiting (3 concurrent, 3s delays)');
    console.log('   ✅ Automatic retries for failed requests');
    console.log('   ✅ Graceful error handling');
    console.log('   ✅ Progress monitoring');

    console.log('\n🎉 Ready to extract Mumbai property data!');
    console.log('\n💻 Run: npm run extract:west   # To start with Western Suburbs');
    console.log('💻 Run: npm run help           # For all options');
}

// Quick area lookup function
function quickAreaLookup(searchTerm) {
    const areasManager = new MumbaiAreasManager();
    const allAreas = areasManager.getAllAreas();

    const matches = allAreas.filter(area =>
        area.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (matches.length > 0) {
        console.log(`\n🔍 Areas matching "${searchTerm}":`);
        matches.forEach(area => {
            const details = areasManager.getAreaDetails(area);
            const icon = details.priority === 'high' ? '🔥' : details.priority === 'medium' ? '⭐' : '📍';
            console.log(`   ${icon} ${area} (${details.zone}, ${details.priority} priority)`);
        });
        return matches;
    } else {
        console.log(`❌ No areas found matching "${searchTerm}"`);
        return [];
    }
}

// Price estimation function
function showPriceEstimates() {
    console.log('\n💰 EXPECTED RENT RANGES BY ZONE:');

    const estimates = {
        'South Mumbai': { min: '₹60,000', max: '₹2,00,000+', avg: '₹85,000', note: 'Premium locations' },
        'Western Suburbs': { min: '₹25,000', max: '₹1,50,000', avg: '₹50,000', note: 'Most popular' },
        'Eastern Suburbs': { min: '₹20,000', max: '₹80,000', avg: '₹40,000', note: 'Tech hubs, good value' },
        'Central Mumbai': { min: '₹30,000', max: '₹1,00,000', avg: '₹55,000', note: 'Transit connectivity' },
        'Navi Mumbai': { min: '₹15,000', max: '₹60,000', avg: '₹35,000', note: 'Best value for money' }
    };

    Object.entries(estimates).forEach(([zone, data]) => {
        console.log(`\n   🏙️ ${zone}:`);
        console.log(`      Range: ${data.min} - ${data.max}`);
        console.log(`      Average: ${data.avg}`);
        console.log(`      Note: ${data.note}`);
    });
}

// Main demo execution
if (import.meta.url === `file://${process.argv[1]}`) {
    runDemo().catch(console.error);
}

// Export functions for use in other scripts
export { runDemo, quickAreaLookup, showPriceEstimates };
