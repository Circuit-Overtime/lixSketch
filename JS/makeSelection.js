const HANDLE_SIZE = 8; // Resize handle size
let resizeHandles = [];
let isResizing = false;
let currentHandle, originalBBox, startDragX, startDragY, rectElement, groupElement;
const svgCanvas = document.getElementById("freehand-canvas");
let selectionBoxGroup = null; // Group containing selection box and handles
let selectionBox = null;
let isDragging = false, isSelecting = false;
let selectedElements = new Set();


// Convert screen coordinates to SVG coordinates
function screenToSVGCoords(x, y) {
    let point = svgCanvas.createSVGPoint();
    point.x = x;
    point.y = y;
    return point.matrixTransform(svgCanvas.getScreenCTM().inverse());
}

// Element Selection Logic
svgCanvas.addEventListener("mousedown", (event) => {
    const target = event.target;
    const tag = target.tagName.toLowerCase();
    const svgCoords = screenToSVGCoords(event.clientX, event.clientY);

    if (resizeHandles.includes(target)) {
        startResize(event, target);
        return;
    }

    if (tag === "rect" || tag === "path" || tag === "image" || tag === "line" || target.closest("g[data-type='text-group']")) {
        let element = target.closest("g[data-type='square-group']") || target.closest("g[data-type='text-group']") || target;

        if (event.ctrlKey) {
            toggleElementSelection(element);
        } else {
            selectElement(element);
        }
    } else if (tag === "svg") {
        deselectAll();
    }
});

// Select/Deselect Elements
function selectElement(element, multiple = false) {
    if (!multiple) deselectAll();
    selectedElements.add(element);
    storeTransformData(element);
    console.log(element);
    element.classList.add("selectedElement");
    drawSelectionBox();

}

function toggleElementSelection(element) {
    if (selectedElements.has(element)) {
        deselectElement(element);
    } else {
        selectElement(element, true);
    }
}

function deselectElement(element) {
    selectedElements.delete(element);
    drawSelectionBox();
}

function deselectAll() {
    selectedElements.clear();
    removeSelectionBox();
}

// Store Initial Transform Data  (Modified:  Using getCTM())
function storeTransformData(element) {
    const ctm = element.getCTM(); // Get the combined transformation matrix
    element.setAttribute("data-transform-a", ctm.a);
    element.setAttribute("data-transform-b", ctm.b);
    element.setAttribute("data-transform-c", ctm.c);
    element.setAttribute("data-transform-d", ctm.d);
    element.setAttribute("data-transform-e", ctm.e);
    element.setAttribute("data-transform-f", ctm.f);
}

// Remove Selection Box
function removeSelectionBox() {
    if (selectionBoxGroup) {
        svgCanvas.removeChild(selectionBoxGroup);
        selectionBoxGroup = null;
        selectionBox = null;
        resizeHandles = []; // Clear the array as handles are also removed
    }
}

// Draw Selection Box
function drawSelectionBox() {
    removeSelectionBox();
    if (selectedElements.size === 0) return;

    const combinedBBox = getCombinedBBox();

    // Create the group element
    selectionBoxGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    selectionBoxGroup.id = "selectionBoxGroup";

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
    selectionBox.id = "selectionBox";

    selectionBoxGroup.appendChild(selectionBox);

    // Create resize handles and append them to the group
    createResizeHandles(combinedBBox, selectionBoxGroup);

    svgCanvas.appendChild(selectionBoxGroup);
}

