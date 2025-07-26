import {
    pushCreateAction,
    pushDeleteAction,
    pushDeleteActionWithAttachments,
    pushTransformAction,
    pushOptionsChangeAction,
    pushFrameAttachmentAction,
    setTextReferences,
    updateSelectedElement
} from './undoAndRedo.js';
import { cleanupAttachments } from './drawArrow.js';

let textSize = "25px";
let textFont = "lixFont";
let textColor = "#fff";
let textAlign = "left";

let textColorOptions = document.querySelectorAll(".textColorSpan");
let textFontOptions = document.querySelectorAll(".textFontSpan");
let textSizeOptions = document.querySelectorAll(".textSizeSpan");
let textAlignOptions = document.querySelectorAll(".textAlignSpan");

let selectedElement = null;
let selectionBox = null;
let resizeHandles = {};
let dragOffsetX, dragOffsetY;
let isDragging = false;
let isResizing = false;
let currentResizeHandle = null;
let startBBox = null;
let startFontSize = null;
let startPoint = null;
let isRotating = false;
let rotationStartAngle = 0;
let rotationStartTransform = null;
let initialHandlePosRelGroup = null;
let initialGroupTx = 0;
let initialGroupTy = 0;
let codeEditor = true;

let draggedShapeInitialFrameText = null;
let hoveredFrameText = null;

setTextReferences(selectedElement, updateSelectionFeedback, svg);

class TextShape {
    constructor(groupElement) {
        this.group = groupElement;
        this.shapeName = 'text';
        this.shapeID = groupElement.getAttribute('id') || `text-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;
        
        this.parentFrame = null;
        
        this.group.setAttribute('type', 'text');
        this.group.shapeName = 'text';
        this.group.shapeID = this.shapeID;
    }
    
    get x() {
        const transform = this.group.transform.baseVal.consolidate();
        return transform ? transform.matrix.e : parseFloat(this.group.getAttribute('data-x')) || 0;
    }
    
    set x(value) {
        const transform = this.group.transform.baseVal.consolidate();
        const currentY = transform ? transform.matrix.f : parseFloat(this.group.getAttribute('data-y')) || 0;
        const rotation = extractRotationFromTransform(this.group) || 0;
        const textElement = this.group.querySelector('text');
        if (textElement) {
            const bbox = textElement.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            this.group.setAttribute('transform', `translate(${value}, ${currentY}) rotate(${rotation}, ${centerX}, ${centerY})`);
        } else {
            this.group.setAttribute('transform', `translate(${value}, ${currentY})`);
        }
        this.group.setAttribute('data-x', value);
    }
    
    get y() {
        const transform = this.group.transform.baseVal.consolidate();
        return transform ? transform.matrix.f : parseFloat(this.group.getAttribute('data-y')) || 0;
    }
    
    set y(value) {
        const transform = this.group.transform.baseVal.consolidate();
        const currentX = transform ? transform.matrix.e : parseFloat(this.group.getAttribute('data-x')) || 0;
        const rotation = extractRotationFromTransform(this.group) || 0;
        const textElement = this.group.querySelector('text');
        if (textElement) {
            const bbox = textElement.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            this.group.setAttribute('transform', `translate(${currentX}, ${value}) rotate(${rotation}, ${centerX}, ${centerY})`);
        } else {
            this.group.setAttribute('transform', `translate(${currentX}, ${value})`);
        }
        this.group.setAttribute('data-y', value);
    }
    
    get width() {
        const textElement = this.group.querySelector('text');
        if (textElement) {
            return textElement.getBBox().width;
        }
        return 0;
    }
    
    set width(value) {
    }
    
    get height() {
        const textElement = this.group.querySelector('text');
        if (textElement) {
            return textElement.getBBox().height;
        }
        return 0;
    }
    
    set height(value) {
    }
    
    get rotation() {
        return extractRotationFromTransform(this.group) || 0;
    }
    
    set rotation(value) {
        const currentTransform = this.group.transform.baseVal.consolidate();
        const currentX = currentTransform ? currentTransform.matrix.e : 0;
        const currentY = currentTransform ? currentTransform.matrix.f : 0;
        const textElement = this.group.querySelector('text');
        if (textElement) {
            const bbox = textElement.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            this.group.setAttribute('transform', `translate(${currentX}, ${currentY}) rotate(${value}, ${centerX}, ${centerY})`);
        }
    }

    move(dx, dy) {
        const currentTransform = this.group.transform.baseVal.consolidate();
        const currentX = currentTransform ? currentTransform.matrix.e : 0;
        const currentY = currentTransform ? currentTransform.matrix.f : 0;
        
        this.x = currentX + dx;
        this.y = currentY + dy;
        
        if (isDragging && !this.isBeingMovedByFrame) {
            this.updateFrameContainment();
        }
        
        if (typeof updateAttachedArrows === 'function') {
            updateAttachedArrows(this.group);
        }
    }

    updateFrameContainment() {
        if (this.isBeingMovedByFrame) return;
        
        let targetFrame = null;
        
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            shapes.forEach(shape => {
                if (shape.shapeName === 'frame' && shape.isShapeInFrame(this)) {
                    targetFrame = shape;
                }
            });
        }
        
        if (this.parentFrame && isDragging) {
            this.parentFrame.temporarilyRemoveFromFrame(this);
        }
        
        if (hoveredFrameText && hoveredFrameText !== targetFrame) {
            hoveredFrameText.removeHighlight();
        }
        
        if (targetFrame && targetFrame !== hoveredFrameText) {
            targetFrame.highlightFrame();
        }
        
        hoveredFrameText = targetFrame;
    }

    contains(x, y) {
        const textElement = this.group.querySelector('text');
        if (!textElement) return false;
        
        const bbox = textElement.getBBox();
        const padding = 8;
        
        const CTM = this.group.getCTM();
        if (!CTM) return false;
        
        const inverseCTM = CTM.inverse();
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = x;
        svgPoint.y = y;
        const transformedPoint = svgPoint.matrixTransform(inverseCTM);
        
        return transformedPoint.x >= bbox.x - padding && 
               transformedPoint.x <= bbox.x + bbox.width + padding &&
               transformedPoint.y >= bbox.y - padding && 
               transformedPoint.y <= bbox.y + bbox.height + padding;
    }

    draw() {
        if (selectedElement === this.group) {
            updateSelectionFeedback();
        }
    }

    removeSelection() {
        if (selectedElement === this.group) {
            deselectElement();
        }
    }

    selectShape() {
        selectElement(this.group);
    }
}

function wrapTextElement(groupElement) {
    const textShape = new TextShape(groupElement);
    return textShape;
}

function getSVGCoordinates(event, element = svg) {
    if (!svg || !svg.createSVGPoint) {
        console.error("SVG element or createSVGPoint method not available.");
        return { x: 0, y: 0 };
    }
    let pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;

    try {
        let screenCTM = (element && typeof element.getScreenCTM === 'function' && element.getScreenCTM()) || svg.getScreenCTM();
        if (!screenCTM) {
            console.error("Could not get Screen CTM.");
            return { x: event.clientX, y: event.clientY };
        }
        let svgPoint = pt.matrixTransform(screenCTM.inverse());
        return {
            x: svgPoint.x,
            y: svgPoint.y,
        };
    } catch (error) {
         console.error("Error getting SVG coordinates:", error);
         return { x: event.clientX, y: event.clientY };
    }
}

function addText(event) {
    let { x, y } = getSVGCoordinates(event);

    let gElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gElement.setAttribute("data-type", "text-group");
    gElement.setAttribute("transform", `translate(${x}, ${y})`);

    let textElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
    );
    let textAlignElement = "start";
    if (textAlign === "center") textAlignElement = "middle";
    else if (textAlign === "right") textAlignElement = "end";

    textElement.setAttribute("x", 0);
    textElement.setAttribute("y", 0);
    
    textElement.setAttribute("font-size", textSize);
    textElement.setAttribute("font-family", textFont);
    textElement.setAttribute("text-anchor", textAlignElement);
    textElement.setAttribute("cursor", "text");
    textElement.setAttribute("white-space", "pre");
    textElement.setAttribute("dominant-baseline", "hanging");
    textElement.textContent = "";
    if (codeEditor) {
    textElement.setAttribute('data-code-mode', 'true');
    } else {
        textElement.setAttribute("fill", textColor);
        textElement.setAttribute('data-code-mode', 'false');
        textElement.setAttribute("data-initial-color", textColor);
        textElement.removeAttribute('data-code-mode');
    }
    gElement.setAttribute("data-x", x);
    gElement.setAttribute("data-y", y);
    textElement.setAttribute("data-initial-size", textSize);
    textElement.setAttribute("data-initial-font", textFont);
    textElement.setAttribute("data-initial-align", textAlign);
    textElement.setAttribute("data-type", "text");
    gElement.appendChild(textElement);
    svg.appendChild(gElement);
    
    const shapeID = `text-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;
    gElement.setAttribute('id', shapeID);
    textElement.setAttribute('id', `${shapeID}-text`);
    
    const textShape = wrapTextElement(gElement);
    
    if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
        shapes.push(textShape);
    }
    
