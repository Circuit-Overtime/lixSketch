// --- Keep existing code before this ---

let isDrawing = false;
let lasers = []; // Array to store multiple laser trails
const maxTrailLength = 30; // Maximum trail length for active drawing
const fadeOutDuration = 600; // Duration of fade-out in milliseconds
const baseLaserOpacity = 0.8; // Starting opacity
const baseLaserWidth = 5;   // Starting width
const minDistanceThreshold = 1.5; // Minimum distance (in SVG units) to add a new point

// --- NEW: State for animation loop ---
let animationFrameId = null;
let lastMovePoint = null; // Stores the latest pointer position {x, y} in screen coords
let hasMoved = false;     // Flag to indicate if the pointer moved since last frame

// Convert screen coordinates to SVG viewBox
function screenToViewBoxPoint(x, y) {
    const CTM = svg.getScreenCTM();
    if (!CTM) return null;
    try { // Add try-catch for robustness if CTM is invalid
        const inverseCTM = CTM.inverse();
        return {
            x: (x - CTM.e) * inverseCTM.a + (y - CTM.f) * inverseCTM.c,
            y: (x - CTM.e) * inverseCTM.b + (y - CTM.f) * inverseCTM.d
        };
    } catch (e) {
        console.error("Error inverting CTM:", e);
        // Fallback calculation (less accurate if rotated/skewed)
        return {
            x: (x - CTM.e) / CTM.a,
            y: (y - CTM.f) / CTM.d
        };
    }
}

// --- Helper function drawSegmentedPath (Keep as is from previous version) ---
function drawSegmentedPath(pathElement, id, points, opacity, strokeWidth) {
    if (!points || points.length < 2) {
        if (pathElement) pathElement.remove();
        return null;
    }
    let pathData = `M ${points[0].x} ${points[0].y}`;
    if (points.length < 3) {
        pathData += ` L ${points[1].x} ${points[1].y}`;
    } else {
        let cpStartX = points[0].x + (points[1].x - points[0].x) / 3;
        let cpStartY = points[0].y + (points[1].y - points[0].y) / 3;
        pathData += ` Q ${cpStartX} ${cpStartY}, ${points[1].x} ${points[1].y}`;
        for (let i = 1; i < points.length - 2; i++) {
            let p0 = points[i - 1];
            let p1 = points[i];
            let p2 = points[i + 1];
            let p3 = points[i + 2];
            let cp1x = p1.x + (p2.x - p0.x) / 6;
            let cp1y = p1.y + (p2.y - p0.y) / 6;
            let cp2x = p2.x - (p3.x - p1.x) / 6;
            let cp2y = p2.y - (p3.y - p1.y) / 6;
            pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
        let last = points.length - 1;
        let pLast = points[last];
        let pSecondLast = points[last - 1];
        let cpEndX = pLast.x - (pLast.x - pSecondLast.x) / 3;
        let cpEndY = pLast.y - (pLast.y - pSecondLast.y) / 3;
        pathData += ` Q ${cpEndX} ${cpEndY}, ${pLast.x} ${pLast.y}`;
    }
    if (!pathElement) {
        pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathElement.setAttribute("id", id);
        if (svg.firstChild) { svg.insertBefore(pathElement, svg.firstChild); }
        else { svg.appendChild(pathElement); }
    }
    pathElement.setAttribute("d", pathData);
    pathElement.setAttribute("stroke", `hsla(120, 100%, 50%, ${Math.max(0, Math.min(1, opacity))})`);
    pathElement.setAttribute("stroke-width", Math.max(0.1, strokeWidth));
    pathElement.setAttribute("fill", "none");
    pathElement.setAttribute("stroke-linecap", "round");
    pathElement.setAttribute("stroke-linejoin", "round");
    return pathElement;
}


// --- Helper: Distance calculation ---
function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// --- NEW: Drawing loop using requestAnimationFrame ---
function drawingLoop() {
    if (!isDrawing) {
        animationFrameId = null; // Ensure loop stops if isDrawing becomes false
        return;
    }

    if (hasMoved && lastMovePoint) {
        const currentLaser = lasers[lasers.length - 1];
        if (currentLaser) {
            let svgPoint = screenToViewBoxPoint(lastMovePoint.x, lastMovePoint.y);

            if (svgPoint) {
                const lastLaserPoint = currentLaser.points[currentLaser.points.length - 1];
                // Check distance threshold
                if (!lastLaserPoint || distance(svgPoint, lastLaserPoint) >= minDistanceThreshold) {
                    currentLaser.points.push(svgPoint);

                    // Trim points if trail gets too long
                    while (currentLaser.points.length > maxTrailLength) {
                        currentLaser.points.shift();
                    }

                    // Get/update the path element
                    let laserPath = document.getElementById(currentLaser.id);
                    // Draw the updated path
                    drawSegmentedPath(laserPath, currentLaser.id, currentLaser.points, baseLaserOpacity, baseLaserWidth);
                }
            }
        }
        hasMoved = false; // Reset move flag for this frame
    }

    // Request the next frame
    animationFrameId = requestAnimationFrame(drawingLoop);
}

// --- fadeLaserTrail function remains the same as the previous good version ---
function fadeLaserTrail(laser) {
    const startTime = performance.now();
    const initialPoints = [...laser.points];
    const totalPoints = initialPoints.length;
    let laserPath = document.getElementById(laser.id);

    if (totalPoints < 2 || !laserPath) {
        if (laserPath) laserPath.remove();
        lasers = lasers.filter(l => l.id !== laser.id);
        return;
    }

    function fade(currentTime) {
        const elapsedTime = currentTime - startTime;
        let progress = Math.min(1, elapsedTime / fadeOutDuration);
        const easedProgress = progress * progress; // Quadratic ease-in
        const pointsToKeep = Math.round(totalPoints * (1 - easedProgress));

        if (pointsToKeep < 2) {
            if (laserPath) laserPath.remove();
            lasers = lasers.filter(l => l.id !== laser.id);
            return;
        }

        const currentPoints = initialPoints.slice(-pointsToKeep);
        const currentOpacity = baseLaserOpacity * (1 - progress);
        const currentWidth = Math.max(0.1, baseLaserWidth * (1 - easedProgress));
        laserPath = drawSegmentedPath(laserPath, laser.id, currentPoints, currentOpacity, currentWidth);

        if (laserPath && progress < 1) {
            requestAnimationFrame(fade);
        } else if (!laserPath && progress < 1) {
            console.warn("Laser path removed unexpectedly during fade for ID:", laser.id);
            lasers = lasers.filter(l => l.id !== laser.id);
        }
    }
    requestAnimationFrame(fade);
}


// --- Event Listeners (Modified for rAF) ---

svg.addEventListener("pointerdown", (e) => {
    if (!selectedTool || !selectedTool.classList.contains("bxs-magic-wand") || isDrawing) return; // Prevent multiple starts
    if (e.target !== svg) {
        const isUIElement = e.target.closest('.selection-box, .resize-handle');
        if (isUIElement) return;
    }

    let screenPoint = { x: e.clientX, y: e.clientY };
    let startSvgPoint = screenToViewBoxPoint(screenPoint.x, screenPoint.y);
    if (!startSvgPoint) return;

    isDrawing = true;
    hasMoved = false; // Reset flag
    lastMovePoint = screenPoint; // Store initial screen point

    const laserId = "laserPath_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    const newLaser = {
        id: laserId,
        points: [startSvgPoint], // Start with the first point
        pathElement: null
    };
    lasers.push(newLaser);

    // Initial draw of the first point (or tiny segment if needed)
    let initialPath = drawSegmentedPath(null, newLaser.id, newLaser.points, baseLaserOpacity, baseLaserWidth);
    // (drawSegmentedPath handles cases with < 2 points by doing nothing or removing)

    svg.style.cursor = `url(${lazerCursor}) 10 10, auto`;

    // --- Start the drawing loop ---
    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(drawingLoop);
    }
});

