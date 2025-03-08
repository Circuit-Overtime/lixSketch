let lastMouseX = 0;
let lastMouseY = 0;
let copiedCenters = [];

document.addEventListener("mousemove", (event) => {
    if (!isSelectionToolActive) return;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
});

document.addEventListener("keydown", (event) => {
    if (!isSelectionToolActive) return;

    if (event.ctrlKey && event.key === "c") {
        copySelectedElements();
    } else if (event.ctrlKey && event.key === "v") {
        console.log("Pasting at:", lastMouseX, lastMouseY);
        pasteCopiedElements(lastMouseX, lastMouseY);
    } else if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelectedElements();
    }
});

function copySelectedElements() {
    if (!selectedElements.size) return;

    copiedElements = [];
    copiedCenters = [];

    selectedElements.forEach(el => {
        copiedElements.push(el.cloneNode(true));

        // Get bounding box and calculate center
        let rect = el.getBoundingClientRect();
        let centerX = rect.left + rect.width / 2;
        let centerY = rect.top + rect.height / 2;

        copiedCenters.push({ x: centerX, y: centerY });

        console.log(`Copied Center X: ${centerX}, Center Y: ${centerY}`);
    });
}

function pasteCopiedElements(x, y) {
    if (!copiedElements.length) return;

    deselectAll(); // Deselect all before pasting

    let pasteCoords = screenToSVGCoords(x, y); // Convert mouse position to SVG coordinates
    let pastedElements = []; // Track pasted elements for undo action

    copiedElements.forEach((el, index) => {
        let newElement = el.cloneNode(true);
        let originalCenter = copiedCenters[index];

        // Convert original center to SVG coordinates
        let originalSVGCoords = screenToSVGCoords(originalCenter.x, originalCenter.y);

        // Calculate translation needed
        let translateX = pasteCoords.x - originalSVGCoords.x;
        let translateY = pasteCoords.y - originalSVGCoords.y;

        let transform = `translate(${translateX}, ${translateY})`;

        newElement.setAttribute("transform", transform);
        svgCanvas.appendChild(newElement);
        selectElement(newElement, true);
        pastedElements.push(newElement); // Track new elements
    });

    // Store paste action for undo/redo
    const action = {
        type: ACTION_PASTE,
        elements: pastedElements, // Store the new elements
        parent: svgCanvas, // Parent is the canvas, so it can be removed easily
    };

    history.push(action);
    redoStack = [];
    updateUndoRedoButtons();
}


function deleteSelectedElements() {
    if (!selectedElements.size) return;

    const deletedElements = Array.from(selectedElements);
    const action = {
        type: ACTION_DELETE,
        elements: deletedElements,
        parent: svgCanvas,
        data: {
            transform: deletedElements.map(el => el.getAttribute('transform')),
        }
    };
    history.push(action);
    redoStack = [];
    updateUndoRedoButtons();

    selectedElements.forEach(element => {
        svgCanvas.removeChild(element);
    });
    deselectAll();
}


function screenToSVGCoords(x, y) {
    let point = svgCanvas.createSVGPoint();
    point.x = x;
    point.y = y;
    return point.matrixTransform(svgCanvas.getScreenCTM().inverse());
}

