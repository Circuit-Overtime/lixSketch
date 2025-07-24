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

let textSize = "30px";
let textFont = "lixFont";
let textColor = "#fff";
let textAlign = "left";
let isCodeblock = true;

let textColorOptions = document.querySelectorAll(".textColorSpan");
let textFontOptions = document.querySelectorAll(".textFontSpan");
let textSizeOptions = document.querySelectorAll(".textSizeSpan");
let textAlignOptions = document.querySelectorAll(".textAlignSpan");
let textCodeOptions = document.querySelectorAll(".textCodeSpan");

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

// Frame attachment variables
let draggedShapeInitialFrameText = null;
let hoveredFrameText = null;

setTextReferences(selectedElement, updateSelectionFeedback, svg);

// Text class to make it consistent with other shapes for frame functionality
class TextShape {
    constructor(groupElement) {
        this.group = groupElement;
        this.shapeName = 'text';
        this.shapeID = groupElement.getAttribute('id') || `text-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;
        
        // Frame attachment properties
        this.parentFrame = null;
        
        // Update group attributes
        this.group.setAttribute('type', 'text');
        this.group.shapeName = 'text';
        this.group.shapeID = this.shapeID;
    }
    
    // Position and dimension properties for frame compatibility
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
        // Text width is determined by content and font size, not directly settable
        // This is here for frame compatibility but doesn't change the text
    }
    
    get height() {
        const textElement = this.group.querySelector('text');
        if (textElement) {
            return textElement.getBBox().height;
        }
        return 0;
    }
    
    set height(value) {
        // Text height is determined by content and font size, not directly settable
        // This is here for frame compatibility but doesn't change the text
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
        
        // Only update frame containment if we're actively dragging the shape itself
        // and not being moved by a parent frame
        if (isDragging && !this.isBeingMovedByFrame) {
            this.updateFrameContainment();
        }
        
        // Update attached arrows
        if (typeof updateAttachedArrows === 'function') {
            updateAttachedArrows(this.group);
        }
    }

    updateFrameContainment() {
        // Don't update if we're being moved by a frame
        if (this.isBeingMovedByFrame) return;
        
        let targetFrame = null;
        
        // Find which frame this shape is over
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            shapes.forEach(shape => {
                if (shape.shapeName === 'frame' && shape.isShapeInFrame(this)) {
                    targetFrame = shape;
                }
            });
        }
        
        // If we have a parent frame and we're being dragged, temporarily remove clipping
        if (this.parentFrame && isDragging) {
            this.parentFrame.temporarilyRemoveFromFrame(this);
        }
        
        // Update frame highlighting
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
        const padding = 8; // Selection padding
        
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

    // Add draw method for consistency with other shapes
    draw() {
        // Text doesn't need redrawing like other shapes, but we need this method for consistency
        if (selectedElement === this.group) {
            updateSelectionFeedback();
        }
    }

    // Add methods for frame compatibility
    removeSelection() {
        if (selectedElement === this.group) {
            deselectElement();
        }
    }

    selectShape() {
        selectElement(this.group);
    }
}

// Convert group element to our TextShape class
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
    textElement.setAttribute("fill", isCodeblock ? "#c9d1d9" : textColor);
    textElement.setAttribute("font-size", isCodeblock ? "14px" : textSize);
    textElement.setAttribute("font-family", isCodeblock ? "lixCode" : textFont);
    textElement.setAttribute("text-anchor", textAlignElement);
    textElement.setAttribute("cursor", "text");
    textElement.setAttribute("white-space", "pre");
    textElement.setAttribute("data-code-mode", isCodeblock);
    textElement.setAttribute("dominant-baseline", "hanging");
    textElement.textContent = "";
    
    gElement.setAttribute("data-x", x);
    gElement.setAttribute("data-y", y);
    textElement.setAttribute("data-initial-size", isCodeblock ? "14px" : textSize);
    textElement.setAttribute("data-initial-font", isCodeblock ? "lixCode" : textFont);
    textElement.setAttribute("data-initial-color", isCodeblock ? "#c9d1d9" : textColor);
    textElement.setAttribute("data-initial-align", textAlign);
    textElement.setAttribute("data-type", "text");
    
    gElement.appendChild(textElement);
    svg.appendChild(gElement);
    
    // Attach ID to both group and text element
    const shapeID = `text-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;
    gElement.setAttribute('id', shapeID);
    textElement.setAttribute('id', `${shapeID}-text`);
    
    // Create TextShape wrapper for frame functionality
    const textShape = wrapTextElement(gElement);
    
    // Add to shapes array for arrow attachment and frame functionality
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

    if (document.querySelector("textarea.svg-text-editor")) {
        console.log("Already editing.");
        return;
    }

    if (selectedElement) {
        deselectElement();
    }

    // Check if this text element is in code mode
    const isTextCodeMode = textElement.getAttribute('data-code-mode') === 'true';

    let input = document.createElement("textarea");
    input.className = "svg-text-editor";

    // Get text content from existing tspans
    let textContent = "";
    const tspans = textElement.querySelectorAll('tspan');
    if (tspans.length > 0) {
        tspans.forEach((tspan, index) => {
            textContent += tspan.textContent;
            if (index < tspans.length - 1) {
                textContent += "\n";
            }
        });
    } else {
        textContent = textElement.textContent;
    }

    input.value = textContent;

    // Get positioning and sizing info
    const svgRect = svg.getBoundingClientRect();
    
    let groupTransformMatrix = svg.createSVGMatrix();
    if (groupElement && groupElement.transform && groupElement.transform.baseVal) {
        const transformList = groupElement.transform.baseVal;
        if (transformList.numberOfItems > 0) {
            const consolidatedTransform = transformList.consolidate();
            if (consolidatedTransform) {
                groupTransformMatrix = consolidatedTransform.matrix;
            }
        }
    }

    const textBBox = textElement.getBBox();
    let pt = svg.createSVGPoint();
    pt.x = textBBox.x;
    pt.y = textBBox.y;
    let screenPt = pt.matrixTransform(groupTransformMatrix.multiply(svg.getScreenCTM()));

    // Get current text properties
    const currentFontSize = textElement.getAttribute("font-size") || "30px";
    const currentFontFamily = textElement.getAttribute("font-family") || "lixFont";
    const currentFill = textElement.getAttribute("fill") || "#fff";
    const currentAnchor = textElement.getAttribute("text-anchor") || "start";

    // Apply base styles
    input.style.position = "absolute";
    input.style.outline = "none";
    input.style.margin = "0";
    input.style.boxSizing = "border-box";
    input.style.resize = "none";
    input.style.whiteSpace = "pre";  // Prevent wrapping
    input.style.wordWrap = "normal";  // Prevent word breaking
    input.style.overflow = "visible";  // Allow content to be visible
    input.style.zIndex = "10000";
    input.style.border = "none";
    
    // Apply code mode specific styles
    if (isTextCodeMode) {
        input.style.fontFamily = "lixCode, monospace";
        input.style.fontSize = currentFontSize;
        input.style.lineHeight = "1.2em";
        input.style.background = "#0d1117";
        input.style.color = "#c9d1d9";
        input.style.border = "1px solid #30363d";
        input.style.borderRadius = "6px";
        input.style.padding = "8px";
        
        // Create highlighted display overlay for code mode
        const highlightOverlay = document.createElement("div");
        highlightOverlay.className = "syntax-highlight-overlay";
        highlightOverlay.style.cssText = `
            position: absolute;
            padding: 8px;
            margin: 0;
            box-sizing: border-box;
            font-family: lixCode, monospace;
            font-size: ${currentFontSize};
            line-height: 1.2em;
            white-space: pre;
            word-wrap: normal;
            overflow: visible;
            pointer-events: none;
            z-index: 9999;
            background: transparent;
            border-radius: 6px;
            border: 1px solid transparent;
        `;
        
        // Function to update syntax highlighting
        const updateHighlighting = () => {
            const code = input.value;
            if (code.trim()) {
                try {
                    const result = hljs.highlightAuto(code);
                    highlightOverlay.innerHTML = `<pre style="margin:0;padding:0;background:transparent;font-family:inherit;font-size:inherit;line-height:inherit;white-space:inherit;word-wrap:inherit;"><code class="hljs" style="background:transparent;padding:0;font-family:inherit;font-size:inherit;line-height:inherit;">${result.value}</code></pre>`;
                    console.log("Detected language:", result.language);
                } catch (error) {
                    console.error("Highlighting error:", error);
                    highlightOverlay.innerHTML = `<pre style="margin:0;padding:0;background:transparent;font-family:inherit;font-size:inherit;line-height:inherit;white-space:inherit;word-wrap:inherit;"><code style="background:transparent;padding:0;font-family:inherit;font-size:inherit;line-height:inherit;">${code}</code></pre>`;
                }
            } else {
                highlightOverlay.innerHTML = "";
            }
        };

        // Sync scrolling and sizing
        const syncOverlay = () => {
            highlightOverlay.scrollTop = input.scrollTop;
            highlightOverlay.scrollLeft = input.scrollLeft;
            highlightOverlay.style.width = input.style.width;
            highlightOverlay.style.height = input.style.height;
            highlightOverlay.style.left = input.style.left;
            highlightOverlay.style.top = input.style.top;
        };

        input.addEventListener('input', () => {
            updateHighlighting();
            syncOverlay();
        });
        input.addEventListener('scroll', syncOverlay);
        
        document.body.appendChild(highlightOverlay);
        
        // Store reference for cleanup
        input.highlightOverlay = highlightOverlay;
        
        // Initial highlighting will be done after sizing
    } else {
        // Normal text mode styles
        input.style.fontFamily = currentFontFamily;
        input.style.fontSize = currentFontSize;
        input.style.color = currentFill;
        input.style.lineHeight = "1.2em";
        input.style.backgroundColor = "transparent";
        input.style.padding = "2px";
        input.style.textAlign = currentAnchor === "middle" ? "center" : currentAnchor === "end" ? "right" : "left";
    }

    // Advanced auto-sizing function that prevents wrapping
    const calculateOptimalSize = () => {
        // Create a temporary element to measure text size
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: pre;
            word-wrap: normal;
            font-family: ${input.style.fontFamily};
            font-size: ${input.style.fontSize};
            line-height: ${input.style.lineHeight};
            padding: ${input.style.padding};
            border: ${input.style.border};
            box-sizing: ${input.style.boxSizing};
            border-radius: ${input.style.borderRadius};
        `;
        
        const content = input.value || 'M'; // Use 'M' as minimum size reference
        const lines = content.split('\n');
        
        // Calculate width based on longest line
        let maxWidth = 0;
        lines.forEach(line => {
            tempDiv.textContent = line || 'M'; // Ensure non-empty line for measurement
            document.body.appendChild(tempDiv);
            maxWidth = Math.max(maxWidth, tempDiv.offsetWidth);
            document.body.removeChild(tempDiv);
        });
        
        // Calculate height based on number of lines
        tempDiv.textContent = content || 'M';
        document.body.appendChild(tempDiv);
        const singleLineHeight = tempDiv.offsetHeight;
        const totalHeight = Math.max(singleLineHeight, lines.length * (singleLineHeight / Math.max(lines.length, 1)));
        document.body.removeChild(tempDiv);
        
        // Add some minimum size constraints
        const minWidth = isTextCodeMode ? 100 : 50;
        const minHeight = isTextCodeMode ? 40 : 20;
        
        // For code mode, add extra width to prevent horizontal scrolling
        const finalWidth = Math.max(maxWidth + (isTextCodeMode ? 20 : 10), minWidth);
        const finalHeight = Math.max(totalHeight, minHeight);
        
        return { width: finalWidth, height: finalHeight };
    };

    // Function to apply the calculated size
    const adjustSize = () => {
        const { width, height } = calculateOptimalSize();
        
        input.style.width = `${width}px`;
        input.style.height = `${height}px`;
        
        // Update highlight overlay size and position if in code mode
        if (isTextCodeMode && input.highlightOverlay) {
            input.highlightOverlay.style.width = input.style.width;
            input.highlightOverlay.style.height = input.style.height;
            input.highlightOverlay.style.left = input.style.left;
            input.highlightOverlay.style.top = input.style.top;
        }
    };

    // Position textarea after calculating size
    const positionAndSize = () => {
        // First calculate the size
        adjustSize();
        
        // Then position it
        input.style.left = `${screenPt.x + svgRect.left}px`;
        input.style.top = `${screenPt.y + svgRect.top}px`;
        
        // Update highlight overlay position if in code mode
        if (isTextCodeMode && input.highlightOverlay) {
            input.highlightOverlay.style.left = input.style.left;
            input.highlightOverlay.style.top = input.style.top;
            
            // Now do initial highlighting
            const updateHighlighting = () => {
                const code = input.value;
                if (code.trim()) {
                    try {
                        const result = hljs.highlightAuto(code);
                        input.highlightOverlay.innerHTML = `<pre style="margin:0;padding:0;background:transparent;font-family:inherit;font-size:inherit;line-height:inherit;white-space:inherit;word-wrap:inherit;"><code class="hljs" style="background:transparent;padding:0;font-family:inherit;font-size:inherit;line-height:inherit;">${result.value}</code></pre>`;
                        console.log("Detected language:", result.language);
                    } catch (error) {
                        console.error("Highlighting error:", error);
                        input.highlightOverlay.innerHTML = `<pre style="margin:0;padding:0;background:transparent;font-family:inherit;font-size:inherit;line-height:inherit;white-space:inherit;word-wrap:inherit;"><code style="background:transparent;padding:0;font-family:inherit;font-size:inherit;line-height:inherit;">${code}</code></pre>`;
                    }
                } else {
                    input.highlightOverlay.innerHTML = "";
                }
            };
            updateHighlighting();
        }
    };

    document.body.appendChild(input);

    // Initial positioning and sizing
    positionAndSize();

    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);

    // Update size on input, but debounce it for performance
    let resizeTimeout;
    input.addEventListener('input', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(adjustSize, 100);
    });

    // Event handlers
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
        if (!input.contains(event.target) && (!input.highlightOverlay || !input.highlightOverlay.contains(event.target))) {
            renderText(input, textElement, true);
            document.removeEventListener('mousedown', handleClickOutside, true);
        }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    input.handleClickOutside = handleClickOutside;

    groupElement.style.display = "none";
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

    // Clean up highlight overlay if it exists
    if (input.highlightOverlay && document.body.contains(input.highlightOverlay)) {
        document.body.removeChild(input.highlightOverlay);
    }

    document.body.removeChild(input);

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
    } else {
        // Clear existing content
        while (textElement.firstChild) {
            textElement.removeChild(textElement.firstChild);
        }

        const isTextCodeMode = textElement.getAttribute('data-code-mode') === 'true';
        const lines = text.split("\n");
        const x = textElement.getAttribute("x") || 0;

        if (isTextCodeMode) {
            // Apply code font
            textElement.setAttribute('font-family', 'lixCode');
            
            // Apply syntax highlighting to the text
            try {
                const result = hljs.highlightAuto(text);
                console.log("Rendering with syntax highlighting, detected language:", result.language);
                
                // Create highlighted HTML structure and convert to SVG tspans
                renderHighlightedCode(textElement, result.value, x);
                
            } catch (error) {
                console.error("Error applying syntax highlighting:", error);
                // Fallback to plain text rendering
                renderPlainText(textElement, lines, x);
            }
        } else {
            // Normal text rendering
            renderPlainText(textElement, lines, x);
        }

        gElement.style.display = 'block';

        // Update attached arrows after text content change
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

// Helper function to render plain text
function renderPlainText(textElement, lines, x) {
    lines.forEach((line, index) => {
        let tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("x", x);
        tspan.setAttribute("dy", index === 0 ? "0" : "1.2em");
        tspan.textContent = line.replace(/\u00A0/g, ' ') || " ";
        textElement.appendChild(tspan);
    });
}


// Helper function to render highlighted code
function renderHighlightedCode(textElement, highlightedHTML, x) {
    // Parse the highlighted HTML and convert to SVG tspans with colors
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = highlightedHTML;
    
    // Extract text content with color information
    const coloredSegments = extractColoredSegments(tempDiv);
    
    let currentLine = 0;
    let isFirstSegmentInLine = true;
    
    coloredSegments.forEach((segment, index) => {
        if (segment.text === '\n') {
            currentLine++;
            isFirstSegmentInLine = true;
            return;
        }
        
        if (segment.text.trim() === '' && segment.text !== ' ') return;
        
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        
        // Position the tspan
        if (isFirstSegmentInLine) {
            tspan.setAttribute("x", x);
            tspan.setAttribute("dy", currentLine === 0 ? "0" : "1.2em");
            isFirstSegmentInLine = false;
        }
        
        // Apply syntax highlighting color
        if (segment.color) {
            tspan.setAttribute("fill", segment.color);
        } else {
            tspan.setAttribute("fill", "#c9d1d9"); // Default code text color
        }
        
        // Apply text content
        tspan.textContent = segment.text;
        
        textElement.appendChild(tspan);
    });
}

// Helper function to extract colored text segments from highlighted HTML
function extractColoredSegments(element) {
    const segments = [];
    const colorMap = {
        'hljs-keyword': '#ff7b72',      // Keywords (red)
        'hljs-string': '#a5d6ff',       // Strings (light blue)
        'hljs-comment': '#8b949e',      // Comments (gray)
        'hljs-number': '#79c0ff',       // Numbers (blue)
        'hljs-function': '#d2a8ff',     // Functions (purple)
        'hljs-variable': '#ffa657',     // Variables (orange)
        'hljs-built_in': '#ffa657',     // Built-ins (orange)
        'hljs-type': '#ff7b72',         // Types (red)
        'hljs-class': '#f0883e',        // Classes (orange)
        'hljs-tag': '#7ee787',          // HTML tags (green)
        'hljs-attr': '#79c0ff',         // Attributes (blue)
        'hljs-literal': '#79c0ff',      // Literals (blue)
        'hljs-operator': '#f85149',     // Operators (red)
        'hljs-punctuation': '#c9d1d9',  // Punctuation (light gray)
        'hljs-title': '#d2a8ff',        // Function/method names (purple)
        'hljs-params': '#ffa657',       // Parameters (orange)
        'hljs-property': '#79c0ff',     // Properties (blue)
        'hljs-regexp': '#7ee787'        // Regular expressions (green)
    };
    
    function traverse(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text) {
                // Handle newlines explicitly
                const parts = text.split('\n');
                parts.forEach((part, partIndex) => {
                    if (partIndex > 0) {
                        segments.push({ text: '\n', color: null, newLine: true });
                    }
                    if (part.length > 0) {
                        const parentClass = node.parentElement?.className || '';
                        const color = getColorFromClass(parentClass, colorMap);
                        segments.push({ text: part, color: color, newLine: false });
                    }
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            for (let child of node.childNodes) {
                traverse(child);
            }
        }
    }
    
    traverse(element);
    return segments;
}


// Helper function to get color from CSS class
function getColorFromClass(className, colorMap) {
    for (const [cls, color] of Object.entries(colorMap)) {
        if (className.includes(cls)) {
            return color;
        }
    }
    return '#c9d1d9'; // Default color (light gray)
}


function createSelectionFeedback(groupElement) {
    if (!groupElement) return;
    removeSelectionFeedback();

    const textElement = groupElement.querySelector('text');
    if (!textElement) {
         console.warn("Cannot create selection feedback: text element not found in group.");
         return;
    }

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

    const textElement = groupElement.querySelector('text');
    if (textElement) {
        const storedCodeMode = textElement.getAttribute('data-code-mode') === 'true';
        if (storedCodeMode !== isCodeblock) {
            isCodeblock = storedCodeMode;
            // Update UI to reflect the code mode
            textCodeOptions.forEach(el => el.classList.remove("selected"));
            const targetOption = document.querySelector(`.textCodeSpan[data-id="${isCodeblock}"]`);
            if (targetOption) targetOption.classList.add("selected");
        }
    }

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

    // Find the TextShape wrapper for frame functionality
    let textShape = null;
    if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
        textShape = shapes.find(shape => shape.shapeName === 'text' && shape.group === selectedElement);
    }

    if (textShape) {
        // Store initial frame state
        draggedShapeInitialFrameText = textShape.parentFrame || null;
        
        // Temporarily remove from frame clipping if dragging
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

    // Keep lastMousePos in screen coordinates for other functions
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

        // Update frame containment for TextShape wrapper
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            const textShape = shapes.find(shape => shape.shapeName === 'text' && shape.group === selectedElement);
            if (textShape) {
                textShape.updateFrameContainment();
            }
        }

        // Update attached arrows during dragging
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

        // Update attached arrows during resizing
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

        // Update attached arrows during rotation
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

            // Find the TextShape wrapper for frame tracking
            let textShape = null;
            if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
                textShape = shapes.find(shape => shape.shapeName === 'text' && shape.group === selectedElement);
            }

            // Add frame information for undo tracking
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

            // Handle frame containment changes after drag
            if (textShape) {
                const finalFrame = hoveredFrameText;
                
                // If shape moved to a different frame
                if (draggedShapeInitialFrameText !== finalFrame) {
                    // Remove from initial frame
                    if (draggedShapeInitialFrameText) {
                        draggedShapeInitialFrameText.removeShapeFromFrame(textShape);
                    }
                    
                    // Add to new frame
                    if (finalFrame) {
                        finalFrame.addShapeToFrame(textShape);
                    }
                    
                    // Track the frame change for undo
                    if (frameChanged) {
                        pushFrameAttachmentAction(finalFrame || draggedShapeInitialFrameText, textShape, 
                            finalFrame ? 'attach' : 'detach', draggedShapeInitialFrameText);
                    }
                } else if (draggedShapeInitialFrameText) {
                    // Shape stayed in same frame, restore clipping
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

    // Clear frame highlighting
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

// EXPORTED EVENT HANDLERS
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
             if (e.target.closest('.resize-handle')) {
                 return;
             }

            if (targetGroup === selectedElement) {
                startDrag(e);
            } else {
                selectElement(targetGroup);
                startDrag(e);
            }
        } else {
            deselectElement();
        }

    } else if (isTextToolActive && e.button === 0) {
         const targetGroup = e.target.closest('g[data-type="text-group"]');

        if (targetGroup && (e.target.tagName === "text" || e.target.tagName === "tspan")) {
            let textEl = targetGroup.querySelector('text');

            if (textEl && targetGroup) {
                console.log("Editing existing text. Group:", targetGroup, "TextEl:", textEl);
                makeTextEditable(textEl, targetGroup);
                e.stopPropagation();
            } else {
                 console.warn("Could not find text element or group for editing, creating new text instead.");
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
    // Keep lastMousePos in screen coordinates for other functions
    const svgRect = svg.getBoundingClientRect();
    lastMousePos = {
        x: e.clientX - svgRect.left, 
        y: e.clientY - svgRect.top
    };

    // Handle cursor changes for text tool
    if (isTextToolActive) {
        svg.style.cursor = 'text';
    } else if (isSelectionToolActive) {
        const targetGroup = e.target.closest('g[data-type="text-group"]');
        if (targetGroup) {
            svg.style.cursor = 'move';
        } else {
            svg.style.cursor = 'default';
        }
    }

    // Check for frame containment while creating text
    if (isTextToolActive && !isDragging && !isResizing && !isRotating) {
        // Get current mouse position for frame highlighting preview
        const { x, y } = getSVGCoordinates(e);
        
        // Create temporary text bounds for frame checking
        const tempTextBounds = {
            x: x - 50,
            y: y - 20,
            width: 100,
            height: 40
        };
        
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            shapes.forEach(frame => {
                if (frame.shapeName === 'frame') {
                    if (frame.isShapeInFrame(tempTextBounds)) {
                        frame.highlightFrame();
                        hoveredFrameText = frame;
                    } else if (hoveredFrameText === frame) {
                        frame.removeHighlight();
                        hoveredFrameText = null;
                    }
                }
            });
        }
    }
};

const handleTextMouseUp = function (e) {
    // Handle text deselection when clicking outside
    if (isSelectionToolActive) {
        const targetGroup = e.target.closest('g[data-type="text-group"]');
        const isResizeHandle = e.target.closest('.resize-handle');
        const isRotateAnchor = e.target.closest('.rotate-anchor');
        
        // If we didn't click on text or its controls, deselect
        if (!targetGroup && !isResizeHandle && !isRotateAnchor && selectedElement) {
            deselectElement();
        }
    }

    // Clear frame highlighting when done with text tool operations
    if (hoveredFrameText) {
        hoveredFrameText.removeHighlight();
        hoveredFrameText = null;
    }
};

function updateAttachedArrows(textGroup) {
    if (!textGroup || textGroup.type !== 'text') return;
    
    // Find all arrows attached to this text
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


textCodeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        textCodeOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        const newCodeMode = span.getAttribute("data-id") === "true";
        const oldCodeMode = isCodeblock;
        isCodeblock = newCodeMode;
        console.log("Set Code Mode:", isCodeblock);

        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                const oldFont = textElement.getAttribute('font-family');
                const newFont = newCodeMode ? 'lixCode' : textFont;
                
                // Store code mode in element attribute
                textElement.setAttribute('data-code-mode', isCodeblock);
                textElement.setAttribute('font-family', newFont);
                
                // Re-render the text with new formatting
                const currentContent = extractTextContent(textElement);
                if (currentContent.trim()) {
                    // Clear existing content
                    while (textElement.firstChild) {
                        textElement.removeChild(textElement.firstChild);
                    }
                    
                    // Re-render with new mode
                    const lines = currentContent.split("\n");
                    const x = textElement.getAttribute("x") || 0;
                    
                    if (newCodeMode) {
                        try {
                            const result = hljs.highlightAuto(currentContent);
                            renderHighlightedCode(textElement, result.value, x);
                        } catch (error) {
                            console.error("Error applying syntax highlighting:", error);
                            renderPlainText(textElement, lines, x);
                        }
                    } else {
                        renderPlainText(textElement, lines, x);
                    }
                }
                
                // Push options change for undo/redo
                pushOptionsChangeAction(
                    {
                        type: 'text',
                        element: selectedElement,
                        shapeName: 'text'
                    },
                    {
                        color: textElement.getAttribute('fill'),
                        font: oldFont,
                        size: textElement.getAttribute('font-size'),
                        align: textElement.getAttribute('text-anchor'),
                        codeMode: oldCodeMode
                    },
                    {
                        color: textElement.getAttribute('fill'),
                        font: newFont,
                        size: textElement.getAttribute('font-size'),
                        align: textElement.getAttribute('text-anchor'),
                        codeMode: newCodeMode
                    }
                );
                
                setTimeout(updateSelectionFeedback, 0);
            }
        }
    });
});

// Helper function to extract text content from SVG text element
function extractTextContent(textElement) {
    let content = "";
    const tspans = textElement.querySelectorAll('tspan');
    if (tspans.length > 0) {
        tspans.forEach((tspan, index) => {
            content += tspan.textContent;
            if (index < tspans.length - 1) {
                content += "\n";
            }
        });
    } else {
        content = textElement.textContent;
    }
    return content;
}

export { handleTextMouseDown, handleTextMouseMove, handleTextMouseUp };