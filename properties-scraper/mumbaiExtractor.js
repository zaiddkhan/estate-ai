import PropertyDataExtractor from "./propertyExtractor.js";
import MumbaiAreasManager from "./mumbaiAreas.js";
import fs from 'fs';
import path from 'path';

class MumbaiPropertyExtractor {
    constructor(apiKey, options = {}) {
        this.extractor = new PropertyDataExtractor(apiKey);
        this.areasManager = new MumbaiAreasManager();
        this.options = {
            strategy: options.strategy || 'high-priority',
            maxConcurrent: options.maxConcurrent || 3,
            delayBetweenRequests: options.delayBetweenRequests || 3000,
            retryAttempts: options.retryAttempts || 2,
            outputDir: options.outputDir || './output',
            batchSize: options.batchSize || 5,
            ...options
        };

        this.allProperties = [];
        this.areaResults = new Map();
        this.errors = [];
        this.startTime = null;
    }

    // Main extraction method
    async extractAllAreas() {
        try {
            console.log('🚀 Starting Mumbai-wide property extraction...');
            this.startTime = Date.now();

            // Create output directory
            this.ensureOutputDirectory();

            // Get areas to extract based on strategy
            const areasToExtract = this.areasManager.getExtractionAreas(this.options.strategy);
            console.log(`📍 Strategy: ${this.options.strategy}`);
            console.log(`🎯 Areas to extract: ${areasToExtract.length}`);

            // Generate URLs for extraction
            const urlBatches = this.createBatches(areasToExtract);
            console.log(`📦 Processing in ${urlBatches.length} batches`);

            // Process batches
            await this.processBatches(urlBatches);

            // Compile and save results
            await this.compileResults();

            // Generate comprehensive report
            await this.generateMumbaiReport();

            const duration = (Date.now() - this.startTime) / 1000;
            console.log(`\n✅ Mumbai extraction complete in ${duration.toFixed(2)}s`);
            console.log(`📊 Total properties extracted: ${this.allProperties.length}`);

            return {
                success: true,
                totalProperties: this.allProperties.length,
                areasProcessed: this.areaResults.size,
                errors: this.errors.length,
                duration: duration,
                outputFiles: this.getOutputFiles()
            };

        } catch (error) {
            console.error('❌ Mumbai extraction failed:', error.message);
            return {
                success: false,
                error: error.message,
                areasProcessed: this.areaResults.size,
                totalProperties: this.allProperties.length
            };
        }
    }

    // Create batches of areas for processing
    createBatches(areas) {
        const batches = [];
        for (let i = 0; i < areas.length; i += this.options.batchSize) {
            batches.push(areas.slice(i, i + this.options.batchSize));
        }
        return batches;
    }

    // Process batches of areas
    async processBatches(batches) {
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`\n📦 Processing batch ${i + 1}/${batches.length}`);

            // Process batch with concurrency control
            await this.processBatch(batch);