    pushCreateAction({
        type: 'text',
        element: textShape,
        shapeName: 'text'
    });

    makeTextEditable(textElement, gElement);
}


function makeTextEditable(textElement, groupElement) {
    console.log("Making text editable");

    groupElement.style.display = "none";

    if (document.querySelector("textarea.svg-text-editor")) {
        console.log("Already editing.");
        return;
    }

    if (selectedElement) {
        deselectElement();
    }

    let input = document.createElement("textarea");
    input.className = "svg-text-editor";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");

    input.style.cssText = `
    scrollbar-width: none;
    overflow: hidden;
    resize: none;
    position: absolute;
    outline: none;
    box-sizing: border-box;
    margin: 0;
    white-space: pre;
    z-index: 10000; 
    min-height: 54px !important;
    background-color: transparent;
    border: none;
    font-size: ${textElement.getAttribute("font-size")};
    font-family: ${textElement.getAttribute("font-family")};
    color: ${textElement.getAttribute("fill")};
    text-align: ${(textElement.getAttribute("text-anchor") === "middle") ? "center" :
                  (textElement.getAttribute("text-anchor") === "end") ? "right" : "left"};
    overflow-y: hidden;
    overflow-x: hidden;
    line-height: ${textElement.getAttribute("font-size")};
    -webkit-overflow-scrolling: touch;
    ms-overflow-style: none;
    display: block;
`;

    let textContent = "";

    
    if (textElement.getAttribute('data-code-mode') === 'true' || codeEditor) {
        input.classList.add('svg-code-editor-bg');
    
        // Create overlay
        let codeOverlay = document.createElement('pre');
        let codeNode = document.createElement('code');
        codeNode.className = 'hljs';
        codeOverlay.appendChild(codeNode);
    
        codeOverlay.className = 'svg-code-highlighted syntax-highlight-overlay';
    
        // Set overlay position and size to match textarea
        codeOverlay.style.position = 'absolute';
        codeOverlay.style.left = input.style.left;
        codeOverlay.style.top = input.style.top;
        codeOverlay.style.width = input.offsetWidth + 'px';
        codeOverlay.style.height = input.offsetHeight + 'px';
        codeOverlay.style.fontSize = input.style.fontSize;
        codeOverlay.style.fontFamily = input.style.fontFamily;
        codeOverlay.style.lineHeight = input.style.lineHeight;
        codeOverlay.style.padding = input.style.padding;
        codeOverlay.style.margin = input.style.margin;
        codeOverlay.style.display = 'flex';
        codeOverlay.style.alignItems = 'center'; // vertical centering
    
        codeNode.style.width = '100%';
        codeNode.style.display = 'block';
    
        document.body.appendChild(codeOverlay);
    
        input._codeOverlay = codeOverlay;
        input._codeNode = codeNode;
    
        function syncOverlay() {
            codeOverlay.style.left = input.style.left;
            codeOverlay.style.top = input.style.top;
            codeOverlay.style.width = input.offsetWidth + 'px';
            codeOverlay.style.height = input.offsetHeight + 'px';
            codeOverlay.style.fontSize = input.style.fontSize;
            codeOverlay.style.fontFamily = input.style.fontFamily;
            codeOverlay.style.lineHeight = input.style.lineHeight;
            codeOverlay.style.padding = input.style.padding;
            codeOverlay.style.margin = input.style.margin;
        }
    
        function highlightCode() {
            let code = input.value;
            let result = window.hljs.highlightAuto(code);
            codeNode.innerHTML = result.value;
            codeNode.className = `hljs language-${result.language || ''}`;
            syncOverlay();
        }
    
        input.addEventListener('input', highlightCode);
        input.addEventListener('keydown', syncOverlay);
        input.addEventListener('scroll', () => {
            codeOverlay.scrollTop = input.scrollTop;
            codeOverlay.scrollLeft = input.scrollLeft;
        });
        setTimeout(highlightCode, 0);
        setTimeout(syncOverlay, 0);
    
        input._removeOverlay = () => {
            if (codeOverlay && codeOverlay.parentNode) codeOverlay.parentNode.removeChild(codeOverlay);
        };
    } 
    
    else {
        if (textElement.childNodes.length > 0) {
            textContent = Array.from(textElement.childNodes).map(tspan => {
                return (tspan.textContent || "")
                    .replace(/ /g, '\u00A0')
                    .replace(/\t/g, '\t');
            }).join('\n');
        } else {
            textContent = (textElement.textContent || "")
                .replace(/ /g, '\u00A0')
                .replace(/\t/g, '\t');
        }
        input.value = textContent;
    }

    const svgRect = svg.getBoundingClientRect();
    let groupTransformMatrix = svg.createSVGMatrix();
    if (groupElement && groupElement.transform && groupElement.transform.baseVal) {
        const transformList = groupElement.transform.baseVal;
        if (transformList.numberOfItems > 0) {
            const consolidatedTransform = transformList.consolidate();
            if (consolidatedTransform) {
                groupTransformMatrix = consolidatedTransform.matrix;
            } else if (transformList.length > 0) {
                groupTransformMatrix = transformList.getItem(0).matrix;
            }
        }
    }

    const textBBox = textElement.getBBox();
    let pt = svg.createSVGPoint();
    pt.x = textBBox.x;
    pt.y = textBBox.y;
    let screenPt = pt.matrixTransform(groupTransformMatrix.multiply(svg.getScreenCTM()));

    input.style.left = `${screenPt.x + svgRect.left}px`;
    input.style.top = `${screenPt.y + svgRect.top}px`;

    const adjustHeight = () => {
        input.style.height = 'auto';
        input.style.height = Math.max(input.scrollHeight, 54) + 'px';
        const maxHeight = svgRect.height - (screenPt.y);
        if (input.scrollHeight > maxHeight) {
            input.style.height = maxHeight + 'px';
            input.style.overflowY = 'hidden';
        } else {
            input.style.overflowY = 'hidden';
        }
    };

    const adjustWidth = () => {
        input.style.width = 'auto';
        const maxWidth = svgRect.width - (screenPt.x);
        if (input.scrollWidth > maxWidth) {
            input.style.width = maxWidth + 'px';
            input.style.overflowX = 'hidden';
        } else {
            input.style.width = input.scrollWidth + 'px';
            input.style.overflowX = 'hidden';
        }
    };

    document.body.appendChild(input);
    adjustHeight();
    adjustWidth();

    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);

    input.addEventListener('input', adjustHeight);
    input.addEventListener('input', adjustWidth);

    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            renderText(input, textElement, true);
        } else if (e.key === "Escape") {
            e.preventDefault();
            renderText(input, textElement, true);
        }
    });

    input.originalTextElement = textElement;
    input.textGroup = groupElement;

    const handleClickOutside = (event) => {
        if (!input.contains(event.target)) {
            renderText(input, textElement, true);
            document.removeEventListener('mousedown', handleClickOutside, true);
        }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    input.handleClickOutside = handleClickOutside;
}


