const strokeColors = document.querySelectorAll(".strokeColors span");
const strokeThicknesses = document.querySelectorAll(".strokeThickness span");
let strokeColor = "#fff";
let strokeThickness = 2;
let points = [];
let currentPath = null;

// Selection and transformation variables
let selectedElement = null;
let transformAnchors = [];
let rotationAnchor = null;
let isDragging = false;
let currentAnchor = null;
let startPoint = { x: 0, y: 0 };
let startTransform = { x: 0, y: 0, width: 0, height: 0, angle: 0 };
let selectionRectangle = null; // Add a variable for the selection rectangle

// Converts a point (x, y) from screen/canvas coordinates to viewBox coordinates.
function screenToViewBoxPoint(x, y) {
    return [
        currentViewBox.x + x / currentZoom,
        currentViewBox.y + y / currentZoom
    ];
}

// Generates an SVG path string from a stroke (an array of [x, y] points).
function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return '';
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[i + 1] || arr[i];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ['M', ...stroke[0], 'Q']
    );
    d.push('Z');
    return d.join(' ');
}

// Creates a new path element with the desired style.
function createNewPathElement() {
    const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    newPath.setAttribute("stroke", strokeColor);
    newPath.setAttribute("fill", "none");
    newPath.setAttribute("stroke-width", strokeThickness);
    newPath.setAttribute("stroke-linecap", "round");
    newPath.setAttribute("stroke-linejoin", "round");
    return newPath;
}

// Renders the current freehand stroke.
function renderStroke() {
    if (!currentPath) return;
    
    const convertedPoints = points.map(([x, y]) => screenToViewBoxPoint(x, y));
    
    const stroke = getStroke(convertedPoints, {
        size: strokeThickness,
        thinning: 0.5,
        smoothing: 0.8,
        streamline: 0.2,
        easing: (t) => t,
        start: {
            taper: 0,
            easing: (t) => t,
            cap: true
        },
        end: {
            taper: 0,
            easing: (t) => t,
            cap: true
        },
        simulatePressure: true
    });
    
    currentPath.setAttribute('d', getSvgPathFromStroke(stroke));
}

// Create transformation anchors
function createTransformAnchors() {
  const anchorSize = 10;
  const anchorStrokeWidth = 2;

    removeTransformAnchors();
    
    if (!selectedElement) return;
    
    const bbox = selectedElement.getBBox();
    const anchors = [
        { x: bbox.x, y: bbox.y }, // top-left
        { x: bbox.x + bbox.width, y: bbox.y }, // top-right
        { x: bbox.x + bbox.width, y: bbox.y + bbox.height }, // bottom-right
        { x: bbox.x, y: bbox.y + bbox.height } // bottom-left
    ];
    
    // Create resize anchors
    transformAnchors = anchors.map((pos, i) => {
      const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      anchor.setAttribute('x', pos.x - anchorSize / 2);
      anchor.setAttribute('y', pos.y - anchorSize / 2);
      anchor.setAttribute('width', anchorSize);
      anchor.setAttribute('height', anchorSize);
      anchor.setAttribute('class', 'anchor');
      anchor.setAttribute('data-index', i);
      anchor.setAttribute('fill', '#121212');
      anchor.setAttribute('stroke', '#5B57D1');
      anchor.setAttribute('stroke-width', anchorStrokeWidth);
      anchor.setAttribute('style', 'pointer-events: all;');
        svg.appendChild(anchor);
        return anchor;
    });
    
    // Create rotation anchor (above the top-center)
    rotationAnchor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    rotationAnchor.setAttribute("cx", bbox.x + bbox.width / 2);
    rotationAnchor.setAttribute("cy", bbox.y - 20 / currentZoom);
    rotationAnchor.setAttribute("r", 6 / currentZoom);
    rotationAnchor.setAttribute('fill', '#121212');
    rotationAnchor.setAttribute('stroke', '#5B57D1');
    rotationAnchor.setAttribute('stroke-width', anchorStrokeWidth);
    rotationAnchor.setAttribute("class", "rotation-anchor");
    rotationAnchor.setAttribute('style', 'pointer-events: all;');
    svg.appendChild(rotationAnchor);
}

