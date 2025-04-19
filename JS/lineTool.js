// Update event handlers to use the Line class
let isDrawingLine = false;
let currentLine = null;
let lineStartX = 0;       // Starting X coordinate of the line
let lineStartY = 0;       // Starting Y coordinate of the line
let currentLineGroup = null;    // Reference to the current line element being drawn
let lineColor = "#fff";
let lineStrokeWidth = 3;
let lineStrokeStyle = "solid";
let lineEdgeType = 1;
let lineSktetchRate = 3;

let lineColorOptions = document.querySelectorAll(".lineColor > span");
let lineThicknessOptions = document.querySelectorAll(".lineThicknessSpan");
let lineOutlineOptions = document.querySelectorAll(".lineStyleSpan");
let lineSlopeOptions = document.querySelectorAll(".lineSlopeSpan");
let lineEdgeOptions = document.querySelectorAll(".lineEdgeSpan");
class Line {
    constructor(startPoint, endPoint, options = {}) {
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.options = {
            stroke: options.stroke || lineColor,
            strokeWidth: options.strokeWidth || lineStrokeWidth,
            strokeDasharray: options.lineStrokeStyle === "dashed" ? "5,5" : 
                           (options.lineStrokeStyle === "dotted" ? "2,12" : ""),
            roughness: options.lineSktetchRate || lineSktetchRate,
            bowing: options.lineEdgeType || lineEdgeType,
            ...options
        };
        
        this.element = null;
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false;
        this.anchors = [];
        this.selectionPadding = 8;
        this.selectionOutline = null;
        
        svg.appendChild(this.group);
        this.draw();
    }

    draw() {
        while (this.group.firstChild) {
            this.group.removeChild(this.group.firstChild);
        }

        const rc = rough.svg(svg);
        const line = rc.line(
            this.startPoint.x, this.startPoint.y,
            this.endPoint.x, this.endPoint.y,
            this.options
        );
        
        this.element = line;
        this.group.appendChild(line);

        if (this.isSelected) {
            this.addAnchors();
        }
    }

    addAnchors() {
        const anchorSize = 10 / currentZoom;
        const anchorStrokeWidth = 2 / currentZoom;

        // Create start and end anchors
        [this.startPoint, this.endPoint].forEach((point, index) => {
            const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            anchor.setAttribute('cx', point.x);
            anchor.setAttribute('cy', point.y);
            anchor.setAttribute('r', anchorSize);
            anchor.setAttribute('fill', '#121212');
            anchor.setAttribute('stroke', '#5B57D1');
            anchor.setAttribute('stroke-width', anchorStrokeWidth);
            anchor.setAttribute('class', 'anchor line-anchor');
            anchor.setAttribute('data-index', index);
            anchor.style.cursor = 'grab';
            anchor.style.pointerEvents = 'all';

            this.group.appendChild(anchor);
            this.anchors[index] = anchor;
        });

        // Add selection outline
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        outline.setAttribute('x1', this.startPoint.x);
        outline.setAttribute('y1', this.startPoint.y);
        outline.setAttribute('x2', this.endPoint.x);
        outline.setAttribute('y2', this.endPoint.y);
        outline.setAttribute('stroke', '#5B57D1');
        outline.setAttribute('stroke-width', 1.5 / currentZoom);
        outline.setAttribute('stroke-dasharray', '4,2');
        outline.setAttribute('class', 'selection-outline');
        this.group.appendChild(outline);
        this.selectionOutline = outline;
    }

    contains(x, y) {
        const x1 = this.startPoint.x;
        const y1 = this.startPoint.y;
        const x2 = this.endPoint.x;
        const y2 = this.endPoint.y;
        
        const strokeWidth = this.options.strokeWidth;
        const tolerance = 5 / currentZoom;
        
        // Check if point is near the line segment
        return this.pointToLineDistance(x, y, x1, y1, x2, y2) <= tolerance;
    }

