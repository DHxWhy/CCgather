"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import createGlobe, { COBEOptions } from "cobe";

// Hook to detect light/dark theme
function useTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(!document.documentElement.classList.contains("light"));
    };

    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

// Country coordinates (lat, lng) - 223 countries
export const COUNTRY_COORDINATES: Record<string, [number, number]> = {
  // Major countries (existing)
  KR: [37.5665, 126.978], // South Korea (Seoul)
  US: [37.0902, -95.7129], // United States
  JP: [35.6762, 139.6503], // Japan (Tokyo)
  DE: [52.52, 13.405], // Germany (Berlin)
  GB: [51.5074, -0.1278], // United Kingdom (London)
  FR: [48.8566, 2.3522], // France (Paris)
  IN: [28.6139, 77.209], // India (New Delhi)
  BR: [-15.7975, -47.8919], // Brazil (Brasilia)
  CA: [45.4215, -75.6972], // Canada (Ottawa)
  AU: [-35.2809, 149.13], // Australia (Canberra)
  IT: [41.9028, 12.4964], // Italy (Rome)
  ES: [40.4168, -3.7038], // Spain (Madrid)
  MX: [19.4326, -99.1332], // Mexico (Mexico City)
  NL: [52.3676, 4.9041], // Netherlands (Amsterdam)
  SE: [59.3293, 18.0686], // Sweden (Stockholm)
  SG: [1.3521, 103.8198], // Singapore
  TW: [25.033, 121.5654], // Taiwan (Taipei)
  // All other countries (A-Z)
  AX: [60.1167, 19.9], // Åland Islands (Mariehamn)
  AL: [41.3275, 19.8187], // Albania (Tirana)
  DZ: [36.7538, 3.0588], // Algeria (Algiers)
  AS: [-14.271, -170.1322], // American Samoa (Pago Pago)
  AD: [42.5063, 1.5218], // Andorra (Andorra la Vella)
  AO: [-8.839, 13.2894], // Angola (Luanda)
  AI: [18.2206, -63.0686], // Anguilla (The Valley)
  AG: [17.1274, -61.8468], // Antigua and Barbuda (St. John's)
  AR: [-34.6037, -58.3816], // Argentina (Buenos Aires)
  AM: [40.1792, 44.4991], // Armenia (Yerevan)
  AW: [12.5211, -70.0263], // Aruba (Oranjestad)
  AT: [48.2082, 16.3738], // Austria (Vienna)
  AZ: [40.4093, 49.8671], // Azerbaijan (Baku)
  BS: [25.048, -77.3554], // Bahamas (Nassau)
  BH: [26.2285, 50.586], // Bahrain (Manama)
  BD: [23.8103, 90.4125], // Bangladesh (Dhaka)
  BB: [13.1132, -59.5988], // Barbados (Bridgetown)
  BE: [50.8503, 4.3517], // Belgium (Brussels)
  BZ: [17.251, -88.759], // Belize (Belmopan)
  BJ: [6.4969, 2.6283], // Benin (Porto-Novo)
  BM: [32.2948, -64.7839], // Bermuda (Hamilton)
  BT: [27.4728, 89.639], // Bhutan (Thimphu)
  BO: [-16.4897, -68.1193], // Bolivia (La Paz)
  BQ: [12.1784, -68.2385], // Bonaire (Kralendijk)
  BA: [43.8563, 18.4131], // Bosnia and Herzegovina (Sarajevo)
  BW: [-24.6282, 25.9231], // Botswana (Gaborone)
  IO: [-7.3195, 72.4229], // British Indian Ocean Territory (Diego Garcia)
  BN: [4.9031, 114.9398], // Brunei (Bandar Seri Begawan)
  BG: [42.6977, 23.3219], // Bulgaria (Sofia)
  BF: [12.3714, -1.5197], // Burkina Faso (Ouagadougou)
  BI: [-3.3761, 29.3599], // Burundi (Gitega)
  CV: [14.9315, -23.5087], // Cape Verde (Praia)
  KH: [11.5564, 104.9282], // Cambodia (Phnom Penh)
  CM: [3.848, 11.5021], // Cameroon (Yaoundé)
  KY: [19.2866, -81.3744], // Cayman Islands (George Town)
  TD: [12.1348, 15.0557], // Chad (N'Djamena)
  CL: [-33.4489, -70.6693], // Chile (Santiago)
  CX: [-10.4475, 105.6904], // Christmas Island (Flying Fish Cove)
  CC: [-12.1642, 96.871], // Cocos Islands (West Island)
  CO: [4.711, -74.0721], // Colombia (Bogotá)
  KM: [-11.7172, 43.2473], // Comoros (Moroni)
  CG: [-4.2634, 15.2429], // Congo (Brazzaville)
  CK: [-21.2075, -159.775], // Cook Islands (Avarua)
  CR: [9.9281, -84.0907], // Costa Rica (San José)
  CI: [6.8276, -5.2893], // Côte d'Ivoire (Yamoussoukro)
  HR: [45.815, 15.9819], // Croatia (Zagreb)
  CW: [12.1696, -68.99], // Curaçao (Willemstad)
  CY: [35.1856, 33.3823], // Cyprus (Nicosia)
  CZ: [50.0755, 14.4378], // Czech Republic (Prague)
  DK: [55.6761, 12.5683], // Denmark (Copenhagen)
  DJ: [11.5721, 43.1456], // Djibouti (Djibouti)
  DM: [15.3017, -61.3881], // Dominica (Roseau)
  DO: [18.4861, -69.9312], // Dominican Republic (Santo Domingo)
  EC: [-0.1807, -78.4678], // Ecuador (Quito)
  EG: [30.0444, 31.2357], // Egypt (Cairo)
  SV: [13.6929, -89.2182], // El Salvador (San Salvador)
  GQ: [3.7523, 8.7742], // Equatorial Guinea (Malabo)
  EE: [59.437, 24.7536], // Estonia (Tallinn)
  SZ: [-26.3054, 31.1367], // Eswatini (Mbabane)
  FK: [-51.7963, -59.5236], // Falkland Islands (Stanley)
  FO: [62.0079, -6.7906], // Faroe Islands (Tórshavn)
  FJ: [-18.1416, 178.4419], // Fiji (Suva)
  FI: [60.1699, 24.9384], // Finland (Helsinki)
  GF: [4.9224, -52.3135], // French Guiana (Cayenne)
  PF: [-17.5516, -149.5585], // French Polynesia (Papeete)
  GA: [0.4162, 9.4673], // Gabon (Libreville)
  GM: [13.4549, -16.579], // Gambia (Banjul)
  GE: [41.7151, 44.8271], // Georgia (Tbilisi)
  GH: [5.6037, -0.187], // Ghana (Accra)
  GI: [36.1408, -5.3536], // Gibraltar (Gibraltar)
  GR: [37.9838, 23.7275], // Greece (Athens)
  GL: [64.1814, -51.6941], // Greenland (Nuuk)
  GD: [12.0561, -61.7486], // Grenada (St. George's)
  GP: [16.0054, -61.7311], // Guadeloupe (Basse-Terre)
  GU: [13.4443, 144.7937], // Guam (Hagåtña)
  GT: [14.6349, -90.5069], // Guatemala (Guatemala City)
  GG: [49.4548, -2.5383], // Guernsey (St. Peter Port)
  GN: [9.6412, -13.5784], // Guinea (Conakry)
  GW: [11.8637, -15.598], // Guinea-Bissau (Bissau)
  GY: [6.8013, -58.1551], // Guyana (Georgetown)
  HT: [18.5944, -72.3074], // Haiti (Port-au-Prince)
  VA: [41.9029, 12.4534], // Vatican City (Vatican City)
  HN: [14.065, -87.1715], // Honduras (Tegucigalpa)
  HU: [47.4979, 19.0402], // Hungary (Budapest)
  IS: [64.1466, -21.9426], // Iceland (Reykjavik)
  ID: [-6.2088, 106.8456], // Indonesia (Jakarta)
  IQ: [33.3152, 44.3661], // Iraq (Baghdad)
  IE: [53.3498, -6.2603], // Ireland (Dublin)
  IM: [54.1509, -4.4806], // Isle of Man (Douglas)
  IL: [31.7683, 35.2137], // Israel (Jerusalem)
  JM: [18.0179, -76.8099], // Jamaica (Kingston)
  JE: [49.2138, -2.1358], // Jersey (St. Helier)
  JO: [31.9454, 35.9284], // Jordan (Amman)
  KZ: [51.1694, 71.4491], // Kazakhstan (Astana)
  KE: [-1.2921, 36.8219], // Kenya (Nairobi)
  KI: [1.3382, 172.9784], // Kiribati (Tarawa)
  KW: [29.3759, 47.9774], // Kuwait (Kuwait City)
  KG: [42.8746, 74.5698], // Kyrgyzstan (Bishkek)
  LA: [17.9757, 102.6331], // Laos (Vientiane)
  LV: [56.9496, 24.1052], // Latvia (Riga)
  LB: [33.8938, 35.5018], // Lebanon (Beirut)
  LS: [-29.3142, 27.4833], // Lesotho (Maseru)
  LR: [6.2907, -10.7605], // Liberia (Monrovia)
  LI: [47.141, 9.5209], // Liechtenstein (Vaduz)
  LT: [54.6872, 25.2797], // Lithuania (Vilnius)
  LU: [49.6116, 6.1319], // Luxembourg (Luxembourg)
  MG: [-18.8792, 47.5079], // Madagascar (Antananarivo)
  MW: [-13.9626, 33.7741], // Malawi (Lilongwe)
  MY: [3.139, 101.6869], // Malaysia (Kuala Lumpur)
  MV: [4.1755, 73.5093], // Maldives (Malé)
  ML: [12.6392, -8.0029], // Mali (Bamako)
  MT: [35.8989, 14.5146], // Malta (Valletta)
  MH: [7.1164, 171.1858], // Marshall Islands (Majuro)
  MQ: [14.6042, -61.0742], // Martinique (Fort-de-France)
  MR: [18.0735, -15.9582], // Mauritania (Nouakchott)
  MU: [-20.1609, 57.5012], // Mauritius (Port Louis)
  YT: [-12.7809, 45.2278], // Mayotte (Mamoudzou)
  FM: [6.9248, 158.161], // Micronesia (Palikir)
  MD: [47.0105, 28.8638], // Moldova (Chișinău)
  MC: [43.7384, 7.4246], // Monaco (Monaco)
  MN: [47.8864, 106.9057], // Mongolia (Ulaanbaatar)
  ME: [42.4304, 19.2594], // Montenegro (Podgorica)
  MS: [16.7062, -62.2159], // Montserrat (Plymouth/Brades)
  MA: [33.9716, -6.8498], // Morocco (Rabat)
  MZ: [-25.9692, 32.5732], // Mozambique (Maputo)
  NA: [-22.5609, 17.0658], // Namibia (Windhoek)
  NR: [-0.5228, 166.9315], // Nauru (Yaren)
  NP: [27.7172, 85.324], // Nepal (Kathmandu)
  NC: [-22.2758, 166.458], // New Caledonia (Nouméa)
  NZ: [-41.2866, 174.7756], // New Zealand (Wellington)
  NI: [12.1149, -86.2362], // Nicaragua (Managua)
  NE: [13.5116, 2.1254], // Niger (Niamey)
  NG: [9.0765, 7.3986], // Nigeria (Abuja)
  NU: [-19.0544, -169.8672], // Niue (Alofi)
  NF: [-29.0408, 167.9547], // Norfolk Island (Kingston)
  MK: [41.9973, 21.428], // North Macedonia (Skopje)
  MP: [15.2123, 145.7545], // Northern Mariana Islands (Saipan)
  NO: [59.9139, 10.7522], // Norway (Oslo)
  OM: [23.588, 58.3829], // Oman (Muscat)
  PK: [33.6844, 73.0479], // Pakistan (Islamabad)
  PW: [7.515, 134.5825], // Palau (Ngerulmud)
  PS: [31.9038, 35.2034], // Palestine (Ramallah)
  PA: [8.9824, -79.5199], // Panama (Panama City)
  PG: [-9.4438, 147.1803], // Papua New Guinea (Port Moresby)
  PY: [-25.2637, -57.5759], // Paraguay (Asunción)
  PE: [-12.0464, -77.0428], // Peru (Lima)
  PH: [14.5995, 120.9842], // Philippines (Manila)
  PN: [-25.0662, -130.1027], // Pitcairn Islands (Adamstown)
  PL: [52.2297, 21.0122], // Poland (Warsaw)
  PT: [38.7223, -9.1393], // Portugal (Lisbon)
  PR: [18.4655, -66.1057], // Puerto Rico (San Juan)
  QA: [25.2854, 51.531], // Qatar (Doha)
  RE: [-20.8789, 55.4481], // Réunion (Saint-Denis)
  RO: [44.4268, 26.1025], // Romania (Bucharest)
  RW: [-1.9403, 29.8739], // Rwanda (Kigali)
  BL: [17.8958, -62.8508], // Saint Barthélemy (Gustavia)
  SH: [-15.9251, -5.7179], // Saint Helena (Jamestown)
  KN: [17.3026, -62.7177], // Saint Kitts and Nevis (Basseterre)
  LC: [14.0101, -60.987], // Saint Lucia (Castries)
  MF: [18.0731, -63.0822], // Saint Martin (Marigot)
  PM: [46.7783, -56.1773], // Saint Pierre and Miquelon (Saint-Pierre)
  VC: [13.1587, -61.2248], // Saint Vincent and the Grenadines (Kingstown)
  WS: [-13.8506, -171.7514], // Samoa (Apia)
  SM: [43.9424, 12.4578], // San Marino (San Marino)
  ST: [0.3365, 6.7273], // São Tomé and Príncipe (São Tomé)
  SA: [24.7136, 46.6753], // Saudi Arabia (Riyadh)
  SN: [14.7167, -17.4677], // Senegal (Dakar)
  RS: [44.7866, 20.4489], // Serbia (Belgrade)
  SC: [-4.6191, 55.4513], // Seychelles (Victoria)
  SL: [8.4657, -13.2317], // Sierra Leone (Freetown)
  SX: [18.0347, -63.0681], // Sint Maarten (Philipsburg)
  SK: [48.1486, 17.1077], // Slovakia (Bratislava)
  SI: [46.0569, 14.5058], // Slovenia (Ljubljana)
  SB: [-9.4295, 160.0388], // Solomon Islands (Honiara)
  ZA: [-25.7479, 28.2293], // South Africa (Pretoria)
  LK: [6.9271, 79.8612], // Sri Lanka (Colombo)
  SR: [5.852, -55.2038], // Suriname (Paramaribo)
  SJ: [78.2232, 15.6267], // Svalbard and Jan Mayen (Longyearbyen)
  CH: [46.948, 7.4474], // Switzerland (Bern)
  TJ: [38.5598, 68.774], // Tajikistan (Dushanbe)
  TZ: [-6.163, 35.7516], // Tanzania (Dodoma)
  TH: [13.7563, 100.5018], // Thailand (Bangkok)
  TL: [-8.5569, 125.5603], // Timor-Leste (Dili)
  TG: [6.1256, 1.2254], // Togo (Lomé)
  TK: [-9.2002, -171.8484], // Tokelau (Atafu)
  TO: [-21.2148, -175.1982], // Tonga (Nuku'alofa)
  TT: [10.6549, -61.5019], // Trinidad and Tobago (Port of Spain)
  TN: [36.8065, 10.1815], // Tunisia (Tunis)
  TR: [39.9334, 32.8597], // Turkey (Ankara)
  TM: [37.9601, 58.3261], // Turkmenistan (Ashgabat)
  TC: [21.4674, -71.1389], // Turks and Caicos Islands (Cockburn Town)
  TV: [-8.5199, 179.1979], // Tuvalu (Funafuti)
  UG: [0.3476, 32.5825], // Uganda (Kampala)
  UA: [50.4501, 30.5234], // Ukraine (Kyiv)
  AE: [24.4539, 54.3773], // United Arab Emirates (Abu Dhabi)
  UM: [19.2823, 166.647], // U.S. Minor Outlying Islands (Wake Island)
  UY: [-34.9011, -56.1645], // Uruguay (Montevideo)
  UZ: [41.2995, 69.2401], // Uzbekistan (Tashkent)
  VU: [-17.7333, 168.3273], // Vanuatu (Port Vila)
  VN: [21.0285, 105.8542], // Vietnam (Hanoi)
  VG: [18.4286, -64.6185], // British Virgin Islands (Road Town)
  VI: [18.3358, -64.9308], // U.S. Virgin Islands (Charlotte Amalie)
  WF: [-13.2825, -176.1736], // Wallis and Futuna (Mata-Utu)
  EH: [27.1253, -13.1625], // Western Sahara (Laayoune)
  ZM: [-15.3875, 28.3228], // Zambia (Lusaka)
  ZW: [-17.8292, 31.0522], // Zimbabwe (Harare)
};