function renderText(input, textElement, deleteIfEmpty = false) {
    if (!input || !document.body.contains(input)) {
        console.warn("RenderText called but input textarea is already removed.");
        return;
    }

    const text = input.value || "";
    const gElement = input.textGroup;

    if (input.handleClickOutside) {
        document.removeEventListener('mousedown', input.handleClickOutside, true);
    }
    if (input._removeOverlay) input._removeOverlay();
    document.body.removeChild(input);
    gElement.style.display = "block";
    if (!gElement || !textElement) {
        console.error("RenderText cannot find original group or text element.");
        return;
    }

    if (!gElement.parentNode) {
        console.warn("RenderText: Group element no longer attached to SVG.");
        if (selectedElement === gElement) {
            deselectElement();
        }
        return;
    }

    if (deleteIfEmpty && text.trim() === "") {
        let textShape = null;
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            textShape = shapes.find(shape => shape.shapeName === 'text' && shape.group === gElement);
            if (textShape) {
                const idx = shapes.indexOf(textShape);
                if (idx !== -1) shapes.splice(idx, 1);
            }
        }

        pushDeleteActionWithAttachments({
            type: 'text',
            element: textShape || gElement,
            shapeName: 'text'
        });

        if (typeof cleanupAttachments === 'function') {
            cleanupAttachments(gElement);
        }

        svg.removeChild(gElement);
        if (selectedElement === gElement) {
            selectedElement = null;
            removeSelectionFeedback();
        }
        return;
    }

    
    if (textElement.getAttribute('data-code-mode') === 'true') {
        while (textElement.firstChild) textElement.removeChild(textElement.firstChild);

        const lines = text.split('\n');
        const x = parseFloat(textElement.getAttribute("x")) || 0;
        const y = parseFloat(textElement.getAttribute("y")) || 0;
        const fontSizeNum = parseFloat(textSize) || 25;
        const lineHeight = fontSizeNum * 1.2;
        const padding = 12;
        const backgroundColor = "#242424";
        const borderColor = "#666";
        const borderRadius = 12;

        // Measure max line width
        let tempSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.appendChild(tempSVG);
        let maxWidth = 550;
        lines.forEach(line => {
            let tempText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            tempText.setAttribute("font-size", textSize);
            tempText.setAttribute("font-family", "lixCode");
            tempText.textContent = line || " ";
            tempSVG.appendChild(tempText);
            maxWidth = Math.max(maxWidth, tempText.getBBox().width);
            tempSVG.removeChild(tempText);
        });
        document.body.removeChild(tempSVG);

        // Create or update background rect in parent group
        let rect = gElement.querySelector('rect[data-bg="true"]');
        if (!rect) {
            rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("data-bg", "true");
            gElement.insertBefore(rect, textElement); // Insert behind text
        }

        const totalHeight = lines.length * lineHeight;
        const minRectHeight = 30; // Match textarea min-height
        const rectHeight = Math.max(totalHeight + 2 * padding, minRectHeight + 2 * padding);

        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", maxWidth + 2 * padding);
        rect.setAttribute("height", rectHeight);
        rect.setAttribute("rx", borderRadius);
        rect.setAttribute("fill", backgroundColor);
        rect.setAttribute("stroke", borderColor);
        rect.setAttribute("stroke-width", "2");

        // Calculate centeredY for vertical centering
        const centeredY = y + padding + (rectHeight - totalHeight) / 2 - (fontSizeNum * 0.4);

        // Render syntax-highlighted lines, vertically centered
        lines.forEach((line, index) => {
            const highlightedLine = window.hljs.highlightAuto(line).value || " ";
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = highlightedLine || " ";
            tempDiv.style.position = 'absolute';
            tempDiv.style.visibility = 'hidden';
            document.body.appendChild(tempDiv);

            const parentTspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            parentTspan.setAttribute("x", x + padding);
            parentTspan.setAttribute("y", centeredY + index * lineHeight);

            tempDiv.childNodes.forEach(node => {
                const childTspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                if (node.nodeType === Node.TEXT_NODE) {
                    childTspan.textContent = node.textContent || " ";
                    childTspan.setAttribute("fill", "#fff");
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    childTspan.textContent = node.textContent || " ";
                    childTspan.setAttribute("class", node.className);
                    let color = window.getComputedStyle(node).color;
                    if (!color || color === "rgba(0, 0, 0, 0)" || color === "inherit") {
                        color = "#fff";
                    }
                    childTspan.setAttribute("fill", color);
                }
                childTspan.setAttribute("font-family", "lixCode");
                childTspan.setAttribute("font-size", textSize);
                parentTspan.appendChild(childTspan);
            });

            textElement.appendChild(parentTspan);
            document.body.removeChild(tempDiv);
        });
    }


    else {
        while (textElement.firstChild) {
            textElement.removeChild(textElement.firstChild);
        }

        const lines = text.split("\n");
        const x = textElement.getAttribute("x") || 0;

        lines.forEach((line, index) => {
            let tspan = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "tspan"
            );
            tspan.setAttribute("x", x);
            tspan.setAttribute("dy", index === 0 ? "0" : "1.2em");
            tspan.textContent = line.replace(/\u00A0/g, ' ') || " ";
            textElement.appendChild(tspan);
        });

        gElement.style.display = 'block';

        updateAttachedArrows(gElement);

        if (selectedElement === gElement) {
            setTimeout(updateSelectionFeedback, 0);
        }
    }

    if (selectedTool && selectedTool.classList.contains('bxs-pointer') && gElement.parentNode === svg) {
        selectElement(gElement);
    } else if (selectedElement === gElement) {
        deselectElement();
    }
}


