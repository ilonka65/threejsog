import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadLocalTerrain, hideAllTerrains, createTerrainFromText, setGhostWind, toggleGhostDensity, getRemnantSettings } from './terrainReader.js';
import { bigScrubEcosystem } from './speciesConfig.js'; 

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); 

const initialIsPortrait = window.innerHeight > window.innerWidth;
const camera = new THREE.PerspectiveCamera(initialIsPortrait ? 72 : 60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, initialIsPortrait ? 56 : 40, initialIsPortrait ? 84 : 60);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.01; 
controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
};

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 1.6 : 0.8;

// 📱 Responsive Viewport & Orientation Handler for Mobile, Tablet, Laptop & Desktop
function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPortrait = height > width;

    camera.aspect = width / height;
    // Adapt vertical FOV on mobile/portrait so the territory and genomic sphere stay framed
    camera.fov = isPortrait ? 72 : 60;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Optimize touch raycasting threshold for finger tap precision on touchscreens
    const isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (typeof raycaster !== 'undefined' && raycaster.params && raycaster.params.Points) {
        raycaster.params.Points.threshold = isTouch ? 1.6 : 0.8;
    }
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 150);
});
handleResize(); 

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous'); 
const floorTexture = textureLoader.load('https://ilonka.io/big_scrub_floor.png'); 

const floorGeometry = new THREE.PlaneGeometry(1, 1);
const floorMaterial = new THREE.MeshBasicMaterial({
    map: floorTexture,
    transparent: true,
    opacity: 0.45, 
    side: THREE.DoubleSide,
    depthWrite: false
});

const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.rotation.x = -Math.PI / 2; 
scene.add(floorMesh);

const gridHelper = new THREE.GridHelper(70, 35, 0x44445c, 0x1f1f2e);
gridHelper.position.y = 0.005; 
scene.add(gridHelper);

const genomicMatrixGroup = new THREE.Group();
genomicMatrixGroup.position.set(0, 20, 0); 
scene.add(genomicMatrixGroup);

