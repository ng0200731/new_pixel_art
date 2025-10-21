// Main application logic for Broadloom Image Converter  
// Version: 1.6.0

const VERSION = '1.6.0';

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
let currentSort = 'brightness'; // 'brightness' or 'pixels'
let colorData = null; // Store color data for sorting
let showGrid = false;
let gridCanvas = null;

// DOM elements
const elements = {
    imageUpload: document.getElementById('image-upload'),
    dropZone: document.getElementById('drop-zone'),
    imageDisplay: document.getElementById('image-display'),
    resolutionInputs: document.querySelectorAll('input[name="resolution"]'),
    resolutionRecommendation: document.getElementById('resolution-recommendation'),
    showGridCheckbox: document.getElementById('show-grid'),
    kMinus: document.getElementById('k-minus'),
    kPlus: document.getElementById('k-plus'),
    kValue: document.getElementById('k-value'),
    currentK: document.getElementById('current-k'),
    convertBtn: document.getElementById('convert-btn'),
    downloadBtn: document.getElementById('download-btn'),
    originalCanvas: document.getElementById('original-canvas'),
    quantizedCanvas: document.getElementById('quantized-canvas'),
    magnifier: document.getElementById('magnifier'),
    magnifierCanvas: document.getElementById('magnifier-canvas'),
    crosshairH: document.getElementById('crosshair-horizontal'),
    crosshairV: document.getElementById('crosshair-vertical'),
    kInfo: document.getElementById('k-info'),
    prosList: document.getElementById('pros-list'),
    consList: document.getElementById('cons-list'),
    colorPalette: document.getElementById('color-palette'),
    paletteRows: document.getElementById('palette-rows'),
    sortBrightness: document.getElementById('sort-brightness'),
    sortPixels: document.getElementById('sort-pixels'),
    imageInfo: document.getElementById('image-info'),
    processingOverlay: document.getElementById('processing-overlay'),
    progressFill: document.getElementById('progress-fill')
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
    
    // K value controls
    elements.kMinus.addEventListener('click', () => adjustK(-1));
    elements.kPlus.addEventListener('click', () => adjustK(1));
    
    // Action buttons
    elements.convertBtn.addEventListener('click', convertImage);
    elements.downloadBtn.addEventListener('click', downloadYarnMap);
    
    // Sort buttons
    elements.sortBrightness?.addEventListener('click', () => sortPalette('brightness'));
    elements.sortPixels?.addEventListener('click', () => sortPalette('pixels'));
    
    // Canvas hover events for magnifier and crosshairs
    elements.originalCanvas.addEventListener('mousemove', handleCanvasHover);
    elements.quantizedCanvas.addEventListener('mousemove', handleCanvasHover);
    elements.originalCanvas.addEventListener('mouseenter', () => magnifierActive = true);
    elements.quantizedCanvas.addEventListener('mouseenter', () => magnifierActive = true);
    elements.originalCanvas.addEventListener('mouseleave', handleCanvasLeave);
    elements.quantizedCanvas.addEventListener('mouseleave', handleCanvasLeave);
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
    
    // Create grid canvas for original
    if (!gridCanvas) {
        gridCanvas = document.createElement('canvas');
        gridCanvas.className = 'grid-overlay';
        gridCanvas.style.pointerEvents = 'none';
        elements.originalCanvas.parentElement.appendChild(gridCanvas);
    }
    
    // Set size and position
    gridCanvas.width = elements.originalCanvas.width;
    gridCanvas.height = elements.originalCanvas.height;
    gridCanvas.style.width = elements.originalCanvas.style.width;
    gridCanvas.style.height = elements.originalCanvas.style.height;
    gridCanvas.style.position = 'absolute';
    gridCanvas.style.left = elements.originalCanvas.offsetLeft + 'px';
    gridCanvas.style.top = elements.originalCanvas.offsetTop + 'px';
    
    const ctx = gridCanvas.getContext('2d');
    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    
    // Draw grid lines (every 10 pixels = 10 yarn lines)
    const gridSize = 10;
    for (let x = 0; x <= gridCanvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, gridCanvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= gridCanvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(gridCanvas.width, y);
        ctx.stroke();
    }
}

