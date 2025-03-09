let isDrawing = false;
let pointsLazer = [];
const maxTrailLength = 30; // Maximum trail length
const rc = rough.svg(svg); // Rough.js instance

// Convert screen coordinates to SVG viewBox
function screenToViewBoxPoint(x, y) {
    const CTM = svg.getScreenCTM();
    return [(x - CTM.e) / CTM.a, (y - CTM.f) / CTM.d];
}

// Function to draw the laser stroke with smooth, heavy curves and progressive fade
function drawLaserStroke() {
    if (pointsLazer.length < 2) return;

    // Reduce trail size progressively
    if (pointsLazer.length > maxTrailLength) {
        pointsLazer.shift(); // Remove the oldest point from the start
    }

    let opacityFactor = pointsLazer.length / maxTrailLength; // Opacity linked to trail size
    let strokeWidth = Math.max(2, opacityFactor * 4); // Stroke tapers as it fades

    // Apply Rough.js effect with improved fluidity
    let roughStroke = rc.curve(pointsLazer, {
        stroke: `rgba(0, 255, 0, ${opacityFactor})`, // Opacity fades naturally
        strokeWidth: 5,
        roughness: 0.08, // Keeps strokes stable
        bowing: 0.02, // Prevents unwanted wobbliness
        thinning: 0,
        smoothing: 1.8, // More curved, fluid motion
        streamline: 0.75, // Keeps it thick & continuous
    });

    // Remove previous path before adding a new one
    let oldPath = document.getElementById("laserPath");
    if (oldPath) oldPath.remove();

    roughStroke.setAttribute("id", "laserPath");
    svg.appendChild(roughStroke);
}

// Function to smoothly fade out the laser when mouse is up (rear-end fade)
function fadeLaserTrail() {
    function fade() {
        if (pointsLazer.length === 0) return;

        pointsLazer.shift(); // Remove points progressively from the rear

        let opacityFactor = pointsLazer.length / maxTrailLength;
        let strokeWidth = Math.max(2, opacityFactor * 6);

        if (pointsLazer.length > 1) {
            let roughStroke = rc.curve(pointsLazer, {
                stroke: `rgba(0, 250, 0, ${opacityFactor})`,
                strokeWidth: strokeWidth,
                roughness: 0.08,
                bowing: 0.5,
                thinning: 0,
                smoothing: 1.8,
                streamline: 0.75,
            });

            let oldPath = document.getElementById("laserPath");
            if (oldPath) oldPath.remove();

            roughStroke.setAttribute("id", "laserPath");
            svg.appendChild(roughStroke);
        }

        if (pointsLazer.length > 0) {
            requestAnimationFrame(fade); 
        }
    }

    requestAnimationFrame(fade);
}

// Pointer down: Start drawing
svg.addEventListener("pointerdown", (e) => {
    if (!selectedTool.classList.contains("bxs-magic-wand")) return;

    isDrawing = true;
    pointsLazer = [screenToViewBoxPoint(e.clientX, e.clientY)];
    drawLaserStroke();
});

// Pointer move: Draw laser effect with **progressive fading while moving**
svg.addEventListener("pointermove", (e) => {
    if (!isDrawing) return;

    pointsLazer.push(screenToViewBoxPoint(e.clientX, e.clientY));

    drawLaserStroke(); // This now applies rear-end fading continuously
});

// Pointer up: Stop drawing and trigger **rear-end fade-out**
svg.addEventListener("pointerup", () => {
    isDrawing = false;
    fadeLaserTrail();
});

// Pointer leave: Stop drawing
svg.addEventListener("pointerleave", () => {
    isDrawing = false;
});
