import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadLocalTerrain } from './terrainReader.js';
import { bigScrubEcosystem } from './speciesConfig.js'; 

// 🎬 Core WebGL Initializer Engine
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); 

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 40, 60);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.01; 

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous'); // 🛡️ Prevents CORS security blocks!
const floorTexture = textureLoader.load('https://ilonka.io/big_scrub_floor.png');

const floorGeometry = new THREE.PlaneGeometry(1, 1);
const floorMaterial = new THREE.MeshBasicMaterial({
    map: floorTexture,
    transparent: true,
    opacity: 0.45, 
    side: THREE.DoubleSide
});

const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.rotation.x = -Math.PI / 2; 
scene.add(floorMesh);

const gridHelper = new THREE.GridHelper(70, 35, 0x44445c, 0x1f1f2e);
gridHelper.position.y = -0.01; 
scene.add(gridHelper);

// ==========================================
// 🧬 THE MACRO GENOMIC SPHERE
// ==========================================
const genomicMatrixGroup = new THREE.Group();
genomicMatrixGroup.position.set(0, 20, 0); 
scene.add(genomicMatrixGroup);

const SCALED_RADIUS = 10; 
const SCALED_TRACK_SPACING = 0.25;

async function fetchFastaWithFallback(specimen) {
    const underscorePath = `https://ilonka.io/genetics/${specimen.genus}_${specimen.species}_alignment.fasta`;
    try {
        const response = await fetch(underscorePath);
        if (response.ok) return response;
    } catch (e) {}
    throw new Error(`Genomics asset unreachable: ${specimen.genus} ${specimen.species}`);
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
    console.log(`☁️ Dynamic Gaussian Cloud Online: ${genomicMatrixGroup.children.length} FASTA layers dispersed.`);
}
buildDynamicEcosystemMatrix();

// ==========================================
// 📍 MAP REMNANTS LAYER
// ==========================================
const remnantsGroup = new THREE.Group();
scene.add(remnantsGroup);

async function loadGeoJsonAnchors() {
    try {
        const boundaryResponse = await fetch(`https://ilonka.io/boundary.geojson`);
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

        const remnantsResponse = await fetch(`https://ilonka.io/remnants.geojson`);
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
                const realTitles = [
                    "Victoria Park Nature Reserve",
                    "Booyong Flora Reserve",
                    "Big Scrub Flora Reserve",
                    "Minyon Falls Nature Reserve",
                    "Boomerang Falls Flora Reserve"
                ];

                const activeIndex = activeKeywords.findIndex(keyword => lowerGeoName.includes(keyword));
                const isActive = activeIndex !== -1;

                const remnantId = isActive ? String(activeIndex + 1) : null;
                const displayName = isActive ? realTitles[activeIndex] : (geojsonName || "Historical Baseline Node");

                const shapeGeo = new THREE.ShapeGeometry(shape);
                const markerMat = new THREE.MeshBasicMaterial({
                    color: isActive ? 0x00FF88 : 0x1b7340, 
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: isActive ? 0.8 : 0.45 
                });

                const markerMesh = new THREE.Mesh(shapeGeo, markerMat);
                markerMesh.rotation.x = -Math.PI / 2; 
                markerMesh.position.y = 0.05; 

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
        console.error("Geo-Bounding Matrix Alignment error:", error);
    }
}
loadGeoJsonAnchors();

// ==========================================
// 🖥️ THE UNIFIED HUD INTERACTION SYSTEM
// ==========================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-1, -1);
let targetedTrackObject = null;
let isCardLocked = false; 

const visualHudCard = document.createElement('div');
visualHudCard.style.cssText = `
  position: absolute; bottom: 40px; left: 40px;
  background: rgba(3, 8, 6, 0.9); border: 1px solid #00ffcc;
  padding: 22px; color: #ffffff; font-family: monospace;
  opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
  border-radius: 2px; box-shadow: 0 0 20px rgba(0, 255, 204, 0.15); z-index: 100;
  min-width: 320px;
`;
document.body.appendChild(visualHudCard);

window.closeHudCard = function(e) {
    if(e) e.stopPropagation();
    isCardLocked = false;
    visualHudCard.style.opacity = "0";
    visualHudCard.style.pointerEvents = "none";
};

const remnantTooltip = document.createElement('div');
remnantTooltip.style.cssText = `
  position: absolute; display: none; background: rgba(5, 15, 10, 0.85); color: #00ffcc;
  padding: 10px 15px; font-family: monospace; font-size: 14px; border: 1px solid #00ffcc;
  border-radius: 4px; pointer-events: none; z-index: 200; font-weight: bold;
  box-shadow: 0 0 10px rgba(0, 255, 204, 0.2);
`;
document.body.appendChild(remnantTooltip);