interface CountryMarker {
  code: string;
  name: string;
  tokens: number;
  cost: number;
}

interface GlobeProps {
  markers?: CountryMarker[];
  size?: number;
  className?: string;
  userCountryCode?: string;
  forceDark?: boolean;
  scopeFilter?: "global" | "country";
}

// Project lat/lng to screen coordinates matching cobe's rendering
function latLngToScreen(
  lat: number,
  lng: number,
  phi: number,
  theta: number,
  size: number
): { x: number; y: number; visible: boolean } {
  // cobe uses: phi = longitude rotation, theta = latitude tilt
  // phi increases = globe rotates showing eastern longitudes

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  // Adjust longitude: subtract PI (cobe's coordinate system), ADD phi (same rotation direction as globe)
  const adjustedLng = lngRad - Math.PI + phi;

  // Spherical to Cartesian matching COBE's coordinate system
  const x = -Math.cos(latRad) * Math.cos(adjustedLng);
  const y = Math.sin(latRad);
  const z = Math.cos(latRad) * Math.sin(adjustedLng);

  // Apply theta tilt (rotation around X-axis)
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const y2 = y * cosT - z * sinT;
  const z2 = y * sinT + z * cosT;

  // Orthographic projection to screen
  const radius = size * 0.45;
  const screenX = size / 2 + x * radius;
  const screenY = size / 2 - y2 * radius;

  return { x: screenX, y: screenY, visible: z2 > 0 };
}

