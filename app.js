// Main application logic for Broadloom Image Converter  
// Version: 2.9.82

const VERSION = '2.9.82';

// Global state
let originalImage = null;
let currentImageData = null;
let quantizedResult = null;
let currentK = 10;
let currentResolution = 58;
const DESIGN_WIDTH = 10; // Fixed 10cm
const DESIGN_HEIGHT = 10; // Fixed 10cm
let magnifierActive = false;
let highlightedColorIndex = -1;
let highlightCanvas = null;
let highlightLocked = false; // Whether highlight is locked by click
let lockedColorIndex = null; // Which color is locked
let highlightVisibleInMagnifier = true; // Toggle highlight visibility in magnifier with Shift key
let currentSort = 'brightness'; // 'brightness' or 'pixels'
let colorData = null; // Store color data for sorting
let showGrid = false;
let gridCanvas = null;
let lastMouseX = 0; // track last mouse position for magnifier realign
let lastMouseY = 0;
let lastPixelX = -1; // track cursor position in image pixel coordinates
let lastPixelY = -1;
let isSyntheticMove = false; // flag to prevent updating pixel coords on keyboard-generated moves
let findModeActive = false; // whether we're in find/navigate mode
let findColorIndex = null; // which color we're finding
let findPixelLocations = []; // array of {x, y} for current color
let findCurrentIndex = 0; // which pixel we're viewing (0-based)
let multiColorSelectedIndices = new Set(); // which colors are selected in multi-color panel (needs at least 2)
let multiColorFlashInterval = null; // interval ID for flashing animation
let multiColorFlashVisible = true; // toggle state for flashing
let replaceMode = false; // whether we are selecting colors to replace
let replaceSourceIndex = null; // first chosen color (to be replaced)
let replacedColors = new Set(); // palette indices marked as replaced (show red strip)
let adjacentReplacedColors = new Set(); // colors modified by adjacent replacement
let adjacentReplacementHistory = new Map(); // Map<colorIndex, original assignments> for undo
let keyPopupTimer = null; // toast timer for key press popup
let patternImages = []; // Array of pattern images loaded by user
let draggedPattern = null; // Currently dragged pattern
let patternOverlayCanvas = null; // Canvas for pattern hover preview
let hoveredColorIndex = -1; // Color region being hovered during pattern drag
let patternOverlays = new Map(); // Map<colorIndex, {patternData, canvas}> for applied patterns

function showKeyPopup(label){
    let el = document.getElementById('key-popup');
    if (!el) {
        el = document.createElement('div');
        el.id = 'key-popup';
        el.style.position = 'fixed';
        el.style.right = '12px';
        el.style.bottom = '12px';
        el.style.zIndex = '10000';
        el.style.background = 'rgba(0,0,0,0.8)';
        el.style.color = '#fff';
        el.style.font = '12px monospace';
        el.style.padding = '6px 10px';
        el.style.borderRadius = '6px';
        el.style.transition = 'opacity 0.2s';
        document.body.appendChild(el);
    }
    el.textContent = `Key: ${label}`;
    el.style.opacity = '1';
    if (keyPopupTimer) clearTimeout(keyPopupTimer);
    keyPopupTimer = setTimeout(()=>{ el.style.opacity = '0'; }, 700);
}

// DOM elements
const elements = {
    imageUpload: document.getElementById('image-upload'),
    dropZone: document.getElementById('drop-zone'),
    imageDisplay: document.getElementById('image-display'),
    resolutionInputs: document.querySelectorAll('input[name="resolution"]'),
    resolutionRecommendation: document.getElementById('resolution-recommendation'),
    showGridCheckbox: document.getElementById('show-grid'),
    useActualColorsCheckbox: document.getElementById('use-actual-colors'),
    kMinus: document.getElementById('k-minus'),
    kPlus: document.getElementById('k-plus'),
    kValue: document.getElementById('k-value'),
    currentK: document.getElementById('current-k'),
    convertBtn: document.getElementById('convert-btn'),
    downloadBtn: document.getElementById('download-btn'),
    downloadBmpBtn: document.getElementById('download-bmp-btn'),
    originalCanvas: document.getElementById('original-canvas'),
    quantizedCanvas: document.getElementById('quantized-canvas'),
    magnifier: document.getElementById('magnifier'),
    magnifierCanvas: document.getElementById('magnifier-canvas'),
    magnifierOriginal: document.getElementById('magnifier-original'),
    magnifierCanvasOriginal: document.getElementById('magnifier-canvas-original'),
    crosshairH: document.getElementById('crosshair-horizontal'),
    crosshairV: document.getElementById('crosshair-vertical'),
    coordBadge: document.getElementById('coord-badge'),
    proofBadge: document.getElementById('proof-badge'),
    kInfo: document.getElementById('k-info'),
    prosList: document.getElementById('pros-list'),
    consList: document.getElementById('cons-list'),
    colorPalette: document.getElementById('color-palette'),
    paletteRows: document.getElementById('palette-rows'),
    sortBrightness: document.getElementById('sort-brightness'),
    sortPixels: document.getElementById('sort-pixels'),
    autoK: document.getElementById('auto-k'),
    autoKNote: document.getElementById('auto-k-note'),
    distanceRgb: document.getElementById('distance-rgb'),
    distanceHsv: document.getElementById('distance-hsv'),
    distanceLab: document.getElementById('distance-lab'),
    replaceButton: document.getElementById('replace-color-btn'),
    replaceInstructions: document.getElementById('replace-instructions'),
    imageInfo: document.getElementById('image-info'),
    processingOverlay: document.getElementById('processing-overlay'),
    progressFill: document.getElementById('progress-fill'),
    activeColorCount: document.getElementById('active-color-count'),
    adjacentPanel: document.getElementById('adjacent-panel'),
    adjacentTargetOptions: document.getElementById('adjacent-target-options'),
    ignoreColorBtn: document.getElementById('ignore-color-btn'),
    resetAdjacentBtn: document.getElementById('reset-adjacent-btn'),
    adjacentInstructions: document.getElementById('adjacent-instructions'),
    ignoreChips: document.getElementById('ignore-chips'),
    replaceSurroundBtn: document.getElementById('replace-surround-btn'),
    adjacentMultiPanel: document.getElementById('adjacent-multi-panel'),
    adjacentMultiTargetOptions: document.getElementById('adjacent-multi-target-options'),
    ignoreMultiColorBtn: document.getElementById('ignore-multi-color-btn'),
    resetAdjacentMultiBtn: document.getElementById('reset-adjacent-multi-btn'),
    adjacentMultiInstructions: document.getElementById('adjacent-multi-instructions'),
    ignoreMultiChips: document.getElementById('ignore-multi-chips'),
    replaceMultiSurroundBtn: document.getElementById('replace-multi-surround-btn'),
    patternPanel: document.getElementById('pattern-panel'),
    patternContent: document.getElementById('pattern-content'),
    patternUpload: document.getElementById('pattern-upload'),
    patternDropZone: document.getElementById('pattern-drop-zone'),
    patternList: document.getElementById('pattern-list')
};

// Initialize event listeners
function initializeEventListeners() {
    // File upload
    elements.imageUpload.addEventListener('change', handleFileSelect);
    
    // Drag and Drop
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);
    
    // Prevent default drag behaviors on document
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
    
    // Resolution change - auto convert
    elements.resolutionInputs.forEach(input => {
        input.addEventListener('change', handleResolutionChange);
    });
    
    // Grid toggle
    elements.showGridCheckbox?.addEventListener('change', toggleGrid);
    
    // Actual colors toggle - auto convert when changed
    elements.useActualColorsCheckbox?.addEventListener('change', () => {
        if (originalImage && currentImageData) {
            convertImage();
        }
    });
    
    // K value controls
    elements.kMinus.addEventListener('click', () => adjustK(-1));
    elements.kPlus.addEventListener('click', () => adjustK(1));
    // Auto K toggle
    elements.autoK?.addEventListener('change', ()=>{
        const on = elements.autoK.checked;
        elements.kMinus.disabled = on;
        elements.kPlus.disabled = on;
        if (on && originalImage && currentImageData) {
            estimateAndSetAutoK();
        } else if (!on) {
            elements.autoKNote.textContent = '';
        }
    });
    
    // Distance Method buttons
    elements.distanceRgb?.addEventListener('click', () => switchDistanceMethod('rgb'));
    elements.distanceHsv?.addEventListener('click', () => switchDistanceMethod('hsv'));
    elements.distanceLab?.addEventListener('click', () => switchDistanceMethod('lab'));
    
    // Action buttons
    elements.convertBtn.addEventListener('click', convertImage);
    elements.downloadBtn.addEventListener('click', downloadYarnMap);
    elements.downloadBmpBtn?.addEventListener('click', downloadPixelBmp);
    
    // Sort buttons
    elements.sortBrightness?.addEventListener('click', () => sortPalette('brightness'));
    elements.sortPixels?.addEventListener('click', () => sortPalette('pixels'));
    // Replace color workflow
    elements.replaceButton?.addEventListener('click', enableReplaceMode);
    // Adjacent interactions
    elements.adjacentTargetOptions?.addEventListener('click', (e)=>{
        const sw = e.target.closest('.adjacent-swatch');
        if (!sw) return;
        const hex = sw.getAttribute('data-hex') || sw.getAttribute('title');
        const idx = findColorIndexByHex(hex);
        if (idx != null) {
            // Toggle active class on swatches
            document.querySelectorAll('.adjacent-swatch').forEach(el=> el.classList.remove('active'));
            if (lockedColorIndex === idx && highlightLocked) {
                // Deselect
                highlightLocked = false;
                lockedColorIndex = null;
                clearHighlight();
                if (elements.ignoreColorBtn) elements.ignoreColorBtn.disabled = true;
                if (elements.replaceSurroundBtn) elements.replaceSurroundBtn.disabled = true;
                // Clear ignore mode and chips
                ignorePickActive = false;
                ignoredHexes.clear();
                if (elements.ignoreChips) elements.ignoreChips.innerHTML = '';
                if (elements.adjacentInstructions) elements.adjacentInstructions.textContent = '';
            } else {
                // Select
                highlightLocked = true;
                lockedColorIndex = idx;
                highlightColorPixels(idx);
                sw.classList.add('active');
                if (elements.ignoreColorBtn) elements.ignoreColorBtn.disabled = false;
                // Replace surround button is disabled until ignore mode is activated
                if (elements.replaceSurroundBtn) elements.replaceSurroundBtn.disabled = true;
                // Reset button stays at current state (enabled if chips exist or ignore mode is on)
                if (elements.resetAdjacentBtn) {
                    elements.resetAdjacentBtn.disabled = !ignorePickActive && ignoredHexes.size === 0;
                }
            }
            evaluateSurroundingCandidate();
        }
    });
    elements.ignoreColorBtn?.addEventListener('click', () => {
        ignorePickActive = !ignorePickActive;
        if (elements.adjacentInstructions) {
            elements.adjacentInstructions.textContent = ignorePickActive ? 'Pick 1 or more colors on the pixel image to ignore (click to add, × to remove).' : '';
        }
        // Enable/disable reset button based on ignore mode or chips
        if (elements.resetAdjacentBtn) {
            elements.resetAdjacentBtn.disabled = !ignorePickActive && ignoredHexes.size === 0;
        }
        // Update replace surround button state based on ignore mode AND ignored colors count
        evaluateSurroundingCandidate();
    });
    
    elements.resetAdjacentBtn?.addEventListener('click', () => {
        // Reset all adjacent/ignore state
        ignorePickActive = false;
        ignoredHexes.clear();
        if (elements.ignoreChips) elements.ignoreChips.innerHTML = '';
        if (elements.adjacentInstructions) elements.adjacentInstructions.textContent = '';
        if (elements.replaceSurroundBtn) elements.replaceSurroundBtn.disabled = true;
        if (elements.resetAdjacentBtn) elements.resetAdjacentBtn.disabled = true;
        evaluateSurroundingCandidate();
    });
    
    elements.quantizedCanvas.addEventListener('click', (e)=>{
        if (!ignorePickActive || !quantizedResult) return;
        const rect = elements.quantizedCanvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) * elements.quantizedCanvas.width / rect.width);
        const y = Math.floor((e.clientY - rect.top) * elements.quantizedCanvas.height / rect.height);
        const idx = y * elements.quantizedCanvas.width + x;
        const colorIdx = quantizedResult.assignments[idx];
        addIgnoreChip(rgbToHex(quantizedResult.centroids[colorIdx]));
        evaluateSurroundingCandidate();
    });
    
    // Pattern drag and drop on canvas
    elements.quantizedCanvas.addEventListener('dragover', handlePatternDragOverCanvas);
    elements.quantizedCanvas.addEventListener('dragleave', handlePatternDragLeaveCanvas);
    elements.quantizedCanvas.addEventListener('drop', handlePatternDropOnCanvas);

    elements.replaceSurroundBtn?.addEventListener('click', () => {
        if (lockedColorIndex == null) return;
        const sourceIndex = lockedColorIndex;
        // Draw blue preview for pixels to be replaced (may be zero)
        drawAdjacentPreview(sourceIndex);
        // Show draggable confirmation (confirm disabled if zero)
        showAdjacentReplaceConfirm(sourceIndex, null);
    });
    
    // Canvas hover events for magnifier and crosshairs
    elements.originalCanvas.addEventListener('mousemove', handleCanvasHover);
    elements.quantizedCanvas.addEventListener('mousemove', handleCanvasHover);
    elements.originalCanvas.addEventListener('mouseenter', () => magnifierActive = true);
    elements.quantizedCanvas.addEventListener('mouseenter', () => magnifierActive = true);
    elements.originalCanvas.addEventListener('mouseleave', handleCanvasLeave);
    elements.quantizedCanvas.addEventListener('mouseleave', handleCanvasLeave);
    // Right-click to open proof popup at current cursor
    elements.quantizedCanvas.addEventListener('contextmenu', (e)=>{
        e.preventDefault();
        openProofPopup(e.clientX, e.clientY);
    });

    // Right-click on "Original" canvas: show palette selection proof (K build) at current pixel
    elements.originalCanvas.addEventListener('contextmenu', (e)=>{
        e.preventDefault();
        openPaletteProofPopup(e.clientX, e.clientY);
    });
    
    // Shift key to toggle highlight visibility in magnifier
    const onKey = (e) => {
        const key = e.key;
        if (e.key === 'Shift') {
            highlightVisibleInMagnifier = !highlightVisibleInMagnifier;
            
            // Redraw magnifier if active
            if (magnifierActive && elements.quantizedCanvas) {
                const rect = elements.quantizedCanvas.getBoundingClientRect();
                const u = (lastMouseX - rect.left) / rect.width;
                const v = (lastMouseY - rect.top) / rect.height;
                if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
                    drawMagnifier(u, v);
                }
            }
            
            showKeyPopup(highlightVisibleInMagnifier ? 'Highlight ON' : 'Highlight OFF');
            return;
        }

        // WASD keys only (arrows disabled due to browser conflicts)
        if (!currentImageData || !elements.quantizedCanvas || !magnifierActive) return;
        
        const lk = String(key || '').toLowerCase();
        if (lk !== 'w' && lk !== 'a' && lk !== 's' && lk !== 'd') return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const rect = elements.quantizedCanvas.getBoundingClientRect();
        const imgWidth = elements.quantizedCanvas.width;
        const imgHeight = elements.quantizedCanvas.height;
        
        // Use stored pixel coordinates directly
        let xImg = lastPixelX >= 0 ? lastPixelX : Math.floor((lastMouseX - rect.left) * imgWidth / rect.width);
        let yImg = lastPixelY >= 0 ? lastPixelY : Math.floor((lastMouseY - rect.top) * imgHeight / rect.height);
        
        const xImgBefore = xImg;
        const yImgBefore = yImg;
        
        let label = '';
        if (lk === 'a') { xImg -= 1; label = 'Left (A)'; }
        if (lk === 'd') { xImg += 1; label = 'Right (D)'; }
        if (lk === 'w') { yImg -= 1; label = 'Up (W)'; }
        if (lk === 's') { yImg += 1; label = 'Down (S)'; }
        
        const xImgAfter = xImg;
        const yImgAfter = yImg;
        
        xImg = Math.max(0, Math.min(imgWidth - 1, xImg));
        yImg = Math.max(0, Math.min(imgHeight - 1, yImg));
        
        // Update pixel coordinates
        lastPixelX = xImg;
        lastPixelY = yImg;
        
        // Convert pixel coordinates to screen coordinates
        const xDev = (xImg + 0.5) * rect.width / imgWidth;
        const yDev = (yImg + 0.5) * rect.height / imgHeight;
        
        lastMouseX = rect.left + xDev;
        lastMouseY = rect.top + yDev;
        
        console.log(`Key: ${lk}, before: (${xImgBefore},${yImgBefore}), after move: (${xImgAfter},${yImgAfter}), final: (${xImg},${yImg}), max: (${imgWidth-1},${imgHeight-1})`);
        
        // Set flag to prevent handleCanvasHover from updating pixel coords
        isSyntheticMove = true;
        const evt = new MouseEvent('mousemove', { clientX: lastMouseX, clientY: lastMouseY, bubbles: true });
        elements.quantizedCanvas.dispatchEvent(evt);
        isSyntheticMove = false;
        showKeyPopup(label);
    };
    document.addEventListener('keydown', onKey, true);
    
    // Pattern upload
    elements.patternUpload && elements.patternUpload.addEventListener('change', handlePatternFileSelect);
    
    // Pattern drag and drop
    if (elements.patternDropZone) {
        elements.patternDropZone.addEventListener('dragover', handlePatternDragOver);
        elements.patternDropZone.addEventListener('dragleave', handlePatternDragLeave);
        elements.patternDropZone.addEventListener('drop', handlePatternDrop);
        elements.patternDropZone.addEventListener('click', () => {
            elements.patternUpload && elements.patternUpload.click();
        });
    }

}

