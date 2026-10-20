import * as THREE from 'three';
import { bigScrubEcosystem } from './speciesConfig.js'; 

// Cache meshes by remnantId so returning to an active reserve is instantaneous
const terrainCache = new Map();
// Cache raw ASCII string data so density switching doesn't re-download 56.5 MB
const rawTextCache = new Map();
// Configuration state
const remnantSettings = new Map();

// Calibrated per-remnant diorama configurations based on live site production settings
export const REMNANT_DIORAMA_CONFIGS = {
    '1': { scale: 0.045, heightMultiplier: 6.0, pointSize: 0.15, opacity: 0.35, defaultStep: 1 }, // Victoria Park (~180k pts)
    '2': { scale: 0.045, heightMultiplier: 6.0, pointSize: 0.15, opacity: 0.35, defaultStep: 1 }, // Booyong (~135k pts)
    '3': { scale: 0.030, heightMultiplier: 6.0, pointSize: 0.13, opacity: 0.20, defaultStep: 1 }, // Big Scrub Flora Reserve (180k pts, airy live geometry, gentle opacity)
    '4': { scale: 0.035, heightMultiplier: 6.0, pointSize: 0.12, opacity: 0.15, defaultStep: 1 }, // Minyon Falls (~140k pts)
    '5': { scale: 0.045, heightMultiplier: 6.0, pointSize: 0.15, opacity: 0.35, defaultStep: 2 }  // Boomerang Falls (~128k pts from 257k)
};

export function getDioramaConfig(remnantId, width = 0, height = 0) {
    const idStr = String(remnantId);
    if (REMNANT_DIORAMA_CONFIGS[idStr]) {
        return REMNANT_DIORAMA_CONFIGS[idStr];
    }
    const maxDim = Math.max(width, height);
    return {
        scale: maxDim > 0 ? (24.0 / maxDim) : 0.035,
        heightMultiplier: 6.0,
        pointSize: 0.14,
        opacity: 0.30,
        defaultStep: 1
    };
}

let shaderTime = 0;
function updateTerrainShaders() {
    shaderTime += 0.015;
    terrainCache.forEach((mesh) => {
        if (mesh && mesh.material && mesh.material.userData && mesh.material.userData.shader) {
            mesh.material.userData.shader.uniforms.uTime.value = shaderTime;
        }
    });
    if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(updateTerrainShaders);
    }
}
if (typeof window !== 'undefined') {
    updateTerrainShaders(); 
}

/**
 * Creates the ethereal "Ghost Trees" canopy point cloud from ASCII XYZ text.
 * Uses high-performance typed buffer construction (zero string splitting / regex overhead)
 * and a custom holographic shader featuring canopy wind sway, emergent crown starlight
 * highlights, and ancestral Gondwana / Indo-Malesian genetic lineage waves.
 * 
 * Accurately geo-referenced to sit directly inside the remnant's contour on the Big Scrub map.
 */
