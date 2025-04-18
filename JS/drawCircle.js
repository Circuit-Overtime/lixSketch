
import { SelectionManager } from './selectionManager.js';

let circleStartX, circleStartY;
let currentCircle = null; 
let isDrawingCircle = false; 
let circleStrokeColor = "#fff";
let circleFillColor = "#fff";
let circleFillStyle = "transparent";
let circleStrokeThickness = 2;
let circleOutlineStyle = "solid";
let circleColorOptions = document.querySelectorAll(".circleStrokeSpan");
let circleFillColorOptions = document.querySelectorAll(".circleBackgroundSpan");
let circleFillStyleOptions = document.querySelectorAll(".circleFillStyleSpan");
let circleStrokeThicknessValue = document.querySelectorAll(".circleStrokeThickSpan");
let circleOutlineStyleValue = document.querySelectorAll(".circleOutlineStyle");
const selectionManager = new SelectionManager(svg, shapes);

class Circle {
    constructor(centerX, centerY, radiusX, radiusY, options = {}) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.radiusX = radiusX;
        this.radiusY = radiusY;
        this.options = {
            roughness: 1.5,
            stroke: circleStrokeColor,
            strokeWidth: circleStrokeThickness,
            fill: circleFillColor === "transparent" ? "rgba(0,0,0,0)" : circleFillColor,
            fillStyle: circleFillStyle === "transparent" ? 'hachure' : circleFillStyle, // default fillStyle if transparent
            strokeDasharray: circleOutlineStyle === "dashed" ? "10,10" : (circleOutlineStyle === "dotted" ? "2,8" : ""),
            ...options
        };
        this.element = null;
        this.overlay = null; // For event capturing
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false;
        this.anchors = [];
        this.rotationAnchor = null; // Circles don't rotate in the same way, but keep for consistency if needed for grouping later
        this.selectionPadding = 8;
        this.selectionOutline = null;
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

        const roughEllipse = rc.ellipse(this.centerX, this.centerY, this.radiusX * 2, this.radiusY * 2, this.options);
        this.element = roughEllipse;


        // Create an invisible overlay rectangle covering the circle's bounding box for better event handling.
        if (!this.overlay) {
            this.overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            this.overlay.setAttribute("fill", "rgba(0,0,0,0)"); // fully transparent
            this.overlay.style.pointerEvents = "all"; // capture pointer events
        }
        this.overlay.setAttribute("x", this.centerX - this.radiusX);
        this.overlay.setAttribute("y", this.centerY - this.radiusY);
        this.overlay.setAttribute("width", this.radiusX * 2);
        this.overlay.setAttribute("height", this.radiusY * 2);


        this.group.appendChild(roughEllipse);
        this.group.appendChild(this.overlay); // Add overlay to the group

        if (this.isSelected) {
            this.addAnchors();
        }

        svg.appendChild(this.group);
    }

    addAnchors() {
        const anchorSize = 10;
        const anchorStrokeWidth = 2;
        const self = this;

        const expandedX = this.centerX - this.radiusX - this.selectionPadding;
        const expandedY = this.centerY - this.radiusY - this.selectionPadding;
        const expandedWidth = this.radiusX * 2 + 2 * this.selectionPadding;
        const expandedHeight = this.radiusY * 2 + 2 * this.selectionPadding;

        const positions = [
            { x: expandedX, y: expandedY }, // 0 - NW
            { x: expandedX + expandedWidth, y: expandedY }, // 1 - NE
            { x: expandedX, y: expandedY + expandedHeight }, // 2 - SW
            { x: expandedX + expandedWidth, y: expandedY + expandedHeight }, // 3 - SE
            { x: expandedX + expandedWidth / 2, y: expandedY }, // 4 - N-Mid
            { x: expandedX + expandedWidth / 2, y: expandedY + expandedHeight }, // 5 - S-Mid
            { x: expandedX, y: expandedY + expandedHeight / 2 }, // 6 - W-Mid
            { x: expandedX + expandedWidth, y: expandedY + expandedHeight / 2 }  // 7 - E-Mid
        ];

        const anchorDirections = {
            0: 'nwse',
            1: 'nesw',
            2: 'nesw',
            3: 'nwse',
            4: 'ns',
            5: 'ns',
            6: 'ew',
            7: 'ew'
        };

        const outlinePoints = [
            [positions[0].x, positions[0].y],
            [positions[1].x, positions[1].y],
            [positions[3].x, positions[3].y],
            [positions[2].x, positions[2].y],
            [positions[0].x, positions[0].y]
        ];


        this.anchors.forEach(anchor => {
            if (anchor.parentNode === this.group) {
                this.group.removeChild(anchor);
            }
        });
        if (this.rotationAnchor && this.rotationAnchor.parentNode === this.group) {
            this.group.removeChild(this.rotationAnchor);
        }
        this.anchors = [];

        positions.forEach((pos, i) => {
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

            anchor.addEventListener('mouseover', function () {
                const index = parseInt(this.getAttribute('data-index'));
                const baseDirection = anchorDirections[index];
                svg.style.cursor = baseDirection + '-resize'; // No rotation for circle resize cursors for now.
            });

            anchor.addEventListener('mouseout', function () {
                svg.style.cursor = 'default';
            });

            this.group.appendChild(anchor);
            this.anchors[i] = anchor;
        });


        const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        outline.setAttribute('points', pointsAttr);
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#5B57D1');
        outline.setAttribute('stroke-width', 1.5);
        outline.setAttribute('stroke-dasharray', '4 2');
        outline.setAttribute('style', 'pointer-events: none;');
        this.group.appendChild(outline);
        this.selectionOutline = outline;
    }


    contains(x, y) {
        // Check if point (x, y) is inside the ellipse
        const normalizedX = (x - this.centerX) / this.radiusX;
        const normalizedY = (y - this.centerY) / this.radiusY;
        return (normalizedX * normalizedX + normalizedY * normalizedY) <= 1;
    }

    move(dx, dy) {
        this.centerX += dx;
        this.centerY += dy;
        this.draw();
    }

    updatePosition(anchorIndex, newX, newY) {
        const dx = newX - this.centerX;
        const dy = newY - this.centerY;

        switch (anchorIndex) {
            case 0: // NW - adjust both radiusX and radiusY based on NW anchor
                this.radiusX = Math.abs(this.centerX - newX);
                this.radiusY = Math.abs(this.centerY - newY);
                break;
            case 1: // NE - adjust radiusX and radiusY
                this.radiusX = Math.abs(newX - this.centerX);
                this.radiusY = Math.abs(this.centerY - newY);
                break;
            case 2: // SW - adjust radiusX and radiusY
                this.radiusX = Math.abs(this.centerX - newX);
                this.radiusY = Math.abs(newY - this.centerY);
                break;
            case 3: // SE - adjust radiusX and radiusY
                this.radiusX = Math.abs(newX - this.centerX);
                this.radiusY = Math.abs(newY - this.centerY);
                break;
            case 4: // N-Mid - adjust radiusY
                this.radiusY = Math.abs(this.centerY - newY);
                break;
            case 5: // S-Mid - adjust radiusY
                this.radiusY = Math.abs(newY - this.centerY);
                break;
            case 6: // W-Mid - adjust radiusX
                this.radiusX = Math.abs(this.centerX - newX);
                break;
            case 7: // E-Mid - adjust radiusX
                this.radiusX = Math.abs(newX - this.centerX);
                break;
        }
        this.draw();
    }

    rotate(angle) {
        // Circles don't rotate in the same way, but you can keep a rotation property if needed for group rotations later
        // this.rotation = angle;
        // this.draw(); // If you decide to implement rotation effect for groups including circles
    }
}


