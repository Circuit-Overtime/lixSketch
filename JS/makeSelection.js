const svgCanvas = document.getElementById("freehand-canvas");
let selectionBox = null;
let selectionBoxBounds = null;
let isDragging = false;
let isSelecting = false;
let selectedElements = new Set();
let startDragX, startDragY, startTransforms = new Map();
let selectionRect = null;
let isMultiSelect = false;
let copiedElements = [];
// Detect click on elements or start selection
svgCanvas.addEventListener("mousedown", (event) => {
    const target = event.target;
    const tag = target.tagName.toLowerCase();
    const svgCoords = screenToSVGCoords(event.clientX, event.clientY);

    if (selectionBoxBounds &&
        svgCoords.x >= selectionBoxBounds.x &&
        svgCoords.x <= selectionBoxBounds.x + selectionBoxBounds.width &&
        svgCoords.y >= selectionBoxBounds.y &&
        svgCoords.y <= selectionBoxBounds.y + selectionBoxBounds.height) {

        if (selectedElements.size) startDrag(event);
        return;
    }

    if (tag === "rect" || tag === "path" || tag === "image" || target.closest("g[data-type='text-group']")) {
        if (isSelectionToolActive) {
            if (event.ctrlKey) {
                isMultiSelect = true;
                toggleElementSelection(target.closest("g") || target);
            } else {
                isMultiSelect = false;
                selectElement(target.closest("g") || target);
            }
        }
    } else if (tag === "svg") {
        if (isSelectionToolActive) {
            deselectAll();
            startSelection(event);
        }
    }
});

function toggleElementSelection(element) {
    if (selectedElements.has(element)) {
        deselectElement(element);
    } else {
        selectElement(element, true);
    }
}

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

function selectElement(element, multiple = false) {
    if (!multiple) {
        deselectAll();
    }
    selectedElements.add(element);
    storeTransformData(element);
    drawSelectionBox();
}

function storeTransformData(element) {
    let transform = element.getAttribute("transform") || "translate(0,0)";
    element.setAttribute("data-transform", transform);
}

function getTransformedBBox(element) {
    let bbox = element.getBBox();
    let transform = element.getAttribute("data-transform") || "translate(0,0)";
    let match = transform.match(/translate\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
    let tx = match ? parseFloat(match[1]) : 0;
    let ty = match ? parseFloat(match[2]) : 0;

    return {
        x: bbox.x + tx,
        y: bbox.y + ty,
        width: bbox.width,
        height: bbox.height
    };
}

function deselectElement(element) {
    selectedElements.delete(element);
    drawSelectionBox();
}

function deselectAll() {
    selectedElements.clear();
    if (selectionBox) {
        svgCanvas.removeChild(selectionBox);
        selectionBox = null;
    }
    selectionBoxBounds = null;
}

function drawSelectionBox() {
    if (selectionBox) {
        svgCanvas.removeChild(selectionBox);
    }
    if (selectedElements.size === 0) return;

    const combinedBBox = Array.from(selectedElements).reduce((acc, el) => {
        const bbox = getTransformedBBox(el);
        return {
            x: Math.min(acc.x, bbox.x),
            y: Math.min(acc.y, bbox.y),
            width: Math.max(acc.x + acc.width, bbox.x + bbox.width) - Math.min(acc.x, bbox.x),
            height: Math.max(acc.y + acc.height, bbox.y + bbox.height) - Math.min(acc.y, bbox.y)
        };
    }, getTransformedBBox(selectedElements.values().next().value));

    selectionBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    selectionBox.setAttribute("x", combinedBBox.x - 5);
    selectionBox.setAttribute("y", combinedBBox.y - 5);
    selectionBox.setAttribute("width", combinedBBox.width + 10);
    selectionBox.setAttribute("height", combinedBBox.height + 10);
    selectionBox.setAttribute("fill", "none");
    selectionBox.setAttribute("stroke", "#9A97D9");
    selectionBox.setAttribute("stroke-width", "2");
    selectionBox.setAttribute("stroke-dasharray", "5,5");
    selectionBox.style.pointerEvents = "none";
    selectionBox.id = "selectionBox"

    svgCanvas.appendChild(selectionBox);
    selectionBoxBounds = selectionBox.getBBox();
}


function startDrag(event) {
    if (!selectedElements.size) return;

    isDragging = true;
    startDragX = event.clientX;
    startDragY = event.clientY;

    startTransforms.clear();
    selectedElements.forEach(el => {
        startTransforms.set(el, el.getAttribute("transform") || "translate(0,0)");
    });

    svgCanvas.addEventListener("mousemove", drag);
    svgCanvas.addEventListener("mouseup", stopDrag);
}

function drag(event) {
    if (!isDragging || selectedElements.size === 0) return;

    let dx = event.clientX - startDragX;
    let dy = event.clientY - startDragY;

    selectedElements.forEach(el => {
        let transform = el.getAttribute("data-transform") || "translate(0,0)";
        let match = transform.match(/translate\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
        let newX = dx, newY = dy;

        if (match) {
            newX += parseFloat(match[1]);
            newY += parseFloat(match[2]);
        }

        el.setAttribute("transform", `translate(${newX},${newY})`);
        el.setAttribute("data-transform", `translate(${newX},${newY})`);
    });

    drawSelectionBox();

    startDragX = event.clientX;
    startDragY = event.clientY;
}

function stopDrag() {
    isDragging = false;
    svgCanvas.removeEventListener("mousemove", drag);
    svgCanvas.removeEventListener("mouseup", stopDrag);

    // Collect the initial and final transforms for all selected elements
    let initialTransforms = new Map();
    let finalTransforms = new Map();
    selectedElements.forEach(el => {
        initialTransforms.set(el, startTransforms.get(el) || "translate(0,0)");
        finalTransforms.set(el, el.getAttribute("transform") || "translate(0,0)");
    });

    // Create an action for the transformation
    const action = {
        type: ACTION_MODIFY,
        elements: Array.from(selectedElements),
        data: {
            property: "transform",
            initialTransforms: Object.fromEntries(initialTransforms),
            finalTransforms: Object.fromEntries(finalTransforms)
        }
    };
    history.push(action);
    redoStack = [];
    updateUndoRedoButtons();
}

function finishSelection() {
    isSelecting = false;
    let rectBounds = selectionRect.getBBox();

    document.querySelectorAll("#freehand-canvas > g, #freehand-canvas > path, #freehand-canvas > image").forEach((el) => {
        let elBounds = el.getBBox();

        if (
            elBounds.x >= rectBounds.x &&
            elBounds.y >= rectBounds.y &&
            elBounds.x + elBounds.width <= rectBounds.x + rectBounds.width &&
            elBounds.y + elBounds.height <= rectBounds.y + rectBounds.height
        ) {
            selectElement(el, true);
        }
    });

    svgCanvas.removeChild(selectionRect);
    selectionRect = null;
    svgCanvas.removeEventListener("mousemove", updateSelection);
    svgCanvas.removeEventListener("mouseup", finishSelection);
}

function screenToSVGCoords(x, y) {
    let point = svgCanvas.createSVGPoint();
    point.x = x;
    point.y = y;
    return point.matrixTransform(svgCanvas.getScreenCTM().inverse());
}

function toggleSelectionTool() {
    isSelectionToolActive = !isSelectionToolActive;
    if (!isSelectionToolActive) {
        deselectAll();
    }
    return isSelectionToolActive;
}