export function createTerrainFromText(rawData, remnantId, anchorPosition, scene, options = {}) {
    if (!rawData || !scene) return null;
    const idStr = String(remnantId);

    if (terrainCache.has(idStr)) {
        const old = terrainCache.get(idStr);
        scene.remove(old);
        if (old.geometry) old.geometry.dispose();
        if (old.material) old.material.dispose();
        terrainCache.delete(idStr);
    }

    rawTextCache.set(idStr, rawData);

    const totalSpecies = bigScrubEcosystem.length;
    const gondwanaCount = bigScrubEcosystem.filter(s => s.origin === "Gondwana" || s.lineage === "Gondwana").length;
    const gondwanaRatio = totalSpecies > 0 ? (gondwanaCount / totalSpecies) : 0.535;

    let cfg = getDioramaConfig(idStr);

    // Retrieve or initialize settings for this remnant
    if (!remnantSettings.has(idStr)) {
        remnantSettings.set(idStr, {
            samplingStep: options.samplingStep || cfg.defaultStep || 1,
            ghostWind: options.ghostWind !== undefined ? options.ghostWind : 1.0,
            pointSize: options.pointSize || cfg.pointSize,
            opacity: options.opacity || cfg.opacity
        });
    }
    const currentSettings = remnantSettings.get(idStr);
    if (options.samplingStep !== undefined) currentSettings.samplingStep = options.samplingStep;
    if (options.ghostWind !== undefined) currentSettings.ghostWind = options.ghostWind;
    if (options.pointSize !== undefined) currentSettings.pointSize = options.pointSize;
    if (options.opacity !== undefined) currentSettings.opacity = options.opacity;

    let samplingStep = Math.max(1, currentSettings.samplingStep);
    const len = rawData.length;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let pointCount = 0;
    let lineIndex = 0;
    let hasColorColumns = false;

    // --- PASS 1: Fast character scan to find bounds, count points, and check columns ---
    let p = 0;
    while (p < len) {
        // Skip leading whitespace / newlines
        while (p < len && rawData.charCodeAt(p) <= 32) p++;
        if (p >= len) break;

        // Skip comments (# or /)
        if (rawData.charCodeAt(p) === 35 || rawData.charCodeAt(p) === 47) {
            while (p < len && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) p++;
            continue;
        }

        let s = p;
        while (p < len && rawData.charCodeAt(p) > 32 && rawData.charCodeAt(p) !== 44) p++;
        const x = parseFloat(rawData.slice(s, p));

        while (p < len && (rawData.charCodeAt(p) <= 32 || rawData.charCodeAt(p) === 44) && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) p++;
        s = p;
        while (p < len && rawData.charCodeAt(p) > 32 && rawData.charCodeAt(p) !== 44) p++;
        const y = parseFloat(rawData.slice(s, p));

        while (p < len && (rawData.charCodeAt(p) <= 32 || rawData.charCodeAt(p) === 44) && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) p++;
        s = p;
        while (p < len && rawData.charCodeAt(p) > 32 && rawData.charCodeAt(p) !== 44) p++;
        const z = parseFloat(rawData.slice(s, p));

        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            if (lineIndex === 0) {
                // Check if 4th column exists (RGB or intensity)
                while (p < len && (rawData.charCodeAt(p) <= 32 || rawData.charCodeAt(p) === 44) && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) p++;
                if (p < len && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) {
                    hasColorColumns = true;
                }
            }
            if (lineIndex % samplingStep === 0) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                pointCount++;
            }
            lineIndex++;
        }

        // Fast forward to end of line
        while (p < len && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) p++;
    }

    if (pointCount === 0) {
        console.warn(`No valid 3D points found in rawData for Remnant ${remnantId}`);
        return null;
    }

    const zDelta = Math.max(0.001, maxZ - minZ);

    cfg = getDioramaConfig(idStr, maxX - minX, maxY - minY);

    // Scale and elevation calculations (exact live site geometry)
    const originX = minX + (maxX - minX) / 2;
    const originY = minY + (maxY - minY) / 2;
    const scaleFactor = cfg.scale || 0.030;
    const heightMult = 6.0;

    // Direct pre-allocation of typed buffers
    const positions = new Float32Array(pointCount * 3);
    const normYArray = new Float32Array(pointCount);
    const randomArray = new Float32Array(pointCount);

    // --- PASS 2: Populate Typed Buffers directly ---
    p = 0;
    lineIndex = 0;
    let posIdx = 0;
    let attrIdx = 0;

    while (p < len && attrIdx < pointCount) {
        while (p < len && rawData.charCodeAt(p) <= 32) p++;
        if (p >= len) break;

        if (rawData.charCodeAt(p) === 35 || rawData.charCodeAt(p) === 47) {
            while (p < len && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) p++;
            continue;
        }

        let s = p;
        while (p < len && rawData.charCodeAt(p) > 32 && rawData.charCodeAt(p) !== 44) p++;
        const x = parseFloat(rawData.slice(s, p));

        while (p < len && (rawData.charCodeAt(p) <= 32 || rawData.charCodeAt(p) === 44) && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) p++;
        s = p;
        while (p < len && rawData.charCodeAt(p) > 32 && rawData.charCodeAt(p) !== 44) p++;
        const y = parseFloat(rawData.slice(s, p));

        while (p < len && (rawData.charCodeAt(p) <= 32 || rawData.charCodeAt(p) === 44) && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) p++;
        s = p;
        while (p < len && rawData.charCodeAt(p) > 32 && rawData.charCodeAt(p) !== 44) p++;
        const z = parseFloat(rawData.slice(s, p));

        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            if (lineIndex % samplingStep === 0) {
                // (e - v) * b, (r - p) * b * 6, -(t - y) * b from live site
                positions[posIdx++] = (x - originX) * scaleFactor;
                positions[posIdx++] = ((z - minZ) * scaleFactor * heightMult);
                positions[posIdx++] = -((y - originY) * scaleFactor);

                normYArray[attrIdx] = zDelta > 0 ? (z - minZ) / zDelta : 0.5;
                randomArray[attrIdx] = Math.random();
                attrIdx++;
            }
            lineIndex++;
        }

        while (p < len && rawData.charCodeAt(p) !== 10 && rawData.charCodeAt(p) !== 13) p++;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aNormY', new THREE.BufferAttribute(normYArray, 1));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randomArray, 1));

    // Live site calibrated opacity and point size (gently lightened for remnant 3):
    const liveOpacities = { '1': 0.35, '2': 0.35, '3': 0.20, '4': 0.15, '5': 0.35 };
    const liveSizes = { '1': 0.15, '2': 0.15, '3': 0.13, '4': 0.12, '5': 0.15 };
    const targetOpacity = currentSettings.opacity !== undefined ? currentSettings.opacity : (liveOpacities[idStr] || cfg.opacity || 0.20);
    const activePointSize = currentSettings.pointSize !== undefined ? currentSettings.pointSize : (liveSizes[idStr] || cfg.pointSize || 0.13);

    // Ghost Trees Holographic Additive point cloud material
    const material = new THREE.PointsMaterial({
        size: activePointSize,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
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

            vec3 groundColor = hsl2rgb(vec3(0.35, 0.80, 0.08));
            vec3 gondwanaColor = hsl2rgb(vec3(0.35 + (aRandom * 0.04), 0.95, 0.48));
            vec3 malesianColor = hsl2rgb(vec3(0.55 + (aRandom * 0.04), 1.0, 0.52));

            float wave = sin(position.x * 12.0 + uTime) + cos(position.z * 12.0 + uTime * 0.7);
            wave = (wave + 2.0) / 4.0;

            float isGondwana = wave < uGondwanaRatio ? 1.0 : 0.0;
            vec3 canopyColor = mix(malesianColor, gondwanaColor, isGondwana);

            if (aRandom < 0.3) {
                canopyColor *= 0.5;
            } else if (aRandom > 0.8) {
                canopyColor += 0.3;
            }

            float structureMultiplier = 0.5 + (smoothstep(0.2, 0.9, aNormY) * 1.5);
            float heightMix = smoothstep(0.1, 0.7, aNormY);
            vCustomColor = mix(groundColor, canopyColor, heightMix) * structureMultiplier;
            vAlphaFade = smoothstep(0.0, 0.05, aNormY);
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
            if (dist > 0.5) discard;

            float glow = exp(-dist * dist * 14.0);
            vec4 diffuseColor = vec4( vCustomColor, opacity * glow * vAlphaFade );
            `
        );
    };

    const terrainPoints = new THREE.Points(geometry, material);
    
    // Position diorama at the remnant anchor coordinates on the Big Scrub map (y = 0.15 above floor)
    terrainPoints.position.set(anchorPosition.x, 0.15, anchorPosition.z);
    terrainPoints.renderOrder = 10;

    terrainPoints.userData = {
        pointCount: attrIdx,
        samplingStep: samplingStep,
        remnantId: idStr,
        anchorPosition: anchorPosition,
        targetOpacity: targetOpacity
    };

    scene.add(terrainPoints);
    terrainCache.set(idStr, terrainPoints);

    // Smooth subtle entry transition
    let fadeStep = 0;
    const startOp = targetOpacity * 0.5;
    material.opacity = startOp;
    function fadeIn() {
        fadeStep++;
        material.opacity = THREE.MathUtils.lerp(startOp, targetOpacity, fadeStep / 15);
        if (fadeStep < 15) {
            if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(fadeIn);
        }
    }
    fadeIn();

    console.log(`🌲 Ghost Trees LiDAR canopy online for Remnant ${idStr} (${attrIdx.toLocaleString()} spectral points at step ${samplingStep})`);
    return terrainPoints;
}

/**
 * Loads a LiDAR remnant point cloud from Cloudflare R2 edge network.
 * Features:
 *  - Live streaming progress reporting via onProgress callback
 *  - CDN Edge caching without forced cache-busting on standard requests
 *  - Instant memory cache when returning to an active reserve
 */
export async function loadLocalTerrain(remnantId, anchorPosition, scene, onProgress = null, options = {}) {
    if (!remnantId || !scene) return null;
    const idStr = String(remnantId);

    // Check memory cache first
    if (!options.forceReload && terrainCache.has(idStr)) {
        const cached = terrainCache.get(idStr);
        cached.visible = true;
        if (cached.material) {
            cached.material.opacity = cached.userData.targetOpacity || 0.35;
        }
        if (onProgress) onProgress(100, 100, "Loaded from instant cache");
        return cached;
    }

    // Check raw text cache (e.g. if switching density without re-downloading)
    if (!options.forceReload && rawTextCache.has(idStr)) {
        if (onProgress) onProgress(100, 100, "Synthesizing Ghost Trees canopy from cache...");
        return createTerrainFromText(rawTextCache.get(idStr), idStr, anchorPosition, scene, options);
    }

    // Standard Cloudflare edge CDN endpoints (with cache bypass version)
    let urlsToTry = [
        `https://ilonka.io/${idStr}/remnant_${idStr}.xyz?v=20261020`,
        `https://ilonka.io/${idStr}/remnant_${idStr}.xyz`,
        `https://ilonka.io/${idStr}/remnant_${idStr}.xyz?v=final`
    ];
    if (options.forceReload) {
        const t = Date.now();
        urlsToTry = [
            `https://ilonka.io/${idStr}/remnant_${idStr}.xyz?t=${t}`,
            ...urlsToTry
        ];
    }

    for (const url of urlsToTry) {
        try {
            if (onProgress) onProgress(0, 100, "Connecting to Cloudflare edge CDN...");
            const response = await fetch(url, { cache: 'no-cache' });
            if (!response.ok) {
                console.warn(`URL returned status ${response.status}: ${url}`);
                continue;
            }

            const contentLengthHeader = response.headers.get('content-length');
            const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 4500000;

            let fullText = null;
            if (response.body && typeof response.body.getReader === 'function') {
                try {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder('utf-8');
                    let receivedBytes = 0;
                    let textChunks = [];

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        receivedBytes += value.byteLength;
                        textChunks.push(decoder.decode(value, { stream: true }));

                        if (onProgress && totalBytes > 0) {
                            const mbLoaded = (receivedBytes / (1024 * 1024)).toFixed(1);
                            const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1);
                            onProgress(
                                receivedBytes,
                                totalBytes,
                                `Streaming LiDAR: ${mbLoaded} / ${mbTotal} MB (${Math.min(100, Math.round((receivedBytes / totalBytes) * 100))}%)`
                            );
                        }
                    }
                    textChunks.push(decoder.decode());
                    fullText = textChunks.join('');
                } catch (streamErr) {
                    console.warn(`Stream reading error on ${url}, fetching directly:`, streamErr);
                    const directResp = await fetch(url, { cache: 'no-cache' });
                    fullText = await directResp.text();
                }
            } else {
                fullText = await response.text();
            }

            if (!fullText || fullText.length < 100) {
                console.warn(`Empty or truncated text from ${url}`);
                continue;
            }

            if (onProgress) onProgress(totalBytes, totalBytes, "Synthesizing Ghost Trees canopy...");
            try {
                const terrainObj = createTerrainFromText(fullText, idStr, anchorPosition, scene, options);
                if (terrainObj) {
                    return terrainObj;
                }
            } catch (err) {
                console.error(`Error constructing Ghost Trees mesh for Remnant ${idStr}:`, err);
                return null;
            }
        } catch (err) {
            console.warn(`Failed loading from ${url}:`, err);
        }
    }

    console.error(`Could not load remnant ${idStr} from Cloudflare.`);
    if (onProgress) onProgress(0, 0, "Network error: Unable to load LiDAR file.");
    return null;
}

