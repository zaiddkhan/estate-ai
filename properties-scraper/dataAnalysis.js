import fs from 'fs';
import path from 'path';

class PropertyDataAnalyzer {
    constructor(jsonFilePath = 'mumbai_properties.json') {
        this.jsonFilePath = jsonFilePath;
        this.data = null;
        this.properties = [];
    }

    // Load data from JSON file
    loadData() {
        try {
            if (!fs.existsSync(this.jsonFilePath)) {
                throw new Error(`File ${this.jsonFilePath} not found`);
            }

            const rawData = fs.readFileSync(this.jsonFilePath, 'utf8');
            this.data = JSON.parse(rawData);
            this.properties = this.data.properties || [];

            console.log(`✅ Loaded ${this.properties.length} properties from ${this.jsonFilePath}`);
            return true;
        } catch (error) {
            console.error('Error loading data:', error.message);
            return false;
        }
    }

    // Generate detailed analytics
    generateAnalytics() {
        if (!this.data || this.properties.length === 0) {
            return { error: 'No data available for analysis' };
        }

        return {
            overview: this.getOverviewStats(),
            rentAnalysis: this.getRentAnalysis(),
            areaAnalysis: this.getAreaAnalysis(),
            locationAnalysis: this.getLocationAnalysis(),
            furnishingAnalysis: this.getFurnishingAnalysis(),
            bhkAnalysis: this.getBHKAnalysis(),
            topProperties: this.getTopProperties(),
            affordableProperties: this.getAffordableProperties(),
            trends: this.getTrends()
        };
    }

    // Overview statistics
    getOverviewStats() {
        const totalProperties = this.properties.length;
        const extractedAt = this.data.extractedAt;

        const validRents = this.properties
            .filter(p => p.rent && p.rent > 0)
            .map(p => p.rent);

        const validAreas = this.properties
            .filter(p => p.area && p.area > 0)
            .map(p => p.area);

        return {
            totalProperties,
            extractedAt,
            propertiesWithRent: validRents.length,
            propertiesWithArea: validAreas.length,
            dataCompleteness: {
                rent: Math.round((validRents.length / totalProperties) * 100),
                area: Math.round((validAreas.length / totalProperties) * 100),
                address: Math.round((this.properties.filter(p => p.address).length / totalProperties) * 100),
                owner: Math.round((this.properties.filter(p => p.owner).length / totalProperties) * 100)
            }
        };
    }

    // Detailed rent analysis
    getRentAnalysis() {
        const rents = this.properties
            .filter(p => p.rent && p.rent > 0)
            .map(p => p.rent)
            .sort((a, b) => a - b);

        if (rents.length === 0) return { error: 'No rent data available' };

        const mean = rents.reduce((a, b) => a + b, 0) / rents.length;
        const median = rents[Math.floor(rents.length / 2)];
        const q1 = rents[Math.floor(rents.length * 0.25)];
        const q3 = rents[Math.floor(rents.length * 0.75)];

        // Rent buckets
        const buckets = {
            'Under ₹25K': rents.filter(r => r < 25000).length,
            '₹25K - ₹40K': rents.filter(r => r >= 25000 && r < 40000).length,
            '₹40K - ₹60K': rents.filter(r => r >= 40000 && r < 60000).length,
            '₹60K - ₹80K': rents.filter(r => r >= 60000 && r < 80000).length,
            'Above ₹80K': rents.filter(r => r >= 80000).length
        };

        return {
            count: rents.length,
            min: Math.min(...rents),
            max: Math.max(...rents),
            mean: Math.round(mean),
            median: Math.round(median),
            quartiles: { q1: Math.round(q1), q3: Math.round(q3) },
            buckets
        };
    }

