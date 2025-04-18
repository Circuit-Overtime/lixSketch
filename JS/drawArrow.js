// Assuming svg, rough, currentZoom, currentViewBox, shapes, currentShape,
// isArrowToolActive, isSelectionToolActive are defined elsewhere and initialized.

// --- Keep existing variable declarations ---
let arrowStartX, arrowStartY;
let currentArrow = null; // Keep track of the arrow being drawn
let isResizing = false;  // Is an anchor being dragged?
let isDragging = false;  // Is the whole shape being dragged?
let activeAnchor = null; // Which anchor is being dragged (element)
let isDrawingArrow = false; // Is a new arrow being drawn?
let arrowStrokeColor = "#fff";
let arrowStrokeThickness = 2;
let arrowOutlineStyle = "solid";
let arrowCurved = false;
let arrowCurveAmount = 20;
let arrowHeadLength = 10;
let arrowHeadAngleDeg = 30;
let arrowHeadStyle = "default";
let startX, startY; // Store *SCREEN* coordinates for drag delta calculation

// --- Keep existing style option selectors ---
let arrowStrokeColorOptions = document.querySelectorAll(".arrowStrokeSpan");
let arrowStrokeThicknessValue = document.querySelectorAll(".arrowStrokeThickSpan");
let arrowOutlineStyleValue = document.querySelectorAll(".arrowOutlineStyle");
let arrowTypeStyleValue = document.querySelectorAll(".arrowTypeStyle");
let arrowHeadStyleValue = document.querySelectorAll(".arrowHeadStyleSpan");


class Arrow {
    constructor(startPoint, endPoint, options = {}) {
        this.startPoint = startPoint; // Should be viewBox coordinates
        this.endPoint = endPoint;   // Should be viewBox coordinates
        this.options = {
            stroke: options.stroke || arrowStrokeColor,
            strokeWidth: options.strokeWidth || arrowStrokeThickness,
            strokeDasharray: options.strokeDasharray || (arrowOutlineStyle === "dashed" ? "10,10" : (arrowOutlineStyle === "dotted" ? "2,8" : "")),
            fill: 'none',
        };
        this.arrowHeadStyle = options.arrowHeadStyle || arrowHeadStyle;
        this.arrowHeadLength = options.arrowHeadLength || arrowHeadLength;
        this.arrowHeadAngleDeg = options.arrowHeadAngleDeg || arrowHeadAngleDeg;

        this.element = null;
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false;
        this.anchors = [];
        // Add the group to the SVG *once*
        svg.appendChild(this.group);
        this.draw(); // Initial draw
    }

    draw() {
        // Clear previous contents (path and anchors)
        while (this.group.firstChild) {
            this.group.removeChild(this.group.firstChild);
        }

        // --- Draw the Arrow Line ---
        let pathData = `M ${this.startPoint.x} ${this.startPoint.y} L ${this.endPoint.x} ${this.endPoint.y}`;

        // --- Draw the Arrow Head ---
        if (this.arrowHeadStyle === "default" && !(this.startPoint.x === this.endPoint.x && this.startPoint.y === this.endPoint.y)) {
            const arrowHeadAngleRad = (this.arrowHeadAngleDeg * Math.PI) / 180;
            const angle = Math.atan2(this.endPoint.y - this.startPoint.y, this.endPoint.x - this.startPoint.x);
            const x3 = this.endPoint.x - this.arrowHeadLength * Math.cos(angle - arrowHeadAngleRad);
            const y3 = this.endPoint.y - this.arrowHeadLength * Math.sin(angle - arrowHeadAngleRad);
            const x4 = this.endPoint.x - this.arrowHeadLength * Math.cos(angle + arrowHeadAngleRad);
            const y4 = this.endPoint.y - this.arrowHeadLength * Math.sin(angle + arrowHeadAngleRad);
            pathData += ` M ${x3} ${y3} L ${this.endPoint.x} ${this.endPoint.y} L ${x4} ${y4}`;
        }

        // --- Create and Style the Path Element ---
        const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath.setAttribute("d", pathData);
        arrowPath.setAttribute("stroke", this.isSelected ? "#5B57D1" : this.options.stroke);
        arrowPath.setAttribute("stroke-width", this.options.strokeWidth);
        arrowPath.setAttribute("fill", this.options.fill);
        if(this.options.strokeDasharray) {
             arrowPath.setAttribute("stroke-dasharray", this.options.strokeDasharray);
        } else {
            arrowPath.removeAttribute("stroke-dasharray"); // Ensure it's removed if not dashed/dotted
        }
        arrowPath.setAttribute("stroke-linecap", "round");
        arrowPath.setAttribute("stroke-linejoin", "round");

        this.element = arrowPath;
        this.group.appendChild(this.element); // Add path to the group

        // --- Add or Remove Anchors based on selection ---
        // This now correctly adds/updates or removes anchors every time draw is called
        if (this.isSelected) {
            this.addOrUpdateAnchors();
        } else {
            this.removeAnchors(); // Ensures removal if deselected
        }
    }

