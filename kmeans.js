// K-means clustering algorithm for color quantization
// Version: 2.9.19

// Helper: Calculate weighted perceptual distance (prevents black→red merging)
function colorDistance(c1, c2) {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    
    // Perceptual weights based on human color sensitivity
    // Green is weighted highest because humans are most sensitive to green
    const weightR = 0.30;
    const weightG = 0.59;
    const weightB = 0.11;
    
    return Math.sqrt(weightR * dr * dr + weightG * dg * dg + weightB * db * db);
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

// Keep last quantization state to support stable K reduction without losing pixels
let lastQuantization = {
    pixels: null,           // Array<[r,g,b]> for all pixels
    assignments: null,      // Array<number> cluster index per pixel
    centroids: null,        // Array<[r,g,b]>
    k: 0
};

// Merge clusters to reduce palette to targetK by reassigning pixels to nearest remaining color
function mergePaletteToK(pixels, assignments, centroids, targetK) {
    let currentAssignments = assignments.slice();
    let currentCentroids = centroids.map(c => [c[0], c[1], c[2]]);
    
    const totalPixels = assignments.length;

    while (currentCentroids.length > targetK) {
        // Count pixels per cluster BEFORE merge
        const counts = new Array(currentCentroids.length).fill(0);
        for (let i = 0; i < currentAssignments.length; i++) {
            const a = currentAssignments[i];
            if (a >= 0 && a < counts.length) counts[a]++;
        }

        // Find smallest cluster index s
        let s = 0; let minCount = Infinity;
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] < minCount) { minCount = counts[i]; s = i; }
        }

        // Find nearest centroid to s (t)
        let t = -1; let minDist = Infinity;
        for (let j = 0; j < currentCentroids.length; j++) {
            if (j === s) continue;
            const d = colorDistance(currentCentroids[s], currentCentroids[j]);
            if (d < minDist) { minDist = d; t = j; }
        }
        
        const pixelsBeforeMerge_s = counts[s];
        const pixelsBeforeMerge_t = counts[t];

        // Reassign ALL pixels from s to t (no pixels removed, only reassigned)
        for (let i = 0; i < currentAssignments.length; i++) {
            if (currentAssignments[i] === s) currentAssignments[i] = t;
            else if (currentAssignments[i] > s) currentAssignments[i] -= 1;
        }

        // Remove centroid s from palette
        currentCentroids.splice(s, 1);
        
        // Verify: count pixels after merge
        const countsAfter = new Array(currentCentroids.length).fill(0);
        for (let i = 0; i < currentAssignments.length; i++) {
            const a = currentAssignments[i];
            if (a >= 0 && a < countsAfter.length) countsAfter[a]++;
        }
        
        // Target t index may have shifted if t > s
        const newT = (t > s) ? t - 1 : t;
        const pixelsAfterMerge = countsAfter[newT];
        const expectedPixels = pixelsBeforeMerge_s + pixelsBeforeMerge_t;
        
        // Verify pixel conservation: merged color should have sum of both
        if (pixelsAfterMerge !== expectedPixels) {
            console.error(`[ERROR] Pixel count mismatch! Expected ${expectedPixels}, got ${pixelsAfterMerge}`);
        }

        // Recompute centroids as means of assigned pixels (keeps colors stable)
        const sums = currentCentroids.map(() => [0, 0, 0]);
        const cts = new Array(currentCentroids.length).fill(0);
        for (let i = 0; i < pixels.length; i++) {
            const a = currentAssignments[i];
            if (a >= 0 && a < currentCentroids.length) {
                sums[a][0] += pixels[i][0];
                sums[a][1] += pixels[i][1];
                sums[a][2] += pixels[i][2];
                cts[a]++;
            }
        }
        for (let i = 0; i < currentCentroids.length; i++) {
            if (cts[i] > 0) {
                currentCentroids[i] = [
                    Math.round(sums[i][0] / cts[i]),
                    Math.round(sums[i][1] / cts[i]),
                    Math.round(sums[i][2] / cts[i])
                ];
            }
        }
    }
    
    // Final verification: total pixels must equal input
    let finalCount = 0;
    for (let i = 0; i < currentAssignments.length; i++) {
        if (currentAssignments[i] >= 0 && currentAssignments[i] < currentCentroids.length) {
            finalCount++;
        }
    }
    if (finalCount !== totalPixels) {
        console.error(`[ERROR] Lost pixels during merge! Started with ${totalPixels}, ended with ${finalCount}`);
    }

    return { centroids: currentCentroids, assignments: currentAssignments };
}

