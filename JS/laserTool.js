let isDrawing = false;
let lasers = []; // Array to store multiple laser trails
const maxTrailLength = 30; // Maximum trail length
const fadeOutDuration = 500; // Duration of fade-out in milliseconds (adjust as needed)

const rc = rough.svg(svg); // Rough.js instance

// Convert screen coordinates to SVG viewBox
function screenToViewBoxPoint(x, y) {
    const CTM = svg.getScreenCTM();
    if (!CTM) return null; // Prevent null reference errors

    return {
        x: (x - CTM.e) / CTM.a,
        y: (y - CTM.f) / CTM.d
    };
}

// Function to draw a single laser stroke
function drawLaserStroke(laser) {
    if (laser.points.length < 3) return;

    // Reduce trail size progressively
    if (laser.points.length > maxTrailLength) {
        laser.points.shift(); // Remove the oldest point
    }

    let opacityFactor = laser.points.length / maxTrailLength;
    let strokeWidth = Math.max(4, opacityFactor * 5); // Stroke tapers as it fades

    let pathData = `M ${laser.points[0].x} ${laser.points[0].y}`;

    for (let i = 1; i < laser.points.length - 2; i++) {
        let p0 = laser.points[i - 1];
        let p1 = laser.points[i];
        let p2 = laser.points[i + 1];
        let p3 = laser.points[i + 2];

        // Catmull-Rom to Bézier conversion (smooth interpolation)
        let cp1x = p1.x + (p2.x - p0.x) / 6;
        let cp1y = p1.y + (p2.y - p0.y) / 6;
        let cp2x = p2.x - (p3.x - p1.x) / 6;
        let cp2y = p2.y - (p3.y - p1.y) / 6;

        pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    let laserPath = document.getElementById(laser.id);
    if (!laserPath) {
        laserPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        laserPath.setAttribute("id", laser.id);
        svg.appendChild(laserPath);
    }

    laserPath.setAttribute("d", pathData);
    laserPath.setAttribute("stroke", `rgba(0, 255, 0, 0.7)`);
    laserPath.setAttribute("stroke-width", strokeWidth);
    laserPath.setAttribute("fill", "none");
    laserPath.setAttribute("stroke-linecap", "round");
    laserPath.setAttribute("stroke-linejoin", "round");
}

// Function to smoothly fade out a single laser trail
function fadeLaserTrail(laser) {
    const startTime = performance.now();

    function fade(currentTime) {
        const elapsedTime = currentTime - startTime;
        let progress = Math.min(1, elapsedTime / fadeOutDuration);  // Normalize progress (0 to 1)

        // Apply an ease-out function (e.g., quadratic ease-out)
        const easedProgress = progress * (2 - progress);

        const opacityFactor = Math.max(0, 0.7 * (1 - easedProgress)); // Opacity goes from 0.7 to 0
        let strokeWidth = Math.max(2, opacityFactor * 5); // Adjust stroke width if needed

        if (laser.points.length > 1) {
            let pathData = `M ${laser.points[0].x} ${laser.points[0].y}`;

            for (let i = 1; i < laser.points.length - 2; i++) {
                let p0 = laser.points[i - 1];
                let p1 = laser.points[i];
                let p2 = laser.points[i + 1];
                let p3 = laser.points[i + 2];

                let cp1x = p1.x + (p2.x - p0.x) / 6;
                let cp1y = p1.y + (p2.y - p0.y) / 6;
                let cp2x = p2.x - (p3.x - p1.x) / 6;
                let cp2y = p2.y - (p3.y - p1.y) / 6;

                pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
            }

            let laserPath = document.getElementById(laser.id);
            if (laserPath) {
                laserPath.setAttribute("d", pathData);
                laserPath.setAttribute("stroke", `rgba(0, 250, 0, ${opacityFactor})`);
                laserPath.setAttribute("stroke-width", strokeWidth);
            }
        }

         if (easedProgress < 1) { // Continue fading until fully faded
                requestAnimationFrame(fade);
        } else {
            let laserPath = document.getElementById(laser.id);
            if (laserPath) {
                laserPath.remove();
            }
            // Remove the laser from the lasers array
            lasers = lasers.filter(l => l.id !== laser.id);
        }
    }

    requestAnimationFrame(fade);
}

// Pointer down: Start drawing
svg.addEventListener("pointerdown", (e) => {
    if (!selectedTool.classList.contains("bxs-magic-wand")) return;

    let point = screenToViewBoxPoint(e.clientX, e.clientY);
    if (!point) return; // Prevent null errors

    isDrawing = true;
    const laserId = "laserPath_" + Date.now(); // Unique ID for each laser
    const newLaser = {
        id: laserId,
        points: [point]
    };
    lasers.push(newLaser);
    drawLaserStroke(newLaser);
});

// Pointer move: Draw laser effect with progressive fading while moving
svg.addEventListener("pointermove", (e) => {
    if (selectedTool.classList.contains("bxs-magic-wand")) {
        svg.style.cursor = `url(${lazerCursor}) 10 10, auto`;
    }
    if (!isDrawing) return;

    // Get the currently active laser
    const currentLaser = lasers[lasers.length - 1];

    let point = screenToViewBoxPoint(e.clientX, e.clientY);
    if (!point) return;

    currentLaser.points.push(point);
    drawLaserStroke(currentLaser);
});

// Pointer up: Stop drawing and trigger rear-end fade-out
svg.addEventListener("pointerup", () => {
    isDrawing = false;
    // Get the last created laser and fade it out
    if (lasers.length > 0) {
        const currentLaser = lasers[lasers.length - 1];
        fadeLaserTrail(currentLaser);
    }
});

// Pointer leave: Stop drawing
svg.addEventListener("pointerleave", () => {
    isDrawing = false;
});