// K-means clustering algorithm for color quantization
// Version: 2.9.48

// Helper: Calculate weighted perceptual distance (prevents black→red merging)
function colorDistance(c1, c2) {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    const weightR = 0.30; const weightG = 0.59; const weightB = 0.11;
    return Math.sqrt(weightR * dr * dr + weightG * dg * dg + weightB * db * db);
}

// Helper: Find the closest centroid for a given color
function findClosestCentroid(color, centroids) {
    let minDist = Infinity; let closestIdx = 0;
    for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(color, centroids[i]);
        if (dist < minDist) { minDist = dist; closestIdx = i; }
    }
    return { index: closestIdx, distance: minDist };
}

// Keep last quantization state to support stable K reduction without losing pixels
let lastQuantization = { pixels: null, assignments: null, centroids: null, k: 0 };

function mergePaletteToK(pixels, assignments, centroids, targetK) {
    let currentAssignments = assignments.slice();
    let currentCentroids = centroids.map(c => [c[0], c[1], c[2]]);
    const totalPixels = assignments.length;
    while (currentCentroids.length > targetK) {
        const counts = new Array(currentCentroids.length).fill(0);
        for (let i = 0; i < currentAssignments.length; i++) {
            const a = currentAssignments[i]; if (a >= 0 && a < counts.length) counts[a]++;
        }
        let s = 0; let minCount = Infinity;
        for (let i = 0; i < counts.length; i++) { if (counts[i] < minCount) { minCount = counts[i]; s = i; } }
        let t = -1; let minDist = Infinity;
        for (let j = 0; j < currentCentroids.length; j++) { if (j === s) continue; const d = colorDistance(currentCentroids[s], currentCentroids[j]); if (d < minDist) { minDist = d; t = j; } }
        const pixelsBeforeMerge_s = counts[s]; const pixelsBeforeMerge_t = counts[t];
        for (let i = 0; i < currentAssignments.length; i++) {
            if (currentAssignments[i] === s) currentAssignments[i] = t; else if (currentAssignments[i] > s) currentAssignments[i] -= 1;
        }
        currentCentroids.splice(s, 1);
        const countsAfter = new Array(currentCentroids.length).fill(0);
        for (let i = 0; i < currentAssignments.length; i++) { const a = currentAssignments[i]; if (a >= 0 && a < countsAfter.length) countsAfter[a]++; }
        const newT = (t > s) ? t - 1 : t; const pixelsAfterMerge = countsAfter[newT]; const expectedPixels = pixelsBeforeMerge_s + pixelsBeforeMerge_t;
        if (pixelsAfterMerge !== expectedPixels) { console.error(`[ERROR] Pixel count mismatch! Expected ${expectedPixels}, got ${pixelsAfterMerge}`); }
        const sums = currentCentroids.map(() => [0, 0, 0]); const cts = new Array(currentCentroids.length).fill(0);
        for (let i = 0; i < pixels.length; i++) { const a = currentAssignments[i]; if (a >= 0 && a < currentCentroids.length) { sums[a][0] += pixels[i][0]; sums[a][1] += pixels[i][1]; sums[a][2] += pixels[i][2]; cts[a]++; } }
        for (let i = 0; i < currentCentroids.length; i++) { if (cts[i] > 0) { currentCentroids[i] = [ Math.round(sums[i][0] / cts[i]), Math.round(sums[i][1] / cts[i]), Math.round(sums[i][2] / cts[i]) ]; } }
    }
    let finalCount = 0; for (let i = 0; i < currentAssignments.length; i++) { const a = currentAssignments[i]; if (a >= 0 && a < currentCentroids.length) { finalCount++; } }
    if (finalCount !== totalPixels) { console.error(`[ERROR] Lost pixels during merge! Started with ${totalPixels}, ended with ${finalCount}`); }
    return { centroids: currentCentroids, assignments: currentAssignments };
}

