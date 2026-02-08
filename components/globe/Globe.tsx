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

// Country coordinates (lat, lng) - 175 Anthropic-supported countries
// Source: https://www.anthropic.com/supported-countries
export const COUNTRY_COORDINATES: Record<string, [number, number]> = {
  // A
  AL: [41.3275, 19.8187], // Albania (Tirana)
  DZ: [36.7538, 3.0588], // Algeria (Algiers)
  AD: [42.5063, 1.5218], // Andorra (Andorra la Vella)
  AO: [-8.839, 13.2894], // Angola (Luanda)
  AG: [17.1274, -61.8468], // Antigua and Barbuda (St. John's)
  AR: [-34.6037, -58.3816], // Argentina (Buenos Aires)
  AM: [40.1792, 44.4991], // Armenia (Yerevan)
  AU: [-35.2809, 149.13], // Australia (Canberra)
  AT: [48.2082, 16.3738], // Austria (Vienna)
  AZ: [40.4093, 49.8671], // Azerbaijan (Baku)
  // B
  BS: [25.048, -77.3554], // Bahamas (Nassau)
  BH: [26.2285, 50.586], // Bahrain (Manama)
  BD: [23.8103, 90.4125], // Bangladesh (Dhaka)
  BB: [13.1132, -59.5988], // Barbados (Bridgetown)
  BE: [50.8503, 4.3517], // Belgium (Brussels)
  BZ: [17.251, -88.759], // Belize (Belmopan)
  BJ: [6.4969, 2.6283], // Benin (Porto-Novo)
  BT: [27.4728, 89.639], // Bhutan (Thimphu)
  BO: [-16.4897, -68.1193], // Bolivia (La Paz)
  BA: [43.8563, 18.4131], // Bosnia and Herzegovina (Sarajevo)
  BW: [-24.6282, 25.9231], // Botswana (Gaborone)
  BR: [-15.7975, -47.8919], // Brazil (Brasilia)
  BN: [4.9031, 114.9398], // Brunei (Bandar Seri Begawan)
  BG: [42.6977, 23.3219], // Bulgaria (Sofia)
  BF: [12.3714, -1.5197], // Burkina Faso (Ouagadougou)
  BI: [-3.3761, 29.3599], // Burundi (Gitega)
  // C
  CV: [14.9315, -23.5087], // Cabo Verde (Praia)
  KH: [11.5564, 104.9282], // Cambodia (Phnom Penh)
  CM: [3.848, 11.5021], // Cameroon (Yaoundé)
  CA: [45.4215, -75.6972], // Canada (Ottawa)
  TD: [12.1348, 15.0557], // Chad (N'Djamena)
  CL: [-33.4489, -70.6693], // Chile (Santiago)
  CO: [4.711, -74.0721], // Colombia (Bogotá)
  KM: [-11.7172, 43.2473], // Comoros (Moroni)
  CG: [-4.2634, 15.2429], // Congo (Brazzaville)
  CR: [9.9281, -84.0907], // Costa Rica (San José)
  CI: [6.8276, -5.2893], // Côte d'Ivoire (Yamoussoukro)
  HR: [45.815, 15.9819], // Croatia (Zagreb)
  CY: [35.1856, 33.3823], // Cyprus (Nicosia)
  CZ: [50.0755, 14.4378], // Czech Republic (Prague)
  // D
  DK: [55.6761, 12.5683], // Denmark (Copenhagen)
  DJ: [11.5721, 43.1456], // Djibouti (Djibouti)
  DM: [15.3017, -61.3881], // Dominica (Roseau)
  DO: [18.4861, -69.9312], // Dominican Republic (Santo Domingo)
  // E
  EC: [-0.1807, -78.4678], // Ecuador (Quito)
  EG: [30.0444, 31.2357], // Egypt (Cairo)
  SV: [13.6929, -89.2182], // El Salvador (San Salvador)
  GQ: [3.7523, 8.7742], // Equatorial Guinea (Malabo)
  EE: [59.437, 24.7536], // Estonia (Tallinn)
  SZ: [-26.3054, 31.1367], // Eswatini (Mbabane)
  // F
  FJ: [-18.1416, 178.4419], // Fiji (Suva)
  FI: [60.1699, 24.9384], // Finland (Helsinki)
  FR: [48.8566, 2.3522], // France (Paris)
  // G
  GA: [0.4162, 9.4673], // Gabon (Libreville)
  GM: [13.4549, -16.579], // Gambia (Banjul)
  GE: [41.7151, 44.8271], // Georgia (Tbilisi)
  DE: [52.52, 13.405], // Germany (Berlin)
  GH: [5.6037, -0.187], // Ghana (Accra)
  GR: [37.9838, 23.7275], // Greece (Athens)
  GD: [12.0561, -61.7486], // Grenada (St. George's)
  GT: [14.6349, -90.5069], // Guatemala (Guatemala City)
  GN: [9.6412, -13.5784], // Guinea (Conakry)
  GW: [11.8637, -15.598], // Guinea-Bissau (Bissau)
  GY: [6.8013, -58.1551], // Guyana (Georgetown)
  // H
  HT: [18.5944, -72.3074], // Haiti (Port-au-Prince)
  HN: [14.065, -87.1715], // Honduras (Tegucigalpa)
  HU: [47.4979, 19.0402], // Hungary (Budapest)
  // I
  IS: [64.1466, -21.9426], // Iceland (Reykjavik)
  IN: [28.6139, 77.209], // India (New Delhi)
  ID: [-6.2088, 106.8456], // Indonesia (Jakarta)
  IQ: [33.3152, 44.3661], // Iraq (Baghdad)
  IE: [53.3498, -6.2603], // Ireland (Dublin)
  IL: [31.7683, 35.2137], // Israel (Jerusalem)
  IT: [41.9028, 12.4964], // Italy (Rome)
  // J
  JM: [18.0179, -76.8099], // Jamaica (Kingston)
  JP: [35.6762, 139.6503], // Japan (Tokyo)
  JO: [31.9454, 35.9284], // Jordan (Amman)
  // K
  KZ: [51.1694, 71.4491], // Kazakhstan (Astana)
  KE: [-1.2921, 36.8219], // Kenya (Nairobi)
  KI: [1.3382, 172.9784], // Kiribati (Tarawa)
  KR: [37.5665, 126.978], // South Korea (Seoul)
  KW: [29.3759, 47.9774], // Kuwait (Kuwait City)
  KG: [42.8746, 74.5698], // Kyrgyzstan (Bishkek)
  // L
  LA: [17.9757, 102.6331], // Laos (Vientiane)
  LV: [56.9496, 24.1052], // Latvia (Riga)
  LB: [33.8938, 35.5018], // Lebanon (Beirut)
  LS: [-29.3142, 27.4833], // Lesotho (Maseru)
  LR: [6.2907, -10.7605], // Liberia (Monrovia)
  LI: [47.141, 9.5209], // Liechtenstein (Vaduz)
  LT: [54.6872, 25.2797], // Lithuania (Vilnius)
  LU: [49.6116, 6.1319], // Luxembourg (Luxembourg)
  // M
  MG: [-18.8792, 47.5079], // Madagascar (Antananarivo)
  MW: [-13.9626, 33.7741], // Malawi (Lilongwe)
  MY: [3.139, 101.6869], // Malaysia (Kuala Lumpur)
  MV: [4.1755, 73.5093], // Maldives (Malé)
  MT: [35.8989, 14.5146], // Malta (Valletta)
  MH: [7.1164, 171.1858], // Marshall Islands (Majuro)
  MR: [18.0735, -15.9582], // Mauritania (Nouakchott)
  MU: [-20.1609, 57.5012], // Mauritius (Port Louis)
  MX: [19.4326, -99.1332], // Mexico (Mexico City)
  FM: [6.9248, 158.161], // Micronesia (Palikir)
  MD: [47.0105, 28.8638], // Moldova (Chișinău)
  MC: [43.7384, 7.4246], // Monaco (Monaco)
  MN: [47.8864, 106.9057], // Mongolia (Ulaanbaatar)
  ME: [42.4304, 19.2594], // Montenegro (Podgorica)
  MA: [33.9716, -6.8498], // Morocco (Rabat)
  MZ: [-25.9692, 32.5732], // Mozambique (Maputo)
  // N
  NA: [-22.5609, 17.0658], // Namibia (Windhoek)
  NR: [-0.5228, 166.9315], // Nauru (Yaren)
  NP: [27.7172, 85.324], // Nepal (Kathmandu)
  NL: [52.3676, 4.9041], // Netherlands (Amsterdam)
  NZ: [-41.2866, 174.7756], // New Zealand (Wellington)
  NE: [13.5116, 2.1254], // Niger (Niamey)
  NG: [9.0765, 7.3986], // Nigeria (Abuja)
  MK: [41.9973, 21.428], // North Macedonia (Skopje)
  NO: [59.9139, 10.7522], // Norway (Oslo)
  // O
  OM: [23.588, 58.3829], // Oman (Muscat)
  // P
  PK: [33.6844, 73.0479], // Pakistan (Islamabad)
  PW: [7.515, 134.5825], // Palau (Ngerulmud)
  PS: [31.9038, 35.2034], // Palestine (Ramallah)
  PA: [8.9824, -79.5199], // Panama (Panama City)
  PG: [-9.4438, 147.1803], // Papua New Guinea (Port Moresby)
  PY: [-25.2637, -57.5759], // Paraguay (Asunción)
  PE: [-12.0464, -77.0428], // Peru (Lima)
  PH: [14.5995, 120.9842], // Philippines (Manila)
  PL: [52.2297, 21.0122], // Poland (Warsaw)
  PT: [38.7223, -9.1393], // Portugal (Lisbon)
  // Q
  QA: [25.2854, 51.531], // Qatar (Doha)
  // R
  RO: [44.4268, 26.1025], // Romania (Bucharest)
  RW: [-1.9403, 29.8739], // Rwanda (Kigali)
  // S
  KN: [17.3026, -62.7177], // Saint Kitts and Nevis (Basseterre)
  LC: [14.0101, -60.987], // Saint Lucia (Castries)
  VC: [13.1587, -61.2248], // Saint Vincent and the Grenadines (Kingstown)
  WS: [-13.8506, -171.7514], // Samoa (Apia)
  SM: [43.9424, 12.4578], // San Marino (San Marino)
  ST: [0.3365, 6.7273], // São Tomé and Príncipe (São Tomé)
  SA: [24.7136, 46.6753], // Saudi Arabia (Riyadh)
  SN: [14.7167, -17.4677], // Senegal (Dakar)
  RS: [44.7866, 20.4489], // Serbia (Belgrade)
  SC: [-4.6191, 55.4513], // Seychelles (Victoria)
  SL: [8.4657, -13.2317], // Sierra Leone (Freetown)
  SG: [1.3521, 103.8198], // Singapore
  SK: [48.1486, 17.1077], // Slovakia (Bratislava)
  SI: [46.0569, 14.5058], // Slovenia (Ljubljana)
  SB: [-9.4295, 160.0388], // Solomon Islands (Honiara)
  ZA: [-25.7479, 28.2293], // South Africa (Pretoria)
  ES: [40.4168, -3.7038], // Spain (Madrid)
  LK: [6.9271, 79.8612], // Sri Lanka (Colombo)
  SR: [5.852, -55.2038], // Suriname (Paramaribo)
  SE: [59.3293, 18.0686], // Sweden (Stockholm)
  CH: [46.948, 7.4474], // Switzerland (Bern)
  // T
  TW: [25.033, 121.5654], // Taiwan (Taipei)
  TJ: [38.5598, 68.774], // Tajikistan (Dushanbe)
  TZ: [-6.163, 35.7516], // Tanzania (Dodoma)
  TH: [13.7563, 100.5018], // Thailand (Bangkok)
  TL: [-8.5569, 125.5603], // Timor-Leste (Dili)
  TG: [6.1256, 1.2254], // Togo (Lomé)
  TO: [-21.2148, -175.1982], // Tonga (Nuku'alofa)
  TT: [10.6549, -61.5019], // Trinidad and Tobago (Port of Spain)
  TN: [36.8065, 10.1815], // Tunisia (Tunis)
  TR: [39.9334, 32.8597], // Türkiye (Ankara)
  TM: [37.9601, 58.3261], // Turkmenistan (Ashgabat)
  TV: [-8.5199, 179.1979], // Tuvalu (Funafuti)
  // U
  UG: [0.3476, 32.5825], // Uganda (Kampala)
  UA: [50.4501, 30.5234], // Ukraine (Kyiv)
  AE: [24.4539, 54.3773], // United Arab Emirates (Abu Dhabi)
  GB: [51.5074, -0.1278], // United Kingdom (London)
  US: [37.0902, -95.7129], // United States
  UY: [-34.9011, -56.1645], // Uruguay (Montevideo)
  UZ: [41.2995, 69.2401], // Uzbekistan (Tashkent)
  // V
  VU: [-17.7333, 168.3273], // Vanuatu (Port Vila)
  VA: [41.9029, 12.4534], // Vatican City (Vatican City)
  VN: [21.0285, 105.8542], // Vietnam (Hanoi)
  // Z
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
  autoRotate?: boolean;
  initialPhi?: number;
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
  autoRotate = true,
  initialPhi = 0,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const userDotRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const rotationRef = useRef(0);
  const themeIsDark = useTheme();
  const isDark = forceDark ?? themeIsDark;
  const scopeFilterRef = useRef(scopeFilter);
  const lastVisibleRef = useRef(true);
  scopeFilterRef.current = scopeFilter;

  const maxTokens = Math.max(...markers.map((m) => m.tokens), 1);
  const userCoords = userCountryCode ? COUNTRY_COORDINATES[userCountryCode.toUpperCase()] : null;

  // COBE markers - generated inside useEffect to avoid dependency issues
  // Marker size varies by theme (light mode needs larger markers for visibility)

  // Calculate user's country dot size based on usage
  const userMarker = markers.find(
    (m) => userCountryCode && m.code.toUpperCase() === userCountryCode.toUpperCase()
  );
  const userDotSize = userMarker
    ? Math.max(7, Math.min(12, 7 + (userMarker.tokens / maxTokens) * 5)) // 7px ~ 12px (balanced)
    : 7;
  const pulseRingSize = userDotSize * 2.0; // 펄스 링은 점 크기의 2배 (14-24px, balanced with mix-blend-mode)

  const updateUserDot = useCallback(
    (phi: number, theta: number) => {
      if (!userDotRef.current || !userCoords) return;

      const { x, y, visible } = latLngToScreen(userCoords[0], userCoords[1], phi, theta, size);

      userDotRef.current.style.left = `${x}px`;
      userDotRef.current.style.top = `${y}px`;

      // Update pulse ring position
      if (pulseRingRef.current) {
        pulseRingRef.current.style.left = `${x}px`;
        pulseRingRef.current.style.top = `${y}px`;
      }

      // Fade when going behind globe (only in country mode, only when visibility changes)
      if (scopeFilterRef.current === "country" && lastVisibleRef.current !== visible) {
        lastVisibleRef.current = visible;
        const dim = !visible;
        userDotRef.current.style.backgroundColor = dim ? "rgba(16, 185, 129, 0.35)" : "#10b981";
        userDotRef.current.style.boxShadow = dim
          ? "0 0 3px rgba(16, 185, 129, 0.2)"
          : "0 0 6px #10b981, 0 0 12px rgba(16, 185, 129, 0.5)";
        if (pulseRingRef.current) {
          pulseRingRef.current.style.borderColor = dim
            ? "rgba(16, 185, 129, 0.15)"
            : "rgba(16, 185, 129, 0.5)";
        }
      }
    },
    [userCoords, size]
  );

  useEffect(() => {
    let phi = initialPhi;
    const theta = 0.3;

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
          // Light mode: soft continent dots, prominent country markers
          dark: 0,
          diffuse: 2.2,
          mapBrightness: 1.2,
          baseColor: [0.94, 0.91, 0.87] as [number, number, number],
          markerColor: [0.9, 0.25, 0.15] as [number, number, number],
          glowColor: [0.96, 0.92, 0.88] as [number, number, number],
        };

    // Optimize rendering based on device capability
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // Cap at 1.5 for quality
    const mapSamples = 12000; // Optimized: balance between performance and visibility

    // Generate markers inside useEffect (light mode: larger for visibility)
    const markerSize = isDark ? 0.03 : 0.045;
    const japanMarker = { location: [35.6762, 139.6503] as [number, number], size: markerSize };
    const otherMarkers = Object.entries(COUNTRY_COORDINATES)
      .filter(([code]) => code !== "JP")
      .map(([, coords]) => ({
        location: [coords[0], coords[1]] as [number, number],
        size: markerSize,
      }));
    const globeMarkers = [japanMarker, ...otherMarkers];

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
        if (autoRotate && !pointerInteracting.current) {
          phi += 0.00154;
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
  }, [size, userCountryCode, updateUserDot, isDark]);

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
            className={`absolute pointer-events-none ${scopeFilter === "country" ? "animate-pulse-ring" : ""}`}
            style={{
              width: pulseRingSize,
              height: pulseRingSize,
              borderRadius: "50%",
              border: `1.5px solid ${scopeFilter === "country" ? "rgba(16, 185, 129, 0.6)" : "rgba(16, 185, 129, 0.25)"}`,
              transform: "translate(-50%, -50%)",
              transition: "border-color 0.3s, opacity 0.3s",
            }}
          />
          {/* Main dot - size based on usage, glow based on filter */}
          <div
            ref={userDotRef}
            className={`absolute pointer-events-none ${scopeFilter === "country" ? "animate-pulse-glow" : ""}`}
            style={{
              width: userDotSize,
              height: userDotSize,
              borderRadius: "50%",
              backgroundColor: scopeFilter === "country" ? "#10b981" : "rgba(16, 185, 129, 0.5)",
              boxShadow:
                scopeFilter === "country"
                  ? "0 0 8px #10b981, 0 0 16px rgba(16, 185, 129, 0.6)"
                  : "0 0 4px rgba(16, 185, 129, 0.3)",
              transform: "translate(-50%, -50%)",
              transition: "background-color 0.3s, box-shadow 0.3s",
            }}
          />
        </>
      )}
    </div>
  );
}