// --- Modified handleMouseDown, handleMouseMove, handleMouseUp in main script ---

const handleMouseDown = (e) => {
    // console.log(isSelectionToolActive, isSquareToolActive, isCircleToolActive);
   if (isCircleToolActive) {
        circleStartX = e.offsetX;
        circleStartY = e.offsetY;
        isDrawingCircle = true;
        currentCircle = new Circle(circleStartX, circleStartY, 0, 0, { // Initial radius 0
            stroke: circleStrokeColor,
            fill: circleFillColor === "transparent" ? "rgba(0,0,0,0)" : circleFillColor,
            fillStyle: circleFillStyle === "transparent" ? 'hachure' : circleFillStyle,
            strokeWidth: circleStrokeThickness,
            strokeDasharray: circleOutlineStyle === "dashed" ? "10,10" : (circleOutlineStyle === "dotted" ? "2,8" : "")
        });
        shapes.push(currentCircle);
        currentShape = currentCircle; // For selection to work immediately after drawing
    } else if (isSelectionToolActive) {
        selectionManager.handleMouseDown(e);
    }
};

const handleMouseMove = (e) => {
    if (isDrawingCircle && isCircleToolActive && currentCircle) {
        const radiusX = Math.abs(e.offsetX - circleStartX);
        const radiusY = Math.abs(e.offsetY - circleStartY);
        currentCircle.radiusX = radiusX;
        currentCircle.radiusY = radiusY;
        currentCircle.draw();
    } else if (isSelectionToolActive) {
        selectionManager.handleMouseMove(e);
    }
};

const handleMouseUp = (e) => {
    isDrawingCircle = false;
    selectionManager.handleMouseUp(e);
    currentCircle = null; // Reset currentCircle after drawing is complete
};


svg.addEventListener('mousedown', handleMouseDown);
svg.addEventListener('mousemove', handleMouseMove);
svg.addEventListener('mouseup', handleMouseUp);


// --- Color and Style option listeners for Circle ---

circleColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        circleColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleStrokeColor = span.getAttribute("data-id");
        console.log("Selected Circle Stroke Color:", circleStrokeColor);
    });
});

circleFillColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        circleFillColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleFillColor = span.getAttribute("data-id");
        console.log("Selected Circle Fill Color:", circleFillColor);
    });
});

circleFillStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        fillStyleOptions.forEach((el) => el.classList.remove("selected")); //Reusing fillStyleOptions for consistency or create new if needed
        span.classList.add("selected");
        circleFillStyle = span.getAttribute("data-id");
        console.log("Selected Circle Fill Style:", circleFillStyle);
        event.stopPropagation()
    });
});

circleStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        squareStrokeThicknessValue.forEach((el) => el.classList.remove("selected")); //Reusing squareStrokeThicknessValue for consistency or create new if needed
        span.classList.add("selected");
        circleStrokeThickness = parseInt(span.getAttribute("data-id"));
        console.log("Selected Circle Stroke Thickness:", circleStrokeThickness);
        event.stopPropagation()
    });
});

circleOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        squareOutlineStyleValue.forEach((el) => el.classList.remove("selected")); //Reusing squareOutlineStyleValue for consistency or create new if needed
        span.classList.add("selected");
        circleOutlineStyle = span.getAttribute("data-id");
        console.log("Selected Circle Outline Style:", circleOutlineStyle);
        event.stopPropagation();
    });
});