function createSelectionFeedback(groupElement) {
    if (!groupElement) return;
    removeSelectionFeedback();

    const textElement = groupElement.querySelector('text');
    if (!textElement) return;

    const bbox = textElement.getBBox();

    const padding = 8;
    const handleSize = 10;
    const handleOffset = handleSize / 2;
    const anchorStrokeWidth = 2;

    const selX = bbox.x - padding;
    const selY = bbox.y - padding;
    const selWidth = bbox.width + 2 * padding;
    const selHeight = bbox.height + 2 * padding;

    const outlinePoints = [
        [selX, selY],
        [selX + selWidth, selY],
        [selX + selWidth, selY + selHeight],
        [selX, selY + selHeight],
        [selX, selY]
    ];

    const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
    selectionBox = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    selectionBox.setAttribute("class", "selection-box");
    selectionBox.setAttribute("points", pointsAttr);
    selectionBox.setAttribute("fill", "none");
    selectionBox.setAttribute("stroke", "#5B57D1");
    selectionBox.setAttribute("stroke-width", "1.5");
    selectionBox.setAttribute("stroke-dasharray", "4 2");
    selectionBox.setAttribute("vector-effect", "non-scaling-stroke");
    selectionBox.setAttribute("pointer-events", "none");
    groupElement.appendChild(selectionBox);

    const handlesData = [
        { name: 'nw', x: selX, y: selY, cursor: 'nwse-resize' },
        { name: 'ne', x: selX + selWidth, y: selY, cursor: 'nesw-resize' },
        { name: 'sw', x: selX, y: selY + selHeight, cursor: 'nesw-resize' },
        { name: 'se', x: selX + selWidth, y: selY + selHeight, cursor: 'nwse-resize' }
    ];

    resizeHandles = {};
    handlesData.forEach(handle => {
        const handleRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        handleRect.setAttribute("class", `resize-handle resize-handle-${handle.name}`);
        handleRect.setAttribute("x", handle.x - handleOffset);
        handleRect.setAttribute("y", handle.y - handleOffset);
        handleRect.setAttribute("width", handleSize);
        handleRect.setAttribute("height", handleSize);
        handleRect.setAttribute("fill", "#121212");
        handleRect.setAttribute("stroke", "#5B57D1");
        handleRect.setAttribute("stroke-width", anchorStrokeWidth);
        handleRect.setAttribute("vector-effect", "non-scaling-stroke");
        handleRect.style.cursor = handle.cursor;
        handleRect.setAttribute("data-anchor", handle.name);
        groupElement.appendChild(handleRect);
        resizeHandles[handle.name] = handleRect;

        handleRect.addEventListener('mousedown', (e) => {
            if (selectedTool && selectedTool.classList.contains("bxs-pointer")) {
                e.stopPropagation();
                startResize(e, handle.name);
            }
        });
    });

    const rotationAnchorPos = { x: selX + selWidth / 2, y: selY - 30 };
    const rotationAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rotationAnchor.setAttribute('cx', rotationAnchorPos.x);
    rotationAnchor.setAttribute('cy', rotationAnchorPos.y);
    rotationAnchor.setAttribute('r', 8);
    rotationAnchor.setAttribute('class', 'rotate-anchor');
    rotationAnchor.setAttribute('fill', '#121212');
    rotationAnchor.setAttribute('stroke', '#5B57D1');
    rotationAnchor.setAttribute('stroke-width', anchorStrokeWidth);
    rotationAnchor.setAttribute('vector-effect', 'non-scaling-stroke');
    rotationAnchor.style.cursor = 'grab';
    rotationAnchor.setAttribute('pointer-events', 'all');
    groupElement.appendChild(rotationAnchor);

    resizeHandles.rotate = rotationAnchor;

    rotationAnchor.addEventListener('mousedown', (e) => {
        if (selectedTool && selectedTool.classList.contains("bxs-pointer")) {
            e.stopPropagation();
            startRotation(e);
        }
    });

    rotationAnchor.addEventListener('mouseover', function() {
        if (!isResizing && !isDragging) {
            this.style.cursor = 'grab';
        }
    });

    rotationAnchor.addEventListener('mouseout', function() {
        if (!isResizing && !isDragging) {
            this.style.cursor = 'default';
        }
    });
}