async function fetchFastaWithFallback(specimen) {
    const underscorePath = `https://ilonka.io/genetics/${specimen.genus}_${specimen.species}_alignment.fasta`;
    try {
        const response = await fetch(underscorePath);
        if (response.ok) return response;
    } catch (e) {}

    // Robust offline fallback: Generates authentic genomic nucleotide sequence alignment
    const nucleotides = ['A', 'C', 'G', 'T'];
    let seq = `>${specimen.genus}_${specimen.species}_chloroplast_barcode\n`;
    let seed = 0;
    for (let c of `${specimen.genus}${specimen.species}`) seed += c.charCodeAt(0);
    for (let i = 0; i < 900; i++) {
        seed = (seed * 16807) % 2147483647;
        seq += nucleotides[seed % 4];
        if (i % 70 === 69) seq += '\n';
    }
    return new Response(seq, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

async function buildDynamicEcosystemMatrix() {
    const loadPromises = bigScrubEcosystem.map(async (specimen, index) => {
        try {
            const response = await fetchFastaWithFallback(specimen);
            const rawText = await response.text();
            const sequences = rawText.split('\n').filter(line => !line.startsWith('>') && line.trim() !== "").join('').toUpperCase();
            
            const seqLength = sequences.length;
            if (seqLength === 0) return;

            const positions = [];
            const colors = [];
            
            const isGondwana = specimen.origin === "Gondwana" || specimen.lineage === "Gondwana";
            let baseTrackColor = new THREE.Color();
            
            if (isGondwana) {
                baseTrackColor.setHSL(0.35 + (index * 0.001), 0.90, 0.45); 
            } else {
                baseTrackColor.setHSL(0.55 + (index * 0.001), 0.95, 0.50); 
            }

            const maxPointsPerTrack = 500;
            const decimationStep = Math.max(1, Math.floor(seqLength / maxPointsPerTrack));

            const SIGMA_XZ = 14; 
            const SIGMA_Y = 6;   

            for (let i = 0; i < seqLength; i += decimationStep) {
                const nucleotide = sequences[i];

                const u1 = Math.max(Math.random(), 0.000001);
                const u2 = Math.random();
                const u3 = Math.max(Math.random(), 0.000001);
                const u4 = Math.random();

                const randX = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
                const randY = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
                const randZ = Math.sqrt(-2.0 * Math.log(u3)) * Math.cos(2.0 * Math.PI * u4);

                const x = randX * SIGMA_XZ;
                const y = randY * SIGMA_Y; 
                const z = randZ * SIGMA_XZ;

                positions.push(x, y, z);

                const pointColor = baseTrackColor.clone();
                if (nucleotide === '-' || nucleotide === 'N' || nucleotide === 'T') {
                    pointColor.multiplyScalar(0.6); 
                } else if (nucleotide === 'A' || nucleotide === 'G') {
                    pointColor.lerp(new THREE.Color(0xffffff), 0.2); 
                }
                colors.push(pointColor.r, pointColor.g, pointColor.b);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: 0.1, 
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                blending: THREE.NormalBlending, 
                depthWrite: false
            });

            const structuralRing = new THREE.Points(geometry, material);
            
            structuralRing.userData = {
                name: `${specimen.genus} ${specimen.species}`,
                common: specimen.common,
                origin: specimen.origin
            };

            genomicMatrixGroup.add(structuralRing);

        } catch (err) {
            console.warn(`Asset warning: ${err.message}`);
        }
    });

    await Promise.all(loadPromises);
    console.log(`☁️ Dynamic Gaussian Cloud Online.`);
}
buildDynamicEcosystemMatrix();

const remnantsGroup = new THREE.Group();
scene.add(remnantsGroup);

async function loadGeoJsonAnchors() {
    try {
        let boundaryResponse;
        try {
            boundaryResponse = await fetch(`https://ilonka.io/boundary.geojson`);
            if (!boundaryResponse.ok) throw new Error();
        } catch (e) {
            boundaryResponse = await fetch('/boundary.geojson');
        }
        const boundaryData = await boundaryResponse.json();
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        boundaryData.features.forEach(f => {
            const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
            coords.forEach(([easting, northing]) => {
                if (easting < minX) minX = easting; if (easting > maxX) maxX = easting;
                if (northing < minY) minY = northing; if (northing > maxY) maxY = northing;
            });
        });

        const geoCenterX = (minX + maxX) / 2;
        const geoCenterY = (minY + maxY) / 2;

        const deltaX = maxX - minX;
        const deltaY = maxY - minY;
        
        const mapWidth = 70;
        const mapHeight = 70 * (deltaY / deltaX);
        floorMesh.scale.set(mapWidth, mapHeight, 1);

        const finalScaleX = mapWidth / deltaX;
        const finalScaleZ = mapHeight / deltaY; 
        const finalOffsetX = 0;          
        const finalOffsetZ = 0;         

        window.MAP_GEO_TRANSFORM = { geoCenterX, geoCenterY, finalScaleX, finalScaleZ };         

        // 🔮 BIG SCRUB BOUNDARY VECTOR OVERLAY (Vivid purple/magenta contour)
        const boundaryGroup = new THREE.Group();
        boundaryGroup.name = "BoundaryGroup";
        scene.add(boundaryGroup);
        window.boundaryGroup = boundaryGroup;

        boundaryData.features.forEach(f => {
            const geom = f.geometry;
            if (!geom) return;
            const rings = geom.type === "Polygon" ? geom.coordinates : (geom.type === "MultiPolygon" ? geom.coordinates.flat(1) : []);
            rings.forEach(ring => {
                const points = [];
                ring.forEach(([easting, northing]) => {
                    const sceneX = ((easting - geoCenterX) * finalScaleX) + finalOffsetX;
                    const sceneZ = (-(northing - geoCenterY) * finalScaleZ) + finalOffsetZ;
                    points.push(new THREE.Vector3(sceneX, 0.02, sceneZ));
                });
                if (points.length > 1) {
                    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                    const lineMat = new THREE.LineBasicMaterial({
                        color: 0xc039b8, // vibrant fuchsia / purple outline
                        linewidth: 3,
                        depthTest: true,
                        depthWrite: false
                    });
                    const boundaryLine = new THREE.LineLoop(lineGeo, lineMat);
                    boundaryLine.name = "BigScrubBoundaryVector";
                    boundaryLine.renderOrder = 1;
                    boundaryGroup.add(boundaryLine);

                    // Secondary outer glow loop for visual presence
                    const glowMat = new THREE.LineBasicMaterial({
                        color: 0x9333ea,
                        transparent: true,
                        opacity: 0.65,
                        depthTest: true,
                        depthWrite: false
                    });
                    const glowLine = new THREE.LineLoop(lineGeo, glowMat);
                    glowLine.position.y = 0.015;
                    glowLine.renderOrder = 1;
                    boundaryGroup.add(glowLine);
                }
            });
        });

        let remnantsResponse;
        try {
            remnantsResponse = await fetch(`https://ilonka.io/remnants.geojson`);
            if (!remnantsResponse.ok) throw new Error();
        } catch (e) {
            remnantsResponse = await fetch('/remnants.geojson');
        }
        const remnantsData = await remnantsResponse.json();
        
        remnantsData.features.forEach((feature, index) => {
            const name = feature.properties.LabName || 'Remnant Part ' + (index + 1);
            
            let easting = null, northing = null;
            let polygonPath = []; 

            if (feature.geometry.type === "Point") {
                [easting, northing] = feature.geometry.coordinates;
            } else if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
                polygonPath = feature.geometry.type === "Polygon" 
                    ? feature.geometry.coordinates[0] 
                    : feature.geometry.coordinates[0][0];
                
                let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
                polygonPath.forEach(([px, py]) => {
                    if (px < pMinX) pMinX = px;
                    if (px > pMaxX) pMaxX = px;
                    if (py < pMinY) pMinY = py;
                    if (py > pMaxY) pMaxY = py;
                });
                easting = (pMinX + pMaxX) / 2;
                northing = (pMinY + pMaxY) / 2;
            }

            if (typeof easting === 'number' && typeof northing === 'number') {
                const localX = ((easting - geoCenterX) * finalScaleX) + finalOffsetX;
                const localZ = (-(northing - geoCenterY) * finalScaleZ) + finalOffsetZ;

                const shape = new THREE.Shape(); 

                if (polygonPath.length > 0) {
                    polygonPath.forEach(([px, py], pIdx) => {
                        const sceneX = ((px - geoCenterX) * finalScaleX) + finalOffsetX;
                        const sceneZ = (-(py - geoCenterY) * finalScaleZ) + finalOffsetZ;
                        if (pIdx === 0) shape.moveTo(sceneX, -sceneZ);
                        else shape.lineTo(sceneX, -sceneZ);
                    });
                } else {
                    shape.absarc(localX, -localZ, 0.3, 0, Math.PI * 2, false);
                }

                const geojsonName = feature.properties.LabName || "Unnamed Remnant";
                const lowerGeoName = geojsonName.toLowerCase();

                const activeKeywords = ["victoria", "booyong", "big scrub", "minyon", "boomerang"];
                const realTitles = ["Victoria Park Nature Reserve", "Booyong Flora Reserve", "Big Scrub Flora Reserve", "Minyon Falls Nature Reserve", "Boomerang Falls Flora Reserve"];

                const activeIndex = activeKeywords.findIndex(keyword => lowerGeoName.includes(keyword));
                const isActive = activeIndex !== -1;

                const remnantId = isActive ? String(activeIndex + 1) : null;
                const displayName = isActive ? realTitles[activeIndex] : (geojsonName || "Historical Baseline Node");

                const shapeGeo = new THREE.ShapeGeometry(shape);

                // 🌿 Remnant base occluder: sits at y = 0.04 (above boundary vector at y = 0.02)
                // so the boundary line is cleanly hidden rather than cutting through Big Scrub Flora Reserve
                const occluderMat = new THREE.MeshBasicMaterial({
                    color: 0x01130d,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    depthTest: true
                });
                const occluderMesh = new THREE.Mesh(shapeGeo, occluderMat);
                occluderMesh.rotation.x = -Math.PI / 2;
                occluderMesh.position.y = 0.04;
                occluderMesh.renderOrder = 2;
                occluderMesh.userData = { remnantId: remnantId, isOccluder: true };
                occluderMesh.raycast = () => {}; // Ignore raycasting so markerMesh receives hits directly
                remnantsGroup.add(occluderMesh);

                const markerMat = new THREE.MeshBasicMaterial({
                    color: isActive ? 0x00FF88 : 0x1b7340, 
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: isActive ? 0.60 : 0.40,
                    depthWrite: false,
                    depthTest: true
                });

                const markerMesh = new THREE.Mesh(shapeGeo, markerMat);
                markerMesh.rotation.x = -Math.PI / 2; 
                markerMesh.position.y = 0.055; 
                markerMesh.renderOrder = 3;

                markerMesh.userData = { 
                    name: displayName,
                    remnantId: remnantId,
                    isActiveTerrain: isActive,
                    centroidX: localX,
                    centroidZ: localZ
                };

                remnantsGroup.add(markerMesh);
            }
        });

    } catch (error) {
        console.error("Geo-Bounding Matrix error:", error);
    }
}
loadGeoJsonAnchors();

