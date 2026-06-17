import * as THREE from 'three';
import { bigScrubEcosystem } from './speciesConfig.js'; 

const terrainCache = new Map();

let shaderTime = 0;
function updateTerrainShaders() {
    shaderTime += 0.015;
    terrainCache.forEach((mesh) => {
        if (mesh.material.userData.shader) {
            mesh.material.userData.shader.uniforms.uTime.value = shaderTime;
        }
    });
    requestAnimationFrame(updateTerrainShaders);
}
updateTerrainShaders(); 

export async function loadLocalTerrain(remnantId, anchorPosition, scene) {
    if (terrainCache.has(remnantId)) return terrainCache.get(remnantId);

    const totalSpecies = bigScrubEcosystem.length;
    const gondwanaCount = bigScrubEcosystem.filter(s => s.origin === "Gondwana").length;
    const gondwanaRatio = gondwanaCount / totalSpecies; 

    // Cloudflare Edge Cache lock
    const r2Url = `https://ilonka.io/${remnantId}/remnant_${remnantId}.xyz?v=final`;
    const loader = new THREE.FileLoader();

    try {
        const rawData = await loader.loadAsync(r2Url);
        const lines = rawData.split('\n');
        
        // 🛡️ THE SAFETY VALVE: Protects the browser from massive 200MB+ files!
        const MAX_POINTS = 150000;
        const samplingStep = lines.length > MAX_POINTS ? Math.ceil(lines.length / MAX_POINTS) : 1; 

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        // --- PASS 1: Get Raw ELVIS Bounds ---
        for (let i = 0; i < lines.length; i += samplingStep) {
            const line = lines[i].trim();
            if (!line) continue;

            const coords = line.split(/[\s,]+/); 
            if (coords.length >= 3) {
                const x = parseFloat(coords[0]); // Easting
                const y = parseFloat(coords[1]); // Northing
                const z = parseFloat(coords[2]); // Elevation

                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    if (z < minZ) minZ = z;
                    if (z > maxZ) maxZ = z;
                }
            }
        }

        const xDelta = maxX - minX;
        const yDelta = maxY - minY; 
        const zDelta = maxZ - minZ;
        
        const centerX = minX + (xDelta / 2);
        const centerY = minY + (yDelta / 2); 

        const positions = [];
        const normYArray = []; 
        const randomArray = []; 

        // 🎯 THE DIORAMA SCALE: Blows the 3D trees up to look huge and majestic!
        const finalScale = 0.035;  

        // --- PASS 2: Assemble Buffers ---
        for (let i = 0; i < lines.length; i += samplingStep) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const coords = line.split(/[\s,]+/);
            if (coords.length >= 3) {
                const x = parseFloat(coords[0]);
                const y = parseFloat(coords[1]);
                const z = parseFloat(coords[2]);

                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    
                    // Center the 3D model on itself so it can be blown up perfectly
                    const localX = x - centerX;
                    const localY = z - minZ;       
                    const localZ = -(y - centerY); 

                    positions.push(localX, localY, localZ);
                    normYArray.push(zDelta > 0 ? localY / zDelta : 0.5);
                    randomArray.push(Math.random());
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('aNormY', new THREE.Float32BufferAttribute(normYArray, 1));
        geometry.setAttribute('aRandom', new THREE.Float32BufferAttribute(randomArray, 1));

        const material = new THREE.PointsMaterial({
            size: 0.12, // 🎯 Large enough to create a glowing canopy!
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending, 
            depthWrite: false, 
            sizeAttenuation: true
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uGondwanaRatio = { value: gondwanaRatio };
            material.userData.shader = shader;

            shader.vertexShader = `
                uniform float uTime;
                uniform float uGondwanaRatio;
                attribute float aNormY;
                attribute float aRandom;
                varying vec3 vCustomColor;
                varying float vAlphaFade; 

                vec3 hsl2rgb(vec3 c) {
                    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
                    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
                }
                ${shader.vertexShader}
            `.replace(
                `#include <begin_vertex>`,
                `
                #include <begin_vertex>
                
                vec3 groundColor = hsl2rgb(vec3(0.35, 0.60, 0.08)); 
                vec3 gondwanaColor = hsl2rgb(vec3(0.35 + (aRandom * 0.04), 0.90, 0.45));
                vec3 malesianColor = hsl2rgb(vec3(0.55 + (aRandom * 0.04), 0.95, 0.50));
                
                float wave = sin(position.x * 0.35 + uTime) + cos(position.z * 0.35 + uTime * 0.7);
                wave = (wave + 2.0) / 4.0; 
                
                float isGondwana = wave < uGondwanaRatio ? 1.0 : 0.0;
                vec3 canopyColor = mix(malesianColor, gondwanaColor, isGondwana);
                
                if (aRandom < 0.3) {
                    canopyColor *= 0.6; 
                } else if (aRandom > 0.7) {
                    canopyColor += 0.2; 
                }
                
                float heightMix = smoothstep(0.2, 0.8, aNormY); 
                vCustomColor = mix(groundColor, canopyColor, heightMix);
                
                vAlphaFade = smoothstep(0.0, 0.08, aNormY);
                `
            );

            shader.fragmentShader = `
                varying vec3 vCustomColor;
                varying float vAlphaFade; 
                ${shader.fragmentShader}
            `.replace(
                `vec4 diffuseColor = vec4( diffuse, opacity );`,
                `
                vec2 coord = gl_PointCoord - vec2(0.5);
                float dist = length(coord);
                float glow = exp(-dist * dist * 14.0); 
                
                if (glow < 0.05) discard; 
                
                vec4 diffuseColor = vec4( vCustomColor, opacity * glow * vAlphaFade );
                `
            );
        };

        const terrainPoints = new THREE.Points(geometry, material);
        
        // 🎯 TOWERING HEIGHT: Elevates the canopy significantly over the map
        const heightExaggeration = 6.0; 
        terrainPoints.scale.set(finalScale, finalScale * heightExaggeration, finalScale);
        
        // 🎯 ANCHORED: Pins the giant diorama piece perfectly to the map shape's center
        terrainPoints.position.set(anchorPosition.x, 0.15, anchorPosition.z);

        scene.add(terrainPoints);
        terrainCache.set(remnantId, terrainPoints);

        let frame = 0;
        function fade() {
            frame++;
            material.opacity = THREE.MathUtils.lerp(0, 0.45, frame / 60);
            if (frame < 60) requestAnimationFrame(fade);
        }
        fade();

        console.log(`Successfully mapped Majestic layer for Remnant ${remnantId}`);
        return terrainPoints;

    } catch (error) {
        console.error(`Error loading canopy dataset:`, error);
        return null;
    }
}