// Helper: Sample pixels from image data to speed up processing
function samplePixels(imageData, sampleRate = 10) {
    const data = imageData.data;
    const totalPixels = data.length / 4; // RGBA format
    
    // If image is small, use all pixels
    if (totalPixels < 10000) {
        const pixels = [];
        for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            pixels.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
        return pixels;
    }
    
    // For large images: collect all unique colors first to ensure rare colors are included
    const uniqueColors = new Map();
    const sampledPixels = [];
    
    // First pass: collect all unique colors (ensures gray stripes aren't missed)
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const key = `${r},${g},${b}`;
        if (!uniqueColors.has(key)) {
            uniqueColors.set(key, [r, g, b]);
        }
    }
    
    // Add all unique colors to sample
    uniqueColors.forEach(color => sampledPixels.push(color));
    
    // Add additional sampled pixels for better distribution
    for (let i = 0; i < totalPixels; i += sampleRate) {
        const idx = i * 4;
        sampledPixels.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
    
    return sampledPixels;
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

// Store previous centroids for stability
let previousCentroids = null;
let previousK = null;
let previousMedoids = null;
let previousKMedoids = null;

// Main K-means clustering function
function kmeansQuantize(pixels, k, maxIterations = 20, onProgress = null, useStable = true) {
    if (pixels.length === 0 || k <= 0) {
        return { centroids: [], assignments: [], iterations: 0, error: 0 };
    }
    
    // Ensure k doesn't exceed number of unique colors
    const uniqueColors = new Set(pixels.map(p => p.join(',')));
    k = Math.min(k, uniqueColors.size);
    
    // Initialize centroids
    let centroids;
    
    // Use stable initialization if we're increasing K and have previous results
    if (useStable && previousCentroids && previousK && k > previousK) {
        // Keep existing centroids and add new ones
        centroids = [...previousCentroids];
        
        // Add additional centroids using k-means++ for the remaining slots
        const additionalK = k - previousK;
        const additionalCentroids = initializeAdditionalCentroids(pixels, centroids, additionalK);
        centroids = centroids.concat(additionalCentroids);
    } else if (useStable && previousCentroids && previousK && k < previousK) {
        // When reducing K, keep the most important centroids
        centroids = selectBestCentroids(pixels, previousCentroids, k);
    } else {
        // Standard initialization
        centroids = initializeCentroidsKMeansPlusPlus(pixels, k);
    }
    
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
    
    // Store results for next time
    previousCentroids = centroids;
    previousK = k;
    
    return {
        centroids: centroids,
        assignments: assignments,
        iterations: iterations,
        error: prevError / pixels.length
    };
}

// Initialize additional centroids when increasing K
function initializeAdditionalCentroids(pixels, existingCentroids, additionalK) {
    const newCentroids = [];
    
    // First, find which cluster has the most pixels (largest region)
    const clusterSizes = new Array(existingCentroids.length).fill(0);
    const clusterPixels = existingCentroids.map(() => []);
    
    // Assign each pixel to its nearest centroid and count
    for (const pixel of pixels) {
        const { index } = findClosestCentroid(pixel, existingCentroids);
        clusterSizes[index]++;
        clusterPixels[index].push(pixel);
    }
    
    // For each new centroid to add
    for (let i = 0; i < additionalK; i++) {
        // Find the largest cluster (most pixels)
        let largestClusterIdx = 0;
        let maxSize = 0;
        
        for (let j = 0; j < clusterSizes.length; j++) {
            if (clusterSizes[j] > maxSize) {
                maxSize = clusterSizes[j];
                largestClusterIdx = j;
            }
        }
        
        // Split the largest cluster
        const largestCluster = clusterPixels[largestClusterIdx];
        if (largestCluster.length > 0) {
            // Find the pixel in this cluster that's farthest from its centroid
            let maxDist = 0;
            let bestPixel = null;
            
            for (const pixel of largestCluster) {
                const dist = colorDistance(pixel, existingCentroids[largestClusterIdx]);
                if (dist > maxDist) {
                    maxDist = dist;
                    bestPixel = [...pixel];
                }
            }
            
            if (bestPixel) {
                newCentroids.push(bestPixel);
                // Add the new centroid to existing ones for next iteration
                existingCentroids.push(bestPixel);
                
                // Recalculate cluster assignments for the split cluster
                const newClusterPixels = [];
                const remainingPixels = [];
                
                for (const pixel of largestCluster) {
                    const distToOld = colorDistance(pixel, existingCentroids[largestClusterIdx]);
                    const distToNew = colorDistance(pixel, bestPixel);
                    
                    if (distToNew < distToOld) {
                        newClusterPixels.push(pixel);
                    } else {
                        remainingPixels.push(pixel);
                    }
                }
                
                // Update cluster data
                clusterPixels[largestClusterIdx] = remainingPixels;
                clusterPixels.push(newClusterPixels);
                clusterSizes[largestClusterIdx] = remainingPixels.length;
                clusterSizes.push(newClusterPixels.length);
            }
        }
    }
    
    return newCentroids;
}

// Select best centroids when reducing K
function selectBestCentroids(pixels, centroids, k) {
    // Count pixels assigned to each centroid
    const centroidData = centroids.map((centroid, i) => ({
        centroid: centroid,
        index: i,
        count: 0,
        pixels: []
    }));
    
    // Assign pixels and count
    for (const pixel of pixels) {
        const { index } = findClosestCentroid(pixel, centroids);
        centroidData[index].count++;
        centroidData[index].pixels.push(pixel);
    }
    
    // Sort by count (largest first)
    centroidData.sort((a, b) => b.count - a.count);
    
    // Keep the k largest clusters
    const keptCentroids = centroidData.slice(0, k).map(d => d.centroid);
    
    // For removed clusters, merge their pixels into the nearest kept cluster
    const removedClusters = centroidData.slice(k);
    
    for (const removed of removedClusters) {
        if (removed.pixels.length > 0) {
            // Find which kept centroid is closest to this removed centroid
            const { index } = findClosestCentroid(removed.centroid, keptCentroids);
            
            // The pixels from the removed cluster will naturally be reassigned
            // to the nearest kept centroid during the next K-means iteration
        }
    }
    
    return keptCentroids;
}

// Reset previous centroids (call when loading new image)
function resetPreviousCentroids() {
    previousCentroids = null;
    previousK = null;
    previousMedoids = null;
    previousKMedoids = null;
}

// K-medoids clustering - only uses actual colors from the image
function kmedoidsQuantize(pixels, k, maxIterations = 20, onProgress = null, useStable = true) {
    if (pixels.length === 0 || k <= 0) {
        return { centroids: [], assignments: [], iterations: 0, error: 0 };
    }
    
    // Safety check: if too many pixels, fall back to K-means
    if (pixels.length > 100000) {
        console.warn('Too many pixels for K-medoids, falling back to K-means');
        return kmeansQuantize(pixels, k, maxIterations, onProgress, useStable);
    }
    
    // Get unique colors and their counts
    const colorMap = new Map();
    for (const pixel of pixels) {
        const key = pixel.join(',');
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }
    
    // Convert to array of unique colors with their frequencies
    const uniqueColors = Array.from(colorMap.entries()).map(([key, count]) => ({
        color: key.split(',').map(Number),
        count: count,
        key: key
    }));
    
    // Ensure k doesn't exceed number of unique colors
    k = Math.min(k, uniqueColors.length);
    
    // Safety: Limit unique colors to prevent stack overflow
    if (uniqueColors.length > 10000) {
        console.warn('Too many unique colors, using K-means instead');
        return kmeansQuantize(pixels, k, maxIterations, onProgress, useStable);
    }
    
    // Initialize medoids
    let medoids;
    
    if (useStable && previousMedoids && previousKMedoids && k > previousKMedoids) {
        // Keep existing medoids and add new ones
        medoids = [...previousMedoids];
        const additionalK = k - previousKMedoids;
        const additionalMedoids = initializeAdditionalMedoids(uniqueColors, medoids, additionalK);
        medoids = medoids.concat(additionalMedoids);
    } else if (useStable && previousMedoids && previousKMedoids && k < previousKMedoids) {
        // Keep most important medoids
        medoids = selectBestMedoids(uniqueColors, previousMedoids, k);
    } else {
        // Initialize using k-medoids++ (similar to k-means++)
        medoids = initializeMedoidsPlusPlus(uniqueColors, k);
    }
    
    let assignments = new Array(pixels.length);
    let prevError = Infinity;
    let iterations = 0;
    
    // Main iteration loop
    for (let iter = 0; iter < maxIterations; iter++) {
        iterations = iter + 1;
        
        // Assignment step
        let totalError = 0;
        for (let i = 0; i < pixels.length; i++) {
            const { index, distance } = findClosestCentroid(pixels[i], medoids);
            assignments[i] = index;
            totalError += distance;
        }
        
        // Check convergence
        const errorDiff = Math.abs(prevError - totalError);
        if (errorDiff < 0.001) {
            break;
        }
        prevError = totalError;
        
        // Update step: find better medoids from actual colors
        for (let j = 0; j < k; j++) {
            // Get all pixels assigned to this medoid
            const clusterColors = [];
            for (let i = 0; i < pixels.length; i++) {
                if (assignments[i] === j) {
                    clusterColors.push(pixels[i]);
                }
            }
            
            if (clusterColors.length > 0) {
                // Find the actual color that minimizes distance to all cluster members
                let bestMedoid = medoids[j];
                let bestCost = Infinity;
                
                // Try each unique color in the cluster as potential medoid
                const uniqueClusterColors = new Set(clusterColors.map(c => c.join(',')));
                for (const colorKey of uniqueClusterColors) {
                    const candidateColor = colorKey.split(',').map(Number);
                    let cost = 0;
                    
                    for (const clusterColor of clusterColors) {
                        cost += colorDistance(candidateColor, clusterColor);
                    }
                    
                    if (cost < bestCost) {
                        bestCost = cost;
                        bestMedoid = candidateColor;
                    }
                }
                
                medoids[j] = bestMedoid;
            }
        }
        
        if (onProgress) {
            onProgress(iter / maxIterations);
        }
    }
    
    // Store for stability
    previousMedoids = medoids;
    previousKMedoids = k;
    
    return {
        centroids: medoids,
        assignments: assignments,
        iterations: iterations,
        error: prevError / pixels.length,
        isActualColors: true
    };
}

// Initialize medoids using k-medoids++
function initializeMedoidsPlusPlus(uniqueColors, k) {
    const medoids = [];
    
    // Pick first medoid - choose the color with highest frequency
    let maxCount = 0;
    let firstMedoid = uniqueColors[0].color;
    for (const uc of uniqueColors) {
        if (uc.count > maxCount) {
            maxCount = uc.count;
            firstMedoid = uc.color;
        }
    }
    medoids.push([...firstMedoid]);
    
    // Pick remaining medoids
    for (let i = 1; i < k; i++) {
        let maxMinDist = 0;
        let bestColor = null;
        
        // Find color that's farthest from existing medoids
        for (const uc of uniqueColors) {
            let minDist = Infinity;
            for (const medoid of medoids) {
                const dist = colorDistance(uc.color, medoid);
                if (dist < minDist) {
                    minDist = dist;
                }
            }
            
            // Weight by frequency - prefer common colors
            const weightedDist = minDist * Math.sqrt(uc.count);
            if (weightedDist > maxMinDist) {
                maxMinDist = weightedDist;
                bestColor = uc.color;
            }
        }
        
        if (bestColor) {
            medoids.push([...bestColor]);
        }
    }
    
    return medoids;
}

// Initialize additional medoids when increasing K
function initializeAdditionalMedoids(uniqueColors, existingMedoids, additionalK) {
    const newMedoids = [];
    
    for (let i = 0; i < additionalK; i++) {
        let maxMinDist = 0;
        let bestColor = null;
        
        // Find actual color that's farthest from existing medoids
        for (const uc of uniqueColors) {
            let minDist = Infinity;
            for (const medoid of existingMedoids.concat(newMedoids)) {
                const dist = colorDistance(uc.color, medoid);
                if (dist < minDist) {
                    minDist = dist;
                }
            }
            
            // Weight by frequency
            const weightedDist = minDist * Math.sqrt(uc.count);
            if (weightedDist > maxMinDist) {
                maxMinDist = weightedDist;
                bestColor = uc.color;
            }
        }
        
        if (bestColor) {
            newMedoids.push([...bestColor]);
        }
    }
    
    return newMedoids;
}

// Select best medoids when reducing K
function selectBestMedoids(uniqueColors, medoids, k) {
    // Create a frequency map for medoids
    const medoidFreq = new Map();
    
    for (const medoid of medoids) {
        const key = medoid.join(',');
        let freq = 0;
        for (const uc of uniqueColors) {
            if (uc.key === key) {
                freq = uc.count;
                break;
            }
        }
        medoidFreq.set(key, { medoid: medoid, freq: freq });
    }
    
    // Sort by frequency and keep top k
    const sorted = Array.from(medoidFreq.values())
        .sort((a, b) => b.freq - a.freq)
        .slice(0, k)
        .map(item => item.medoid);
    
    return sorted;
}

// Apply quantized colors to image data
function applyQuantization(imageData, centroids, assignments) {
    const quantizedData = new ImageData(imageData.width, imageData.height);
    const dstData = quantizedData.data;
    
    // Simple logic: every pixel gets replaced with its nearest color
    // No pixels are removed, only replaced
    for (let i = 0; i < assignments.length; i++) {
        const pixelIdx = i * 4;
        const cluster = assignments[i];
        
        // Get the color from the palette (with fallback to first color if invalid)
        let centroid;
        if (cluster >= 0 && cluster < centroids.length && centroids[cluster]) {
            centroid = centroids[cluster];
        } else {
            // Fallback to first color if assignment is invalid
            centroid = centroids[0] || [0, 0, 0];
        }
        
        // Replace pixel with palette color (always fully opaque)
        dstData[pixelIdx] = centroid[0];     // R
        dstData[pixelIdx + 1] = centroid[1]; // G
        dstData[pixelIdx + 2] = centroid[2]; // B
        dstData[pixelIdx + 3] = 255;          // A - always solid, never transparent
    }
    
    return quantizedData;
}

// Quantize image using all pixels for final mapping
function quantizeImage(imageData, k, sampleRate = 10, onProgress = null, useStable = true, useActualColors = true) {
    // Sample pixels for clustering
    const sampledPixels = samplePixels(imageData, sampleRate);
    
    // Choose algorithm: K-medoids (actual colors) or K-means (average colors)
    let result;
    if (useActualColors) {
        result = kmedoidsQuantize(sampledPixels, k, 20, onProgress, useStable);
    } else {
        result = kmeansQuantize(sampledPixels, k, 20, onProgress, useStable);
    }
    
    let centroids = result.centroids;
    
    // Map all pixels to nearest centroid
    const allPixels = extractAllPixels(imageData);
    let assignments = allPixels.map(pixel => findClosestCentroid(pixel, centroids).index);
    
    // Persist last state to support stable reduction
    lastQuantization = { pixels: allPixels, assignments: assignments, centroids: centroids, k: centroids.length };
    
    // If the returned number of centroids is larger than target k because of stability,
    // merge palette to exactly k WITHOUT losing any pixels
    if (centroids.length > k) {
        const merged = mergePaletteToK(allPixels, assignments, centroids, k);
        centroids = merged.centroids;
        assignments = merged.assignments;
    }
    
    // Apply quantization (no pixel removal; all pixels assigned)
    const quantizedData = applyQuantization(imageData, centroids, assignments);
    
    return {
        quantizedData: quantizedData,
        centroids: centroids,
        assignments: assignments,
        isActualColors: result.isActualColors || false
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
