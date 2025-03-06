const svgCanvas = document.getElementById("freehand-canvas");

let selectedElement = null;
let selectionBox = null;
let selectionBoxBounds = null;
let isDragging = false;
let isSelecting = false;
let startDragX, startDragY, startTransform;
let selectionRect = null; // Added missing variable declaration

// Detect click on elements or start selection
svgCanvas.addEventListener("mousedown", (event) => {
    const target = event.target;
    const tag = target.tagName.toLowerCase();
    const svgCoords = screenToSVGCoords(event.clientX, event.clientY);

    // If clicking inside the selection box, move the selected element instead of creating a new selection
    if (selectionBoxBounds &&
        svgCoords.x >= selectionBoxBounds.x &&
        svgCoords.x <= selectionBoxBounds.x + selectionBoxBounds.width &&
        svgCoords.y >= selectionBoxBounds.y &&
        svgCoords.y <= selectionBoxBounds.y + selectionBoxBounds.height) {
        
        if (selectedElement) startDrag(event);
        return;
    }

    if (tag === "rect" || tag === "path" || tag === "image" || target.closest("g[data-type='text-group']")) {
        if (isSelectionToolActive) { 
            selectElement(target.closest("g") || target);
        }
    } else if (tag === "svg") {
        if (isSelectionToolActive) {
            startSelection(event);
            deselectElement();
        }
    }
});

// Start selection rectangle
function startSelection(event) {
    if (!isSelectionToolActive) return;

    isSelecting = true;
    const svgCoords = screenToSVGCoords(event.clientX, event.clientY);
    startDragX = svgCoords.x;
    startDragY = svgCoords.y;

    selectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    selectionRect.setAttribute("x", startDragX);
    selectionRect.setAttribute("y", startDragY);
    selectionRect.setAttribute("width", 0);
    selectionRect.setAttribute("height", 0);
    selectionRect.setAttribute("fill", "rgba(153, 153, 255, 0.3)");
    selectionRect.setAttribute("stroke", "#9999FF");
    selectionRect.setAttribute("stroke-dasharray", "5,5");

    svgCanvas.appendChild(selectionRect);

    svgCanvas.addEventListener("mousemove", updateSelection);
    svgCanvas.addEventListener("mouseup", finishSelection);
}

// Update selection rectangle while dragging
function updateSelection(event) {
    if (!isSelecting) return;

    const svgCoords = screenToSVGCoords(event.clientX, event.clientY);
    let x = Math.min(startDragX, svgCoords.x);
    let y = Math.min(startDragY, svgCoords.y);
    let width = Math.abs(startDragX - svgCoords.x);
    let height = Math.abs(startDragY - svgCoords.y);

    selectionRect.setAttribute("x", x);
    selectionRect.setAttribute("y", y);
    selectionRect.setAttribute("width", width);
    selectionRect.setAttribute("height", height);
}

// Select an element with a selection box
function selectElement(element) {
    if (selectedElement) {
        deselectElement();
    }

    selectedElement = element;

    // Remove previous selection box
    if (selectionBox) {
        svgCanvas.removeChild(selectionBox);
        selectionBox = null;
    }

    // Get bounding box
    const bbox = selectedElement.getBBox();
    
    // Create a selection rectangle around the element
    selectionBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    selectionBox.setAttribute("x", bbox.x - 5);
    selectionBox.setAttribute("y", bbox.y - 5);
    selectionBox.setAttribute("width", bbox.width + 10);
    selectionBox.setAttribute("height", bbox.height + 10);
    selectionBox.setAttribute("fill", "none");
    selectionBox.setAttribute("stroke", "#9A97D9");
    selectionBox.setAttribute("stroke-width", "2");
    selectionBox.setAttribute("stroke-dasharray", "5,5");
    selectionBox.style.pointerEvents = "none"; // Prevents interference with selection

    // Get transform of selected element
    const transform = selectedElement.getAttribute("transform");
    if (transform) {
        selectionBox.setAttribute("transform", transform);
    }

    svgCanvas.appendChild(selectionBox);

    // Update selection box bounds for checking click inside
    selectionBoxBounds = selectionBox.getBBox();

    selectedElement.addEventListener("mousedown", startDrag);
}