// Remove transformation anchors
function removeTransformAnchors() {
    transformAnchors.forEach(anchor => {
        if (anchor.parentNode) {
            anchor.parentNode.removeChild(anchor);
        }
    });
    transformAnchors = [];
    
    if (rotationAnchor && rotationAnchor.parentNode) {
        rotationAnchor.parentNode.removeChild(rotationAnchor);
        rotationAnchor = null;
    }
}

// Select an element
function selectElement(element) {
    if (selectedElement) {
        selectedElement.removeAttribute("data-selected");
    }
    
    selectedElement = element;
    
    if (selectedElement) {
        selectedElement.setAttribute("data-selected", "true");
        createTransformAnchors();

        // Create or update the selection rectangle
        const bbox = selectedElement.getBBox();
        if (!selectionRectangle) {
            selectionRectangle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            selectionRectangle.setAttribute("class", "selection-rectangle");
            selectionRectangle.setAttribute('fill', 'none');
            selectionRectangle.setAttribute('stroke', '#5B57D1');
            selectionRectangle.setAttribute('stroke-width', 1.5);
            selectionRectangle.setAttribute('stroke-dasharray', '4 2');
            selectionRectangle.setAttribute('style', 'pointer-events: none;');
            svg.appendChild(selectionRectangle);
        }
        selectionRectangle.setAttribute("x", bbox.x);
        selectionRectangle.setAttribute("y", bbox.y);
        selectionRectangle.setAttribute("width", bbox.width);
        selectionRectangle.setAttribute("height", bbox.height);
    } else {
        removeTransformAnchors();

        // Remove the selection rectangle if no element is selected
        if (selectionRectangle && selectionRectangle.parentNode) {
            selectionRectangle.parentNode.removeChild(selectionRectangle);
            selectionRectangle = null;
        }
    }
}

// Handle pointer down for selection
function handlePointerDownSelection(e) {
    if (!isSelectionToolActive) return;
    
    const target = e.target;
    
    // Check if clicking on an anchor
    if (target.classList.contains("transform-anchor")) {
        isDragging = true;
        currentAnchor = parseInt(target.getAttribute("data-anchor-index"));
        startPoint = { x: e.clientX, y: e.clientY };
        const bbox = selectedElement.getBBox();
        startTransform = {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height
        };
        return;
    }
    
    if (target.classList.contains("rotation-anchor")) {
        isDragging = true;
        currentAnchor = "rotate";
        startPoint = { x: e.clientX, y: e.clientY };
        const bbox = selectedElement.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        startTransform = {
            angle: Math.atan2(startPoint.y - centerY, startPoint.x - centerX)
        };
        return;
    }
    
    // Check if clicking on a path
    if (target.tagName === "path") {
        selectElement(target);
        isDragging = true;
        currentAnchor = "move";
        startPoint = { x: e.clientX, y: e.clientY };
        const bbox = target.getBBox();
        startTransform = {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height
        };
        return;
    }
    
    // Clicked on empty space - deselect
    selectElement(null);
}