// Get Combined Bounding Box for Selected Elements
function getCombinedBBox() {
    if (selectedElements.size === 0) {
        return { x: 0, y: 0, width: 0, height: 0 }; // Or some default.  Important to handle empty case!
    }

    const firstElement = selectedElements.values().next().value;
    let combinedBBox = getTransformedBBox(firstElement);

    for (const el of selectedElements) {
        if (el === firstElement) continue; // Skip the first element we already processed

        const bbox = getTransformedBBox(el);
        combinedBBox = {
            x: Math.min(combinedBBox.x, bbox.x),
            y: Math.min(combinedBBox.y, bbox.y),
            width: Math.max(combinedBBox.x + combinedBBox.width, bbox.x + bbox.width) - Math.min(combinedBBox.x, bbox.x),
            height: Math.max(combinedBBox.y + combinedBBox.height, bbox.y + bbox.height) - Math.min(combinedBBox.y, bbox.y)
        };
    }

    return combinedBBox;
}


// Get Transformed Bounding Box of an Element (Corrected)
function getTransformedBBox(element) {
    let bbox = element.getBBox();
    // Get the stored transformation matrix components
    const a = parseFloat(element.getAttribute("data-transform-a") || 1);
    const b = parseFloat(element.getAttribute("data-transform-b") || 0);
    const c = parseFloat(element.getAttribute("data-transform-c") || 0);
    const d = parseFloat(element.getAttribute("data-transform-d") || 1);
    const e = parseFloat(element.getAttribute("data-transform-e") || 0);
    const f = parseFloat(element.getAttribute("data-transform-f") || 0);

    // Calculate transformed coordinates of the bounding box corners
    const x1 = a * bbox.x + c * bbox.y + e;
    const y1 = b * bbox.x + d * bbox.y + f;
    const x2 = a * (bbox.x + bbox.width) + c * bbox.y + e;
    const y2 = b * (bbox.x + bbox.width) + d * bbox.y + f;
    const x3 = a * (bbox.x + bbox.width) + c * (bbox.y + bbox.height) + e;
    const y3 = b * (bbox.x + bbox.width) + d * (bbox.y + bbox.height) + f;
    const x4 = a * bbox.x + c * (bbox.y + bbox.height) + e;
    const y4 = b * bbox.x + d * (bbox.y + bbox.height) + f;

    // Find the minimum and maximum x and y coordinates
    const minX = Math.min(x1, x2, x3, x4);
    const minY = Math.min(y1, y2, y3, y4);
    const maxX = Math.max(x1, x2, x3, x4);
    const maxY = Math.max(y1, y2, y3, y4);

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}



// Create Resize Handles
function createResizeHandles(combinedBBox, group) {
    removeResizeHandles();
    if (selectedElements.size === 0) return;

    const handlePositions = [
        { x: combinedBBox.x, y: combinedBBox.y, cursor: 'nw-resize', type: 'nw' },
        { x: combinedBBox.x + combinedBBox.width, y: combinedBBox.y, cursor: 'ne-resize', type: 'ne' },
        { x: combinedBBox.x, y: combinedBBox.y + combinedBBox.height, cursor: 'sw-resize', type: 'sw' },
        { x: combinedBBox.x + combinedBBox.width, y: combinedBBox.y + combinedBBox.height, cursor: 'se-resize', type: 'se' },
        { x: combinedBBox.x + combinedBBox.width / 2, y: combinedBBox.y, cursor: 'n-resize', type: 'top' },
        { x: combinedBBox.x + combinedBBox.width / 2, y: combinedBBox.y + combinedBBox.height, cursor: 's-resize', type: 'bottom' },
        { x: combinedBBox.x, y: combinedBBox.y + combinedBBox.height / 2, cursor: 'w-resize', type: 'left' },
        { x: combinedBBox.x + combinedBBox.width, y: combinedBBox.y + combinedBBox.height / 2, cursor: 'e-resize', type: 'right' }
    ];

    handlePositions.forEach(pos => {
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        handle.setAttribute("x", pos.x - HANDLE_SIZE / 2);
        handle.setAttribute("y", pos.y - HANDLE_SIZE / 2);
        handle.setAttribute("width", HANDLE_SIZE);
        handle.setAttribute("height", HANDLE_SIZE);
        handle.setAttribute("fill", "#fff");
        handle.setAttribute("stroke", "#000");
        handle.setAttribute("stroke-width", "1");
        handle.style.cursor = pos.cursor;
        handle.style.pointerEvents = "all";
        handle.dataset.resizeType = pos.type;

        handle.addEventListener("mousedown", (event) => startResize(event, handle));

        group.appendChild(handle); // Append to the group instead of directly to the SVG canvas
        resizeHandles.push(handle);
    });
}