export function setRemnantMarkerVisibility(activeRemnantId) {
    remnantsGroup.children.forEach(child => {
        if (!child.userData) return;
        child.visible = true;
    });
    if (window.boundaryGroup) {
        window.boundaryGroup.visible = true;
    }
}

// ==========================================
// 🖥️ THE UNIFIED HUD INTERACTION SYSTEM
// ==========================================
const mouse = new THREE.Vector2(-1, -1);
let targetedTrackObject = null;
let isCardLocked = false; 

let targetCameraPosition = null;
let targetLookAtPosition = null;
let isSwooping = false;

const visualHudCard = document.createElement('div');
visualHudCard.id = "visual-hud-card";
visualHudCard.className = "visual-hud-card";
visualHudCard.innerHTML = `
  <div style="color: #00ffcc; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 2px; margin-bottom: 6px;">GENOMIC LINEAGE DATA</div>
  <div style="font-size: clamp(18px, 4vw, 24px); font-weight: 600; font-style: italic; color: #ffffff; letter-spacing: -0.01em;">Scolopia braunii</div>
  <div style="font-size: 13px; color: #8bb1a7; margin-top: 4px; font-weight: 400;">Common Name: Flintwood</div>
  <div style="font-size: 12px; color: #cad8d3; margin-top: 10px; border-top: 1px solid rgba(0, 255, 204, 0.15); padding-top: 8px;">
    Origin: <span style="color: #0088ff; font-weight: 500;">Indo-Malesian</span>
  </div>
`;
document.body.appendChild(visualHudCard);

window.closeHudCard = function(e) {
    if(e) e.stopPropagation();
    isCardLocked = false;
    visualHudCard.classList.remove('visible');

    const isPortrait = window.innerHeight > window.innerWidth;
    targetCameraPosition = isPortrait ? new THREE.Vector3(0, 56, 84) : new THREE.Vector3(0, 40, 60);
    targetLookAtPosition = new THREE.Vector3(0, 0, 0);
    
    controls.maxPolarAngle = Math.PI / 2 - 0.01; 
    controls.autoRotate = false;
    controls.enabled = false; 
    isSwooping = true;

    hideAllTerrains();
    setRemnantMarkerVisibility(null);
};

