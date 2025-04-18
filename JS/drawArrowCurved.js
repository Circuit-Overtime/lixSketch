// --- Arrow related variables ---
let arrowPoints = [];
let currentArrow = null;
let isDrawingArrow = false; // Flag to track arrow drawing state

let arrowStrokeColor = "#fff";
let arrowStrokeThickness = 2;
let arrowOutlineStyle = "solid";
let arrowHeadStyle = "default";
let arrowHeadLength = 20;
let arrowHeadAngleDeg = 30;
let arrowCurved = true; // Assuming curved arrow is the default based on your handlers

let arrowColorOptions = document.querySelectorAll(".arrowStrokeSpan");
let arrowStrokeThicknessValue = document.querySelectorAll(".arrowStrokeThickSpan");
let arrowOutlineStyleValue = document.querySelectorAll(".arrowOutlineStyle");
let arrowHeadStyleValue = document.querySelectorAll(".arrowHeadStyle");
let arrowHeadLengthValue = document.querySelectorAll(".arrowHeadLength");
let arrowHeadAngleValue = document.querySelectorAll(".arrowHeadAngle");


class Arrow {
    constructor(points, options = {}) {
        this.points = points;
        this.options = {
            stroke: arrowStrokeColor,
            strokeWidth: arrowStrokeThickness,
            roughness: 1,
            strokeDasharray: arrowOutlineStyle === "dashed" ? "10,10" : (arrowOutlineStyle === "dotted" ? "2,8" : ""),
            ...options
        };
        this.arrowHeadStyle = arrowHeadStyle;
        this.arrowHeadLength = arrowHeadLength;
        this.arrowHeadAngleDeg = arrowHeadAngleDeg;
        this.element = null; // Will hold the line path
        this.headElement = null; // Will hold the arrow head shape
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false; // For selection manager if needed later
        this.anchors = []; // For selection manager if needed later
        this.rotationAnchor = null; // For selection manager if needed later
        this.selectionPadding = 8; // For selection manager if needed later
        this.selectionOutline = null; // For selection manager if needed later
        this.draw();
    }

    draw() {
        while (this.group.firstChild) {
            this.group.removeChild(this.group.firstChild);
        }
        if (this.selectionOutline && this.selectionOutline.parentNode === this.group) {
            this.group.removeChild(this.selectionOutline);
            this.selectionOutline = null;
        }

        if (this.points.length < 2) return;

        const rc = rough.svg(svg);

        // 1. Draw the smooth path line
        const d = this.getSmoothPath(this.points);
        const line = rc.path(d, this.options);
        this.element = line;

        // 2. Create and append the arrowhead
        const len = this.points.length;
        const lastPoint = this.points[len - 1];
        const secondLastPoint = this.points[len - 2];
        const angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
        const arrowHead = this.createArrowHead(lastPoint.x, lastPoint.y, angle);
        this.headElement = arrowHead;

        this.group.appendChild(line);
        this.group.appendChild(arrowHead);

        // Store data attributes for undo/redo and potential future manipulations
        this.group.setAttribute('data-points', JSON.stringify(this.points));
        this.group.setAttribute('data-stroke', this.options.stroke);
        this.group.setAttribute('data-strokeWidth', this.options.strokeWidth);
        this.group.setAttribute('data-outlineStyle', arrowOutlineStyle); // Assuming global arrowOutlineStyle
        this.group.setAttribute('data-arrowHeadStyle', this.arrowHeadStyle);
        this.group.setAttribute('data-arrowHeadLength', this.arrowHeadLength);
        this.group.setAttribute('data-arrowHeadAngleDeg', this.arrowHeadAngleDeg);

        this.group.line = line;   // Store the rough element - might not be necessary now
        this.group.arrowHead = arrowHead; // Store the arrow head element - might not be necessary now

        svg.appendChild(this.group);
    }


