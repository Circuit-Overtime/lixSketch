
freehandCanvas.addEventListener("mousedown", function (e) {
    if (selectedTool.classList.contains("bxs-hand")) { // Check if the hand tool is selected (or whatever your tool identifier is)
        isPanning = true;
        startCanvasX = e.clientX;
        startCanvasY = e.clientY;
        panStart = { x: e.clientX, y: e.clientY };
        freehandCanvas.style.cursor = 'grabbing'; // Change cursor to indicate grabbing
    }
});


  
  freehandCanvas.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
  
    // Calculate how far the mouse has moved in screen pixels
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
  
    // Convert this movement to viewBox units (using currentZoom)
    // This conversion ensures that panning feels consistent regardless of zoom level.
    const dxViewBox = dx / currentZoom;
    const dyViewBox = dy / currentZoom;
  
    // Update the viewBox position accordingly.
    currentViewBox.x -= dxViewBox;
    currentViewBox.y -= dyViewBox;
  
    freehandCanvas.setAttribute(
      "viewBox",
      `${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`
    );
  
    // Reset the pan start position for the next mouse move event.
    panStart = { x: e.clientX, y: e.clientY };
  });
  
  freehandCanvas.addEventListener("mouseup", () => {
    isPanning = false;
  });


freehandCanvas.addEventListener("mouseleave", function (e) {
    isPanning = false;
    freehandCanvas.style.cursor = 'default';
});

