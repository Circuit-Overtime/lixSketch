import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction, pushFrameAttachmentAction  } from './undoAndRedo.js';

let arrowStartX, arrowStartY;
let currentArrow = null;
let isResizing = false;
let isDragging = false;
let activeAnchor = null;
let isDrawingArrow = false;
let arrowStrokeColor = "#fff";
let arrowStrokeThickness = 2;
let arrowOutlineStyle = "solid";
let arrowCurved = true;
let arrowCurveAmount = 20;
let arrowHeadLength = 10;
let arrowHeadAngleDeg = 30;
let arrowHeadStyle = "default";
let startX, startY;
let dragOldPosArrow = null;
let copiedShapeData = null;
let draggedShapeInitialFrameArrow = null;
let hoveredFrameArrow = null;
let arrowStrokeColorOptions = document.querySelectorAll(".arrowStrokeSpan");
let arrowStrokeThicknessValue = document.querySelectorAll(".arrowStrokeThickSpan");
let arrowOutlineStyleValue = document.querySelectorAll(".arrowOutlineStyle");
let arrowTypeStyleValue = document.querySelectorAll(".arrowTypeStyle");
let arrowHeadStyleValue = document.querySelectorAll(".arrowHeadStyleSpan");

// Add coordinate conversion function like in lineTool.js
function getSVGCoordsFromMouse(e) {
    const viewBox = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
    const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;
    return { x: svgX, y: svgY };
}