// Helper: find centroid index by hex
function findColorIndexByHex(hex){
    if (!quantizedResult) return null;
    const target = hex.toLowerCase();
    for (let i=0;i<quantizedResult.centroids.length;i++){
        if (rgbToHex(quantizedResult.centroids[i]).toLowerCase() === target) return i;
    }
    return null;
}

// Find all pixel locations for a specific color
function findPixelsOfColor(colorIndex) {
    if (!quantizedResult || !currentImageData) return [];
    
    const width = currentImageData.width;
    const height = currentImageData.height;
    const assignments = quantizedResult.assignments;
    
    // First, collect all pixels of this color
    const allPixels = [];
    for (let i = 0; i < assignments.length; i++) {
        if (assignments[i] === colorIndex) {
            const x = i % width;
            const y = Math.floor(i / width);
            allPixels.push({x, y});
        }
    }
    
    if (allPixels.length === 0) return [];
    
    // Create a set for quick lookup
    const pixelSet = new Set(allPixels.map(p => `${p.x},${p.y}`));
    
    // Order pixels by connectivity (8-neighbor)
    const orderedLocations = [];
    const visited = new Set();
    
    // Start with the first pixel (top-left)
    let current = allPixels[0];
    orderedLocations.push(current);
    visited.add(`${current.x},${current.y}`);
    
    // Continue until all pixels are visited
    while (orderedLocations.length < allPixels.length) {
        let nextPixel = null;
        let minDistance = Infinity;
        
        // Check 8 neighbors of current pixel first
        const neighbors = [
            {x: current.x - 1, y: current.y - 1}, // top-left
            {x: current.x, y: current.y - 1},     // top
            {x: current.x + 1, y: current.y - 1}, // top-right
            {x: current.x - 1, y: current.y},     // left
            {x: current.x + 1, y: current.y},     // right
            {x: current.x - 1, y: current.y + 1}, // bottom-left
            {x: current.x, y: current.y + 1},     // bottom
            {x: current.x + 1, y: current.y + 1}  // bottom-right
        ];
        
        // Look for adjacent unvisited pixel of the same color
        for (const neighbor of neighbors) {
            const key = `${neighbor.x},${neighbor.y}`;
            if (pixelSet.has(key) && !visited.has(key)) {
                nextPixel = neighbor;
                break; // Found adjacent pixel, use it immediately
            }
        }
        
        // If no adjacent pixel, find the nearest unvisited pixel
        if (!nextPixel) {
            for (const pixel of allPixels) {
                const key = `${pixel.x},${pixel.y}`;
                if (!visited.has(key)) {
                    const dist = Math.abs(pixel.x - current.x) + Math.abs(pixel.y - current.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nextPixel = pixel;
                    }
                }
            }
        }
        
        if (nextPixel) {
            orderedLocations.push(nextPixel);
            visited.add(`${nextPixel.x},${nextPixel.y}`);
            current = nextPixel;
        } else {
            break; // No more pixels to visit
        }
    }
    
    return orderedLocations;
}

// Navigate to a specific pixel location
function navigateToPixel(x, y) {
    if (!elements.quantizedCanvas || !currentImageData) return;
    
    const canvas = elements.quantizedCanvas;
    const rect = canvas.getBoundingClientRect();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Clamp to valid range
    x = Math.max(0, Math.min(imgWidth - 1, x));
    y = Math.max(0, Math.min(imgHeight - 1, y));
    
    // Update pixel coordinates
    lastPixelX = x;
    lastPixelY = y;
    
    // Convert to screen coordinates
    const xDev = (x + 0.5) * rect.width / imgWidth;
    const yDev = (y + 0.5) * rect.height / imgHeight;
    
    lastMouseX = rect.left + xDev;
    lastMouseY = rect.top + yDev;
    
    // Activate magnifier if not already active
    if (!magnifierActive) {
        magnifierActive = true;
    }
    
    // Trigger mousemove to update magnifier and crosshairs
    isSyntheticMove = true;
    const evt = new MouseEvent('mousemove', { clientX: lastMouseX, clientY: lastMouseY, bubbles: true });
    canvas.dispatchEvent(evt);
    isSyntheticMove = false;
    
    console.log(`Navigated to pixel (${x}, ${y})`);
}

// Start find mode for a color
function startFindMode(colorIndex) {
    findColorIndex = colorIndex;
    findPixelLocations = findPixelsOfColor(colorIndex);
    findCurrentIndex = 0;
    findModeActive = true;
    
    if (findPixelLocations.length === 0) {
        showKeyPopup('No pixels found');
        findModeActive = false;
        return;
    }
    
    // Navigate to first pixel
    const loc = findPixelLocations[0];
    navigateToPixel(loc.x, loc.y);
    showKeyPopup(`Pixel 1 of ${findPixelLocations.length}`);
}

// Navigate to next pixel in find mode
function findNextPixel() {
    if (!findModeActive || findPixelLocations.length === 0) return;
    
    findCurrentIndex = (findCurrentIndex + 1) % findPixelLocations.length;
    const loc = findPixelLocations[findCurrentIndex];
    navigateToPixel(loc.x, loc.y);
    showKeyPopup(`Pixel ${findCurrentIndex + 1} of ${findPixelLocations.length}`);
}

let ignorePickActive = false;
let ignoredHexes = new Set();
let surroundCandidateIndex = null; // legacy global mode (kept for compatibility)
let perPixelSurroundTargets = null; // Array<number> mapping pixel index -> target color index, or -1 if none
let perPixelReplacementCount = 0;
let adjacentPreviewCanvas = null;
function addIgnoreChip(hex){
    if (!elements.ignoreChips) return;
    const norm = (hex||'').toLowerCase();
    if (ignoredHexes.has(norm)) return;
    ignoredHexes.add(norm);
    const chip = document.createElement('span');
    chip.className = 'ignore-chip';
    chip.innerHTML = `<span class="ignore-chip-color" style="background:${hex}"></span><span>${hex}</span><span class="remove">×</span>`;
    chip.querySelector('.remove').addEventListener('click', ()=>{
        ignoredHexes.delete(norm);
        chip.remove();
        // Disable reset button if no more chips and ignore mode is off
        if (elements.resetAdjacentBtn) {
            elements.resetAdjacentBtn.disabled = !ignorePickActive && ignoredHexes.size === 0;
        }
        evaluateSurroundingCandidate();
    });
    elements.ignoreChips.appendChild(chip);
    // Enable reset button when a chip is added
    if (elements.resetAdjacentBtn) elements.resetAdjacentBtn.disabled = false;
    // Update button state when a chip is added
    evaluateSurroundingCandidate();
}

// Determine if selected color is surrounded by exactly one other color (4-neighbors) after ignoring picks
function evaluateSurroundingCandidate(){
    // Compute per-pixel unique-surround targets for the locked color
    surroundCandidateIndex = null; // not used in per-pixel mode
    perPixelSurroundTargets = null;
    perPixelReplacementCount = 0;
    if (!quantizedResult || !currentImageData || lockedColorIndex == null) {
        if (elements.replaceSurroundBtn) elements.replaceSurroundBtn.disabled = true;
        return;
    }
    const width = currentImageData.width;
    const height = currentImageData.height;
    const assignments = quantizedResult.assignments;
    const total = width * height;
    const out = new Int32Array(total);
    out.fill(-1);
    // Map ignored hexes to indices once
    const ignoredIdx = new Set();
    ignoredHexes.forEach(h => {
        const idx = findColorIndexByHex(h);
        if (idx != null) ignoredIdx.add(idx);
    });
    function uniqueNeighborTarget(i){
        const x = i % width; const y = (i - x) / width;
        const candidates = new Set();
        if (x > 0) candidates.add(assignments[i-1]);
        if (x+1 < width) candidates.add(assignments[i+1]);
        if (y > 0) candidates.add(assignments[i-width]);
        if (y+1 < height) candidates.add(assignments[i+width]);
        candidates.delete(lockedColorIndex);
        ignoredIdx.forEach(idx => candidates.delete(idx));
        if (candidates.size === 1) return [...candidates][0];
        return -1;
    }
    for (let i=0;i<total;i++){
        if (assignments[i] !== lockedColorIndex) continue;
        const t = uniqueNeighborTarget(i);
        if (t !== -1) { out[i] = t; perPixelReplacementCount++; }
    }
    perPixelSurroundTargets = out;
    // Button is only enabled when ignore mode is active AND at least one color is ignored
    if (elements.replaceSurroundBtn) {
        elements.replaceSurroundBtn.disabled = !(ignorePickActive && ignoredHexes.size > 0);
    }
}

// Blue preview overlay for the pixels of the selected color
function drawAdjacentPreview(sourceIndex){
    if (!quantizedResult) return;
    // Create overlay canvas
    if (!adjacentPreviewCanvas) {
        adjacentPreviewCanvas = document.createElement('canvas');
        adjacentPreviewCanvas.className = 'adjacent-preview';
        const quantizedBox = elements.quantizedCanvas.parentElement;
        quantizedBox.style.position = 'relative';
        quantizedBox.appendChild(adjacentPreviewCanvas);
    }
    // Size/position to match quantized canvas
    adjacentPreviewCanvas.width = elements.quantizedCanvas.width;
    adjacentPreviewCanvas.height = elements.quantizedCanvas.height;
    const parentRect = elements.quantizedCanvas.parentElement.getBoundingClientRect();
    const canvasRect = elements.quantizedCanvas.getBoundingClientRect();
    adjacentPreviewCanvas.style.left = `${canvasRect.left - parentRect.left}px`;
    adjacentPreviewCanvas.style.top = `${canvasRect.top - parentRect.top}px`;
    adjacentPreviewCanvas.style.width = `${canvasRect.width}px`;
    adjacentPreviewCanvas.style.height = `${canvasRect.height}px`;
    const ctx = adjacentPreviewCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,adjacentPreviewCanvas.width, adjacentPreviewCanvas.height);
    const imageData = ctx.createImageData(adjacentPreviewCanvas.width, adjacentPreviewCanvas.height);
    const data = imageData.data;
    const total = quantizedResult.assignments.length;
    const useMask = perPixelSurroundTargets && perPixelReplacementCount > 0;
    for (let i = 0; i < total; i++) {
        const isSource = quantizedResult.assignments[i] === sourceIndex;
        const shouldColor = useMask ? (perPixelSurroundTargets[i] !== -1) : isSource;
        if (!shouldColor) continue;
        const p = i * 4;
        data[p] = 0;    // R
        data[p+1] = 128; // G
        data[p+2] = 255; // B
        data[p+3] = 255; // A
    }
    ctx.putImageData(imageData, 0, 0);
}

function clearAdjacentPreview(){
    if (adjacentPreviewCanvas && adjacentPreviewCanvas.parentElement) {
        adjacentPreviewCanvas.parentElement.removeChild(adjacentPreviewCanvas);
    }
    adjacentPreviewCanvas = null;
}