// Remove Existing Resize Handles
function removeResizeHandles() {
    resizeHandles.forEach(handle => {
        if (handle.parentNode) { // Ensure the handle is still in the DOM
            handle.parentNode.removeChild(handle);
        }
    });
    resizeHandles = [];
}


function startResize(event, handle) {
    isResizing = true;
    currentHandle = handle;
    startDragX = event.clientX;
    startDragY = event.clientY;

    originalBBox = {
        x: parseFloat(selectionBox.getAttribute("x")),
        y: parseFloat(selectionBox.getAttribute("y")),
        width: parseFloat(selectionBox.getAttribute("width")),
        height: parseFloat(selectionBox.getAttribute("height"))
    };

    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
}

function resize(event) {
    if (!isResizing) return;

    const currentX = event.clientX;
    const currentY = event.clientY;
    const deltaX = currentX - startDragX;
    const deltaY = currentY - startDragY;

    let newX = originalBBox.x;
    let newY = originalBBox.y;
    let newWidth = originalBBox.width;
    let newHeight = originalBBox.height;

    switch (currentHandle.dataset.resizeType) {
        case 'nw':
            newX = originalBBox.x + deltaX;
            newY = originalBBox.y + deltaY;
            newWidth = originalBBox.width - deltaX;
            newHeight = originalBBox.height - deltaY;
            break;
        case 'ne':
            newY = originalBBox.y + deltaY;
            newWidth = originalBBox.width + deltaX;
            newHeight = originalBBox.height - deltaY;
            break;
        case 'sw':
            newX = originalBBox.x + deltaX;
            newWidth = originalBBox.width - deltaX;
            newHeight = originalBBox.height + deltaY;
            break;
        case 'se':
            newWidth = originalBBox.width + deltaX;
            newHeight = originalBBox.height + deltaY;
            break;
        case 'top':
            newY = originalBBox.y + deltaY;
            newHeight = originalBBox.height - deltaY;
            break;
        case 'bottom':
            newHeight = originalBBox.height + deltaY;
            break;
        case 'left':
            newX = originalBBox.x + deltaX;
            newWidth = originalBBox.width - deltaX;
            break;
        case 'right':
            newWidth = originalBBox.width + deltaX;
            break;
    }

    // Prevent negative width/height
    if (newWidth < 0) {
        newX = newX + newWidth;
        newWidth = Math.abs(newWidth);
        switch (currentHandle.dataset.resizeType) {
            case 'nw': currentHandle.dataset.resizeType = 'ne'; currentHandle.style.cursor = 'ne-resize'; break;
            case 'ne': currentHandle.dataset.resizeType = 'nw'; currentHandle.style.cursor = 'nw-resize'; break;
            case 'sw': currentHandle.dataset.resizeType = 'se'; currentHandle.style.cursor = 'se-resize'; break;
            case 'se': currentHandle.dataset.resizeType = 'sw'; currentHandle.style.cursor = 'sw-resize'; break;
            case 'left': currentHandle.dataset.resizeType = 'right'; currentHandle.style.cursor = 'e-resize'; break;
            case 'right': currentHandle.dataset.resizeType = 'left'; currentHandle.style.cursor = 'w-resize'; break;
        }
    }
    if (newHeight < 0) {
        newY = newY + newHeight;
        newHeight = Math.abs(newHeight);
        switch (currentHandle.dataset.resizeType) {
            case 'nw': currentHandle.dataset.resizeType = 'sw'; currentHandle.style.cursor = 'sw-resize'; break;
            case 'ne': currentHandle.dataset.resizeType = 'se'; currentHandle.style.cursor = 'se-resize'; break;
            case 'sw': currentHandle.dataset.resizeType = 'nw'; currentHandle.style.cursor = 'nw-resize'; break;
            case 'se': currentHandle.dataset.resizeType = 'ne'; currentHandle.style.cursor = 'ne-resize'; break;
            case 'top': currentHandle.dataset.resizeType = 'bottom'; currentHandle.style.cursor = 's-resize'; break;
            case 'bottom': currentHandle.dataset.resizeType = 'top'; currentHandle.style.cursor = 'n-resize'; break;
        }
    }

    selectionBox.setAttribute("x", newX);
    selectionBox.setAttribute("y", newY);
    selectionBox.setAttribute("width", newWidth);
    selectionBox.setAttribute("height", newHeight);

    // Update handle positions based on the new selection box
    updateHandlePositions(newX, newY, newWidth, newHeight);

    //Resize the selected elements
    resizeSelectedElements(newX, newY, newWidth, newHeight);
}

