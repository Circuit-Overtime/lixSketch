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
let startViewBoxX, startViewBoxY, dragOffsetX, dragOffsetY; // Store initial viewBox coordinates for drag
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
            // Use the passed style name to determine dasharray
            strokeDasharray: options.arrowOutlineStyle === "dashed" ? "10,10" : (options.arrowOutlineStyle === "dotted" ? "2,8" : ""),
            fill: 'none', // Arrows typically aren't filled
            ...options // Allow overriding other defaults
        };
        // Store the style names if needed for later updates
        this.arrowOutlineStyle = options.arrowOutlineStyle || arrowOutlineStyle;
        this.arrowHeadStyle = options.arrowHeadStyle || arrowHeadStyle;

        // Ensure numeric values for calculations
        this.arrowHeadLength = parseFloat(options.arrowHeadLength || arrowHeadLength);
        this.arrowHeadAngleDeg = parseFloat(options.arrowHeadAngleDeg || arrowHeadAngleDeg);

        this.element = null; // The main <path> element
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false; // Add selection state
        this.anchors = [];     // Array to hold anchor elements [startAnchor, endAnchor]

        // Add the group to the SVG *once* during construction
        svg.appendChild(this.group);
        this.draw(); // Initial draw
    }

    draw() {
        // Clear previous contents (path and anchors)
        while (this.group.firstChild) {
            this.group.removeChild(this.group.firstChild);
        }
        this.anchors = []; // Clear anchor references before redraw

        // --- Draw the Arrow Line ---
        let pathData = `M ${this.startPoint.x} ${this.startPoint.y} L ${this.endPoint.x} ${this.endPoint.y}`;

        // --- Draw the Arrow Head ---
        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        const length = Math.sqrt(dx*dx + dy*dy);

        // Only draw arrowhead if length is sufficient and style is default
        if (this.arrowHeadStyle === "default" && length > 0.1) { // Avoid drawing on zero-length lines
            const arrowHeadAngleRad = (this.arrowHeadAngleDeg * Math.PI) / 180;
            const angle = Math.atan2(dy, dx); // Use calculated dx, dy
            const x3 = this.endPoint.x - this.arrowHeadLength * Math.cos(angle - arrowHeadAngleRad);
            const y3 = this.endPoint.y - this.arrowHeadLength * Math.sin(angle - arrowHeadAngleRad);
            const x4 = this.endPoint.x - this.arrowHeadLength * Math.cos(angle + arrowHeadAngleRad);
            const y4 = this.endPoint.y - this.arrowHeadLength * Math.sin(angle + arrowHeadAngleRad);
            // Append arrowhead lines to the main path data
            pathData += ` M ${x3} ${y3} L ${this.endPoint.x} ${this.endPoint.y} L ${x4} ${y4}`;
        }
        // Add more conditions here for other arrowHeadStyle types if needed

        // --- Create and Style the Path Element ---
        const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath.setAttribute("d", pathData);
        // Use selection color if selected, otherwise use base stroke color
        arrowPath.setAttribute("stroke", this.isSelected ? "#5B57D1" : this.options.stroke);
        arrowPath.setAttribute("stroke-width", this.options.strokeWidth);
        arrowPath.setAttribute("fill", this.options.fill); // Usually 'none' for arrows

        // Apply stroke-dasharray if it exists in options
        if (this.options.strokeDasharray) {
             arrowPath.setAttribute("stroke-dasharray", this.options.strokeDasharray);
        } else {
             arrowPath.removeAttribute("stroke-dasharray"); // Ensure removal if solid
        }

        arrowPath.setAttribute("stroke-linecap", "round");
        arrowPath.setAttribute("stroke-linejoin", "round");
        // Add a class for potential CSS targeting or easier selection logic
        arrowPath.classList.add("arrow-path");

        this.element = arrowPath;
        this.group.appendChild(this.element); // Add path to the group

        // --- Add or Remove Anchors based on selection ---
        if (this.isSelected) {
            this.addOrUpdateAnchors();
        }
        // No explicit removeAnchors call needed here, as redraw clears the group
    }

    move(dxViewBox, dyViewBox) {
        this.startPoint.x += dxViewBox;
        this.startPoint.y += dyViewBox;
        this.endPoint.x += dxViewBox;
        this.endPoint.y += dyViewBox;
        this.draw();
    }

    // Method to update one end of the arrow based on anchor drag
    updatePosition(anchorIndex, newViewBoxX, newViewBoxY) {
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

    // Creates or updates anchor elements (called by draw() when selected)
    addOrUpdateAnchors() {
        const points = [this.startPoint, this.endPoint];
        const anchorRadius = 6 / currentZoom; // Make anchor size consistent on screen

        points.forEach((point, index) => {
            // Anchors are cleared in draw(), so we always create new ones here
            const anchor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            anchor.setAttribute("cx", point.x);
            anchor.setAttribute("cy", point.y);
            anchor.setAttribute("r", anchorRadius); // Use dynamic radius
            anchor.setAttribute("fill", "#FFFFFF");
            anchor.setAttribute("stroke", "#5B57D1");
            anchor.setAttribute("stroke-width", 1.5 / currentZoom); // Adjust stroke for zoom
            anchor.setAttribute("class", "anchor arrow-anchor"); // Add specific class
            anchor.setAttribute("data-index", index); // Store index (0 for start, 1 for end)
            anchor.style.cursor = "grab"; // Indicate draggable anchor
            anchor.style.pointerEvents = "all"; // Ensure anchors capture mouse events

            this.group.appendChild(anchor); // Add anchor to the group
            this.anchors[index] = anchor;   // Store reference in the array
        });
    }

    // Method to check if a point (in viewBox coords) is close to the arrow line
    contains(viewBoxX, viewBoxY) {
        const x1 = this.startPoint.x;
        const y1 = this.startPoint.y;
        const x2 = this.endPoint.x;
        const y2 = this.endPoint.y;
        const x = viewBoxX;
        const y = viewBoxY;

        const strokeWidth = this.options.strokeWidth;
        // Tolerance should be based on screen pixels, converted to viewBox units
        const screenPixelTolerance = 5; // e.g., 5 pixels tolerance on screen
        const tolerance = screenPixelTolerance / currentZoom; // Convert to viewBox units

        const lenSq = (x2 - x1) ** 2 + (y2 - y1) ** 2;

        // Handle zero-length lines (check distance to the single point)
        if (lenSq < 0.0001) {
            return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2) < tolerance;
        }

        // Calculate projection of point (x,y) onto the line segment
        let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lenSq;
        t = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1] for line segment

        // Find the closest point on the line segment
        const closestX = x1 + t * (x2 - x1);
        const closestY = y1 + t * (y2 - y1);

        // Calculate distance from the point to the closest point on the segment
        const distSq = (x - closestX) ** 2 + (y - closestY) ** 2;

        // Check if the distance is within the tolerance squared
        return distSq < tolerance ** 2;
    }


    // Update arrow style options and redraw
    updateStyle(newOptions) {
        // Handle specific style name conversions
        if (newOptions.arrowOutlineStyle !== undefined) {
            this.arrowOutlineStyle = newOptions.arrowOutlineStyle; // Store name
            const style = this.arrowOutlineStyle;
            // Update strokeDasharray based on the name
            this.options.strokeDasharray = style === "dashed" ? "10,10" : (style === "dotted" ? "2,8" : "");
        }
        if (newOptions.arrowHeadStyle !== undefined) {
            this.arrowHeadStyle = newOptions.arrowHeadStyle;
        }
        if (newOptions.stroke !== undefined) {
            this.options.stroke = newOptions.stroke;
        }
        if (newOptions.strokeWidth !== undefined) {
            this.options.strokeWidth = parseFloat(newOptions.strokeWidth); // Ensure number
        }

        // Remove undefined properties from newOptions before merging
        Object.keys(newOptions).forEach(key => newOptions[key] === undefined && delete newOptions[key]);

        // Merge remaining options (like direct stroke, strokeWidth)
        this.options = { ...this.options, ...newOptions };

        // Ensure strokeDasharray is removed if outline style becomes solid
        if (this.arrowOutlineStyle === 'solid' && this.options.strokeDasharray) {
             delete this.options.strokeDasharray;
        }


        this.draw(); // Redraw with new styles
    }

    // Destroy the arrow (remove from SVG and shapes array)
    destroy() {
        if (this.group && this.group.parentNode) {
            this.group.parentNode.removeChild(this.group);
        }
        const index = shapes.indexOf(this);
        if (index > -1) {
            shapes.splice(index, 1);
        }
        // If this was the currently selected shape, clear the global reference
        if (currentShape === this) {
            currentShape = null;
        }
    }
}