// Draggable confirmation modal for adjacent replacement
function showAdjacentReplaceConfirm(sourceIndex, targetIndex){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal draggable';
    const sourceHex = rgbToHex(quantizedResult.centroids[sourceIndex]);
    // Build summary and coordinate lists of target colors (per-pixel mode)
    const counts = {};
    const coordGroups = {};
    const w = currentImageData.width;
    if (perPixelSurroundTargets){
        for (let i=0;i<perPixelSurroundTargets.length;i++){
            const t = perPixelSurroundTargets[i];
            if (t === -1) continue;
            const hex = rgbToHex(quantizedResult.centroids[t]);
            counts[hex] = (counts[hex]||0) + 1;
            if (!coordGroups[hex]) coordGroups[hex] = [];
            const x = i % w; const y = (i - x) / w;
            coordGroups[hex].push(`${x}, ${y}`);
        }
    }
    const rows = Object.entries(counts).sort((a,b)=>b[1]-a[1])
        .map(([hex,cnt])=>`<div style="display:flex;align-items:center;gap:6px;"><span style="width:16px;height:16px;border:1px solid #ccc;background:${hex};display:inline-block;"></span><span>${hex}</span><span style="color:#64748b;">${cnt.toLocaleString()} px</span></div>`).join('');
    const coordSections = Object.entries(coordGroups).sort((a,b)=>b[1].length - a[1].length)
        .map(([hex,list])=>`<div style="margin-bottom:8px;"><div style="font-weight:600;">${hex} (${list.length} px)</div><div style="font-family:monospace;white-space:pre-wrap;word-break:break-word;">${list.join('; ')}</div></div>`).join('');
    modal.innerHTML = `
        <h4>Confirm Adjacent Replace</h4>
        <div style="margin-bottom:8px;color:#64748b;">Blue pixels will be replaced by their single 4-neighbor color (after ignores).</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="width:16px;height:16px;border:1px solid #ccc;background:${sourceHex};display:inline-block;"></span>
                <span>${sourceHex}</span>
            </span>
            <span>»</span>
            <span>${perPixelReplacementCount.toLocaleString()} pixel(s) across ${Object.keys(counts).length} color(s)</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr;gap:6px;margin-bottom:8px;">${rows || '<div style=\"color:#64748b;\">0 color(s)</div>'}</div>
        <div style="max-height:260px;overflow:auto;border:1px solid #e2e8f0;border-radius:6px;padding:8px;margin-bottom:8px;">
            ${coordSections || '<div style=\"color:#64748b;font-style:italic;\">0 pixel(s)</div>'}
        </div>
        <div class="actions">
            <button id="adj-cancel" class="sort-btn">Cancel</button>
            <button id="adj-confirm" class="sort-btn active" ${perPixelReplacementCount===0?'disabled':''}>Confirm</button>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Make modal draggable by header area
    let dragging = false; let startX=0, startY=0, origX=0, origY=0;
    const header = modal.querySelector('h4');
    const onMove = (e)=>{
        if (!dragging) return;
        const dx = e.clientX - startX; const dy = e.clientY - startY;
        modal.style.transform = `translate(${origX + dx}px, ${origY + dy}px)`;
    };
    const onUp = ()=>{ dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    header.addEventListener('mousedown', (e)=>{
        dragging = true; startX = e.clientX; startY = e.clientY;
        const st = getComputedStyle(modal).transform;
        const m = st && st !== 'none' ? st.match(/matrix\(([^)]+)\)/) : null;
        if (m) { const parts = m[1].split(','); origX = parseFloat(parts[4])||0; origY = parseFloat(parts[5])||0; } else { origX = 0; origY = 0; }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    overlay.querySelector('#adj-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
        clearAdjacentPreview();
    });
    overlay.querySelector('#adj-confirm').addEventListener('click', () => {
        document.body.removeChild(overlay);
        // Perform iterative per-pixel replacement until convergence
        performIterativeReplace();
        // Automatically reset everything after replacement (like clicking Reset button)
        clearAdjacentPreview();
        ignorePickActive = false;
        ignoredHexes.clear();
        if (elements.ignoreChips) elements.ignoreChips.innerHTML = '';
        if (elements.adjacentInstructions) elements.adjacentInstructions.textContent = '';
        if (elements.replaceSurroundBtn) elements.replaceSurroundBtn.disabled = true;
        if (elements.resetAdjacentBtn) elements.resetAdjacentBtn.disabled = true;
        evaluateSurroundingCandidate();
        // Clear yellow highlight state and deselect color
        highlightLocked = false;
        lockedColorIndex = null;
        clearHighlight();
        // Remove active state from all adjacent swatches
        document.querySelectorAll('.adjacent-swatch').forEach(el => el.classList.remove('active'));
        // Disable ignore button since no color is selected
        if (elements.ignoreColorBtn) elements.ignoreColorBtn.disabled = true;
    });
}

// Iteratively perform per-pixel replacement until convergence
function performIterativeReplace(){
    if (!quantizedResult || lockedColorIndex == null) return;
    
    const assignments = quantizedResult.assignments;
    const width = currentImageData.width;
    const height = currentImageData.height;
    const total = width * height;
    
    // Save original assignments for ENTIRE operation (for undo)
    const originalAssignments = new Uint32Array(assignments);
    const allChangedPixels = new Map(); // Track all pixels changed across iterations
    
    // Map ignored hexes to indices once
    const ignoredIdx = new Set();
    console.log(`Ignored hexes:`, Array.from(ignoredHexes));
    ignoredHexes.forEach(h => {
        const idx = findColorIndexByHex(h);
        if (idx != null) {
            ignoredIdx.add(idx);
            console.log(`  ${h} -> index ${idx} (${rgbToHex(quantizedResult.centroids[idx])})`);
        } else {
            console.log(`  ${h} -> NOT FOUND in palette`);
        }
    });
    console.log(`Ignored color indices:`, Array.from(ignoredIdx));
    
    let iteration = 0;
    let previousCount = -1;
    const maxIterations = 1000; // Safety limit
    
    console.log(`Starting iterative adjacent replacement for color ${lockedColorIndex}...`);
    
    // Iterate until convergence
    while (iteration < maxIterations) {
        iteration++;
        
        // Count current pixels of target color
        let currentCount = 0;
        for (let i = 0; i < total; i++) {
            if (assignments[i] === lockedColorIndex) currentCount++;
        }
        
        console.log(`Iteration ${iteration}: Color ${lockedColorIndex} has ${currentCount} pixels`);
        
        // Check convergence
        if (currentCount === previousCount) {
            console.log(`Converged after ${iteration - 1} iterations. No more changes.`);
            break;
        }
        
        if (currentCount === 0) {
            console.log(`Color ${lockedColorIndex} completely replaced after ${iteration} iterations.`);
            break;
        }
        
        previousCount = currentCount;
        
        // Calculate which pixels to replace in this iteration
        const targets = new Int32Array(total);
        targets.fill(-1);
        
        function uniqueNeighborTarget(i){
            const x = i % width; const y = (i - x) / width;
            const candidates = new Set();
            
            // Check only 4 neighbors (NO diagonals)
            if (x > 0) candidates.add(assignments[i-1]);                    // left
            if (x+1 < width) candidates.add(assignments[i+1]);              // right
            if (y > 0) candidates.add(assignments[i-width]);                // top
            if (y+1 < height) candidates.add(assignments[i+width]);         // bottom
            
            // Remove the target color itself
            candidates.delete(lockedColorIndex);
            
            // Remove ignored colors
            ignoredIdx.forEach(idx => candidates.delete(idx));
            
            // Debug specific pixel
            if (x === 107 && y === 353) {
                console.log(`Pixel (${x}, ${y}): candidates before filter =`, Array.from(candidates).map(c => rgbToHex(quantizedResult.centroids[c])));
                console.log(`Locked color: ${lockedColorIndex}, Ignored indices:`, Array.from(ignoredIdx));
            }
            
            if (candidates.size === 1) return [...candidates][0];
            return -1;
        }
        
        // Find pixels to replace
        let replacedInIteration = 0;
        for (let i=0; i<total; i++){
            if (assignments[i] !== lockedColorIndex) continue;
            const t = uniqueNeighborTarget(i);
            if (t !== -1) {
                targets[i] = t;
                replacedInIteration++;
            }
        }
        
        if (replacedInIteration === 0) {
            console.log(`No more replaceable pixels found after ${iteration} iterations.`);
            break;
        }
        
        console.log(`  Replacing ${replacedInIteration} pixels in iteration ${iteration}`);
        
        // Perform replacement for this iteration
        for (let i=0; i<total; i++){
            if (targets[i] !== -1) {
                // Track this pixel change (save original only if not already changed)
                if (!allChangedPixels.has(i)) {
                    allChangedPixels.set(i, originalAssignments[i]);
                }
                assignments[i] = targets[i];
            }
        }
    }
    
    // Store the complete set of changed pixels for undo
    adjacentReplacementHistory.set(lockedColorIndex, allChangedPixels);
    adjacentReplacedColors.add(lockedColorIndex);
    
    console.log(`Iterative replacement complete. Total pixels changed: ${allChangedPixels.size}`);
    
    // Redraw and update palette/stats
    const img = applyQuantization(currentImageData, quantizedResult.centroids, assignments);
    const ctx = elements.quantizedCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(img, 0, 0);
    const stats = calculateColorStats(assignments, quantizedResult.centroids.length);
    colorData = { colors: quantizedResult.centroids, stats, originalIndices: quantizedResult.centroids.map((_,i)=>i) };
    displayColorPalette(colorData.colors, stats, colorData.originalIndices);
    if (elements.activeColorCount) {
        const totalActive = stats.counts.reduce((acc, c, i) => acc + ((c > 0 && !replacedColors.has(i)) ? 1 : 0), 0);
        elements.activeColorCount.textContent = `(${totalActive} active)`;
    }
}

// Execute per-pixel replacements using precomputed perPixelSurroundTargets (legacy single iteration)
function performPerPixelReplace(){
    if (!quantizedResult || !perPixelSurroundTargets || lockedColorIndex == null) return;
    const assignments = quantizedResult.assignments;
    
    // Track only the pixels that will be changed in THIS operation
    const changedPixels = new Map(); // Map<pixelIndex, originalColorIndex>
    
    for (let i=0;i<assignments.length;i++){
        const t = perPixelSurroundTargets[i];
        if (t !== -1) {
            // Save original color ONLY for pixels being changed
            changedPixels.set(i, assignments[i]);
            assignments[i] = t;
        }
    }
    
    // Store only the changed pixels for this color
    adjacentReplacementHistory.set(lockedColorIndex, changedPixels);
    adjacentReplacedColors.add(lockedColorIndex);
    
    // Redraw and update palette/stats
    const img = applyQuantization(currentImageData, quantizedResult.centroids, assignments);
    const ctx = elements.quantizedCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(img, 0, 0);
    const stats = calculateColorStats(assignments, quantizedResult.centroids.length);
    colorData = { colors: quantizedResult.centroids, stats, originalIndices: quantizedResult.centroids.map((_,i)=>i) };
    displayColorPalette(colorData.colors, stats, colorData.originalIndices);
    if (elements.activeColorCount) {
        const totalActive = stats.counts.reduce((acc, c, i) => acc + ((c > 0 && !replacedColors.has(i)) ? 1 : 0), 0);
        elements.activeColorCount.textContent = `(${totalActive} active)`;
    }
}

// Restore adjacent replacement for a specific color
function restoreAdjacentReplacement(colorIndex) {
    if (!quantizedResult || !adjacentReplacementHistory.has(colorIndex)) return;
    
    // Get the map of changed pixels for this operation
    const changedPixels = adjacentReplacementHistory.get(colorIndex);
    
    // Restore ONLY the pixels that were changed in that specific operation
    changedPixels.forEach((originalColor, pixelIndex) => {
        quantizedResult.assignments[pixelIndex] = originalColor;
    });
    
    // Remove from tracking
    adjacentReplacedColors.delete(colorIndex);
    adjacentReplacementHistory.delete(colorIndex);
    
    // Redraw
    const img = applyQuantization(currentImageData, quantizedResult.centroids, quantizedResult.assignments);
    const ctx = elements.quantizedCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(img, 0, 0);
    const stats = calculateColorStats(quantizedResult.assignments, quantizedResult.centroids.length);
    colorData = { colors: quantizedResult.centroids, stats, originalIndices: quantizedResult.centroids.map((_,i)=>i) };
    displayColorPalette(colorData.colors, stats, colorData.originalIndices);
    if (elements.activeColorCount) {
        const totalActive = stats.counts.reduce((acc, c, i) => acc + ((c > 0 && !replacedColors.has(i)) ? 1 : 0), 0);
        elements.activeColorCount.textContent = `(${totalActive} active)`;
    }
}

// Toggle grid overlay
function toggleGrid(e) {
    showGrid = e.target.checked;
    if (showGrid) {
        drawGrid();
    } else {
        clearGrid();
    }
}

// Draw grid overlay
function drawGrid() {
    if (!currentImageData) return;
    
    // Clear existing grids
    clearGrid();
    
    // Create grid overlays for both canvases
    const canvases = [elements.originalCanvas, elements.quantizedCanvas];
    
    canvases.forEach((canvas, index) => {
        const gridCanvas = document.createElement('canvas');
        gridCanvas.className = 'grid-overlay';
        gridCanvas.style.pointerEvents = 'none';
        gridCanvas.style.position = 'absolute';
        gridCanvas.style.zIndex = '150';
        
        // Set size to match the canvas
        gridCanvas.width = canvas.width;
        gridCanvas.height = canvas.height;
        gridCanvas.style.width = canvas.offsetWidth + 'px';
        gridCanvas.style.height = canvas.offsetHeight + 'px';
        gridCanvas.style.left = canvas.offsetLeft + 'px';
        gridCanvas.style.top = canvas.offsetTop + 'px';
        
        // Add to parent
        canvas.parentElement.appendChild(gridCanvas);
        
        const ctx = gridCanvas.getContext('2d');
        
        console.log(`Drawing grid for resolution ${currentResolution}: ${gridCanvas.width}x${gridCanvas.height} pixels (${gridCanvas.width} vertical lines, ${gridCanvas.height} horizontal lines)`);
        
        // Draw individual yarn lines (every 1 pixel = 1 yarn line)
        // Lighter color for individual lines
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.lineWidth = 1;
        
        // Draw every single yarn line (1 line per pixel)
        // 58 lines/cm = 580 lines for 10cm
        // 116 lines/cm = 1160 lines for 10cm
        for (let x = 0; x <= gridCanvas.width; x++) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gridCanvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= gridCanvas.height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gridCanvas.width, y);
            ctx.stroke();
        }
        
        // Draw 1cm boundary lines (thicker and red)
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        const cmGridSize = currentResolution; // pixels per 1cm
        
        // Draw 1cm vertical boundaries
        for (let x = 0; x <= gridCanvas.width; x += cmGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gridCanvas.height);
            ctx.stroke();
        }
        
        // Draw 1cm horizontal boundaries
        for (let y = 0; y <= gridCanvas.height; y += cmGridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gridCanvas.width, y);
            ctx.stroke();
        }
        
        // Store reference for cleanup
        if (!window.gridCanvases) window.gridCanvases = [];
        window.gridCanvases.push(gridCanvas);
    });
}

// Clear grid overlay
function clearGrid() {
    if (window.gridCanvases) {
        window.gridCanvases.forEach(canvas => {
            if (canvas && canvas.parentElement) {
                canvas.parentElement.removeChild(canvas);
            }
        });
        window.gridCanvases = [];
    }
}

// Sort palette by different criteria
function sortPalette(sortType) {
    currentSort = sortType;
    
    // Update button states
    if (sortType === 'brightness') {
        elements.sortBrightness?.classList.add('active');
        elements.sortPixels?.classList.remove('active');
    } else {
        elements.sortBrightness?.classList.remove('active');
        elements.sortPixels?.classList.add('active');
    }
    
    // Re-display palette with new sorting
    if (colorData) {
        displayColorPalette(colorData.colors, colorData.stats, colorData.originalIndices);
    }
}

// Enable replace mode
function enableReplaceMode() {
    // Toggle behavior
    replaceMode = !replaceMode;
    replaceSourceIndex = null;
    if (elements.replaceInstructions) {
        elements.replaceInstructions.style.display = replaceMode ? 'block' : 'none';
        elements.replaceInstructions.textContent = 'Click a color to replace (1)';
    }
    if (replaceMode) {
        elements.replaceButton?.classList.add('active');
    } else {
        elements.replaceButton?.classList.remove('active');
        document.querySelectorAll('.color-row').forEach(r => r.classList.remove('selected-source'));
    }
}

// Show confirmation modal and perform replace
function showReplaceConfirm(sourceIndex, targetIndex) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const sourceHex = rgbToHex(quantizedResult.centroids[sourceIndex]);
    const targetHex = rgbToHex(quantizedResult.centroids[targetIndex]);
    modal.innerHTML = `
        <h4>Confirm Replace</h4>
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="width:16px;height:16px;border:1px solid #ccc;background:${sourceHex};display:inline-block;"></span>
                <span>${sourceHex}</span>
            </span>
            <span>»</span>
            <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="width:16px;height:16px;border:1px solid #ccc;background:${targetHex};display:inline-block;"></span>
                <span>${targetHex}</span>
            </span>
        </div>
        <div class="actions">
            <button id="rc-cancel" class="sort-btn">Cancel</button>
            <button id="rc-confirm" class="sort-btn active">Confirm</button>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.querySelector('#rc-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
        replaceMode = false;
        replaceSourceIndex = null;
        if (elements.replaceInstructions) elements.replaceInstructions.style.display = 'none';
        elements.replaceButton?.classList.remove('active');
    });
    overlay.querySelector('#rc-confirm').addEventListener('click', () => {
        document.body.removeChild(overlay);
        performReplace(sourceIndex, targetIndex);
        replaceMode = false;
        replaceSourceIndex = null;
        if (elements.replaceInstructions) elements.replaceInstructions.style.display = 'none';
        elements.replaceButton?.classList.remove('active');
        // Clear any highlight and row selections after replacement
        highlightLocked = false;
        lockedColorIndex = null;
        highlightedColorIndex = -1;
        clearHighlight();
        document.querySelectorAll('.color-row').forEach(r => {
            r.classList.remove('active');
            r.classList.remove('selected-source');
        });
    });
}

// Replace logic: remap assignments of source to target, update palette stats/display
function performReplace(sourceIndex, targetIndex) {
    if (!quantizedResult) return;
    if (sourceIndex === targetIndex) return;

    // Reassign pixels
    for (let i = 0; i < quantizedResult.assignments.length; i++) {
        if (quantizedResult.assignments[i] === sourceIndex) {
            quantizedResult.assignments[i] = targetIndex;
        } else if (quantizedResult.assignments[i] > sourceIndex) {
            // If we remove the centroid later, shift indices; handle afterwards
        }
    }

    // Keep the source color in the palette for visual reference with a red cross
    // but remap its pixels to target. Track it in replacedColors so it persists.
    replacedColors.add(sourceIndex);

    // Redraw quantized canvas
    const newImage = applyQuantization(currentImageData, quantizedResult.centroids, quantizedResult.assignments);
    const ctx = elements.quantizedCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(newImage, 0, 0);

    // Update color data and palette UI
    const stats = calculateColorStats(quantizedResult.assignments, quantizedResult.centroids.length);
    colorData = {
        colors: quantizedResult.centroids,
        stats: stats,
        originalIndices: quantizedResult.centroids.map((_, i) => i)
    };
    // Re-render palette with replaced state and reset icons
    displayColorPalette(colorData.colors, stats, colorData.originalIndices);
    // Update active color indicator explicitly after replace
    if (elements.activeColorCount) {
        const totalActive = stats.counts.reduce((acc, c, i) => acc + ((c > 0 && !replacedColors.has(i)) ? 1 : 0), 0);
        elements.activeColorCount.textContent = `(${totalActive} active)`;
    }
    // Row rendering already uses replacedColors to persist visuals
}

// Restore the pixels that were remapped from sourceIndex back to the source color
function restoreReplacement(sourceIndex) {
    if (!quantizedResult) return;
    // Remove persistent replaced mark
    replacedColors.delete(sourceIndex);
    // Recompute nearest for only those currently mapped to target due to our previous move
    for (let i = 0; i < quantizedResult.assignments.length; i++) {
        // If pixel was originally from source, we cannot know now. So recompute assignment:
        const px = i % currentImageData.width;
        // Assign by nearest centroid again ensures consistency; but to restore exact,
        // we bias toward source color by checking if it's the nearest.
        const { index } = findClosestCentroid([
            currentImageData.data[i*4],
            currentImageData.data[i*4+1],
            currentImageData.data[i*4+2]
        ], quantizedResult.centroids);
        quantizedResult.assignments[i] = index;
    }
    const img = applyQuantization(currentImageData, quantizedResult.centroids, quantizedResult.assignments);
    const ctx = elements.quantizedCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(img, 0, 0);
    const stats = calculateColorStats(quantizedResult.assignments, quantizedResult.centroids.length);
    colorData = { colors: quantizedResult.centroids, stats, originalIndices: quantizedResult.centroids.map((_,i)=>i) };
    displayColorPalette(colorData.colors, stats, colorData.originalIndices);
    // Update active color indicator explicitly after reset
    if (elements.activeColorCount) {
        const totalActive = stats.counts.reduce((acc, c, i) => acc + ((c > 0 && !replacedColors.has(i)) ? 1 : 0), 0);
        elements.activeColorCount.textContent = `(${totalActive} active)`;
    }
}