function updateSelectionFeedback() {
    if (!selectedElement || !selectionBox) return;

    const textElement = selectedElement.querySelector('text');
    if (!textElement) return;

    const wasHidden = selectedElement.style.display === 'none';
    if (wasHidden) selectedElement.style.display = 'block';

    const bbox = textElement.getBBox();

    if (wasHidden) selectedElement.style.display = 'none';

    if (bbox.width === 0 && bbox.height === 0 && textElement.textContent.trim() !== "") {
        console.warn("BBox calculation resulted in zero dimensions. Feedback may be incorrect.");
    }

    const padding = 8;
    const handleSize = 10;
    const handleOffset = handleSize / 2;

    const selX = bbox.x - padding;
    const selY = bbox.y - padding;
    const selWidth = Math.max(bbox.width + 2 * padding, handleSize);
    const selHeight = Math.max(bbox.height + 2 * padding, handleSize);

    const outlinePoints = [
        [selX, selY],
        [selX + selWidth, selY],
        [selX + selWidth, selY + selHeight],
        [selX, selY + selHeight],
        [selX, selY]
    ];

    const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
    selectionBox.setAttribute("points", pointsAttr);

    const handlesData = [
        { name: 'nw', x: selX, y: selY },
        { name: 'ne', x: selX + selWidth, y: selY },
        { name: 'sw', x: selX, y: selY + selHeight },
        { name: 'se', x: selX + selWidth, y: selY + selHeight }
    ];

    handlesData.forEach(handle => {
        const handleRect = resizeHandles[handle.name];
        if (handleRect) {
            handleRect.setAttribute("x", handle.x - handleOffset);
            handleRect.setAttribute("y", handle.y - handleOffset);
        }
    });

    const rotationAnchor = resizeHandles.rotate;
    if (rotationAnchor) {
        const rotationAnchorPos = { x: selX + selWidth / 2, y: selY - 30 };
        rotationAnchor.setAttribute('cx', rotationAnchorPos.x);
        rotationAnchor.setAttribute('cy', rotationAnchorPos.y);
    }
}

function startRotation(event) {
    if (!selectedElement || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    isRotating = true;
    isDragging = false;
    isResizing = false;

    const textElement = selectedElement.querySelector('text');
    if (!textElement) return;

    const bbox = textElement.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    const mousePos = getSVGCoordinates(event);

    let centerPoint = svg.createSVGPoint();
    centerPoint.x = centerX;
    centerPoint.y = centerY;

    const groupTransform = selectedElement.transform.baseVal.consolidate();
    if (groupTransform) {
        centerPoint = centerPoint.matrixTransform(groupTransform.matrix);
    }

    rotationStartAngle = Math.atan2(mousePos.y - centerPoint.y, mousePos.x - centerPoint.x) * 180 / Math.PI;

    const currentTransform = selectedElement.transform.baseVal.consolidate();
    rotationStartTransform = currentTransform ? currentTransform.matrix : svg.createSVGMatrix();

    svg.style.cursor = 'grabbing';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
}

function removeSelectionFeedback() {
    if (selectedElement) {
        const box = selectedElement.querySelector(".selection-box");
        if (box) box.remove();

        selectedElement.querySelectorAll(".resize-handle").forEach(handle => handle.remove());
        selectedElement.querySelectorAll(".rotate-anchor").forEach(anchor => anchor.remove());
    }

    selectionBox = null;
    resizeHandles = {};
}

function selectElement(groupElement) {
    if (!groupElement || !groupElement.parentNode) return;
    if (groupElement === selectedElement) return;

    deselectElement();
    selectedElement = groupElement;
    selectedElement.classList.add("selected");
    createSelectionFeedback(selectedElement);
    console.log("Selected:", selectedElement);

    updateSelectedElement(selectedElement);
}

function deselectElement() {
    const activeEditor = document.querySelector("textarea.svg-text-editor");
    if (activeEditor) {
         let textElement = activeEditor.originalTextElement;
         if (textElement) {
            renderText(activeEditor, textElement, true);
         } else if (document.body.contains(activeEditor)) {
             document.body.removeChild(activeEditor);
         }
    }

    if (selectedElement) {
        removeSelectionFeedback();
        selectedElement.classList.remove("selected");
        console.log("Deselected:", selectedElement);
        selectedElement = null;

        updateSelectedElement(null);
    }

    if (isRotating) {
        isRotating = false;
        rotationStartAngle = 0;
        rotationStartTransform = null;
        svg.style.cursor = 'default';

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }
}

function startDrag(event) {
    if (!selectedElement || event.button !== 0) return;

     if (event.target.closest('.resize-handle')) {
         return;
     }

    isDragging = true;
    isResizing = false;
    event.preventDefault();

    const currentTransform = selectedElement.transform.baseVal.consolidate();
    const initialTranslateX = currentTransform ? currentTransform.matrix.e : 0;
    const initialTranslateY = currentTransform ? currentTransform.matrix.f : 0;

    startPoint = getSVGCoordinates(event);

    dragOffsetX = startPoint.x - initialTranslateX;
    dragOffsetY = startPoint.y - initialTranslateY;

    let textShape = null;
    if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
        textShape = shapes.find(shape => shape.shapeName === 'text' && shape.group === selectedElement);
    }

    if (textShape) {
        draggedShapeInitialFrameText = textShape.parentFrame || null;
        
        if (textShape.parentFrame) {
            textShape.parentFrame.temporarilyRemoveFromFrame(textShape);
        }
    }

    svg.style.cursor = 'grabbing';

    svg.addEventListener('mousemove', handleMouseMove);
    svg.addEventListener('mouseup', handleMouseUp);
}

