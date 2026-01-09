"use client";

import { useEffect, useRef, useCallback } from "react";
import createGlobe, { COBEOptions } from "cobe";

// Country coordinates (lat, lng)
export const COUNTRY_COORDINATES: Record<string, [number, number]> = {
  KR: [37.5665, 126.978], // South Korea (Seoul)
  US: [37.0902, -95.7129], // United States
  JP: [35.6762, 139.6503], // Japan (Tokyo)
  DE: [52.52, 13.405], // Germany (Berlin)
  GB: [51.5074, -0.1278], // United Kingdom (London)
  FR: [48.8566, 2.3522], // France (Paris)
  CN: [39.9042, 116.4074], // China (Beijing)
  IN: [28.6139, 77.209], // India (New Delhi)
  BR: [-15.7975, -47.8919], // Brazil (Brasilia)
  CA: [45.4215, -75.6972], // Canada (Ottawa)
  AU: [-35.2809, 149.13], // Australia (Canberra)
  RU: [55.7558, 37.6173], // Russia (Moscow)
  IT: [41.9028, 12.4964], // Italy (Rome)
  ES: [40.4168, -3.7038], // Spain (Madrid)
  MX: [19.4326, -99.1332], // Mexico (Mexico City)
  NL: [52.3676, 4.9041], // Netherlands (Amsterdam)
  SE: [59.3293, 18.0686], // Sweden (Stockholm)
  SG: [1.3521, 103.8198], // Singapore
  HK: [22.3193, 114.1694], // Hong Kong
  TW: [25.033, 121.5654], // Taiwan (Taipei)
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

export function Globe({ markers = [], size = 400, className = "", userCountryCode }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const userDotRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const rotationRef = useRef(0);

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

      const { x, y, visible } = latLngToScreen(userCoords[0], userCoords[1], phi, theta, size);

      userDotRef.current.style.left = `${x}px`;
      userDotRef.current.style.top = `${y}px`;
      userDotRef.current.style.opacity = visible ? "1" : "0.15";

      // Update pulse ring position
      if (pulseRingRef.current) {
        pulseRingRef.current.style.left = `${x}px`;
        pulseRingRef.current.style.top = `${y}px`;
        pulseRingRef.current.style.opacity = visible ? "1" : "0";
      }
    },
    [userCoords, size]
  );

  useEffect(() => {
    let phi = 0;
    const theta = 0.3;

    // Exclude user's country from orange markers (will be shown as green overlay)
    const globeMarkers = markers
      .filter((m) => COUNTRY_COORDINATES[m.code])
      .filter((m) => !userCountryCode || m.code.toUpperCase() !== userCountryCode.toUpperCase())
      .map((m) => {
        const [lat, lng] = COUNTRY_COORDINATES[m.code]!;
        const normalizedSize = 0.03 + (m.tokens / maxTokens) * 0.1;
        return {
          location: [lat, lng] as [number, number],
          size: normalizedSize,
        };
      });

    const globe = createGlobe(canvasRef.current!, {
      devicePixelRatio: 2,
      width: size * 2,
      height: size * 2,
      phi: 0,
      theta: theta,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [1, 0.5, 0.2],
      glowColor: [0.2, 0.2, 0.2],
      markers: globeMarkers,
      onRender: (state) => {
        if (!pointerInteracting.current) {
          phi += 0.002; // 30% slower (was 0.003)
        }
        state.phi = phi + rotationRef.current;
        state.width = size * 2;
        state.height = size * 2;

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
  }, [markers, maxTokens, size, userCountryCode, updateUserDot]);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-0 transition-opacity duration-500"
        style={{
          contain: "layout paint size",
          cursor: "grab",
        }}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grabbing";
          }
        }}
        onPointerUp={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grab";
          }
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grab";
          }
        }}
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta;
            rotationRef.current = delta / 200;
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta;
            rotationRef.current = delta / 100;
          }
        }}
      />

      {/* Glow effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(229, 115, 89, 0.1) 0%, transparent 60%)",
        }}
      />

      {/* User's country green dot overlay with pulse effect */}
      {userCoords && (
        <>
          {/* Pulse ring - size based on usage */}
          <div
            ref={pulseRingRef}
            className="absolute pointer-events-none animate-pulse-ring"
            style={{
              width: pulseRingSize,
              height: pulseRingSize,
              borderRadius: "50%",
              border: "2px solid #10b981",
              transform: "translate(-50%, -50%)",
            }}
          />
          {/* Main dot - size based on usage */}
          <div
            ref={userDotRef}
            className="absolute pointer-events-none transition-opacity duration-200 animate-pulse-glow"
            style={{
              width: userDotSize,
              height: userDotSize,
              borderRadius: "50%",
              backgroundColor: "#10b981",
              boxShadow: "0 0 6px #10b981, 0 0 12px #10b981",
              transform: "translate(-50%, -50%)",
            }}
          />
        </>
      )}
    </div>
  );
}