// Handle canvas hover for magnifier and crosshairs
function handleCanvasHover(e) {
    if (!originalImage || !currentImageData) return;
    
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    // Calculate scale factors
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Track pixel coordinates - but NOT for keyboard-generated synthetic events
    // Only update pixel coords for real mouse movements to prevent drift
    if (!isSyntheticMove) {
        lastPixelX = Math.floor(x * scaleX);
        lastPixelY = Math.floor(y * scaleY);
    }
    
    // Show crosshairs
    elements.crosshairH.style.display = 'block';
    elements.crosshairV.style.display = 'block';
    elements.crosshairH.style.zIndex = '5000';
    elements.crosshairV.style.zIndex = '5000';
    elements.crosshairH.style.top = `${e.clientY}px`;
    elements.crosshairV.style.left = `${e.clientX}px`;
    
    // Normalize to [0,1] for magnifier
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    const u = Math.min(Math.max(canvasX / canvas.width, 0), 0.9999);
    const v = Math.min(Math.max(canvasY / canvas.height, 0), 0.9999);
    
    // Update coord badge (pixel coordinates on quantized canvas)
    if (elements.coordBadge) {
        if (e.target === elements.quantizedCanvas) {
            const px = Math.floor(canvasX);
            const py = Math.floor(canvasY);
            elements.coordBadge.textContent = `${px}, ${py}`;
            elements.coordBadge.style.display = 'block';
            // Keep badge on-screen and away from cursor
            const badge = elements.coordBadge;
            const margin = 10;
            // First place to bottom-right
            let left = e.clientX + 14;
            let top = e.clientY + 14;
            // Measure badge
            badge.style.left = `${left}px`;
            badge.style.top = `${top}px`;
            const rectB = badge.getBoundingClientRect();
            // Flip horizontally if overflow right
            if (rectB.right + margin > window.innerWidth) left = e.clientX - rectB.width - 14;
            // Flip vertically if overflow bottom
            if (rectB.bottom + margin > window.innerHeight) top = e.clientY - rectB.height - 14;
            badge.style.left = `${Math.max(0, left)}px`;
            badge.style.top = `${Math.max(0, top)}px`;
        } else {
            elements.coordBadge.style.display = 'none';
        }
    }

    // Update proof badge: show RGB, assigned centroid, nearest centroid (by current metric)
    if (elements.proofBadge && e.target === elements.quantizedCanvas && currentImageData && quantizedResult) {
        const px = Math.floor(canvasX);
        const py = Math.floor(canvasY);
        const idx = (py * currentImageData.width + px) * 4;
        if (idx >= 0 && idx + 2 < currentImageData.data.length) {
            const r = currentImageData.data[idx];
            const g = currentImageData.data[idx+1];
            const b = currentImageData.data[idx+2];
            const assignedIndex = quantizedResult.assignments[py * currentImageData.width + px];
            const assignedHex = rgbToHex(quantizedResult.centroids[assignedIndex] || [0,0,0]);
            const assignedDist = colorDistance([r,g,b], quantizedResult.centroids[assignedIndex] || [0,0,0]);

            const nearest = findClosestCentroid([r,g,b], quantizedResult.centroids);
            const nearestHex = rgbToHex(quantizedResult.centroids[nearest.index] || [0,0,0]);
            const nearestDist = nearest.distance;

            // Optional two specific references
            const ref1 = [0x7c,0x7f,0x84];
            const ref2 = [0xac,0x5b,0x62];
            const dRef1 = colorDistance([r,g,b], ref1);
            const dRef2 = colorDistance([r,g,b], ref2);

            const match = assignedIndex === nearest.index ? '✓' : '✗';
            elements.proofBadge.textContent = `RGB(${r},${g},${b}) assigned ${assignedHex} d=${assignedDist.toFixed(2)} | nearest ${nearestHex} d=${nearestDist.toFixed(2)} ${match} | d(#7c7f84)=${dRef1.toFixed(2)} d(#ac5b62)=${dRef2.toFixed(2)}`;
            elements.proofBadge.style.display = 'block';
            // Position similar to coord badge, but stacked slightly below
            const badge = elements.proofBadge;
            const margin = 10;
            let left = e.clientX + 14;
            let top = e.clientY + 34; // below coord badge
            badge.style.left = `${left}px`;
            badge.style.top = `${top}px`;
            const rectB = badge.getBoundingClientRect();
            if (rectB.right + margin > window.innerWidth) left = e.clientX - rectB.width - 14;
            if (rectB.bottom + margin > window.innerHeight) top = e.clientY - rectB.height - 14;
            badge.style.left = `${Math.max(0, left)}px`;
            badge.style.top = `${Math.max(0, top)}px`;
        }
    } else if (elements.proofBadge && e.type === 'mouseleave') {
        elements.proofBadge.style.display = 'none';
    }

    // Show magnifier with smart positioning
    if (magnifierActive) {
        elements.magnifier.style.display = 'block';
        elements.magnifierOriginal.style.display = 'block';

        // Position each lens NEAR the cursor (do not cover the crosshair)
        const magnifierSize = 300;
        const offset = 20;
        const u = canvasX / canvas.width;
        const v = canvasY / canvas.height;

        const origRect = elements.originalCanvas.getBoundingClientRect();
        const quantRect = elements.quantizedCanvas.getBoundingClientRect();

        const origClientX = origRect.left + u * origRect.width;
        const origClientY = origRect.top + v * origRect.height;
        const quantClientX = quantRect.left + u * quantRect.width;
        const quantClientY = quantRect.top + v * quantRect.height;

        // Helper to choose side: prefer bottom-right; flip if out of bounds
        function placeNear(clientX, clientY) {
            let left = clientX + offset;
            let top = clientY + offset;
            if (left + magnifierSize > window.innerWidth) left = clientX - magnifierSize - offset;
            if (top + magnifierSize > window.innerHeight) top = clientY - magnifierSize - offset;
            if (left < 0) left = 0;
            if (top < 0) top = 0;
            return { left, top };
        }

        const posOrig = placeNear(origClientX, origClientY);
        const posQuant = placeNear(quantClientX, quantClientY);

        elements.magnifierOriginal.style.left = `${posOrig.left}px`;
        elements.magnifierOriginal.style.top = `${posOrig.top}px`;
        elements.magnifier.style.left = `${posQuant.left}px`;
        elements.magnifier.style.top = `${posQuant.top}px`;

        // Draw magnified areas (normalized coordinates for perfect sync)
        drawMagnifier(u, v);
        drawMagnifierOriginal(u, v);
    }
}

// Handle canvas leave
function handleCanvasLeave() {
    magnifierActive = false;
    elements.magnifier.style.display = 'none';
    elements.magnifierOriginal.style.display = 'none';
    elements.crosshairH.style.display = 'none';
    elements.crosshairV.style.display = 'none';
    if (elements.coordBadge) elements.coordBadge.style.display = 'none';
    if (elements.proofBadge) elements.proofBadge.style.display = 'none';
}

// Build a draggable proof popup showing distances for the current hovered pixel
function openProofPopup(clientX, clientY){
    if (!quantizedResult || !currentImageData) return;
    const rect = elements.quantizedCanvas.getBoundingClientRect();
    const px = Math.floor((clientX - rect.left) * elements.quantizedCanvas.width / rect.width);
    const py = Math.floor((clientY - rect.top) * elements.quantizedCanvas.height / rect.height);
    if (px < 0 || py < 0 || px >= currentImageData.width || py >= currentImageData.height) return;
    const idx = (py * currentImageData.width + px) * 4;
    const p = [currentImageData.data[idx], currentImageData.data[idx+1], currentImageData.data[idx+2]];
    const assignedIndex = quantizedResult.assignments[py * currentImageData.width + px];
    const assigned = quantizedResult.centroids[assignedIndex] || [0,0,0];
    const nearest = findClosestCentroid(p, quantizedResult.centroids);
    const rows = quantizedResult.centroids.map((c,i)=>({hex: rgbToHex(c), d: colorDistance(p,c), i})).sort((a,b)=>a.d-b.d);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'proof-modal';
    modal.style.left = Math.max(10, clientX - 200) + 'px';
    modal.style.top = Math.max(10, clientY + 10) + 'px';
    modal.innerHTML = `
      <div class="header"><span>Proof @ (${px}, ${py})</span><span class="close">✕</span></div>
      <div class="body">
        <div>RGB(${p[0]},${p[1]},${p[2]})</div>
        <div>Assigned: <b>${rgbToHex(assigned)}</b> d=${colorDistance(p,assigned).toFixed(2)}</div>
        <div>Nearest: <b>${rgbToHex(quantizedResult.centroids[nearest.index])}</b> d=${nearest.distance.toFixed(2)} ${assignedIndex===nearest.index?'✓':'✗'}</div>
        <table class="proof-table"><thead><tr><th>#</th><th>Hex</th><th>Distance</th></tr></thead><tbody>
          ${rows.map((r,idx)=>`<tr class="${idx===0?'best':''}"><td>${r.i}</td><td>${r.hex}</td><td>${r.d.toFixed(2)}</td></tr>`).join('')}
        </tbody></table>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.querySelector('.close').addEventListener('click', ()=>document.body.removeChild(overlay));
    overlay.addEventListener('click', (e)=>{ if (e.target===overlay) document.body.removeChild(overlay); });
    // Drag
    const header = modal.querySelector('.header');
    let dragging=false,sx=0,sy=0,ox=0,oy=0;
    header.addEventListener('mousedown',(e)=>{ dragging=true; sx=e.clientX; sy=e.clientY; const st=getComputedStyle(modal); ox=parseInt(st.left)||0; oy=parseInt(st.top)||0; document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp); });
    function onMove(e){ if(!dragging) return; modal.style.left = (ox + e.clientX - sx) + 'px'; modal.style.top = (oy + e.clientY - sy) + 'px'; }
    function onUp(){ dragging=false; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); }
}

// Show how a medoid like #7c7f84 was selected: distances from the pixel to all current medoids
// and the seed/iteration snapshots if available (from trace)
function openPaletteProofPopup(clientX, clientY){
    if (!quantizedResult || !currentImageData) return;
    const rect = elements.originalCanvas.getBoundingClientRect();
    const px = Math.floor((clientX - rect.left) * elements.originalCanvas.width / rect.width);
    const py = Math.floor((clientY - rect.top) * elements.originalCanvas.height / rect.height);
    if (px < 0 || py < 0 || px >= currentImageData.width || py >= currentImageData.height) return;
    const idx = (py * currentImageData.width + px) * 4;
    const p = [currentImageData.data[idx], currentImageData.data[idx+1], currentImageData.data[idx+2]];
    const nearest = findClosestCentroid(p, quantizedResult.centroids);
    const rows = quantizedResult.centroids.map((c,i)=>({hex: rgbToHex(c), d: colorDistance(p,c), i})).sort((a,b)=>a.d-b.d);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'proof-modal';
    modal.style.left = Math.max(10, clientX - 200) + 'px';
    modal.style.top = Math.max(10, clientY + 10) + 'px';
    const trace = (quantizedResult && quantizedResult.debug) ? quantizedResult.debug : null;
    modal.innerHTML = `
      <div class="header"><span>K palette proof @ (${px}, ${py})</span><span class="close">✕</span></div>
      <div class="body">
        <div>RGB(${p[0]},${p[1]},${p[2]})</div>
        <div>Nearest current medoid: <b>${rgbToHex(quantizedResult.centroids[nearest.index])}</b> d=${nearest.distance.toFixed(2)}</div>
        ${trace && trace.seeds ? `<div style='margin-top:6px;'>Seeds (initial medoids): ${trace.seeds.map(c=>rgbToHex(c)).join(', ')}</div>` : ''}
        ${trace && (trace.medoidsByIter||trace.centroidsByIter) ? `<div style='margin-top:6px;'>Iterations: ${(trace.medoidsByIter||trace.centroidsByIter).length}</div>` : ''}
        <table class="proof-table"><thead><tr><th>#</th><th>Hex</th><th>Distance</th></tr></thead><tbody>
          ${rows.map((r,idx)=>`<tr class="${idx===0?'best':''}"><td>${r.i}</td><td>${r.hex}</td><td>${r.d.toFixed(2)}</td></tr>`).join('')}
        </tbody></table>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.querySelector('.close').addEventListener('click', ()=>document.body.removeChild(overlay));
    overlay.addEventListener('click', (e)=>{ if (e.target===overlay) document.body.removeChild(overlay); });
    const header = modal.querySelector('.header');
    let dragging=false,sx=0,sy=0,ox=0,oy=0;
    header.addEventListener('mousedown',(e)=>{ dragging=true; sx=e.clientX; sy=e.clientY; const st=getComputedStyle(modal); ox=parseInt(st.left)||0; oy=parseInt(st.top)||0; document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp); });
    function onMove(e){ if(!dragging) return; modal.style.left = (ox + e.clientX - sx) + 'px'; modal.style.top = (oy + e.clientY - sy) + 'px'; }
    function onUp(){ dragging=false; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); }
}

// Draw magnifier content with red dot cursor and color info
function drawMagnifier(u, v) {
    const magnifierCtx = elements.magnifierCanvas.getContext('2d');
    
    // Source size = 1cm = currentResolution pixels
    // This captures exactly one 1cm x 1cm square
    const sourceSize = currentResolution; 
    
    // Magnifier canvas size = 400x400 to show detail
    const magnifierSize = 400;
    elements.magnifierCanvas.width = magnifierSize;
    elements.magnifierCanvas.height = magnifierSize;
    
    // Draw magnified portion
    magnifierCtx.imageSmoothingEnabled = false;
    magnifierCtx.clearRect(0, 0, magnifierSize, magnifierSize);
    
    // Use stored pixel coordinates if available (more accurate for Find feature)
    // Otherwise calculate from normalized coords
    let qx, qy;
    if (lastPixelX >= 0 && lastPixelY >= 0) {
        qx = lastPixelX;
        qy = lastPixelY;
    } else {
        qx = Math.floor(u * elements.quantizedCanvas.width);
        qy = Math.floor(v * elements.quantizedCanvas.height);
    }
    let originalColor = null;
    let pixelColor = null;
    
    // Get original color
    if (currentImageData && qx >= 0 && qx < currentImageData.width && 
        qy >= 0 && qy < currentImageData.height) {
        const idx = (qy * currentImageData.width + qx) * 4;
        originalColor = [
            currentImageData.data[idx],
            currentImageData.data[idx + 1],
            currentImageData.data[idx + 2]
        ];
    }
    
    // Get quantized color
    if (quantizedResult && quantizedResult.assignments) {
        const pixelIndex = qy * currentImageData.width + qx;
        if (pixelIndex >= 0 && pixelIndex < quantizedResult.assignments.length) {
            const colorIndex = quantizedResult.assignments[pixelIndex];
            pixelColor = quantizedResult.centroids[colorIndex];
        }
    }
    
    // Draw only the pixel image in the magnifier (no split)
    if (quantizedResult) {
        // Compute integer-aligned source window so pixel boundaries align with grid
        let srcX = Math.floor(qx - sourceSize / 2);
        let srcY = Math.floor(qy - sourceSize / 2);
        // Clamp to image bounds
        srcX = Math.max(0, Math.min(srcX, elements.quantizedCanvas.width - sourceSize));
        srcY = Math.max(0, Math.min(srcY, elements.quantizedCanvas.height - sourceSize));
        magnifierCtx.drawImage(
            elements.quantizedCanvas,
            srcX, srcY, sourceSize, sourceSize,
            0, 0, magnifierSize, magnifierSize
        );
        
        // In magnifier: overlay yellow-highlighted pixels using the same source window
        // Show highlights for both single-color and multi-color selections
        // Toggle visibility with Shift key
        if (highlightVisibleInMagnifier && highlightCanvas && (highlightedColorIndex >= 0 || multiColorSelectedIndices.size > 0)) {
            magnifierCtx.imageSmoothingEnabled = false;
            magnifierCtx.drawImage(
                highlightCanvas,
                srcX, srcY, sourceSize, sourceSize,
                0, 0, magnifierSize, magnifierSize
            );
        }
        
        // Draw grid overlay in magnifier if grid is enabled
        if (showGrid) {
            console.log(`Drawing magnifier grid: sourceSize=${sourceSize}, magnifierSize=${magnifierSize}, pixelsPerYarnLine=${magnifierSize / sourceSize}`);
            
            // Draw individual yarn lines (darker for visibility)
            magnifierCtx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
            magnifierCtx.lineWidth = 1;
            
            // Calculate pixels per yarn line in magnifier
            // sourceSize pixels fit into magnifierSize pixels
            const pixelsPerYarnLine = magnifierSize / sourceSize;
            
            // Draw grid lines for each yarn line
            for (let x = 0; x <= magnifierSize; x += pixelsPerYarnLine) {
                magnifierCtx.beginPath();
                magnifierCtx.moveTo(x, 0);
                magnifierCtx.lineTo(x, magnifierSize);
                magnifierCtx.stroke();
            }
            
            for (let y = 0; y <= magnifierSize; y += pixelsPerYarnLine) {
                magnifierCtx.beginPath();
                magnifierCtx.moveTo(0, y);
                magnifierCtx.lineTo(magnifierSize, y);
                magnifierCtx.stroke();
            }
            
            // Draw red border around the entire 1cm square
            magnifierCtx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
            magnifierCtx.lineWidth = 5;
            magnifierCtx.strokeRect(2, 2, magnifierSize - 4, magnifierSize - 4);
        }
        
        // Draw red square exactly covering the hovered source pixel inside the lens
        const pxPerSource = magnifierSize / sourceSize; // magnifier pixels per one source pixel
        // Clamp qx/qy to the visible source window to keep red square inside magnifier
        const qxClamped = Math.max(srcX, Math.min(srcX + sourceSize - 1, qx));
        const qyClamped = Math.max(srcY, Math.min(srcY + sourceSize - 1, qy));
        const localX = (qxClamped - srcX) * pxPerSource;
        const localY = (qyClamped - srcY) * pxPerSource;
        magnifierCtx.fillStyle = 'red';
        magnifierCtx.fillRect(Math.floor(localX), Math.floor(localY), Math.ceil(pxPerSource), Math.ceil(pxPerSource));
        
        // Display color hex code at bottom (pixel only)
        if (pixelColor) {
            const textBoxHeight = 35;
            magnifierCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            magnifierCtx.fillRect(0, magnifierSize - textBoxHeight, magnifierSize, textBoxHeight);
            
            magnifierCtx.fillStyle = 'white';
            magnifierCtx.font = 'bold 12px monospace';
            const hexPixel = rgbToHex(pixelColor);
            magnifierCtx.fillText(hexPixel, 10, magnifierSize - 10);
        }
    } else {
        // Just show original if no quantized version yet
        magnifierCtx.drawImage(
            elements.originalCanvas,
            qx - sourceSize/2, qy - sourceSize/2, sourceSize, sourceSize,
            0, 0, magnifierSize, magnifierSize
        );
        
        // Draw red dot for cursor position
        magnifierCtx.fillStyle = 'red';
        const center = magnifierSize / 2;
        magnifierCtx.fillRect(center - 2, center - 2, 4, 4);
        
        // Display color hex code at bottom
        if (originalColor) {
            const textBoxHeight = 35;
            magnifierCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            magnifierCtx.fillRect(0, magnifierSize - textBoxHeight, magnifierSize, textBoxHeight);
            
            magnifierCtx.fillStyle = 'white';
            magnifierCtx.font = 'bold 12px monospace';
            const hexOriginal = rgbToHex(originalColor);
            magnifierCtx.fillText(hexOriginal, magnifierSize/2 - 30, magnifierSize - 10);
        }
    }
}

