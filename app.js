// Main application logic for Broadloom Image Converter  
// Version: 2.9.12

const VERSION = '2.9.12';

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
    useActualColorsCheckbox: document.getElementById('use-actual-colors'),
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
    
    // Actual colors toggle - auto convert when changed
    elements.useActualColorsCheckbox?.addEventListener('change', () => {
        if (originalImage && currentImageData) {
            convertImage();
        }
    });
    
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
    
    // Shift key to toggle highlight on/off (preserve selected color)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            highlightLocked = !highlightLocked;
            if (highlightLocked) {
                // Toggle ON: restore previous selection if available
                if (lockedColorIndex !== null) {
                    highlightColorPixels(lockedColorIndex);
                }
            } else {
                // Toggle OFF: just hide overlay, keep lockedColorIndex
                clearHighlight();
            }
        }
    });
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
        gridCanvas.style.zIndex = '100';
        
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
    
    // Show magnifier with smart positioning
    if (magnifierActive) {
        elements.magnifier.style.display = 'block';
        
        // Calculate magnifier position to avoid going off screen
        const magnifierSize = 300;
        const offset = 20;
        let magnifierX = e.clientX + offset;
        let magnifierY = e.clientY + offset;
        
        // Adjust if magnifier would go off right edge
        if (magnifierX + magnifierSize > window.innerWidth) {
            magnifierX = e.clientX - magnifierSize - offset;
        }
        
        // Adjust if magnifier would go off bottom edge
        if (magnifierY + magnifierSize > window.innerHeight) {
            magnifierY = e.clientY - magnifierSize - offset;
        }
        
        elements.magnifier.style.left = `${magnifierX}px`;
        elements.magnifier.style.top = `${magnifierY}px`;
        
        // Draw magnified area
        drawMagnifier(canvasX, canvasY, canvas);
    }
}

// Handle canvas leave
function handleCanvasLeave() {
    magnifierActive = false;
    elements.magnifier.style.display = 'none';
    elements.crosshairH.style.display = 'none';
    elements.crosshairV.style.display = 'none';
}