export function Globe({
  markers = [],
  size = 400,
  className = "",
  userCountryCode,
  forceDark,
  scopeFilter = "global",
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const userDotRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const rotationRef = useRef(0);
  const themeIsDark = useTheme();
  const isDark = forceDark ?? themeIsDark;

  const maxTokens = Math.max(...markers.map((m) => m.tokens), 1);
  const userCoords = userCountryCode ? COUNTRY_COORDINATES[userCountryCode.toUpperCase()] : null;

  // Calculate user's country dot size based on usage
  const userMarker = markers.find(
    (m) => userCountryCode && m.code.toUpperCase() === userCountryCode.toUpperCase()
  );
  const userDotSize = userMarker
    ? Math.max(8, Math.min(16, 8 + (userMarker.tokens / maxTokens) * 8)) // 8px ~ 16px
    : 10;
  const pulseRingSize = userDotSize * 2.5; // 펄스 링은 점 크기의 2.5배

  const updateUserDot = useCallback(
    (phi: number, theta: number) => {
      if (!userDotRef.current || !userCoords) return;

      const { x, y } = latLngToScreen(userCoords[0], userCoords[1], phi, theta, size);

      userDotRef.current.style.left = `${x}px`;
      userDotRef.current.style.top = `${y}px`;

      // Update pulse ring position
      if (pulseRingRef.current) {
        pulseRingRef.current.style.left = `${x}px`;
        pulseRingRef.current.style.top = `${y}px`;
      }
    },
    [userCoords, size]
  );

  useEffect(() => {
    let phi = 0;
    const theta = 0.3;

    // Create a map of country codes with usage data
    const usageByCountry = new Map(markers.map((m) => [m.code.toUpperCase(), m.tokens]));

    // Create markers for ALL countries (base dots + usage-based sizing)
    const globeMarkers = Object.entries(COUNTRY_COORDINATES)
      .filter(([code]) => !userCountryCode || code !== userCountryCode.toUpperCase())
      .map(([code, coords]) => {
        const [lat, lng] = coords;
        const tokens = usageByCountry.get(code) || 0;
        // Base size: 0.025 for all countries, scales up to 0.13 based on usage
        const normalizedSize = tokens > 0 ? 0.035 + (tokens / maxTokens) * 0.1 : 0.025; // Visible base dot for countries without usage
        return {
          location: [lat, lng] as [number, number],
          size: normalizedSize,
        };
      });

    // Theme-aware globe settings
    const globeConfig = isDark
      ? {
          // Dark mode: dark blue globe
          dark: 1,
          diffuse: 1.5,
          mapBrightness: 4,
          baseColor: [0.12, 0.18, 0.28] as [number, number, number],
          markerColor: [1, 0.5, 0.2] as [number, number, number],
          glowColor: [0.5, 0.5, 0.5] as [number, number, number],
        }
      : {
          // Light mode: warm beige/cream globe
          dark: 0,
          diffuse: 2,
          mapBrightness: 6,
          baseColor: [0.85, 0.8, 0.75] as [number, number, number],
          markerColor: [0.85, 0.45, 0.3] as [number, number, number],
          glowColor: [0.9, 0.85, 0.8] as [number, number, number],
        };

    // Optimize rendering based on device capability
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // Cap at 1.5 for performance
    const mapSamples = size >= 300 ? 8000 : 6000; // Reduce samples for smaller globes

    const globe = createGlobe(canvasRef.current!, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi: 0,
      theta: theta,
      ...globeConfig,
      mapSamples,
      markers: globeMarkers,
      onRender: (state) => {
        if (!pointerInteracting.current) {
          phi += 0.00147; // 15% faster rotation
        }
        state.phi = phi + rotationRef.current;
        state.width = size * dpr;
        state.height = size * dpr;

        // Update user's country dot position
        updateUserDot(state.phi, theta);
      },
    } as COBEOptions);

    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = "1";
      }
    }, 100);

    return () => {
      globe.destroy();
    };
  }, [markers, maxTokens, size, userCountryCode, updateUserDot, isDark]);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-0 transition-opacity duration-500"
        style={{
          contain: "layout paint size",
          cursor: "grab",
          touchAction: "none", // Prevent browser gestures (back/forward swipe)
        }}
        onPointerDown={(e) => {
          e.preventDefault(); // Prevent browser navigation gestures
          pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
          // Capture pointer to continue receiving events even outside canvas
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grabbing";
          }
        }}
        onPointerUp={(e) => {
          pointerInteracting.current = null;
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grab";
          }
        }}
        onPointerMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta;
            rotationRef.current = delta / 200;
          }
        }}
      />

      {/* User's country green dot overlay with pulse effect */}
      {userCoords && (
        <>
          {/* Pulse ring - size based on usage, opacity based on filter */}
          <div
            ref={pulseRingRef}
            className={`absolute pointer-events-none transition-all duration-500 ${scopeFilter === "country" ? "animate-pulse-ring" : ""}`}
            style={{
              width: pulseRingSize,
              height: pulseRingSize,
              borderRadius: "50%",
              border: `2px solid ${scopeFilter === "country" ? "#10b981" : "rgba(16, 185, 129, 0.3)"}`,
              transform: "translate(-50%, -50%)",
            }}
          />
          {/* Main dot - size based on usage, glow based on filter */}
          <div
            ref={userDotRef}
            className={`absolute pointer-events-none transition-all duration-500 ${scopeFilter === "country" ? "animate-pulse-glow" : ""}`}
            style={{
              width: userDotSize,
              height: userDotSize,
              borderRadius: "50%",
              backgroundColor: scopeFilter === "country" ? "#10b981" : "rgba(16, 185, 129, 0.4)",
              boxShadow:
                scopeFilter === "country"
                  ? "0 0 8px #10b981, 0 0 16px #10b981, 0 0 24px #10b981"
                  : "0 0 4px rgba(16, 185, 129, 0.3)",
              transform: "translate(-50%, -50%)",
            }}
          />
        </>
      )}
    </div>
  );
}