function stopResize() {
    isResizing = false;
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResize);


}

function resizeSelectedElements(newX, newY, newWidth, newHeight) {
    for (let element of selectedElements) {
        // Get the original bounding box
        const originalBBox = getTransformedBBox(element);


        const scaleX = newWidth / originalBBox.width;
        const scaleY = newHeight / originalBBox.height;


        //For Path element
        if (element.tagName === "path") {
            const transform = element.getAttribute('transform') || '';
            const existingScaleX = /scaleX\(([-.\d]+)\)/.exec(transform);
            const existingScaleY = /scaleY\(([-.\d]+)\)/.exec(transform);

            const newScaleX = scaleX;
            const newScaleY = scaleY;

            let newTransform = `scale(${newScaleX}, ${newScaleY})`;
            element.setAttribute('transform', newTransform);

        } else if (element.tagName === "g" && element.dataset.type === "square-group") {
            // Assuming you want to scale the first rectangle in the group
            const rects = element.querySelectorAll("rect");

            for (let rect of rects) {
                if (rect.id === "selectionBox") {
                    continue;
                }

                const originalWidth = parseFloat(rect.getAttribute("width"));
                const originalHeight = parseFloat(rect.getAttribute("height"));
                const originalX = parseFloat(rect.getAttribute("x"));
                const originalY = parseFloat(rect.getAttribute("y"));

                rect.setAttribute("width", originalWidth * scaleX);
                rect.setAttribute("height", originalHeight * scaleY);
                rect.setAttribute("x", originalX * scaleX);
                rect.setAttribute("y", originalY * scaleY);


                storeTransformData(element);
                drawSelectionBox();
                updateHandlePositions(newX, newY, newWidth, newHeight);
            }
        }

    }
}

function updateHandlePositions(x, y, width, height) {
    const handlePositions = [
        { x: x, y: y, cursor: 'nw-resize', type: 'nw' },
        { x: x + width, y: y, cursor: 'ne-resize', type: 'ne' },
        { x: x, y: y + height, cursor: 'sw-resize', type: 'sw' },
        { x: x + width, y: y + height, cursor: 'se-resize', type: 'se' },
        { x: x + width / 2, y: y, cursor: 'n-resize', type: 'top' },
        { x: x + width / 2, y: y + height, cursor: 's-resize', type: 'bottom' },
        { x: x, y: y + height / 2, cursor: 'w-resize', type: 'left' },
        { x: x + width, y: y + height / 2, cursor: 'e-resize', type: 'right' }
    ];

    resizeHandles.forEach((handle, index) => {
        handle.setAttribute("x", handlePositions[index].x - HANDLE_SIZE / 2);
        handle.setAttribute("y", handlePositions[index].y - HANDLE_SIZE / 2);
    });
}