function sanitizeAssignments(assignments, centroids, pixels) {
    const k = centroids.length; const cleaned = new Array(assignments.length);
    for (let i = 0; i < assignments.length; i++) { const a = assignments[i]; if (a >= 0 && a < k) { cleaned[i] = a; } else { const { index } = findClosestCentroid(pixels[i], centroids); cleaned[i] = index; } }
    return cleaned;
}

function samplePixels(imageData, sampleRate = 10) {
    const data = imageData.data; const totalPixels = data.length / 4;
    if (totalPixels < 10000) { const pixels = []; for (let i = 0; i < totalPixels; i++) { const idx = i * 4; pixels.push([data[idx], data[idx + 1], data[idx + 2]]); } return pixels; }
    const uniqueColors = new Map(); const sampledPixels = [];
    for (let i = 0; i < data.length; i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2]; const key = `${r},${g},${b}`; if (!uniqueColors.has(key)) { uniqueColors.set(key, [r, g, b]); } }
    uniqueColors.forEach(color => sampledPixels.push(color));
    for (let i = 0; i < totalPixels; i += sampleRate) { const idx = i * 4; sampledPixels.push([data[idx], data[idx + 1], data[idx + 2]]); }
    return sampledPixels;
}

function extractAllPixels(imageData) {
    const pixels = []; const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) { pixels.push([ data[i], data[i + 1], data[i + 2] ]); }
    return pixels;
}

function initializeCentroidsKMeansPlusPlus(pixels, k) {
    const centroids = []; const firstIdx = Math.floor(Math.random() * pixels.length); centroids.push([...pixels[firstIdx]]);
    for (let i = 1; i < k; i++) { const distances = []; let totalDist = 0; for (const pixel of pixels) { let minDist = Infinity; for (const centroid of centroids) { const dist = colorDistance(pixel, centroid); if (dist < minDist) { minDist = dist; } } distances.push(minDist); totalDist += minDist; } let randomValue = Math.random() * totalDist; for (let j = 0; j < pixels.length; j++) { randomValue -= distances[j]; if (randomValue <= 0) { centroids.push([...pixels[j]]); break; } } }
    return centroids;
}

let previousCentroids = null; let previousK = null; let previousMedoids = null; let previousKMedoids = null;

function kmeansQuantize(pixels, k, maxIterations = 20, onProgress = null, useStable = true, debugTrace = false) {
    if (pixels.length === 0 || k <= 0) { return { centroids: [], assignments: [], iterations: 0, error: 0 }; }
    const uniqueColors = new Set(pixels.map(p => p.join(','))); k = Math.min(k, uniqueColors.size);
    let centroids;
    if (useStable && previousCentroids && previousK && k > previousK) {
        centroids = [...previousCentroids];
        const additionalK = k - previousK; const additionalCentroids = initializeAdditionalCentroids(pixels, centroids, additionalK); centroids = centroids.concat(additionalCentroids);
    } else if (useStable && previousCentroids && previousK && k < previousK) {
        centroids = selectBestCentroids(pixels, previousCentroids, k);
    } else { centroids = initializeCentroidsKMeansPlusPlus(pixels, k); }
    let assignments = new Array(pixels.length); let prevError = Infinity; let iterations = 0; const centroidsByIter = [];
    for (let iter = 0; iter < maxIterations; iter++) { iterations = iter + 1; let totalError = 0; for (let i = 0; i < pixels.length; i++) { const { index, distance } = findClosestCentroid(pixels[i], centroids); assignments[i] = index; totalError += distance; }
        const errorDiff = Math.abs(prevError - totalError); if (errorDiff < 0.001) { break; } prevError = totalError;
        const sums = Array(k).fill(0).map(() => [0, 0, 0]); const counts = new Array(k).fill(0);
        for (let i = 0; i < pixels.length; i++) { const cluster = assignments[i]; sums[cluster][0] += pixels[i][0]; sums[cluster][1] += pixels[i][1]; sums[cluster][2] += pixels[i][2]; counts[cluster]++; }
        for (let i = 0; i < k; i++) { if (counts[i] > 0) { centroids[i] = [ Math.round(sums[i][0] / counts[i]), Math.round(sums[i][1] / counts[i]), Math.round(sums[i][2] / counts[i]) ]; } }
        if (debugTrace) centroidsByIter.push(centroids.map(c => [...c])); if (onProgress) { onProgress(iter / maxIterations); }
    }
    previousCentroids = centroids; previousK = k;
    return { centroids, assignments, iterations, error: prevError / pixels.length, debug: debugTrace ? { centroidsByIter } : undefined };
}

