import FirecrawlApp from '@mendable/firecrawl-js';
import fs from 'fs';

class PropertyDataExtractor {
    constructor(apiKey) {
        this.app = new FirecrawlApp({ apiKey });
        this.cleanedProperties = [];
    }

    // Extract property data from markdown content
    extractPropertyData(markdown) {
        const properties = [];

        // Split content into property sections
        const propertyBlocks = markdown.split(/(?=##\s+\[.*?\])/g).filter(block =>
            block.includes('BHK') || block.includes('Apartment') || block.includes('House')
        );

        propertyBlocks.forEach(block => {
            try {
                const property = this.parsePropertyBlock(block);
                if (property && property.title) {
                    properties.push(property);
                }
            } catch (error) {
                console.warn('Error parsing property block:', error.message);
            }
        });

        return properties;
    }

    // Parse individual property block
    parsePropertyBlock(block) {
        const property = {
            id: null,
            title: null,
            address: null,
            rent: null,
            deposit: null,
            area: null,
            furnishing: null,
            bhk: null,
            propertyType: null,
            preferredTenants: null,
            availableFrom: null,
            owner: null,
            maintenance: null,
            images: [],
            url: null
        };

        // Extract title and URL
        const titleMatch = block.match(/##\s+\[(.*?)\]\((.*?)\)/);
        if (titleMatch) {
            property.title = this.cleanText(titleMatch[1]);
            property.url = titleMatch[2];
            property.id = this.extractIdFromUrl(titleMatch[2]);
        }

        // Extract address (usually the first line after title)
        const addressMatch = block.match(/##.*?\n\n([^!\n]*?)(?:\n|$)/);
        if (addressMatch) {
            property.address = this.cleanText(addressMatch[1]);
        }

        // Extract rent
        const rentMatch = block.match(/₹\s*([\d,]+)\s*(?:\+|Rent)/i);
        if (rentMatch) {
            property.rent = parseInt(rentMatch[1].replace(/,/g, ''));
        }

        // Extract deposit
        const depositMatch = block.match(/₹([\d,]+)\s*Deposit/i);
        if (depositMatch) {
            property.deposit = parseInt(depositMatch[1].replace(/,/g, ''));
        }

        // Extract area
        const areaMatch = block.match(/([\d,]+)\s*sqft/i);
        if (areaMatch) {
            property.area = parseInt(areaMatch[1].replace(/,/g, ''));
        }

        // Extract BHK type
        const bhkMatch = block.match(/(\d+(?:\.\d+)?\s*(?:RK|BHK))/i);
        if (bhkMatch) {
            property.bhk = bhkMatch[1].toUpperCase();
        }

        // Extract furnishing
        const furnishingMatch = block.match(/(Fully Furnished|Semi Furnished|Unfurnished)/i);
        if (furnishingMatch) {
            property.furnishing = furnishingMatch[1];
        }

        // Extract property type
        const propertyTypeMatch = block.match(/Apartment Type\s*\n\s*(.*?)(?:\n|$)/i);
        if (propertyTypeMatch) {
            property.propertyType = this.cleanText(propertyTypeMatch[1]);
        }

        // Extract preferred tenants
        const tenantsMatch = block.match(/Preferred Tenants\s*\n\s*(.*?)(?:\n|$)/i);
        if (tenantsMatch) {
            property.preferredTenants = this.cleanText(tenantsMatch[1]);
        }

        // Extract available from
        const availableMatch = block.match(/Available From\s*\n\s*(.*?)(?:\n|$)/i);
        if (availableMatch) {
            property.availableFrom = this.cleanText(availableMatch[1]);
        }

        // Extract owner name (usually appears early in the block)
        const ownerMatch = block.match(/([A-Z][a-z]+ [A-Z][a-z]+)\d+/);
        if (ownerMatch) {
            property.owner = ownerMatch[1];
        }

        // Extract maintenance info
        const maintenanceMatch = block.match(/(No Extra Maintenance|Maintenance Included|₹[\d,]+ Maintenance)/i);
        if (maintenanceMatch) {
            property.maintenance = maintenanceMatch[1];
        }

        // Extract images
        const imageMatches = block.match(/!\[.*?\]\((.*?)\)/g);
        if (imageMatches) {
            property.images = imageMatches
                .map(match => match.match(/\((.*?)\)/)[1])
                .filter(url => url.includes('images.nobroker.in'));
        }

        return property;
    }

    // Clean text data
    cleanText(text) {
        if (!text) return null;

        return text
            .replace(/\\\\/g, '') // Remove escaped backslashes
            .replace(/\n+/g, ' ') // Replace multiple newlines with space
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
    }

    // Extract property ID from URL
    extractIdFromUrl(url) {
        const idMatch = url.match(/\/([a-f0-9-]+)\/detail/);
        return idMatch ? idMatch[1] : null;
    }

    // Validate and clean property data
    validateProperty(property) {
        // Remove properties with insufficient data
        if (!property.title || !property.rent || !property.address) {
            return false;
        }

        // Clean and standardize rent values
        if (property.rent && property.rent > 1000000) {
            property.rent = Math.round(property.rent);
        }

        // Standardize BHK format
        if (property.bhk) {
            property.bhk = property.bhk.replace(/\s+/g, ' ');
        }

        // Clean address
        if (property.address) {
            property.address = property.address
                .replace(/Mumbai,\s*Maharashtra.*$/i, 'Mumbai, Maharashtra')
                .replace(/,\s*INDIA.*$/i, '')
                .trim();
        }

        // Validate rent range (reasonable for Mumbai)
        if (property.rent < 5000 || property.rent > 500000) {
            console.warn(`Suspicious rent value: ${property.rent} for property: ${property.title}`);
        }

        return true;
    }

    // Scrape and process property data
    async scrapeProperties(url, options = {}) {
        try {
            console.log('Scraping properties from:', url);

            const scrapeResult = await this.app.scrapeUrl(url, {
                formats: ['markdown'],
                ...options
            });

            if (!scrapeResult.success) {
                throw new Error(`Failed to scrape: ${scrapeResult.error}`);
            }

            console.log('Scraping successful. Processing data...');

            // Extract properties from markdown
            const rawProperties = this.extractPropertyData(scrapeResult.markdown);
            console.log(`Found ${rawProperties.length} raw properties`);

            // Validate and clean properties
            const validProperties = rawProperties.filter(property =>
                this.validateProperty(property)
            );

            console.log(`${validProperties.length} properties passed validation`);

            this.cleanedProperties = validProperties;
            return validProperties;

        } catch (error) {
            console.error('Error scraping properties:', error);
            throw error;
        }
    }

    // Generate summary statistics
    generateSummary() {
        if (this.cleanedProperties.length === 0) {
            return { message: 'No properties to analyze' };
        }

        const rents = this.cleanedProperties
            .map(p => p.rent)
            .filter(rent => rent && rent > 0);

        const areas = this.cleanedProperties
            .map(p => p.area)
            .filter(area => area && area > 0);

        const bhkTypes = this.cleanedProperties
            .reduce((acc, p) => {
                if (p.bhk) {
                    acc[p.bhk] = (acc[p.bhk] || 0) + 1;
                }
                return acc;
            }, {});

        const furnishingTypes = this.cleanedProperties
            .reduce((acc, p) => {
                if (p.furnishing) {
                    acc[p.furnishing] = (acc[p.furnishing] || 0) + 1;
                }
                return acc;
            }, {});

        return {
            totalProperties: this.cleanedProperties.length,
            rentRange: {
                min: Math.min(...rents),
                max: Math.max(...rents),
                average: Math.round(rents.reduce((a, b) => a + b, 0) / rents.length)
            },
            areaRange: areas.length > 0 ? {
                min: Math.min(...areas),
                max: Math.max(...areas),
                average: Math.round(areas.reduce((a, b) => a + b, 0) / areas.length)
            } : null,
            bhkDistribution: bhkTypes,
            furnishingDistribution: furnishingTypes,
            averageRentPerSqft: areas.length > 0 && rents.length > 0 ?
                Math.round((rents.reduce((a, b) => a + b, 0) / rents.length) /
                          (areas.reduce((a, b) => a + b, 0) / areas.length)) : null
        };
    }

    // Save data to JSON file
    saveToFile(filename = 'mumbai_properties.json') {
        const data = {
            extractedAt: new Date().toISOString(),
            summary: this.generateSummary(),
            properties: this.cleanedProperties
        };

        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        console.log(`Data saved to ${filename}`);
        return filename;
    }

    // Save data to CSV format
    saveToCSV(filename = 'mumbai_properties.csv') {
        if (this.cleanedProperties.length === 0) {
            console.log('No properties to export');
            return;
        }

        const headers = [
            'id', 'title', 'address', 'rent', 'deposit', 'area', 'furnishing',
            'bhk', 'propertyType', 'preferredTenants', 'availableFrom', 'owner',
            'maintenance', 'url'
        ];

        const csvContent = [
            headers.join(','),
            ...this.cleanedProperties.map(property =>
                headers.map(header => {
                    let value = property[header] || '';
                    // Escape commas and quotes in CSV
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        value = `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        fs.writeFileSync(filename, csvContent);
        console.log(`Data saved to ${filename}`);
        return filename;
    }

    // Get properties by criteria
    filterProperties(criteria = {}) {
        return this.cleanedProperties.filter(property => {
            // Filter by rent range
            if (criteria.minRent && property.rent < criteria.minRent) return false;
            if (criteria.maxRent && property.rent > criteria.maxRent) return false;

            // Filter by BHK
            if (criteria.bhk && property.bhk !== criteria.bhk) return false;

            // Filter by furnishing
            if (criteria.furnishing && property.furnishing !== criteria.furnishing) return false;

            // Filter by area
            if (criteria.minArea && property.area < criteria.minArea) return false;
            if (criteria.maxArea && property.area > criteria.maxArea) return false;

            return true;
        });
    }

    // Display formatted results
    displayResults(limit = 10) {
        console.log('\n=== MUMBAI PROPERTIES EXTRACTION RESULTS ===\n');

        const summary = this.generateSummary();
        console.log('SUMMARY:');
        console.log(`Total Properties: ${summary.totalProperties}`);

        if (summary.rentRange) {
            console.log(`Rent Range: ₹${summary.rentRange.min.toLocaleString()} - ₹${summary.rentRange.max.toLocaleString()}`);
            console.log(`Average Rent: ₹${summary.rentRange.average.toLocaleString()}`);
        }

        if (summary.areaRange) {
            console.log(`Area Range: ${summary.areaRange.min} - ${summary.areaRange.max} sqft`);
        }

        console.log('\nBHK Distribution:', summary.bhkDistribution);
        console.log('Furnishing Distribution:', summary.furnishingDistribution);

        console.log(`\n=== TOP ${Math.min(limit, this.cleanedProperties.length)} PROPERTIES ===\n`);

        this.cleanedProperties.slice(0, limit).forEach((property, index) => {
            console.log(`${index + 1}. ${property.title}`);
            console.log(`   Address: ${property.address}`);
            console.log(`   Rent: ₹${property.rent?.toLocaleString()} | Deposit: ₹${property.deposit?.toLocaleString()}`);
            console.log(`   Area: ${property.area} sqft | Type: ${property.bhk} | Furnishing: ${property.furnishing}`);
            console.log(`   Owner: ${property.owner} | Available: ${property.availableFrom}`);
            console.log(`   URL: ${property.url}`);
            console.log('   ---');
        });
    }
}

export default PropertyDataExtractor;