    pointToLineDistance(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    move(dx, dy) {
        this.startPoint.x += dx;
        this.startPoint.y += dy;
        this.endPoint.x += dx;
        this.endPoint.y += dy;
        this.draw();
    }

    updatePosition(anchorIndex, newX, newY) {
        if (anchorIndex === 0) {
            this.startPoint.x = newX;
            this.startPoint.y = newY;
        } else {
            this.endPoint.x = newX;
            this.endPoint.y = newY;
        }
        this.draw();
        this.isSelected = true;
    }
}



const handleMouseDown = (e) => {
    if (!isLineToolActive && !isSelectionToolActive) return;

    const { x, y } = selectionManager.getSVGCoords(e);

    if (isLineToolActive) {
        isDrawingLine = true;
        currentLine = new Line(
            { x, y },
            { x, y },
            {
                stroke: lineColor,
                strokeWidth: lineStrokeWidth,
                lineStrokeStyle: lineStrokeStyle,
                lineEdgeType: lineEdgeType,
                lineSktetchRate: lineSktetchRate
            }
        );
        shapes.push(currentLine);
    } else if (isSelectionToolActive) {
        selectionManager.handleMouseDown(e);
    }
};

const handleMouseMove = (e) => {
    if (isDrawingLine && currentLine) {
        const { x, y } = selectionManager.getSVGCoords(e);
        currentLine.endPoint = { x, y };
        currentLine.draw();
    } else if (isSelectionToolActive) {
        selectionManager.handleMouseMove(e);
    }
};

const handleMouseUp = (e) => {
    if (isDrawingLine) {
        isDrawingLine = false;
        
        // Check if line is too small
        const dx = currentLine.endPoint.x - currentLine.startPoint.x;
        const dy = currentLine.endPoint.y - currentLine.startPoint.y;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq < (5 / currentZoom) ** 2) {
            currentLine.destroy();
            const index = shapes.indexOf(currentLine);
            if (index > -1) shapes.splice(index, 1);
        }
        
        currentLine = null;
    }
    
    selectionManager.handleMouseUp(e);
};


// --- Event Handlers ---


svg.addEventListener("pointerdown", (e) => {
    if (!isLineToolActive) return;

    const CTM = svg.getScreenCTM();
    const startX = (e.clientX - CTM.e) / CTM.a;
    const startY = (e.clientY - CTM.f) / CTM.d;

    currentLine = new Line({ x: startX, y: startY }, { x: startX, y: startY }, {
        stroke: lineColor,
        strokeWidth: lineStrokeWidth,
        strokeStyle: lineStrokeStyle,
        roughness: lineSktetchRate,
        bowing: lineEdgeType
    });
    shapes.push(currentLine);
});

svg.addEventListener("pointermove", (e) => {
    if (!currentLine) return;

    const CTM = svg.getScreenCTM();
    const endX = (e.clientX - CTM.e) / CTM.a;
    const endY = (e.clientY - CTM.f) / CTM.d;

    currentLine.endPoint = { x: endX, y: endY };
    currentLine.draw();
});

svg.addEventListener("pointerup", () => {
    if (currentLine) {
        // Finalize the line
        if (Math.abs(currentLine.startPoint.x - currentLine.endPoint.x) < 1 &&
            Math.abs(currentLine.startPoint.y - currentLine.endPoint.y) < 1) {
            // Remove the line if it's too small
            currentLine.destroy();
            shapes.pop();
        }
        currentLine = null;
    }
});

// --- Style Option Event Listeners ---
lineColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineColor = span.getAttribute("data-id");
        
        if (currentShape instanceof Line && currentShape.isSelected) {
            currentShape.options.stroke = lineColor;
            currentShape.draw();
        }
    });
});
lineThicknessOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineThicknessOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineStrokeWidth = parseInt(span.getAttribute("data-id"));

        if (currentShape instanceof Line && currentShape.isSelected) {
            currentShape.options.strokeWidth = lineStrokeWidth;
            currentShape.draw();
        }
    });
});

lineOutlineOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineOutlineOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineStrokeStyle = span.getAttribute("data-id");

        if (currentShape instanceof Line && currentShape.isSelected) {
            currentShape.options.strokeDasharray = 
                lineStrokeStyle === "dashed" ? "5,5" : 
                (lineStrokeStyle === "dotted" ? "2,12" : "");
            currentShape.draw();
        }
    });
});

lineSlopeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineSlopeOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineSktetchRate = parseFloat(span.getAttribute("data-id"));

        if (currentShape instanceof Line && currentShape.isSelected) {
            currentShape.options.roughness = lineSktetchRate;
            currentShape.draw();
        }
    });
});

lineEdgeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineEdgeOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineEdgeType = parseFloat(span.getAttribute("data-id"));

        if (currentShape instanceof Line && currentShape.isSelected) {
            currentShape.options.bowing = lineEdgeType;
            currentShape.draw();
        }
    });
});