// --- screenToViewBoxPointArrow (ensure this is accurate for your setup) ---
function screenToViewBoxPointArrow(screenX, screenY) {
    const pt = svg.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
        console.error("SVG CTM not available in screenToViewBoxPointArrow!");
        console.error("svg:", svg); // Log the svg variable itself
        console.trace(); // Print stack trace to see where this is called from
        return { x: screenX, y: screenY }; // Fallback
    }
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
}


// --- EVENT HANDLERS (Modified) ---

const handleMouseDown = (e) => {
    const mouseX = e.clientX; // Use clientX/Y for screen coordinates
    const mouseY = e.clientY;
    const viewBoxPoint = screenToViewBoxPointArrow(mouseX, mouseY); // Convert click to viewBox coords

    // Reset interaction states
    isResizing = false;
    isDragging = false;
    activeAnchor = null;

    if (isArrowToolActive) {
        isDrawingArrow = true;
        // Create arrow with initial zero length at the click point
        currentArrow = new Arrow({ ...viewBoxPoint }, { ...viewBoxPoint }, {
            stroke: arrowStrokeColor,
            strokeWidth: arrowStrokeThickness,
            arrowOutlineStyle: arrowOutlineStyle, // Pass style name
            arrowHeadStyle: arrowHeadStyle,
            // Pass other relevant defaults if needed
        });
        shapes.push(currentArrow);
        // Don't select immediately while drawing
        startX = mouseX; // Store screen coords for drawing delta
        startY = mouseY;
    } 
    
    else if (isSelectionToolActive) {
        startX = mouseX;
        startY = mouseY;
        startViewBoxX = viewBoxPoint.x; // Store initial viewBox coordinates
        startViewBoxY = viewBoxPoint.y;

        let clickedOnSomething = false;

        // Check anchors first
        if (currentShape?.isSelected && currentShape instanceof Arrow) {
            for (let i = 0; i < currentShape.anchors.length; i++) {
                const anchor = currentShape.anchors[i];
                if (e.target === anchor) {
                    isResizing = true;
                    activeAnchor = anchor;
                    clickedOnSomething = true;
                    e.stopPropagation();
                    break;
                }
            }
        }

        // Check shape body
        if (!isResizing) {
            let clickedShape = null;
            for (let i = shapes.length - 1; i >= 0; i--) {
                const shape = shapes[i];
                if (typeof shape.contains === 'function' && shape.contains(viewBoxPoint.x, viewBoxPoint.y)) {
                    if (!(shape.isSelected && shape.anchors?.some(a => e.target === a))) {
                        clickedShape = shape;
                        break;
                    }
                }
            }

            if (clickedShape) {
                clickedOnSomething = true;
                if (currentShape !== clickedShape) {
                    if (currentShape) {
                        currentShape.isSelected = false;
                        currentShape.draw();
                    }
                    currentShape = clickedShape;
                    currentShape.isSelected = true;
                    currentShape.draw();
                }
                isDragging = true;
                
                // Calculate offset between mouse and shape center
                const shapeCenterX = (currentShape.startPoint.x + currentShape.endPoint.x) / 2;
                const shapeCenterY = (currentShape.startPoint.y + currentShape.endPoint.y) / 2;
                dragOffsetX = viewBoxPoint.x - shapeCenterX;
                dragOffsetY = viewBoxPoint.y - shapeCenterY;
                
                svg.style.cursor = 'grabbing';
                e.stopPropagation();
            } else if (!clickedOnSomething && currentShape) {
                currentShape.isSelected = false;
                currentShape.draw();
                currentShape = null;
            }
        }
    }
};


