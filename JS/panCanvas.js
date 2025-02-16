
freehandCanvas.addEventListener("mousedown", function (e) {
    if (selectedTool.classList.contains("bxs-hand")) { // Check if the hand tool is selected (or whatever your tool identifier is)
        isPanning = true;
        startCanvasX = e.clientX;
        startCanvasY = e.clientY;
        freehandCanvas.style.cursor = 'grabbing'; // Change cursor to indicate grabbing

    }
});

freehandCanvas.addEventListener("mouseup", function (e) {
    isPanning = false;
    freehandCanvas.style.cursor = 'default'; // Reset cursor
});

freehandCanvas.addEventListener("mousemove", function (e) {
    if (!isPanning) return;

    const dx = e.clientX - startCanvasX;
    const dy = e.clientY - startCanvasY;

    // Calculate how much to shift the viewBox based on mouse movement
    const scaleFactor = currentZoom; // Scale factor
    const viewBoxDx = -dx * scaleFactor;
    const viewBoxDy = -dy * scaleFactor;

    // Update the viewBox coordinates
    currentViewBox.x += viewBoxDx;
    currentViewBox.y += viewBoxDy;

    freehandCanvas.setAttribute(
        "viewBox",
        `${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`
    );

    // Update the starting position for the next mousemove event
    startCanvasX = e.clientX;
    startCanvasY = e.clientY;
});

freehandCanvas.addEventListener("mouseleave", function (e) {
    isPanning = false;
    freehandCanvas.style.cursor = 'default';
});