function initializeAdditionalCentroids(pixels, existingCentroids, additionalK) {
    const newCentroids = []; const clusterSizes = new Array(existingCentroids.length).fill(0); const clusterPixels = existingCentroids.map(() => []);
    for (const pixel of pixels) { const { index } = findClosestCentroid(pixel, existingCentroids); clusterSizes[index]++; clusterPixels[index].push(pixel); }
    for (let i = 0; i < additionalK; i++) { let largestClusterIdx = 0; let maxSize = 0; for (let j = 0; j < clusterSizes.length; j++) { if (clusterSizes[j] > maxSize) { maxSize = clusterSizes[j]; largestClusterIdx = j; } } const largestCluster = clusterPixels[largestClusterIdx]; if (largestCluster.length > 0) { let maxDist = 0; let bestPixel = null; for (const pixel of largestCluster) { const dist = colorDistance(pixel, existingCentroids[largestClusterIdx]); if (dist > maxDist) { maxDist = dist; bestPixel = [...pixel]; } } if (bestPixel) { newCentroids.push(bestPixel); existingCentroids.push(bestPixel); const newClusterPixels = []; const remainingPixels = []; for (const pixel of largestCluster) { const distToOld = colorDistance(pixel, existingCentroids[largestClusterIdx]); const distToNew = colorDistance(pixel, bestPixel); if (distToNew < distToOld) { newClusterPixels.push(pixel); } else { remainingPixels.push(pixel); } } clusterPixels[largestClusterIdx] = remainingPixels; clusterPixels.push(newClusterPixels); clusterSizes[largestClusterIdx] = remainingPixels.length; clusterSizes.push(newClusterPixels.length); } }
    }
    return newCentroids;
}

function selectBestCentroids(pixels, centroids, k) {
    const centroidData = centroids.map((centroid, i) => ({ centroid, index: i, count: 0, pixels: [] }));
    for (const pixel of pixels) { const { index } = findClosestCentroid(pixel, centroids); centroidData[index].count++; centroidData[index].pixels.push(pixel); }
    centroidData.sort((a, b) => b.count - a.count);
    const keptCentroids = centroidData.slice(0, k).map(d => d.centroid);
    return keptCentroids;
}

function resetPreviousCentroids() { previousCentroids = null; previousK = null; previousMedoids = null; previousKMedoids = null; }