class Arrow {
    constructor(startPoint, endPoint, options = {}) {
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.options = {
            stroke: options.stroke || arrowStrokeColor,
            strokeWidth: options.strokeWidth || arrowStrokeThickness,
            strokeDasharray: options.arrowOutlineStyle === "dashed" ? "10,10" : (options.arrowOutlineStyle === "dotted" ? "2,8" : ""),
            fill: 'none',
            ...options
        };
        this.arrowOutlineStyle = options.arrowOutlineStyle || arrowOutlineStyle;
        this.arrowHeadStyle = options.arrowHeadStyle || arrowHeadStyle;
        this.arrowHeadLength = parseFloat(options.arrowHeadLength || arrowHeadLength);
        this.arrowHeadAngleDeg = parseFloat(options.arrowHeadAngleDeg || arrowHeadAngleDeg);
        this.arrowCurved = options.arrowCurved !== undefined ? options.arrowCurved : arrowCurved;
        this.arrowCurveAmount = options.arrowCurveAmount || arrowCurveAmount;

        // Control points for curved arrows
        this.controlPoint1 = options.controlPoint1 || null;
        this.controlPoint2 = options.controlPoint2 || null;


        this.attachedToStart = null;
        this.attachedToEnd = null;
        this.parentFrame = null;
        this.element = null;
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false;
        this.anchors = [];
        this.shapeName = "arrow";
        this.shapeID = `arrow-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;
        this.group.setAttribute('id', this.shapeID);

        // Initialize control points if curved
        if (this.arrowCurved && !this.controlPoint1 && !this.controlPoint2) {
            this.initializeCurveControlPoints();
        }

        

        svg.appendChild(this.group);
        this.draw();
    }

    get x() {
    return Math.min(this.startPoint.x, this.endPoint.x);
    }

    set x(value) {
        const currentX = this.x;
        const dx = value - currentX;
        this.startPoint.x += dx;
        this.endPoint.x += dx;
        if (this.controlPoint1) this.controlPoint1.x += dx;
        if (this.controlPoint2) this.controlPoint2.x += dx;
    }

    get y() {
        return Math.min(this.startPoint.y, this.endPoint.y);
    }

    set y(value) {
        const currentY = this.y;
        const dy = value - currentY;
        this.startPoint.y += dy;
        this.endPoint.y += dy;
        if (this.controlPoint1) this.controlPoint1.y += dy;
        if (this.controlPoint2) this.controlPoint2.y += dy;
    }

    get width() {
        return Math.abs(this.endPoint.x - this.startPoint.x);
    }

    set width(value) {
        const centerX = (this.startPoint.x + this.endPoint.x) / 2;
        const halfWidth = value / 2;
        this.startPoint.x = centerX - halfWidth;
        this.endPoint.x = centerX + halfWidth;
    }

    get height() {
        return Math.abs(this.endPoint.y - this.startPoint.y);
    }

    set height(value) {
        const centerY = (this.startPoint.y + this.endPoint.y) / 2;
        const halfHeight = value / 2;
        this.startPoint.y = centerY - halfHeight;
        this.endPoint.y = centerY + halfHeight;
    }

    initializeCurveControlPoints() {
        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0 || isNaN(distance)) {
            this.controlPoint1 = { x: this.startPoint.x + 20, y: this.startPoint.y };
            this.controlPoint2 = { x: this.endPoint.x - 20, y: this.endPoint.y };
            return;
        }

        const perpX = -dy / distance;
        const perpY = dx / distance;
        const curveOffset = this.arrowCurveAmount;

        const t1 = 0.33;
        const point1X = this.startPoint.x + t1 * dx;
        const point1Y = this.startPoint.y + t1 * dy;
        this.controlPoint1 = {
            x: point1X + perpX * curveOffset,
            y: point1Y + perpY * curveOffset
        };

        const t2 = 0.67;
        const point2X = this.startPoint.x + t2 * dx;
        const point2Y = this.startPoint.y + t2 * dy;
        this.controlPoint2 = {
            x: point2X - perpX * curveOffset,
            y: point2Y - perpY * curveOffset
        };
    }

    selectArrow() {
        this.isSelected = true;
        this.draw();
    }

    removeSelection() {
        this.anchors.forEach(anchor => {
             if (anchor.parentNode === this.group) {
                 this.group.removeChild(anchor);
             }
         });
        this.anchors = [];
        this.isSelected = false;
    }

    attachToShape(isStartPoint, shape, attachment) {
        if (isStartPoint) {
            this.attachedToStart = {
                shape: shape,
                side: attachment.side,
                offset: attachment.offset
            };
            this.startPoint = attachment.point;
        } else {
            this.attachedToEnd = {
                shape: shape,
                side: attachment.side,
                offset: attachment.offset
            };
            this.endPoint = attachment.point;
        }

        // Update control points if curved
        if (this.arrowCurved) {
            this.initializeCurveControlPoints();
        }

        this.draw();
    }

    draw() {
        while (this.group.firstChild) {
            this.group.removeChild(this.group.firstChild);
        }
        this.anchors = [];

        let pathData;
        let arrowEndPoint = this.endPoint;

        if (this.arrowCurved && this.controlPoint1 && this.controlPoint2) {
            if (isNaN(this.controlPoint1.x) || isNaN(this.controlPoint1.y) ||
                isNaN(this.controlPoint2.x) || isNaN(this.controlPoint2.y)) {
                this.initializeCurveControlPoints();
            }

            pathData = `M ${this.startPoint.x} ${this.startPoint.y} ` +
                      `C ${this.controlPoint1.x} ${this.controlPoint1.y}, ` +
                      `${this.controlPoint2.x} ${this.controlPoint2.y}, ` +
                      `${this.endPoint.x} ${this.endPoint.y}`;

            const t = 0.95;
            const tangent = this.getCubicBezierTangent(t);
            const angle = Math.atan2(tangent.y, tangent.x);

            if (this.arrowHeadStyle === "default") {
                arrowEndPoint = {
                    x: this.endPoint.x - (this.arrowHeadLength * 0.3) * Math.cos(angle),
                    y: this.endPoint.y - (this.arrowHeadLength * 0.3) * Math.sin(angle)
                };

                pathData = `M ${this.startPoint.x} ${this.startPoint.y} ` +
                          `C ${this.controlPoint1.x} ${this.controlPoint1.y}, ` +
                          `${this.controlPoint2.x} ${this.controlPoint2.y}, ` +
                          `${arrowEndPoint.x} ${arrowEndPoint.y}`;
            }
        } else {
            pathData = `M ${this.startPoint.x} ${this.startPoint.y} L ${this.endPoint.x} ${this.endPoint.y}`;
        }

        if (this.arrowHeadStyle === "default") {
            let angle;
            if (this.arrowCurved && this.controlPoint1 && this.controlPoint2) {
                const tangent = this.getCubicBezierTangent(1.0);
                angle = Math.atan2(tangent.y, tangent.x);
            } else {
                const dx = this.endPoint.x - this.startPoint.x;
                const dy = this.endPoint.y - this.startPoint.y;
                angle = Math.atan2(dy, dx);
            }

            const arrowHeadAngleRad = (this.arrowHeadAngleDeg * Math.PI) / 180;
            const x3 = this.endPoint.x - this.arrowHeadLength * Math.cos(angle - arrowHeadAngleRad);
            const y3 = this.endPoint.y - this.arrowHeadLength * Math.sin(angle - arrowHeadAngleRad);
            const x4 = this.endPoint.x - this.arrowHeadLength * Math.cos(angle + arrowHeadAngleRad);
            const y4 = this.endPoint.y - this.arrowHeadLength * Math.sin(angle + arrowHeadAngleRad);
            pathData += ` M ${x3} ${y3} L ${this.endPoint.x} ${this.endPoint.y} L ${x4} ${y4}`;
        }

        const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath.setAttribute("d", pathData);
        arrowPath.setAttribute("stroke", this.options.stroke);
        arrowPath.setAttribute("stroke-width", this.options.strokeWidth);
        arrowPath.setAttribute("fill", this.options.fill);

        if (this.options.strokeDasharray) {
             arrowPath.setAttribute("stroke-dasharray", this.options.strokeDasharray);
        } else {
             arrowPath.removeAttribute("stroke-dasharray");
        }

        arrowPath.setAttribute("stroke-linecap", "round");
        arrowPath.setAttribute("stroke-linejoin", "round");
        arrowPath.classList.add("arrow-path");

        this.element = arrowPath;
        this.group.appendChild(this.element);

        if (this.isSelected) {
            this.addAnchors();
            this.addAttachmentIndicators();
        }
    }

    getCubicBezierPoint(t) {
        if (!this.controlPoint1 || !this.controlPoint2) return this.startPoint;

        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;

        return {
            x: mt3 * this.startPoint.x + 3 * mt2 * t * this.controlPoint1.x +
               3 * mt * t2 * this.controlPoint2.x + t3 * this.endPoint.x,
            y: mt3 * this.startPoint.y + 3 * mt2 * t * this.controlPoint1.y +
               3 * mt * t2 * this.controlPoint2.y + t3 * this.endPoint.y
        };
    }

    getCubicBezierTangent(t) {
        if (!this.controlPoint1 || !this.controlPoint2) {
            return { x: this.endPoint.x - this.startPoint.x, y: this.endPoint.y - this.startPoint.y };
        }

        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;

        return {
            x: 3 * mt2 * (this.controlPoint1.x - this.startPoint.x) +
               6 * mt * t * (this.controlPoint2.x - this.controlPoint1.x) +
               3 * t2 * (this.endPoint.x - this.controlPoint2.x),
            y: 3 * mt2 * (this.controlPoint1.y - this.startPoint.y) +
               6 * mt * t * (this.controlPoint2.y - this.controlPoint1.y) +
               3 * t2 * (this.endPoint.y - this.controlPoint2.y)
        };
    }

    addAnchors() {
        const anchorSize = 5 / currentZoom;
        const anchorStrokeWidth = 2 / currentZoom;

        let anchorPositions = [this.startPoint, this.endPoint];

        if (this.arrowCurved && this.controlPoint1 && this.controlPoint2) {
            anchorPositions.push(this.controlPoint1, this.controlPoint2);
        } else if (!this.arrowCurved) {
            const arrowAngle = Math.atan2(this.endPoint.y - this.startPoint.y, this.endPoint.x - this.startPoint.x);
            const arrowHeadClearance = this.arrowHeadLength + anchorSize - 10;
            const offsetEndAnchor = {
                x: this.endPoint.x + arrowHeadClearance * Math.cos(arrowAngle),
                y: this.endPoint.y + arrowHeadClearance * Math.sin(arrowAngle)
            };
            anchorPositions[1] = offsetEndAnchor;
        }

        anchorPositions.forEach((point, index) => {
            const anchor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            anchor.setAttribute("cx", point.x);
            anchor.setAttribute("cy", point.y);
            anchor.setAttribute("r", anchorSize);

            if (this.arrowCurved && index >= 2) {
                anchor.setAttribute("fill", "#121212");
                anchor.setAttribute("stroke", "#5B57D1");
            } else {
                anchor.setAttribute("fill", "#121212");
                anchor.setAttribute("stroke", "#5B57D1");
            }

            anchor.setAttribute("stroke-width", anchorStrokeWidth);
            anchor.setAttribute("class", "anchor arrow-anchor");
            anchor.setAttribute("data-index", index);
            anchor.style.cursor = "grab";
            anchor.style.pointerEvents = "all";
            anchor.addEventListener('pointerdown', (e) => this.startAnchorDrag(e, index));

            this.group.appendChild(anchor);
            this.anchors[index] = anchor;
        });
    }

    addAttachmentIndicators() {
        if (this.attachedToStart) {
            const attachPoint = this.calculateAttachedPoint(this.attachedToStart);
            const indicator = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            indicator.setAttribute("cx", attachPoint.x);
            indicator.setAttribute("cy", attachPoint.y);
            indicator.setAttribute("r", 4);
            indicator.setAttribute("fill", "#5B57D1");
            indicator.setAttribute("stroke", "#121212");
            indicator.setAttribute("stroke-width", 1);
            indicator.setAttribute("class", "attachment-indicator");
            this.group.appendChild(indicator);
        }

        if (this.attachedToEnd) {
            const attachPoint = this.calculateAttachedPoint(this.attachedToEnd);
            const indicator = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            indicator.setAttribute("cx", attachPoint.x);
            indicator.setAttribute("cy", attachPoint.y);
            indicator.setAttribute("r", 4);
            indicator.setAttribute("fill", "#5B57D1");
            indicator.setAttribute("stroke", "#121212");
            indicator.setAttribute("stroke-width", 1);
            indicator.setAttribute("class", "attachment-indicator");
            this.group.appendChild(indicator);
        }
    }

    getAttachmentState() {
        return {
            attachedToStart: this.attachedToStart ? {
                shapeId: this.attachedToStart.shape.shapeID,
                side: this.attachedToStart.side,
                offset: { ...this.attachedToStart.offset }
            } : null,
            attachedToEnd: this.attachedToEnd ? {
                shapeId: this.attachedToEnd.shape.shapeID,
                side: this.attachedToEnd.side,
                offset: { ...this.attachedToEnd.offset }
            } : null
        };
    }

    restoreAttachmentState(attachmentState) {
        this.attachedToStart = null;
        this.attachedToEnd = null;

        if (attachmentState.attachedToStart) {
            const shape = shapes.find(s => s.shapeID === attachmentState.attachedToStart.shapeId);
            if (shape) {
                this.attachedToStart = {
                    shape: shape,
                    side: attachmentState.attachedToStart.side,
                    offset: { ...attachmentState.attachedToStart.offset }
                };
                this.startPoint = this.calculateAttachedPoint(this.attachedToStart);
            }
        }

        if (attachmentState.attachedToEnd) {
            const shape = shapes.find(s => s.shapeID === attachmentState.attachedToEnd.shapeId);
            if (shape) {
                this.attachedToEnd = {
                    shape: shape,
                    side: attachmentState.attachedToEnd.side,
                    offset: { ...attachmentState.attachedToEnd.offset }
                };
                this.endPoint = this.calculateAttachedPoint(this.attachedToEnd);
            }
        }

        if (this.arrowCurved) {
            this.initializeCurveControlPoints();
        }

        this.draw();
    }

    static getEllipsePerimeterPoint(circle, angle) {
        // Calculate point on ellipse perimeter at given angle
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);

        const a = circle.rx;
        const b = circle.ry;

        const t = Math.atan2(a * sinAngle, b * cosAngle);

        return {
            x: circle.x + a * Math.cos(t),
            y: circle.y + b * Math.sin(t)
        };
    }


    static findNearbyShape(point, tolerance = 20) {
    // console.log('Finding nearby shape for point:', point, 'with tolerance:', tolerance);
    for (let shape of shapes) {
        // console.log('Checking shape:', shape);
        
        // Check if it's an SVG image element (DOM element)
        if (shape.tagName === 'image' || (shape.getAttribute && shape.getAttribute('type') === 'image')) {
            console.log('Checking image shape:', shape);
            const attachment = Arrow.getImageAttachmentPoint(point, shape, tolerance);
            if (attachment) {
                // console.log('Found image attachment:', attachment);
                return { shape, attachment };
            }
        }
        // Check for rectangle objects
        else if (shape.shapeName === 'rectangle') {
            const attachment = Arrow.getRectangleAttachmentPoint(point, shape, tolerance);
            if (attachment) {
                return { shape, attachment };
            }
        } 
        // Check for circle objects
        else if (shape.shapeName === 'circle') {
            const attachment = Arrow.getCircleAttachmentPoint(point, shape, tolerance);
            if (attachment) {
                return { shape, attachment };
            }
        } 
        // Check for text objects (DOM elements with type attribute)
        else if ((shape.getAttribute && shape.getAttribute('type') === 'text') || shape.type === 'text') {
            const attachment = Arrow.getTextAttachmentPoint(point, shape, tolerance);
            if (attachment) {
                return { shape, attachment };
            }
        }
        else if (shape.shapeName === 'frame') {
            const attachment = Arrow.getFrameAttachmentPoint(point, shape, tolerance);
            if (attachment) {
                return { shape, attachment };
            }
        }

         else if (shape.shapeName === 'icon' && shape.element) {
            console.log('Checking icon shape:', shape.element);
            const attachment = Arrow.getIconAttachmentPoint(point, shape.element, tolerance);
            if (attachment) {
                console.log('Found icon attachment:', attachment);
                return { shape: shape.element, attachment }; // Return the DOM element for consistency
            }
        }
    }
    return null;
}

static getIconAttachmentPoint(point, iconElement, tolerance = 20) {
    // Check if it's an SVG icon element (group)
    if (!iconElement || (iconElement.tagName !== 'g' && (!iconElement.getAttribute || iconElement.getAttribute('type') !== 'icon'))) {
        console.warn('Invalid icon element for attachment:', iconElement);
        return null;
    }

    // Get icon position and dimensions from data attributes
    const iconX = parseFloat(iconElement.getAttribute('data-shape-x') || iconElement.getAttribute('x'));
    const iconY = parseFloat(iconElement.getAttribute('data-shape-y') || iconElement.getAttribute('y'));
    const iconWidth = parseFloat(iconElement.getAttribute('data-shape-width') || iconElement.getAttribute('width'));
    const iconHeight = parseFloat(iconElement.getAttribute('data-shape-height') || iconElement.getAttribute('height'));

    // Get rotation from data attribute or transform attribute
    let rotation = 0;
    const dataRotation = iconElement.getAttribute('data-shape-rotation');
    if (dataRotation) {
        rotation = parseFloat(dataRotation) * Math.PI / 180; // Convert to radians
    } else {
        const transform = iconElement.getAttribute('transform');
        if (transform) {
            const rotateMatch = transform.match(/rotate\(([^,]+)/);
            if (rotateMatch) {
                rotation = parseFloat(rotateMatch[1]) * Math.PI / 180; // Convert to radians
            }
        }
    }

    const centerX = iconX + iconWidth / 2;
    const centerY = iconY + iconHeight / 2;

    // Transform the bounding box corners to world coordinates
    const corners = [
        { x: iconX, y: iconY }, // top-left
        { x: iconX + iconWidth, y: iconY }, // top-right
        { x: iconX + iconWidth, y: iconY + iconHeight }, // bottom-right
        { x: iconX, y: iconY + iconHeight } // bottom-left
    ];

    // Apply rotation to corners
    const transformedCorners = corners.map(corner => {
        if (rotation === 0) return corner;

        const dx = corner.x - centerX;
        const dy = corner.y - centerY;

        return {
            x: centerX + dx * Math.cos(rotation) - dy * Math.sin(rotation),
            y: centerY + dx * Math.sin(rotation) + dy * Math.cos(rotation)
        };
    });

    // Calculate sides of the transformed rectangle
    const sides = [
        { name: 'top', start: transformedCorners[0], end: transformedCorners[1] },
        { name: 'right', start: transformedCorners[1], end: transformedCorners[2] },
        { name: 'bottom', start: transformedCorners[2], end: transformedCorners[3] },
        { name: 'left', start: transformedCorners[3], end: transformedCorners[0] }
    ];

    let closestSide = null;
    let minDistance = tolerance;
    let attachPoint = null;

    sides.forEach(side => {
        const distance = Arrow.pointToLineSegmentDistance(point, side.start, side.end);
        if (distance < minDistance) {
            minDistance = distance;
            closestSide = side.name;

            // Calculate the closest point on the line segment
            attachPoint = Arrow.closestPointOnLineSegment(point, side.start, side.end);
        }
    });

    if (closestSide && attachPoint) {
        // Calculate offset relative to the original icon rectangle
        // Transform the attach point back to local coordinates
        let localPoint = attachPoint;
        if (rotation !== 0) {
            const dx = attachPoint.x - centerX;
            const dy = attachPoint.y - centerY;

            localPoint = {
                x: centerX + dx * Math.cos(-rotation) - dy * Math.sin(-rotation),
                y: centerY + dx * Math.sin(-rotation) + dy * Math.cos(-rotation)
            };
        }

        // Calculate offset relative to the icon rectangle
        const offset = {
            x: localPoint.x - iconX,
            y: localPoint.y - iconY,
            side: closestSide
        };

        return { side: closestSide, point: attachPoint, offset };
    }

    return null;
}


    static getImageAttachmentPoint(point, imageElement, tolerance = 20) {
    // Check if it's an SVG image element
    if (!imageElement || (imageElement.tagName !== 'image' && (!imageElement.getAttribute || imageElement.getAttribute('type') !== 'image'))) {
        console.warn('Invalid image element for attachment:', imageElement);
        return null;
    }

    // Get image position and dimensions from data attributes
    const imgX = parseFloat(imageElement.getAttribute('data-shape-x') || imageElement.getAttribute('x'));
    const imgY = parseFloat(imageElement.getAttribute('data-shape-y') || imageElement.getAttribute('y'));
    const imgWidth = parseFloat(imageElement.getAttribute('data-shape-width') || imageElement.getAttribute('width'));
    const imgHeight = parseFloat(imageElement.getAttribute('data-shape-height') || imageElement.getAttribute('height'));

    // Get rotation from data attribute or transform attribute
    let rotation = 0;
    const dataRotation = imageElement.getAttribute('data-shape-rotation');
    if (dataRotation) {
        rotation = parseFloat(dataRotation) * Math.PI / 180; // Convert to radians
    } else {
        const transform = imageElement.getAttribute('transform');
        if (transform) {
            const rotateMatch = transform.match(/rotate\(([^,]+)/);
            if (rotateMatch) {
                rotation = parseFloat(rotateMatch[1]) * Math.PI / 180; // Convert to radians
            }
        }
    }

    const centerX = imgX + imgWidth / 2;
    const centerY = imgY + imgHeight / 2;

    // Transform the bounding box corners to world coordinates
    const corners = [
        { x: imgX, y: imgY }, // top-left
        { x: imgX + imgWidth, y: imgY }, // top-right
        { x: imgX + imgWidth, y: imgY + imgHeight }, // bottom-right
        { x: imgX, y: imgY + imgHeight } // bottom-left
    ];

    // Apply rotation to corners
    const transformedCorners = corners.map(corner => {
        if (rotation === 0) return corner;

        const dx = corner.x - centerX;
        const dy = corner.y - centerY;

        return {
            x: centerX + dx * Math.cos(rotation) - dy * Math.sin(rotation),
            y: centerY + dx * Math.sin(rotation) + dy * Math.cos(rotation)
        };
    });

    // Calculate sides of the transformed rectangle
    const sides = [
        { name: 'top', start: transformedCorners[0], end: transformedCorners[1] },
        { name: 'right', start: transformedCorners[1], end: transformedCorners[2] },
        { name: 'bottom', start: transformedCorners[2], end: transformedCorners[3] },
        { name: 'left', start: transformedCorners[3], end: transformedCorners[0] }
    ];

    let closestSide = null;
    let minDistance = tolerance;
    let attachPoint = null;

    sides.forEach(side => {
        const distance = Arrow.pointToLineSegmentDistance(point, side.start, side.end);
        if (distance < minDistance) {
            minDistance = distance;
            closestSide = side.name;

            // Calculate the closest point on the line segment
            attachPoint = Arrow.closestPointOnLineSegment(point, side.start, side.end);
        }
    });

    if (closestSide && attachPoint) {
        // Calculate offset relative to the original image rectangle
        // Transform the attach point back to local coordinates
        let localPoint = attachPoint;
        if (rotation !== 0) {
            const dx = attachPoint.x - centerX;
            const dy = attachPoint.y - centerY;

            localPoint = {
                x: centerX + dx * Math.cos(-rotation) - dy * Math.sin(-rotation),
                y: centerY + dx * Math.sin(-rotation) + dy * Math.cos(-rotation)
            };
        }

        // Calculate offset relative to the image rectangle
        const offset = {
            x: localPoint.x - imgX,
            y: localPoint.y - imgY,
            side: closestSide
        };

        return { side: closestSide, point: attachPoint, offset };
    }

    return null;
}

static getFrameAttachmentPoint(point, frame, tolerance = 20) {
    const rect = {
        left: frame.x,
        right: frame.x + frame.width,
        top: frame.y,
        bottom: frame.y + frame.height
    };

    const distances = {
        top: Math.abs(point.y - rect.top),
        bottom: Math.abs(point.y - rect.bottom),
        left: Math.abs(point.x - rect.left),
        right: Math.abs(point.x - rect.right)
    };

    let closestSide = null;
    let minDistance = tolerance;

    for (let side in distances) {
        if (distances[side] < minDistance) {
            if ((side === 'top' || side === 'bottom') &&
                point.x >= rect.left - tolerance && point.x <= rect.right + tolerance) {
                closestSide = side;
                minDistance = distances[side];
            } else if ((side === 'left' || side === 'right') &&
                       point.y >= rect.top - tolerance && point.y <= rect.bottom + tolerance) {
                closestSide = side;
                minDistance = distances[side];
            }
        }
    }

    if (closestSide) {
        let attachPoint, offset;

        switch (closestSide) {
            case 'top':
                attachPoint = { x: Math.max(rect.left, Math.min(rect.right, point.x)), y: rect.top };
                offset = { x: attachPoint.x - frame.x, y: 0 };
                break;
            case 'bottom':
                attachPoint = { x: Math.max(rect.left, Math.min(rect.right, point.x)), y: rect.bottom };
                offset = { x: attachPoint.x - frame.x, y: frame.height };
                break;
            case 'left':
                attachPoint = { x: rect.left, y: Math.max(rect.top, Math.min(rect.bottom, point.y)) };
                offset = { x: 0, y: attachPoint.y - frame.y };
                break;
            case 'right':
                attachPoint = { x: rect.right, y: Math.max(rect.top, Math.min(rect.bottom, point.y)) };
                offset = { x: frame.width, y: attachPoint.y - frame.y };
                break;
        }

        return { side: closestSide, point: attachPoint, offset };
    }

    return null;
}

    static getRectangleAttachmentPoint(point, rectangle, tolerance = 20) {
        const rect = {
            left: rectangle.x,
            right: rectangle.x + rectangle.width,
            top: rectangle.y,
            bottom: rectangle.y + rectangle.height
        };

        const distances = {
            top: Math.abs(point.y - rect.top),
            bottom: Math.abs(point.y - rect.bottom),
            left: Math.abs(point.x - rect.left),
            right: Math.abs(point.x - rect.right)
        };

        let closestSide = null;
        let minDistance = tolerance;

        for (let side in distances) {
            if (distances[side] < minDistance) {
                if ((side === 'top' || side === 'bottom') &&
                    point.x >= rect.left - tolerance && point.x <= rect.right + tolerance) {
                    closestSide = side;
                    minDistance = distances[side];
                } else if ((side === 'left' || side === 'right') &&
                           point.y >= rect.top - tolerance && point.y <= rect.bottom + tolerance) {
                    closestSide = side;
                    minDistance = distances[side];
                }
            }
        }

        if (closestSide) {
            let attachPoint, offset;

            switch (closestSide) {
                case 'top':
                    attachPoint = { x: Math.max(rect.left, Math.min(rect.right, point.x)), y: rect.top };
                    offset = { x: attachPoint.x - rectangle.x, y: 0 };
                    break;
                case 'bottom':
                    attachPoint = { x: Math.max(rect.left, Math.min(rect.right, point.x)), y: rect.bottom };
                    offset = { x: attachPoint.x - rectangle.x, y: rectangle.height };
                    break;
                case 'left':
                    attachPoint = { x: rect.left, y: Math.max(rect.top, Math.min(rect.bottom, point.y)) };
                    offset = { x: 0, y: attachPoint.y - rectangle.y };
                    break;
                case 'right':
                    attachPoint = { x: rect.right, y: Math.max(rect.top, Math.min(rect.bottom, point.y)) };
                    offset = { x: rectangle.width, y: attachPoint.y - rectangle.y };
                    break;
            }

            return { side: closestSide, point: attachPoint, offset };
        }

        return null;
    }

    static getCircleAttachmentPoint(point, circle, tolerance = 20) {
        // Calculate distance from point to circle center
        const dx = point.x - circle.x;
        const dy = point.y - circle.y;
        const distanceToCenter = Math.sqrt(dx * dx + dy * dy);

        const averageRadius = (circle.rx + circle.ry) / 2;
        const distanceToPerimeter = Math.abs(distanceToCenter - averageRadius);

        if (distanceToPerimeter <= tolerance) {

            const angle = Math.atan2(dy, dx);


            const attachPoint = this.getEllipsePerimeterPoint(circle, angle);


            const offset = {
                angle: angle,
                radiusRatioX: (attachPoint.x - circle.x) / circle.rx,
                radiusRatioY: (attachPoint.y - circle.y) / circle.ry
            };

            return {
                side: 'perimeter',
                point: attachPoint,
                offset: offset
            };
        }

        return null;
    }

    static getTextAttachmentPoint(point, textGroup, tolerance = 20) {
        if (!textGroup || textGroup.type !== 'text') return null;

        const textElement = textGroup.querySelector('text');
        if (!textElement) return null;

        // Get the text bounding box
        const bbox = textElement.getBBox();

        // Get the group's transform
        const groupTransform = textGroup.transform.baseVal.consolidate();
        const matrix = groupTransform ? groupTransform.matrix : { e: 0, f: 0, a: 1, b: 0, c: 0, d: 1 };

        // Transform the bounding box corners to world coordinates
        const corners = [
            { x: bbox.x, y: bbox.y }, // top-left
            { x: bbox.x + bbox.width, y: bbox.y }, // top-right
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height }, // bottom-right
            { x: bbox.x, y: bbox.y + bbox.height } // bottom-left
        ];

        // Transform corners using the group's transform matrix
        const transformedCorners = corners.map(corner => ({
            x: corner.x * matrix.a + corner.y * matrix.c + matrix.e,
            y: corner.x * matrix.b + corner.y * matrix.d + matrix.f
        }));

        // Calculate sides of the transformed rectangle
        const sides = [
            { name: 'top', start: transformedCorners[0], end: transformedCorners[1] },
            { name: 'right', start: transformedCorners[1], end: transformedCorners[2] },
            { name: 'bottom', start: transformedCorners[2], end: transformedCorners[3] },
            { name: 'left', start: transformedCorners[3], end: transformedCorners[0] }
        ];

        let closestSide = null;
        let minDistance = tolerance;
        let attachPoint = null;

        sides.forEach(side => {
            const distance = Arrow.pointToLineSegmentDistance(point, side.start, side.end);
            if (distance < minDistance) {
                minDistance = distance;
                closestSide = side.name;

                // Calculate the closest point on the line segment
                attachPoint = Arrow.closestPointOnLineSegment(point, side.start, side.end);
            }
        });

        if (closestSide && attachPoint) {
            // Calculate offset relative to the original bounding box
            // Transform the attach point back to local coordinates
            const det = matrix.a * matrix.d - matrix.b * matrix.c;
            if (det === 0) return null;

            const invMatrix = {
                a: matrix.d / det,
                b: -matrix.b / det,
                c: -matrix.c / det,
                d: matrix.a / det,
                e: (matrix.c * matrix.f - matrix.d * matrix.e) / det,
                f: (matrix.b * matrix.e - matrix.a * matrix.f) / det
            };

            const localPoint = {
                x: attachPoint.x * invMatrix.a + attachPoint.y * invMatrix.c + invMatrix.e,
                y: attachPoint.x * invMatrix.b + attachPoint.y * invMatrix.d + invMatrix.f
            };

            // Calculate offset relative to the bounding box
            const offset = {
                x: localPoint.x - bbox.x,
                y: localPoint.y - bbox.y,
                side: closestSide
            };

            return { side: closestSide, point: attachPoint, offset };
        }

        return null;
    }

    static pointToLineSegmentDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) {
            // Line segment is a point
            return Math.sqrt(A * A + B * B);
        }

        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param)); // Clamp to [0,1]

        const xx = lineStart.x + param * C;
        const yy = lineStart.y + param * D;

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static closestPointOnLineSegment(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) {
            return { x: lineStart.x, y: lineStart.y };
        }

        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));

        return {
            x: lineStart.x + param * C,
            y: lineStart.y + param * D
        };
    }

    calculateAttachedPoint(attachment) {
    const shape = attachment.shape;
    const side = attachment.side;
    const offset = attachment.offset;

    if (shape.shapeName === 'rectangle') {
        switch (side) {
            case 'top':
                return { x: shape.x + offset.x, y: shape.y };
            case 'bottom':
                return { x: shape.x + offset.x, y: shape.y + shape.height };
            case 'left':
                return { x: shape.x, y: shape.y + offset.y };
            case 'right':
                return { x: shape.x + shape.width, y: shape.y + offset.y };
            default:
                return { x: shape.x + offset.x, y: shape.y + offset.y };
        }
    } else if (shape.shapeName === 'circle') {
        if (side === 'perimeter') {
            // Recalculate point on ellipse perimeter using stored angle
            return Arrow.getEllipsePerimeterPoint(shape, offset.angle);
        }
    } else if ((shape.getAttribute && shape.getAttribute('type') === 'text') || shape.type === 'text') {
        const textElement = shape.querySelector('text');
        if (!textElement) return { x: 0, y: 0 };

        const bbox = textElement.getBBox();
        const groupTransform = shape.transform.baseVal.consolidate();
        const matrix = groupTransform ? groupTransform.matrix : { e: 0, f: 0, a: 1, b: 0, c: 0, d: 1 };

        // Calculate the point on the text box using the stored offset
        let localPoint = {
            x: bbox.x + offset.x,
            y: bbox.y + offset.y
        };

        // Transform to world coordinates
        return {
            x: localPoint.x * matrix.a + localPoint.y * matrix.c + matrix.e,
            y: localPoint.x * matrix.b + localPoint.y * matrix.d + matrix.f
        };
    } else if (shape.tagName === 'image' || (shape.getAttribute && shape.getAttribute('type') === 'image')) {
        // Get image position and dimensions from data attributes
        const imgX = parseFloat(shape.getAttribute('data-shape-x') || shape.getAttribute('x'));
        const imgY = parseFloat(shape.getAttribute('data-shape-y') || shape.getAttribute('y'));
        const imgWidth = parseFloat(shape.getAttribute('data-shape-width') || shape.getAttribute('width'));
        const imgHeight = parseFloat(shape.getAttribute('data-shape-height') || shape.getAttribute('height'));

        // Get rotation from data attribute or transform attribute
        let rotation = 0;
        const dataRotation = shape.getAttribute('data-shape-rotation');
        if (dataRotation) {
            rotation = parseFloat(dataRotation) * Math.PI / 180; // Convert to radians
        } else {
            const transform = shape.getAttribute('transform');
            if (transform) {
                const rotateMatch = transform.match(/rotate\(([^,]+)/);
                if (rotateMatch) {
                    rotation = parseFloat(rotateMatch[1]) * Math.PI / 180; // Convert to radians
                }
            }
        }

        // Calculate the point on the image using the stored offset
        let localPoint = {
            x: imgX + offset.x,
            y: imgY + offset.y
        };

        // Apply rotation if necessary
        if (rotation !== 0) {
            const centerX = imgX + imgWidth / 2;
            const centerY = imgY + imgHeight / 2;
            const dx = localPoint.x - centerX;
            const dy = localPoint.y - centerY;

            localPoint = {
                x: centerX + dx * Math.cos(rotation) - dy * Math.sin(rotation),
                y: centerY + dx * Math.sin(rotation) + dy * Math.cos(rotation)
            };
        }

        return localPoint;
    }   
    
    else if (shape.tagName === 'g' && (shape.getAttribute && shape.getAttribute('type') === 'icon')) {
        // Handle icon attachment - ADD THIS BLOCK
        const iconX = parseFloat(shape.getAttribute('data-shape-x') || shape.getAttribute('x'));
        const iconY = parseFloat(shape.getAttribute('data-shape-y') || shape.getAttribute('y'));
        const iconWidth = parseFloat(shape.getAttribute('data-shape-width') || shape.getAttribute('width'));
        const iconHeight = parseFloat(shape.getAttribute('data-shape-height') || shape.getAttribute('height'));

        // Get rotation from data attribute or transform attribute
        let rotation = 0;
        const dataRotation = shape.getAttribute('data-shape-rotation');
        if (dataRotation) {
            rotation = parseFloat(dataRotation) * Math.PI / 180; // Convert to radians
        } else {
            const transform = shape.getAttribute('transform');
            if (transform) {
                const rotateMatch = transform.match(/rotate\(([^,]+)/);
                if (rotateMatch) {
                    rotation = parseFloat(rotateMatch[1]) * Math.PI / 180; // Convert to radians
                }
            }
        }

        // Calculate the point on the icon using the stored offset
        let localPoint = {
            x: iconX + offset.x,
            y: iconY + offset.y
        };

        // Apply rotation if necessary
        if (rotation !== 0) {
            const centerX = iconX + iconWidth / 2;
            const centerY = iconY + iconHeight / 2;
            const dx = localPoint.x - centerX;
            const dy = localPoint.y - centerY;

            localPoint = {
                x: centerX + dx * Math.cos(rotation) - dy * Math.sin(rotation),
                y: centerY + dx * Math.sin(rotation) + dy * Math.cos(rotation)
            };
        }

        return localPoint;
    }

    else if (shape.shapeName === 'frame') {
        switch (side) {
            case 'top':
                return { x: shape.x + offset.x, y: shape.y };
            case 'bottom':
                return { x: shape.x + offset.x, y: shape.y + shape.height };
            case 'left':
                return { x: shape.x, y: shape.y + offset.y };
            case 'right':
                return { x: shape.x + shape.width, y: shape.y + offset.y };
            default:
                return { x: shape.x + offset.x, y: shape.y + offset.y };
        }
    }

    return { x: shape.x || 0, y: shape.y || 0 };
}

    detachFromShape(isStartPoint) {
        if (isStartPoint) {
            this.attachedToStart = null;
        } else {
            this.attachedToEnd = null;
        }
    }

    updateAttachments() {
        let needsRedraw = false;

        if (this.attachedToStart && this.attachedToStart.shape) {
            const newPoint = this.calculateAttachedPoint(this.attachedToStart);
            if (newPoint.x !== this.startPoint.x || newPoint.y !== this.startPoint.y) {
                this.startPoint = newPoint;
                needsRedraw = true;
            }
        }

        if (this.attachedToEnd && this.attachedToEnd.shape) {
            const newPoint = this.calculateAttachedPoint(this.attachedToEnd);
            if (newPoint.x !== this.endPoint.x || newPoint.y !== this.endPoint.y) {
                this.endPoint = newPoint;
                needsRedraw = true;
            }
        }

        if (needsRedraw) {
            if (this.arrowCurved) {
                this.initializeCurveControlPoints();
            }
            this.draw();
        }
    }

    move(dx, dy) {
    if (!this.attachedToStart) {
        this.startPoint.x += dx;
        this.startPoint.y += dy;
    }
    if (!this.attachedToEnd) {
        this.endPoint.x += dx;
        this.endPoint.y += dy;
    }

    if (this.controlPoint1 && (!this.attachedToStart && !this.attachedToEnd)) {
        this.controlPoint1.x += dx;
        this.controlPoint1.y += dy;
    }
    if (this.controlPoint2 && (!this.attachedToStart && !this.attachedToEnd)) {
        this.controlPoint2.x += dx;
        this.controlPoint2.y += dy;
    }
    
    // Only update frame containment if we're actively dragging the shape itself
    // and not being moved by a parent frame
    if (isDragging && !this.isBeingMovedByFrame) {
        this.updateFrameContainment();
    }
}

updateFrameContainment() {
    // Don't update if we're being moved by a frame
    if (this.isBeingMovedByFrame) return;
    
    let targetFrame = null;
    
    // Find which frame this shape is over
    shapes.forEach(shape => {
        if (shape.shapeName === 'frame' && shape.isShapeInFrame(this)) {
            targetFrame = shape;
        }
    });
    
    // If we have a parent frame and we're being dragged, temporarily remove clipping
    if (this.parentFrame && isDragging) {
        this.parentFrame.temporarilyRemoveFromFrame(this);
    }
    
    // Update frame highlighting
    if (hoveredFrameArrow && hoveredFrameArrow !== targetFrame) {
        hoveredFrameArrow.removeHighlight();
    }
    
    if (targetFrame && targetFrame !== hoveredFrameArrow) {
        targetFrame.highlightFrame();
    }
    
    hoveredFrameArrow = targetFrame;
}

    isNearAnchor(x, y) {
        const anchorSize = 10 / currentZoom;

        for (let i = 0; i < this.anchors.length; i++) {
            const anchor = this.anchors[i];
            if (anchor) {
                const anchorX = parseFloat(anchor.getAttribute('cx'));
                const anchorY = parseFloat(anchor.getAttribute('cy'));
                const distance = Math.sqrt(Math.pow(x - anchorX, 2) + Math.pow(y - anchorY, 2));
                if (distance <= anchorSize) {
                    return { type: 'anchor', index: i };
                }
            }
        }

        return null;
    }

    startAnchorDrag(e, index) {
        e.stopPropagation();
        e.preventDefault();

        // Store initial state including attachments
        dragOldPosArrow = {
            startPoint: { x: this.startPoint.x, y: this.startPoint.y },
            endPoint: { x: this.endPoint.x, y: this.endPoint.y },
            controlPoint1: this.controlPoint1 ? { x: this.controlPoint1.x, y: this.controlPoint1.y } : null,
            controlPoint2: this.controlPoint2 ? { x: this.controlPoint2.x, y: this.controlPoint2.y } : null,
            attachments: this.getAttachmentState()
        };

        const onPointerMove = (event) => {
            const { x, y } = getSVGCoordsFromMouse(event);

            // Check for potential attachment when dragging start or end anchors
            if (index === 0 || index === 1) {
                const nearbyShape = Arrow.findNearbyShape({ x, y });
                if (nearbyShape) {
                    // Show preview while dragging
                    const existingPreview = svg.querySelector('.attachment-preview');
                    if (existingPreview) existingPreview.remove();

                    const preview = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    preview.setAttribute("cx", nearbyShape.attachment.point.x);
                    preview.setAttribute("cy", nearbyShape.attachment.point.y);
                    preview.setAttribute("r", 6);
                    preview.setAttribute("fill", "none");
                    preview.setAttribute("stroke", "#5B57D1");
                    preview.setAttribute("stroke-width", 2);
                    preview.setAttribute("class", "attachment-preview");
                    preview.setAttribute("opacity", "0.7");
                    svg.appendChild(preview);

                    // Snap to attachment point
                    this.updatePosition(index, nearbyShape.attachment.point.x, nearbyShape.attachment.point.y);
                } else {

                    const existingPreview = svg.querySelector('.attachment-preview');
                    if (existingPreview) existingPreview.remove();

                    this.updatePosition(index, x, y);
                }
            } else {
                this.updatePosition(index, x, y);
            }
        };

        const onPointerUp = () => {

            const existingPreview = svg.querySelector('.attachment-preview');
            if (existingPreview) existingPreview.remove();

            if (index === 0) {
                // Check for start point attachment
                const startAttachment = Arrow.findNearbyShape(this.startPoint);
                if (startAttachment) {

                    if (this.attachedToStart && this.attachedToStart.shape !== startAttachment.shape) {
                        this.detachFromShape(true);
                    }
                    this.attachToShape(true, startAttachment.shape, startAttachment.attachment);
                    console.log(`Arrow start attached to ${startAttachment.shape.shapeName}`);
                } else {
                    // Detach if moved away from shape
                    if (this.attachedToStart) {
                        this.detachFromShape(true);
                        console.log("Arrow start detached from shape");
                    }
                }
            } else if (index === 1) {
                // Check for end point attachment
                const endAttachment = Arrow.findNearbyShape(this.endPoint);
                if (endAttachment) {
                    // Detach if previously attached to different shape
                    if (this.attachedToEnd && this.attachedToEnd.shape !== endAttachment.shape) {
                        this.detachFromShape(false);
                    }
                    this.attachToShape(false, endAttachment.shape, endAttachment.attachment);
                    console.log(`Arrow end attached to ${endAttachment.shape.shapeName}`);
                } else {
                    // Detach if moved away from shape
                    if (this.attachedToEnd) {
                        this.detachFromShape(false);
                        console.log("Arrow end detached from shape");
                    }
                }
            }

            if (dragOldPosArrow) {
                const newPos = {
                    startPoint: { x: this.startPoint.x, y: this.startPoint.y },
                    endPoint: { x: this.endPoint.x, y: this.endPoint.y },
                    controlPoint1: this.controlPoint1 ? { x: this.controlPoint1.x, y: this.controlPoint1.y } : null,
                    controlPoint2: this.controlPoint2 ? { x: this.controlPoint2.x, y: this.controlPoint2.y } : null,
                    attachments: this.getAttachmentState()
                };

                // Check if anything actually changed (position or attachments)
                const stateChanged =
                    dragOldPosArrow.startPoint.x !== newPos.startPoint.x ||
                    dragOldPosArrow.startPoint.y !== newPos.startPoint.y ||
                    dragOldPosArrow.endPoint.x !== newPos.endPoint.x ||
                    dragOldPosArrow.endPoint.y !== newPos.endPoint.y ||
                    JSON.stringify(dragOldPosArrow.attachments) !== JSON.stringify(newPos.attachments);

                if (stateChanged) {
                    pushTransformAction(this, dragOldPosArrow, newPos);
                }
                dragOldPosArrow = null;
            }

            svg.removeEventListener('pointermove', onPointerMove);
            svg.removeEventListener('pointerup', onPointerUp);
        };

        svg.addEventListener('pointermove', onPointerMove);
        svg.addEventListener('pointerup', onPointerUp);
    }

    updatePosition(anchorIndex, newViewBoxX, newViewBoxY) {
        if (anchorIndex === 0) {
            this.startPoint.x = newViewBoxX;
            this.startPoint.y = newViewBoxY;
        } else if (anchorIndex === 1) {
            this.endPoint.x = newViewBoxX;
            this.endPoint.y = newViewBoxY;
        } else if (anchorIndex === 2 && this.controlPoint1) {
            this.controlPoint1.x = newViewBoxX;
            this.controlPoint1.y = newViewBoxY;
        } else if (anchorIndex === 3 && this.controlPoint2) {
            this.controlPoint2.x = newViewBoxX;
            this.controlPoint2.y = newViewBoxY;
        }
        this.draw();
    }

    contains(viewBoxX, viewBoxY) {
        const tolerance = Math.max(5, this.options.strokeWidth * 2) / currentZoom;

        if (this.arrowCurved && this.controlPoint1 && this.controlPoint2) {
            return this.pointToCubicBezierDistance(viewBoxX, viewBoxY) <= tolerance;
        } else {
            const distance = this.pointToLineDistance(viewBoxX, viewBoxY, this.startPoint.x, this.startPoint.y, this.endPoint.x, this.endPoint.y);
            return distance <= tolerance;
        }
    }

    pointToCubicBezierDistance(x, y) {
        let minDistance = Infinity;
        const steps = 100;

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = this.getCubicBezierPoint(t);
            const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
            minDistance = Math.min(minDistance, distance);
        }

        return minDistance;
    }

    pointToLineDistance(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

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

    updateStyle(newOptions) {
        if (newOptions.arrowOutlineStyle !== undefined) {
            this.arrowOutlineStyle = newOptions.arrowOutlineStyle;
            const style = this.arrowOutlineStyle;
            this.options.strokeDasharray = style === "dashed" ? "10,10" : (style === "dotted" ? "2,8" : "");
        }
        if (newOptions.arrowHeadStyle !== undefined) {
            this.arrowHeadStyle = newOptions.arrowHeadStyle;
        }
        if (newOptions.arrowCurved !== undefined) {
            const wasCurved = this.arrowCurved;
            this.arrowCurved = newOptions.arrowCurved;

            if (this.arrowCurved && !wasCurved) {
                this.initializeCurveControlPoints();
            } else if (!this.arrowCurved && wasCurved) {
                this.controlPoint1 = null;
                this.controlPoint2 = null;
            }
        }
        if (newOptions.stroke !== undefined) {
            this.options.stroke = newOptions.stroke;
        }
        if (newOptions.strokeWidth !== undefined) {
            this.options.strokeWidth = parseFloat(newOptions.strokeWidth);
        }
        if (newOptions.arrowCurveAmount !== undefined) {
            this.arrowCurveAmount = newOptions.arrowCurveAmount;
            if (this.arrowCurved) {
                this.initializeCurveControlPoints();
            }
        }

        Object.keys(newOptions).forEach(key => newOptions[key] === undefined && delete newOptions[key]);
        this.options = { ...this.options, ...newOptions };

        if (this.arrowOutlineStyle === 'solid' && this.options.strokeDasharray) {
             delete this.options.strokeDasharray;
        }

        this.draw();
    }

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

function deleteCurrentShape() {
    if (currentShape && currentShape.shapeName === 'arrow') {
        const idx = shapes.indexOf(currentShape);
        if (idx !== -1) shapes.splice(idx, 1);
        if (currentShape.group.parentNode) {
            currentShape.group.parentNode.removeChild(currentShape.group);
        }
        pushDeleteAction(currentShape);
        currentShape = null;
        disableAllSideBars();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && currentShape && currentShape.shapeName === 'arrow') {
        deleteCurrentShape();
    }
});


const handleMouseDown = (e) => {
    if (!isArrowToolActive && !isSelectionToolActive) return;

    const { x, y } = getSVGCoordsFromMouse(e);

    if (isArrowToolActive) {
        isDrawingArrow = true;
        currentArrow = new Arrow({ x, y }, { x, y }, {
            stroke: arrowStrokeColor,
            strokeWidth: arrowStrokeThickness,
            arrowOutlineStyle: arrowOutlineStyle,
            arrowHeadStyle: arrowHeadStyle,
            arrowCurved: arrowCurved,
            arrowCurveAmount: arrowCurveAmount
        });
        shapes.push(currentArrow);
        currentShape = currentArrow;
    } else if (isSelectionToolActive) {
        let clickedOnShape = false;
        let clickedOnAnchor = false;

        if (currentShape && currentShape.shapeName === 'arrow' && currentShape.isSelected) {
            const anchorInfo = currentShape.isNearAnchor(x, y);
            if (anchorInfo && anchorInfo.type === 'anchor') {
                clickedOnAnchor = true;
                clickedOnShape = true;
            } 
            if (currentShape.contains(x, y)) {
                isDragging = true;
                dragOldPosArrow = {
                    startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
                    endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y },
                    controlPoint1: currentShape.controlPoint1 ? { x: currentShape.controlPoint1.x, y: currentShape.controlPoint1.y } : null,
                    controlPoint2: currentShape.controlPoint2 ? { x: currentShape.controlPoint2.x, y: currentShape.controlPoint2.y } : null,
                    parentFrame: currentShape.parentFrame  // Add this line
                };
                
                // Store initial frame state
                draggedShapeInitialFrameArrow = currentShape.parentFrame || null;
                
                // Temporarily remove from frame clipping if dragging
                if (currentShape.parentFrame) {
                    currentShape.parentFrame.temporarilyRemoveFromFrame(currentShape);
                }
                
                startX = x;
                startY = y;
                clickedOnShape = true;
            }
                    }

        if (!clickedOnShape) {
            let shapeToSelect = null;

            for (let i = shapes.length - 1; i >= 0; i--) {
                const shape = shapes[i];
                if (shape instanceof Arrow && shape.contains(x, y)) {
                    shapeToSelect = shape;
                    break;
                }
            }

            if (currentShape && currentShape !== shapeToSelect) {
                currentShape.removeSelection();
                currentShape = null;
            }

            if (shapeToSelect) {
                currentShape = shapeToSelect;
                currentShape.selectArrow();

                const anchorInfo = currentShape.isNearAnchor(x, y);
                if (anchorInfo && anchorInfo.type === 'anchor') {
                    clickedOnAnchor = true;
                } else {
                    isDragging = true;
                    dragOldPosArrow = {
                        startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
                        endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y },
                        controlPoint1: currentShape.controlPoint1 ? { x: currentShape.controlPoint1.x, y: currentShape.controlPoint1.y } : null,
                        controlPoint2: currentShape.controlPoint2 ? { x: currentShape.controlPoint2.x, y: currentShape.controlPoint2.y } : null
                    };
                    startX = x;
                    startY = y;
                }
                clickedOnShape = true;
            }
        }

        if (!clickedOnShape && !clickedOnAnchor && currentShape) {
            currentShape.removeSelection();
            currentShape = null;
        }
    }
};

// Enhanced mouse move with better cursor feedback
const handleMouseMove = (e) => {
    const { x, y } = getSVGCoordsFromMouse(e);

    if (isDrawingArrow && currentArrow) {
            currentArrow.endPoint = { x, y };

            // Check for potential attachment and show preview
            const nearbyShape = Arrow.findNearbyShape({ x, y });
            if (nearbyShape) {
                // Snap to attachment point
                currentArrow.endPoint = nearbyShape.attachment.point;
                svg.style.cursor = 'crosshair';

                const existingPreview = svg.querySelector('.attachment-preview');
                if (existingPreview) existingPreview.remove();

                const preview = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                preview.setAttribute("cx", nearbyShape.attachment.point.x);
                preview.setAttribute("cy", nearbyShape.attachment.point.y);
                preview.setAttribute("r", 6);
                preview.setAttribute("fill", "none");
                preview.setAttribute("stroke", "#5B57D1");
                preview.setAttribute("stroke-width", 2);
                preview.setAttribute("class", "attachment-preview");
                preview.setAttribute("opacity", "0.7");
                svg.appendChild(preview);
            } else {
                // Remove preview if no nearby shape
                const existingPreview = svg.querySelector('.attachment-preview');
                if (existingPreview) existingPreview.remove();
            }

            // Check for frame containment while drawing (but don't apply clipping yet)
            shapes.forEach(frame => {
                if (frame.shapeName === 'frame') {
                    if (frame.isShapeInFrame(currentArrow)) {
                        frame.highlightFrame();
                        hoveredFrameArrow = frame;
                    } else if (hoveredFrameArrow === frame) {
                        frame.removeHighlight();
                        hoveredFrameArrow = null;
                    }
                }
            });

            // Update control points for curved arrows during drawing
            if (currentArrow.arrowCurved) {
                currentArrow.initializeCurveControlPoints();
            }
            currentArrow.draw();
        }

    else if (isDragging && currentShape && currentShape.isSelected) {
        const dx = x - startX;
        const dy = y - startY;
        currentShape.move(dx, dy);
        startX = x;
        startY = y;
        currentShape.draw();
        svg.style.cursor = 'grabbing';
    } else if (isSelectionToolActive && currentShape && currentShape.isSelected) {
        // Provide visual feedback when hovering over anchors or the arrow
        const anchorInfo = currentShape.isNearAnchor(x, y);
        if (anchorInfo) {
            svg.style.cursor = 'grab';
        } else if (currentShape.contains(x, y)) {
            svg.style.cursor = 'move';
        } else {
            svg.style.cursor = 'default';
        }
    } else if (isSelectionToolActive) {
        // Check if hovering over any selectable arrow
        let hoveringOverArrow = false;
        for (let i = shapes.length - 1; i >= 0; i--) {
            const shape = shapes[i];
            if (shape instanceof Arrow && shape.contains(x, y)) {
                hoveringOverArrow = true;
                break;
            }
        }
        svg.style.cursor = hoveringOverArrow ? 'pointer' : 'default';
    }
};

const handleMouseUp = (e) => {
if (isDrawingArrow && currentArrow) {
    // Remove any attachment preview that might still be visible
    const existingPreview = svg.querySelector('.attachment-preview');
    if (existingPreview) existingPreview.remove();

    // Check if arrow is too small
    const dx = currentArrow.endPoint.x - currentArrow.startPoint.x;
    const dy = currentArrow.endPoint.y - currentArrow.startPoint.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq < (5 / currentZoom) ** 2) {
        shapes.pop();
        if (currentArrow.group.parentNode) {
            currentArrow.group.parentNode.removeChild(currentArrow.group);
        }
        currentArrow = null;
        currentShape = null;
    } else {
        const startAttachment = Arrow.findNearbyShape(currentArrow.startPoint);
        const endAttachment = Arrow.findNearbyShape(currentArrow.endPoint);

        if (startAttachment) {
            currentArrow.attachToShape(true, startAttachment.shape, startAttachment.attachment);
            console.log(`Arrow start attached to ${startAttachment.shape.shapeName}`);
        }

        if (endAttachment) {
            currentArrow.attachToShape(false, endAttachment.shape, endAttachment.attachment);
            console.log(`Arrow end attached to ${endAttachment.shape.shapeName}`);
        }

        // Check for frame containment and track attachment
        const finalFrame = hoveredFrameArrow;
        if (finalFrame) {
            finalFrame.addShapeToFrame(currentArrow);
            // Track the attachment for undo
            pushFrameAttachmentAction(finalFrame, currentArrow, 'attach', null);
        }

        // Push create action for undo/redo
        pushCreateAction(currentArrow);
    }
    
    // Clear frame highlighting
    if (hoveredFrameArrow) {
        hoveredFrameArrow.removeHighlight();
        hoveredFrameArrow = null;
    }

    currentArrow = null;
}

if (isDragging && dragOldPosArrow && currentShape) {
    const newPos = {
        startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
        endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y },
        parentFrame: currentShape.parentFrame  // Add this line
    };
    const oldPos = {
        ...dragOldPosArrow,
        parentFrame: draggedShapeInitialFrameArrow  // Add this line
    };
    
    const stateChanged = dragOldPosArrow.startPoint.x !== newPos.startPoint.x ||
                       dragOldPosArrow.startPoint.y !== newPos.startPoint.y ||
                       dragOldPosArrow.endPoint.x !== newPos.endPoint.x ||
                       dragOldPosArrow.endPoint.y !== newPos.endPoint.y;
    
    const frameChanged = oldPos.parentFrame !== newPos.parentFrame;

    if (stateChanged || frameChanged) {
        pushTransformAction(currentShape, oldPos, newPos);
    }
    
    // Handle frame containment changes after drag
    if (isDragging) {
        const finalFrame = hoveredFrameArrow;
        
        // If shape moved to a different frame
        if (draggedShapeInitialFrameArrow !== finalFrame) {
            // Remove from initial frame
            if (draggedShapeInitialFrameArrow) {
                draggedShapeInitialFrameArrow.removeShapeFromFrame(currentShape);
            }
            
            // Add to new frame
            if (finalFrame) {
                finalFrame.addShapeToFrame(currentShape);
            }
            
            // Track the frame change for undo
            if (frameChanged) {
                pushFrameAttachmentAction(finalFrame || draggedShapeInitialFrameArrow, currentShape, 
                    finalFrame ? 'attach' : 'detach', draggedShapeInitialFrameArrow);
            }
        } else if (draggedShapeInitialFrameArrow) {
            // Shape stayed in same frame, restore clipping
            draggedShapeInitialFrameArrow.restoreToFrame(currentShape);
        }
    }
    
    draggedShapeInitialFrameArrow = null;
    dragOldPosArrow = null;
}

// Clear frame highlighting
if (hoveredFrameArrow) {
    hoveredFrameArrow.removeHighlight();
    hoveredFrameArrow = null;
}

isDrawingArrow = false;
isResizing = false;
isDragging = false;
activeAnchor = null;
svg.style.cursor = 'default';
};

// Remove old event listeners and add new ones
svg.removeEventListener('mousedown', handleMouseDown);
svg.removeEventListener('mousemove', handleMouseMove);
svg.removeEventListener('mouseup', handleMouseUp);


// Updated style handlers with undo/redo support
const updateSelectedArrowStyle = (styleChanges) => {
    if (currentShape instanceof Arrow && currentShape.isSelected) {
        const oldOptions = {
            ...currentShape.options,
            arrowOutlineStyle: currentShape.arrowOutlineStyle,
            arrowHeadStyle: currentShape.arrowHeadStyle,
            arrowCurved: currentShape.arrowCurved,
            arrowCurveAmount: currentShape.arrowCurveAmount
        };
        currentShape.updateStyle(styleChanges);
        pushOptionsChangeAction(currentShape, oldOptions);
    } else {
         if (styleChanges.stroke !== undefined) arrowStrokeColor = styleChanges.stroke;
         if (styleChanges.strokeWidth !== undefined) arrowStrokeThickness = styleChanges.strokeWidth;
         if (styleChanges.arrowOutlineStyle !== undefined) arrowOutlineStyle = styleChanges.arrowOutlineStyle;
         if (styleChanges.arrowHeadStyle !== undefined) arrowHeadStyle = styleChanges.arrowHeadStyle;
         if (styleChanges.arrowCurved !== undefined) arrowCurved = styleChanges.arrowCurved;
         if (styleChanges.arrowCurveAmount !== undefined) arrowCurveAmount = styleChanges.arrowCurveAmount;
    }
};

arrowStrokeColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowStrokeColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const newColor = span.getAttribute("data-id");
        updateSelectedArrowStyle({ stroke: newColor });
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
        updateSelectedArrowStyle({ arrowOutlineStyle: newStyle });
    });
});

arrowTypeStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowTypeStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const isCurved = span.getAttribute("data-id") === 'true';
        updateSelectedArrowStyle({ arrowCurved: isCurved });
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

// Add copy/paste functionality like in lineTool.js
function cloneOptions(options) {
    return JSON.parse(JSON.stringify(options));
}

function cloneArrowData(arrow) {
    return {
        startPoint: { x: arrow.startPoint.x, y: arrow.startPoint.y },
        endPoint: { x: arrow.endPoint.x, y: arrow.endPoint.y },
        controlPoint1: arrow.controlPoint1 ? { x: arrow.controlPoint1.x, y: arrow.controlPoint1.y } : null,
        controlPoint2: arrow.controlPoint2 ? { x: arrow.controlPoint2.x, y: arrow.controlPoint2.y } : null,
        options: cloneOptions(arrow.options),
        arrowOutlineStyle: arrow.arrowOutlineStyle,
        arrowHeadStyle: arrow.arrowHeadStyle,
        arrowCurved: arrow.arrowCurved,
        arrowCurveAmount: arrow.arrowCurveAmount
    };
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (currentShape && currentShape.shapeName === 'arrow' && currentShape.isSelected) {
            copiedShapeData = cloneArrowData(currentShape);
        }
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedShapeData) {
            e.preventDefault();

            shapes.forEach(shape => {
                if (shape.isSelected && shape.removeSelection) {
                    shape.removeSelection();
                }
            });

            currentShape = null;
            disableAllSideBars();

            const offset = 20;
            const newArrow = new Arrow(
                { x: copiedShapeData.startPoint.x + offset, y: copiedShapeData.startPoint.y + offset },
                { x: copiedShapeData.endPoint.x + offset, y: copiedShapeData.endPoint.y + offset },
                {
                    ...cloneOptions(copiedShapeData.options),
                    arrowOutlineStyle: copiedShapeData.arrowOutlineStyle,
                    arrowHeadStyle: copiedShapeData.arrowHeadStyle,
                    arrowCurved: copiedShapeData.arrowCurved,
                    arrowCurveAmount: copiedShapeData.arrowCurveAmount,
                    controlPoint1: copiedShapeData.controlPoint1 ?
                        { x: copiedShapeData.controlPoint1.x + offset, y: copiedShapeData.controlPoint1.y + offset } : null,
                    controlPoint2: copiedShapeData.controlPoint2 ?
                        { x: copiedShapeData.controlPoint2.x + offset, y: copiedShapeData.controlPoint2.y + offset } : null
                }
            );

            shapes.push(newArrow);
            newArrow.selectArrow();
            currentShape = newArrow;
            pushCreateAction(newArrow);
        }
    }
});

function detachSelectedArrow() {
    if (currentShape instanceof Arrow && currentShape.isSelected) {
        if (currentShape.attachedToStart || currentShape.attachedToEnd) {
            const oldState = {
                attachedToStart: currentShape.attachedToStart,
                attachedToEnd: currentShape.attachedToEnd,
                startPoint: { ...currentShape.startPoint },
                endPoint: { ...currentShape.endPoint }
            };

            currentShape.detachFromShape(true);
            currentShape.detachFromShape(false);
            currentShape.draw();

            // Add to undo/redo if needed
            console.log("Arrow detached from shapes");
        }
    }
}

function updateAttachedArrows(shape) {
    if (!shape) return;

    
    shapes.forEach(arrowShape => {
        if (arrowShape instanceof Arrow) {
            let needsUpdate = false;
            if (arrowShape.attachedToStart && arrowShape.attachedToStart.shape === shape) {
                needsUpdate = true;
            }
            if (arrowShape.attachedToEnd && arrowShape.attachedToEnd.shape === shape) {
                needsUpdate = true;
            }

            if (needsUpdate) {
                arrowShape.updateAttachments();
            }
        }
    });
}

function cleanupAttachments(deletedShape) {
    if (deletedShape.shapeName === 'rectangle' || deletedShape.shapeName === 'circle' ||
        (deletedShape.getAttribute && deletedShape.getAttribute('type') === 'text') || deletedShape.type === 'text' ||
        deletedShape.tagName === 'image' || (deletedShape.getAttribute && deletedShape.getAttribute('type') === 'image')) {
        // Remove attachments to this shape
        shapes.forEach(shape => {
            if (shape instanceof Arrow) {
                if (shape.attachedToStart && shape.attachedToStart.shape === deletedShape) {
                    shape.detachFromShape(true);
                }
                if (shape.attachedToEnd && shape.attachedToEnd.shape === deletedShape) {
                    shape.detachFromShape(false);
                }
                shape.draw();
            }
        });
    }
}

// Add keyboard shortcut to detach arrows
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd' && e.ctrlKey) {
        e.preventDefault();
        detachSelectedArrow();
    }
});

// Export the cleanup function
export {
    handleMouseDown as handleMouseDownArrow,
    handleMouseMove as handleMouseMoveArrow,
    handleMouseUp as handleMouseUpArrow,
    cleanupAttachments,
    updateAttachedArrows
};