    createArrowHead(tipX, tipY, angle) {
        const rc = rough.svg(svg);
        const arrowHeadAngleRad = this.arrowHeadAngleDeg * Math.PI / 180;
        let arrowHeadElement;
        let points;

        if (this.arrowHeadStyle === "default") {
            // Default V-shaped arrowhead.
            points = [
                [tipX, tipY],
                [tipX - this.arrowHeadLength * Math.cos(angle - arrowHeadAngleRad), tipY - this.arrowHeadLength * Math.sin(angle - arrowHeadAngleRad)],
                [tipX - this.arrowHeadLength * Math.cos(angle + arrowHeadAngleRad), tipY - this.arrowHeadLength * Math.sin(angle + arrowHeadAngleRad)]
            ];
            arrowHeadElement = rc.polygon(points, {
                fill: this.options.stroke,
                stroke: this.options.stroke,
                strokeWidth: this.options.strokeWidth,
            });

        } else if (this.arrowHeadStyle === "square") {
             // Square arrowhead logic - same as before
            const L = this.arrowHeadLength;
            const v = { x: Math.cos(angle), y: Math.sin(angle) };
            const w = { x: -Math.sin(angle), y: Math.cos(angle) };
            const A = [ tipX + (L/2) * w.x, tipY + (L/2) * w.y ];
            const B = [ tipX - (L/2) * w.x, tipY - (L/2) * w.y ];
            const D = [ tipX + L * v.x + (L/2) * w.x, tipY + L * v.y + (L/2) * w.y ];
            const C = [ tipX + L * v.x - (L/2) * w.x, tipY + L * v.y - (L/2) * w.y ];
            const pointsList = [ A, B, C, D ];

            arrowHeadElement = rc.polygon(pointsList, {
                fill: this.options.stroke,
                stroke: this.options.stroke,
                fillStyle: 'solid',
                strokeWidth: this.options.strokeWidth,
            });

        } else if (this.arrowHeadStyle === "solid") {
            const diameter = this.arrowHeadLength * 1;
            arrowHeadElement = rc.circle(tipX, tipY, diameter, {
                fill: this.options.stroke,
                stroke: this.options.stroke,
                fillStyle: 'solid',
                strokeWidth: 0.8,
            });

        } else if (this.arrowHeadStyle === "outline") {
            const diameter = this.arrowHeadLength * 1.2;
            arrowHeadElement = rc.circle(tipX, tipY, diameter, {
                fill: this.options.stroke,
                stroke: this.options.stroke,
                fillStyle: 'none',
                strokeWidth: 0.2,
            });
        }

        if (arrowOutlineStyle === "dashed") {
            arrowHeadElement.setAttribute("stroke-dasharray", "10,10");
        } else if (arrowOutlineStyle === "dotted") {
            arrowHeadElement.setAttribute("stroke-dasharray", "2,8");
        }

        return arrowHeadElement;
    }