const handleMouseMove = (e) => {
    if (!isDrawingArrow && !isResizing && !isDragging) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const currentViewBoxPoint = screenToViewBoxPointArrow(mouseX, mouseY);

    if (isDrawingArrow && currentArrow) {
        currentArrow.endPoint = currentViewBoxPoint;
        currentArrow.draw();
    } else if (isResizing && currentShape && activeAnchor) {
        const anchorIndex = parseInt(activeAnchor.getAttribute("data-index"));
        currentShape.updatePosition(anchorIndex, currentViewBoxPoint.x, currentViewBoxPoint.y);
    } else if (isDragging && currentShape) {
        // Calculate new position based on current mouse minus initial offset
        const targetX = currentViewBoxPoint.x - dragOffsetX;
        const targetY = currentViewBoxPoint.y - dragOffsetY;
        
        // Calculate current center
        const currentCenterX = (currentShape.startPoint.x + currentShape.endPoint.x) / 2;
        const currentCenterY = (currentShape.startPoint.y + currentShape.endPoint.y) / 2;
        
        // Calculate delta needed to move to target position
        const dx = targetX - currentCenterX;
        const dy = targetY - currentCenterY;
        
        currentShape.move(dx, dy);
    }
};


const handleMouseUp = (e) => {
    if (isDrawingArrow && currentArrow) {
        // Finalize drawing
        // Optional: Remove arrow if too small (zero length)
        const lenSq = (currentArrow.endPoint.x - currentArrow.startPoint.x) ** 2 + (currentArrow.endPoint.y - currentArrow.startPoint.y) ** 2;
        if (lenSq < (2/currentZoom)**2) { // Check against small threshold in viewBox units
             currentArrow.destroy();
             console.log("Arrow too small, removed.");
        } else {
             // Keep the arrow, maybe select it?
             // currentArrow.isSelected = true;
             // currentArrow.draw();
             // currentShape = currentArrow;
        }
        currentArrow = null; // Reset arrow being drawn
    }

    if (isResizing && activeAnchor) {
         activeAnchor.style.cursor = 'grab'; // Reset anchor cursor
    }
    if (isDragging) {
         svg.style.cursor = currentShape?.isSelected ? 'grab' : 'default'; // Reset main cursor
    }

    // Reset states
    isDrawingArrow = false;
    isResizing = false;
    isDragging = false;
    activeAnchor = null;
    // startX/Y don't need resetting here, they are set on mousedown
};


