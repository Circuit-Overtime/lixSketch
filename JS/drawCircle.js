
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
const rc = rough.svg(svg); // Initialize RoughSVG with your SVG element
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
        this.rotationAnchor = null;
        this.selectionPadding = 8;
        this.selectionOutline = null;
        this.draw();
    }

    draw() {
        while (this.group.firstChild) {
             // Only remove child nodes that are not anchors or the outline if they exist
            if (!this.group.firstChild.classList || (!this.group.firstChild.classList.contains('anchor') && this.group.firstChild !== this.selectionOutline && this.group.firstChild !== this.rotationAnchor)) {
                 this.group.removeChild(this.group.firstChild);
            } else {
                // If it's an anchor or outline, break the loop assuming shape element is first
                 break;
            }
        }
        // Clear previous shape element if exists
        if(this.element && this.element.parentNode === this.group) {
            this.group.removeChild(this.element);
            this.element = null;
        }
        // Clear previous overlay if exists
        if (this.overlay && this.overlay.parentNode === this.group) {
             this.group.removeChild(this.overlay);
             this.overlay = null;
        }


        // Ensure radii are non-negative before drawing
        const drawRadiusX = Math.max(1, this.radiusX); // Use a small minimum radius
        const drawRadiusY = Math.max(1, this.radiusY);

        const roughEllipse = rc.ellipse(this.centerX, this.centerY, drawRadiusX * 2, drawRadiusY * 2, this.options);
        this.element = roughEllipse;

        // Create an invisible overlay rectangle covering the circle's bounding box for better event handling.
        if (!this.overlay) {
            this.overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            this.overlay.setAttribute("fill", "rgba(0,0,0,0)"); // fully transparent
            this.overlay.style.pointerEvents = "all"; // capture pointer events
            this.overlay.style.cursor = 'move'; // Default cursor for the shape body
        }
        this.overlay.setAttribute("x", this.centerX - drawRadiusX);
        this.overlay.setAttribute("y", this.centerY - drawRadiusY);
        this.overlay.setAttribute("width", drawRadiusX * 2);
        this.overlay.setAttribute("height", drawRadiusY * 2);


        // Insert the shape and overlay at the beginning of the group's children
        // This ensures anchors and outline are drawn on top
        if (this.group.firstChild) {
            this.group.insertBefore(this.overlay, this.group.firstChild);
            this.group.insertBefore(roughEllipse, this.overlay);
        } else {
            this.group.appendChild(roughEllipse);
            this.group.appendChild(this.overlay);
        }


        // Update anchors and outline if selected
        if (this.isSelected) {
            this.addAnchors(); // This will redraw anchors based on new dimensions
        }

        // Ensure group is in the SVG
        if (!this.group.parentNode) {
             svg.appendChild(this.group);
        }
    }


    addAnchors() {
        const anchorSize = 10;
        const anchorStrokeWidth = 2;
        const self = this; // Keep reference to 'this' for event listeners

        // Remove existing anchors and outline first
        this.anchors.forEach(anchor => {
            if (anchor.parentNode === this.group) {
                this.group.removeChild(anchor);
            }
        });
        if (this.rotationAnchor && this.rotationAnchor.parentNode === this.group) {
            this.group.removeChild(this.rotationAnchor);
            this.rotationAnchor = null; // Reset rotation anchor if needed
        }
        if (this.selectionOutline && this.selectionOutline.parentNode === this.group) {
            this.group.removeChild(this.selectionOutline);
            this.selectionOutline = null;
        }
        this.anchors = []; // Reset the anchors array


        // Calculate anchor positions based on current dimensions + padding
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
            0: 'nwse', 1: 'nesw', 2: 'nesw', 3: 'nwse',
            4: 'ns',   5: 'ns',   6: 'ew',   7: 'ew'
        };

        // Create and add new anchors
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
                svg.style.cursor = baseDirection + '-resize';
            });
            anchor.addEventListener('mouseout', function () {
                svg.style.cursor = 'default';
            });

            this.group.appendChild(anchor); // Add anchor to the group
            this.anchors[i] = anchor;       // Store reference
        });


        // Create and add new selection outline
        const outlinePoints = [
            [positions[0].x, positions[0].y], [positions[1].x, positions[1].y],
            [positions[3].x, positions[3].y], [positions[2].x, positions[2].y],
            [positions[0].x, positions[0].y] // Close the polyline
        ];
        const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        outline.setAttribute('points', pointsAttr);
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#5B57D1');
        outline.setAttribute('stroke-width', 1.5);
        outline.setAttribute('stroke-dasharray', '4 2');
        outline.setAttribute('style', 'pointer-events: none;'); // Outline doesn't capture events
        this.group.appendChild(outline);
        this.selectionOutline = outline;
    }


    contains(x, y) {
        // Use non-zero radii for containment check
        const checkRadiusX = Math.max(Number.EPSILON, this.radiusX); // Avoid division by zero
        const checkRadiusY = Math.max(Number.EPSILON, this.radiusY);
        const normalizedX = (x - this.centerX) / checkRadiusX;
        const normalizedY = (y - this.centerY) / checkRadiusY;
        return (normalizedX * normalizedX + normalizedY * normalizedY) <= 1;
    }

    move(dx, dy) {
        this.centerX += dx;
        this.centerY += dy;
        this.draw(); // Redraw calls addAnchors if selected
    }

    // --- NEW updatePosition Method ---
    updatePosition(anchorIndex, newX, newY) {
        // Store original state for calculating fixed points/edges
        const originalCenterX = this.centerX;
        const originalCenterY = this.centerY;
        const originalRadiusX = this.radiusX;
        const originalRadiusY = this.radiusY;

        // Calculate original bounding box corners (without padding)
        const originalNW_X = originalCenterX - originalRadiusX;
        const originalNW_Y = originalCenterY - originalRadiusY;
        const originalSE_X = originalCenterX + originalRadiusX;
        const originalSE_Y = originalCenterY + originalRadiusY;
        const originalNE_X = originalCenterX + originalRadiusX;
        const originalNE_Y = originalCenterY - originalRadiusY;
        const originalSW_X = originalCenterX - originalRadiusX;
        const originalSW_Y = originalCenterY + originalRadiusY;


        let newCenterX = originalCenterX;
        let newCenterY = originalCenterY;
        let newRadiusX = originalRadiusX;
        let newRadiusY = originalRadiusY;

        let fixedX, fixedY, newWidth, newHeight;
        const minSize = 1; // Minimum radius/dimension

        switch (anchorIndex) {
            case 0: // NW anchor dragged to (newX, newY), SE corner fixed
                fixedX = originalSE_X;
                fixedY = originalSE_Y;
                newWidth = Math.max(minSize*2, fixedX - newX); // Ensure minimum width
                newHeight = Math.max(minSize*2, fixedY - newY); // Ensure minimum height
                newRadiusX = newWidth / 2;
                newRadiusY = newHeight / 2;
                newCenterX = fixedX - newRadiusX; // Calculate new center based on fixed SE and new width/height
                newCenterY = fixedY - newRadiusY;
                break;

            case 1: // NE anchor dragged to (newX, newY), SW corner fixed
                fixedX = originalSW_X;
                fixedY = originalSW_Y;
                newWidth = Math.max(minSize*2, newX - fixedX);
                newHeight = Math.max(minSize*2, fixedY - newY);
                newRadiusX = newWidth / 2;
                newRadiusY = newHeight / 2;
                newCenterX = fixedX + newRadiusX;
                newCenterY = fixedY - newRadiusY;
                break;

            case 2: // SW anchor dragged to (newX, newY), NE corner fixed
                fixedX = originalNE_X;
                fixedY = originalNE_Y;
                newWidth = Math.max(minSize*2, fixedX - newX);
                newHeight = Math.max(minSize*2, newY - fixedY);
                newRadiusX = newWidth / 2;
                newRadiusY = newHeight / 2;
                newCenterX = fixedX - newRadiusX;
                newCenterY = fixedY + newRadiusY;
                break;

            case 3: // SE anchor dragged to (newX, newY), NW corner fixed
                fixedX = originalNW_X;
                fixedY = originalNW_Y;
                newWidth = Math.max(minSize*2, newX - fixedX);
                newHeight = Math.max(minSize*2, newY - fixedY);
                newRadiusX = newWidth / 2;
                newRadiusY = newHeight / 2;
                newCenterX = fixedX + newRadiusX;
                newCenterY = fixedY + newRadiusY;
                break;

            case 4: // N-Mid anchor dragged to newY, S edge fixed
                fixedY = originalSE_Y; // Y-coordinate of the South edge
                newHeight = Math.max(minSize*2, fixedY - newY);
                newRadiusY = newHeight / 2;
                newCenterY = fixedY - newRadiusY; // New center Y based on fixed S edge
                // Keep original X center and radius X
                newCenterX = originalCenterX;
                newRadiusX = originalRadiusX;
                break;

            case 5: // S-Mid anchor dragged to newY, N edge fixed
                fixedY = originalNW_Y; // Y-coordinate of the North edge
                newHeight = Math.max(minSize*2, newY - fixedY);
                newRadiusY = newHeight / 2;
                newCenterY = fixedY + newRadiusY; // New center Y based on fixed N edge
                // Keep original X center and radius X
                newCenterX = originalCenterX;
                newRadiusX = originalRadiusX;
                break;

            case 6: // W-Mid anchor dragged to newX, E edge fixed
                fixedX = originalSE_X; // X-coordinate of the East edge
                newWidth = Math.max(minSize*2, fixedX - newX);
                newRadiusX = newWidth / 2;
                newCenterX = fixedX - newRadiusX; // New center X based on fixed E edge
                 // Keep original Y center and radius Y
                newCenterY = originalCenterY;
                newRadiusY = originalRadiusY;
                break;

            case 7: // E-Mid anchor dragged to newX, W edge fixed
                fixedX = originalNW_X; // X-coordinate of the West edge
                newWidth = Math.max(minSize*2, newX - fixedX);
                newRadiusX = newWidth / 2;
                newCenterX = fixedX + newRadiusX; // New center X based on fixed W edge
                // Keep original Y center and radius Y
                newCenterY = originalCenterY;
                newRadiusY = originalRadiusY;
                break;
        }

        // Update the circle's properties
        this.radiusX = newRadiusX;
        this.radiusY = newRadiusY;
        this.centerX = newCenterX;
        this.centerY = newCenterY;

        // Redraw the circle which will also update anchor positions
        this.draw();
    }
     // --- End of NEW updatePosition Method ---


    rotate(angle) {
        // Rotation for ellipses is more complex if not circular.
        // Usually involves transforming the group. Keep this stub.
        // console.log("Rotate called on circle/ellipse - currently no-op");
        // If implementing group rotation later, apply transform here:
        // this.group.setAttribute('transform', `rotate(${angle}, ${this.centerX}, ${this.centerY})`);
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
        const endX = e.offsetX;
        const endY = e.offsetY;

        // Calculate the new center and radius based on drag direction
        const newCenterX = (circleStartX + endX) / 2;
        const newCenterY = (circleStartY + endY) / 2;
        const newRadiusX = Math.abs(endX - circleStartX) / 2;
        const newRadiusY = Math.abs(endY - circleStartY) / 2;

        // Update the circle's properties
        currentCircle.centerX = newCenterX;
        currentCircle.centerY = newCenterY;
        currentCircle.radiusX = newRadiusX;
        currentCircle.radiusY = newRadiusY;

        // Redraw the circle
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