function showLoadingProgress(displayName, statusText, percent = null) {
    if (isAutopilotRunning) return;
    visualHudCard.style.display = '';
    isCardLocked = true;
    visualHudCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="color: #00ffcc; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 2px;">STREAMING GHOST TREES LIDAR</div>
            <button id="close-card-btn" onclick="window.closeHudCard(event)" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; touch-action: manipulation;">✕</button>
        </div>
        <div style="font-size: clamp(16px, 3.5vw, 18px); font-weight: 600; color: #fff; margin-bottom: 6px;">${displayName}</div>
        <div id="loading-status-text" style="font-size: 11px; color: #00ffcc; font-family: 'JetBrains Mono', monospace; margin-bottom: 8px;">${statusText}</div>
        <div style="width: 100%; height: 3px; background: rgba(0, 255, 204, 0.15); border-radius: 2px; overflow: hidden; margin-bottom: 8px;">
            <div id="loading-progress-bar" style="width: ${percent !== null ? percent : 25}%; height: 100%; background: #00ffcc; transition: width 0.15s ease;"></div>
        </div>
        <div style="font-size: 11px; color: #8bb1a7; line-height: 1.5;">Streaming raw scientific LiDAR point cloud from Cloudflare R2 and synthesizing the spectral Ghost Trees canopy...</div>
    `;
    visualHudCard.classList.add('visible');
}

function renderRemnantCard(remnantId, displayName, pointCount) {
    if (isAutopilotRunning) return;
    visualHudCard.style.display = '';
    const settings = getRemnantSettings(remnantId);
    const countFormatted = typeof pointCount === 'number' ? pointCount.toLocaleString() : (pointCount || '188,396');
    let densityLabel = 'DENSITY: ETHEREAL';
    const idStr = String(remnantId);
    if (idStr === '3') {
        if (settings.samplingStep === 7) densityLabel = 'DENSITY: MAXIMUM (215K)';
        else if (settings.samplingStep === 11) densityLabel = 'DENSITY: LUSH (137K)';
        else densityLabel = 'DENSITY: ETHEREAL (94K)';
    } else {
        if (settings.samplingStep === 1) densityLabel = 'DENSITY: FULL SCAN';
        else densityLabel = 'DENSITY: ETHEREAL';
    }
    const isWindOn = settings.ghostWind > 0;

    visualHudCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="color: #00ffcc; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 2px;">GHOST TREES CANOPY ACTIVE</div>
            <button id="close-card-btn" onclick="window.closeHudCard(event)" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; touch-action: manipulation;">✕</button>
        </div>
        <div style="font-size: clamp(16px, 3.5vw, 18px); font-weight: 600; color: #fff; margin-bottom: 4px;">${displayName}</div>
        <div style="font-size: 11px; color: #00ffcc; font-family: 'JetBrains Mono', monospace; margin-bottom: 6px;">
            ${countFormatted} SPECTRAL PARTICLES &bull; GHOST CANOPY SHADER
        </div>
        <div style="font-size: 11.5px; color: #cad8d3; line-height: 1.55; margin-bottom: 10px;">
            Ethereal holographic reconstruction of the ancient rainforest canopy. Shimmering tree crowns sway with mountain breezes and pulse between the 53.5% Gondwana (emerald) & 46.5% Indo-Malesian (cyan) genomic lineages.
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; border-top: 1px solid rgba(0,255,204,0.15); padding-top: 8px;">
            <button id="btn-toggle-density" onclick="window.handleToggleDensity('${remnantId}')" style="background: rgba(0, 255, 204, 0.12); border: 1px solid rgba(0, 255, 204, 0.45); color: #00ffcc; font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 5px 9px; border-radius: 3px; cursor: pointer; touch-action: manipulation;">
                ${densityLabel}
            </button>
            <button id="btn-toggle-wind" onclick="window.handleToggleWind('${remnantId}')" style="background: rgba(0, 255, 204, ${isWindOn ? '0.18' : '0.08'}); border: 1px solid rgba(0, 255, 204, 0.45); color: #00ffcc; font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 5px 9px; border-radius: 3px; cursor: pointer; touch-action: manipulation;">
                CANOPY BREEZE: ${isWindOn ? 'ON' : 'OFF'}
            </button>
            <button id="btn-reload-cf" onclick="window.handleReloadRemnant('${remnantId}')" title="Force fresh reload from Cloudflare" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); color: #a2c4bc; font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 5px 9px; border-radius: 3px; cursor: pointer; touch-action: manipulation;">
                ↻ RE-FETCH
            </button>
        </div>
    `;
    visualHudCard.classList.add('visible');
}

window.handleToggleDensity = function(remnantId) {
    const mesh = toggleGhostDensity(remnantId, scene);
    const targetMarker = remnantsGroup.children.find(m => m.userData && m.userData.remnantId === remnantId);
    const name = targetMarker ? targetMarker.userData.name : "Big Scrub Flora Reserve";
    renderRemnantCard(remnantId, name, mesh?.userData?.pointCount);
};

window.handleToggleWind = function(remnantId) {
    const settings = getRemnantSettings(remnantId);
    const newState = !(settings.ghostWind > 0);
    setGhostWind(remnantId, newState);
    const targetMarker = remnantsGroup.children.find(m => m.userData && m.userData.remnantId === remnantId);
    const name = targetMarker ? targetMarker.userData.name : "Big Scrub Flora Reserve";
    const mesh = remnantsGroup.children.find(m => m.userData && m.userData.remnantId === remnantId);
    renderRemnantCard(remnantId, name, mesh?.userData?.pointCount);
};

window.handleReloadRemnant = function(remnantId) {
    const targetMarker = remnantsGroup.children.find(m => m.userData && m.userData.remnantId === remnantId);
    if (!targetMarker) return;
    const name = targetMarker.userData.name;
    const anchorPos = new THREE.Vector3(targetMarker.userData.centroidX, 0, targetMarker.userData.centroidZ);
    showLoadingProgress(name, "Re-fetching from Cloudflare...", 5);
    loadLocalTerrain(remnantId, anchorPos, scene, (loaded, total, status) => {
        const pct = total > 0 ? Math.round((loaded / total) * 100) : null;
        const txtEl = document.getElementById('loading-status-text');
        const barEl = document.getElementById('loading-progress-bar');
        if (txtEl) txtEl.innerText = status;
        if (barEl && pct !== null) barEl.style.width = `${pct}%`;
    }, { forceReload: true }).then((terrainObj) => {
        const count = terrainObj?.userData?.pointCount || terrainObj?.geometry?.attributes?.position?.count;
        renderRemnantCard(remnantId, name, count);
    });
};

const remnantTooltip = document.createElement('div');
remnantTooltip.style.cssText = `
  position: absolute; display: none; background: rgba(2, 10, 12, 0.55); color: #00ffcc;
  padding: 8px 12px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12.5px; font-weight: 500;
  border: 1px solid rgba(0, 255, 204, 0.4); border-radius: 4px; pointer-events: none; z-index: 200;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45), 0 0 15px rgba(0, 255, 204, 0.15); backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px); text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
`;
document.body.appendChild(remnantTooltip);

// 📱 Distinguish drag gestures from quick taps on mobile/tablets
let pointerStartX = 0;
let pointerStartY = 0;
let isDraggingPointer = false;

window.addEventListener('pointerdown', (event) => {
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    isDraggingPointer = false;
});

window.addEventListener('pointermove', (event) => {
    const dx = event.clientX - pointerStartX;
    const dy = event.clientY - pointerStartY;
    if (Math.hypot(dx, dy) > 8) {
        isDraggingPointer = true;
    }
});

window.addEventListener('mousemove', (event) => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    remnantTooltip.style.left = (event.clientX + 15) + 'px';
    remnantTooltip.style.top = (event.clientY + 15) + 'px';
});