// --- Attach Listeners ---
// Ensure listeners are attached correctly to the appropriate elements
// Using document for mousemove/mouseup is generally recommended for dragging
svg.removeEventListener('mousedown', handleMouseDown);
document.removeEventListener('mousemove', handleMouseMove);
document.removeEventListener('mouseup', handleMouseUp);

svg.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);


// --- Style Option Event Listeners (Keep the refined application logic) ---

const updateSelectedArrowStyle = (styleChanges) => {
    // Check if currentShape exists and is an Arrow instance before updating
    if (currentShape instanceof Arrow && currentShape.isSelected) {
        currentShape.updateStyle(styleChanges);
    } else {
         // console.log("No selected arrow to apply style changes to.");
         // Optionally update the default variables (arrowStrokeColor etc.)
         // so the *next* arrow drawn uses the new style.
         if (styleChanges.stroke !== undefined) arrowStrokeColor = styleChanges.stroke;
         if (styleChanges.strokeWidth !== undefined) arrowStrokeThickness = styleChanges.strokeWidth;
         if (styleChanges.arrowOutlineStyle !== undefined) arrowOutlineStyle = styleChanges.arrowOutlineStyle;
         if (styleChanges.arrowHeadStyle !== undefined) arrowHeadStyle = styleChanges.arrowHeadStyle;
    }
};

// Re-attach or ensure these listeners are correctly set up
arrowStrokeColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowStrokeColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const newColor = span.getAttribute("data-id");
        updateSelectedArrowStyle({ stroke: newColor }); // Update selected or defaults
    });
});

arrowStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const newThickness = parseInt(span.getAttribute("data-id"));
        updateSelectedArrowStyle({ strokeWidth: newThickness });
    });
});

arrowOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const newStyle = span.getAttribute("data-id");
        updateSelectedArrowStyle({ arrowOutlineStyle: newStyle }); // Pass style name
    });
});

// Keep arrowTypeStyleValue and arrowHeadStyleValue listeners similar, calling updateSelectedArrowStyle
arrowTypeStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowTypeStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const isCurved = span.getAttribute("data-id") === 'true';
        // updateSelectedArrowStyle({ isCurved: isCurved }); // Needs draw logic update
        console.warn("Curved arrow style selection not implemented in draw logic.");
    });
});

arrowHeadStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowHeadStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const newHeadStyle = span.getAttribute("data-id");
        updateSelectedArrowStyle({ arrowHeadStyle: newHeadStyle });
    });
});