    // Area analysis
    getAreaAnalysis() {
        const areas = this.properties
            .filter(p => p.area && p.area > 0)
            .map(p => p.area)
            .sort((a, b) => a - b);

        if (areas.length === 0) return { error: 'No area data available' };

        const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
        const median = areas[Math.floor(areas.length / 2)];

        // Area buckets
        const buckets = {
            'Under 400 sqft': areas.filter(a => a < 400).length,
            '400-600 sqft': areas.filter(a => a >= 400 && a < 600).length,
            '600-800 sqft': areas.filter(a => a >= 600 && a < 800).length,
            '800-1200 sqft': areas.filter(a => a >= 800 && a < 1200).length,
            'Above 1200 sqft': areas.filter(a => a >= 1200).length
        };

        return {
            count: areas.length,
            min: Math.min(...areas),
            max: Math.max(...areas),
            mean: Math.round(mean),
            median: Math.round(median),
            buckets
        };
    }

    // Location analysis
    getLocationAnalysis() {
        const locations = {};
        const areas = {};

        this.properties.forEach(property => {
            if (property.address) {
                // Extract area from address
                const addressParts = property.address.split(',');
                const area = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : 'Unknown';

                if (!locations[area]) {
                    locations[area] = {
                        count: 0,
                        rents: [],
                        avgRent: 0
                    };
                }

                locations[area].count++;
                if (property.rent) {
                    locations[area].rents.push(property.rent);
                }
            }
        });

        // Calculate average rents for each area
        Object.keys(locations).forEach(area => {
            if (locations[area].rents.length > 0) {
                locations[area].avgRent = Math.round(
                    locations[area].rents.reduce((a, b) => a + b, 0) / locations[area].rents.length
                );
            }
        });

        // Sort by property count
        const sortedLocations = Object.entries(locations)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 10);

