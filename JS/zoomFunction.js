function updateZoomDisplay() {
    zoomPercentSpan.innerText = Math.round(currentZoom * 100) + "%";
  }
  
  function updateViewBox(anchorX = null, anchorY = null) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scaledWidth = width / currentZoom;
    const scaledHeight = height / currentZoom;
  
    let centerX, centerY;
  
    if (anchorX === null || anchorY === null) {
      // Use center of current viewBox as anchor if no specific anchor provided
      centerX = currentViewBox.x + (currentViewBox.width / 2);
      centerY = currentViewBox.y + (currentViewBox.height / 2);
    } else {
      // Use provided anchor
      centerX = anchorX;
      centerY = anchorY;
    }
  
    const viewBoxX = centerX - (scaledWidth / 2);
    const viewBoxY = centerY - (scaledHeight / 2);
  
    freehandCanvas.setAttribute(
      "viewBox",
      `${viewBoxX} ${viewBoxY} ${scaledWidth} ${scaledHeight}`
    );
  
    // Update currentViewBox to reflect the new viewBox values.
    currentViewBox.x = viewBoxX;
    currentViewBox.y = viewBoxY;
    currentViewBox.width = scaledWidth;
    currentViewBox.height = scaledHeight;
  }
  
  zoomInBtn.addEventListener("click", function() {
    currentZoom *= 1.1;
    if (currentZoom > maxScale) currentZoom = maxScale;
    updateViewBox(); // Center anchor for button clicks
    updateZoomDisplay();
  });
  
  zoomOutBtn.addEventListener("click", function() {
    currentZoom /= 1.1;
    if (currentZoom < minScale) currentZoom = minScale;
    updateViewBox(); // Center anchor for button clicks
    updateZoomDisplay();
  });
  
  freehandCanvas.addEventListener("wheel", function(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
  
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    currentZoom += delta;
  
    if (currentZoom < minScale) currentZoom = minScale;
    if (currentZoom > maxScale) currentZoom = maxScale;
  
    updateViewBox(e.clientX, e.clientY); // Mouse position anchor for scrolling
    updateZoomDisplay();
  });
  
  // Function to resize the canvas to fill the screen (initial setup)
  function resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
  
    freehandCanvas.style.width = `${width}px`;
    freehandCanvas.style.height = `${height}px`;
  
    // Set initial viewBox based on initial zoom
    updateViewBox(); // Initial center anchor
  }