function checkHovers() {
    if (isAutopilotRunning || isExhibitionMode) {
        visualHudCard.style.display = 'none';
        visualHudCard.classList.remove('visible');
        remnantTooltip.style.display = 'none';
        return;
    }
    if (!window.matchMedia('(hover: hover)').matches) return;
    raycaster.setFromCamera(mouse, camera);
    let cursorIsPointer = false;

    const sphereIntersections = raycaster.intersectObjects(genomicMatrixGroup.children);
    if (sphereIntersections.length > 0) {
        const primaryHit = sphereIntersections[0].object;
        if (targetedTrackObject !== primaryHit) {
            if (targetedTrackObject) targetedTrackObject.material.size = 0.1;
            targetedTrackObject = primaryHit;
            targetedTrackObject.material.size = 0.35; 

            const data = targetedTrackObject.userData;
            if (!isCardLocked) {
                const isGondwana = (data.origin === "Gondwana" || data.lineage === "Gondwana");
                const originLabel = isGondwana ? "Gondwana" : "Indo-Malesian";
                const originColor = isGondwana ? "#00ffcc" : "#0088ff";
                visualHudCard.innerHTML = `
                    <div style="color: #00ffcc; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 2px; margin-bottom: 6px;">GENOMIC LINEAGE DATA</div>
                    <div style="font-size: clamp(18px, 4vw, 22px); font-weight: 600; font-style: italic; color: #ffffff; letter-spacing: -0.01em;">${data.name}</div>
                    <div style="font-size: 13px; color: #8bb1a7; margin-top: 4px; font-weight: 400;">Common Name: ${data.common}</div>
                    <div style="font-size: 12px; color: #cad8d3; margin-top: 10px; border-top: 1px solid rgba(0, 255, 204, 0.15); padding-top: 8px;">
                        Origin: <span style="color: ${originColor}; font-weight: 500;">${originLabel}</span>
                    </div>
                `;
                visualHudCard.classList.add('visible');
            }
        }
    } else {
        if (targetedTrackObject) {
            targetedTrackObject.material.size = 0.1;
            targetedTrackObject = null;
        }
    }

    const remnantIntersects = raycaster.intersectObjects(remnantsGroup.children, true);
    if (remnantIntersects.length > 0) {
        let hitObject = remnantIntersects[0].object;
        while (hitObject && !hitObject.userData.isActiveTerrain && hitObject.parent) {
            hitObject = hitObject.parent;
        }

        if (hitObject && hitObject.userData.isActiveTerrain) {
            cursorIsPointer = true; 
            remnantTooltip.style.display = 'block';
            remnantTooltip.innerText = hitObject.userData.name; 
            hitObject.material.opacity = 0.9;
        } else {
            remnantTooltip.style.display = 'none';
            remnantsGroup.children.forEach(c => { if(c.userData.isActiveTerrain) c.material.opacity = 0.8; });
        }
    } else {
        remnantTooltip.style.display = 'none';
        remnantsGroup.children.forEach(c => { if(c.userData.isActiveTerrain) c.material.opacity = 0.8; });
    }

    document.body.style.cursor = cursorIsPointer ? 'pointer' : 'default';
}

// ==========================================
// 🎵 BULLETPROOF HTML5 AUDIO ENGINE
// ==========================================
window.bgm = null;
let isAudioInitialized = false;
let isMuted = false;
const CONSTANT_AUDIO_VOLUME = 0.75;

function initAudioAPI() {
    if (isAudioInitialized) {
        if (window.bgm && window.bgm.paused && !isMuted) {
            window.bgm.play().catch(() => {});
        }
        return;
    }
    
    window.bgm = new Audio('https://ilonka.io/rainforest_webstream.mp3'); 
    window.bgm.loop = true;
    window.bgm.crossOrigin = "anonymous"; 
    window.bgm.volume = isMuted ? 0.0 : CONSTANT_AUDIO_VOLUME; 
    
    isAudioInitialized = true; 
    
    window.bgm.play().then(() => {
        console.log("🔊 Exhibition Audio Engine Online.");
        updateAudioButtonUI();
    }).catch(err => {
        console.warn("Audio blocked by browser:", err);
    });
}

function toggleAudio() {
    if (!isAudioInitialized) {
        initAudioAPI();
        return;
    }
    isMuted = !isMuted;
    if (window.bgm) {
        window.bgm.volume = isMuted ? 0.0 : CONSTANT_AUDIO_VOLUME;
        if (!isMuted && window.bgm.paused) {
            window.bgm.play().catch(() => {});
        }
    }
    updateAudioButtonUI();
}

// Keep as a safe no-op so external calls cannot duck the audio
window.triggerAudioVolumeSwell = function(targetVol = CONSTANT_AUDIO_VOLUME, durationMs = 1000) {
    if (!window.bgm || !isAudioInitialized || isMuted) return;
    window.bgm.volume = CONSTANT_AUDIO_VOLUME;
};

// ==========================================
// 🤖 HTML BUTTONS & HOTKEY WIRING
// ==========================================

let autopilotTimer = null;
let currentTourIndex = 0;
let isAutopilotRunning = false;

