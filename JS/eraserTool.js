// --- Global variables for the eraser tool ---
let isErasing = false;          // Tracks if the user is currently erasing
let lastEraserPoint = null;     // Stores the last pointer position (in client space) for trail effect
let currentEraserTrail = null;  // Stores the current eraser trail for removal
let cursorCircle = null;        // Custom cursor element

// --- Utility function to convert screen coordinates (clientX/clientY)
//     into the correct viewBox coordinates using currentZoom ---
function getTransformedCoordinates(clientX, clientY) {
  const CTM = svg.getScreenCTM();
  return {
    x: currentViewBox.x + ((clientX - CTM.e) / currentZoom),
    y: currentViewBox.y + ((clientY - CTM.f) / currentZoom)
  };
}

// --- Function to create a faint trail for the eraser ---
// Note: This function now uses raw client coordinates so that the trail
// follows the mouse exactly.
function createEraserTrail(clientX1, clientY1, clientX2, clientY2) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", clientX1);
  line.setAttribute("y1", clientY1);
  line.setAttribute("x2", clientX2);
  line.setAttribute("y2", clientY2);
  line.setAttribute("stroke", "rgba(95, 93, 93, 0.48)"); // Faint trail
  line.setAttribute("stroke-width", "10"); // Make it thicker
  line.setAttribute("stroke-linecap", "round");
  line.style.opacity = "1";
  line.style.transition = "opacity 0.2s ease-in-out"; // Adjust transition
  line.style.filter = "blur(5px)";
  svg.appendChild(line);

  // Fade out the line after a short delay
  setTimeout(() => {
    line.style.opacity = "0";
    setTimeout(() => {
      if (line.parentNode) {
        svg.removeChild(line);
      }
    }, 200);
  }, 10);

  return line;
}

// --- Function to handle element removal on pointer up ---
// This uses transformed coordinates to remove elements accurately.
function handleElementRemoval(clientX, clientY) {
  const { x, y } = getTransformedCoordinates(clientX, clientY);

  // Get the element at the current screen position (using client coordinates)
  const element = document.elementFromPoint(clientX, clientY);

  if (element) {
    // Traverse up the DOM tree to find the top-level removable element
    let elementToRemove = element;
    while (elementToRemove && elementToRemove !== svg) {
      if (
        elementToRemove.tagName === "g" ||
        elementToRemove.tagName === "path" ||
        elementToRemove.tagName === "image" ||
        elementToRemove.closest("g[data-type='text-group']")
      ) {
        if (elementToRemove.parentNode === svg) {
          // Ensure we store a valid reference BEFORE removing
          history.push({
            element: elementToRemove,
            parent: elementToRemove.parentNode,
            nextSibling: elementToRemove.nextSibling, // Preserve position for reinsert
          });

          elementToRemove.parentNode.removeChild(elementToRemove);
          deselectAll();
          redoStack = [];
          updateUndoRedoButtons();
          return;
        }
      }
      elementToRemove = elementToRemove.parentNode;
    }
  }
}



// --- Function to create a custom cursor ---
function createCustomCursor() {
  cursorCircle = document.createElement("div");
  cursorCircle.id = "cursorCircle";
  cursorCircle.style.position = "absolute";
  cursorCircle.style.width = "10px";
  cursorCircle.style.height = "10px";
  cursorCircle.style.border = "2px solid #888";
  cursorCircle.style.borderRadius = "50%";
  cursorCircle.style.backgroundColor = "black";
  cursorCircle.style.pointerEvents = "none";
  document.body.appendChild(cursorCircle);
}

// --- Function to remove the custom cursor ---
function removeCustomCursor() {
  if (cursorCircle) {
    document.body.removeChild(cursorCircle);
    cursorCircle = null;
  }
  
}

// --- Event Listeners ---

// Custom cursor following the mouse.
svg.addEventListener("mousemove", (e) => {
  if (isEraserToolActive) {
    svg.style.cursor = "none";
    if (!cursorCircle) {
      createCustomCursor();
    }
    // Keep the custom cursor exactly at the mouse position.
    cursorCircle.style.left = `${e.clientX - 10}px`;
    cursorCircle.style.top = `${e.clientY - 10}px`;
  } else {
    removeCustomCursor();
  }
});

// Pointer down event: begin erasing.
svg.addEventListener("pointerdown", (e) => {
  if (!isEraserToolActive) return;

  isErasing = true;
  // Store raw client coordinates for the trail
  lastEraserPoint = { clientX: e.clientX, clientY: e.clientY };
});

// Pointer move event: draw the eraser trail.
svg.addEventListener("pointermove", (e) => {
  if (!isEraserToolActive || !isErasing) return;

  // Draw the trail using client coordinates so it follows the mouse
  if (lastEraserPoint) {
    currentEraserTrail = createEraserTrail(
      lastEraserPoint.clientX,
      lastEraserPoint.clientY,
      e.clientX,
      e.clientY
    );
  }
  lastEraserPoint = { clientX: e.clientX, clientY: e.clientY };
});

// Pointer up event: remove element and clear trail.
svg.addEventListener("pointerup", (e) => {
  if (!isEraserToolActive) return;

  isErasing = false;
  handleElementRemoval(e.clientX, e.clientY);
  lastEraserPoint = null;
  if (currentEraserTrail) {
    svg.removeChild(currentEraserTrail);
    currentEraserTrail = null;
  }
});

// Pointer leave event: cancel erasing and clear trail.
svg.addEventListener("pointerleave", () => {
  isErasing = false;
  removeCustomCursor();
  lastEraserPoint = null;
  if (currentEraserTrail) {
    svg.removeChild(currentEraserTrail);
    currentEraserTrail = null;
  }
});
