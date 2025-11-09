import React, { useEffect, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import { supabase } from "../lib/supabaseClient";

// Function to get major cities for a country (3-4 cities per country)
const getCitiesForCountry = (countryName) => {
  const cityData = {
    "United States of America": [
      { name: "New York", lat: 40.7128, lng: -74.0060 },
      { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
      { name: "Chicago", lat: 41.8781, lng: -87.6298 },
      { name: "Houston", lat: 29.7604, lng: -95.3698 }
    ], 
    "China": [
      { name: "Beijing", lat: 39.9042, lng: 116.4074 },
      { name: "Shanghai", lat: 31.2304, lng: 121.4737 },
      { name: "Guangzhou", lat: 23.1291, lng: 113.2644 },
      { name: "Shenzhen", lat: 22.5431, lng: 114.0579 }
    ],
    "India": [
      { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
      { name: "Delhi", lat: 28.6139, lng: 77.2090 },
      { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
      { name: "Kolkata", lat: 22.5726, lng: 88.3639 }
    ],
    "Brazil": [
      { name: "Sao Paulo", lat: -23.5505, lng: -46.6333 },
      { name: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
      { name: "Brasilia", lat: -15.7942, lng: -47.8822 },
      { name: "Salvador", lat: -12.9714, lng: -38.5014 }
    ],
    "Russia": [
      { name: "Moscow", lat: 55.7558, lng: 37.6173 },
      { name: "Saint Petersburg", lat: 59.9343, lng: 30.3351 },
      { name: "Novosibirsk", lat: 55.0084, lng: 82.9357 },
      { name: "Yekaterinburg", lat: 56.8431, lng: 60.6454 }
    ],
    "Japan": [
      { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
      { name: "Osaka", lat: 34.6937, lng: 135.5023 },
      { name: "Yokohama", lat: 35.4437, lng: 139.6380 },
      { name: "Nagoya", lat: 35.1815, lng: 136.9066 }
    ],
    "Germany": [
      { name: "Berlin", lat: 52.5200, lng: 13.4050 },
      { name: "Munich", lat: 48.1351, lng: 11.5820 },
      { name: "Hamburg", lat: 53.5511, lng: 9.9937 },
      { name: "Frankfurt", lat: 50.1109, lng: 8.6821 }
    ],
    "United Kingdom": [
      { name: "London", lat: 51.5074, lng: -0.1278 },
      { name: "Manchester", lat: 53.4808, lng: -2.2426 },
      { name: "Birmingham", lat: 52.4862, lng: -1.8904 },
      { name: "Glasgow", lat: 55.8642, lng: -4.2518 }
    ],
    "France": [
      { name: "Paris", lat: 48.8566, lng: 2.3522 },
      { name: "Marseille", lat: 43.2965, lng: 5.3698 },
      { name: "Lyon", lat: 45.7640, lng: 4.8357 },
      { name: "Toulouse", lat: 43.6047, lng: 1.4442 }
    ],
    "Italy": [
      { name: "Rome", lat: 41.9028, lng: 12.4964 },
      { name: "Milan", lat: 45.4642, lng: 9.1900 },
      { name: "Naples", lat: 40.8518, lng: 14.2681 },
      { name: "Turin", lat: 45.0703, lng: 7.6869 }
    ],
    "Spain": [
      { name: "Madrid", lat: 40.4168, lng: -3.7038 },
      { name: "Barcelona", lat: 41.3851, lng: 2.1734 },
      { name: "Valencia", lat: 39.4699, lng: -0.3763 },
      { name: "Seville", lat: 37.3891, lng: -5.9845 }
    ],
    "Canada": [
      { name: "Toronto", lat: 43.6532, lng: -79.3832 },
      { name: "Vancouver", lat: 49.2827, lng: -123.1207 },
      { name: "Montreal", lat: 45.5017, lng: -73.5673 },
      { name: "Calgary", lat: 51.0447, lng: -114.0719 }
    ],
    "Australia": [
      { name: "Sydney", lat: -33.8688, lng: 151.2093 },
      { name: "Melbourne", lat: -37.8136, lng: 144.9631 },
      { name: "Brisbane", lat: -27.4698, lng: 153.0251 },
      { name: "Perth", lat: -31.9505, lng: 115.8605 }
    ],
    "Mexico": [
      { name: "Mexico City", lat: 19.4326, lng: -99.1332 },
      { name: "Guadalajara", lat: 20.6597, lng: -103.3496 },
      { name: "Monterrey", lat: 25.6866, lng: -100.3161 },
      { name: "Puebla", lat: 19.0414, lng: -98.2063 }
    ],
    "Argentina": [
      { name: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
      { name: "Cordoba", lat: -31.4201, lng: -64.1888 },
      { name: "Rosario", lat: -32.9442, lng: -60.6505 },
      { name: "Mendoza", lat: -32.8895, lng: -68.8458 }
    ],
    "South Korea": [
      { name: "Seoul", lat: 37.5665, lng: 126.9780 },
      { name: "Busan", lat: 35.1796, lng: 129.0756 },
      { name: "Incheon", lat: 37.4563, lng: 126.7052 },
      { name: "Daegu", lat: 35.8714, lng: 128.6014 }
    ],
    "Indonesia": [
      { name: "Jakarta", lat: -6.2088, lng: 106.8456 },
      { name: "Surabaya", lat: -7.2575, lng: 112.7521 },
      { name: "Bandung", lat: -6.9175, lng: 107.6191 },
      { name: "Medan", lat: 3.5952, lng: 98.6722 }
    ],
    "Turkey": [
      { name: "Istanbul", lat: 41.0082, lng: 28.9784 },
      { name: "Ankara", lat: 39.9334, lng: 32.8597 },
      { name: "Izmir", lat: 38.4237, lng: 27.1428 },
      { name: "Bursa", lat: 40.1826, lng: 29.0665 }
    ],
    "Saudi Arabia": [
      { name: "Riyadh", lat: 24.7136, lng: 46.6753 },
      { name: "Jeddah", lat: 21.4858, lng: 39.1925 },
      { name: "Mecca", lat: 21.3891, lng: 39.8579 },
      { name: "Medina", lat: 24.5247, lng: 39.5692 }
    ],
    "South Africa": [
      { name: "Johannesburg", lat: -26.2041, lng: 28.0473 },
      { name: "Cape Town", lat: -33.9249, lng: 18.4241 },
      { name: "Durban", lat: -29.8587, lng: 31.0218 },
      { name: "Pretoria", lat: -25.7479, lng: 28.2293 }
    ],
    "Egypt": [
      { name: "Cairo", lat: 30.0444, lng: 31.2357 },
      { name: "Alexandria", lat: 31.2001, lng: 29.9187 },
      { name: "Giza", lat: 30.0131, lng: 31.2089 },
      { name: "Shubra El Kheima", lat: 30.1286, lng: 31.2422 }
    ],
    "Nigeria": [
      { name: "Lagos", lat: 6.5244, lng: 3.3792 },
      { name: "Kano", lat: 12.0022, lng: 8.5920 },
      { name: "Ibadan", lat: 7.3776, lng: 3.9470 },
      { name: "Abuja", lat: 9.0765, lng: 7.3986 }
    ],
    "Pakistan": [
      { name: "Karachi", lat: 24.8607, lng: 67.0011 },
      { name: "Lahore", lat: 31.5204, lng: 74.3587 },
      { name: "Faisalabad", lat: 31.4504, lng: 73.1350 },
      { name: "Islamabad", lat: 33.6844, lng: 73.0479 }
    ],
    "Bangladesh": [
      { name: "Dhaka", lat: 23.8103, lng: 90.4125 },
      { name: "Chittagong", lat: 22.3569, lng: 91.7832 },
      { name: "Khulna", lat: 22.8456, lng: 89.5403 },
      { name: "Rajshahi", lat: 24.3745, lng: 88.6042 }
    ],
    "Philippines": [
      { name: "Manila", lat: 14.5995, lng: 120.9842 },
      { name: "Quezon City", lat: 14.6760, lng: 121.0437 },
      { name: "Davao", lat: 7.1907, lng: 125.4553 },
      { name: "Cebu", lat: 10.3157, lng: 123.8854 }
    ],
    "Vietnam": [
      { name: "Ho Chi Minh City", lat: 10.8231, lng: 106.6297 },
      { name: "Hanoi", lat: 21.0285, lng: 105.8542 },
      { name: "Da Nang", lat: 16.0544, lng: 108.2022 },
      { name: "Hai Phong", lat: 20.8449, lng: 106.6881 }
    ],
    "Thailand": [
      { name: "Bangkok", lat: 13.7563, lng: 100.5018 },
      { name: "Chiang Mai", lat: 18.7883, lng: 98.9853 },
      { name: "Pattaya", lat: 12.9236, lng: 100.8825 },
      { name: "Phuket", lat: 7.8804, lng: 98.3923 }
    ],
    "Poland": [
      { name: "Warsaw", lat: 52.2297, lng: 21.0122 },
      { name: "Kraków", lat: 50.0647, lng: 19.9450 },
      { name: "Wrocław", lat: 51.1079, lng: 17.0385 },
      { name: "Gdańsk", lat: 54.3520, lng: 18.6466 }
    ],
    "Ukraine": [
      { name: "Kyiv", lat: 50.4501, lng: 30.5234 },
      { name: "Kharkiv", lat: 49.9935, lng: 36.2304 },
      { name: "Odesa", lat: 46.4825, lng: 30.7233 },
      { name: "Dnipro", lat: 48.4647, lng: 35.0462 }
    ],
    "Netherlands": [
      { name: "Amsterdam", lat: 52.3676, lng: 4.9041 },
      { name: "Rotterdam", lat: 51.9244, lng: 4.4777 },
      { name: "The Hague", lat: 52.0705, lng: 4.3007 },
      { name: "Utrecht", lat: 52.0907, lng: 5.1214 }
    ],
    "Belgium": [
      { name: "Brussels", lat: 50.8503, lng: 4.3517 },
      { name: "Antwerp", lat: 51.2194, lng: 4.4025 },
      { name: "Ghent", lat: 51.0543, lng: 3.7174 },
      { name: "Bruges", lat: 51.2093, lng: 3.2247 }
    ],
    "Sweden": [
      { name: "Stockholm", lat: 59.3293, lng: 18.0686 },
      { name: "Gothenburg", lat: 57.7089, lng: 11.9746 },
      { name: "Malmö", lat: 55.6059, lng: 13.0007 },
      { name: "Uppsala", lat: 59.8586, lng: 17.6389 }
    ],
    "Switzerland": [
      { name: "Zurich", lat: 47.3769, lng: 8.5417 },
      { name: "Geneva", lat: 46.2044, lng: 6.1432 },
      { name: "Basel", lat: 47.5596, lng: 7.5886 },
      { name: "Bern", lat: 46.9481, lng: 7.4474 }
    ],
    "Greece": [
      { name: "Athens", lat: 37.9838, lng: 23.7275 },
      { name: "Thessaloniki", lat: 40.6401, lng: 22.9444 },
      { name: "Patras", lat: 38.2466, lng: 21.7346 },
      { name: "Heraklion", lat: 35.3082, lng: 25.1103 }
    ],
    "Portugal": [
      { name: "Lisbon", lat: 38.7223, lng: -9.1393 },
      { name: "Porto", lat: 41.1579, lng: -8.6291 },
      { name: "Coimbra", lat: 40.2033, lng: -8.4103 },
      { name: "Braga", lat: 41.5454, lng: -8.4265 }
    ],
    "Norway": [
      { name: "Oslo", lat: 59.9139, lng: 10.7522 },
      { name: "Bergen", lat: 60.3913, lng: 5.3221 },
      { name: "Trondheim", lat: 63.4305, lng: 10.3951 },
      { name: "Stavanger", lat: 58.9700, lng: 5.7331 }
    ],
    "Finland": [
      { name: "Helsinki", lat: 60.1699, lng: 24.9384 },
      { name: "Espoo", lat: 60.2055, lng: 24.6559 },
      { name: "Tampere", lat: 61.4981, lng: 23.7600 },
      { name: "Vantaa", lat: 60.2934, lng: 25.0378 }
    ],
    "Denmark": [
      { name: "Copenhagen", lat: 55.6761, lng: 12.5683 },
      { name: "Aarhus", lat: 56.1629, lng: 10.2039 },
      { name: "Odense", lat: 55.4038, lng: 10.4024 },
      { name: "Aalborg", lat: 57.0488, lng: 9.9217 }
    ],
    "Ireland": [
      { name: "Dublin", lat: 53.3498, lng: -6.2603 },
      { name: "Cork", lat: 51.8985, lng: -8.4756 },
      { name: "Limerick", lat: 52.6638, lng: -8.6267 },
      { name: "Galway", lat: 53.2707, lng: -9.0568 }
    ],
    "Chile": [
      { name: "Santiago", lat: -33.4489, lng: -70.6693 },
      { name: "Valparaíso", lat: -33.0472, lng: -71.6127 },
      { name: "Concepción", lat: -36.8201, lng: -73.0444 },
      { name: "La Serena", lat: -29.9027, lng: -71.2519 }
    ],
    "Colombia": [
      { name: "Bogotá", lat: 4.7110, lng: -74.0721 },
      { name: "Medellín", lat: 6.2476, lng: -75.5658 },
      { name: "Cali", lat: 3.4516, lng: -76.5320 },
      { name: "Barranquilla", lat: 10.9639, lng: -74.7964 }
    ],
    "Peru": [
      { name: "Lima", lat: -12.0464, lng: -77.0428 },
      { name: "Arequipa", lat: -16.4090, lng: -71.5375 },
      { name: "Trujillo", lat: -8.1116, lng: -79.0288 },
      { name: "Chiclayo", lat: -6.7714, lng: -79.8409 }
    ],
    "Venezuela": [
      { name: "Caracas", lat: 10.4806, lng: -66.9036 },
      { name: "Maracaibo", lat: 10.6316, lng: -71.6406 },
      { name: "Valencia", lat: 10.1621, lng: -68.0077 },
      { name: "Barquisimeto", lat: 10.0636, lng: -69.3320 }
    ],
    "Iran": [
      { name: "Tehran", lat: 35.6892, lng: 51.3890 },
      { name: "Mashhad", lat: 36.2605, lng: 59.6168 },
      { name: "Isfahan", lat: 32.6546, lng: 51.6680 },
      { name: "Shiraz", lat: 29.5918, lng: 52.5837 }
    ],
    "Iraq": [
      { name: "Baghdad", lat: 33.3152, lng: 44.3661 },
      { name: "Basra", lat: 30.5081, lng: 47.7804 },
      { name: "Mosul", lat: 36.1911, lng: 43.9930 },
      { name: "Erbil", lat: 36.1911, lng: 44.0092 }
    ],
    "Israel": [
      { name: "Jerusalem", lat: 31.7683, lng: 35.2137 },
      { name: "Tel Aviv", lat: 32.0853, lng: 34.7818 },
      { name: "Haifa", lat: 32.7940, lng: 34.9896 },
      { name: "Beersheba", lat: 31.2530, lng: 34.7915 }
    ],
    "United Arab Emirates": [
      { name: "Dubai", lat: 25.2048, lng: 55.2708 },
      { name: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
      { name: "Sharjah", lat: 25.3573, lng: 55.4033 },
      { name: "Al Ain", lat: 24.2075, lng: 55.7447 }
    ],
    "Kazakhstan": [
      { name: "Almaty", lat: 43.2220, lng: 76.8512 },
      { name: "Nur-Sultan", lat: 51.1694, lng: 71.4491 },
      { name: "Shymkent", lat: 42.3419, lng: 69.5901 },
      { name: "Karaganda", lat: 49.8014, lng: 73.1024 }
    ],
    "Uzbekistan": [
      { name: "Tashkent", lat: 41.2995, lng: 69.2401 },
      { name: "Samarkand", lat: 39.6542, lng: 66.9597 },
      { name: "Bukhara", lat: 39.7684, lng: 64.4556 },
      { name: "Andijan", lat: 40.7834, lng: 72.3441 }
    ],
    "Malaysia": [
      { name: "Kuala Lumpur", lat: 3.1390, lng: 101.6869 },
      { name: "George Town", lat: 5.4141, lng: 100.3288 },
      { name: "Ipoh", lat: 4.5975, lng: 101.0901 },
      { name: "Johor Bahru", lat: 1.4927, lng: 103.7414 }
    ],
    "Singapore": [
      { name: "Singapore", lat: 1.3521, lng: 103.8198 }
    ],
    "New Zealand": [
      { name: "Auckland", lat: -36.8485, lng: 174.7633 },
      { name: "Wellington", lat: -41.2865, lng: 174.7762 },
      { name: "Christchurch", lat: -43.5321, lng: 172.6362 },
      { name: "Hamilton", lat: -37.7870, lng: 175.2793 }
    ]
  };
  
  return cityData[countryName] || [];
};

// List of major countries to include (~100 main countries)
const majorCountries = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria", "Bangladesh",
    "Belarus", "Belgium", "Brazil", "Bulgaria", "Canada", "Chile", "China", "Colombia",
    "Croatia", "Czech Republic", "Denmark", "Egypt", "Finland", "France", "Germany", "Greece",
    "Hungary", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Japan",
    "Kazakhstan", "Kenya", "Malaysia", "Mexico", "Morocco", "Myanmar", "Netherlands",
    "New Zealand", "Nigeria", "North Korea", "Norway", "Pakistan", "Peru", "Philippines",
    "Poland", "Portugal", "Romania", "Russia", "Saudi Arabia", "South Africa", "South Korea",
    "Spain", "Sweden", "Switzerland", "Taiwan", "Thailand", "Turkey", "Ukraine",
    "United Arab Emirates", "United Kingdom", "United States of America", "Uzbekistan", "Venezuela",
    "Vietnam", "Yemen", "Zimbabwe", "Angola", "Azerbaijan", "Belarus", "Belize", "Benin",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brunei", "Burkina Faso", "Burundi",
    "Cambodia", "Cameroon", "Central African Republic", "Chad", "Congo", "Costa Rica",
    "Cuba", "Cyprus", "Democratic Republic of the Congo", "Dominican Republic", "Ecuador",
    "El Salvador", "Eritrea", "Estonia", "Ethiopia", "Georgia", "Ghana", "Guatemala",
    "Guinea", "Haiti", "Honduras", "Iceland", "Ivory Coast", "Jamaica", "Jordan",
    "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Liberia", "Libya", "Lithuania",
    "Madagascar", "Malawi", "Mali", "Mauritania", "Moldova", "Mongolia", "Mozambique",
    "Nepal", "Nicaragua", "Niger", "Oman", "Panama", "Papua New Guinea", "Paraguay",
    "Qatar", "Rwanda", "Senegal", "Serbia", "Sierra Leone", "Singapore", "Slovakia",
    "Slovenia", "Somalia", "Sri Lanka", "Sudan", "Syria", "Tajikistan", "Tanzania",
    "Tunisia", "Turkmenistan", "Uganda", "Uruguay", "Zambia"
];

// Helper function to get country center coordinates from GeoJSON
const getCountryCenter = (countryName, countriesData) => {
  if (!countriesData || !countryName) return null;
  
  const countryFeature = countriesData.features.find(
    f => f.properties?.name === countryName
  );
  
  if (!countryFeature || !countryFeature.geometry) return null;
  
  // Calculate centroid for polygon
  if (countryFeature.geometry.type === 'Polygon') {
    const coordinates = countryFeature.geometry.coordinates[0];
    let sumLat = 0, sumLng = 0;
    coordinates.forEach(coord => {
      sumLng += coord[0];
      sumLat += coord[1];
    });
    return {
      lat: sumLat / coordinates.length,
      lng: sumLng / coordinates.length
    };
  } else if (countryFeature.geometry.type === 'MultiPolygon') {
    // For MultiPolygon, use the largest polygon
    let maxArea = 0;
    let largestPolygon = null;
    countryFeature.geometry.coordinates.forEach(polygon => {
      const coords = polygon[0];
      const area = coords.length;
      if (area > maxArea) {
        maxArea = area;
        largestPolygon = coords;
      }
    });
    if (largestPolygon) {
      let sumLat = 0, sumLng = 0;
      largestPolygon.forEach(coord => {
        sumLng += coord[0];
        sumLat += coord[1];
      });
      return {
        lat: sumLat / largestPolygon.length,
        lng: sumLng / largestPolygon.length
      };
    }
  }
  
  return null;
};

// Helper function to get camera position to focus on a lat/lng point
// The camera should be positioned opposite the point on the globe
const getCameraPositionForPoint = (lat, lng, radius) => {
  // Convert lat/lng to radians
  const latRad = lat * (Math.PI / 180);
  const lngRad = lng * (Math.PI / 180);
  
  // Convert to Three.js spherical coordinates
  // phi: colatitude (angle from +y axis), 0 at north pole, π at south pole
  // theta: azimuthal angle (longitude), 0 at +x axis
  const phi = (90 - lat) * (Math.PI / 180); // Colatitude
  const theta = lng * (Math.PI / 180); // Longitude (no offset needed)
  
  // Convert spherical to Cartesian coordinates
  // Standard Three.js convention: y is up, x/z are horizontal
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  // Position camera opposite the point (so it looks at the point through the center)
  // Multiply by -1 to position camera on the opposite side
  return new THREE.Vector3(-x, -y, -z);
};

const GlobeComponent = ({ roomCode, isMaster, user, opportunityMarker, opportunities = [], onCountrySelect, customGlobeImage }) => {
  const globeRef = useRef();
  const globeInstanceRef = useRef(null);
  const selectedCountryRef = useRef(null);
  const isMasterRef = useRef(isMaster);
  const roomCodeRef = useRef(roomCode);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [countriesData, setCountriesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opportunityMarkerState, setOpportunityMarkerState] = useState(null);
  const prevOpportunityMarkerRef = useRef(null);
  const prevSelectedCountryRef = useRef(null);

  //keep refs in sync with props/state
  useEffect(() => {
    selectedCountryRef.current = selectedCountry;
  }, [selectedCountry]);

  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  // Sync opportunityMarker prop to state
  useEffect(() => {
    console.log('GlobeComponent: opportunityMarker prop changed:', opportunityMarker);
    setOpportunityMarkerState(opportunityMarker);
  }, [opportunityMarker]);

  // Load initial selected country from database
  useEffect(() => {
    if (!roomCode) return;

    const loadInitialSelection = async () => {
      const { data: room } = await supabase
        .from('rooms')
        .select('selected_country')
        .eq('room_code', roomCode)
        .single();

      if (room?.selected_country) {
        setSelectedCountry(room.selected_country);
        // Notify parent component
        if (onCountrySelect) {
          onCountrySelect(room.selected_country);
        }
      }
    };

    loadInitialSelection();
  }, [roomCode]);

  // Real-time subscription for selected country changes
  useEffect(() => {
    if (!roomCode) return;

    console.log('Setting up real-time subscription for room:', roomCode);

    const channel = supabase
      .channel(`room-globe-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          const newSelectedCountry = payload.new?.selected_country || null;
          const currentSelected = selectedCountryRef.current;
          
          console.log('New selection:', newSelectedCountry, 'Current:', currentSelected);
          
          if (newSelectedCountry !== currentSelected) {
            console.log('Updating selected country to:', newSelectedCountry);
            setSelectedCountry(newSelectedCountry);
            // Notify parent component
            if (onCountrySelect) {
              onCountrySelect(newSelectedCountry);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  //GeoJSON data to show all countrise
  useEffect(() => {
    const countriesUrl = '/countries.geojson'; // Load from public folder
    console.log("Fetching countries data from:", countriesUrl);
    fetch(countriesUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        //exclude random bs places
        const filteredFeatures = data.features.filter(feature => {
          const countryName = feature.properties?.name;
      
          const excludedCountries = ["Bermuda", "Antarctica", "French Southern and Antarctic Lands"];
          return !excludedCountries.includes(countryName);
        });
        
        const filteredData = {
          ...data,
          features: filteredFeatures
        };
        
        console.log("Loaded countries data:", filteredFeatures.length, "countries (all visible, only major ones selectable)");
        setCountriesData(filteredData);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error loading countries data:", error);
        setLoading(false);
      });
  }, []);

  //init globe once data is loaded
  useEffect(() => {
    if (!globeRef.current || globeInstanceRef.current || !countriesData || loading) return;

    console.log("Initialising globe with", countriesData.features.length, "countries...");
    
    if (!countriesData.features || countriesData.features.length === 0) {
      console.error("No countries data available!");
      return;
    }

    const defaultGlobeImage = "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg";
    const globeImage = customGlobeImage || defaultGlobeImage;
    
    const globe = Globe()(globeRef.current)
      .globeImageUrl(globeImage)
      .bumpImageUrl("https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png")
      .backgroundImageUrl("https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png")
      .showAtmosphere(true)
      .atmosphereColor(0xffffff) // White atmosphere (no alpha in THREE.Color)
      .atmosphereAltitude(0.1)
      .polygonsData(countriesData.features)
      .polygonAltitude(() => 0.01)
      .polygonCapColor(() => "rgba(100,100,100,0.3)") // Subtle grey fill - allows texture to show through
      .polygonSideColor(() => "rgba(0,0,0,0.1)")
      .polygonStrokeColor(() => "rgba(0,0,0,0.6)") // Clear dark borders
      .pointsData([]) // Initialize with empty points
      .pointColor(() => "#FFD700") // Gold color for city markers
      .pointRadius(0.6) // Slightly larger city markers for better visibility
      .pointAltitude(0.02) // Slightly elevated above the globe
      .pointLabel(d => d.name) // Show city name on hover
      .labelsData([]) // Initialize with empty labels - using hover labels instead
      .onPolygonClick(d => {
        const currentIsMaster = isMasterRef.current;
        const currentRoomCode = roomCodeRef.current;
        
        console.log("Polygon clicked! isMaster:", currentIsMaster, "roomCode:", currentRoomCode, "country:", d?.properties?.name);
        
        // Only master can interact with the globe
        if (!currentIsMaster) {
          console.log("Not master, ignoring click");
          return;
        }
        
        // Only allow clicking on major countries
        if (!d || !majorCountries.includes(d.properties.name)) {
          console.log("Country not in major countries list or invalid:", d?.properties?.name);
          return;
        }
        
        console.log("Country clicked:", d.properties.name);
        // Toggle selection - click again to deselect
        const currentSelected = selectedCountryRef.current;
        const newSelection = currentSelected === d.properties.name ? null : d.properties.name;
        
        // Update local state immediately for instant feedback (master only)
        setSelectedCountry(newSelection);
        
        // Notify parent component
        if (onCountrySelect) {
          onCountrySelect(newSelection);
        }
        
        // Update in database for real-time sync to all users
        // Clear opportunity marker when country is selected
        if (currentRoomCode) {
          console.log("Updating database with selection:", newSelection, "for room:", currentRoomCode);
          supabase
            .from('rooms')
            .update({ 
              selected_country: newSelection,
              selected_opportunity_lat: null,
              selected_opportunity_lng: null
            })
            .eq('room_code', currentRoomCode)
            .then(({ error }) => {
              if (error) {
                console.error('Error updating selected country:', error);
                // Revert local state on error
                setSelectedCountry(currentSelected);
                if (onCountrySelect) {
                  onCountrySelect(currentSelected);
                }
              } else {
                console.log('Successfully updated selected country in database:', newSelection);
              }
            });
        } else {
          console.log("No roomCode, skipping database update");
        }
      })
      .onPolygonHover(d => {
        // Only master can see hover effects
        if (!isMasterRef.current) {
          setHoveredCountry(null);
          return;
        }
        // Only allow hovering on major countries
        if (!d || !majorCountries.includes(d.properties.name)) {
          setHoveredCountry(null);
          return;
        }
        setHoveredCountry(d.properties.name);
      });

    // Custom globe material
    const globeMaterial = globe.globeMaterial();
    globeMaterial.bumpScale = 10;

    new THREE.TextureLoader().load('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png', texture => {
      globeMaterial.specularMap = texture;
      globeMaterial.specular = new THREE.Color('grey');
      globeMaterial.shininess = 15;
    });

    // Simple lighting
    globe.scene().add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 1, 1); // Changed position to see specularMap effect
    globe.scene().add(dirLight);

    // Add clouds sphere
    const CLOUDS_IMG_URL = '/clouds.png'; // from https://github.com/turban/webgl-earth
    const CLOUDS_ALT = 0.004;
    const CLOUDS_ROTATION_SPEED = -0.006; // deg/frame

    new THREE.TextureLoader().load(CLOUDS_IMG_URL, cloudsTexture => {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(globe.getGlobeRadius() * (1 + CLOUDS_ALT), 75, 75),
        new THREE.MeshPhongMaterial({ map: cloudsTexture, transparent: true })
      );
      globe.scene().add(clouds);

      (function rotateClouds() {
        clouds.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180;
        requestAnimationFrame(rotateClouds);
      })();
    });

    // Auto-rotate
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.minDistance = 20;
    controls.maxDistance = 800;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    // Only master can zoom and rotate
    controls.enableZoom = isMaster;
    controls.enableRotate = isMaster;

    console.log("Globe initialized successfully");
    globeInstanceRef.current = globe;

    return () => {
      // Cleanup
      if (globeInstanceRef.current) {
        globeInstanceRef.current._destructor?.();
        globeInstanceRef.current = null;
      }
    };
  }, [countriesData, loading, isMaster]); // Run when data is loaded or master status changes

  // Update globe image when customGlobeImage changes
  useEffect(() => {
    if (!globeInstanceRef.current) return;
    
    const defaultGlobeImage = "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg";
    const globeImage = customGlobeImage || defaultGlobeImage;
    
    globeInstanceRef.current.globeImageUrl(globeImage);
    console.log('Globe image updated to:', globeImage);
  }, [customGlobeImage]);

  // Update controls when isMaster changes
  useEffect(() => {
    if (!globeInstanceRef.current) return;
    
    const controls = globeInstanceRef.current.controls();
    controls.enableZoom = isMaster;
    controls.enableRotate = isMaster;
  }, [isMaster]);

  // Handle opportunity marker: pan to location when opportunity is selected
  useEffect(() => {
    if (!globeInstanceRef.current) {
      console.log('Globe not initialized yet, skipping opportunity pan');
      return;
    }
    
    const globe = globeInstanceRef.current;
    const controls = globe.controls();
    
    // Check if opportunity was just cleared (had one before, now don't)
    const hadOpportunity = prevOpportunityMarkerRef.current && 
                          prevOpportunityMarkerRef.current.lat && 
                          prevOpportunityMarkerRef.current.lng;
    const hasOpportunity = opportunityMarkerState && 
                          opportunityMarkerState.lat && 
                          opportunityMarkerState.lng;
    
    // Update ref for next render
    prevOpportunityMarkerRef.current = opportunityMarkerState;
    
    if (!hasOpportunity) {
      // No opportunity selected
      // Only reset zoom if we had one before (just cleared)
      if (hadOpportunity && !selectedCountry) {
        controls.autoRotate = true;
        
        // Reset zoom to a moderate level (not fully zoomed out)
        // Use pointOfView to reset to a default view with moderate zoom
        if (typeof globe.pointOfView === 'function') {
          try {
            // Reset to center of globe with moderate zoom (altitude 1.8 = not too far out)
            globe.pointOfView(
              { lat: 0, lng: 0, altitude: 0.8 },
              1500
            );
            console.log('Reset zoom to moderate level after clearing opportunity');
          } catch (error) {
            console.warn('Failed to reset zoom:', error);
          }
        } else {
          // Manual reset: zoom out moderately
          const camera = globe.camera();
          const currentPos = camera.position.clone();
          const currentRadius = currentPos.length();
          // Increase radius by 20% to zoom out moderately (multiply by 1.2)
          // But cap it so it doesn't go too far out
          const targetRadius = Math.min(currentRadius * 1.2, 400);
          const direction = currentPos.normalize();
          const targetPos = direction.multiplyScalar(targetRadius);
          
          const startPos = currentPos.clone();
          let startTime = Date.now();
          const duration = 1500;
          
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const eased = progress < 0.5
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            camera.position.lerpVectors(startPos, targetPos, eased);
            camera.lookAt(0, 0, 0);
            controls.update();
            
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          
          animate();
        }
      } else if (!selectedCountry) {
        // Just resume auto-rotate if no opportunity and no country
        controls.autoRotate = true;
      }
      return;
    }
    
    controls.autoRotate = false; // Stop rotating when opportunity is selected
    
    const { lat, lng } = opportunityMarkerState;
    console.log('Panning to opportunity:', { lat, lng, fullState: opportunityMarkerState });
    
    // Small delay to ensure globe is ready
    const panTimeout = setTimeout(() => {
      // Try using globe.gl's pointOfView method first (if available)
      // This is the preferred method as it handles camera positioning correctly
      if (typeof globe.pointOfView === 'function') {
        try {
          // pointOfView expects: { lat, lng, altitude } and duration
          // altitude controls zoom level (higher = more zoomed out, lower = more zoomed in)
          // Using a lower altitude (1.2) to zoom in slightly towards the country
          globe.pointOfView(
            { lat, lng, altitude: 0.4 },
            1500
          );
          console.log('Used pointOfView method for opportunity');
          return;
        } catch (error) {
          console.warn('pointOfView failed, using manual calculation:', error);
        }
      }
      
      // Manual calculation fallback: get camera position to focus on the point
      const camera = globe.camera();
      const currentPos = camera.position.clone();
      const baseRadius = currentPos.length();
      // Reduce radius by 30% to zoom in (multiply by 0.7)
      const radius = baseRadius * 0.7;
      
      console.log('Manual pan calculation:', { 
        currentPos: { x: currentPos.x, y: currentPos.y, z: currentPos.z },
        baseRadius,
        zoomedRadius: radius
      });
      
      // Calculate target camera position (opposite the point on globe)
      const targetPos = getCameraPositionForPoint(lat, lng, radius);
      
      console.log('Target camera position:', { 
        x: targetPos.x, 
        y: targetPos.y, 
        z: targetPos.z 
      });
      
      // Animate smoothly to target position
      const startPos = currentPos.clone();
      let startTime = Date.now();
      const duration = 1500;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        camera.position.lerpVectors(startPos, targetPos, eased);
        camera.lookAt(0, 0, 0);
        controls.update();
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          console.log('Finished panning to opportunity');
        }
      };
      
      animate();
    }, 100); // Small delay to ensure globe is ready
    
    return () => clearTimeout(panTimeout);
  }, [opportunityMarkerState, selectedCountry]);

  // Handle selected country changes: stop rotation, pan to country, update styling
  useEffect(() => {
    console.log('Selected country changed:', selectedCountry, 'globeInstance:', !!globeInstanceRef.current, 'countriesData:', !!countriesData);
    
    if (!globeInstanceRef.current) {
      console.log('No globe instance, skipping pan');
      return;
    }
    
    if (!selectedCountry) {
      console.log('No selected country, resetting zoom and auto-rotate');
      const globe = globeInstanceRef.current;
      const controls = globe.controls();
      
      // Check if country was just deselected (had one before, now don't)
      const hadCountry = prevSelectedCountryRef.current !== null;
      
      // Only reset zoom if we had a country before (just deselected) and no opportunity is selected
      if (hadCountry && !opportunityMarkerState) {
        controls.autoRotate = true;
        
        // Zoom out to moderate level (altitude 1.7)
        if (typeof globe.pointOfView === 'function') {
          try {
            globe.pointOfView(
              { lat: 0, lng: 0, altitude: 1.7 },
              1500
            );
            console.log('Reset zoom to 1.7 after deselecting country');
          } catch (error) {
            console.warn('Failed to reset zoom:', error);
          }
        } else {
          // Manual reset: zoom out to moderate level
          const camera = globe.camera();
          const currentPos = camera.position.clone();
          const currentRadius = currentPos.length();
          // Increase radius to match altitude 1.7 (approximately 1.3x)
          const targetRadius = Math.min(currentRadius * 1.3, 450);
          const direction = currentPos.normalize();
          const targetPos = direction.multiplyScalar(targetRadius);
          
          const startPos = currentPos.clone();
          let startTime = Date.now();
          const duration = 1500;
          
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const eased = progress < 0.5
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            camera.position.lerpVectors(startPos, targetPos, eased);
            camera.lookAt(0, 0, 0);
            controls.update();
            
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          
          animate();
        }
      } else if (!opportunityMarkerState) {
        // Just resume auto-rotate if no country and no opportunity
        controls.autoRotate = true;
      }
      
      // Update ref for next render
      prevSelectedCountryRef.current = null;
      return;
    }
    
    // Update ref for next render
    prevSelectedCountryRef.current = selectedCountry;
    
    const globe = globeInstanceRef.current;
    const controls = globe.controls();
    controls.autoRotate = false; //stop rotating when selected
    
    // Pan camera to focus on the selected country
    const center = getCountryCenter(selectedCountry, countriesData);
    console.log('Country center calculated:', center, 'for country:', selectedCountry);
    
    if (center) {
      console.log('Panning to country:', selectedCountry, 'at', center);
      
      // Try using globe.gl's pointOfView method first (if available)
      if (typeof globeInstanceRef.current.pointOfView === 'function') {
        try {
          globeInstanceRef.current.pointOfView(
            { lat: center.lat, lng: center.lng, altitude: 1.1 },
            1500
          );
          console.log('Used pointOfView method for country');
          return;
        } catch (error) {
          console.log('pointOfView failed, using manual calculation:', error);
        }
      }
      
      // Manual calculation: get camera position to focus on the point
      const camera = globe.camera();
      const currentPos = camera.position.clone();
      const baseRadius = currentPos.length();
      // Reduce radius by 45% to zoom in (multiply by 0.55) to match altitude 1.1
      const radius = baseRadius * 0.55;
      
      // Calculate target camera position (opposite the point on globe)
      const targetPos = getCameraPositionForPoint(center.lat, center.lng, radius);
      
      // Animate smoothly to target position
      const startPos = currentPos.clone();
      let startTime = Date.now();
      const duration = 1500; // 1.5 second smooth animation
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth easing function (ease-in-out cubic)
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        // Interpolate camera position
        camera.position.lerpVectors(startPos, targetPos, eased);
        
        // Always look at the center of the globe
        camera.lookAt(0, 0, 0);
        controls.update();
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          console.log('Finished panning to', selectedCountry);
        }
      };
      
      animate();
    }
  }, [selectedCountry, countriesData, opportunityMarkerState]);
  
  // Note: Country deselection zoom is now handled in the main country selection effect above

  // Update points for opportunities (red dots)
  useEffect(() => {
    if (!globeInstanceRef.current) return;

    const globe = globeInstanceRef.current;
    const allPoints = [];

    // Priority: If a specific opportunity is selected, show only that one
    // Otherwise, show the opportunities passed (which are already paginated and filtered)
    if (opportunityMarkerState && opportunityMarkerState.lat && opportunityMarkerState.lng) {
      // Show only the selected opportunity
      allPoints.push({
        lat: opportunityMarkerState.lat,
        lng: opportunityMarkerState.lng,
        name: opportunityMarkerState.name || 'Opportunity',
        id: 'opportunity-marker',
        type: 'opportunity'
      });
    } else if (opportunities.length > 0) {
      // Show the opportunities passed (already paginated and filtered by OpportunitiesPanel)
      // This will show only the 5 opportunities on the current page
      opportunities.forEach((opp, index) => {
        allPoints.push({
          lat: opp.lat,
          lng: opp.lng,
          name: opp.name,
          id: `opp-${opp.id || index}`,
          type: 'opportunity'
        });
      });
      console.log(`Globe: Showing ${opportunities.length} paginated opportunities`);
    }
    
    // Update points - all are red opportunity markers
    globe
      .pointsData(allPoints)
      .pointColor(() => '#e53e3e') // Red for all opportunity markers
      .pointRadius(0.3) // Thin red markers
      .labelsData([]); // Remove always-visible labels to prevent overlap
  }, [selectedCountry, opportunityMarkerState, opportunities]);

  useEffect(() => {
    if (!globeInstanceRef.current) return;

    const globe = globeInstanceRef.current;
    
    globe
      .polygonAltitude(d => {
        // Much more elevation for selected country to make border appear thicker
        if (selectedCountry && d.properties.name === selectedCountry) {
          return 0.015; // Significantly increased elevation for thicker appearance
        }
        return 0.01;
      })
      .polygonCapColor(d => {
        // Keep fill subtle to show texture, only outline changes
        if (hoveredCountry && d.properties.name === hoveredCountry) {
          return "rgba(150,150,150,0.4)"; //brighter on hover
        }
        return "rgba(100,100,100,0.3)"; //grey texture
      })
      .polygonSideColor(d => {
        // Make side color match stroke color for selected country to create thicker border effect
        if (selectedCountry && d.properties.name === selectedCountry) {
          return "#FFD700"; // Bright gold/yellow side - makes border appear thicker
        }
        return "rgba(0,0,0,0.1)"; // Normal side color
      })
      .polygonStrokeColor(d => {
        //outloine 
        if (selectedCountry && d.properties.name === selectedCountry) {
          return "#FFD700"; // Bright gold/yellow outlinee
        }
        return "rgba(0,0,0,0.6)"; 
      });
  }, [selectedCountry, hoveredCountry]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", minWidth: 0, minHeight: 0 }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#fff",
            fontSize: "18px",
            zIndex: 2000,
          }}
        >
          Loading globe...
        </div>
      )}
      <div ref={globeRef} style={{ width: "100%", height: "100%", cursor: "pointer", minWidth: 0, minHeight: 0 }} />
      

      {/* Selected country display - centered at top */}
      {selectedCountry && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#FFD700",
            fontWeight: "bold",
            fontSize: "20px",
            zIndex: 1000,
            textAlign: "center",
          }}
        >
          {selectedCountry}
        </div>
      )}
    </div>
  );
};

export default GlobeComponent;
