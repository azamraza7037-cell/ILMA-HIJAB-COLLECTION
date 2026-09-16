'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

export default function ParticleCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);

  useEffect(() => {
    if (!mountRef.current || typeof window === 'undefined') return;

    if (!isWebGLAvailable()) {
      setWebGLSupported(false);
      return;
    }

    let renderer: any = null;
    let scene: any = null;
    let camera: any = null;
    let animationFrameId: number | null = null;
    let particleGeometry: any = null;
    let ringGeo: any = null;
    let torusGeo: any = null;
    let goldMaterial: any = null;
    let pointMat: any = null;

    let onMouseMove: ((event: MouseEvent) => void) | null = null;
    let onWindowResize: (() => void) | null = null;

    try {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Scene Setup
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.z = 5;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      if (mountRef.current) {
        mountRef.current.appendChild(renderer.domElement);
      }

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      
      const pointLight = new THREE.PointLight(0xC9A96E, 2, 10);
      pointLight.position.set(0, 0, 2);
      scene.add(pointLight);

      // Materials
      goldMaterial = new THREE.MeshStandardMaterial({
        color: 0xC9A96E,
        roughness: 0.2,
        metalness: 0.8,
        transparent: true,
        opacity: 0.6,
      });

      // Particles (Buffer Geometry)
      const particleCount = 200;
      particleGeometry = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);
      const particlePhases = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 15;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 15;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
        particlePhases[i] = Math.random() * Math.PI * 2;
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particleGeometry.setAttribute('phase', new THREE.BufferAttribute(particlePhases, 1));
      
      pointMat = new THREE.PointsMaterial({
        color: 0xC9A96E,
        size: 0.04,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
      });

      const particleSystem = new THREE.Points(particleGeometry, pointMat);
      scene.add(particleSystem);

      // Geometric Elements
      const elements: any[] = [];

      // 8 Octagonal Stars
      ringGeo = new THREE.RingGeometry(0.1, 0.15, 8);
      for (let i = 0; i < 8; i++) {
        const mesh = new THREE.Mesh(ringGeo, goldMaterial);
        mesh.position.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 5 - 1
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        scene.add(mesh);
        elements.push(mesh);
      }

      // 3 Crescents
      torusGeo = new THREE.TorusGeometry(0.2, 0.05, 16, 32, Math.PI);
      for (let i = 0; i < 3; i++) {
        const mesh = new THREE.Mesh(torusGeo, goldMaterial);
        mesh.position.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 5 - 1
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        scene.add(mesh);
        elements.push(mesh);
      }

      // Mouse Interaction for parallax
      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;

      onMouseMove = (event: MouseEvent) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      };

      window.addEventListener('mousemove', onMouseMove, { passive: true });

      // Animation Loop
      const clock = new THREE.Clock();

      const animate = () => {
        if (!renderer || !scene || !camera) return;
        animationFrameId = requestAnimationFrame(animate);

        const time = clock.getElapsedTime();

        if (!prefersReducedMotion && particleGeometry) {
          const positions = particleGeometry.attributes.position.array as Float32Array;
          const phases = particleGeometry.attributes.phase.array as Float32Array;
          
          for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3 + 1] += 0.003;
            positions[i3] += Math.sin(time + phases[i]) * 0.002;

            if (positions[i3 + 1] > 7.5) {
              positions[i3 + 1] = -7.5;
            }
          }
          particleGeometry.attributes.position.needsUpdate = true;

          elements.forEach((mesh, index) => {
            mesh.rotation.x += 0.001 * (index % 2 === 0 ? 1 : -1);
            mesh.rotation.y += 0.002 * (index % 3 === 0 ? 1 : -1);
          });

          targetX = mouseX * 0.2;
          targetY = mouseY * 0.2;
          
          camera.position.x += (targetX - camera.position.x) * 0.05;
          camera.position.y += (targetY - camera.position.y) * 0.05;
          camera.lookAt(scene.position);
        } else {
          camera.lookAt(scene.position);
        }

        renderer.render(scene, camera);
      };

      animate();

      // Resize Handler
      onWindowResize = () => {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('resize', onWindowResize, { passive: true });
    } catch (err) {
      console.warn('Three.js ParticleCanvas WebGL initialization error handled safely:', err);
      setWebGLSupported(false);
    }

    // Cleanup
    return () => {
      try {
        if (onMouseMove) window.removeEventListener('mousemove', onMouseMove);
        if (onWindowResize) window.removeEventListener('resize', onWindowResize);
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        
        if (mountRef.current && renderer?.domElement && mountRef.current.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
        
        if (scene) scene.clear();
        if (particleGeometry) particleGeometry.dispose();
        if (ringGeo) ringGeo.dispose();
        if (torusGeo) torusGeo.dispose();
        if (goldMaterial) goldMaterial.dispose();
        if (pointMat) pointMat.dispose();
        if (renderer) renderer.dispose();
      } catch (cleanupErr) {
        console.warn('ParticleCanvas cleanup notice:', cleanupErr);
      }
    };
  }, []);

  if (!webGLSupported) {
    return (
      <div className="absolute inset-0 w-full h-full pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/60" />
    );
  }

  return (
    <div 
      ref={mountRef} 
      className="absolute inset-0 w-full h-full pointer-events-none" 
    />
  );
}