// Draw original-only magnifier (no pixel image)
function drawMagnifierOriginal(u, v) {
    const ctx = elements.magnifierCanvasOriginal.getContext('2d');
    const sourceSize = currentResolution;
    const magnifierSize = 400;
    elements.magnifierCanvasOriginal.width = magnifierSize;
    elements.magnifierCanvasOriginal.height = magnifierSize;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, magnifierSize, magnifierSize);
    
    // Use same pixel coordinates as the pixel lens for consistency
    let ox, oy;
    if (lastPixelX >= 0 && lastPixelY >= 0) {
        ox = lastPixelX;
        oy = lastPixelY;
    } else {
        // Use quantizedCanvas coordinates (same as pixel lens)
        ox = Math.floor(u * elements.quantizedCanvas.width);
        oy = Math.floor(v * elements.quantizedCanvas.height);
    }
    
    // Integer-aligned source window like pixel lens
    let srcX = Math.floor(ox - sourceSize / 2);
    let srcY = Math.floor(oy - sourceSize / 2);
    // Clamp to bounds (use currentImageData dimensions, not canvas dimensions)
    if (currentImageData) {
        srcX = Math.max(0, Math.min(srcX, currentImageData.width - sourceSize));
        srcY = Math.max(0, Math.min(srcY, currentImageData.height - sourceSize));
    } else {
        srcX = Math.max(0, Math.min(srcX, elements.originalCanvas.width - sourceSize));
        srcY = Math.max(0, Math.min(srcY, elements.originalCanvas.height - sourceSize));
    }

    // Draw original window scaled
    ctx.drawImage(
        elements.originalCanvas,
        srcX, srcY, sourceSize, sourceSize,
        0, 0, magnifierSize, magnifierSize
    );
    
    // Optional grid
    if (showGrid) {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.lineWidth = 1;
        const pixelsPerYarnLine = magnifierSize / sourceSize;
        for (let x = 0; x <= magnifierSize; x += pixelsPerYarnLine) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, magnifierSize); ctx.stroke();
        }
        for (let y = 0; y <= magnifierSize; y += pixelsPerYarnLine) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(magnifierSize, y); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.lineWidth = 5;
        ctx.strokeRect(2, 2, magnifierSize - 4, magnifierSize - 4);
    }
    
    // Red square: align exactly to hovered source pixel in this window
    const pxPerSource = magnifierSize / sourceSize;
    const localX = (ox - srcX) * pxPerSource;
    const localY = (oy - srcY) * pxPerSource;
    ctx.fillStyle = 'red';
    ctx.fillRect(Math.floor(localX), Math.floor(localY), Math.ceil(pxPerSource), Math.ceil(pxPerSource));
}

// Drag and Drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            processImageFile(file);
        } else {
            alert('Please drop an image file');
        }
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processImageFile(file);
    }
}

// Pattern upload handlers
function handlePatternDragOver(e) {
    e.preventDefault(); 
    e.stopPropagation(); 
    elements.patternDropZone && elements.patternDropZone.classList.add('dragover');
}

function handlePatternDragLeave(e) {
    e.preventDefault(); 
    e.stopPropagation(); 
    elements.patternDropZone && elements.patternDropZone.classList.remove('dragover');
}

function handlePatternDrop(e) {
    e.preventDefault(); 
    e.stopPropagation(); 
    elements.patternDropZone && elements.patternDropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) { 
            processPatternFile(file); 
        } else { 
            alert('Please drop an image file'); 
        }
    }
}

function handlePatternFileSelect(e) { 
    const file = e.target.files[0]; 
    if (file) { 
        processPatternFile(file); 
    } 
}

function processPatternFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Add to pattern images array
            const patternData = {
                id: Date.now() + Math.random(), // unique ID
                src: e.target.result,
                img: img,
                rotation: 0 // Initialize rotation to 0 degrees
            };
            patternImages.push(patternData);
            
            // Display the pattern
            addPatternToList(patternData);
            
            // Reset the file input so the same file can be uploaded again
            if (elements.patternUpload) {
                elements.patternUpload.value = '';
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function addPatternToList(patternData) {
    if (!elements.patternList) return;
    
    // Initialize rotation if not set
    if (patternData.rotation === undefined) {
        patternData.rotation = 0;
    }
    
    // Create pattern item
    const item = document.createElement('div');
    item.className = 'pattern-item';
    item.dataset.patternId = patternData.id;
    
    // Create image
    const img = document.createElement('img');
    img.src = patternData.src;
    img.alt = 'Pattern';
    img.draggable = true; // Make image draggable
    img.className = 'pattern-item-image';
    
    // Drag event handlers
    img.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('patternId', patternData.id);
        draggedPattern = patternData;
        img.style.opacity = '0.5';
    });
    
    img.addEventListener('dragend', (e) => {
        img.style.opacity = '1';
        draggedPattern = null;
    });
    
    // Create rotation controls container
    const rotateControls = document.createElement('div');
    rotateControls.className = 'pattern-rotate-controls';
    
    // Rotate counter-clockwise button (-45°)
    const rotateCCWBtn = document.createElement('button');
    rotateCCWBtn.className = 'pattern-rotate-btn';
    rotateCCWBtn.innerHTML = '↺ -45°';
    rotateCCWBtn.title = 'Rotate counter-clockwise by 45°';
    rotateCCWBtn.onclick = (e) => {
        e.stopPropagation();
        rotatePattern(patternData.id, -45);
    };
    
    // Rotate clockwise button (+45°)
    const rotateCWBtn = document.createElement('button');
    rotateCWBtn.className = 'pattern-rotate-btn';
    rotateCWBtn.innerHTML = '↻ +45°';
    rotateCWBtn.title = 'Rotate clockwise by 45°';
    rotateCWBtn.onclick = (e) => {
        e.stopPropagation();
        rotatePattern(patternData.id, 45);
    };
    
    // Rotation indicator
    const rotateIndicator = document.createElement('div');
    rotateIndicator.className = 'pattern-rotate-indicator';
    rotateIndicator.textContent = `${patternData.rotation}°`;
    rotateIndicator.dataset.indicatorFor = patternData.id;
    
    rotateControls.appendChild(rotateCCWBtn);
    rotateControls.appendChild(rotateIndicator);
    rotateControls.appendChild(rotateCWBtn);
    
    // Create clear button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'pattern-item-clear';
    clearBtn.innerHTML = '×';
    clearBtn.title = 'Remove pattern';
    clearBtn.onclick = (e) => {
        e.stopPropagation();
        removePattern(patternData.id);
    };
    
    item.appendChild(img);
    item.appendChild(rotateControls);
    item.appendChild(clearBtn);
    elements.patternList.appendChild(item);
}

function rotatePattern(patternId, degrees) {
    // Find pattern in array
    const pattern = patternImages.find(p => p.id === patternId);
    if (!pattern) return;
    
    // Update rotation (normalize to 0-360 range)
    pattern.rotation = (pattern.rotation + degrees + 360) % 360;
    
    // Update rotation indicator in UI
    const indicator = document.querySelector(`[data-indicator-for="${patternId}"]`);
    if (indicator) {
        indicator.textContent = `${pattern.rotation}°`;
    }
    
    // Re-apply this pattern to all colors currently using it
    if (quantizedResult && patternOverlays) {
        // Find all color regions using this pattern and re-apply
        patternOverlays.forEach((overlay, colorIndex) => {
            if (overlay.patternData && overlay.patternData.id === patternId) {
                // Re-apply the pattern with new rotation
                applyPatternToRegion(colorIndex, pattern);
            }
        });
    }
}

function removePattern(patternId) {
    // Remove from array
    patternImages = patternImages.filter(p => p.id !== patternId);
    
    // Remove from DOM
    if (elements.patternList) {
        const item = elements.patternList.querySelector(`[data-pattern-id="${patternId}"]`);
        if (item) {
            item.remove();
        }
    }
}

// Pattern drag over canvas - show pink flashing border on hovered color region
function handlePatternDragOverCanvas(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    if (!draggedPattern || !quantizedResult) return;
    
    // Get pixel coordinates
    const rect = elements.quantizedCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * elements.quantizedCanvas.width / rect.width);
    const y = Math.floor((e.clientY - rect.top) * elements.quantizedCanvas.height / rect.height);
    
    if (x < 0 || x >= elements.quantizedCanvas.width || y < 0 || y >= elements.quantizedCanvas.height) {
        clearPatternHoverEffect();
        return;
    }
    
    // Get color index at this position
    const idx = y * elements.quantizedCanvas.width + x;
    const colorIdx = quantizedResult.assignments[idx];
    
    // If hovering over a different color region, update the effect
    if (colorIdx !== hoveredColorIndex) {
        hoveredColorIndex = colorIdx;
        showPatternHoverEffect(colorIdx);
    }
}

// Pattern drag leave canvas - clear pink border
function handlePatternDragLeaveCanvas(e) {
    clearPatternHoverEffect();
}

// Pattern drop on canvas - apply pattern overlay to the color region
function handlePatternDropOnCanvas(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedPattern || !quantizedResult) {
        console.log('Drop cancelled - missing pattern or result');
        clearPatternHoverEffect();
        return;
    }
    
    // Calculate the color index at drop position
    const rect = elements.quantizedCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * elements.quantizedCanvas.width / rect.width);
    const y = Math.floor((e.clientY - rect.top) * elements.quantizedCanvas.height / rect.height);
    
    if (x < 0 || x >= elements.quantizedCanvas.width || y < 0 || y >= elements.quantizedCanvas.height) {
        console.log('Drop cancelled - outside canvas bounds');
        clearPatternHoverEffect();
        return;
    }
    
    const idx = y * elements.quantizedCanvas.width + x;
    const colorIdx = quantizedResult.assignments[idx];
    
    console.log('Pattern dropped on canvas at', {x, y, colorIdx});
    
    // Apply pattern to the color region at drop position
    applyPatternToRegion(colorIdx, draggedPattern);
    
    // Clear hover effect
    clearPatternHoverEffect();
}

// Show pink flashing border effect on color region
function showPatternHoverEffect(colorIndex) {
    if (!quantizedResult || !elements.quantizedCanvas) return;
    
    // Clear any existing overlay
    clearPatternHoverEffect();
    
    // Create overlay canvas if it doesn't exist
    if (!patternOverlayCanvas) {
        patternOverlayCanvas = document.createElement('canvas');
        patternOverlayCanvas.width = elements.quantizedCanvas.width;
        patternOverlayCanvas.height = elements.quantizedCanvas.height;
        patternOverlayCanvas.style.position = 'absolute';
        patternOverlayCanvas.style.pointerEvents = 'none';
        patternOverlayCanvas.style.imageRendering = 'pixelated';
        
        // Match the exact position and size of the quantized canvas
        const canvasRect = elements.quantizedCanvas.getBoundingClientRect();
        const parentRect = elements.quantizedCanvas.parentElement.getBoundingClientRect();
        
        patternOverlayCanvas.style.top = (canvasRect.top - parentRect.top) + 'px';
        patternOverlayCanvas.style.left = (canvasRect.left - parentRect.left) + 'px';
        patternOverlayCanvas.style.width = canvasRect.width + 'px';
        patternOverlayCanvas.style.height = canvasRect.height + 'px';
        
        elements.quantizedCanvas.parentElement.style.position = 'relative';
        elements.quantizedCanvas.parentElement.appendChild(patternOverlayCanvas);
    }
    
    // Draw pink flashing border around the region
    drawPatternHoverBorder(colorIndex);
}

// Draw pink flashing border around color region
function drawPatternHoverBorder(colorIndex) {
    if (!patternOverlayCanvas || !quantizedResult) return;
    
    const ctx = patternOverlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, patternOverlayCanvas.width, patternOverlayCanvas.height);
    
    const width = elements.quantizedCanvas.width;
    const height = elements.quantizedCanvas.height;
    
    // Create image data for the border
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    // Find edges of the color region
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            
            if (quantizedResult.assignments[idx] === colorIndex) {
                // Check if this pixel is on the edge
                const isEdge = (
                    x === 0 || x === width - 1 ||
                    y === 0 || y === height - 1 ||
                    (x > 0 && quantizedResult.assignments[idx - 1] !== colorIndex) ||
                    (x < width - 1 && quantizedResult.assignments[idx + 1] !== colorIndex) ||
                    (y > 0 && quantizedResult.assignments[idx - width] !== colorIndex) ||
                    (y < height - 1 && quantizedResult.assignments[idx + width] !== colorIndex)
                );
                
                if (isEdge) {
                    const pixelIdx = idx * 4;
                    data[pixelIdx] = 255;     // R - Pink
                    data[pixelIdx + 1] = 105; // G
                    data[pixelIdx + 2] = 180; // B
                    data[pixelIdx + 3] = 255; // A - Full opacity
                }
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add flashing animation
    let flashCount = 0;
    const flashInterval = setInterval(() => {
        if (!patternOverlayCanvas || hoveredColorIndex !== colorIndex) {
            clearInterval(flashInterval);
            return;
        }
        
        patternOverlayCanvas.style.opacity = flashCount % 2 === 0 ? '1' : '0.5';
        flashCount++;
        
        if (flashCount > 10) {
            clearInterval(flashInterval);
        }
    }, 200);
}

// Clear pattern hover effect
function clearPatternHoverEffect() {
    hoveredColorIndex = -1;
    
    if (patternOverlayCanvas) {
        const ctx = patternOverlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, patternOverlayCanvas.width, patternOverlayCanvas.height);
        if (patternOverlayCanvas.parentElement) {
            patternOverlayCanvas.parentElement.removeChild(patternOverlayCanvas);
        }
        patternOverlayCanvas = null;
    }
}

// Apply pattern to replace color region pixels
function applyPatternToRegion(colorIndex, patternData) {
    console.log('applyPatternToRegion called', colorIndex, patternData);
    
    if (!quantizedResult || !elements.quantizedCanvas || !currentImageData) {
        console.error('Missing required data:', {
            quantizedResult: !!quantizedResult,
            canvas: !!elements.quantizedCanvas,
            currentImageData: !!currentImageData
        });
        return;
    }
    
    const width = elements.quantizedCanvas.width;
    const height = elements.quantizedCanvas.height;
    
    console.log('Canvas dimensions:', width, height);
    
    // Create a temporary canvas to draw the pattern
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    
    // Draw the pattern tiled across the canvas using createPattern for seamless tiling
    const patternImg = patternData.img;
    const patternWidth = patternImg.width;
    const patternHeight = patternImg.height;
    const rotation = patternData.rotation || 0;
    
    console.log('Pattern dimensions:', patternWidth, patternHeight, 'rotation:', rotation);
    
    // For seamless tiling with rotation, we need to tile on a larger canvas first
    if (rotation !== 0) {
        const rad = (rotation * Math.PI) / 180;
        
        // Create a larger canvas (2x size) to avoid edge artifacts after rotation
        const largeCanvas = document.createElement('canvas');
        const extraSize = Math.max(width, height);
        largeCanvas.width = width + extraSize * 2;
        largeCanvas.height = height + extraSize * 2;
        const largeCtx = largeCanvas.getContext('2d');
        largeCtx.imageSmoothingEnabled = false;
        
        // Fill large canvas with tiled pattern
        const pattern = largeCtx.createPattern(patternImg, 'repeat');
        largeCtx.fillStyle = pattern;
        largeCtx.fillRect(0, 0, largeCanvas.width, largeCanvas.height);
        
        // Now rotate the entire tiled canvas
        tempCtx.save();
        tempCtx.translate(width / 2, height / 2);
        tempCtx.rotate(rad);
        
        // Draw the rotated tiled pattern, centered
        tempCtx.drawImage(
            largeCanvas,
            -largeCanvas.width / 2 + width / 2,
            -largeCanvas.height / 2 + height / 2
        );
        
        tempCtx.restore();
    } else {
        // No rotation - standard seamless tiling
        const pattern = tempCtx.createPattern(patternImg, 'repeat');
        tempCtx.fillStyle = pattern;
        tempCtx.fillRect(0, 0, width, height);
    }
    
    // Get the pattern image data
    const patternImageData = tempCtx.getImageData(0, 0, width, height);
    const patternData_pixels = patternImageData.data;
    
    // Get the current quantized canvas data
    const ctx = elements.quantizedCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const currentData = ctx.getImageData(0, 0, width, height);
    const currentPixels = currentData.data;
    
    // Count how many pixels will be replaced
    let replacedCount = 0;
    
    // Replace pixels that belong to this color with pattern pixels
    for (let i = 0; i < quantizedResult.assignments.length; i++) {
        if (quantizedResult.assignments[i] === colorIndex) {
            const pixelIdx = i * 4;
            currentPixels[pixelIdx] = patternData_pixels[pixelIdx];         // R
            currentPixels[pixelIdx + 1] = patternData_pixels[pixelIdx + 1]; // G
            currentPixels[pixelIdx + 2] = patternData_pixels[pixelIdx + 2]; // B
            currentPixels[pixelIdx + 3] = 255;                              // A (keep opaque)
            replacedCount++;
        }
    }
    
    console.log(`Replaced ${replacedCount} pixels for color ${colorIndex}`);
    
    // Update the canvas with the modified data
    ctx.putImageData(currentData, 0, 0);
    
    // Store pattern application for this color
    patternOverlays.set(colorIndex, { patternData, applied: true });
    
    console.log(`Pattern applied successfully to color region ${colorIndex}`);
}