// Deselect an element
function deselectElement() {
    if (selectedElement) {
        selectedElement.removeEventListener("mousedown", startDrag);
        selectedElement = null;
    }
    
    if (selectionBox) {
        svgCanvas.removeChild(selectionBox);
        selectionBox = null;
    }
    
    selectionBoxBounds = null;
}

// Start dragging a selected element
function startDrag(event) {
    if (!selectedElement) return;

    isDragging = true;
    startDragX = event.clientX;
    startDragY = event.clientY;
    startTransform = selectedElement.getAttribute("transform") || "translate(0,0)";

    svgCanvas.addEventListener("mousemove", drag);
    svgCanvas.addEventListener("mouseup", stopDrag);
}

// Perform dragging
function drag(event) {
    if (!isDragging || !selectedElement) return;

    const viewBox = svgCanvas.getAttribute("viewBox").split(" ").map(Number);
    const canvasWidth = svgCanvas.clientWidth;
    const canvasHeight = svgCanvas.clientHeight;

    const viewBoxWidth = viewBox[2];
    const viewBoxHeight = viewBox[3];

    const scaleX = viewBoxWidth / canvasWidth;
    const scaleY = viewBoxHeight / canvasHeight;

    let dx = (event.clientX - startDragX) * scaleX;
    let dy = (event.clientY - startDragY) * scaleY;

    let match = startTransform.match(/translate\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
    let prevX = match ? parseFloat(match[1]) : 0;
    let prevY = match ? parseFloat(match[2]) : 0;

    let newTransform = `translate(${prevX + dx}, ${prevY + dy})`;
    selectedElement.setAttribute("transform", newTransform);
    
    // Move the selection box along with the element
    if(selectionBox){
        selectionBox.setAttribute("transform", newTransform);
        // Update selection box bounds after moving
        selectionBoxBounds = selectionBox.getBBox();
    }
}

// Stop dragging
function stopDrag() {
    isDragging = false;
    svgCanvas.removeEventListener("mousemove", drag);
    svgCanvas.removeEventListener("mouseup", stopDrag);

    // Update selection box bounds after moving
    if (selectionBox) {
        selectionBoxBounds = selectionBox.getBBox();
    }
}

// Finish selection and check for elements inside
function finishSelection() {
    isSelecting = false;

    let selectedElements = [];
    let rectBounds = selectionRect.getBBox();

    document.querySelectorAll("#freehand-canvas > g, #freehand-canvas > path, #freehand-canvas > image").forEach((el) => {
        let elBounds = el.getBBox();

        if (
            elBounds.x >= rectBounds.x &&
            elBounds.y >= rectBounds.y &&
            elBounds.x + elBounds.width <= rectBounds.x + rectBounds.width &&
            elBounds.y + elBounds.height <= rectBounds.y + rectBounds.height
        ) {
            selectedElements.push(el);
        }
    });

    svgCanvas.removeChild(selectionRect);
    selectionRect = null;

    if (selectedElements.length > 0) {
        selectedElements.forEach(el => selectElement(el));
    }

    svgCanvas.removeEventListener("mousemove", updateSelection);
    svgCanvas.removeEventListener("mouseup", finishSelection);
}

// Convert screen coordinates to SVG coordinates
function screenToSVGCoords(x, y) {
    let point = svgCanvas.createSVGPoint();
    point.x = x;
    point.y = y;
    return point.matrixTransform(svgCanvas.getScreenCTM().inverse());
}

// Toggle selection tool
function toggleSelectionTool() {
    isSelectionToolActive = !isSelectionToolActive;
    if (!isSelectionToolActive) {
        deselectElement();
    }
    return isSelectionToolActive;
}