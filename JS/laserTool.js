let isDrawing = false;
let lasers = [];
const fadeOutDuration = 1200; // Total duration for a point to fade out
const baseLaserOpacity = 1;
const baseLaserWidth = 10;
const minDistanceThreshold = 0.5; // Increased for smoother, more natural trails

let drawingAnimationId = null;
let lastMovePoint = null;
let hasMoved = false;

// Helper for smoothing points using Catmull-Rom to Bezier
function getCubicBezierCurve(points, i) {
    // Clamp points for edges
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1] || points[i];
    const p3 = points[i + 2] || p2;

    // Calculate control points for Catmull-Rom to Bezier
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    return { c1x, c1y, c2x, c2y };
}

function screenToViewBoxPoint(x, y) {
    const CTM = svg.getScreenCTM();
    if (!CTM) return null;
    try {
        const inverseCTM = CTM.inverse();
        return {
            x: (x - CTM.e) * inverseCTM.a + (y - CTM.f) * inverseCTM.c,
            y: (x - CTM.e) * inverseCTM.b + (y - CTM.f) * inverseCTM.d
        };
    } catch (e) {
        console.error("Error inverting CTM:", e);
        return {
            x: (x - CTM.e) / CTM.a,
            y: (y - CTM.f) / CTM.d
        };
    }
}

function updateLaserAppearance(laser) {
    let laserGroup = document.getElementById(laser.id);
    if (!laserGroup) {
        laserGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        laserGroup.setAttribute("id", laser.id);
        if (svg.firstChild) {
            svg.insertBefore(laserGroup, svg.firstChild);
        } else {
            svg.appendChild(laserGroup);
        }
    }

    // Clear existing segments to redraw
    while (laserGroup.firstChild) {
        laserGroup.removeChild(laserGroup.firstChild);
    }

    const currentTime = performance.now();
    // Filter out old points that have completely faded out
    laser.points = laser.points.filter(p => (currentTime - p.timestamp) < fadeOutDuration);

    if (laser.points.length === 0) {
        laserGroup.remove();
        lasers = lasers.filter(l => l.id !== laser.id);
        return;
    }

    // Single point: draw as a dot
    if (laser.points.length === 1) {
        const point = laser.points[0];
        const startDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        startDot.setAttribute("cx", point.x);
        startDot.setAttribute("cy", point.y);
        startDot.setAttribute("r", baseLaserWidth / 2);
        startDot.setAttribute("fill", `hsla(120, 100%, 50%, ${baseLaserOpacity})`);
        laserGroup.appendChild(startDot);
        return;
    }

    // Draw smooth, cubic Bezier path for the whole laser
    let pathData = `M ${laser.points[0].x} ${laser.points[0].y}`;
    for (let i = 0; i < laser.points.length - 1; i++) {
        const p1 = laser.points[i];
        const p2 = laser.points[i + 1];
        const { c1x, c1y, c2x, c2y } = getCubicBezierCurve(laser.points, i);
        pathData += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }

    // Calculate overall opacity and width based on trail age and position (taper effect)
    for (let i = 0; i < laser.points.length - 1; i++) {
        const p1 = laser.points[i];
        const p2 = laser.points[i + 1];
        const { c1x, c1y, c2x, c2y } = getCubicBezierCurve(laser.points, i);

        const ageProgress1 = (currentTime - p1.timestamp) / fadeOutDuration;
        const ageProgress2 = (currentTime - p2.timestamp) / fadeOutDuration;
        const segmentFadeProgress = Math.max(ageProgress1, ageProgress2);
        const easedFadeProgress = 1 - Math.pow(segmentFadeProgress, 3);

        const trailPositionProgress = i / (laser.points.length - 1);
        const easedTrailPositionProgress = Math.pow(trailPositionProgress, 2);

        const currentOpacity = baseLaserOpacity * easedFadeProgress * easedTrailPositionProgress;
        const currentWidth = baseLaserWidth * easedFadeProgress * easedTrailPositionProgress;

        // Draw each segment as a path for a true taper/fade
        let segmentPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        segmentPath.setAttribute(
            "d",
            `M ${p1.x} ${p1.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
        );
        segmentPath.setAttribute(
            "stroke",
            `hsla(120, 100%, 50%, ${Math.max(0, Math.min(1, currentOpacity))})`
        );
        segmentPath.setAttribute("stroke-width", Math.max(0.1, currentWidth));
        segmentPath.setAttribute("fill", "none");
        segmentPath.setAttribute("stroke-linecap", "round");
        segmentPath.setAttribute("stroke-linejoin", "round");
        laserGroup.appendChild(segmentPath);
    }
}

function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function drawingLoop() {
    if (!isDrawing) {
        drawingAnimationId = null;
        return;
    }

    const currentLaser = lasers[lasers.length - 1];

    if (currentLaser) {
        if (hasMoved && lastMovePoint) {
            let svgPoint = screenToViewBoxPoint(lastMovePoint.x, lastMovePoint.y);

            if (svgPoint) {
                const lastLaserPoint = currentLaser.points[currentLaser.points.length - 1];
                if (!lastLaserPoint || distance(svgPoint, lastLaserPoint) >= minDistanceThreshold) {
                    currentLaser.points.push({ x: svgPoint.x, y: svgPoint.y, timestamp: performance.now() });
                }
            }
            hasMoved = false;
        }
        updateLaserAppearance(currentLaser);
    }

    drawingAnimationId = requestAnimationFrame(drawingLoop);
}

function fadeLaserTrail(laser) {
    const startTime = performance.now();
    const initialPoints = [...laser.points]; // Capture current points for the fade-out animation
    let laserGroup = document.getElementById(laser.id);

    if (!laserGroup) {
        lasers = lasers.filter(l => l.id !== laser.id);
        return;
    }

    function fade(currentTime) {
        const elapsedTime = currentTime - startTime;
        let progress = Math.min(1, elapsedTime / fadeOutDuration);
        const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic easing out for the overall trail fade

        // Filter points for this fade frame
        const currentPoints = initialPoints.filter(p => (currentTime - p.timestamp) < fadeOutDuration - elapsedTime);

        // Clear existing segments
        while (laserGroup.firstChild) {
            laserGroup.removeChild(laserGroup.firstChild);
        }

        if (currentPoints.length < 2 || progress >= 1) {
            laserGroup.remove();
            lasers = lasers.filter(l => l.id !== laser.id);
            return;
        }

        // Redraw segments with fading properties using improved curves
        for (let i = 0; i < currentPoints.length - 1; i++) {
            const p1 = currentPoints[i];
            const p2 = currentPoints[i + 1];
            const { c1x, c1y, c2x, c2y } = getCubicBezierCurve(currentPoints, i);

            const ageProgress1 = (currentTime - p1.timestamp) / fadeOutDuration;
            const ageProgress2 = (currentTime - p2.timestamp) / fadeOutDuration;
            const segmentFadeProgress = Math.max(ageProgress1, ageProgress2);

            const easedIndividualFade = 1 - Math.pow(segmentFadeProgress, 3);
            const trailPositionProgress = i / (currentPoints.length - 1);
            const easedTrailPositionProgress = Math.pow(trailPositionProgress, 2);

            const currentOpacity = baseLaserOpacity * easedIndividualFade * easedTrailPositionProgress * (1 - progress);
            const currentWidth = baseLaserWidth * easedIndividualFade * easedTrailPositionProgress * (1 - progress);

            let segmentPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            segmentPath.setAttribute(
                "d",
                `M ${p1.x} ${p1.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
            );
            segmentPath.setAttribute(
                "stroke",
                `hsla(120, 100%, 50%, ${Math.max(0, Math.min(1, currentOpacity))})`
            );
            segmentPath.setAttribute("stroke-width", Math.max(0.1, currentWidth));
            segmentPath.setAttribute("fill", "none");
            segmentPath.setAttribute("stroke-linecap", "round");
            segmentPath.setAttribute("stroke-linejoin", "round");
            laserGroup.appendChild(segmentPath);
        }

        requestAnimationFrame(fade);
    }
    requestAnimationFrame(fade);
}

