import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import accommodationService from "./services/accommodationService.js";

// Load environment variables
dotenv.config();

// Create data directory if it doesn't exist
const ensureDataDir = () => {
  const dataDir = path.join(process.cwd(), "data");
  const exportsDir = path.join(dataDir, "exports");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("Created data directory");
  }

  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
    console.log("Created exports directory");
  }

  return { dataDir, exportsDir };
};

/**
 * Collects accommodation data from configured regions and types
 * @param {Object} options - Collection options
 * @returns {Promise<Array>} Collected accommodations
 */
const collectAccommodationData = async (options = {}) => {
  try {
    console.log("Starting accommodation data collection...");

    // Initialize the accommodation service
    await accommodationService.initialize({
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
    });

    // Default regions to search in - comprehensive coverage of India
    const regions = options.regions || [
      // Major Metropolitan Cities
      "Mumbai",
      // "Delhi",
      // "Bangalore",
      // "Hyderabad",
      // "Chennai",
      // "Kolkata",
      // "Pune",
      // "Ahmedabad",
      // "Surat",
      // "Jaipur",

      // // State Capitals
      // "Lucknow",
      // "Bhopal",
      // "Patna",
      // "Thiruvananthapuram",
      // "Panaji",
      // "Gandhinagar",
      // "Chandigarh",
      // "Shimla",
      // "Ranchi",
      // "Raipur",
      // "Bhubaneswar",
      // "Guwahati",
      // "Imphal",
      // "Aizawl",
      // "Kohima",
      // "Gangtok",
      // "Agartala",
      // "Shillong",
      // "Itanagar",
      // "Dispur",

      // // Major Tourist Destinations
      // "Goa",
      // "Agra",
      // "Varanasi",
      // "Rishikesh",
      // "Haridwar",
      // "Amritsar",
      // "Udaipur",
      // "Jodhpur",
      // "Jaisalmer",
      // "Pushkar",
      // "Mount Abu",
      // "Manali",
      // "Dharamshala",
      // "Dalhousie",
      // "Mussoorie",
      // "Nainital",
      // "Jim Corbett",
      // "Ooty",
      // "Kodaikanal",
      // "Munnar",
      // "Alleppey",
      // "Kochi",
      // "Darjeeling",
      // "Gangtok",
      // "Puri",
      // "Konark",
      // "Hampi",
      // "Mysore",
      // "Coorg",
      // "Mahabalipuram",
      // "Pondicherry",
      // "Ranthambore",
      // "Khajuraho",

      // // Hill Stations
      // "Shimla",
      // "Manali",
      // "Dharamshala",
      // "Dalhousie",
      // "Kasauli",
      // "Mussoorie",
      // "Nainital",
      // "Almora",
      // "Ranikhet",
      // "Kausani",
      // "Ooty",
      // "Kodaikanal",
      // "Yercaud",
      // "Coonoor",
      // "Mount Abu",
      // "Matheran",
      // "Lonavala",
      // "Mahabaleshwar",
      // "Panchgani",
      // "Darjeeling",
      // "Kalimpong",
      // "Kurseong",

      // // Beach Destinations
      // "Goa North",
      // "Goa South",
      // "Varkala",
      // "Kovalam",
      // "Mararikulam",
      // "Cherai",
      // "Gokarna",
      // "Karwar",
      // "Udupi",
      // "Mangalore",
      // "Mahabalipuram",
      // "Pondicherry",
      // "Dhanushkodi",
      // "Rameswaram",
      // "Kanyakumari",
      // "Vizag",
      // "Puri",
      // "Digha",
      // "Mandarmani",

      // // Heritage Cities
      // "Jaipur",
      // "Udaipur",
      // "Jodhpur",
      // "Jaisalmer",
      // "Bikaner",
      // "Chittorgarh",
      // "Ajmer",
      // "Pushkar",
      // "Agra",
      // "Lucknow",
      // "Varanasi",
      // "Allahabad",
      // "Gwalior",
      // "Orchha",
      // "Khajuraho",
      // "Sanchi",
      // "Ujjain",
      // "Indore",
      // "Mandu",
      // "Delhi Old City",
      // "Fatehpur Sikri",
      // "Mathura",
      // "Vrindavan",

      // // Wildlife Destinations
      // "Jim Corbett",
      // "Ranthambore",
      // "Kaziranga",
      // "Periyar",
      // "Bandipur",
      // "Nagarhole",
      // "Bandhavgarh",
      // "Kanha",
      // "Pench",
      // "Tadoba",
      // "Gir",
      // "Sundarbans",
      // "Bharatpur",

      // // Spiritual Destinations
      // "Varanasi",
      // "Haridwar",
      // "Rishikesh",
      // "Amritsar",
      // "Ajmer",
      // "Pushkar",
      // "Tirupati",
      // "Madurai",
      // "Rameswaram",
      // "Kanchipuram",
      // "Thanjavur",
      // "Kumbakonam",
      // "Chidambaram",
      // "Shirdi",
      // "Nashik",
      // "Pandharpur",
      // "Kolhapur",
      // "Dwarka",
      // "Somnath",
      // "Palitana",
      // "Mount Abu",
      // "Ujjain",
      // "Omkareshwar",
      // "Maheshwar",
      // "Chitrakoot",
      // "Ayodhya",
      // "Mathura",
      // "Vrindavan",
      // "Kurukshetra",
      // "Anandpur Sahib",

      // // Adventure Destinations
      // "Ladakh",
      // "Leh",
      // "Kashmir",
      // "Srinagar",
      // "Gulmarg",
      // "Pahalgam",
      // "Sonmarg",
      // "Spiti Valley",
      // "Kinnaur",
      // "Mcleodganj",
      // "Kasol",
      // "Tosh",
      // "Malana",
      // "Manali",
      // "Solang Valley",
      // "Rohtang Pass",
      // "Auli",
      // "Kedarnath",
      // "Badrinath",
      // "Valley of Flowers",
      // "Hemkund Sahib",
      // "Chopta",
      // "Tungnath",
      // "Munsiyari",
      // "Pithoragarh",
      // "Lansdowne",

      // // Business Hubs
      // "Gurgaon",
      // "Noida",
      // "Faridabad",
      // "Navi Mumbai",
      // "Thane",
      // "Pune",
      // "Electronic City Bangalore",
      // "Whitefield Bangalore",
      // "Hitech City Hyderabad",
      // "Cyberabad",
      // "IT Corridor Chennai",
      // "Salt Lake Kolkata",
      // "Bandra Kurla Complex",

      // // Other Important Cities
      // "Indore",
      // "Nagpur",
      // "Nashik",
      // "Aurangabad",
      // "Solapur",
      // "Kolhapur",
      // "Sangli",
      // "Satara",
      // "Kanpur",
      // "Allahabad",
      // "Gorakhpur",
      // "Bareilly",
      // "Meerut",
      // "Ghaziabad",
      // "Aligarh",
      // "Moradabad",
      // "Saharanpur",
      // "Dehradun",
      // "Haridwar",
      // "Haldwani",
      // "Rudrapur",
      // "Jalandhar",
      // "Ludhiana",
      // "Amritsar",
      // "Patiala",
      // "Bathinda",
      // "Mohali",
      // "Zirakpur",
      // "Rajkot",
      // "Vadodara",
      // "Bhavnagar",
      // "Jamnagar",
      // "Junagadh",
      // "Anand",
      // "Mehsana",
      // "Palanpur",
      // "Vapi",
      // "Bharuch",
      // "Coimbatore",
      // "Madurai",
      // "Tiruchirappalli",
      // "Salem",
      // "Erode",
      // "Tirunelveli",
      // "Vellore",
      // "Thoothukudi",
      // "Dindigul",
      // "Thanjavur",
      // "Tiruppur",
      // "Hosur",
      // "Krishnagiri",
      // "Dharmapuri",
      // "Villupuram",
      // "Cuddalore",
      // "Chengalpattu",
      // "Kanchipuram",
      // "Tiruvallur",
      // "Visakhapatnam",
      // "Vijayawada",
      // "Guntur",
      // "Nellore",
      // "Kurnool",
      // "Kadapa",
      // "Anantapur",
      // "Chittoor",
      // "Rajahmundry",
      // "Kakinada",
      // "Eluru",
      // "Ongole",
      // "Machilipatnam",
      // "Tirupati",
      // "Nandyal",
      // "Hindupur",
      // "Guntakal",
      // "Proddatur",
      // "Bhimavaram",
      // "Madanapalle",
      // "Srikakulam",
      // "Vizianagaram",
      // "Hubli",
      // "Dharwad",
      // "Belgaum",
      // "Gulbarga",
      // "Davanagere",
      // "Bellary",
      // "Bijapur",
      // "Shimoga",
      // "Tumkur",
      // "Raichur",
      // "Bidar",
      // "Hospet",
      // "Gadag",
      // "Haveri",
      // "Bagalkot",
      // "Chitradurga",
      // "Mandya",
      // "Hassan",
      // "Chikmagalur",
      // "Koppal",
      // "Yadgir",
      // "Chamarajanagar",
      // "Mysore",
      // "Udupi",
      // "Mangalore",
      // "Karwar",
      // "Bhatkal",
      // "Sirsi",
      // "Ranchi",
      // "Jamshedpur",
      // "Dhanbad",
      // "Bokaro",
      // "Deoghar",
      // "Hazaribagh",
      // "Giridih",
      // "Ramgarh",
      // "Medininagar",
      // "Chatra",
      // "Chaibasa",
      // "Sahibganj",
      // "Pakur",
      // "Godda",
      // "Sahebganj",
      // "Dumka",
      // "Jamtara",
      // "Koderma",
      // "Lohardaga",
      // "Gumla",
      // "Simdega",
      // "Khunti",
      // "Seraikela",
      // "East Singhbhum",
      // "West Singhbhum",
      // "Palamu",
      // "Latehar",
      // "Garwa",
    ];

    // Default types of accommodations to search for - comprehensive coverage
    const accommodationTypes = options.types || [
      // Basic Hotel Categories
      "hotels",
      "luxury hotels",
      "budget hotels",
      // "business hotels",
      // "boutique hotels",
      // "heritage hotels",
      // "palace hotels",
      // "5 star hotels",
      // "4 star hotels",
      // "3 star hotels",
      // "2 star hotels",
      // "economy hotels",

      // // Resort Categories
      // "resorts",
      // "beach resorts",
      // "hill station resorts",
      // "spa resorts",
      // "wellness resorts",
      // "ayurveda resorts",
      // "yoga resorts",
      // "golf resorts",
      // "ski resorts",
      // "adventure resorts",
      // "family resorts",
      // "couples resorts",
      // "honeymoon resorts",
      // "wedding resorts",
      // "conference resorts",
      // "eco resorts",
      // "wildlife resorts",
      // "jungle resorts",
      // "safari resorts",
      // "lake resorts",
      // "riverside resorts",
      // "mountain resorts",
      // "desert resorts",
      // "island resorts",

      // // Guest Houses & Homestays
      // "guest houses",
      // "heritage guest houses",
      // "boutique guest houses",
      // "family guest houses",
      // "budget guest houses",
      // "homestays",
      // "heritage homestays",
      // "village homestays",
      // "farm stays",
      // "rural homestays",
      // "tribal homestays",
      // "cultural homestays",
      // "organic farm stays",
      // "tea estate stays",
      // "coffee plantation stays",
      // "vineyard stays",
      // "orchard stays",

      // // Alternative Accommodations
      // "hostels",
      // "backpacker hostels",
      // "youth hostels",
      // "budget hostels",
      // "luxury hostels",
      // "capsule hostels",
      // "female only hostels",
      // "party hostels",
      // "quiet hostels",
      // "family hostels",

      // // Lodges & Camps
      // "lodges",
      // "forest lodges",
      // "wildlife lodges",
      // "hunting lodges",
      // "fishing lodges",
      // "trekking lodges",
      // "mountain lodges",
      // "eco lodges",
      // "jungle lodges",
      // "safari lodges",
      // "tent accommodations",
      // "camping sites",
      // "glamping",
      // "luxury camps",
      // "desert camps",
      // "riverside camps",
      // "beach camps",
      // "adventure camps",
      // "base camps",

      // // Serviced Accommodations
      // "service apartments",
      // "serviced apartments",
      // "extended stay apartments",
      // "corporate apartments",
      // "furnished apartments",
      // "studio apartments",
      // "family apartments",
      // "luxury apartments",
      // "budget apartments",

      // // Bed & Breakfast
      // "bed and breakfast",
      // "B&B",
      // "boutique B&B",
      // "heritage B&B",
      // "family B&B",
      // "luxury B&B",
      // "budget B&B",
      // "countryside B&B",
      // "city B&B",

      // // Unique Accommodations
      // "houseboat accommodations",
      // "floating hotels",
      // "houseboats",
      // "luxury houseboats",
      // "traditional houseboats",
      // "backwater houseboats",
      // "lake houseboats",
      // "river houseboats",
      // "treehouse accommodations",
      // "treetop hotels",
      // "canopy stays",
      // "cave hotels",
      // "underground accommodations",
      // "heritage caves",
      // "fort accommodations",
      // "castle stays",
      // "palace stays",
      // "haveli accommodations",
      // "heritage properties",
      // "restored forts",
      // "royal residences",

      // // Religious Accommodations
      // "dharamshala",
      // "pilgrim accommodations",
      // "ashrams",
      // "meditation centers",
      // "spiritual retreats",
      // "monastery stays",
      // "buddhist monasteries",
      // "tibetan monasteries",
      // "christian retreat centers",
      // "islamic guest houses",
      // "sikh gurudwara accommodations",
      // "jain dharamshala",
      // "hindu ashrams",
      // "yoga ashrams",
      // "meditation ashrams",
      // "spiritual healing centers",

      // // Government & Institutional
      // "circuit houses",
      // "government guest houses",
      // "forest rest houses",
      // "PWD rest houses",
      // "railway retiring rooms",
      // "railway guest houses",
      // "ITDC hotels",
      // "state tourism hotels",
      // "KTDC accommodations",
      // "GTDC properties",
      // "RTDC hotels",
      // "HPTDC accommodations",
      // "UPSTDC properties",
      // "WBTDC hotels",
      // "TTDC accommodations",
      // "APTDC properties",
      // "KSTDC accommodations",
      // "OTDC hotels",
      // "JHDC properties",
      // "CTDC accommodations",
      // "BSTDC hotels",
      // "inspection bungalows",
      // "dak bungalows",
      // "club accommodations",
      // "army guest houses",
      // "navy accommodations",
      // "air force guest houses",

      // // Airport & Transit
      // "airport hotels",
      // "transit hotels",
      // "capsule hotels",
      // "hourly hotels",
      // "day use hotels",
      // "layover accommodations",
      // "terminal hotels",
      // "departure lounge hotels",
      // "arrival hotels",

      // // Medical & Wellness
      // "medical tourism hotels",
      // "hospital accommodations",
      // "recovery centers",
      // "rehabilitation centers",
      // "wellness centers",
      // "detox centers",
      // "fitness resorts",
      // "weight loss centers",
      // "beauty treatment centers",
      // "dental tourism accommodations",
      // "fertility treatment hotels",
      // "cancer treatment accommodations",
      // "cardiac care hotels",
      // "orthopedic treatment centers",

      // // Business & Conference
      // "conference hotels",
      // "business centers",
      // "convention hotels",
      // "meeting venues",
      // "corporate retreats",
      // "training centers",
      // "seminar venues",
      // "workshop centers",
      // "exhibition hotels",
      // "trade fair accommodations",
      // "MICE venues",
      // "banquet halls with accommodation",

      // // Special Interest
      // "pet friendly hotels",
      // "dog friendly accommodations",
      // "cat friendly hotels",
      // "wheelchair accessible hotels",
      // "disabled friendly accommodations",
      // "senior citizen hotels",
      // "women only accommodations",
      // "solo traveler hotels",
      // "group accommodations",
      // "student accommodations",
      // "backpacker accommodations",
      // "cyclist accommodations",
      // "biker accommodations",
      // "trucker accommodations",
      // "fisherman accommodations",
      // "hunter accommodations",
      // "photographer accommodations",
      // "bird watching accommodations",
      // "nature lover accommodations",
      // "adventure sports accommodations",
      // "rock climbing accommodations",
      // "trekking accommodations",
      // "mountaineering accommodations",
      // "river rafting accommodations",
      // "paragliding accommodations",
      // "skiing accommodations",
      // "snowboarding accommodations",
      // "surfing accommodations",
      // "diving accommodations",
      // "snorkeling accommodations",
      // "fishing accommodations",
      // "angling accommodations",

      // // Seasonal & Temporary
      // "summer accommodations",
      // "winter accommodations",
      // "monsoon accommodations",
      // "festival accommodations",
      // "fair accommodations",
      // "mela accommodations",
      // "pilgrimage accommodations",
      // "seasonal camps",
      // "temporary accommodations",
      // "event accommodations",
      // "wedding accommodations",
      // "celebration venues",
      // "party accommodations",
      // "bachelor party accommodations",
      // "bachelorette party accommodations",

      // // Luxury Categories
      // "ultra luxury hotels",
      // "luxury collection hotels",
      // "premium hotels",
      // "designer hotels",
      // "celebrity owned hotels",
      // "award winning hotels",
      // "Michelin rated hotels",
      // "world class hotels",
      // "international chain hotels",
      // "global brand hotels",
      // "flagship hotels",
      // "signature hotels",
      // "exclusive hotels",
      // "private hotels",
      // "member only hotels",
      // "invitation only hotels",
      // "VIP accommodations",
      // "celebrity accommodations",
      // "royal accommodations",
      // "presidential suites",
      // "penthouse accommodations",
    ];

    // Ensure data directories exist
    const { exportsDir } = ensureDataDir();

    // Set collection parameters
    const params = {
      regions,
      accommodationTypes,
      includeDetails: options.includeDetails !== false,
      includePhotos: options.includePhotos !== false,
      limit: options.limit || 10,
      exportToCsv: options.exportToCsv !== false,
      exportPath: exportsDir,
    };

    console.log("Collection parameters:", params);

    // Collect accommodation data using our abstracted service
    const accommodations =
      await accommodationService.collectAccommodationData(params);

    console.log(
      `Successfully collected and processed ${accommodations.length} accommodations`,
    );
    return accommodations;
  } catch (error) {
    console.error("Error in accommodation data collection:", error);
    throw error;
  }
};