svg.addEventListener("pointermove", (e) => {
    if (selectedTool && selectedTool.classList.contains("bxs-magic-wand")) {
        // Set cursor regardless of drawing state, only if tool active
        svg.style.cursor = `url(${lazerCursor}) 10 10, auto`;
    }

    if (!isDrawing) return;

    // Store the latest pointer position and set the flag
    lastMovePoint = { x: e.clientX, y: e.clientY };
    hasMoved = true;

    // The actual drawing happens in the drawingLoop
});

svg.addEventListener("pointerup", (e) => {
    if (!isDrawing) return; // Only act if we were drawing with this tool

    isDrawing = false; // Stop the drawing loop condition
    hasMoved = false;
    lastMovePoint = null;
    // animationFrameId will be cleared by the loop itself stopping

    if (lasers.length > 0) {
        const laserToFade = lasers[lasers.length - 1];
        // Add the final point before fading (optional, can sometimes look better)
        // let finalSvgPoint = screenToViewBoxPoint(e.clientX, e.clientY);
        // if(finalSvgPoint) {
        //     const lastLaserPoint = laserToFade.points[laserToFade.points.length - 1];
        //     if (!lastLaserPoint || distance(finalSvgPoint, lastLaserPoint) > 0.1) { // Add if different
        //          laserToFade.points.push(finalSvgPoint);
        //          // Optional redraw before fade starts
        //          // let laserPath = document.getElementById(laserToFade.id);
        //          // drawSegmentedPath(laserPath, laserToFade.id, laserToFade.points, baseLaserOpacity, baseLaserWidth);
        //     }
        // }
        fadeLaserTrail(laserToFade);
    }

    // Reset cursor based on tool state AFTER drawing stops
    if (selectedTool && selectedTool.classList.contains("bxs-magic-wand")) {
       svg.style.cursor = `url(${lazerCursor}) 10 10, auto`; // Keep if tool active
    } else {
       svg.style.cursor = 'default';
    }
});

svg.addEventListener("pointerleave", (e) => {
    if (!isDrawing) return; // Only act if we were drawing

    isDrawing = false;
    hasMoved = false;
    lastMovePoint = null;

    if (lasers.length > 0) {
        const laserToFade = lasers[lasers.length - 1];
         // Maybe add the last point before leave? Might be off-canvas.
        fadeLaserTrail(laserToFade);
    }
    svg.style.cursor = 'default'; // Always reset cursor when leaving canvas
});