window.addEventListener('mousemove', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    remnantTooltip.style.left = (event.clientX + 15) + 'px';
    remnantTooltip.style.top = (event.clientY + 15) + 'px';
});

function checkHovers() {
    raycaster.setFromCamera(mouse, camera);
    let cursorIsPointer = false;

    const sphereIntersections = raycaster.intersectObjects(genomicMatrixGroup.children);
    if (sphereIntersections.length > 0) {
        const primaryHit = sphereIntersections[0].object;
        if (targetedTrackObject !== primaryHit) {
            if (targetedTrackObject) targetedTrackObject.material.size = 0.1;

            targetedTrackObject = primaryHit;
            targetedTrackObject.material.size = 0.3; 

            const data = targetedTrackObject.userData;
            if (!isCardLocked) {
                visualHudCard.innerHTML = `
                    <div style="color: #00ffcc; font-size: 10px; letter-spacing: 2px; margin-bottom: 6px;">GENOMIC LINEAGE DATA</div>
                    <div style="font-size: 20px; font-weight: bold; font-style: italic; color: #fff;">${data.name}</div>
                    <div style="font-size: 14px; color: #88b0a5; margin-top: 4px;">Common Name: ${data.common}</div>
                    <div style="font-size: 11px; color: #aaa; margin-top: 8px; border-top: 1px solid #22443d; padding-top: 6px;">
                        Origin: <span style="color: ${data.origin === "Gondwana" ? "#00ffcc" : "#0088FF"}">${data.origin}</span>
                    </div>
                `;
                visualHudCard.style.opacity = "1";
            }
        }
    } else {
        if (targetedTrackObject) {
            targetedTrackObject.material.size = 0.1;
            targetedTrackObject = null;
        }
        if (!isCardLocked) visualHudCard.style.opacity = "0";
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

let targetCameraPosition = null;
let targetLookAtPosition = null;
let isSwooping = false;
let isTransitioning = false; 

let audioCtx;
let gainNode;
let isAudioInitialized = false;

function initAudioAPI() {
    if (isAudioInitialized) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bgm = new Audio('https://ilonka.io/rainforest_webstream.mp3'); 
    bgm.loop = true;
    bgm.crossOrigin = "anonymous"; 
    
    const track = audioCtx.createMediaElementSource(bgm);
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.001; 
    track.connect(gainNode).connect(audioCtx.destination);
    
    bgm.play();
    isAudioInitialized = true;
}

window.triggerAudioVolumeSwell = function(targetVol = 0.75) {
    if (!audioCtx || !gainNode) return;
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 3.0);
};

window.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (!isAudioInitialized) initAudioAPI();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    if (gainNode && audioCtx) {
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 1.0);
    }

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(remnantsGroup.children, true);

    if (intersects.length > 0) {
        let hitObject = intersects[0].object;
        
        while (hitObject && !hitObject.userData.isActiveTerrain && hitObject.parent) {
            hitObject = hitObject.parent;
        }

        if (hitObject.userData.isActiveTerrain) {
            const remnantId = hitObject.userData.remnantId;

            const targetX = hitObject.userData.centroidX;
            const targetZ = hitObject.userData.centroidZ;

            // 🎯 PASS ANCHOR TO LOAD LOCAL TERRAIN
            const anchorPos = new THREE.Vector3(targetX, 0, targetZ);
            loadLocalTerrain(remnantId, anchorPos, scene);

            document.getElementById("ui-title").innerText = hitObject.userData.name;
            document.getElementById("ui-container").classList.remove("hidden");

            targetCameraPosition = new THREE.Vector3(targetX, 8, targetZ + 12);
            targetLookAtPosition = new THREE.Vector3(targetX, 0, targetZ);
            
            isSwooping = true;
            controls.enabled = false; 
        }
    }
});

function animate() {
    requestAnimationFrame(animate);
    
    checkHovers(); 

    if (genomicMatrixGroup) {
        genomicMatrixGroup.rotation.y += 0.001; 
    }
    
    if (targetCameraPosition && targetLookAtPosition) {
        camera.position.lerp(targetCameraPosition, 0.05);
        controls.target.lerp(targetLookAtPosition, 0.05);
        
        if (camera.position.distanceTo(targetCameraPosition) < 0.1) {
            targetCameraPosition = null;
            targetLookAtPosition = null;
            
            isTransitioning = false; 
            controls.enabled = true; 
            triggerAudioVolumeSwell(0.75);
        }
    }

    if (typeof controls !== 'undefined' && controls) {
        controls.update(); 
    }
    renderer.render(scene, camera);
}

animate();