    move(dxViewBox, dyViewBox) { // Expecting delta in viewBox coordinates
        this.startPoint.x += dxViewBox;
        this.startPoint.y += dyViewBox;
        this.endPoint.x += dxViewBox;
        this.endPoint.y += dyViewBox;
        this.draw(); // Redraw the arrow and its anchors in the new position
    }

   updatePosition(anchorIndex, newViewBoxX, newViewBoxY) { // Expecting new position in viewBox coordinates
        if (anchorIndex === 0) { // Start anchor
            this.startPoint.x = newViewBoxX;
            this.startPoint.y = newViewBoxY;
        } else if (anchorIndex === 1) { // End anchor
            this.endPoint.x = newViewBoxX;
            this.endPoint.y = newViewBoxY;
        }
        // Simply redraw. The draw() method will handle updating anchor positions correctly.
        this.draw();
   }

    // Combined Add/Update function called by draw() when selected
    addOrUpdateAnchors() {
        const points = [this.startPoint, this.endPoint];
        points.forEach((point, index) => {
            let anchor = this.anchors[index];
            if (!anchor) {
                // Create anchor if it doesn't exist
                anchor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                anchor.setAttribute("r", 6); // Fixed radius in SVG units
                anchor.setAttribute("fill", "#FFFFFF");
                anchor.setAttribute("stroke", "#5B57D1");
                anchor.setAttribute("stroke-width", 1.5);
                anchor.setAttribute("class", "anchor arrow-anchor"); // Add specific class
                anchor.setAttribute("data-index", index);
                anchor.style.cursor = "grab";
                this.group.appendChild(anchor);
                this.anchors[index] = anchor; // Store it
            }
            // Update position regardless of whether it was just created or already existed
            anchor.setAttribute("cx", point.x);
            anchor.setAttribute("cy", point.y);
             // Optionally adjust radius based on zoom here if needed
             // anchor.setAttribute("r", 6 / currentZoom);
        });
    }

    removeAnchors() {
        this.anchors.forEach(anchor => {
            if (anchor && anchor.parentNode === this.group) {
                this.group.removeChild(anchor);
            }
        });
        this.anchors = []; // Clear the array
    }

    // No changes needed in 'contains'
    contains(viewBoxX, viewBoxY) {
        const x1 = this.startPoint.x;
        const y1 = this.startPoint.y;
        const x2 = this.endPoint.x;
        const y2 = this.endPoint.y;
        const x = viewBoxX;
        const y = viewBoxY;

        const strokeWidth = this.options.strokeWidth;
        const tolerance = (strokeWidth / 2) + (5 / currentZoom); // Tolerance in viewbox units, adjust base pixel tolerance by zoom

        const lenSq = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (lenSq === 0) {
            return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2) < tolerance;
        }
        let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const closestX = x1 + t * (x2 - x1);
        const closestY = y1 + t * (y2 - y1);
        const distSq = (x - closestX) ** 2 + (y - closestY) ** 2;
        return distSq < tolerance ** 2;
    }


    // No changes needed in 'updateStyle'
    updateStyle(newOptions) {
        // Handle strokeDasharray explicitly if arrowOutlineStyle is passed
        if (newOptions.arrowOutlineStyle) {
            const style = newOptions.arrowOutlineStyle;
            newOptions.strokeDasharray = style === "dashed" ? "10,10" : (style === "dotted" ? "2,8" : "");
        }
        // Merge options, ensuring explicit null/empty string removes dasharray
        this.options = { ...this.options, ...newOptions };
        if (!this.options.strokeDasharray) {
            delete this.options.strokeDasharray; // Or set to null
        }


        // Update other direct properties if passed
        if (newOptions.stroke !== undefined) this.options.stroke = newOptions.stroke;
        if (newOptions.strokeWidth !== undefined) this.options.strokeWidth = newOptions.strokeWidth;
        if (newOptions.arrowHeadStyle !== undefined) this.arrowHeadStyle = newOptions.arrowHeadStyle;

        this.draw(); // Redraw with new styles
    }

    // No changes needed in 'destroy'
    destroy() {
        if (this.group && this.group.parentNode) {
            this.group.parentNode.removeChild(this.group);
        }
        const index = shapes.indexOf(this);
        if (index > -1) {
            shapes.splice(index, 1);
        }
        if (currentShape === this) {
            currentShape = null;
        }
    }
}