/**
 * Main function - entry point of the application
 */
const main = async () => {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {};

    // Check for limit parameter
    const limitArg = args.find((arg) => arg.startsWith("--limit="));
    if (limitArg) {
      options.limit = parseInt(limitArg.split("=")[1], 10);
    }

    // Check for regions parameter
    const regionsArg = args.find((arg) => arg.startsWith("--regions="));
    if (regionsArg) {
      options.regions = regionsArg.split("=")[1].split(",");
    }

    // Check for types parameter
    const typesArg = args.find((arg) => arg.startsWith("--types="));
    if (typesArg) {
      options.types = typesArg.split("=")[1].split(",");
    }

    // Check for photo processing parameters
    const maxPhotosArg = args.find((arg) => arg.startsWith("--max-photos="));
    if (maxPhotosArg) {
      options.maxPhotos = parseInt(maxPhotosArg.split("=")[1], 10);
    }

    const maxWidthArg = args.find((arg) => arg.startsWith("--max-width="));
    if (maxWidthArg) {
      options.maxWidthPx = parseInt(maxWidthArg.split("=")[1], 10);
    }

    const maxHeightArg = args.find((arg) => arg.startsWith("--max-height="));
    if (maxHeightArg) {
      options.maxHeightPx = parseInt(maxHeightArg.split("=")[1], 10);
    }

    // Check for flags
    options.includePhotos = !args.includes("--no-photos");
    options.includeDetails = !args.includes("--no-details");
    options.exportToCsv = !args.includes("--no-export");

    // Run the collection process
    await collectAccommodationData(options);

    console.log("Data collection completed successfully");
  } catch (error) {
    console.error("Application failed:", error);
    process.exit(1);
  }
};

// Run the application
main();