    getSmoothPath(points) {
        if (points.length < 2) return "";
        let d = `M ${points[0].x} ${points[0].y} `;

        if (points.length === 2) {
            d += `L ${points[1].x} ${points[1].y}`;
            return d;
        }

        for (let i = 0; i < points.length - 1; i++) {
            let p0 = i === 0 ? points[i] : points[i - 1];
            let p1 = points[i];
            let p2 = points[i + 1];
            let p3 = i + 2 < points.length ? points[i + 2] : p2;

            let cp1x = p1.x + (p2.x - p0.x) / 12;
            let cp1y = p1.y + (p2.y - p0.y) / 12;
            let cp2x = p2.x - (p3.x - p1.x) / 12;
            let cp2y = p2.y - (p3.y - p1.y) / 12;

            d += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y} `;
        }
        return d;
    }

    // --- Methods for Selection Manager Integration (if needed in future) ---
    contains(x, y) {
        // Basic contains check - might need more sophisticated path hit detection for curves
        // For now, just consider bounding box of points maybe? Or a simplified check.
        return false; // Placeholder - Implement path hit detection if needed for selection
    }

    move(dx, dy) {
        // Implement moving the arrow by adjusting all points
        this.points = this.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        this.draw();
    }

    updatePosition(anchorIndex, newX, newY) {
        // Implement point update for resizing/reshaping if arrows are made resizable
    }

    addAnchors() {
        // Implement anchor points for reshaping/resizing if arrows are made resizable
    }

    rotate(angle) {
        // Implement rotation if needed
    }
}


// --- Modified handleMouseDown, handleMouseMove, handleMouseUp in main script ---

const handleMouseDown = (e) => {
    console.log(isSelectionToolActive, isSquareToolActive, isCircleToolActive, isArrowToolActive);
    if (isSquareToolActive) {
        startX = e.offsetX;
        startY = e.offsetY;
        isDrawingSquare = true;
        currentShape = new Rectangle(startX, startY, 0, 0, { /* ... */ });
        shapes.push(currentShape);
    } else if (isCircleToolActive) {
        circleStartX = e.offsetX;
        circleStartY = e.offsetY;
        isDrawingCircle = true;
        currentCircle = new Circle(circleStartX, circleStartY, 0, 0, { /* ... */ });
        shapes.push(currentCircle);
        currentShape = currentCircle;
    } else if (isArrowToolActive) {
        if (arrowCurved) { // Assuming arrowCurved controls curved arrow drawing
            arrowPoints = [];
            arrowPoints.push({ x: e.offsetX, y: e.offsetY }); // Using offsetX/Y for canvas coords
            isDrawingArrow = true;
            currentArrow = new Arrow(arrowPoints, {
                stroke: arrowStrokeColor,
                strokeWidth: arrowStrokeThickness
                // ... other arrow styles can be passed here if needed at creation time ...
            });
            shapes.push(currentArrow); // Add arrow to shapes array for potential selection
            currentShape = currentArrow; // For potential immediate selection after drawing
        }
    } else if (isSelectionToolActive) {
        selectionManager.handleMouseDown(e);
    }
};


const handleMouseMove = (e) => {
    if (isDrawingSquare && isSquareToolActive && currentShape) {
        currentShape.width = e.offsetX - startX;
        currentShape.height = e.offsetY - startY;
        currentShape.draw();
    } else if (isDrawingCircle && isCircleToolActive && currentCircle) {
        const radiusX = Math.abs(e.offsetX - circleStartX);
        const radiusY = Math.abs(e.offsetY - circleStartY);
        currentCircle.radiusX = radiusX;
        currentCircle.radiusY = radiusY;
        currentCircle.draw();
    } else if (isDrawingArrow && isArrowToolActive && currentArrow && arrowCurved) {
        arrowPoints.push({ x: e.offsetX, y: e.offsetY });
        currentArrow.points = arrowPoints; // Update arrow's points
        currentArrow.draw();
    }
    else if (isSelectionToolActive) {
        selectionManager.handleMouseMove(e);
    }
};

const handleMouseUp = (e) => {
    isDrawingSquare = false;
    isDrawingCircle = false;
    isDrawingArrow = false;
    selectionManager.handleMouseUp(e);
    currentCircle = null;
    currentArrow = null; // Reset currentArrow after drawing is complete
};


svg.addEventListener('mousedown', handleMouseDown);
svg.addEventListener('mousemove', handleMouseMove);
svg.addEventListener('mouseup', handleMouseUp);


// --- Color and Style option listeners for Arrow ---

arrowColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeColor = span.getAttribute("data-id");
        console.log("Selected Arrow Stroke Color:", arrowStrokeColor);
    });
});

arrowStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeThickness = parseInt(span.getAttribute("data-id"));
        console.log("Selected Arrow Stroke Thickness:", arrowStrokeThickness);
        event.stopPropagation()
    });
});

arrowOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowOutlineStyle = span.getAttribute("data-id");
        console.log("Selected Arrow Outline Style:", arrowOutlineStyle);
        event.stopPropagation();
    });
});

arrowHeadStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowHeadStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowHeadStyle = span.getAttribute("data-id");
        console.log("Selected Arrow Head Style:", arrowHeadStyle);
        event.stopPropagation();
    });
});

arrowHeadLengthValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowHeadLengthValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowHeadLength = parseInt(span.getAttribute("data-id"));
        console.log("Selected Arrow Head Length:", arrowHeadLength);
        event.stopPropagation();
    });
});

arrowHeadAngleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowHeadAngleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowHeadAngleDeg = parseInt(span.getAttribute("data-id"));
        console.log("Selected Arrow Head Angle:", arrowHeadAngleDeg);
        event.stopPropagation();
    });
});