// --- screenToViewBoxPointArrow (keep as is, ensure it's accurate for your setup) ---
function screenToViewBoxPointArrow(screenX, screenY) {
    const pt = svg.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
}

// --- EVENT HANDLERS ---

const handleMouseDown = (e) => {
    const mouseX = e.clientX; // Use clientX/Y for screen coordinates
    const mouseY = e.clientY;
    const viewBoxPoint = screenToViewBoxPointArrow(mouseX, mouseY); // Convert click to viewBox coords

    if (isArrowToolActive) {
        isDrawingArrow = true;
        currentArrow = new Arrow(viewBoxPoint, { ...viewBoxPoint }, {
            stroke: arrowStrokeColor,
            strokeWidth: arrowStrokeThickness,
            arrowOutlineStyle: arrowOutlineStyle, // Pass name, constructor handles dasharray
            arrowHeadStyle: arrowHeadStyle,
        });
        shapes.push(currentArrow);
        // Don't select immediately while drawing
        // currentShape = currentArrow;
    } else if (isSelectionToolActive) {
        startX = mouseX; // Store initial SCREEN coords for drag/resize delta
        startY = mouseY;
        activeAnchor = null;
        isResizing = false;
        isDragging = false;

        // 1. Check anchors of the CURRENTLY selected shape FIRST
        if (currentShape instanceof Arrow && currentShape.isSelected && currentShape.anchors.length > 0) {
             // Use a slightly larger click radius for anchors if needed
            const anchorClickRadius = 8 / currentZoom; // 8 pixel radius adjusted for zoom

            for (let i = 0; i < currentShape.anchors.length; i++) {
                const anchor = currentShape.anchors[i];
                const anchorCX = parseFloat(anchor.getAttribute("cx"));
                const anchorCY = parseFloat(anchor.getAttribute("cy"));
                // Calculate distance in viewBox space
                const distSq = (viewBoxPoint.x - anchorCX) ** 2 + (viewBoxPoint.y - anchorCY) ** 2;

                if (distSq <= anchorClickRadius ** 2) {
                    isResizing = true;
                    activeAnchor = anchor;
                    anchor.style.cursor = 'grabbing';
                    e.stopPropagation();
                    return; // Stop checking after finding an anchor
                }
            }
        }

        // 2. Check if clicked on any shape's body (if no anchor was hit)
        let clickedShape = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
            const shape = shapes[i];
            if (shape instanceof Arrow && shape.contains(viewBoxPoint.x, viewBoxPoint.y)) {
                 clickedShape = shape;
                 break;
            }
            // Add checks for other shape types here
        }

        // 3. Handle selection logic
        if (clickedShape) {
            // If clicking a different shape than the currently selected one
            if (currentShape !== clickedShape) {
                if (currentShape) {
                    currentShape.isSelected = false;
                    currentShape.draw(); // Redraw old shape (removes anchors)
                }
                currentShape = clickedShape;
                currentShape.isSelected = true;
                currentShape.draw(); // Redraw new shape (adds anchors)
            }
             // If clicking the already selected shape (or just selected it)
             // Prepare for dragging the whole shape
            isDragging = true;
            // Set grabbing cursor on body? Maybe not necessary.
            e.stopPropagation();

        } else {
            // Clicked on empty space - deselect
            if (currentShape) {
                currentShape.isSelected = false;
                currentShape.draw(); // Redraw (removes anchors)
                currentShape = null;
            }
            // Potentially initiate canvas panning here
        }
    }
};