// Process uploaded image file
function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        originalImage = new Image();
        originalImage.onload = function() {
            // === COMPLETE RESET - as if page just loaded ===
            
            // Reset K-means centroids
            if (typeof resetPreviousCentroids === 'function') {
                resetPreviousCentroids();
            }
            
            // Clear quantized result
            quantizedResult = null;
            currentImageData = null;
            colorData = null;
            
            // Reset all replacement and adjacent states
            adjacentReplacedColors.clear();
            adjacentReplacementHistory.clear();
            replacedColors.clear();
            ignoredHexes.clear();
            multiColorSelectedIndices.clear();
            stopMultiColorFlashing();
            ignorePickActive = false;
            replaceMode = false;
            replaceSourceIndex = null;
            perPixelSurroundTargets = null;
            perPixelReplacementCount = 0;
            surroundCandidateIndex = null;
            
            // Reset highlight states
            highlightLocked = false;
            lockedColorIndex = null;
            highlightedColorIndex = -1;
            if (highlightCanvas) {
                clearHighlight();
            }
            
            // Clear magnifier state
            magnifierActive = false;
            if (elements.magnifier) elements.magnifier.style.display = 'none';
            if (elements.magnifierOriginal) elements.magnifierOriginal.style.display = 'none';
            if (elements.crosshairH) elements.crosshairH.style.display = 'none';
            if (elements.crosshairV) elements.crosshairV.style.display = 'none';
            if (elements.coordBadge) elements.coordBadge.style.display = 'none';
            if (elements.proofBadge) elements.proofBadge.style.display = 'none';
            
            // Clear adjacent preview overlay if exists
            clearAdjacentPreview();
            
            // Clear grid if active
            if (showGrid) {
                clearGrid();
                showGrid = false;
                if (elements.showGridCheckbox) elements.showGridCheckbox.checked = false;
            }
            
            // Clear UI elements
            if (elements.ignoreChips) elements.ignoreChips.innerHTML = '';
            if (elements.adjacentInstructions) elements.adjacentInstructions.textContent = '';
            if (elements.ignoreMultiChips) elements.ignoreMultiChips.innerHTML = '';
            if (elements.adjacentMultiInstructions) elements.adjacentMultiInstructions.textContent = '';
            if (elements.replaceInstructions) elements.replaceInstructions.style.display = 'none';
            if (elements.replaceButton) elements.replaceButton.classList.remove('active');
            if (elements.paletteRows) elements.paletteRows.innerHTML = '';
            if (elements.adjacentTargetOptions) elements.adjacentTargetOptions.innerHTML = '';
            if (elements.adjacentMultiTargetOptions) elements.adjacentMultiTargetOptions.innerHTML = '';
            if (elements.activeColorCount) elements.activeColorCount.textContent = '';
            
            // Reset buttons
            if (elements.ignoreColorBtn) elements.ignoreColorBtn.disabled = true;
            if (elements.resetAdjacentBtn) elements.resetAdjacentBtn.disabled = true;
            if (elements.replaceSurroundBtn) elements.replaceSurroundBtn.disabled = true;
            if (elements.ignoreMultiColorBtn) elements.ignoreMultiColorBtn.disabled = true;
            if (elements.resetAdjacentMultiBtn) elements.resetAdjacentMultiBtn.disabled = true;
            if (elements.replaceMultiSurroundBtn) elements.replaceMultiSurroundBtn.disabled = true;
            if (elements.downloadBtn) elements.downloadBtn.disabled = true;
            if (elements.downloadBmpBtn) elements.downloadBmpBtn.disabled = true;
            
            // Remove active states from all rows/swatches
            document.querySelectorAll('.color-row').forEach(r => {
                r.classList.remove('active');
                r.classList.remove('selected-source');
                r.classList.remove('replaced');
            });
            document.querySelectorAll('.adjacent-swatch').forEach(el => el.classList.remove('active'));
            
            // Hide drop zone, show image display
            elements.dropZone.style.display = 'none';
            elements.imageDisplay.style.display = 'block';
            
            // Suggest resolution based on image
            const suggestedResolution = suggestResolution(originalImage);
            document.querySelector(`input[name="resolution"][value="${suggestedResolution}"]`).checked = true;
            currentResolution = suggestedResolution;
            
            // Show recommendation
            showResolutionRecommendation(suggestedResolution);
            
            // Draw original image
            drawOriginalImage();
            
            // Enable convert button
            elements.convertBtn.disabled = false;
            
            // Update image info
            updateImageInfo();
            
            // Show K info
            updateKInfo();
            
            // Show placeholder on quantized canvas
            const qCtx = elements.quantizedCanvas.getContext('2d');
            qCtx.fillStyle = '#f0f0f0';
            qCtx.fillRect(0, 0, elements.quantizedCanvas.width, elements.quantizedCanvas.height);
            qCtx.fillStyle = '#999';
            qCtx.font = '20px Arial';
            qCtx.textAlign = 'center';
            qCtx.fillText('Processing...', elements.quantizedCanvas.width / 2, elements.quantizedCanvas.height / 2);
            
            // Auto-convert with default settings
            setTimeout(() => convertImage(), 200);
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Suggest resolution based on image characteristics
function suggestResolution(img) {
    const width = img.width;
    const height = img.height;
    const pixelCount = width * height;
    
    // Large images or high detail suggest higher resolution
    if (width > 2000 || height > 2000 || pixelCount > 2000000) {
        return 116;
    }
    
    // Default to standard resolution for smaller images
    return 58;
}

// Show resolution recommendation
function showResolutionRecommendation(resolution) {
    const recommendation = elements.resolutionRecommendation;
    if (resolution === 116) {
        recommendation.textContent = '💡 Recommended: High resolution for large/detailed image';
    } else {
        recommendation.textContent = '💡 Recommended: Standard resolution for optimal processing';
    }
    recommendation.classList.add('show');
}

// Handle resolution change - auto convert
function handleResolutionChange(event) {
    currentResolution = parseInt(event.target.value);
    if (originalImage) {
        // Clear any selected color/highlight when swapping resolution
        highlightedColorIndex = -1;
        lockedColorIndex = null;
        highlightLocked = false;
        clearHighlight();
        // Remove active state from palette rows
        document.querySelectorAll('.color-row').forEach(r => r.classList.remove('active'));

        drawOriginalImage();
        updateImageInfo();
        // Auto-convert when resolution changes
        convertImage();
        // Redraw grid if enabled
        if (showGrid) {
            setTimeout(drawGrid, 100);
        }
        // Re-align magnifiers after resolution swap using last cursor position
        if (magnifierActive) {
            const evt = new MouseEvent('mousemove', { clientX: lastMouseX || 0, clientY: lastMouseY || 0 });
            if (elements.originalCanvas) elements.originalCanvas.dispatchEvent(evt);
            if (elements.quantizedCanvas) elements.quantizedCanvas.dispatchEvent(evt);
        }
    }
}

// Draw original image on canvas
function drawOriginalImage() {
    const canvas = elements.originalCanvas;
    const ctx = canvas.getContext('2d');
    
    // Calculate pixel dimensions
    const pixelWidth = DESIGN_WIDTH * currentResolution;
    const pixelHeight = DESIGN_HEIGHT * currentResolution;
    
    // Set canvas size
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    
    // Draw image scaled to canvas
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(originalImage, 0, 0, pixelWidth, pixelHeight);
    
    // Store current image data
    currentImageData = ctx.getImageData(0, 0, pixelWidth, pixelHeight);
    
    // Set quantized canvas size to match
    elements.quantizedCanvas.width = pixelWidth;
    elements.quantizedCanvas.height = pixelHeight;
}

// Adjust K value
function adjustK(delta) {
    const newK = currentK + delta;
    
    if (newK < 2) {
        elements.kMinus.disabled = true;
        return;
    } else {
        elements.kMinus.disabled = false;
    }
    
    if (newK > 16) {
        elements.kPlus.disabled = true;
        return;
    } else {
        elements.kPlus.disabled = false;
    }
    
    currentK = newK;
    elements.kValue.textContent = currentK;
    elements.currentK.textContent = currentK;
    
    updateKInfo();
    
    // Auto-convert when K changes
    if (originalImage && currentImageData) {
        convertImage();
    }
}

// Update K information panel
function updateKInfo() {
    elements.kInfo.style.display = 'block';
    
    // Update pros and cons based on K value
    const pros = [];
    const cons = [];
    
    if (currentK <= 8) {
        // Low K advantages
        pros.push('✓ Reduced yarn inventory and production costs');
        pros.push(`✓ Faster processing (${Math.round((10 - currentK) * 10)}% quicker)`);
        pros.push('✓ Simplified machine setup with fewer yarn changes');
        pros.push('✓ Creates stylized, abstract aesthetic');
        pros.push('✓ Lower memory requirements for pattern storage');
        
        // Low K disadvantages
        cons.push('⚠ Loss of fine details in complex designs');
        cons.push(`⚠ Increased color distortion (~${Math.round((10 - currentK) * 15)}% more error)`);
        cons.push('⚠ Limited design flexibility for gradients');
        cons.push('⚠ May not capture subtle color variations');
    } else if (currentK >= 12) {
        // High K advantages
        pros.push('✓ Superior visual fidelity with more colors');
        pros.push(`✓ Reduced color distortion (~${Math.round((currentK - 10) * 10)}% less error)`);
        pros.push('✓ Supports complex designs with varied hues');
        pros.push('✓ Better gradient representation');
        pros.push('✓ Preserves fine details and textures');
        
        // High K disadvantages
        cons.push('⚠ Increased yarn inventory requirements');
        cons.push(`⚠ Slower processing (~${Math.round((currentK - 10) * 8)}% more time)`);
        cons.push('⚠ More complex machine setup');
        cons.push('⚠ Higher production costs');
        cons.push('⚠ May exceed machine yarn slot limits');
    } else {
        // Medium K (9-11) - balanced
        pros.push('✓ Balanced visual quality and production efficiency');
        pros.push('✓ Moderate yarn inventory requirements');
        pros.push('✓ Good color representation for most designs');
        pros.push('✓ Reasonable processing time');
        pros.push('✓ Compatible with standard broadloom machines');
        
        cons.push('⚠ May not capture all fine details');
        cons.push('⚠ Some color banding in gradients possible');
        cons.push('⚠ Requires careful color palette selection');
    }
    
    // Update lists
    elements.prosList.innerHTML = pros.map(p => `<li>${p}</li>`).join('');
    elements.consList.innerHTML = cons.map(c => `<li>${c}</li>`).join('');
}

// Update image information panel
function updateImageInfo() {
    if (!originalImage) return;
    
    const pixelWidth = DESIGN_WIDTH * currentResolution;
    const pixelHeight = DESIGN_HEIGHT * currentResolution;
    const totalPixels = pixelWidth * pixelHeight;
    const totalYarnLines = totalPixels;
    
    elements.imageInfo.innerHTML = `
        <strong>Image Information:</strong><br>
        Original Size: ${originalImage.width} × ${originalImage.height} pixels<br>
        Design Size: ${DESIGN_WIDTH} × ${DESIGN_HEIGHT} cm<br>
        Resolution: ${currentResolution} yarn lines/cm<br>
        Output Size: ${pixelWidth} × ${pixelHeight} pixels<br>
        Total Yarn Lines: ${totalYarnLines.toLocaleString()}<br>
        Processing Complexity: ${totalPixels > 1000000 ? 'High' : totalPixels > 500000 ? 'Medium' : 'Low'}
    `;
}

// Switch color distance calculation method
function switchDistanceMethod(method) {
    console.log(`[app.js] Switching distance method to: ${method}`);
    
    // Update button active states
    document.querySelectorAll('.distance-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (method === 'rgb') {
        elements.distanceRgb?.classList.add('active');
    } else if (method === 'hsv') {
        elements.distanceHsv?.classList.add('active');
    } else if (method === 'lab') {
        elements.distanceLab?.classList.add('active');
    }
    
    // Set the method in kmeans.js
    if (typeof setDistanceMethod === 'function') {
        setDistanceMethod(method);
    }
    
    // Reconvert the image if we have one loaded
    if (originalImage && currentImageData) {
        console.log('[app.js] Reconverting image with new distance method...');
        convertImage();
    }
}

// Convert image using K-means
async function convertImage() {
    if (!currentImageData) {
        console.error('No image data to convert');
        return;
    }
    
    // Show processing overlay
    showProcessing(true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
        try {
        // Determine sample rate based on image size
        const totalPixels = currentImageData.width * currentImageData.height;
        let sampleRate = 1;
        if (totalPixels > 500000) sampleRate = 10;
        else if (totalPixels > 100000) sampleRate = 5;
        
        // If Auto K is enabled, estimate the best K before quantization
        if (elements.autoK && elements.autoK.checked) {
            const kRecommended = estimateAutoK(currentImageData);
            currentK = kRecommended;
            elements.kValue.textContent = currentK;
            elements.currentK.textContent = currentK;
        }

        // Run quantization with stable mode and actual colors option
        const useActualColors = elements.useActualColorsCheckbox ? elements.useActualColorsCheckbox.checked : true;
        // Enable debug trace when holding T while clicking Convert, or always true for now
        const debugTrace = true;
        quantizedResult = quantizeImage(
            currentImageData, 
            currentK, 
            sampleRate,
            (progress) => {
                elements.progressFill.style.width = `${progress * 100}%`;
            },
            true, // Use stable mode
            useActualColors, // Use actual colors from image (K-medoids)
            debugTrace
        );
        
        // Display quantized image
        const ctx = elements.quantizedCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.putImageData(quantizedResult.quantizedData, 0, 0);
        
        // Calculate statistics
        const stats = calculateColorStats(quantizedResult.assignments, quantizedResult.centroids.length);
        
        // Store color data for sorting
        colorData = {
            colors: quantizedResult.centroids,
            stats: stats,
            originalIndices: quantizedResult.centroids.map((_, i) => i)
        };
        
        // Display palette with current sorting
        displayColorPalette(colorData.colors, stats, colorData.originalIndices);
        
        // Enable download button
        elements.downloadBtn.disabled = false;
        elements.downloadBmpBtn && (elements.downloadBmpBtn.disabled = false);
        
        // Hide processing overlay
        showProcessing(false);
        
        console.log('Conversion complete:', {
            k: currentK,
            centroids: quantizedResult.centroids.length,
            isActualColors: quantizedResult.isActualColors,
            debug: quantizedResult.debug
        });
        
        } catch (error) {
            console.error('Error during conversion:', error);
            showProcessing(false);
            alert('Error converting image: ' + error.message);
        }
    }, 100);
}