function kmedoidsQuantize(pixels, k, maxIterations = 20, onProgress = null, useStable = true, debugTrace = false) {
    if (pixels.length === 0 || k <= 0) { return { centroids: [], assignments: [], iterations: 0, error: 0 }; }
    if (pixels.length > 100000) { console.warn('Too many pixels for K-medoids, falling back to K-means'); return kmeansQuantize(pixels, k, maxIterations, onProgress, useStable); }
    const colorMap = new Map(); for (const pixel of pixels) { const key = pixel.join(','); colorMap.set(key, (colorMap.get(key) || 0) + 1); }
    const uniqueColors = Array.from(colorMap.entries()).map(([key, count]) => ({ color: key.split(',').map(Number), count, key }));
    k = Math.min(k, uniqueColors.length);
    if (uniqueColors.length > 10000) { console.warn('Too many unique colors, using K-means instead'); return kmeansQuantize(pixels, k, maxIterations, onProgress, useStable); }
    let medoids; const seeds = [];
    if (useStable && previousMedoids && previousKMedoids && k > previousKMedoids) { medoids = [...previousMedoids]; const additionalK = k - previousKMedoids; const additionalMedoids = initializeAdditionalMedoids(uniqueColors, medoids, additionalK); medoids = medoids.concat(additionalMedoids); }
    else if (useStable && previousMedoids && previousKMedoids && k < previousKMedoids) { medoids = selectBestMedoids(uniqueColors, previousMedoids, k); }
    else { medoids = initializeMedoidsPlusPlus(uniqueColors, k); }
    if (debugTrace) medoids.forEach(m => seeds.push([...m]));
    let assignments = new Array(pixels.length); let prevError = Infinity; let iterations = 0; const medoidsByIter = [];
    for (let iter = 0; iter < maxIterations; iter++) { iterations = iter + 1; let totalError = 0; for (let i = 0; i < pixels.length; i++) { const { index, distance } = findClosestCentroid(pixels[i], medoids); assignments[i] = index; totalError += distance; }
        const errorDiff = Math.abs(prevError - totalError); if (errorDiff < 0.001) { break; } prevError = totalError;
        for (let j = 0; j < k; j++) { const clusterColors = []; for (let i = 0; i < pixels.length; i++) { if (assignments[i] === j) { clusterColors.push(pixels[i]); } }
            if (clusterColors.length > 0) { let bestMedoid = medoids[j]; let bestCost = Infinity; const uniqueClusterColors = new Set(clusterColors.map(c => c.join(',')));
                for (const colorKey of uniqueClusterColors) { const candidateColor = colorKey.split(',').map(Number); let cost = 0; for (const clusterColor of clusterColors) { cost += colorDistance(candidateColor, clusterColor); } if (cost < bestCost) { bestCost = cost; bestMedoid = candidateColor; } }
                medoids[j] = bestMedoid; }
        }
        if (debugTrace) medoidsByIter.push(medoids.map(m => [...m])); if (onProgress) { onProgress(iter / maxIterations); }
    }
    previousMedoids = medoids; previousKMedoids = k;
    return { centroids: medoids, assignments, iterations, error: prevError / pixels.length, isActualColors: true, debug: debugTrace ? { seeds, medoidsByIter } : undefined };
}

function initializeMedoidsPlusPlus(uniqueColors, k) {
    const medoids = []; let maxCount = 0; let firstMedoid = uniqueColors[0].color; for (const uc of uniqueColors) { if (uc.count > maxCount) { maxCount = uc.count; firstMedoid = uc.color; } } medoids.push([...firstMedoid]);
    for (let i = 1; i < k; i++) { let maxMinDist = 0; let bestColor = null; for (const uc of uniqueColors) { let minDist = Infinity; for (const medoid of medoids) { const dist = colorDistance(uc.color, medoid); if (dist < minDist) { minDist = dist; } } const weightedDist = minDist * Math.sqrt(uc.count); if (weightedDist > maxMinDist) { maxMinDist = weightedDist; bestColor = uc.color; } } if (bestColor) { medoids.push([...bestColor]); } }
    return medoids;
}

function initializeAdditionalMedoids(uniqueColors, existingMedoids, additionalK) {
    const newMedoids = [];
    for (let i = 0; i < additionalK; i++) { let maxMinDist = 0; let bestColor = null; for (const uc of uniqueColors) { let minDist = Infinity; for (const medoid of existingMedoids.concat(newMedoids)) { const dist = colorDistance(uc.color, medoid); if (dist < minDist) { minDist = dist; } } const weightedDist = minDist * Math.sqrt(uc.count); if (weightedDist > maxMinDist) { maxMinDist = weightedDist; bestColor = uc.color; } } if (bestColor) { newMedoids.push([...bestColor]); } }
    return newMedoids;
}