function startResize(event, anchor) {
  if (!selectedElement || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  isResizing = true;
  isDragging = false;
  currentResizeHandle = anchor;

  const textElement = selectedElement.querySelector('text');
  if (!textElement) {
       console.error("Cannot start resize: text element not found.");
       isResizing = false;
       return;
  }

  startBBox = textElement.getBBox();
  startFontSize = parseFloat(textElement.getAttribute("font-size") || 30);
  if (isNaN(startFontSize)) startFontSize = 30;

  startPoint = getSVGCoordinates(event, selectedElement);

  const currentTransform = selectedElement.transform.baseVal.consolidate();
  initialGroupTx = currentTransform ? currentTransform.matrix.e : 0;
  initialGroupTy = currentTransform ? currentTransform.matrix.f : 0;

  const padding = 3;
  const startX = startBBox.x - padding;
  const startY = startBBox.y - padding;
  const startWidth = startBBox.width + 2 * padding;
  const startHeight = startBBox.height + 2 * padding;

  let hx = startX;
  let hy = startY;
  if (anchor.includes('e')) { hx = startX + startWidth; }
  if (anchor.includes('s')) { hy = startY + startHeight; }
  initialHandlePosRelGroup = { x: hx, y: hy };

  svg.style.cursor = resizeHandles[anchor]?.style.cursor || 'default';

  svg.addEventListener('mousemove', handleMouseMove);
  svg.addEventListener('mouseup', handleMouseUp);
}


const handleMouseMove = (event) => {
    if (!selectedElement) return;
    event.preventDefault();

    const svgRect = svg.getBoundingClientRect();
    lastMousePos = {
        x: event.clientX - svgRect.left, 
        y: event.clientY - svgRect.top
    };

    if (isDragging) {
        const currentPoint = getSVGCoordinates(event);
        const newTranslateX = currentPoint.x - dragOffsetX;
        const newTranslateY = currentPoint.y - dragOffsetY;

        const currentTransform = selectedElement.transform.baseVal.consolidate();
        if (currentTransform) {
            const matrix = currentTransform.matrix;
            const angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;

            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                const bbox = textElement.getBBox();
                const centerX = bbox.x + bbox.width / 2;
                const centerY = bbox.y + bbox.height / 2;

                selectedElement.setAttribute('transform',
                    `translate(${newTranslateX}, ${newTranslateY}) rotate(${angle}, ${centerX}, ${centerY})`
                );
            } else {
                selectedElement.setAttribute('transform', `translate(${newTranslateX}, ${newTranslateY})`);
            }
        } else {
            selectedElement.setAttribute('transform', `translate(${newTranslateX}, ${newTranslateY})`);
        }

        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            const textShape = shapes.find(shape => shape.shapeName === 'text' && shape.group === selectedElement);
            if (textShape) {
                textShape.updateFrameContainment();
            }
        }

        updateAttachedArrows(selectedElement);

    } else if (isResizing) {
        const textElement = selectedElement.querySelector('text');
        if (!textElement || !startBBox || startFontSize === null || !startPoint || !initialHandlePosRelGroup) return;

        const currentPoint = getSVGCoordinates(event, selectedElement);

        const startX = startBBox.x;
        const startY = startBBox.y;
        const startWidth = startBBox.width;
        const startHeight = startBBox.height;

        let anchorX, anchorY;

        switch (currentResizeHandle) {
            case 'nw':
                anchorX = startX + startWidth;
                anchorY = startY + startHeight;
                break;
            case 'ne':
                anchorX = startX;
                anchorY = startY + startHeight;
                break;
            case 'sw':
                anchorX = startX + startWidth;
                anchorY = startY;
                break;
            case 'se':
                anchorX = startX;
                anchorY = startY;
                break;
        }

        const newWidth = Math.abs(currentPoint.x - anchorX);
        const newHeight = Math.abs(currentPoint.y - anchorY);

        const chosenScale = newHeight / startHeight;

        const minScale = 0.1;
        const maxScale = 10.0;
        const clampedScale = Math.max(minScale, Math.min(chosenScale, maxScale));

        const newFontSize = startFontSize * clampedScale;
        const minFontSize = 5;
        const finalFontSize = Math.max(newFontSize, minFontSize);

        textElement.setAttribute("font-size", `${finalFontSize}px`);

        const currentBBox = textElement.getBBox();

        let newAnchorX, newAnchorY;

        switch (currentResizeHandle) {
            case 'nw':
                newAnchorX = currentBBox.x + currentBBox.width;
                newAnchorY = currentBBox.y + currentBBox.height;
                break;
            case 'ne':
                newAnchorX = currentBBox.x;
                newAnchorY = currentBBox.y + currentBBox.height;
                break;
            case 'sw':
                newAnchorX = currentBBox.x + currentBBox.width;
                newAnchorY = currentBBox.y;
                break;
            case 'se':
                newAnchorX = currentBBox.x;
                newAnchorY = currentBBox.y;
                break;
        }

        const deltaX = anchorX - newAnchorX;
        const deltaY = anchorY - newAnchorY;

        const currentTransform = selectedElement.transform.baseVal.consolidate();
        if (currentTransform) {
            const matrix = currentTransform.matrix;
            const angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;

            const newGroupTx = initialGroupTx + deltaX;
            const newGroupTy = initialGroupTy + deltaY;

            const centerX = currentBBox.x + currentBBox.width / 2;
            const centerY = currentBBox.y + currentBBox.height / 2;

            selectedElement.setAttribute('transform',
                `translate(${newGroupTx}, ${newGroupTy}) rotate(${angle}, ${centerX}, ${centerY})`
            );
        } else {
            const newGroupTx = initialGroupTx + deltaX;
            const newGroupTy = initialGroupTy + deltaY;
            selectedElement.setAttribute('transform', `translate(${newGroupTx}, ${newGroupTy})`);
        }

        updateAttachedArrows(selectedElement);

        clearTimeout(selectedElement.updateFeedbackTimeout);
        selectedElement.updateFeedbackTimeout = setTimeout(() => {
            updateSelectionFeedback();
            delete selectedElement.updateFeedbackTimeout;
        }, 0);

    } else if (isRotating) {
        const textElement = selectedElement.querySelector('text');
        if (!textElement) return;

        const bbox = textElement.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        const mousePos = getSVGCoordinates(event);

        let centerPoint = svg.createSVGPoint();
        centerPoint.x = centerX;
        centerPoint.y = centerY;

        const groupTransform = selectedElement.transform.baseVal.consolidate();
        if (groupTransform) {
            centerPoint = centerPoint.matrixTransform(groupTransform.matrix);
        }

        const currentAngle = Math.atan2(mousePos.y - centerPoint.y, mousePos.x - centerPoint.x) * 180 / Math.PI;

        const rotationDiff = currentAngle - rotationStartAngle;

        const newTransform = `translate(${rotationStartTransform.e}, ${rotationStartTransform.f}) rotate(${rotationDiff}, ${centerX}, ${centerY})`;
        selectedElement.setAttribute('transform', newTransform);

        updateAttachedArrows(selectedElement);

        updateSelectionFeedback();
    }
};