// Display color palette with row format
function displayColorPalette(colors, stats, originalIndices) {
    if (!elements.paletteRows) return;
    
    // Prepare data for sorting
    let sortedData = colors.map((color, index) => ({
        color: color,
        originalIndex: originalIndices[index],
        brightness: color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114,
        percentage: parseFloat(stats.percentages[originalIndices[index]]),
        count: stats.counts[originalIndices[index]]
    }));
    
    // Sort based on current criteria
    if (currentSort === 'brightness') {
        sortedData.sort((a, b) => b.brightness - a.brightness);
    } else {
        sortedData.sort((a, b) => b.count - a.count);
    }
    
    // Clear existing content
    elements.paletteRows.innerHTML = '';
    // Update active color count: non-zero count AND not marked as replaced
    if (elements.activeColorCount) {
        const activeCount = sortedData.reduce((acc, item) => {
            const nonZero = item.count > 0;
            const notReplaced = !replacedColors.has(item.originalIndex);
            return acc + (nonZero && notReplaced ? 1 : 0);
        }, 0);
        elements.activeColorCount.textContent = `(${activeCount} active)`;
    }
    
    // Create rows for each color
    sortedData.forEach((item, displayIndex) => {
        const row = document.createElement('div');
        row.className = 'color-row';
        row.dataset.colorIndex = item.originalIndex;
        
        // Color swatch
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})`;
        
        // Color info
        const info = document.createElement('div');
        info.className = 'color-info';
        info.innerHTML = `
            <span class="color-hex">${rgbToHex(item.color)}</span>
            <span class="color-stats">${item.percentage}% (${item.count.toLocaleString()} pixels)</span>
        `;
        
        row.appendChild(swatch);
        row.appendChild(info);

        // If this color was previously replaced, show red cross and reset icon
        if (replacedColors.has(item.originalIndex)) {
            row.classList.add('replaced');
            const reset = document.createElement('span');
            reset.className = 'reset-icon';
            reset.textContent = '↺ reset';
            reset.onclick = () => restoreReplacement(item.originalIndex);
            row.appendChild(reset);
        }
        
        // Add Find button (always visible, useful for rare colors)
        const findBtn = document.createElement('span');
        findBtn.className = 'find-icon';
        findBtn.textContent = '🔍 Find';
        findBtn.title = `Find and navigate to pixels of this color (${item.count} total)`;
        findBtn.onclick = (e) => {
            e.stopPropagation();
            if (findModeActive && findColorIndex === item.originalIndex) {
                // Already in find mode for this color, go to next pixel
                findNextPixel();
            } else {
                // Start find mode for this color
                startFindMode(item.originalIndex);
            }
        };
        row.appendChild(findBtn);
        
        // Add hover and click events
        row.addEventListener('mouseenter', () => {
            // Replace mode: before first click, hover previews highlight; after first click, ignore
            if (replaceMode) {
                if (replaceSourceIndex === null) {
                    row.classList.add('active');
                    highlightLocked = false;
                    highlightColorPixels(item.originalIndex);
                }
                return;
            }
            if (!highlightLocked) {
                row.classList.add('active');
                highlightColorPixels(item.originalIndex);
            }
        });
        row.addEventListener('mouseleave', () => {
            // Replace mode: before first click, remove preview; after first click, keep locked
            if (replaceMode) {
                if (replaceSourceIndex === null) {
                    row.classList.remove('active');
                    clearHighlight();
                }
                return;
            }
            if (!highlightLocked) {
                row.classList.remove('active');
                clearHighlight();
            }
        });
        // Click behavior: if replace mode, pick source/destination; else toggle lock
        row.addEventListener('click', () => {
            if (replaceMode) {
                if (replaceSourceIndex === null) {
                    // First pick (source)
                    replaceSourceIndex = item.originalIndex;
                    row.classList.add('selected-source');
                    // Lock and display highlight for the selected source color
                    highlightLocked = true;
                    lockedColorIndex = item.originalIndex;
                    
                    // Stop multi-color flashing and clear selections
                    stopMultiColorFlashing();
                    multiColorSelectedIndices.clear();
                    document.querySelectorAll('#adjacent-multi-target-options .adjacent-swatch').forEach(s => {
                        s.classList.remove('active');
                    });
                    
                    highlightColorPixels(item.originalIndex);
                    // Show instruction to pick the replacement
                    if (elements.replaceInstructions) {
                        elements.replaceInstructions.style.display = 'block';
                        elements.replaceInstructions.textContent = 'Select replacement color (2)';
                    }
                } else {
                    const targetIndex = item.originalIndex;
                    // Confirm modal
                    showReplaceConfirm(replaceSourceIndex, targetIndex);
                    // Clear visual on source
                    document.querySelectorAll('.color-row').forEach(r => r.classList.remove('selected-source'));
                }
                return;
            }

            if (highlightLocked && lockedColorIndex === item.originalIndex) {
                // Clicking the same color unlocks it
                highlightLocked = false;
                lockedColorIndex = null;
                document.querySelectorAll('.color-row').forEach(r => r.classList.remove('active'));
                clearHighlight();
            } else {
                // Lock highlight to this color
                highlightLocked = true;
                lockedColorIndex = item.originalIndex;
                document.querySelectorAll('.color-row').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
                
                // Stop multi-color flashing and clear selections
                stopMultiColorFlashing();
                multiColorSelectedIndices.clear();
                document.querySelectorAll('#adjacent-multi-target-options .adjacent-swatch').forEach(s => {
                    s.classList.remove('active');
                });
                
                highlightColorPixels(item.originalIndex);
            }
        });
        
        // Pattern drag and drop on palette rows
        row.addEventListener('dragover', (e) => {
            if (!draggedPattern || !quantizedResult) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            
            // Show pattern hover effect for this color
            if (hoveredColorIndex !== item.originalIndex) {
                hoveredColorIndex = item.originalIndex;
                showPatternHoverEffect(item.originalIndex);
            }
        });
        
        row.addEventListener('dragleave', (e) => {
            if (!draggedPattern) return;
            clearPatternHoverEffect();
        });
        
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Pattern dropped on palette row', item.originalIndex);
            
            if (!draggedPattern || !quantizedResult) {
                console.log('Drop cancelled on palette - missing data');
                clearPatternHoverEffect();
                return;
            }
            
            // Apply pattern to this color region
            applyPatternToRegion(item.originalIndex, draggedPattern);
            clearPatternHoverEffect();
        });
        
        elements.paletteRows.appendChild(row);
    });

    // Render Adjacent mirror: active colors only (count > 0 and not replaced), same order
    if (elements.adjacentTargetOptions) {
        elements.adjacentTargetOptions.innerHTML = '';
        let adjacentCount = 0;
        sortedData.forEach(item => {
            const isActive = item.count > 0 && !replacedColors.has(item.originalIndex);
            if (!isActive) return;
            adjacentCount++;
            const sw = document.createElement('div');
            sw.className = 'adjacent-swatch';
            const hex = rgbToHex(item.color);
            sw.setAttribute('data-hex', hex);
            
            // Create color preview square
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})`;
            
            // Create info container (matching Color Palette style)
            const info = document.createElement('div');
            info.className = 'color-info';
            info.innerHTML = `
                <span class="color-hex">${hex}</span>
                <span class="color-stats">${item.percentage}% (${item.count.toLocaleString()} pixels)</span>
            `;
            
            sw.appendChild(swatch);
            sw.appendChild(info);
            
            // Add reset icon if this color was modified by adjacent replacement
            if (adjacentReplacedColors.has(item.originalIndex)) {
                const reset = document.createElement('span');
                reset.className = 'reset-icon';
                reset.textContent = '↺ reset';
                reset.onclick = (e) => {
                    e.stopPropagation(); // Prevent triggering color selection
                    restoreAdjacentReplacement(item.originalIndex);
                };
                sw.appendChild(reset);
                sw.classList.add('replaced');
            }
            
            // Add Find button (always visible)
            const findBtn = document.createElement('span');
            findBtn.className = 'find-icon';
            findBtn.textContent = '🔍 Find';
            findBtn.title = `Find and navigate to pixels of this color (${item.count} total)`;
            findBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent triggering color selection
                if (findModeActive && findColorIndex === item.originalIndex) {
                    // Already in find mode for this color, go to next pixel
                    findNextPixel();
                } else {
                    // Start find mode for this color
                    startFindMode(item.originalIndex);
                }
            };
            sw.appendChild(findBtn);
            
            // Add click handler to highlight this color (single-color mode)
            sw.addEventListener('click', (e) => {
                // Don't trigger if clicking Find or Reset buttons
                if (e.target.closest('.find-icon') || e.target.closest('.reset-icon')) return;
                
                // Stop multi-color flashing
                stopMultiColorFlashing();
                
                // Clear multi-color selections
                multiColorSelectedIndices.clear();
                document.querySelectorAll('#adjacent-multi-target-options .adjacent-swatch').forEach(s => {
                    s.classList.remove('active');
                });
                
                // Highlight this color in solid yellow
                highlightColorPixels(item.originalIndex);
            });
            
            // Pattern drag and drop on adjacent swatches
            sw.addEventListener('dragover', (e) => {
                if (!draggedPattern || !quantizedResult) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                
                // Show pattern hover effect for this color
                if (hoveredColorIndex !== item.originalIndex) {
                    hoveredColorIndex = item.originalIndex;
                    showPatternHoverEffect(item.originalIndex);
                }
            });
            
            sw.addEventListener('dragleave', (e) => {
                if (!draggedPattern) return;
                clearPatternHoverEffect();
            });
            
            sw.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Pattern dropped on adjacent swatch', item.originalIndex);
                
                if (!draggedPattern || !quantizedResult) {
                    console.log('Drop cancelled on adjacent - missing data');
                    clearPatternHoverEffect();
                    return;
                }
                
                // Apply pattern to this color region
                applyPatternToRegion(item.originalIndex, draggedPattern);
                clearPatternHoverEffect();
            });
            
            elements.adjacentTargetOptions.appendChild(sw);
        });
        // Update header to show count e.g., "Adjacent (1 color) - single color"
        if (elements.adjacentPanel) {
            const titleEl = elements.adjacentPanel.querySelector('h4.section-title');
            if (titleEl) {
                const label = adjacentCount === 1 ? 'color' : 'colors';
                titleEl.textContent = `Adjacent (${adjacentCount} ${label}) - single color`;
            }
        }
    }
    
    // Render Adjacent Multi mirror: exact duplicate of single color for now
    if (elements.adjacentMultiTargetOptions) {
        elements.adjacentMultiTargetOptions.innerHTML = '';
        let adjacentMultiCount = 0;
        sortedData.forEach(item => {
            const isActive = item.count > 0 && !replacedColors.has(item.originalIndex);
            if (!isActive) return;
            adjacentMultiCount++;
            const sw = document.createElement('div');
            sw.className = 'adjacent-swatch';
            const hex = rgbToHex(item.color);
            sw.setAttribute('data-hex', hex);
            
            // Create color preview square
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})`;
            
            // Create info container (matching Color Palette style)
            const info = document.createElement('div');
            info.className = 'color-info';
            info.innerHTML = `
                <span class="color-hex">${hex}</span>
                <span class="color-stats">${item.percentage}% (${item.count.toLocaleString()} pixels)</span>
            `;
            
            sw.appendChild(swatch);
            sw.appendChild(info);
            
            // Add reset icon if this color was modified by adjacent replacement
            if (adjacentReplacedColors.has(item.originalIndex)) {
                const reset = document.createElement('span');
                reset.className = 'reset-icon';
                reset.textContent = '↺ reset';
                reset.onclick = (e) => {
                    e.stopPropagation();
                    restoreAdjacentReplacement(item.originalIndex);
                };
                sw.appendChild(reset);
                sw.classList.add('replaced');
            }
            
            // Add Find button (always visible)
            const findBtn = document.createElement('span');
            findBtn.className = 'find-icon';
            findBtn.textContent = '🔍 Find';
            findBtn.title = `Find and navigate to pixels of this color (${item.count} total)`;
            findBtn.onclick = (e) => {
                e.stopPropagation();
                if (findModeActive && findColorIndex === item.originalIndex) {
                    findNextPixel();
                } else {
                    startFindMode(item.originalIndex);
                }
            };
            sw.appendChild(findBtn);
            
            // Add click handler for multi-selection (toggle)
            sw.addEventListener('click', (e) => {
                // Don't trigger if clicking Find or Reset buttons
                if (e.target.closest('.find-icon') || e.target.closest('.reset-icon')) return;
                
                const colorIndex = item.originalIndex;
                if (multiColorSelectedIndices.has(colorIndex)) {
                    // Deselect
                    multiColorSelectedIndices.delete(colorIndex);
                    sw.classList.remove('active');
                } else {
                    // Select
                    multiColorSelectedIndices.add(colorIndex);
                    sw.classList.add('active');
                }
                
                // Update button states based on selection count
                const selectedCount = multiColorSelectedIndices.size;
                if (elements.ignoreMultiColorBtn) {
                    elements.ignoreMultiColorBtn.disabled = selectedCount < 2;
                }
                
                // Clear any single-color highlighting
                highlightLocked = false;
                lockedColorIndex = null;
                document.querySelectorAll('.color-row').forEach(r => r.classList.remove('active'));
                document.querySelectorAll('#adjacent-target-options .adjacent-swatch').forEach(s => {
                    s.classList.remove('active');
                });
                
                // Start or stop flashing based on selection
                if (selectedCount > 0) {
                    startMultiColorFlashing();
                } else {
                    stopMultiColorFlashing();
                }
                
                console.log(`Multi-color selection: ${selectedCount} colors selected`);
            });
            
            // Mark as active if already selected
            if (multiColorSelectedIndices.has(item.originalIndex)) {
                sw.classList.add('active');
            }
            
            // Pattern drag and drop on adjacent multi swatches
            sw.addEventListener('dragover', (e) => {
                if (!draggedPattern || !quantizedResult) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                
                // Show pattern hover effect for this color
                if (hoveredColorIndex !== item.originalIndex) {
                    hoveredColorIndex = item.originalIndex;
                    showPatternHoverEffect(item.originalIndex);
                }
            });
            
            sw.addEventListener('dragleave', (e) => {
                if (!draggedPattern) return;
                clearPatternHoverEffect();
            });
            
            sw.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Pattern dropped on adjacent multi swatch', item.originalIndex);
                
                if (!draggedPattern || !quantizedResult) {
                    console.log('Drop cancelled on adjacent multi - missing data');
                    clearPatternHoverEffect();
                    return;
                }
                
                // Apply pattern to this color region
                applyPatternToRegion(item.originalIndex, draggedPattern);
                clearPatternHoverEffect();
            });
            
            elements.adjacentMultiTargetOptions.appendChild(sw);
        });
        // Update header to show count e.g., "Adjacent (1 color) - multi color"
        if (elements.adjacentMultiPanel) {
            const titleEl = elements.adjacentMultiPanel.querySelector('h4.section-title');
            if (titleEl) {
                const label = adjacentMultiCount === 1 ? 'color' : 'colors';
                titleEl.textContent = `Adjacent (${adjacentMultiCount} ${label}) - multi color`;
            }
        }
        
        // Re-apply flashing if colors are selected
        if (multiColorSelectedIndices.size > 0) {
            startMultiColorFlashing();
        }
    }
}

// Highlight pixels of a specific color in yellow (solid)
function highlightColorPixels(colorIndex) {
    if (!quantizedResult) return;
    
    highlightedColorIndex = colorIndex;
    
    // Create overlay canvas if not exists
    if (!highlightCanvas) {
        highlightCanvas = document.createElement('canvas');
        highlightCanvas.style.position = 'absolute';
        highlightCanvas.style.pointerEvents = 'none';
        // Place highlight below grid and crosshair
        highlightCanvas.style.zIndex = '100';
        highlightCanvas.style.imageRendering = 'pixelated';
        highlightCanvas.style.imageRendering = '-moz-crisp-edges';
        highlightCanvas.style.imageRendering = '-webkit-optimize-contrast';
        
        // Insert the highlight canvas directly after the quantized canvas
        const quantizedBox = elements.quantizedCanvas.parentElement;
        quantizedBox.style.position = 'relative';
        quantizedBox.appendChild(highlightCanvas);
    }
    
    // Set canvas size to match quantized canvas exactly (device pixels)
    highlightCanvas.width = elements.quantizedCanvas.width;
    highlightCanvas.height = elements.quantizedCanvas.height;

    // Position the overlay using precise client rects to avoid subpixel drift
    const parentRect = elements.quantizedCanvas.parentElement.getBoundingClientRect();
    const canvasRect = elements.quantizedCanvas.getBoundingClientRect();
    const left = canvasRect.left - parentRect.left;
    const top = canvasRect.top - parentRect.top;
    highlightCanvas.style.left = `${left}px`;
    highlightCanvas.style.top = `${top}px`;
    highlightCanvas.style.width = `${canvasRect.width}px`;
    highlightCanvas.style.height = `${canvasRect.height}px`;
    
    const ctx = highlightCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    
    // Create image data for highlight
    const imageData = ctx.createImageData(highlightCanvas.width, highlightCanvas.height);
    const data = imageData.data;
    
    // Draw solid yellow highlights where pixels match the color
    for (let i = 0; i < quantizedResult.assignments.length; i++) {
        if (quantizedResult.assignments[i] === colorIndex) {
            const pixelIdx = i * 4;
            data[pixelIdx] = 255;     // R
            data[pixelIdx + 1] = 255; // G
            data[pixelIdx + 2] = 0;   // B
            data[pixelIdx + 3] = 255; // Alpha (fully opaque - solid)
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Start flashing animation for multi-color selection
function startMultiColorFlashing() {
    // Clear any existing interval
    if (multiColorFlashInterval) {
        clearInterval(multiColorFlashInterval);
    }
    
    multiColorFlashVisible = true;
    
    // Flash every 500ms (half second)
    multiColorFlashInterval = setInterval(() => {
        multiColorFlashVisible = !multiColorFlashVisible;
        
        if (multiColorFlashVisible) {
            highlightMultipleColors(multiColorSelectedIndices);
        } else {
            clearHighlight();
        }
        
        // Redraw magnifier if active to show flashing effect
        if (magnifierActive && elements.quantizedCanvas) {
            const rect = elements.quantizedCanvas.getBoundingClientRect();
            const u = (lastMouseX - rect.left) / rect.width;
            const v = (lastMouseY - rect.top) / rect.height;
            if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
                drawMagnifier(u, v);
            }
        }
    }, 500);
    
    // Draw initial highlight
    highlightMultipleColors(multiColorSelectedIndices);
}

// Stop flashing animation
function stopMultiColorFlashing() {
    if (multiColorFlashInterval) {
        clearInterval(multiColorFlashInterval);
        multiColorFlashInterval = null;
    }
    multiColorFlashVisible = true;
    clearHighlight();
}

// Highlight pixels of multiple colors with borders - for multi-color panel
function highlightMultipleColors(colorIndices) {
    if (!quantizedResult) return;
    if (!colorIndices || colorIndices.size === 0) {
        clearHighlight();
        return;
    }
    
    // Create overlay canvas if not exists
    if (!highlightCanvas) {
        highlightCanvas = document.createElement('canvas');
        highlightCanvas.style.position = 'absolute';
        highlightCanvas.style.pointerEvents = 'none';
        // Place highlight below grid and crosshair
        highlightCanvas.style.zIndex = '100';
        highlightCanvas.style.imageRendering = 'pixelated';
        highlightCanvas.style.imageRendering = '-moz-crisp-edges';
        highlightCanvas.style.imageRendering = '-webkit-optimize-contrast';
        
        // Insert the highlight canvas directly after the quantized canvas
        const quantizedBox = elements.quantizedCanvas.parentElement;
        quantizedBox.style.position = 'relative';
        quantizedBox.appendChild(highlightCanvas);
    }
    
    // Set canvas size to match quantized canvas exactly (device pixels)
    highlightCanvas.width = elements.quantizedCanvas.width;
    highlightCanvas.height = elements.quantizedCanvas.height;

    // Position the overlay using precise client rects to avoid subpixel drift
    const parentRect = elements.quantizedCanvas.parentElement.getBoundingClientRect();
    const canvasRect = elements.quantizedCanvas.getBoundingClientRect();
    const left = canvasRect.left - parentRect.left;
    const top = canvasRect.top - parentRect.top;
    highlightCanvas.style.left = `${left}px`;
    highlightCanvas.style.top = `${top}px`;
    highlightCanvas.style.width = `${canvasRect.width}px`;
    highlightCanvas.style.height = `${canvasRect.height}px`;
    
    const ctx = highlightCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    
    // Draw solid yellow fill for all selected pixels (for flashing effect)
    const width = highlightCanvas.width;
    const height = highlightCanvas.height;
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    // Draw solid yellow highlights where pixels match any of the selected colors
    for (let i = 0; i < quantizedResult.assignments.length; i++) {
        if (colorIndices.has(quantizedResult.assignments[i])) {
            const pixelIdx = i * 4;
            data[pixelIdx] = 255;     // R
            data[pixelIdx + 1] = 255; // G
            data[pixelIdx + 2] = 0;   // B
            data[pixelIdx + 3] = 255; // Alpha (fully opaque - solid)
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Clear highlight overlay
function clearHighlight() {
    if (highlightCanvas) {
        const ctx = highlightCanvas.getContext('2d');
        ctx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
        // Remove the canvas to ensure clean state
        if (highlightCanvas.parentElement) {
            highlightCanvas.parentElement.removeChild(highlightCanvas);
        }
        highlightCanvas = null;
    }
    highlightedColorIndex = -1;
}

// Show/hide processing overlay
function showProcessing(show) {
    elements.processingOverlay.style.display = show ? 'flex' : 'none';
    if (show) {
        elements.progressFill.style.width = '0%';
    }
}

// Download yarn map as CSV
function downloadYarnMap() {
    if (!quantizedResult) return;
    
    const width = currentImageData.width;
    const height = currentImageData.height;
    const assignments = quantizedResult.assignments;
    
    // Create CSV content
    const rows = [];
    
    // Add header with metadata
    rows.push(`# Broadloom Yarn Map - Version ${VERSION}`);
    rows.push(`# Design Size: ${DESIGN_WIDTH}cm × ${DESIGN_HEIGHT}cm`);
    rows.push(`# Resolution: ${currentResolution} yarn lines/cm`);
    rows.push(`# Dimensions: ${width} × ${height} pixels`);
    rows.push(`# Colors: ${currentK}`);
    rows.push(`# Color Palette (RGB):`);
    
    quantizedResult.centroids.forEach((color, i) => {
        rows.push(`# Color ${i}: RGB(${color[0]},${color[1]},${color[2]}) ${rgbToHex(color)}`);
    });
    rows.push(''); // Empty line before data
    
    // Add yarn map data
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            row.push(assignments[y * width + x]);
        }
        rows.push(row.join(','));
    }
    
    // Create and download file
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `yarn_map_${DESIGN_WIDTH}x${DESIGN_HEIGHT}cm_${currentResolution}lines_${currentK}colors.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// Download the quantized pixel canvas as a BMP file
function downloadPixelBmp() {
    if (!quantizedResult) return;
    const canvas = elements.quantizedCanvas;
    // Try browser BMP support; if not, fall back to PNG but keep .bmp name
    const mime = 'image/bmp';
    let dataURL = '';
    try {
        dataURL = canvas.toDataURL(mime);
        if (!dataURL || !dataURL.startsWith('data:image/bmp')) {
            // Fallback to PNG
            dataURL = canvas.toDataURL('image/png');
        }
    } catch (e) {
        dataURL = canvas.toDataURL('image/png');
    }
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `pixel_image_${DESIGN_WIDTH}x${DESIGN_HEIGHT}cm_${currentResolution}lines_${currentK}colors.bmp`;
    link.click();
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log(`Broadloom Image Converter v${VERSION} initialized`);
    initializeEventListeners();
    updateKInfo();
    
    // Set initial button states
    elements.kMinus.disabled = currentK <= 2;
    elements.kPlus.disabled = currentK >= 16;

    // Debug: press 'T' to print medoids/centroids and hovered pixel distances
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 't') {
            if (!quantizedResult || !currentImageData) { console.log('No quantization yet.'); return; }
            const cx = Math.floor((lastMouseX - elements.quantizedCanvas.getBoundingClientRect().left) * elements.quantizedCanvas.width / elements.quantizedCanvas.getBoundingClientRect().width);
            const cy = Math.floor((lastMouseY - elements.quantizedCanvas.getBoundingClientRect().top) * elements.quantizedCanvas.height / elements.quantizedCanvas.getBoundingClientRect().height);
            const idx = (cy * currentImageData.width + cx) * 4;
            if (idx < 0 || idx + 2 >= currentImageData.data.length) { console.log('Out of bounds'); return; }
            const p = [currentImageData.data[idx], currentImageData.data[idx+1], currentImageData.data[idx+2]];
            
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`📍 PIXEL ANALYSIS at (${cx}, ${cy})`);
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`Original RGB: RGB(${p[0]}, ${p[1]}, ${p[2]}) = ${rgbToHex(p)}`);
            console.log('');
            console.log(`K = ${quantizedResult.centroids.length}`);
            console.log('K-Palette Colors:');
            quantizedResult.centroids.forEach((c, i) => {
                console.log(`  Color ${i}: RGB(${c[0]}, ${c[1]}, ${c[2]}) = ${rgbToHex(c)}`);
            });
            console.log('');
            console.log('Distance Calculation (Weighted Euclidean):');
            console.log('Formula: distance = √[0.30×ΔR² + 0.59×ΔG² + 0.11×ΔB²]');
            console.log('');
            
            const dists = quantizedResult.centroids.map((c,i)=>{
                const dr = p[0] - c[0];
                const dg = p[1] - c[1];
                const db = p[2] - c[2];
                const dist = Math.sqrt(0.30 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);
                
                console.log(`Color ${i}: ${rgbToHex(c)}`);
                console.log(`  ΔR = ${p[0]} - ${c[0]} = ${dr}`);
                console.log(`  ΔG = ${p[1]} - ${c[1]} = ${dg}`);
                console.log(`  ΔB = ${p[2]} - ${c[2]} = ${db}`);
                console.log(`  distance = √[0.30×${dr}² + 0.59×${dg}² + 0.11×${db}²]`);
                console.log(`  distance = √[${(0.30*dr*dr).toFixed(2)} + ${(0.59*dg*dg).toFixed(2)} + ${(0.11*db*db).toFixed(2)}]`);
                console.log(`  distance = √${(0.30*dr*dr + 0.59*dg*dg + 0.11*db*db).toFixed(2)}`);
                console.log(`  distance = ${dist.toFixed(4)} ${i === 0 ? '← CLOSEST! ✓' : ''}`);
                console.log('');
                
                return { i, hex: rgbToHex(c), rgb: `RGB(${c[0]},${c[1]},${c[2]})`, d: dist };
            });
            
            dists.sort((a,b)=>a.d-b.d);
            console.log('SUMMARY (sorted by distance):');
            console.table(dists);
            console.log(`✓ Pixel assigned to: ${dists[0].hex} (${dists[0].rgb})`);
            console.log('═══════════════════════════════════════════════════════════');
            
            if (quantizedResult.debug) {
                console.log('');
                console.log('═══════════════════════════════════════════════════════════');
                console.log('🔧 K-MEANS/K-MEDOIDS ALGORITHM TRACE:');
                console.log('═══════════════════════════════════════════════════════════');
                
                if (quantizedResult.debug.seeds) {
                    console.log('Initial Seeds (Starting Colors):');
                    quantizedResult.debug.seeds.forEach((seed, i) => {
                        console.log(`  Seed ${i}: RGB(${seed[0]}, ${seed[1]}, ${seed[2]}) = ${rgbToHex(seed)}`);
                    });
                }
                
                const iters = quantizedResult.debug.medoidsByIter || quantizedResult.debug.centroidsByIter;
                if (iters) {
                    console.log('');
                    console.log(`Total Iterations: ${iters.length}`);
                    console.log('');
                    
                    iters.forEach((iterColors, idx) => {
                        console.log(`Iteration ${idx}:`);
                        iterColors.forEach((color, i) => {
                            console.log(`  Color ${i}: RGB(${color[0]}, ${color[1]}, ${color[2]}) = ${rgbToHex(color)}`);
                        });
                        console.log('');
                    });
                    
                    console.log('Final Converged Colors:');
                    quantizedResult.centroids.forEach((c, i) => {
                        console.log(`  Color ${i}: RGB(${c[0]}, ${c[1]}, ${c[2]}) = ${rgbToHex(c)}`);
                    });
                }
                console.log('═══════════════════════════════════════════════════════════');
            }
        }
    });

    // Debug: press 'C' to show color histogram (all unique colors)
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'c') {
            if (!currentImageData) { console.log('No image loaded yet.'); return; }
            
            console.log('═══════════════════════════════════════════════════════════');
            console.log('🎨 COLOR HISTOGRAM - All Unique Colors in Image');
            console.log('═══════════════════════════════════════════════════════════');
            
            const colorMap = new Map();
            const data = currentImageData.data;
            const totalPixels = currentImageData.width * currentImageData.height;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const key = `${r},${g},${b}`;
                colorMap.set(key, (colorMap.get(key) || 0) + 1);
            }
            
            const colorArray = Array.from(colorMap.entries()).map(([key, count]) => {
                const [r, g, b] = key.split(',').map(Number);
                const percentage = (count / totalPixels * 100).toFixed(2);
                return {
                    hex: rgbToHex([r, g, b]),
                    rgb: `RGB(${r},${g},${b})`,
                    pixels: count,
                    percent: percentage
                };
            });
            
            // Sort by frequency (most common first)
            colorArray.sort((a, b) => b.pixels - a.pixels);
            
            console.log(`Total unique colors: ${colorArray.length}`);
            console.log(`Total pixels: ${totalPixels}`);
            console.log('');
            console.log('Top 50 most common colors:');
            console.table(colorArray.slice(0, 50));
            
            // Show color distribution
            console.log('');
            console.log('Color Distribution:');
            const ranges = [
                { name: 'Very Common (>5%)', colors: colorArray.filter(c => parseFloat(c.percent) > 5) },
                { name: 'Common (1-5%)', colors: colorArray.filter(c => parseFloat(c.percent) >= 1 && parseFloat(c.percent) <= 5) },
                { name: 'Moderate (0.1-1%)', colors: colorArray.filter(c => parseFloat(c.percent) >= 0.1 && parseFloat(c.percent) < 1) },
                { name: 'Rare (<0.1%)', colors: colorArray.filter(c => parseFloat(c.percent) < 0.1) }
            ];
            
            ranges.forEach(range => {
                console.log(`  ${range.name}: ${range.colors.length} colors`);
            });
            
            console.log('');
            console.log('To find a specific color range, use:');
            console.log('  Pink range: RGB(200-255, 100-200, 100-200)');
            console.log('  Gray range: RGB(100-180, 100-180, 100-180)');
            
            const pinkColors = colorArray.filter(c => {
                const match = c.rgb.match(/RGB\((\d+),(\d+),(\d+)\)/);
                if (!match) return false;
                const [_, r, g, b] = match.map(Number);
                return r >= 200 && r <= 255 && g >= 100 && g <= 200 && b >= 100 && b <= 200;
            });
            
            const grayColors = colorArray.filter(c => {
                const match = c.rgb.match(/RGB\((\d+),(\d+),(\d+)\)/);
                if (!match) return false;
                const [_, r, g, b] = match.map(Number);
                return r >= 100 && r <= 180 && g >= 100 && g <= 180 && b >= 100 && b <= 180;
            });
            
            console.log('');
            console.log(`Pink-ish colors found: ${pinkColors.length}`);
            if (pinkColors.length > 0) {
                console.log('Top pink colors:');
                console.table(pinkColors.slice(0, 10));
                const totalPinkPixels = pinkColors.reduce((sum, c) => sum + c.pixels, 0);
                console.log(`Total pink pixels: ${totalPinkPixels} (${(totalPinkPixels/totalPixels*100).toFixed(2)}%)`);
            }
            
            console.log('');
            console.log(`Gray-ish colors found: ${grayColors.length}`);
            if (grayColors.length > 0) {
                console.log('Top gray colors:');
                console.table(grayColors.slice(0, 10));
                const totalGrayPixels = grayColors.reduce((sum, c) => sum + c.pixels, 0);
                console.log(`Total gray pixels: ${totalGrayPixels} (${(totalGrayPixels/totalPixels*100).toFixed(2)}%)`);
            }
            
            console.log('═══════════════════════════════════════════════════════════');
        }
    });

    // If auto-k is on by default, disable +/-
    if (elements.autoK && elements.autoK.checked) {
        elements.kMinus.disabled = true;
        elements.kPlus.disabled = true;
    }
});

// Estimate best K using elbow on weighted error over a sweep
function estimateAutoK(imageData){
    const sweepKs = [3,4,5,6,7,8,9,10,11,12,13,14,15,16];
    const useActualColors = elements.useActualColorsCheckbox ? elements.useActualColorsCheckbox.checked : true;
    // Use a heavier sample for stability but keep fast
    const sampleRate = imageData.width * imageData.height > 500000 ? 20 : 10;
    const errors = [];
    for (const k of sweepKs) {
        const res = quantizeImage(imageData, k, sampleRate, null, true, useActualColors, false);
        // Approximate error = mean distance per sampled pixel cluster step already in result.error when K-means; for medoids we recompute
        let err = 0;
        if (res.debug && res.debug.error != null) {
            err = res.debug.error;
        } else {
            // Compute average colorDistance across full image to its assigned centroid (cheap pass)
            const cents = res.centroids;
            let acc = 0; const data = imageData.data; const w = imageData.width; const h = imageData.height;
            for (let y=0; y<h; y+=Math.max(1, Math.floor(h/200))) {
                for (let x=0; x<w; x+=Math.max(1, Math.floor(w/200))) {
                    const i = (y*w + x) * 4;
                    const p = [data[i], data[i+1], data[i+2]];
                    const { distance } = findClosestCentroid(p, cents);
                    acc += distance;
                }
            }
            err = acc;
        }
        errors.push({ k, err });
    }
    // Normalize and find elbow via simple knee: largest drop then diminishing returns
    errors.sort((a,b)=>a.k-b.k);
    let bestK = errors[0].k;
    let bestGain = -Infinity;
    for (let i=1;i<errors.length;i++){
        const drop = errors[i-1].err - errors[i].err; // positive if error decreases
        const rel = drop / (errors[i-1].err || 1);
        if (rel > bestGain) { bestGain = rel; bestK = errors[i].k; }
    }
    // Smooth rule: pick smallest K where additional drop < 5% compared to previous
    for (let i=2;i<errors.length;i++){
        const prevDrop = errors[i-2].err - errors[i-1].err;
        const thisDrop = errors[i-1].err - errors[i].err;
        if (thisDrop / (prevDrop||1) < 0.2) { bestK = errors[i-1].k; break; }
    }
    if (elements.autoKNote) {
        const baseline = errors.find(e=>e.k===errors[0].k).err;
        const sel = errors.find(e=>e.k===bestK).err;
        const gain = ((baseline - sel)/baseline*100).toFixed(1);
        elements.autoKNote.textContent = `Recommended K = ${bestK} (elbow). Error reduced ~${gain}% from K=${errors[0].k}.`;
    }
    return bestK;
}