function selectBestMedoids(uniqueColors, medoids, k) {
    const medoidFreq = new Map(); for (const medoid of medoids) { const key = medoid.join(','); let freq = 0; for (const uc of uniqueColors) { if (uc.key === key) { freq = uc.count; break; } } medoidFreq.set(key, { medoid, freq }); }
    const sorted = Array.from(medoidFreq.values()).sort((a, b) => b.freq - a.freq).slice(0, k).map(item => item.medoid);
    return sorted;
}

function applyQuantization(imageData, centroids, assignments) {
    const quantizedData = new ImageData(imageData.width, imageData.height); const dstData = quantizedData.data;
    for (let i = 0; i < assignments.length; i++) { const pixelIdx = i * 4; const cluster = assignments[i]; let centroid; if (cluster >= 0 && cluster < centroids.length && centroids[cluster]) { centroid = centroids[cluster]; } else { centroid = centroids[0] || [0, 0, 0]; }
        dstData[pixelIdx] = centroid[0]; dstData[pixelIdx + 1] = centroid[1]; dstData[pixelIdx + 2] = centroid[2]; dstData[pixelIdx + 3] = 255; }
    return quantizedData;
}

function quantizeImage(imageData, k, sampleRate = 10, onProgress = null, useStable = true, useActualColors = true, debugTrace = false) {
    const prev = lastQuantization && Array.isArray(lastQuantization.assignments) ? lastQuantization : null;
    const sampledPixels = samplePixels(imageData, sampleRate);
    let result; if (useActualColors) { result = kmedoidsQuantize(sampledPixels, k, 20, onProgress, useStable, debugTrace); } else { result = kmeansQuantize(sampledPixels, k, 20, onProgress, useStable, debugTrace); }
    let centroids = result.centroids;
    const allPixels = extractAllPixels(imageData); let assignments = allPixels.map(pixel => findClosestCentroid(pixel, centroids).index);
    lastQuantization = { pixels: allPixels, assignments, centroids, k: centroids.length };
    if (prev && prev.k > k && prev.centroids && prev.assignments && prev.centroids.length === prev.k) {
        const prevCounts = new Array(prev.k).fill(0); for (let i = 0; i < prev.assignments.length; i++) { const a = prev.assignments[i]; if (a >= 0 && a < prev.k) prevCounts[a]++; }
        let sPrev = 0; let minPrev = Infinity; for (let i = 0; i < prevCounts.length; i++) { if (prevCounts[i] < minPrev) { minPrev = prevCounts[i]; sPrev = i; } }
        const { index: tNow } = findClosestCentroid(prev.centroids[sPrev], centroids); for (let i = 0; i < assignments.length; i++) { if (prev.assignments[i] === sPrev) assignments[i] = tNow; }
    }
    if (centroids.length > k) { const merged = mergePaletteToK(allPixels, assignments, centroids, k); centroids = merged.centroids; assignments = merged.assignments; }
    assignments = sanitizeAssignments(assignments, centroids, allPixels);
    const quantizedData = applyQuantization(imageData, centroids, assignments);
    return { quantizedData, centroids, assignments, isActualColors: result.isActualColors || false, debug: result.debug };
}

function rgbToHex(rgb) { const toHex = (n) => { const hex = n.toString(16); return hex.length === 1 ? '0' + hex : hex; }; return '#' + toHex(rgb[0]) + toHex(rgb[1]) + toHex(rgb[2]); }
function snapToYarnPalette(centroids, yarnPalette) { return centroids.map(centroid => { let minDist = Infinity; let closestYarn = yarnPalette[0]; for (const yarn of yarnPalette) { const dist = colorDistance(centroid, yarn); if (dist < minDist) { minDist = dist; closestYarn = yarn; } } return closestYarn; }); }
function calculateColorStats(assignments, k) { const counts = new Array(k).fill(0); for (const assignment of assignments) { counts[assignment]++; } const total = assignments.length; const percentages = counts.map(count => (count / total * 100).toFixed(2)); return { counts, percentages }; }