const handleMouseUp = (event) => {
    if (event.button !== 0) return;

    if (isDragging && selectedElement) {
        const currentTransform = selectedElement.transform.baseVal.consolidate();
        if (currentTransform) {
            const finalTranslateX = currentTransform.matrix.e;
            const finalTranslateY = currentTransform.matrix.f;

            const initialX = parseFloat(selectedElement.getAttribute("data-x")) || 0;
            const initialY = parseFloat(selectedElement.getAttribute("data-y")) || 0;

            let textShape = null;
            if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
                textShape = shapes.find(shape => shape.shapeName === 'text' && shape.group === selectedElement);
            }

            const oldPosWithFrame = {
                x: initialX,
                y: initialY,
                rotation: extractRotationFromTransform(selectedElement) || 0,
                parentFrame: draggedShapeInitialFrameText
            };
            const newPosWithFrame = {
                x: finalTranslateX,
                y: finalTranslateY,
                rotation: extractRotationFromTransform(selectedElement) || 0,
                parentFrame: textShape ? textShape.parentFrame : null
            };

            const stateChanged = initialX !== finalTranslateX || initialY !== finalTranslateY;
            const frameChanged = oldPosWithFrame.parentFrame !== newPosWithFrame.parentFrame;

            if (stateChanged || frameChanged) {
                pushTransformAction(
                    {
                        type: 'text',
                        element: selectedElement,
                        shapeName: 'text'
                    },
                    oldPosWithFrame,
                    newPosWithFrame
                );
            }

            if (textShape) {
                const finalFrame = hoveredFrameText;
                
                if (draggedShapeInitialFrameText !== finalFrame) {
                    if (draggedShapeInitialFrameText) {
                        draggedShapeInitialFrameText.removeShapeFromFrame(textShape);
                    }
                    
                    if (finalFrame) {
                        finalFrame.addShapeToFrame(textShape);
                    }
                    
                    if (frameChanged) {
                        pushFrameAttachmentAction(finalFrame || draggedShapeInitialFrameText, textShape, 
                            finalFrame ? 'attach' : 'detach', draggedShapeInitialFrameText);
                    }
                } else if (draggedShapeInitialFrameText) {
                    draggedShapeInitialFrameText.restoreToFrame(textShape);
                }
            }

            selectedElement.setAttribute("data-x", finalTranslateX);
            selectedElement.setAttribute("data-y", finalTranslateY);
            console.log("Drag End - Final Pos:", finalTranslateX, finalTranslateY);
        }

        draggedShapeInitialFrameText = null;

    } else if (isResizing && selectedElement) {
        const textElement = selectedElement.querySelector('text');
        if (textElement) {
            const finalFontSize = textElement.getAttribute("font-size");
            const initialFontSize = startFontSize;

            const currentTransform = selectedElement.transform.baseVal.consolidate();
            if (currentTransform && initialFontSize !== parseFloat(finalFontSize)) {
                const finalTranslateX = currentTransform.matrix.e;
                const finalTranslateY = currentTransform.matrix.f;

                pushTransformAction(
                    {
                        type: 'text',
                        element: selectedElement,
                        shapeName: 'text'
                    },
                    {
                        x: initialGroupTx,
                        y: initialGroupTy,
                        fontSize: initialFontSize,
                        rotation: extractRotationFromTransform(selectedElement) || 0
                    },
                    {
                        x: finalTranslateX,
                        y: finalTranslateY,
                        fontSize: parseFloat(finalFontSize),
                        rotation: extractRotationFromTransform(selectedElement) || 0
                    }
                );

                selectedElement.setAttribute("data-x", finalTranslateX);
                selectedElement.setAttribute("data-y", finalTranslateY);
                console.log("Resize End - Final Font Size:", finalFontSize);
            }

            clearTimeout(selectedElement.updateFeedbackTimeout);
            updateSelectionFeedback();
        }
    } else if (isRotating && selectedElement) {
        const currentTransform = selectedElement.transform.baseVal.consolidate();
        if (currentTransform && rotationStartTransform) {
            const initialRotation = Math.atan2(rotationStartTransform.b, rotationStartTransform.a) * 180 / Math.PI;
            const finalRotation = extractRotationFromTransform(selectedElement) || 0;

            if (Math.abs(initialRotation - finalRotation) > 1) {
                pushTransformAction(
                    {
                        type: 'text',
                        element: selectedElement,
                        shapeName: 'text'
                    },
                    {
                        x: rotationStartTransform.e,
                        y: rotationStartTransform.f,
                        rotation: initialRotation
                    },
                    {
                        x: currentTransform.matrix.e,
                        y: currentTransform.matrix.f,
                        rotation: finalRotation
                    }
                );
            }

            console.log("Rotation End");
        }
        updateSelectionFeedback();
    }

    if (hoveredFrameText) {
        hoveredFrameText.removeHighlight();
        hoveredFrameText = null;
    }

    isDragging = false;
    isResizing = false;
    isRotating = false;
    currentResizeHandle = null;
    startPoint = null;
    startBBox = null;
    startFontSize = null;
    dragOffsetX = undefined;
    dragOffsetY = undefined;
    initialHandlePosRelGroup = null;
    initialGroupTx = 0;
    initialGroupTy = 0;
    rotationStartAngle = 0;
    rotationStartTransform = null;

    svg.style.cursor = 'default';

    svg.removeEventListener('mousemove', handleMouseMove);
    svg.removeEventListener('mouseup', handleMouseUp);
};

function extractRotationFromTransform(element) {
    const currentTransform = element.transform.baseVal.consolidate();
    if (currentTransform) {
        const matrix = currentTransform.matrix;
        return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    }
    return 0;
}

const handleTextMouseDown = function (e) {
    const activeEditor = document.querySelector("textarea.svg-text-editor");
    if (activeEditor && activeEditor.contains(e.target)) {
         return;
    }
    if (activeEditor && !activeEditor.contains(e.target)) {
         let textElement = activeEditor.originalTextElement;
         if (textElement) {
            renderText(activeEditor, textElement, true);
         } else if (document.body.contains(activeEditor)){
             document.body.removeChild(activeEditor);
         }
    }

    if (isSelectionToolActive && e.button === 0) {
        const targetGroup = e.target.closest('g[data-type="text-group"]');

        if (targetGroup) {
             if (e.target.closest('.resize-handle') || e.target.closest('.rotate-anchor')) {
                 return; // Let resize/rotate handlers deal with this
             }

            if (targetGroup === selectedElement) {
                // If it's the selected element, start dragging
                startDrag(e);
            } else {
                // If it's a different text group, select it and then start dragging
                selectElement(targetGroup);
                startDrag(e);
            }
        } else {
            // Clicked on empty space, deselect
            deselectElement();
        }

    } else if (isTextToolActive && e.button === 0) {
         const targetGroup = e.target.closest('g[data-type="text-group"]');

        if (targetGroup) {
            // If any part of the text group is clicked, make the text editable
            let textEl = targetGroup.querySelector('text');
            if (textEl) {
                console.log("Editing existing text. Group:", targetGroup, "TextEl:", textEl);
                makeTextEditable(textEl, targetGroup);
                e.stopPropagation(); // Prevent further handling like creating new text
            } else {
                 console.warn("Could not find text element inside the group for editing, creating new text instead.");
                 deselectElement();
                 addText(e);
            }

        } else {
             console.log("Creating new text.");
             deselectElement();
             addText(e);
        }
    }
};

