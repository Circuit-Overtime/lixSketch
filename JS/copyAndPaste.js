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

    deselectAll();

    let pasteCoords = screenToSVGCoords(x, y);
    let pastedElements = [];

    copiedElements.forEach((el, index) => {
        let newElement = el.cloneNode(true);
        let originalCenter = copiedCenters[index];

        let originalSVGCoords = screenToSVGCoords(originalCenter.x, originalCenter.y);

        let translateX = pasteCoords.x - originalSVGCoords.x;
        let translateY = pasteCoords.y - originalSVGCoords.y;

        let transform = `translate(${translateX}, ${translateY})`;

        newElement.setAttribute("transform", transform);
        svgCanvas.appendChild(newElement);
        selectElement(newElement, true);
        pastedElements.push(newElement);
    });

    // Store undo action
    const action = {
        type: ACTION_CREATE,
        elements: pastedElements,
        parent: svgCanvas,
        data: {
            transform: pastedElements.map(el => el.getAttribute('transform')),
        }
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

function undo() {
    if (history.length > 0) {
        const action = history.pop();

        switch (action.type) {
            case ACTION_CREATE:
                action.elements.forEach(el => el.parentElement.removeChild(el));
                break;
            case ACTION_DELETE:
                action.elements.forEach(el => action.parent.appendChild(el));
                break;
            case ACTION_MODIFY:
                action.elements.forEach((el, index) => {
                    el.setAttribute("transform", action.data.transform[index] || "translate(0,0)");
                });
                break;
            default:
                console.warn("Unknown action type:", action.type);
                return;
        }

        redoStack.push(action);
        updateUndoRedoButtons();
        deselectAll();
    }
}

function redo() {
    if (redoStack.length > 0) {
        const action = redoStack.pop();

        switch (action.type) {
            case ACTION_CREATE:
                action.elements.forEach(el => action.parent.appendChild(el));
                break;
            case ACTION_DELETE:
                action.elements.forEach(el => el.parentElement.removeChild(el));
                break;
            case ACTION_MODIFY:
                action.elements.forEach((el, index) => {
                    el.setAttribute("transform", action.data.transform[index] || "translate(0,0)");
                });
                break;
            default:
                console.warn("Unknown action type:", action.type);
                return;
        }

        history.push(action);
        updateUndoRedoButtons();
        deselectAll();
    }
}

function screenToSVGCoords(x, y) {
    let point = svgCanvas.createSVGPoint();
    point.x = x;
    point.y = y;
    return point.matrixTransform(svgCanvas.getScreenCTM().inverse());
}

function updateUndoRedoButtons() {
    undoButton.classList.toggle("disabled", history.length === 0);
    redoButton.classList.toggle("disabled", redoStack.length === 0);
}