// Toggle ghost wind sway on/off
export function setGhostWind(remnantId, enabled) {
    const idStr = String(remnantId);
    if (!remnantSettings.has(idStr)) {
        remnantSettings.set(idStr, { samplingStep: 1, ghostWind: 1.0, pointSize: 0.14 });
    }
    const settings = remnantSettings.get(idStr);
    settings.ghostWind = enabled ? 1.0 : 0.0;

    const mesh = terrainCache.get(idStr);
    if (mesh && mesh.material && mesh.material.userData && mesh.material.userData.shader) {
        mesh.material.userData.shader.uniforms.uGhostWind.value = settings.ghostWind;
    }
    return settings.ghostWind > 0;
}

// Toggle between ethereal, lush, and full scan densities
export function toggleGhostDensity(remnantId, scene) {
    const idStr = String(remnantId);
    const cfg = getDioramaConfig(idStr);
    if (!remnantSettings.has(idStr)) {
        remnantSettings.set(idStr, { samplingStep: cfg.defaultStep || 1, ghostWind: 1.0, pointSize: cfg.pointSize, opacity: cfg.opacity });
    }
    const settings = remnantSettings.get(idStr);
    let newStep = 1;
    let newOpacity = cfg.opacity;

    if (idStr === '3') {
        // Remnant 3 has 1,507,168 raw points (37.7 MB)
        // Cycle: Step 16 (Ethereal ~94k) -> Step 11 (Lush ~137k) -> Step 7 (Maximum ~215k) -> Step 16
        if (settings.samplingStep === 16) {
            newStep = 11;
            newOpacity = 0.10;
        } else if (settings.samplingStep === 11) {
            newStep = 7;
            newOpacity = 0.07;
        } else {
            newStep = 16;
            newOpacity = 0.13;
        }
    } else {
        // Standard remnants (~140k - 260k raw points)
        // Cycle: Step 1 (Full scan ~140k-260k) -> Step 2 (Ethereal ~70k-130k)
        if (settings.samplingStep === 1) {
            newStep = 2;
            newOpacity = Math.min(0.48, (cfg.opacity || 0.35) * 1.25);
        } else {
            newStep = 1;
            newOpacity = cfg.opacity || 0.35;
        }
    }
    settings.samplingStep = newStep;
    settings.opacity = newOpacity;

    const mesh = terrainCache.get(idStr);
    if (mesh && rawTextCache.has(idStr)) {
        const anchorPos = mesh.userData.anchorPosition;
        return createTerrainFromText(rawTextCache.get(idStr), idStr, anchorPos, scene, {
            samplingStep: newStep,
            ghostWind: settings.ghostWind,
            opacity: newOpacity
        });
    }
    return null;
}

export function getRemnantSettings(remnantId) {
    const idStr = String(remnantId);
    return remnantSettings.get(idStr) || { samplingStep: 1, ghostWind: 1.0, pointSize: 0.14, opacity: 0.35 };
}

// Alias for backwards compatibility
export const loadCanopyPointCloud = loadLocalTerrain;

export function hideAllTerrains() {
    terrainCache.forEach((mesh) => {
        if (mesh) mesh.visible = false;
    });
}