// Handle pointer move for transformation
function handlePointerMoveSelection(e) {
    if (!isSelectionToolActive || !isDragging || !selectedElement) return;
    
    const dx = (e.clientX - startPoint.x) / currentZoom;
    const dy = (e.clientY - startPoint.y) / currentZoom;
    
    if (currentAnchor === "move") {
        // Move the element
        const pathData = selectedElement.getAttribute("d");
        const newPathData = pathData.replace(/([MLQ])([0-9.-]+) ([0-9.-]+)/g, (match, cmd, x, y) => {
            return `${cmd}${parseFloat(x) + dx} ${parseFloat(y) + dy}`;
        });
        selectedElement.setAttribute("d", newPathData);
        
        // Update anchors
        createTransformAnchors();
        startPoint = { x: e.clientX, y: e.clientY };
    } else if (currentAnchor === "rotate") {
        // Rotate the element
        const bbox = selectedElement.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) - startTransform.angle;
        
        const pathData = selectedElement.getAttribute("d");
        const newPathData = pathData.replace(/([MLQ])([0-9.-]+) ([0-9.-]+)/g, (match, cmd, x, y) => {
            const relX = parseFloat(x) - centerX;
            const relY = parseFloat(y) - centerY;
            const rotatedX = relX * Math.cos(angle) - relY * Math.sin(angle) + centerX;
            const rotatedY = relX * Math.sin(angle) + relY * Math.cos(angle) + centerY;
            return `${cmd}${rotatedX} ${rotatedY}`;
        });
        selectedElement.setAttribute("d", newPathData);
        
        // Update anchors
        createTransformAnchors();
    } else if (typeof currentAnchor === "number") {
        // Resize the element
        const bbox = selectedElement.getBBox();
        let newX = startTransform.x;
        let newY = startTransform.y;
        let newWidth = startTransform.width;
        let newHeight = startTransform.height;
        
        switch (currentAnchor) {
            case 0: // top-left
                newX += dx;
                newY += dy;
                newWidth -= dx;
                newHeight -= dy;
                break;
            case 1: // top-right
                newY += dy;
                newWidth += dx;
                newHeight -= dy;
                break;
            case 2: // bottom-right
                newWidth += dx;
                newHeight += dy;
                break;
            case 3: // bottom-left
                newX += dx;
                newWidth -= dx;
                newHeight += dy;
                break;
        }
        
        // Apply scaling transformation
        const scaleX = newWidth / startTransform.width;
        const scaleY = newHeight / startTransform.height;
        
        const pathData = selectedElement.getAttribute("d");
        const newPathData = pathData.replace(/([MLQ])([0-9.-]+) ([0-9.-]+)/g, (match, cmd, x, y) => {
            const scaledX = startTransform.x + (parseFloat(x) - startTransform.x) * scaleX;
            const scaledY = startTransform.y + (parseFloat(y) - startTransform.y) * scaleY;
            return `${cmd}${scaledX} ${scaledY}`;
        });
        selectedElement.setAttribute("d", newPathData);
        
        // Update anchors
        createTransformAnchors();
    }
}

// Handle pointer up for selection
function handlePointerUpSelection(e) {
    isDragging = false;
    currentAnchor = null;
}

// Event listeners for stroke drawing
function handlePointerDownStroke(e) {
    if (isPaintToolActive) {
        points = [[e.clientX, e.clientY, e.pressure]];
        currentPath = createNewPathElement();
        svg.appendChild(currentPath);
        renderStroke();
        svg.addEventListener("pointermove", handlePointerMoveStroke);
    }
}

function handlePointerMoveStroke(e) {
    if (isPaintToolActive) {
        points.push([e.clientX, e.clientY, e.pressure]);
        renderStroke();
    }
}

function handlePointerUpStroke(e) {
    svg.removeEventListener("pointermove", handlePointerMoveStroke);
    if (isPaintToolActive && currentPath) {
        currentPath = null;
    }
    points = [];
}

// Event listeners for selection and transformation
svg.addEventListener('pointerdown', (e) => {
    if (isSelectionToolActive) {
        handlePointerDownSelection(e);
    } else if (isPaintToolActive) {
        handlePointerDownStroke(e);
    }
});

svg.addEventListener('pointermove', (e) => {
    if (isSelectionToolActive) {
        handlePointerMoveSelection(e);
    } else if (isPaintToolActive) {
        handlePointerMoveStroke(e);
    }
});

svg.addEventListener('pointerup', (e) => {
    if (isSelectionToolActive) {
        handlePointerUpSelection(e);
    } else if (isPaintToolActive) {
        handlePointerUpStroke(e);
    }
});

// Color and thickness selection handlers
function handleStrokeColorSelection(event) {
    strokeColors.forEach(s => s.classList.remove("selected"));
    event.target.classList.add("selected");
    strokeColor = event.target.getAttribute("data-id");
    
    if (selectedElement) {
        selectedElement.setAttribute("stroke", strokeColor);
    }
}

function handleStrokeThicknessSelection(event) {
    strokeThicknesses.forEach(t => t.classList.remove("selected"));
    event.target.classList.add("selected");
    strokeThickness = parseInt(event.target.getAttribute("data-id"));
    
    if (selectedElement) {
        selectedElement.setAttribute("stroke-width", strokeThickness);
    }
}

strokeColors.forEach(stroke => stroke.addEventListener("click", handleStrokeColorSelection));
strokeThicknesses.forEach(thickness => thickness.addEventListener("click", handleStrokeThicknessSelection));