const handleMouseMove = (e) => {
    // Optimization: If no relevant action is happening, exit early
    if (!isDrawingArrow && !isResizing && !isDragging) {
        return;
    }

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const currentViewBoxPoint = screenToViewBoxPointArrow(mouseX, mouseY); // Current mouse in viewBox coords

    if (isDrawingArrow && currentArrow) {
        currentArrow.endPoint = currentViewBoxPoint;
        currentArrow.draw();
    } else if (isResizing && currentShape instanceof Arrow && activeAnchor) {
        const anchorIndex = parseInt(activeAnchor.getAttribute("data-index"));
        // Pass the calculated viewBox coordinates directly
        currentShape.updatePosition(anchorIndex, currentViewBoxPoint.x, currentViewBoxPoint.y);
        // Update startX/Y for the *next* move event (important for smooth resizing)
        startX = mouseX;
        startY = mouseY;
    } else if (isDragging && currentShape instanceof Arrow) {
        // --- Corrected Drag Calculation ---
        // 1. Get previous mouse position in viewBox coords (convert startX/Y)
        const previousViewBoxPoint = screenToViewBoxPointArrow(startX, startY);

        // 2. Calculate delta movement in VIEWBOX coordinates
        const dxViewBox = currentViewBoxPoint.x - previousViewBoxPoint.x;
        const dyViewBox = currentViewBoxPoint.y - previousViewBoxPoint.y;

        // 3. Move the shape by the viewBox delta
        currentShape.move(dxViewBox, dyViewBox);

        // 4. Update startX/Y to the current SCREEN coordinates for the next mousemove event
        startX = mouseX;
        startY = mouseY;
        // --- End Corrected Drag Calculation ---
    }
    // Add panning logic here if needed
};

const handleMouseUp = (e) => {
    if (isDrawingArrow && currentArrow) {
        // Optional: Remove arrow if too small (zero length)
        if (Math.hypot(currentArrow.endPoint.x - currentArrow.startPoint.x, currentArrow.endPoint.y - currentArrow.startPoint.y) < 2) {
             currentArrow.destroy();
        } else {
             // Maybe select the arrow after drawing?
             // currentArrow.isSelected = true;
             // currentArrow.draw();
             // currentShape = currentArrow;
        }
        currentArrow = null;
    }

    if (isResizing && activeAnchor) {
         activeAnchor.style.cursor = 'grab'; // Reset cursor
    }
    // Reset dragging cursor if one was set

    // Reset states
    isDrawingArrow = false;
    isResizing = false;
    isDragging = false;
    activeAnchor = null;
    // startX/Y don't need resetting here, they are set on mousedown
};

// --- Attach Listeners ---
// Remove existing ones first to prevent duplicates if this code is run multiple times
svg.removeEventListener('mousedown', handleMouseDown);
document.removeEventListener('mousemove', handleMouseMove); // Use document/window
document.removeEventListener('mouseup', handleMouseUp);   // Use document/window

svg.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);


// --- Style Option Event Listeners (Refined application) ---

const updateSelectedArrowStyle = (styleChanges) => {
    if (currentShape instanceof Arrow && currentShape.isSelected) {
        currentShape.updateStyle(styleChanges);
    }
};

arrowStrokeColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowStrokeColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeColor = span.getAttribute("data-id");
        updateSelectedArrowStyle({ stroke: arrowStrokeColor }); // Pass only the changed property
    });
});

arrowStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeThickness = parseInt(span.getAttribute("data-id"));
        updateSelectedArrowStyle({ strokeWidth: arrowStrokeThickness });
    });
});

arrowOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowOutlineStyle = span.getAttribute("data-id");
        // Pass the style name, let updateStyle handle dasharray logic
        updateSelectedArrowStyle({ arrowOutlineStyle: arrowOutlineStyle });
    });
});

arrowTypeStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowTypeStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowCurved = span.getAttribute("data-id") === 'true';
        // updateSelectedArrowStyle({ isCurved: arrowCurved }); // Needs draw logic update
        // console.log("Curved style selected, but drawing not implemented.");
    });
});

arrowHeadStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowHeadStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowHeadStyle = span.getAttribute("data-id");
        updateSelectedArrowStyle({ arrowHeadStyle: arrowHeadStyle });
    });
});