            // Delay between batches
            if (i < batches.length - 1) {
                console.log(`⏳ Waiting ${this.options.delayBetweenRequests/1000}s before next batch...`);
                await this.delay(this.options.delayBetweenRequests);
            }
        }
    }

    // Process a single batch of areas
    async processBatch(areaNames) {
        const promises = areaNames.map(areaName =>
            this.processAreaWithRetry(areaName)
        );

        await Promise.allSettled(promises);
    }

    // Process single area with retry logic
    async processAreaWithRetry(areaName, attempt = 1) {
        try {
            console.log(`🏙️  Processing ${areaName} (attempt ${attempt})`);

            const url = this.areasManager.generateURL(areaName);
            const areaDetails = this.areasManager.getAreaDetails(areaName);

            const properties = await this.extractor.scrapeProperties(url);

            // Add area metadata to each property
            const enrichedProperties = properties.map(property => ({
                ...property,
                _area: areaName,
                _zone: areaDetails.zone,
                _priority: areaDetails.priority,
                _extractedAt: new Date().toISOString()
            }));

            this.areaResults.set(areaName, {
                area: areaName,
                zone: areaDetails.zone,
                priority: areaDetails.priority,
                propertyCount: enrichedProperties.length,
                status: 'success',
                extractedAt: new Date().toISOString(),
                url: url
            });

            this.allProperties.push(...enrichedProperties);

            console.log(`✅ ${areaName}: ${enrichedProperties.length} properties extracted`);

            return enrichedProperties;

        } catch (error) {
            console.error(`❌ ${areaName} failed (attempt ${attempt}): ${error.message}`);

            if (attempt < this.options.retryAttempts) {
                console.log(`🔄 Retrying ${areaName} in 5 seconds...`);
                await this.delay(5000);
                return this.processAreaWithRetry(areaName, attempt + 1);
            } else {
                this.errors.push({
                    area: areaName,
                    error: error.message,
                    attempts: attempt,
                    timestamp: new Date().toISOString()
                });

                this.areaResults.set(areaName, {
                    area: areaName,
                    status: 'failed',
                    error: error.message,
                    attempts: attempt,
                    extractedAt: new Date().toISOString()
                });

                return [];
            }
        }
    }

    // Compile and save results
    async compileResults() {
        console.log('\n📊 Compiling results...');

        // Remove duplicates
        const uniqueProperties = this.removeDuplicates(this.allProperties);
        this.allProperties = uniqueProperties;

        // Save main dataset
        const mainDataset = {
            extractedAt: new Date().toISOString(),
            strategy: this.options.strategy,
            totalProperties: this.allProperties.length,
            areasProcessed: this.areaResults.size,
            summary: this.generateSummary(),
            areaBreakdown: Array.from(this.areaResults.values()),
            properties: this.allProperties
        };

        await this.saveFile('mumbai_properties_all.json', JSON.stringify(mainDataset, null, 2));

        // Save CSV
        await this.savePropertiesToCSV('mumbai_properties_all.csv', this.allProperties);

        // Save area-wise breakdown
        await this.saveAreaBreakdown();

        // Save zone-wise breakdown
        await this.saveZoneBreakdown();
    }

    // Remove duplicate properties
    removeDuplicates(properties) {
        const seen = new Set();
        return properties.filter(property => {
            const key = `${property.title}-${property.rent}-${property.area}-${property._area}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // Save area-wise breakdown
    async saveAreaBreakdown() {
        const areaBreakdown = {};

        this.allProperties.forEach(property => {
            const area = property._area;
            if (!areaBreakdown[area]) {
                areaBreakdown[area] = [];
            }
            areaBreakdown[area].push(property);
        });

        // Save each area's properties
        for (const [area, properties] of Object.entries(areaBreakdown)) {
            const filename = `area_${area.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.json`;
            await this.saveFile(filename, JSON.stringify({
                area: area,
                zone: properties[0]?._zone,
                extractedAt: new Date().toISOString(),
                propertyCount: properties.length,
                properties: properties
            }, null, 2));
        }

        console.log(`📁 Saved ${Object.keys(areaBreakdown).length} area-specific files`);
    }

    // Save zone-wise breakdown
    async saveZoneBreakdown() {
        const zoneBreakdown = {};

        this.allProperties.forEach(property => {
            const zone = property._zone;
            if (!zoneBreakdown[zone]) {
                zoneBreakdown[zone] = [];
            }
            zoneBreakdown[zone].push(property);
        });

        for (const [zone, properties] of Object.entries(zoneBreakdown)) {
            const filename = `zone_${zone.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.json`;
            await this.saveFile(filename, JSON.stringify({
                zone: zone,
                extractedAt: new Date().toISOString(),
                propertyCount: properties.length,
                areaBreakdown: this.getAreaBreakdownForZone(properties),
                properties: properties
            }, null, 2));
        }

        console.log(`🌏 Saved ${Object.keys(zoneBreakdown).length} zone-specific files`);
    }

    // Get area breakdown for a zone
    getAreaBreakdownForZone(properties) {
        const areaBreakdown = {};
        properties.forEach(property => {
            const area = property._area;
            areaBreakdown[area] = (areaBreakdown[area] || 0) + 1;
        });
        return areaBreakdown;
    }

    // Generate comprehensive summary
    generateSummary() {
        const summary = {
            totalProperties: this.allProperties.length,
            areas: this.areaResults.size,
            zones: {},
            priorities: {},
            rentRange: {},
            bhkDistribution: {},
            furnishingDistribution: {},
            avgRentByZone: {},
            avgRentByArea: {}
        };

        // Zone and priority breakdown
        this.allProperties.forEach(property => {
            const zone = property._zone;
            const priority = property._priority;

            summary.zones[zone] = (summary.zones[zone] || 0) + 1;
            summary.priorities[priority] = (summary.priorities[priority] || 0) + 1;

            // BHK distribution
            if (property.bhk) {
                summary.bhkDistribution[property.bhk] = (summary.bhkDistribution[property.bhk] || 0) + 1;
            }

            // Furnishing distribution
            if (property.furnishing) {
                summary.furnishingDistribution[property.furnishing] = (summary.furnishingDistribution[property.furnishing] || 0) + 1;
            }
        });

        // Rent analysis
        const rents = this.allProperties.filter(p => p.rent && p.rent > 0).map(p => p.rent);
        if (rents.length > 0) {
            summary.rentRange = {
                min: Math.min(...rents),
                max: Math.max(...rents),
                average: Math.round(rents.reduce((a, b) => a + b, 0) / rents.length),
                median: this.calculateMedian(rents)
            };
        }

        // Average rent by zone
        const zoneRents = {};
        this.allProperties.forEach(property => {
            if (property.rent && property._zone) {
                if (!zoneRents[property._zone]) {
                    zoneRents[property._zone] = [];
                }
                zoneRents[property._zone].push(property.rent);
            }
        });

        Object.keys(zoneRents).forEach(zone => {
            const rents = zoneRents[zone];
            summary.avgRentByZone[zone] = Math.round(rents.reduce((a, b) => a + b, 0) / rents.length);
        });

        return summary;
    }

    // Calculate median
    calculateMedian(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    // Generate comprehensive Mumbai report
    async generateMumbaiReport() {
        console.log('\n📋 Generating Mumbai market report...');

        const report = this.createDetailedReport();

        // Save detailed report
        await this.saveFile('mumbai_market_report.json', JSON.stringify(report, null, 2));

        // Generate and save text report
        const textReport = this.createTextReport(report);
        await this.saveFile('mumbai_market_report.md', textReport);

        // Display summary in console
        this.displayConsoleSummary(report);
    }

    // Create detailed report
    createDetailedReport() {
        return {
            metadata: {
                generatedAt: new Date().toISOString(),
                extractionStrategy: this.options.strategy,
                totalProperties: this.allProperties.length,
                areasProcessed: this.areaResults.size,
                successfulAreas: Array.from(this.areaResults.values()).filter(a => a.status === 'success').length,
                failedAreas: this.errors.length,
                extractionDuration: (Date.now() - this.startTime) / 1000
            },
            marketOverview: this.generateSummary(),
            zoneAnalysis: this.generateZoneAnalysis(),
            areaAnalysis: this.generateAreaAnalysis(),
            priceAnalysis: this.generatePriceAnalysis(),
            topProperties: this.generateTopProperties(),
            marketInsights: this.generateMarketInsights(),
            recommendations: this.generateRecommendations()
        };
    }

    // Generate zone analysis
    generateZoneAnalysis() {
        const zones = {};

        this.allProperties.forEach(property => {
            const zone = property._zone;
            if (!zones[zone]) {
                zones[zone] = {
                    properties: [],
                    areas: new Set()
                };
            }
            zones[zone].properties.push(property);
            zones[zone].areas.add(property._area);
        });

        const analysis = {};
        Object.keys(zones).forEach(zone => {
            const properties = zones[zone].properties;
            const rents = properties.filter(p => p.rent).map(p => p.rent);
            const areas = properties.filter(p => p.area).map(p => p.area);

            analysis[zone] = {
                propertyCount: properties.length,
                areaCount: zones[zone].areas.size,
                rentStats: rents.length > 0 ? {
                    min: Math.min(...rents),
                    max: Math.max(...rents),
                    average: Math.round(rents.reduce((a, b) => a + b, 0) / rents.length),
                    median: this.calculateMedian(rents)
                } : null,
                areaStats: areas.length > 0 ? {
                    min: Math.min(...areas),
                    max: Math.max(...areas),
                    average: Math.round(areas.reduce((a, b) => a + b, 0) / areas.length)
                } : null,
                avgRentPerSqft: rents.length > 0 && areas.length > 0 ?
                    Math.round((rents.reduce((a, b) => a + b, 0) / rents.length) /
                               (areas.reduce((a, b) => a + b, 0) / areas.length)) : null
            };
        });

        return analysis;
    }

    // Generate area analysis
    generateAreaAnalysis() {
        const analysis = {};

        Array.from(this.areaResults.values()).forEach(areaResult => {
            if (areaResult.status === 'success') {
                const properties = this.allProperties.filter(p => p._area === areaResult.area);
                const rents = properties.filter(p => p.rent).map(p => p.rent);

                analysis[areaResult.area] = {
                    zone: areaResult.zone,
                    priority: areaResult.priority,
                    propertyCount: properties.length,
                    avgRent: rents.length > 0 ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : null,
                    rentRange: rents.length > 0 ? {
                        min: Math.min(...rents),
                        max: Math.max(...rents)
                    } : null
                };
            }
        });

        return analysis;
    }

    // Generate price analysis
    generatePriceAnalysis() {
        const rents = this.allProperties.filter(p => p.rent && p.rent > 0).map(p => p.rent);

        if (rents.length === 0) return null;

        const sortedRents = rents.sort((a, b) => a - b);

        return {
            total: rents.length,
            range: {
                min: Math.min(...rents),
                max: Math.max(...rents),
                average: Math.round(rents.reduce((a, b) => a + b, 0) / rents.length),
                median: this.calculateMedian(rents)
            },
            distribution: {
                'Under ₹25K': rents.filter(r => r < 25000).length,
                '₹25K-₹50K': rents.filter(r => r >= 25000 && r < 50000).length,
                '₹50K-₹75K': rents.filter(r => r >= 50000 && r < 75000).length,
                '₹75K-₹100K': rents.filter(r => r >= 75000 && r < 100000).length,
                'Above ₹100K': rents.filter(r => r >= 100000).length
            },
            percentiles: {
                p25: sortedRents[Math.floor(rents.length * 0.25)],
                p50: sortedRents[Math.floor(rents.length * 0.50)],
                p75: sortedRents[Math.floor(rents.length * 0.75)],
                p90: sortedRents[Math.floor(rents.length * 0.90)]
            }
        };
    }

    // Generate top properties
    generateTopProperties() {
        const validProperties = this.allProperties.filter(p => p.rent && p.area);

        return {
            mostExpensive: validProperties
                .sort((a, b) => b.rent - a.rent)
                .slice(0, 10)
                .map(p => ({
                    title: p.title,
                    area: p._area,
                    zone: p._zone,
                    rent: p.rent,
                    size: p.area,
                    bhk: p.bhk
                })),
            largestProperties: validProperties
                .sort((a, b) => b.area - a.area)
                .slice(0, 10)
                .map(p => ({
                    title: p.title,
                    area: p._area,
                    zone: p._zone,
                    rent: p.rent,
                    size: p.area,
                    bhk: p.bhk
                })),
            bestValue: validProperties
                .map(p => ({ ...p, rentPerSqft: p.rent / p.area }))
                .sort((a, b) => a.rentPerSqft - b.rentPerSqft)
                .slice(0, 10)
                .map(p => ({
                    title: p.title,
                    area: p._area,
                    zone: p._zone,
                    rent: p.rent,
                    size: p.area,
                    rentPerSqft: Math.round(p.rentPerSqft),
                    bhk: p.bhk
                }))
        };
    }

    // Generate market insights
    generateMarketInsights() {
        const insights = [];
        const summary = this.generateSummary();
        const zoneAnalysis = this.generateZoneAnalysis();

        // Price insights
        if (summary.rentRange.average) {
            insights.push(`Average rent across Mumbai is ₹${summary.rentRange.average.toLocaleString()}`);
        }

        // Zone insights
        const mostExpensiveZone = Object.entries(summary.avgRentByZone)
            .sort(([,a], [,b]) => b - a)[0];
        if (mostExpensiveZone) {
            insights.push(`${mostExpensiveZone[0]} is the most expensive zone with average rent of ₹${mostExpensiveZone[1].toLocaleString()}`);
        }

        // Property type insights
        const mostCommonBHK = Object.entries(summary.bhkDistribution)
            .sort(([,a], [,b]) => b - a)[0];
        if (mostCommonBHK) {
            insights.push(`${mostCommonBHK[0]} properties are most common (${mostCommonBHK[1]} listings)`);
        }

        return insights;
    }

    // Generate recommendations
    generateRecommendations() {
        const recommendations = [];
        const zoneAnalysis = this.generateZoneAnalysis();
        const priceAnalysis = this.generatePriceAnalysis();

        // Budget recommendations
        if (priceAnalysis) {
            recommendations.push({
                category: 'Budget Options',
                suggestion: `Look for properties under ₹${priceAnalysis.percentiles.p25.toLocaleString()} for budget-friendly options`,
                details: `25% of properties are priced below this range`
            });
        }

        // Zone recommendations
        const affordableZones = Object.entries(zoneAnalysis)
            .filter(([zone, data]) => data.rentStats && data.rentStats.average < 50000)
            .sort(([,a], [,b]) => a.rentStats.average - b.rentStats.average);

        if (affordableZones.length > 0) {
            recommendations.push({
                category: 'Affordable Zones',
                suggestion: `Consider ${affordableZones[0][0]} for affordable rentals`,
                details: `Average rent: ₹${affordableZones[0][1].rentStats.average.toLocaleString()}`
            });
        }

        return recommendations;
    }

    // Create text report
    createTextReport(report) {
        return `# Mumbai Property Market Report

## Overview
- **Generated**: ${new Date(report.metadata.generatedAt).toLocaleString()}
- **Total Properties**: ${report.metadata.totalProperties.toLocaleString()}
- **Areas Processed**: ${report.metadata.areasProcessed}
- **Extraction Strategy**: ${report.metadata.extractionStrategy}
- **Duration**: ${report.metadata.extractionDuration.toFixed(2)}s

## Market Summary
- **Average Rent**: ₹${report.marketOverview.rentRange.average?.toLocaleString() || 'N/A'}
- **Rent Range**: ₹${report.marketOverview.rentRange.min?.toLocaleString() || 'N/A'} - ₹${report.marketOverview.rentRange.max?.toLocaleString() || 'N/A'}
- **Most Common**: ${Object.entries(report.marketOverview.bhkDistribution).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}

## Zone Breakdown
${Object.entries(report.zoneAnalysis).map(([zone, data]) =>
`### ${zone}
- Properties: ${data.propertyCount}
- Areas: ${data.areaCount}
- Avg Rent: ₹${data.rentStats?.average?.toLocaleString() || 'N/A'}
- Rent/Sqft: ₹${data.avgRentPerSqft || 'N/A'}`
).join('\n\n')}

## Key Insights
${report.marketInsights.map(insight => `- ${insight}`).join('\n')}

## Recommendations
${report.recommendations.map(rec =>
`### ${rec.category}
${rec.suggestion}
*${rec.details}*`
).join('\n\n')}

---
*Report generated by Mumbai Property Extractor*
`;
    }

    // Display console summary
    displayConsoleSummary(report) {
        console.log('\n🏙️  MUMBAI PROPERTY MARKET SUMMARY');
        console.log('=' .repeat(50));
        console.log(`📊 Total Properties: ${report.metadata.totalProperties.toLocaleString()}`);
        console.log(`🏘️  Areas Processed: ${report.metadata.areasProcessed}`);
        console.log(`⏱️  Duration: ${report.metadata.extractionDuration.toFixed(2)}s`);

        if (report.marketOverview.rentRange.average) {
            console.log(`💰 Average Rent: ₹${report.marketOverview.rentRange.average.toLocaleString()}`);
            console.log(`📈 Rent Range: ₹${report.marketOverview.rentRange.min.toLocaleString()} - ₹${report.marketOverview.rentRange.max.toLocaleString()}`);
        }

        console.log('\n🌍 Zone Breakdown:');
        Object.entries(report.marketOverview.zones).forEach(([zone, count]) => {
            const avgRent = report.marketOverview.avgRentByZone[zone];
            console.log(`  ${zone}: ${count} properties (Avg: ₹${avgRent?.toLocaleString() || 'N/A'})`);
        });

        if (this.errors.length > 0) {
            console.log('\n⚠️  Failed Areas:');
            this.errors.forEach(error => {
                console.log(`  ❌ ${error.area}: ${error.error}`);
            });
        }
    }

    // Utility methods
    ensureOutputDirectory() {
        if (!fs.existsSync(this.options.outputDir)) {
            fs.mkdirSync(this.options.outputDir, { recursive: true });
        }
    }

    async saveFile(filename, content) {
        const filepath = path.join(this.options.outputDir, filename);
        fs.writeFileSync(filepath, content);
        return filepath;
    }

    async savePropertiesToCSV(filename, properties) {
        if (properties.length === 0) return;

        const headers = [
            'id', 'title', 'address', 'rent', 'deposit', 'area', 'furnishing',
            'bhk', 'propertyType', 'preferredTenants', 'availableFrom', 'owner',
            'maintenance', 'url', 'zone', 'locality', 'priority', 'extractedAt'
        ];

        const csvContent = [
            headers.join(','),
            ...properties.map(property =>
                headers.map(header => {
                    let value = '';
                    switch(header) {
                        case 'zone': value = property._zone || ''; break;
                        case 'locality': value = property._area || ''; break;
                        case 'priority': value = property._priority || ''; break;
                        case 'extractedAt': value = property._extractedAt || ''; break;
                        default: value = property[header] || '';
                    }

                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        value = `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        await this.saveFile(filename, csvContent);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getOutputFiles() {
        const files = [];
        try {
            const outputFiles = fs.readdirSync(this.options.outputDir);
            return outputFiles.map(file => path.join(this.options.outputDir, file));
        } catch (error) {
            return [];
        }
    }
}

export default MumbaiPropertyExtractor;