svg.addEventListener("mousedown", (e) => {
    if (!selectedTool || !selectedTool.classList.contains("bxs-magic-wand")) return;

    let screenPoint = { x: e.clientX, y: e.clientY };
    let startSvgPoint = screenToViewBoxPoint(screenPoint.x, screenPoint.y);
    if (!startSvgPoint) return;

    if (isDrawing) {
        isDrawing = false;
        if (drawingAnimationId) {
            cancelAnimationFrame(drawingAnimationId);
            drawingAnimationId = null;
        }
        if (lasers.length > 0) {
            fadeLaserTrail(lasers[lasers.length - 1]);
        }
    }

    isDrawing = true;
    hasMoved = false;
    lastMovePoint = screenPoint;

    const laserId = "laserGroup_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    const newLaser = {
        id: laserId,
        points: [{ x: startSvgPoint.x, y: startSvgPoint.y, timestamp: performance.now() }],
        pathElement: null
    };
    lasers.push(newLaser);

    updateLaserAppearance(newLaser);

    svg.style.cursor = `url(${lazerCursor}) 10 10, auto`;

    if (!drawingAnimationId) {
        drawingAnimationId = requestAnimationFrame(drawingLoop);
    }
});

svg.addEventListener("mousemove", (e) => {
    if (selectedTool && selectedTool.classList.contains("bxs-magic-wand")) {
        svg.style.cursor = `url(${lazerCursor}) 10 10, auto`;
    }

    if (!isDrawing) return;

    lastMovePoint = { x: e.clientX, y: e.clientY };
    hasMoved = true;
});

svg.addEventListener("mouseup", (e) => {
    if (!isDrawing) return;

    isDrawing = false;
    hasMoved = false;
    lastMovePoint = null;

    if (drawingAnimationId) {
        cancelAnimationFrame(drawingAnimationId);
        drawingAnimationId = null;
    }

    if (lasers.length > 0) {
        const laserToFade = lasers[lasers.length - 1];
        fadeLaserTrail(laserToFade);
    }

    if (selectedTool && selectedTool.classList.contains("bxs-magic-wand")) {
       svg.style.cursor = `url(${lazerCursor}) 10 10, auto`;
    } else {
       svg.style.cursor = 'default';
    }
});