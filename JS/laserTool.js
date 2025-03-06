let isDrawing = false;
let lastPoint = null;

// Function to create a fading laser stroke between two points
function createLaserStroke(x1, y1, x2, y2) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#00ff87");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("stroke-linecap", "butt");
    line.style.opacity = "1";
    line.style.transition = "opacity 0.3s ease-out"; // Smooth transition
    line.style.filter = "blur(2px)";
    svg.appendChild(line);

    setTimeout(() => {
        line.style.opacity = "0";
        setTimeout(() => {
            if (line.parentNode) {
                svg.removeChild(line);
            }
        }, 300); // Remove after the transition completes
    }, 10);
}

// Activate the laser tool only when the laser tool is selected from the toolbar
svg.addEventListener("pointerdown", (e) => {
    if (!selectedTool.classList.contains("bxs-magic-wand")) return;

    isLaserToolActive = true;
    isDrawing = true;

    // Get the transformation matrix from the SVG to the screen
    const CTM = svg.getScreenCTM();

    // Apply the inverse transformation to the mouse coordinates to get the SVG coordinates
    const x = (e.clientX - CTM.e) / CTM.a;
    const y = (e.clientY - CTM.f) / CTM.d;

    lastPoint = { x: x, y: y };
});

svg.addEventListener("pointermove", (e) => {
    if (!isLaserToolActive || !isDrawing) return;

    // Get the transformation matrix from the SVG to the screen
    const CTM = svg.getScreenCTM();

    // Apply the inverse transformation to the mouse coordinates to get the SVG coordinates
    const x = (e.clientX - CTM.e) / CTM.a;
    const y = (e.clientY - CTM.f) / CTM.d;

    const newPoint = { x: x, y: y };
    if (lastPoint) {
        createLaserStroke(lastPoint.x, lastPoint.y, newPoint.x, newPoint.y);
    }
    lastPoint = newPoint;
});

svg.addEventListener("pointerup", () => {
    isDrawing = false;
    isLaserToolActive = false;
});

svg.addEventListener("pointerleave", () => {
    isDrawing = false;
    isLaserToolActive = false;
});