// Draw magnifier content with red dot cursor and color info
function drawMagnifier(canvasX, canvasY, sourceCanvas) {
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
    
    // Get color at cursor position
    const pixelX = Math.floor(canvasX);
    const pixelY = Math.floor(canvasY);
    let originalColor = null;
    let pixelColor = null;
    
    // Get original color
    if (currentImageData && pixelX >= 0 && pixelX < currentImageData.width && 
        pixelY >= 0 && pixelY < currentImageData.height) {
        const idx = (pixelY * currentImageData.width + pixelX) * 4;
        originalColor = [
            currentImageData.data[idx],
            currentImageData.data[idx + 1],
            currentImageData.data[idx + 2]
        ];
    }
    
    // Get quantized color
    if (quantizedResult && quantizedResult.assignments) {
        const pixelIndex = pixelY * currentImageData.width + pixelX;
        if (pixelIndex >= 0 && pixelIndex < quantizedResult.assignments.length) {
            const colorIndex = quantizedResult.assignments[pixelIndex];
            pixelColor = quantizedResult.centroids[colorIndex];
        }
    }
    
    // Draw from both canvases side by side in magnifier
    if (quantizedResult) {
        const halfSize = magnifierSize / 2;
        
        // Left half - original
        magnifierCtx.drawImage(
            elements.originalCanvas,
            canvasX - sourceSize/2, canvasY - sourceSize/2, sourceSize, sourceSize,
            0, 0, halfSize, magnifierSize
        );
        
        // Right half - pixel
        magnifierCtx.drawImage(
            elements.quantizedCanvas,
            canvasX - sourceSize/2, canvasY - sourceSize/2, sourceSize, sourceSize,
            halfSize, 0, halfSize, magnifierSize
        );
        
        // In magnifier: overlay yellow-highlighted pixels (if highlight is active)
        if (highlightCanvas && highlightedColorIndex >= 0) {
            // Create a temporary canvas to extract only yellow pixels
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sourceSize;
            tempCanvas.height = sourceSize;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw the highlight overlay for the region
            tempCtx.drawImage(
                highlightCanvas,
                canvasX - sourceSize/2, canvasY - sourceSize/2, sourceSize, sourceSize,
                0, 0, sourceSize, sourceSize
            );
            
            // Use the highlight alpha as a mask and paint pure yellow where mask exists
            const maskData = tempCtx.getImageData(0, 0, sourceSize, sourceSize);
            const out = tempCtx.createImageData(sourceSize, sourceSize);
            for (let i = 0; i < maskData.data.length; i += 4) {
                const a = maskData.data[i + 3];
                if (a > 0) {
                    out.data[i] = 255;       // R (yellow)
                    out.data[i + 1] = 255;   // G (yellow)
                    out.data[i + 2] = 0;     // B (yellow)
                    out.data[i + 3] = 255;   // A opaque
                } else {
                    out.data[i] = 0;
                    out.data[i + 1] = 0;
                    out.data[i + 2] = 0;
                    out.data[i + 3] = 0;     // transparent where no highlight
                }
            }
            tempCtx.putImageData(out, 0, 0);
            // Overlay on top of the right half
            magnifierCtx.drawImage(
                tempCanvas,
                0, 0, sourceSize, sourceSize,
                halfSize, 0, halfSize, magnifierSize
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
        
        // Draw red dot for cursor position in center of both halves
        magnifierCtx.fillStyle = 'red';
        const centerY = magnifierSize / 2;
        magnifierCtx.fillRect(halfSize/2 - 2, centerY - 2, 4, 4); // Left half center
        magnifierCtx.fillRect(halfSize + halfSize/2 - 2, centerY - 2, 4, 4); // Right half center
        
        // Draw divider line
        magnifierCtx.strokeStyle = '#333';
        magnifierCtx.lineWidth = 3;
        magnifierCtx.beginPath();
        magnifierCtx.moveTo(halfSize, 0);
        magnifierCtx.lineTo(halfSize, magnifierSize);
        magnifierCtx.stroke();
        
        // Display color hex codes at bottom
        if (originalColor || pixelColor) {
            const textBoxHeight = 35;
            magnifierCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            magnifierCtx.fillRect(0, magnifierSize - textBoxHeight, magnifierSize, textBoxHeight);
            
            magnifierCtx.fillStyle = 'white';
            magnifierCtx.font = 'bold 12px monospace';
            
            if (originalColor) {
                const hexOriginal = rgbToHex(originalColor);
                magnifierCtx.fillText(hexOriginal, halfSize/2 - 30, magnifierSize - 10);
            }
            
            if (pixelColor) {
                const hexPixel = rgbToHex(pixelColor);
                magnifierCtx.fillText(hexPixel, halfSize + halfSize/2 - 30, magnifierSize - 10);
            }
        }
    } else {
        // Just show original if no quantized version yet
        magnifierCtx.drawImage(
            elements.originalCanvas,
            canvasX - sourceSize/2, canvasY - sourceSize/2, sourceSize, sourceSize,
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
            // Reset K-means centroids for new image
            if (typeof resetPreviousCentroids === 'function') {
                resetPreviousCentroids();
            }
            
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
        
        // Run quantization with stable mode and actual colors option
        const useActualColors = elements.useActualColorsCheckbox ? elements.useActualColorsCheckbox.checked : true;
        quantizedResult = quantizeImage(
            currentImageData, 
            currentK, 
            sampleRate,
            (progress) => {
                elements.progressFill.style.width = `${progress * 100}%`;
            },
            true, // Use stable mode
            useActualColors // Use actual colors from image (K-medoids)
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
        
        console.log('Conversion complete:', {
            k: currentK,
            centroids: quantizedResult.centroids.length,
            isActualColors: quantizedResult.isActualColors
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
        
        // Add hover and click events
        row.addEventListener('mouseenter', () => {
            if (!highlightLocked) {
                row.classList.add('active');
                highlightColorPixels(item.originalIndex);
            }
        });
        row.addEventListener('mouseleave', () => {
            if (!highlightLocked) {
                row.classList.remove('active');
                clearHighlight();
            }
        });
        // Click to lock/unlock highlight; ensure only one row is active
        row.addEventListener('click', () => {
            if (highlightLocked && lockedColorIndex === item.originalIndex) {
                // Clicking the same color unlocks it
                highlightLocked = false;
                lockedColorIndex = null;
                // Clear active state from all rows
                document.querySelectorAll('.color-row').forEach(r => r.classList.remove('active'));
                clearHighlight();
            } else {
                // Lock highlight to this color
                highlightLocked = true;
                lockedColorIndex = item.originalIndex;
                // Clear active state from other rows first
                document.querySelectorAll('.color-row').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
                highlightColorPixels(item.originalIndex);
            }
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