        return {
            totalAreas: Object.keys(locations).length,
            topAreas: sortedLocations.map(([area, data]) => ({
                area,
                propertyCount: data.count,
                averageRent: data.avgRent || 'N/A'
            }))
        };
    }

    // Furnishing analysis
    getFurnishingAnalysis() {
        const furnishingData = {};

        this.properties.forEach(property => {
            const furnishing = property.furnishing || 'Unknown';

            if (!furnishingData[furnishing]) {
                furnishingData[furnishing] = {
                    count: 0,
                    rents: [],
                    avgRent: 0
                };
            }

            furnishingData[furnishing].count++;
            if (property.rent) {
                furnishingData[furnishing].rents.push(property.rent);
            }
        });

        // Calculate averages
        Object.keys(furnishingData).forEach(type => {
            if (furnishingData[type].rents.length > 0) {
                furnishingData[type].avgRent = Math.round(
                    furnishingData[type].rents.reduce((a, b) => a + b, 0) / furnishingData[type].rents.length
                );
            }
        });

        return Object.entries(furnishingData).map(([type, data]) => ({
            type,
            count: data.count,
            percentage: Math.round((data.count / this.properties.length) * 100),
            averageRent: data.avgRent || 'N/A'
        }));
    }

    // BHK analysis
    getBHKAnalysis() {
        const bhkData = {};

        this.properties.forEach(property => {
            const bhk = property.bhk || 'Unknown';

            if (!bhkData[bhk]) {
                bhkData[bhk] = {
                    count: 0,
                    rents: [],
                    areas: [],
                    avgRent: 0,
                    avgArea: 0,
                    avgRentPerSqft: 0
                };
            }

            bhkData[bhk].count++;
            if (property.rent) bhkData[bhk].rents.push(property.rent);
            if (property.area) bhkData[bhk].areas.push(property.area);
        });

        // Calculate averages
        Object.keys(bhkData).forEach(type => {
            const data = bhkData[type];

            if (data.rents.length > 0) {
                data.avgRent = Math.round(data.rents.reduce((a, b) => a + b, 0) / data.rents.length);
            }

            if (data.areas.length > 0) {
                data.avgArea = Math.round(data.areas.reduce((a, b) => a + b, 0) / data.areas.length);
            }

            if (data.avgRent && data.avgArea) {
                data.avgRentPerSqft = Math.round(data.avgRent / data.avgArea);
            }
        });

        return Object.entries(bhkData)
            .sort(([,a], [,b]) => b.count - a.count)
            .map(([type, data]) => ({
                type,
                count: data.count,
                percentage: Math.round((data.count / this.properties.length) * 100),
                averageRent: data.avgRent || 'N/A',
                averageArea: data.avgArea || 'N/A',
                rentPerSqft: data.avgRentPerSqft || 'N/A'
            }));
    }

    // Top properties by value
    getTopProperties() {
        const propertiesWithData = this.properties.filter(p => p.rent && p.area);

        return {
            highestRent: propertiesWithData
                .sort((a, b) => b.rent - a.rent)
                .slice(0, 5)
                .map(p => ({
                    title: p.title,
                    rent: p.rent,
                    area: p.area,
                    bhk: p.bhk,
                    address: p.address?.substring(0, 50) + '...'
                })),

            largestArea: propertiesWithData
                .sort((a, b) => b.area - a.area)
                .slice(0, 5)
                .map(p => ({
                    title: p.title,
                    rent: p.rent,
                    area: p.area,
                    bhk: p.bhk,
                    address: p.address?.substring(0, 50) + '...'
                })),

            bestValue: propertiesWithData
                .map(p => ({ ...p, rentPerSqft: p.rent / p.area }))
                .sort((a, b) => a.rentPerSqft - b.rentPerSqft)
                .slice(0, 5)
                .map(p => ({
                    title: p.title,
                    rent: p.rent,
                    area: p.area,
                    rentPerSqft: Math.round(p.rentPerSqft),
                    bhk: p.bhk,
                    address: p.address?.substring(0, 50) + '...'
                }))
        };
    }

    // Affordable properties
    getAffordableProperties() {
        const affordableRent = 40000; // Define affordable as under 40k

        const affordable = this.properties.filter(p =>
            p.rent && p.rent <= affordableRent
        ).sort((a, b) => a.rent - b.rent);

        return {
            count: affordable.length,
            percentage: Math.round((affordable.length / this.properties.length) * 100),
            properties: affordable.slice(0, 10).map(p => ({
                title: p.title,
                rent: p.rent,
                bhk: p.bhk,
                area: p.area,
                furnishing: p.furnishing,
                address: p.address?.substring(0, 60) + '...'
            }))
        };
    }

    // Market trends analysis
    getTrends() {
        const propertiesWithData = this.properties.filter(p => p.rent && p.area);

        if (propertiesWithData.length === 0) {
            return { error: 'Insufficient data for trend analysis' };
        }

        const rentPerSqft = propertiesWithData.map(p => p.rent / p.area);
        const avgRentPerSqft = rentPerSqft.reduce((a, b) => a + b, 0) / rentPerSqft.length;

        // Price tiers
        const tiers = {
            premium: propertiesWithData.filter(p => (p.rent / p.area) > avgRentPerSqft * 1.5),
            mid: propertiesWithData.filter(p => {
                const ratio = p.rent / p.area;
                return ratio >= avgRentPerSqft * 0.75 && ratio <= avgRentPerSqft * 1.5;
            }),
            budget: propertiesWithData.filter(p => (p.rent / p.area) < avgRentPerSqft * 0.75)
        };

        return {
            averageRentPerSqft: Math.round(avgRentPerSqft),
            priceTiers: {
                premium: {
                    count: tiers.premium.length,
                    percentage: Math.round((tiers.premium.length / propertiesWithData.length) * 100),
                    avgRentPerSqft: Math.round(
                        tiers.premium.reduce((sum, p) => sum + (p.rent / p.area), 0) / tiers.premium.length || 0
                    )
                },
                mid: {
                    count: tiers.mid.length,
                    percentage: Math.round((tiers.mid.length / propertiesWithData.length) * 100),
                    avgRentPerSqft: Math.round(
                        tiers.mid.reduce((sum, p) => sum + (p.rent / p.area), 0) / tiers.mid.length || 0
                    )
                },
                budget: {
                    count: tiers.budget.length,
                    percentage: Math.round((tiers.budget.length / propertiesWithData.length) * 100),
                    avgRentPerSqft: Math.round(
                        tiers.budget.reduce((sum, p) => sum + (p.rent / p.area), 0) / tiers.budget.length || 0
                    )
                }
            }
        };
    }

    // Generate comprehensive report
    generateReport() {
        if (!this.loadData()) {
            return;
        }

        const analytics = this.generateAnalytics();

        console.log('\n🏢 MUMBAI PROPERTY MARKET ANALYSIS REPORT');
        console.log('=' .repeat(50));

        // Overview
        console.log('\n📊 OVERVIEW');
        console.log(`Total Properties Analyzed: ${analytics.overview.totalProperties}`);
        console.log(`Data Extracted: ${new Date(analytics.overview.extractedAt).toLocaleString()}`);
        console.log(`Data Completeness: Rent ${analytics.overview.dataCompleteness.rent}% | Area ${analytics.overview.dataCompleteness.area}%`);

        // Rent Analysis
        console.log('\n💰 RENT ANALYSIS');
        const rent = analytics.rentAnalysis;
        console.log(`Range: ₹${rent.min?.toLocaleString()} - ₹${rent.max?.toLocaleString()}`);
        console.log(`Average: ₹${rent.mean?.toLocaleString()} | Median: ₹${rent.median?.toLocaleString()}`);
        console.log('\nRent Distribution:');
        Object.entries(rent.buckets || {}).forEach(([range, count]) => {
            const percentage = Math.round((count / rent.count) * 100);
            console.log(`  ${range}: ${count} properties (${percentage}%)`);
        });

        // BHK Analysis
        console.log('\n🏠 BHK TYPE ANALYSIS');
        analytics.bhkAnalysis.forEach(bhk => {
            console.log(`${bhk.type}: ${bhk.count} properties (${bhk.percentage}%)`);
            if (bhk.averageRent !== 'N/A') {
                console.log(`  Avg Rent: ₹${bhk.averageRent?.toLocaleString()} | Avg Area: ${bhk.averageArea} sqft | ₹${bhk.rentPerSqft}/sqft`);
            }
        });

        // Furnishing Analysis
        console.log('\n🪑 FURNISHING ANALYSIS');
        analytics.furnishingAnalysis.forEach(furn => {
            console.log(`${furn.type}: ${furn.count} properties (${furn.percentage}%)`);
            if (furn.averageRent !== 'N/A') {
                console.log(`  Average Rent: ₹${furn.averageRent?.toLocaleString()}`);
            }
        });

        // Location Analysis
        console.log('\n📍 TOP LOCATIONS');
        analytics.locationAnalysis.topAreas.slice(0, 5).forEach((area, index) => {
            console.log(`${index + 1}. ${area.area}: ${area.propertyCount} properties`);
            if (area.averageRent !== 'N/A') {
                console.log(`   Average Rent: ₹${area.averageRent?.toLocaleString()}`);
            }
        });

        // Market Trends
        console.log('\n📈 MARKET TRENDS');
        const trends = analytics.trends;
        console.log(`Average Rent per Sqft: ₹${trends.averageRentPerSqft}`);
        console.log('\nPrice Segments:');
        Object.entries(trends.priceTiers || {}).forEach(([tier, data]) => {
            console.log(`  ${tier.toUpperCase()}: ${data.count} properties (${data.percentage}%) - ₹${data.avgRentPerSqft}/sqft`);
        });

        // Affordable Properties
        console.log('\n💡 AFFORDABLE OPTIONS (Under ₹40,000)');
        const affordable = analytics.affordableProperties;
        console.log(`Found: ${affordable.count} properties (${affordable.percentage}% of total)`);

        if (affordable.properties && affordable.properties.length > 0) {
            console.log('\nTop 5 Affordable Properties:');
            affordable.properties.slice(0, 5).forEach((prop, index) => {
                console.log(`${index + 1}. ${prop.title}`);
                console.log(`   Rent: ₹${prop.rent?.toLocaleString()} | ${prop.bhk} | ${prop.area} sqft`);
            });
        }

        // Best Value Properties
        console.log('\n⭐ BEST VALUE PROPERTIES (Lowest Rent/Sqft)');
        analytics.topProperties.bestValue.slice(0, 3).forEach((prop, index) => {
            console.log(`${index + 1}. ${prop.title}`);
            console.log(`   ₹${prop.rentPerSqft}/sqft | Rent: ₹${prop.rent?.toLocaleString()} | Area: ${prop.area} sqft`);
        });

        console.log('\n' + '='.repeat(50));
        console.log('📝 Report generated successfully!');

        // Save detailed analytics to file
        this.saveAnalytics(analytics);
    }

    // Save analytics to file
    saveAnalytics(analytics, filename = 'property_analytics.json') {
        try {
            fs.writeFileSync(filename, JSON.stringify(analytics, null, 2));
            console.log(`📊 Detailed analytics saved to ${filename}`);
        } catch (error) {
            console.error('Error saving analytics:', error.message);
        }
    }

    // Search properties by criteria
    searchProperties(criteria) {
        if (!this.properties.length) {
            this.loadData();
        }

        let filtered = [...this.properties];

        // Apply filters
        if (criteria.maxRent) {
            filtered = filtered.filter(p => p.rent && p.rent <= criteria.maxRent);
        }

        if (criteria.minRent) {
            filtered = filtered.filter(p => p.rent && p.rent >= criteria.minRent);
        }

        if (criteria.bhk) {
            filtered = filtered.filter(p => p.bhk && p.bhk.toLowerCase().includes(criteria.bhk.toLowerCase()));
        }

        if (criteria.furnishing) {
            filtered = filtered.filter(p => p.furnishing && p.furnishing.toLowerCase().includes(criteria.furnishing.toLowerCase()));
        }

        if (criteria.area) {
            filtered = filtered.filter(p => p.address && p.address.toLowerCase().includes(criteria.area.toLowerCase()));
        }

        if (criteria.minArea) {
            filtered = filtered.filter(p => p.area && p.area >= criteria.minArea);
        }

        if (criteria.maxArea) {
            filtered = filtered.filter(p => p.area && p.area <= criteria.maxArea);
        }

        return filtered.map(p => ({
            title: p.title,
            rent: p.rent,
            bhk: p.bhk,
            area: p.area,
            furnishing: p.furnishing,
            address: p.address,
            url: p.url
        }));
    }
}

// Usage examples and main execution
async function main() {
    const analyzer = new PropertyDataAnalyzer();

    // Generate comprehensive report
    analyzer.generateReport();

    // Example searches
    console.log('\n🔍 EXAMPLE SEARCHES');
    console.log('\n1. Properties under ₹30,000:');
    const cheap = analyzer.searchProperties({ maxRent: 30000 });
    cheap.slice(0, 3).forEach(p => {
        console.log(`   • ${p.title} - ₹${p.rent?.toLocaleString()}`);
    });

    console.log('\n2. 2 BHK Semi Furnished:');
    const specific = analyzer.searchProperties({ bhk: '2 BHK', furnishing: 'Semi' });
    specific.slice(0, 3).forEach(p => {
        console.log(`   • ${p.title} - ₹${p.rent?.toLocaleString()}`);
    });

    console.log('\n3. Large properties (>1000 sqft):');
    const large = analyzer.searchProperties({ minArea: 1000 });
    large.slice(0, 3).forEach(p => {
        console.log(`   • ${p.title} - ${p.area} sqft - ₹${p.rent?.toLocaleString()}`);
    });
}

// Export for use in other files
export default PropertyDataAnalyzer;

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
