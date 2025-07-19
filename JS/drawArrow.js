import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction } from './undoAndRedo.js';

let arrowStartX, arrowStartY;
let currentArrow = null; 
let isResizing = false;  
let isDragging = false;  
let activeAnchor = null; 
let isDrawingArrow = false; 
let arrowStrokeColor = "#fff";
let arrowStrokeThickness = 2;
let arrowOutlineStyle = "solid";
let arrowCurved = false;
let arrowCurveAmount = 20;
let arrowHeadLength = 10;
let arrowHeadAngleDeg = 30;
let arrowHeadStyle = "default";
let startX, startY; 
let startViewBoxX, startViewBoxY, dragOffsetX, dragOffsetY; 
let dragOldPosArrow = null;
let copiedShapeData = null;

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

        // Attachment properties
        this.attachedToStart = null; 
        this.attachedToEnd = null;   

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
                anchor.setAttribute("fill", "#FF6B6B");
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

    static findNearbyRectangle(point, tolerance = 20) {
        for (let shape of shapes) {
            if (shape.shapeName === 'rectangle') {
                const attachment = Arrow.getAttachmentPoint(point, shape, tolerance);
                if (attachment) {
                    return { shape, attachment };
                }
            }
        }
        return null;
    }

    static getAttachmentPoint(point, rectangle, tolerance = 20) {
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

    attachToRectangle(isStartPoint, rectangle, attachmentInfo) {
        const attachment = {
            shape: rectangle,
            side: attachmentInfo.side,
            offset: attachmentInfo.offset
        };

        if (isStartPoint) {
            this.attachedToStart = attachment;
            this.startPoint = { ...attachmentInfo.point };
        } else {
            this.attachedToEnd = attachment;
            this.endPoint = { ...attachmentInfo.point };
        }

        if (this.arrowCurved) {
            this.initializeCurveControlPoints();
        }
        
        this.draw();
    }

    detachFromRectangle(isStartPoint) {
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

    calculateAttachedPoint(attachment) {
        const rect = attachment.shape;
        const side = attachment.side;
        const offset = attachment.offset;

        switch (side) {
            case 'top':
                return { x: rect.x + offset.x, y: rect.y };
            case 'bottom':
                return { x: rect.x + offset.x, y: rect.y + rect.height };
            case 'left':
                return { x: rect.x, y: rect.y + offset.y };
            case 'right':
                return { x: rect.x + rect.width, y: rect.y + offset.y };
            default:
                return { x: rect.x + offset.x, y: rect.y + offset.y };
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
            attachments: this.getAttachmentState() // Store initial attachment state
        };

        const onPointerMove = (event) => {
            const { x, y } = getSVGCoordsFromMouse(event);
            
            // Check for potential attachment when dragging start or end anchors
            if (index === 0 || index === 1) {
                const nearbyRect = Arrow.findNearbyRectangle({ x, y });
                if (nearbyRect) {
                    // Show preview while dragging
                    const existingPreview = svg.querySelector('.attachment-preview');
                    if (existingPreview) existingPreview.remove();
                    
                    const preview = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    preview.setAttribute("cx", nearbyRect.attachment.point.x);
                    preview.setAttribute("cy", nearbyRect.attachment.point.y);
                    preview.setAttribute("r", 6);
                    preview.setAttribute("fill", "none");
                    preview.setAttribute("stroke", "#5B57D1");
                    preview.setAttribute("stroke-width", 2);
                    preview.setAttribute("class", "attachment-preview");
                    preview.setAttribute("opacity", "0.7");
                    svg.appendChild(preview);
                    
                    // Snap to attachment point
                    this.updatePosition(index, nearbyRect.attachment.point.x, nearbyRect.attachment.point.y);
                } else {
                    // Remove preview if no nearby rectangle
                    const existingPreview = svg.querySelector('.attachment-preview');
                    if (existingPreview) existingPreview.remove();
                    
                    this.updatePosition(index, x, y);
                }
            } else {
                this.updatePosition(index, x, y);
            }
        };
        
        const onPointerUp = () => {
            // Remove any attachment preview
            const existingPreview = svg.querySelector('.attachment-preview');
            if (existingPreview) existingPreview.remove();
            
            // Check for attachments when releasing start or end anchors
            if (index === 0) {
                // Check for start point attachment
                const startAttachment = Arrow.findNearbyRectangle(this.startPoint);
                if (startAttachment) {
                    // Detach if previously attached to different rectangle
                    if (this.attachedToStart && this.attachedToStart.shape !== startAttachment.shape) {
                        this.detachFromRectangle(true);
                    }
                    this.attachToRectangle(true, startAttachment.shape, startAttachment.attachment);
                    console.log("Arrow start attached to rectangle");
                } else {
                    // Detach if moved away from rectangle
                    if (this.attachedToStart) {
                        this.detachFromRectangle(true);
                        console.log("Arrow start detached from rectangle");
                    }
                }
            } else if (index === 1) {
                // Check for end point attachment
                const endAttachment = Arrow.findNearbyRectangle(this.endPoint);
                if (endAttachment) {
                    // Detach if previously attached to different rectangle
                    if (this.attachedToEnd && this.attachedToEnd.shape !== endAttachment.shape) {
                        this.detachFromRectangle(false);
                    }
                    this.attachToRectangle(false, endAttachment.shape, endAttachment.attachment);
                    console.log("Arrow end attached to rectangle");
                } else {
                    // Detach if moved away from rectangle
                    if (this.attachedToEnd) {
                        this.detachFromRectangle(false);
                        console.log("Arrow end detached from rectangle");
                    }
                }
            }
            
            if (dragOldPosArrow) {
                const newPos = {
                    startPoint: { x: this.startPoint.x, y: this.startPoint.y },
                    endPoint: { x: this.endPoint.x, y: this.endPoint.y },
                    controlPoint1: this.controlPoint1 ? { x: this.controlPoint1.x, y: this.controlPoint1.y } : null,
                    controlPoint2: this.controlPoint2 ? { x: this.controlPoint2.x, y: this.controlPoint2.y } : null,
                    attachments: this.getAttachmentState() // Store final attachment state
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

// Updated mouse event handlers with better selection detection
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
            } else if (currentShape.contains(x, y)) {
                isDragging = true;
                dragOldPosArrow = {
                    startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
                    endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y },
                    controlPoint1: currentShape.controlPoint1 ? { x: currentShape.controlPoint1.x, y: currentShape.controlPoint1.y } : null,
                    controlPoint2: currentShape.controlPoint2 ? { x: currentShape.controlPoint2.x, y: currentShape.controlPoint2.y } : null
                };
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
        const nearbyRect = Arrow.findNearbyRectangle({ x, y });
        if (nearbyRect) {
            // Snap to attachment point
            currentArrow.endPoint = nearbyRect.attachment.point;
            svg.style.cursor = 'crosshair';
            
            
            const existingPreview = svg.querySelector('.attachment-preview');
            if (existingPreview) existingPreview.remove();
            
            const preview = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            preview.setAttribute("cx", nearbyRect.attachment.point.x);
            preview.setAttribute("cy", nearbyRect.attachment.point.y);
            preview.setAttribute("r", 6);
            preview.setAttribute("fill", "none");
            preview.setAttribute("stroke", "#5B57D1");
            preview.setAttribute("stroke-width", 2);
            preview.setAttribute("class", "attachment-preview");
            preview.setAttribute("opacity", "0.7");
            svg.appendChild(preview);
        } else {
            // Remove preview if no nearby rectangle
            const existingPreview = svg.querySelector('.attachment-preview');
            if (existingPreview) existingPreview.remove();
        }
        
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
            // Check for potential attachments at start and end points
            const startAttachment = Arrow.findNearbyRectangle(currentArrow.startPoint);
            const endAttachment = Arrow.findNearbyRectangle(currentArrow.endPoint);

            if (startAttachment) {
                currentArrow.attachToRectangle(true, startAttachment.shape, startAttachment.attachment);
                console.log("Arrow start attached to rectangle");
            }

            if (endAttachment) {
                currentArrow.attachToRectangle(false, endAttachment.shape, endAttachment.attachment);
                console.log("Arrow end attached to rectangle");
            }

            // Push create action for undo/redo
            pushCreateAction(currentArrow);
        }
        
        currentArrow = null;
    }
    
    if (isDragging && dragOldPosArrow && currentShape) {
        const newPos = {
            startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
            endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y }
        };
        const stateChanged = dragOldPosArrow.startPoint.x !== newPos.startPoint.x || 
                           dragOldPosArrow.startPoint.y !== newPos.startPoint.y ||
                           dragOldPosArrow.endPoint.x !== newPos.endPoint.x || 
                           dragOldPosArrow.endPoint.y !== newPos.endPoint.y;
        
        if (stateChanged) {
            pushTransformAction(currentShape, dragOldPosArrow, newPos);
        }
        dragOldPosArrow = null;
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

            currentShape.detachFromRectangle(true);
            currentShape.detachFromRectangle(false);
            currentShape.draw();

            // Add to undo/redo if needed
            console.log("Arrow detached from rectangles");
        }
    }
}

// Function to clean up attachments when shapes are deleted
function cleanupAttachments(deletedShape) {
    if (deletedShape.shapeName === 'rectangle') {
        // Remove attachments to this rectangle
        shapes.forEach(shape => {
            if (shape instanceof Arrow) {
                if (shape.attachedToStart && shape.attachedToStart.shape === deletedShape) {
                    shape.detachFromRectangle(true);
                }
                if (shape.attachedToEnd && shape.attachedToEnd.shape === deletedShape) {
                    shape.detachFromRectangle(false);
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
    cleanupAttachments
};