import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const WebGLParticleBackground: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>();

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        // Niebla lejana para profundidad
        scene.fog = new THREE.FogExp2('#020617', 0.0015);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 250;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Optimización agresiva móvil
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); 
        mountRef.current.appendChild(renderer.domElement);

        // Lectura de variables CSS de Tailwind del tema actual
        const rootStyles = getComputedStyle(document.documentElement);
        const getBrandColor = (varName: string, fallback: string) => {
            const rgb = rootStyles.getPropertyValue(varName).trim();
            if (rgb) {
                const parts = rgb.split(' ');
                if (parts.length === 3) {
                     return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
                }
            }
            return fallback;
        };

        const primaryColor = new THREE.Color(getBrandColor('--color-brand-primary-rgb', '#00A3A0'));
        const accentColor = new THREE.Color(getBrandColor('--color-brand-accent-rgb', '#F57F20'));

        // Partículas (Nodos)
        const isMobile = window.innerWidth < 768;
        const particleCount = isMobile ? 150 : 400;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const colorObj = new THREE.Color();

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 800; // x
            positions[i * 3 + 1] = (Math.random() - 0.5) * 800; // y
            positions[i * 3 + 2] = (Math.random() - 0.5) * 800; // z

            // Mezclar colores corporativos en las partículas
            colorObj.lerpColors(primaryColor, accentColor, Math.random());
            colors[i * 3] = colorObj.r;
            colors[i * 3 + 1] = colorObj.g;
            colors[i * 3 + 2] = colorObj.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 2.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        // Matrices Abstractas (Simulando Red de Conexiones)
        const coreGeometry = new THREE.IcosahedronGeometry(120, 1);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: accentColor,
            wireframe: true,
            transparent: true,
            opacity: 0.06
        });
        const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
        scene.add(coreMesh);

        const coreGeometry2 = new THREE.IcosahedronGeometry(180, 2);
        const coreMaterial2 = new THREE.MeshBasicMaterial({
            color: primaryColor,
            wireframe: true,
            transparent: true,
            opacity: 0.04
        });
        const coreMesh2 = new THREE.Mesh(coreGeometry2, coreMaterial2);
        scene.add(coreMesh2);

        // Interacción Suave
        let mouseX = 0;
        let mouseY = 0;

        const onDocumentMouseMove = (event: MouseEvent) => {
            if (isMobile) return; // Desactivar en móvil
            mouseX = (event.clientX - window.innerWidth / 2) * 0.03;
            mouseY = (event.clientY - window.innerHeight / 2) * 0.03;
        };
        document.addEventListener('mousemove', onDocumentMouseMove);

        const onWindowResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onWindowResize);

        // Bucle Principal
        const animate = () => {
            requestRef.current = requestAnimationFrame(animate);

            // Rotación Partículas
            particles.rotation.x += 0.0002;
            particles.rotation.y += 0.0005;

            // Rotación Core Networks
            coreMesh.rotation.x -= 0.001;
            coreMesh.rotation.y += 0.002;
            
            coreMesh2.rotation.z -= 0.0005;
            coreMesh2.rotation.y -= 0.001;

            // Suavizado de Cámara
            camera.position.x += (mouseX - camera.position.x) * 0.05;
            camera.position.y += (-mouseY - camera.position.y) * 0.05;
            camera.lookAt(scene.position);

            renderer.render(scene, camera);
        };

        animate();

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            window.removeEventListener('resize', onWindowResize);
            document.removeEventListener('mousemove', onDocumentMouseMove);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            coreGeometry.dispose();
            coreMaterial.dispose();
            coreGeometry2.dispose();
            coreMaterial2.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <div 
            ref={mountRef} 
            className="absolute inset-0 z-0 bg-slate-950 pointer-events-none"
        />
    );
};

export default WebGLParticleBackground;