const handleTextMouseMove = function (e) {
    const svgRect = svg.getBoundingClientRect();
    lastMousePos = {
        x: e.clientX - svgRect.left, 
        y: e.clientY - svgRect.top
    };

    if (isTextToolActive) {
        svg.style.cursor = 'text';
    } else if (isSelectionToolActive) {
        const targetGroup = e.target.closest('g[data-type="text-group"]');
        if (targetGroup && !e.target.closest('.resize-handle') && !e.target.closest('.rotate-anchor')) {
            svg.style.cursor = 'grab'; // Changed to 'grab' to indicate draggable
        } else {
            svg.style.cursor = 'default';
        }
    }

    if (isTextToolActive && !isDragging && !isResizing && !isRotating) {
        const { x, y } = getSVGCoordinates(e);
        
        const tempTextBounds = {
            x: x - 50,
            y: y - 20,
            width: 100,
            height: 40
        };
        
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            let foundFrame = null;
            shapes.forEach(frame => {
                if (frame.shapeName === 'frame') {
                    if (frame.isShapeInFrame(tempTextBounds)) {
                        foundFrame = frame;
                    } else if (hoveredFrameText === frame) {
                        frame.removeHighlight();
                    }
                }
            });
            if (foundFrame && hoveredFrameText !== foundFrame) {
                foundFrame.highlightFrame();
            } else if (!foundFrame && hoveredFrameText) {
                hoveredFrameText.removeHighlight();
            }
            hoveredFrameText = foundFrame;
        }
    }
};

const handleTextMouseUp = function (e) {
    if (isSelectionToolActive) {
        const targetGroup = e.target.closest('g[data-type="text-group"]');
        const isResizeHandle = e.target.closest('.resize-handle');
        const isRotateAnchor = e.target.closest('.rotate-anchor');
        
        if (!targetGroup && !isResizeHandle && !isRotateAnchor && selectedElement) {
            deselectElement();
        }
    }

    if (hoveredFrameText) {
        hoveredFrameText.removeHighlight();
        hoveredFrameText = null;
    }
};

function updateAttachedArrows(textGroup) {
    if (!textGroup || textGroup.type !== 'text') return;
    
    shapes.forEach(shape => {
        if (shape && shape.shapeName === 'arrow' && typeof shape.updateAttachments === 'function') {
            if ((shape.attachedToStart && shape.attachedToStart.shape === textGroup) ||
                (shape.attachedToEnd && shape.attachedToEnd.shape === textGroup)) {
                shape.updateAttachments();
            }
        }
    });
}


textColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        textColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        const newColor = span.getAttribute("data-id");
        const oldColor = textColor;
        textColor = newColor;
        console.log("Set Default Text Color:", textColor);

        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                const currentColor = textElement.getAttribute('fill');

                if (currentColor !== newColor) {
                    pushOptionsChangeAction(
                        {
                            type: 'text',
                            element: selectedElement,
                            shapeName: 'text'
                        },
                        {
                            color: currentColor,
                            font: textElement.getAttribute('font-family'),
                            size: textElement.getAttribute('font-size'),
                            align: textElement.getAttribute('text-anchor')
                        },
                        {
                            color: newColor,
                            font: textElement.getAttribute('font-family'),
                            size: textElement.getAttribute('font-size'),
                            align: textElement.getAttribute('text-anchor')
                        }
                    );
                }

                textElement.setAttribute('fill', newColor);
            }
        }
    });
});

textFontOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        textFontOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        const newFont = span.getAttribute("data-id");
        const oldFont = textFont;
        textFont = newFont;
        console.log("Set Default Text Font:", textFont);

        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                const currentFont = textElement.getAttribute('font-family');

                if (currentFont !== newFont) {
                    pushOptionsChangeAction(
                        {
                            type: 'text',
                            element: selectedElement,
                            shapeName: 'text'
                        },
                        {
                            color: textElement.getAttribute('fill'),
                            font: currentFont,
                            size: textElement.getAttribute('font-size'),
                            align: textElement.getAttribute('text-anchor')
                        },
                        {
                            color: textElement.getAttribute('fill'),
                            font: newFont,
                            size: textElement.getAttribute('font-size'),
                            align: textElement.getAttribute('text-anchor')
                        }
                    );
                }

                textElement.setAttribute('font-family', newFont);
                setTimeout(updateSelectionFeedback, 0);
            }
        }
    });
});

textSizeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        textSizeOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        const newSize = span.getAttribute("data-id") + "px";
        const oldSize = textSize;
        textSize = newSize;
        console.log("Set Default Text Size:", textSize);

        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                const currentSize = textElement.getAttribute('font-size');

                if (currentSize !== newSize) {
                    pushOptionsChangeAction(
                        {
                            type: 'text',
                            element: selectedElement,
                            shapeName: 'text'
                        },
                        {
                            color: textElement.getAttribute('fill'),
                            font: textElement.getAttribute('font-family'),
                            size: currentSize,
                            align: textElement.getAttribute('text-anchor')
                        },
                        {
                            color: textElement.getAttribute('fill'),
                            font: textElement.getAttribute('font-family'),
                            size: newSize,
                            align: textElement.getAttribute('text-anchor')
                        }
                    );
                }

                textElement.setAttribute('font-size', newSize);
                setTimeout(updateSelectionFeedback, 0);
            }
        }
    });
});

textAlignOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        textAlignOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        const newAlign = span.getAttribute("data-id");
        const oldAlign = textAlign;
        textAlign = newAlign;
        console.log("Set Default Text Align:", textAlign);

        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                const currentAnchor = textElement.getAttribute('text-anchor');
                let newAnchor = 'start';
                if (newAlign === 'center') newAnchor = 'middle';
                else if (newAlign === 'right') newAnchor = 'end';

                if (currentAnchor !== newAnchor) {
                    pushOptionsChangeAction(
                        {
                            type: 'text',
                            element: selectedElement,
                            shapeName: 'text'
                        },
                        {
                            color: textElement.getAttribute('fill'),
                            font: textElement.getAttribute('font-family'),
                            size: textElement.getAttribute('font-size'),
                            align: currentAnchor
                        },
                        {
                            color: textElement.getAttribute('fill'),
                            font: textElement.getAttribute('font-family'),
                            size: textElement.getAttribute('font-size'),
                            align: newAnchor
                        }
                    );
                }

                textElement.setAttribute('text-anchor', newAnchor);
                setTimeout(updateSelectionFeedback, 0);
            }
        }
    });
});

document.querySelectorAll('.textCodeSpan').forEach(span => {
    span.addEventListener('click', (event) => {
        event.stopPropagation();
        document.querySelectorAll('.textCodeSpan').forEach(el => el.classList.remove('selected'));
        span.classList.add('selected');
        codeEditor = span.getAttribute('data-id') === 'true';
        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                textElement.setAttribute('data-code-mode', codeEditor ? 'true' : 'false');
                setTimeout(updateSelectionFeedback, 0);
            }
        }
    });
});

document.getElementById("textFontOptionsExpander").addEventListener("click", (event) => {
    event.stopPropagation();
    document.getElementById("textFont").classList.toggle("hidden");
})
export { handleTextMouseDown, handleTextMouseMove, handleTextMouseUp };