// Clear grid overlay
function clearGrid() {
    if (gridCanvas && gridCanvas.parentElement) {
        gridCanvas.parentElement.removeChild(gridCanvas);
        gridCanvas = null;
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

// Handle canvas hover for magnifier and crosshairs
function handleCanvasHover(e) {
    if (!originalImage || !currentImageData) return;
    
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Show crosshairs
    elements.crosshairH.style.display = 'block';
    elements.crosshairV.style.display = 'block';
    elements.crosshairH.style.top = `${e.clientY}px`;
    elements.crosshairV.style.left = `${e.clientX}px`;
    
    // Scale coordinates to actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    // Show magnifier (offset to not block cursor)
    if (magnifierActive) {
        elements.magnifier.style.display = 'block';
        elements.magnifier.style.left = `${e.clientX}px`;
        elements.magnifier.style.top = `${e.clientY}px`;
        
        // Draw magnified area
        drawMagnifier(canvasX, canvasY);
    }
}

// Handle canvas leave
function handleCanvasLeave() {
    magnifierActive = false;
    elements.magnifier.style.display = 'none';
    elements.crosshairH.style.display = 'none';
    elements.crosshairV.style.display = 'none';
}

// Draw magnifier content with red dot cursor
function drawMagnifier(canvasX, canvasY) {
    const magnifierCtx = elements.magnifierCanvas.getContext('2d');
    const magnification = 4;
    const sourceSize = 75; // Size of area to magnify
    
    elements.magnifierCanvas.width = 300;
    elements.magnifierCanvas.height = 300;
    
    // Draw magnified portion
    magnifierCtx.imageSmoothingEnabled = false;
    magnifierCtx.clearRect(0, 0, 300, 300);
    
    // Create clipping regions for half circles
    magnifierCtx.save();
    
    // Left half circle - original
    magnifierCtx.beginPath();
    magnifierCtx.arc(150, 150, 148, Math.PI * 0.5, Math.PI * 1.5);
    magnifierCtx.closePath();
    magnifierCtx.clip();
    
    magnifierCtx.drawImage(
        elements.originalCanvas,
        canvasX - sourceSize/2, canvasY - sourceSize/2, sourceSize, sourceSize,
        0, 0, 300, 300
    );
    
    // Draw red dot for cursor position (left half)
    magnifierCtx.fillStyle = 'red';
    magnifierCtx.fillRect(148, 148, 4, 4);
    
    magnifierCtx.restore();
    
    // Right half circle - pixel
    if (quantizedResult) {
        magnifierCtx.save();
        magnifierCtx.beginPath();
        magnifierCtx.arc(150, 150, 148, Math.PI * 1.5, Math.PI * 0.5);
        magnifierCtx.closePath();
        magnifierCtx.clip();
        
        magnifierCtx.drawImage(
            elements.quantizedCanvas,
            canvasX - sourceSize/2, canvasY - sourceSize/2, sourceSize, sourceSize,
            0, 0, 300, 300
        );
        
        // If there's a highlight overlay, also show it
        if (highlightCanvas && highlightedColorIndex >= 0) {
            magnifierCtx.globalAlpha = 1; // Solid yellow
            magnifierCtx.drawImage(
                highlightCanvas,
                canvasX - sourceSize/2, canvasY - sourceSize/2, sourceSize, sourceSize,
                0, 0, 300, 300
            );
            magnifierCtx.globalAlpha = 1;
        }
        
        // Draw red dot for cursor position (right half)
        magnifierCtx.fillStyle = 'red';
        magnifierCtx.fillRect(148, 148, 4, 4);
        
        magnifierCtx.restore();
    }
    
    // Draw divider line
    magnifierCtx.strokeStyle = '#333';
    magnifierCtx.lineWidth = 2;
    magnifierCtx.beginPath();
    magnifierCtx.moveTo(150, 0);
    magnifierCtx.lineTo(150, 300);
    magnifierCtx.stroke();
    
    // Add labels with better positioning
    magnifierCtx.fillStyle = 'white';
    magnifierCtx.strokeStyle = 'black';
    magnifierCtx.lineWidth = 4;
    magnifierCtx.font = 'bold 14px Arial';
    
    // Original label - positioned to be visible
    magnifierCtx.strokeText('Original', 50, 25);
    magnifierCtx.fillText('Original', 50, 25);
    
    // Pixel label - positioned to be visible
    magnifierCtx.strokeText('Pixel', 200, 25);
    magnifierCtx.fillText('Pixel', 200, 25);
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

// Process uploaded image file
function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        originalImage = new Image();
        originalImage.onload = function() {
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
            
            // Auto-convert with default settings
            convertImage();
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
        drawOriginalImage();
        updateImageInfo();
        // Auto-convert when resolution changes
        convertImage();
        // Redraw grid if enabled
        if (showGrid) {
            setTimeout(drawGrid, 100);
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

// Convert image using K-means
async function convertImage() {
    if (!currentImageData) return;
    
    // Show processing overlay
    showProcessing(true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
        // Determine sample rate based on image size
        const totalPixels = currentImageData.width * currentImageData.height;
        let sampleRate = 1;
        if (totalPixels > 500000) sampleRate = 10;
        else if (totalPixels > 100000) sampleRate = 5;
        
        // Run quantization
        quantizedResult = quantizeImage(
            currentImageData, 
            currentK, 
            sampleRate,
            (progress) => {
                elements.progressFill.style.width = `${progress * 100}%`;
            }
        );
        
        // Display quantized image
        const ctx = elements.quantizedCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.putImageData(quantizedResult.quantizedData, 0, 0);
        
        // Calculate statistics
        const stats = calculateColorStats(quantizedResult.assignments, currentK);
        
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
        
        // Hide processing overlay
        showProcessing(false);
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
        
        // Add hover events
        row.addEventListener('mouseenter', () => {
            row.classList.add('active');
            highlightColorPixels(item.originalIndex);
        });
        row.addEventListener('mouseleave', () => {
            row.classList.remove('active');
            clearHighlight();
        });
        
        elements.paletteRows.appendChild(row);
    });
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
        highlightCanvas.style.zIndex = '2000'; // Very high z-index
        highlightCanvas.style.imageRendering = 'pixelated';
        highlightCanvas.style.imageRendering = '-moz-crisp-edges';
        highlightCanvas.style.imageRendering = '-webkit-optimize-contrast';
        
        // Insert the highlight canvas directly after the quantized canvas
        const quantizedBox = elements.quantizedCanvas.parentElement;
        quantizedBox.style.position = 'relative';
        quantizedBox.appendChild(highlightCanvas);
    }
    
    // Set canvas size to match quantized canvas exactly
    highlightCanvas.width = elements.quantizedCanvas.width;
    highlightCanvas.height = elements.quantizedCanvas.height;
    
    // Position the overlay exactly on top of the quantized canvas
    highlightCanvas.style.left = `${elements.quantizedCanvas.offsetLeft}px`;
    highlightCanvas.style.top = `${elements.quantizedCanvas.offsetTop}px`;
    highlightCanvas.style.width = `${elements.quantizedCanvas.offsetWidth}px`;
    highlightCanvas.style.height = `${elements.quantizedCanvas.offsetHeight}px`;
    
    const ctx = highlightCanvas.getContext('2d');
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

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log(`Broadloom Image Converter v${VERSION} initialized`);
    initializeEventListeners();
    updateKInfo();
    
    // Set initial button states
    elements.kMinus.disabled = currentK <= 2;
    elements.kPlus.disabled = currentK >= 16;
});