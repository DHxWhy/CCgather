"use client";

import React, { useRef, useEffect, ReactNode } from "react";
import * as THREE from "three";

export interface SynapseBackgroundProps {
  children?: ReactNode;
  particleCount?: number;
  lineColor?: number;
  particleColor?: number;
  pulseColor?: number;
  connectionDistance?: number;
  className?: string;
}

const SynapseBackground: React.FC<SynapseBackgroundProps> = ({
  children,
  particleCount = 800,
  lineColor = 0xda7756, // Claude coral
  particleColor = 0xffffff, // White nodes
  pulseColor = 0xf5c4b0, // Claude peach for hover
  connectionDistance = 100,
  className = "",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mountRef.current || rendererRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 1000);
    camera.position.z = 300;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create circular particle texture
    const createCircleTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;

      // Soft glowing circle
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.3)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(32, 32, 32, 0, Math.PI * 2);
      ctx.fill();

      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };

    // Build particles
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = Math.random() * 600 - 300;
      positions[i * 3 + 1] = Math.random() * 600 - 300;
      positions[i * 3 + 2] = Math.random() * 400 - 200;

      const c = new THREE.Color(particleColor);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = Math.random() * 3 + 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const circleTexture = createCircleTexture();

    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 4,
        map: circleTexture,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    scene.add(pts);

    // Build lines connecting nearby particles
    const linePos: number[] = [];
    const pArr = Array.from(geo.attributes.position!.array);

    for (let i = 0; i < particleCount; i++) {
      for (let j = i + 1; j < particleCount; j++) {
        const ix = i * 3, jx = j * 3;
        const dx = (pArr[ix] ?? 0) - (pArr[jx] ?? 0);
        const dy = (pArr[ix + 1] ?? 0) - (pArr[jx + 1] ?? 0);
        const dz = (pArr[ix + 2] ?? 0) - (pArr[jx + 2] ?? 0);
        const dist = Math.hypot(dx, dy, dz);
        if (dist < connectionDistance) {
          linePos.push(
            pArr[ix] ?? 0, pArr[ix + 1] ?? 0, pArr[ix + 2] ?? 0,
            pArr[jx] ?? 0, pArr[jx + 1] ?? 0, pArr[jx + 2] ?? 0
          );
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePos), 3));

    const lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(lines);

    // Mouse interaction
    const mouse = new THREE.Vector2(-100, -100);
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    container.addEventListener("mousemove", onMouseMove);

    // Resize handler
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Very slow rotation
      scene.rotation.y += 0.00008;
      scene.rotation.x += 0.00003;

      // Mouse pulse effect
      const mv = new THREE.Vector3(mouse.x, mouse.y, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      const dist = -camera.position.z / mv.z;
      const ptr = camera.position.clone().add(mv.multiplyScalar(dist));

      const colArr = geo.attributes.color!.array as Float32Array;
      const base = new THREE.Color(particleColor);
      const pulseClr = new THREE.Color(pulseColor);

      for (let i = 0; i < particleCount; i++) {
        const ix = i * 3;
        const dx = (pArr[ix] ?? 0) - ptr.x;
        const dy = (pArr[ix + 1] ?? 0) - ptr.y;
        const t = Math.max(0, 1 - Math.hypot(dx, dy) / 120);
        const mix = base.clone().lerp(pulseClr, t * 0.8);
        const curr = new THREE.Color().fromArray(colArr, ix);
        curr.lerp(mix, 0.05).toArray(colArr, ix);
      }
      geo.attributes.color!.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      container.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        const canvasEl = container.querySelector("canvas");
        if (canvasEl) container.removeChild(canvasEl);
        rendererRef.current = null;
      }

      geo.dispose();
      lineGeo.dispose();
      circleTexture.dispose();
    };
  }, [particleCount, lineColor, particleColor, pulseColor, connectionDistance]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />
      {children && <div className="relative z-10 w-full h-full">{children}</div>}
    </div>
  );
};

export default SynapseBackground;