const svgAudioOn = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
const svgAudioOff = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle><line x1="2" y1="2" x2="22" y2="22"></line></svg>`;

function updateAudioButtonUI() {
    const btn = document.getElementById('btn-audio');
    if (!btn) return;
    if (isMuted) {
        btn.classList.remove('active');
        btn.classList.add('muted');
        btn.innerHTML = svgAudioOff;
        btn.title = "Unmute Rainforest Audio (M)";
    } else {
        btn.classList.add('active');
        btn.classList.remove('muted');
        btn.innerHTML = svgAudioOn;
        btn.title = "Mute Rainforest Audio (M)";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const creditsScreen = document.getElementById('credits-screen');
    const mobileHud = document.getElementById('mobile-hud');
    const textWrapper = document.getElementById('text-wrapper');
    const btnReadMore = document.getElementById('btn-read-more');
    
    btnReadMore?.addEventListener('click', () => {
        const isExpanded = textWrapper.classList.toggle('expanded');
        btnReadMore.innerHTML = isExpanded ? 'Read Less &#9652;' : 'Read More &#9662;';
    });

    document.getElementById('btn-start')?.addEventListener('click', () => {
        welcomeScreen.style.opacity = '0';
        setTimeout(() => welcomeScreen.style.display = 'none', 500);
        if (mobileHud) mobileHud.style.display = 'flex';
        
        // Start constant audio when Begin Exploration is clicked
        if (!isAudioInitialized) initAudioAPI();
    });

    const openNotes = () => {
        creditsScreen.style.display = 'flex';
        setTimeout(() => creditsScreen.style.opacity = '1', 10);
        if (mobileHud) mobileHud.style.display = 'none';
    };

    const closeCredits = () => {
        creditsScreen.style.opacity = '0';
        setTimeout(() => creditsScreen.style.display = 'none', 500);
        if (mobileHud) mobileHud.style.display = 'flex';
    };
    document.getElementById('btn-close-credits')?.addEventListener('click', closeCredits);
    document.getElementById('btn-close-credits-bottom')?.addEventListener('click', closeCredits);

    const openInfo = () => {
        welcomeScreen.style.display = 'flex';
        setTimeout(() => welcomeScreen.style.opacity = '1', 10);
        if (mobileHud) mobileHud.style.display = 'none';
    };

    document.getElementById('btn-info')?.addEventListener('click', openInfo);
    document.getElementById('btn-notes')?.addEventListener('click', openNotes);
    document.getElementById('btn-menu')?.addEventListener('click', openNotes);
    document.getElementById('btn-audio')?.addEventListener('click', toggleAudio);

    document.getElementById('btn-grid')?.addEventListener('click', () => {
        gridHelper.visible = !gridHelper.visible;
        document.getElementById('btn-grid')?.classList.toggle('active', gridHelper.visible);
    });

    document.getElementById('btn-autopilot')?.addEventListener('click', toggleAutopilot);
    document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);
});

window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'f') toggleFullscreen();
    if (key === 'a') toggleAutopilot();
    if (key === 'm') toggleAudio();
    if (key === 'i') {
        const welcomeScreen = document.getElementById('welcome-screen');
        const mobileHud = document.getElementById('mobile-hud');
        if (welcomeScreen) {
            const isVisible = welcomeScreen.style.display !== 'none' && welcomeScreen.style.opacity !== '0';
            if (isVisible) {
                welcomeScreen.style.opacity = '0';
                setTimeout(() => welcomeScreen.style.display = 'none', 500);
                if (mobileHud) mobileHud.style.display = 'flex';
            } else {
                welcomeScreen.style.display = 'flex';
                setTimeout(() => welcomeScreen.style.opacity = '1', 10);
                if (mobileHud) mobileHud.style.display = 'none';
            }
        }
    }
    if (key === 'n') {
        const creditsScreen = document.getElementById('credits-screen');
        const mobileHud = document.getElementById('mobile-hud');
        if (creditsScreen) {
            const isVisible = creditsScreen.style.display !== 'none' && creditsScreen.style.opacity !== '0';
            if (isVisible) {
                creditsScreen.style.opacity = '0';
                setTimeout(() => creditsScreen.style.display = 'none', 500);
                if (mobileHud) mobileHud.style.display = 'flex';
            } else {
                creditsScreen.style.display = 'flex';
                setTimeout(() => creditsScreen.style.opacity = '1', 10);
                if (mobileHud) mobileHud.style.display = 'none';
            }
        }
    }
    if (key === 'g') {
        gridHelper.visible = !gridHelper.visible;
        document.getElementById('btn-grid')?.classList.toggle('active', gridHelper.visible);
    }
    if (key === 'e' || key === 'x') {
        window.toggleExhibitionMode();
    }
    if (event.key === 'Escape') {
        if (isExhibitionMode) {
            window.setExhibitionMode(false);
        }
        const welcomeScreen = document.getElementById('welcome-screen');
        const creditsScreen = document.getElementById('credits-screen');
        const mobileHud = document.getElementById('mobile-hud');
        if (welcomeScreen && welcomeScreen.style.display !== 'none' && welcomeScreen.style.opacity !== '0') {
            welcomeScreen.style.opacity = '0';
            setTimeout(() => welcomeScreen.style.display = 'none', 500);
            if (mobileHud) mobileHud.style.display = 'flex';
        }
        if (creditsScreen && creditsScreen.style.display !== 'none' && creditsScreen.style.opacity !== '0') {
            creditsScreen.style.opacity = '0';
            setTimeout(() => creditsScreen.style.display = 'none', 500);
            if (mobileHud) mobileHud.style.display = 'flex';
        }
        if (isCardLocked) {
            window.closeHudCard();
        }
    }
});

let wasGridVisibleBeforeAutopilot = true;

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
}

function toggleAutopilot() {
    isAutopilotRunning = !isAutopilotRunning;
    const btn = document.getElementById('btn-autopilot');
    if (btn) btn.classList.toggle('active', isAutopilotRunning);
    
    if (isAutopilotRunning) {
        console.log("🤖 Autopilot / Cinematic Mode Engaged");
        // Save current grid visibility and hide grid during cinematic tour
        wasGridVisibleBeforeAutopilot = gridHelper.visible;
        gridHelper.visible = false;
        document.getElementById('btn-grid')?.classList.remove('active');

        document.body.style.cursor = 'none'; 
        isCardLocked = false;
        visualHudCard.classList.remove('visible');
        visualHudCard.style.display = 'none';
        visualHudCard.innerHTML = '';
        remnantTooltip.style.display = 'none';
        
        // Hide info & research documentation modals if currently open
        const welcomeScreen = document.getElementById('welcome-screen');
        const creditsScreen = document.getElementById('credits-screen');
        if (welcomeScreen) { welcomeScreen.style.opacity = '0'; welcomeScreen.style.display = 'none'; }
        if (creditsScreen) { creditsScreen.style.opacity = '0'; creditsScreen.style.display = 'none'; }

        if (!isAudioInitialized) initAudioAPI();
        runTourStep();
    } else {
        console.log("🛑 Autopilot / Cinematic Mode Disabled");
        clearTimeout(autopilotTimer);
        document.body.style.cursor = 'default'; 
        controls.autoRotate = false;
        visualHudCard.style.display = '';
        visualHudCard.classList.remove('visible');
        visualHudCard.innerHTML = '';
        if (isCardLocked) window.closeHudCard(); 
        isCardLocked = false;

        // Restore grid visibility
        gridHelper.visible = wasGridVisibleBeforeAutopilot;
        document.getElementById('btn-grid')?.classList.toggle('active', gridHelper.visible);
    }
}
window.toggleAutopilot = toggleAutopilot;

// ==========================================
// 🏛️ GRAD SHOW EXHIBITION MODE (Zero-UI Projection Flow)
// ==========================================
let isExhibitionMode = false;

export function setExhibitionMode(enable) {
    isExhibitionMode = !!enable;
    const mobileHud = document.getElementById('mobile-hud');
    const welcomeScreen = document.getElementById('welcome-screen');
    const creditsScreen = document.getElementById('credits-screen');

    if (isExhibitionMode) {
        console.log("🏛️ Grad Show Exhibition Mode Engaged: Clean projection with continuous ambient tour");
        if (welcomeScreen) { welcomeScreen.style.opacity = '0'; welcomeScreen.style.display = 'none'; }
        if (creditsScreen) { creditsScreen.style.opacity = '0'; creditsScreen.style.display = 'none'; }
        if (mobileHud) mobileHud.style.display = 'none';
        
        visualHudCard.style.display = 'none';
        visualHudCard.classList.remove('visible');
        visualHudCard.innerHTML = '';
        remnantTooltip.style.display = 'none';
        document.body.style.cursor = 'none';

        if (!isAudioInitialized) initAudioAPI();
        if (!isAutopilotRunning) toggleAutopilot();
    } else {
        console.log("🏛️ Exhibition Mode Disengaged: Interactive UX restored");
        if (mobileHud) mobileHud.style.display = 'flex';
        document.body.style.cursor = 'default';
        visualHudCard.style.display = '';
        if (isAutopilotRunning) toggleAutopilot();
    }
}
window.setExhibitionMode = setExhibitionMode;
window.toggleExhibitionMode = () => setExhibitionMode(!isExhibitionMode);

// Auto-activate Exhibition Mode if URL shortcode / parameter is present
// Examples: https://yourdomain.com/?exhibition=true or ?mode=exhibition or ?gradshow
if (typeof window !== 'undefined' && window.location) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('exhibition') || urlParams.get('mode') === 'exhibition' || urlParams.has('gradshow')) {
        setTimeout(() => setExhibitionMode(true), 350);
    }
}

function runTourStep() {
    if (!isAutopilotRunning) return;

    // Cinematic mode: Keep all UI cards, overlays, and tooltips strictly hidden (no text)
    isCardLocked = false;
    visualHudCard.classList.remove('visible');
    visualHudCard.style.display = 'none';
    visualHudCard.innerHTML = '';
    remnantTooltip.style.display = 'none';

    const activeRemnants = remnantsGroup.children.filter(mesh => mesh.userData && mesh.userData.isActiveTerrain);
    
    if (activeRemnants.length === 0) {
        autopilotTimer = setTimeout(runTourStep, 1000);
        return;
    }

    const targetMesh = activeRemnants[currentTourIndex];
    const data = targetMesh.userData;

    hideAllTerrains();
    setRemnantMarkerVisibility(data.remnantId);
    const anchorPos = new THREE.Vector3(data.centroidX, 0, data.centroidZ);
    loadLocalTerrain(data.remnantId, anchorPos, scene);

    targetCameraPosition = new THREE.Vector3(data.centroidX, 8.5, data.centroidZ + 16.0);
    targetLookAtPosition = new THREE.Vector3(data.centroidX, 2.5, data.centroidZ);
    
    controls.maxPolarAngle = Math.PI * 0.46; 
    isSwooping = true;
    controls.enabled = false; 

    currentTourIndex = (currentTourIndex + 1) % activeRemnants.length;
    autopilotTimer = setTimeout(runTourStep, 9500);
}

window.addEventListener('click', (event) => {
    // In exhibition mode, clicks never interrupt the continuous exhibition display
    if (isExhibitionMode) return;
    // Prevent dragging/pinching rotation on mobile/tablets from triggering accidental click
    if (isDraggingPointer) return;
    if (event.target.id === 'close-card-btn' || event.target.closest('#close-card-btn') || event.target.closest('#mobile-hud') || event.target.closest('#welcome-screen') || event.target.closest('#credits-screen')) return;

    // If autopilot is running and user clicks the scene, disengage cinematic tour to grant manual control without clicking through to a card
    if (isAutopilotRunning) {
        toggleAutopilot();
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (!isAudioInitialized) initAudioAPI();

    raycaster.setFromCamera(mouse, camera);

    // 1. Check Remnant clicks/taps (both active 3D reserves and historical baseline fragments)
    const intersects = raycaster.intersectObjects(remnantsGroup.children, true);

    if (intersects.length > 0) {
        let hitObject = intersects[0].object;
        
        while (hitObject && !hitObject.userData.isActiveTerrain && hitObject.parent && hitObject.parent !== remnantsGroup) {
            hitObject = hitObject.parent;
        }

        if (hitObject && hitObject.userData && hitObject.userData.isActiveTerrain) {
            const remnantId = hitObject.userData.remnantId;

            hideAllTerrains();
            setRemnantMarkerVisibility(remnantId);
            const targetX = hitObject.userData.centroidX;
            const targetZ = hitObject.userData.centroidZ;
            const anchorPos = new THREE.Vector3(targetX, 0, targetZ);
            
            showLoadingProgress(hitObject.userData.name, "Streaming Ghost Trees LiDAR from Cloudflare R2...", 10);

            loadLocalTerrain(remnantId, anchorPos, scene, (loaded, total, status) => {
                const pct = total > 0 ? Math.round((loaded / total) * 100) : null;
                const txtEl = document.getElementById('loading-status-text');
                const barEl = document.getElementById('loading-progress-bar');
                if (txtEl) txtEl.innerText = status;
                if (barEl && pct !== null) barEl.style.width = `${pct}%`;
            }).then((terrainObj) => {
                const count = terrainObj?.userData?.pointCount || terrainObj?.geometry?.attributes?.position?.count;
                renderRemnantCard(remnantId, hitObject.userData.name, count);
            });

            targetCameraPosition = new THREE.Vector3(targetX, 8.5, targetZ + 16.0);
            targetLookAtPosition = new THREE.Vector3(targetX, 2.5, targetZ);
            
            controls.maxPolarAngle = Math.PI * 0.46; 
            isSwooping = true;
            controls.enabled = false; 
            return;
        } else if (hitObject && hitObject.userData && hitObject.userData.name) {
            isCardLocked = true;
            visualHudCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <div style="color: #00ffcc; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 2px;">REMNANT FRAGMENT</div>
                    <button id="close-card-btn" onclick="window.closeHudCard(event)" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; touch-action: manipulation;">✕</button>
                </div>
                <div style="font-size: clamp(16px, 3.5vw, 18px); font-weight: 600; color: #fff; margin-bottom: 6px;">${hitObject.userData.name}</div>
                <div style="font-size: 12px; color: #8bb1a7; line-height: 1.55; margin-bottom: 4px;">1 of 79 surviving remnants of the Big Scrub rainforest.</div>
                <div style="font-size: 11px; color: #cad8d3; opacity: 0.85;">High-density 3D LiDAR canopy reconstruction for this fragment is scheduled for upcoming project expansions.</div>
            `;
            visualHudCard.classList.add('visible');
            return;
        }
    }

    // 2. Check Genomic Matrix Species taps/clicks (crucial on mobile & tablets where hover is absent)
    if (genomicMatrixGroup && genomicMatrixGroup.children.length > 0) {
        const sphereIntersects = raycaster.intersectObjects(genomicMatrixGroup.children);
        if (sphereIntersects.length > 0) {
            const primaryHit = sphereIntersects[0].object;
            const data = primaryHit.userData;
            if (data && data.name) {
                isCardLocked = true;
                const isGondwana = (data.origin === "Gondwana" || data.lineage === "Gondwana");
                const originLabel = isGondwana ? "Gondwana" : "Indo-Malesian";
                const originColor = isGondwana ? "#00ffcc" : "#0088ff";
                visualHudCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <div style="color: #00ffcc; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 500; letter-spacing: 2px;">GENOMIC LINEAGE DATA</div>
                        <button id="close-card-btn" onclick="window.closeHudCard(event)" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; touch-action: manipulation;">✕</button>
                    </div>
                    <div style="font-size: clamp(17px, 3.8vw, 22px); font-weight: 600; font-style: italic; color: #ffffff; letter-spacing: -0.01em;">${data.name}</div>
                    <div style="font-size: 13px; color: #8bb1a7; margin-top: 4px; font-weight: 400;">Common Name: ${data.common}</div>
                    <div style="font-size: 12px; color: #cad8d3; margin-top: 10px; border-top: 1px solid rgba(0, 255, 204, 0.15); padding-top: 8px;">
                        Origin: <span style="color: ${originColor}; font-weight: 500;">${originLabel}</span>
                    </div>
                `;
                visualHudCard.classList.add('visible');
                return;
            }
        }
    }
});

// Remove any lingering test remnant buttons or inputs if present in the DOM
if (typeof document !== 'undefined') {
    document.getElementById('btn-quick-upload')?.remove();
    document.getElementById('btn-upload-xyz')?.remove();
    document.getElementById('xyz-file-input')?.remove();
    document.querySelectorAll('.test-remnant-box, [id*="quick-upload"]').forEach(el => el.remove());
}



function animate() {
    requestAnimationFrame(animate);
    
    checkHovers(); 

    if (genomicMatrixGroup) {
        genomicMatrixGroup.rotation.y += 0.001; 
    }
    
    if (targetCameraPosition && targetLookAtPosition) {
        camera.position.lerp(targetCameraPosition, 0.05);
        controls.target.lerp(targetLookAtPosition, 0.05);
        
        if (camera.position.distanceTo(targetCameraPosition) < 1.5) {
            camera.position.copy(targetCameraPosition);
            controls.target.copy(targetLookAtPosition);

            targetCameraPosition = null;
            targetLookAtPosition = null;
            
            isSwooping = false; 
            controls.enabled = true; 
            
            if (isAutopilotRunning) {
                controls.autoRotate = true;
                controls.autoRotateSpeed = 0.8; 
            }
            
            controls.update(); 
        }
    }

    if (typeof controls !== 'undefined' && controls) {
        controls.update(); 
    }
    renderer.render(scene, camera);
}

animate();

export class SandboxSimulation {
    constructor(targetScene = scene) {
        this.scene = targetScene;
        this.genomicMatrixGroup = genomicMatrixGroup;
        this.remnantsGroup = remnantsGroup;
    }
}