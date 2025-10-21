// K-means clustering algorithm for color quantization
// Version: 1.0.0

// Helper: Calculate Euclidean distance between two colors in RGB space
function colorDistance(c1, c2) {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Helper: Find the closest centroid for a given color
function findClosestCentroid(color, centroids) {
    let minDist = Infinity;
    let closestIdx = 0;
    
    for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(color, centroids[i]);
        if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
        }
    }
    
    return { index: closestIdx, distance: minDist };
}

// Helper: Sample pixels from image data to speed up processing
function samplePixels(imageData, sampleRate = 10) {
    const pixels = [];
    const data = imageData.data;
    const totalPixels = data.length / 4; // RGBA format
    
    // If image is small, use all pixels
    if (totalPixels < 10000) {
        sampleRate = 1;
    }
    
    for (let i = 0; i < totalPixels; i += sampleRate) {
        const idx = i * 4;
        pixels.push([
            data[idx],     // R
            data[idx + 1], // G
            data[idx + 2]  // B
        ]);
    }
    
    return pixels;
}

// Extract all pixels from image data
function extractAllPixels(imageData) {
    const pixels = [];
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        pixels.push([
            data[i],     // R
            data[i + 1], // G
            data[i + 2]  // B
        ]);
    }
    
    return pixels;
}

// Initialize centroids using k-means++ algorithm for better starting points
function initializeCentroidsKMeansPlusPlus(pixels, k) {
    const centroids = [];
    
    // Pick first centroid randomly
    const firstIdx = Math.floor(Math.random() * pixels.length);
    centroids.push([...pixels[firstIdx]]);
    
    // Pick remaining centroids
    for (let i = 1; i < k; i++) {
        const distances = [];
        let totalDist = 0;
        
        // Calculate distance from each pixel to nearest centroid
        for (const pixel of pixels) {
            let minDist = Infinity;
            for (const centroid of centroids) {
                const dist = colorDistance(pixel, centroid);
                if (dist < minDist) {
                    minDist = dist;
                }
            }
            distances.push(minDist);
            totalDist += minDist;
        }
        
        // Pick next centroid probabilistically based on distance
        let randomValue = Math.random() * totalDist;
        for (let j = 0; j < pixels.length; j++) {
            randomValue -= distances[j];
            if (randomValue <= 0) {
                centroids.push([...pixels[j]]);
                break;
            }
        }
    }
    
    return centroids;
}

// Main K-means clustering function
function kmeansQuantize(pixels, k, maxIterations = 20, onProgress = null) {
    if (pixels.length === 0 || k <= 0) {
        return { centroids: [], assignments: [], iterations: 0, error: 0 };
    }
    
    // Ensure k doesn't exceed number of unique colors
    const uniqueColors = new Set(pixels.map(p => p.join(',')));
    k = Math.min(k, uniqueColors.size);
    
    // Initialize centroids using k-means++
    let centroids = initializeCentroidsKMeansPlusPlus(pixels, k);
    let assignments = new Array(pixels.length);
    let prevError = Infinity;
    let iterations = 0;
    
    // Iterate until convergence or max iterations
    for (let iter = 0; iter < maxIterations; iter++) {
        iterations = iter + 1;
        
        // Assignment step: assign each pixel to closest centroid
        let totalError = 0;
        for (let i = 0; i < pixels.length; i++) {
            const { index, distance } = findClosestCentroid(pixels[i], centroids);
            assignments[i] = index;
            totalError += distance;
        }
        
        // Check for convergence
        const errorDiff = Math.abs(prevError - totalError);
        if (errorDiff < 0.001) {
            break;
        }
        prevError = totalError;
        
        // Update step: recalculate centroids
        const sums = Array(k).fill(0).map(() => [0, 0, 0]);
        const counts = new Array(k).fill(0);
        
        for (let i = 0; i < pixels.length; i++) {
            const cluster = assignments[i];
            sums[cluster][0] += pixels[i][0];
            sums[cluster][1] += pixels[i][1];
            sums[cluster][2] += pixels[i][2];
            counts[cluster]++;
        }
        
        // Update centroids to mean of assigned pixels
        for (let i = 0; i < k; i++) {
            if (counts[i] > 0) {
                centroids[i] = [
                    Math.round(sums[i][0] / counts[i]),
                    Math.round(sums[i][1] / counts[i]),
                    Math.round(sums[i][2] / counts[i])
                ];
            }
        }
        
        // Report progress
        if (onProgress) {
            onProgress(iter / maxIterations);
        }
    }
    
    return {
        centroids: centroids,
        assignments: assignments,
        iterations: iterations,
        error: prevError / pixels.length
    };
}

// Apply quantized colors to image data
function applyQuantization(imageData, centroids, assignments) {
    const quantizedData = new ImageData(imageData.width, imageData.height);
    const srcData = imageData.data;
    const dstData = quantizedData.data;
    
    for (let i = 0; i < assignments.length; i++) {
        const pixelIdx = i * 4;
        const cluster = assignments[i];
        const centroid = centroids[cluster];
        
        dstData[pixelIdx] = centroid[0];     // R
        dstData[pixelIdx + 1] = centroid[1]; // G
        dstData[pixelIdx + 2] = centroid[2]; // B
        dstData[pixelIdx + 3] = srcData[pixelIdx + 3]; // Alpha
    }
    
    return quantizedData;
}

// Quantize image using all pixels for final mapping
function quantizeImage(imageData, k, sampleRate = 10, onProgress = null) {
    // Sample pixels for clustering
    const sampledPixels = samplePixels(imageData, sampleRate);
    
    // Run k-means on sampled pixels
    const { centroids } = kmeansQuantize(sampledPixels, k, 20, onProgress);
    
    // Map all pixels to nearest centroid
    const allPixels = extractAllPixels(imageData);
    const assignments = allPixels.map(pixel => 
        findClosestCentroid(pixel, centroids).index
    );
    
    // Apply quantization
    const quantizedData = applyQuantization(imageData, centroids, assignments);
    
    return {
        quantizedData: quantizedData,
        centroids: centroids,
        assignments: assignments
    };
}

// Convert RGB to hex color
function rgbToHex(rgb) {
    const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(rgb[0]) + toHex(rgb[1]) + toHex(rgb[2]);
}

// Snap centroids to predefined yarn palette if provided
function snapToYarnPalette(centroids, yarnPalette) {
    return centroids.map(centroid => {
        let minDist = Infinity;
        let closestYarn = yarnPalette[0];
        
        for (const yarn of yarnPalette) {
            const dist = colorDistance(centroid, yarn);
            if (dist < minDist) {
                minDist = dist;
                closestYarn = yarn;
            }
        }
        
        return closestYarn;
    });
}

// Calculate color distribution statistics
function calculateColorStats(assignments, k) {
    const counts = new Array(k).fill(0);
    
    for (const assignment of assignments) {
        counts[assignment]++;
    }
    
    const total = assignments.length;
    const percentages = counts.map(count => (count / total * 100).toFixed(2));
    
    return {
        counts: counts,
        percentages: percentages
    };
}
