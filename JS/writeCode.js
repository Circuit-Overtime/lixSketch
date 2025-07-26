import {
    pushCreateAction,
    pushDeleteActionWithAttachments,
    pushTransformAction,
    pushOptionsChangeAction,
    pushFrameAttachmentAction,
    setTextReferences,
    updateSelectedElement
} from './undoAndRedo.js';
import { cleanupAttachments } from './drawArrow.js';

let codeTextSize = "25px";
let codeTextFont = "lixCode"; 
let codeTextColor = "#fff";
let codeTextAlign = "left"; 

let codeTextColorOptions = document.querySelectorAll(".textColorSpan");
let codeTextFontOptions = document.querySelectorAll(".textFontSpan");
let codeTextSizeOptions = document.querySelectorAll(".textSizeSpan");
let codeTextAlignOptions = document.querySelectorAll(".textAlignSpan"); 

let selectedCodeBlock = null;
let codeSelectionBox = null;
let codeResizeHandles = {};
let codeDragOffsetX, codeDragOffsetY;
let isCodeDragging = false;
let isCodeResizing = false;
let currentCodeResizeHandle = null;
let startCodeBBox = null;
let startCodeFontSize = null;
let startCodePoint = null;
let isCodeRotating = false;
let codeRotationStartAngle = 0;
let codeRotationStartTransform = null;
let initialCodeHandlePosRelGroup = null;
let initialCodeGroupTx = 0;
let initialCodeGroupTy = 0;


// Frame attachment variables for code blocks
let draggedCodeInitialFrame = null;
let hoveredCodeFrame = null;

setTextReferences(selectedCodeBlock, updateCodeSelectionFeedback, svg);

// Text class to make it consistent with other shapes for frame functionality
class CodeShape {
    constructor(groupElement) {
        this.group = groupElement;
        this.shapeName = 'code';
        this.shapeID = groupElement.getAttribute('id') || `code-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;
        
        // Frame attachment properties
        this.parentFrame = null;
        
        // Update group attributes
        this.group.setAttribute('type', 'code');
        this.group.shapeName = 'code';
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
        const codeBlockContainer = this.group.querySelector('foreignObject');
        if (codeBlockContainer) {
            const bbox = codeBlockContainer.getBBox();
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
        const codeBlockContainer = this.group.querySelector('foreignObject');
        if (codeBlockContainer) {
            const bbox = codeBlockContainer.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            this.group.setAttribute('transform', `translate(${currentX}, ${value}) rotate(${rotation}, ${centerX}, ${centerY})`);
        } else {
            this.group.setAttribute('transform', `translate(${currentX}, ${value})`);
        }
        this.group.setAttribute('data-y', value);
    }
    
    get width() {
        const codeElement = this.group.querySelector('text');
        if (codeElement) {
            return codeElement.getBBox().width;
        }
        return 0;
    }
    
    set width(value) {
        const codeBlockContainer = this.group.querySelector('foreignObject');
        if (codeBlockContainer) {
            codeBlockContainer.setAttribute('width', value);
            // This might trigger a reflow in the foreignObject content
            const codeEditor = codeBlockContainer.querySelector('.svg-code-editor');
            if (codeEditor) {
                codeEditor.style.width = `${value}px`;
                adjustCodeEditorSize(codeEditor);
            }
        }
    }
    
    get height() {
        const codeElement = this.group.querySelector('text');
        if (codeElement) {
            return codeElement.getBBox().height;
        }
        return 0;
    }
    
    set height(value) {
        const codeBlockContainer = this.group.querySelector('foreignObject');
        if (codeBlockContainer) {
            codeBlockContainer.setAttribute('height', value);
            const codeEditor = codeBlockContainer.querySelector('.svg-code-editor');
            if (codeEditor) {
                codeEditor.style.height = `${value}px`;
                adjustCodeEditorSize(codeEditor);
            }
        }
    }
    
    get rotation() {
        return extractRotationFromTransform(this.group) || 0;
    }
    
    set rotation(value) {
        const currentTransform = this.group.transform.baseVal.consolidate();
        const currentX = currentTransform ? currentTransform.matrix.e : 0;
        const currentY = currentTransform ? currentTransform.matrix.f : 0;
        const codeBlockContainer = this.group.querySelector('foreignObject');
        if (codeBlockContainer) {
            const bbox = codeBlockContainer.getBBox();
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
        if (isCodeDragging && !this.isBeingMovedByFrame) {
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
        if (this.parentFrame && isCodeDragging) {
            this.parentFrame.temporarilyRemoveFromFrame(this);
        }
        
        // Update frame highlighting
        if (hoveredCodeFrame && hoveredCodeFrame !== targetFrame) {
            hoveredCodeFrame.removeHighlight();
        }
        
        if (targetFrame && targetFrame !== hoveredCodeFrame) {
            targetFrame.highlightFrame();
        }
        
        hoveredCodeFrame = targetFrame;
    }

    contains(x, y) {
        const codeElement = this.group.querySelector('text');
        if (!codeElement) return false;
        
        const bbox = codeElement.getBBox();
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
        if (selectedCodeBlock === this.group) {
            updateCodeSelectionFeedback();
        }
    }

    // Add methods for frame compatibility
    removeSelection() {
        if (selectedCodeBlock === this.group) {
            deselectCodeBlock();
        }
    }

    selectShape() {
        selectCodeBlock(this.group);
    }
}

// Convert group element to our CodeShape class
function wrapCodeElement(groupElement) {
    const codeShape = new CodeShape(groupElement);
    return codeShape;
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


function addCodeBlock(event) {
    let { x, y } = getSVGCoordinates(event);

    let gElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gElement.setAttribute("data-type", "code-group");
    gElement.setAttribute("transform", `translate(${x}, ${y})`);

    // Create background rectangle for code block
    let backgroundRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    backgroundRect.setAttribute("class", "code-background");
    backgroundRect.setAttribute("x", -10); // Padding
    backgroundRect.setAttribute("y", -10); // Padding
    backgroundRect.setAttribute("width", 300); // Initial width
    backgroundRect.setAttribute("height", 60); // Initial height
    backgroundRect.setAttribute("fill", "#212121"); // Dark background
    backgroundRect.setAttribute("stroke", "#666");
    backgroundRect.setAttribute("stroke-width", "1");
    backgroundRect.setAttribute("rx", "4"); // Rounded corners
    backgroundRect.setAttribute("ry", "4");
    gElement.appendChild(backgroundRect);

    // Create SVG text element
    let codeElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    let textAlignElement = "start";
    if (codeTextAlign === "center") textAlignElement = "middle";
    else if (codeTextAlign === "right") textAlignElement = "end";

    codeElement.setAttribute("x", 0);
    codeElement.setAttribute("y", 0);
    codeElement.setAttribute("fill", codeTextColor);
    codeElement.setAttribute("font-size", codeTextSize);
    codeElement.setAttribute("font-family", codeTextFont);
    codeElement.setAttribute("text-anchor", textAlignElement);
    codeElement.setAttribute("cursor", "text");
    codeElement.setAttribute("white-space", "pre");
    codeElement.setAttribute("dominant-baseline", "hanging");
    codeElement.textContent = "";

    gElement.setAttribute("data-x", x);
    gElement.setAttribute("data-y", y);
    codeElement.setAttribute("data-initial-size", codeTextSize);
    codeElement.setAttribute("data-initial-font", codeTextFont);
    codeElement.setAttribute("data-initial-color", codeTextColor);
    codeElement.setAttribute("data-initial-align", codeTextAlign);
    codeElement.setAttribute("data-type", "code");
    gElement.appendChild(codeElement);
    svg.appendChild(gElement);
    
    // Attach ID to both group and code element
    const shapeID = `code-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;
    gElement.setAttribute('id', shapeID);
    codeElement.setAttribute('id', `${shapeID}-code`);
    
    // Create CodeShape wrapper for frame functionality
    const codeShape = wrapCodeElement(gElement);
    
    // Add to shapes array for arrow attachment and frame functionality
    if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
        shapes.push(codeShape);
    }
    
    pushCreateAction({
        type: 'code',
        element: codeShape,
        shapeName: 'code'
    });

    makeCodeEditable(codeElement, gElement);
}

// Function to update highlight.js on content change
function updateSyntaxHighlighting(editor) {
    if (window.hljs) {
        window.hljs.highlightElement(editor);
    }
}

function adjustCodeEditorSize(editor) {
    const foreignObject = editor.closest('foreignObject');
    const codeContainer = editor.closest('.svg-code-container');
    if (!foreignObject || !codeContainer) return;

    const svgRect = svg.getBoundingClientRect();

    // Allow textarea to expand freely
    editor.style.overflow = 'visible';
    editor.style.height = 'auto';
    editor.style.width = 'auto';
    editor.style.whiteSpace = 'pre'; // No wrapping

    // Calculate content size
    let minContentWidth = editor.scrollWidth + (parseFloat(codeContainer.style.paddingLeft) || 0) + (parseFloat(codeContainer.style.paddingRight) || 0);
    let minContentHeight = editor.scrollHeight + (parseFloat(codeContainer.style.paddingTop) || 0) + (parseFloat(codeContainer.style.paddingBottom) || 0);

    // Clamp to SVG bounds
    const editorRect = editor.getBoundingClientRect();
    const maxWidth = svgRect.width - (editorRect.left - svgRect.left);
    const maxHeight = svgRect.height - (editorRect.top - svgRect.top);

    let newWidth = Math.min(Math.max(minContentWidth, 50), maxWidth);
    let newHeight = Math.min(Math.max(minContentHeight, 30), maxHeight);

    foreignObject.setAttribute('width', newWidth);
    foreignObject.setAttribute('height', newHeight);

    editor.style.width = `${newWidth - (parseFloat(codeContainer.style.paddingLeft) || 0) - (parseFloat(codeContainer.style.paddingRight) || 0)}px`;
    editor.style.height = `${newHeight - (parseFloat(codeContainer.style.paddingTop) || 0) - (parseFloat(codeContainer.style.paddingBottom) || 0)}px`;

    // Overflow only if content exceeds container
    if (editor.scrollHeight > editor.clientHeight || editor.scrollWidth > editor.clientWidth) {
        editor.style.overflow = 'auto';
    } else {
        editor.style.overflow = 'hidden';
    }

    if (selectedCodeBlock && selectedCodeBlock.contains(foreignObject)) {
        updateCodeSelectionFeedback();
    }
}

function makeCodeEditable(codeElement, groupElement) {
    console.log("Making code editable");

    if (document.querySelector("textarea.svg-code-editor")) {
        console.log("Already editing another code block.");
        return;
    }

    if (selectedCodeBlock) {
        deselectCodeBlock();
    }

    // Hide the selection feedback for the element being edited
    removeCodeSelectionFeedback();

    let input = document.createElement("textarea");
    input.className = "svg-code-editor";

    let codeContent = "";
    const tspans = codeElement.querySelectorAll('tspan tspan');
    if (tspans.length > 0) {
        tspans.forEach((tspan, index) => {
            codeContent += tspan.textContent.replace(/ /g, '\u00A0');
            if (index < tspans.length - 1) {
                codeContent += "\n";
            }
        });
    } else {
        codeContent = codeElement.textContent.replace(/ /g, '\u00A0');
    }

    input.value = codeContent;
    input.style.position = "absolute";
    input.style.outline = "none";
    input.style.padding = "8px";
    input.style.margin = "0";
    input.style.boxSizing = "border-box";
    input.style.overflow = "hidden";
    input.style.resize = "none";
    input.style.whiteSpace = "pre";
    input.style.width = "auto";
    input.style.height = "auto";
    input.style.overflow = "visible";
    input.style.minHeight = "1.2em";
    input.style.zIndex = "10000";
    input.style.fontFamily = "monospace";
    input.style.tabSize = "4";

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

    const codeBBox = codeElement.getBBox();

    let pt = svg.createSVGPoint();
    pt.x = codeBBox.x - 8; // Account for padding
    pt.y = codeBBox.y - 8;

    let screenPt = pt.matrixTransform(groupTransformMatrix.multiply(svg.getScreenCTM()));

    input.style.left = `${screenPt.x + svgRect.left}px`;
    input.style.top = `${screenPt.y + svgRect.top}px`;

    const currentFontSize = codeElement.getAttribute("font-size") || codeTextSize;
    const currentFontFamily = codeElement.getAttribute("font-family") || codeTextFont;
    const currentFill = codeElement.getAttribute("fill") || codeTextColor;
    const currentAnchor = codeElement.getAttribute("text-anchor") || "start";
    
    input.style.fontSize = currentFontSize;
    input.style.fontFamily = currentFontFamily;
    input.style.color = currentFill;
    input.style.lineHeight = "1.2em";
    input.style.textAlign = currentAnchor === "middle" ? "center" : currentAnchor === "end" ? "right" : "left";
    input.style.backgroundColor = "#212121"; // Match the background color
    input.style.border = "1px solid #666";
    input.style.borderRadius = "4px";

    document.body.appendChild(input);

    // Auto-resize functions
    const adjustHeight = () => {
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
        const maxHeight = svgRect.height - (screenPt.y);
        if (input.scrollHeight > maxHeight) {
            input.style.height = maxHeight + 'px';
            input.style.overflowY = 'auto';
        } else {
            input.style.overflowY = 'hidden';
        }
    };

    const adjustWidth = () => {
        input.style.width = 'auto';
        const maxWidth = svgRect.width - (screenPt.x);
        if (input.scrollWidth > maxWidth) {
            input.style.width = maxWidth + 'px';
            input.style.overflowX = 'auto';
        } else {
            input.style.width = input.scrollWidth + 20 + 'px';
            input.style.overflowX = 'hidden';
        }
    };
    
    adjustHeight();
    adjustWidth();

    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);

    input.addEventListener('input', adjustHeight);
    input.addEventListener('input', adjustWidth);

    // Handle tab key for indentation
    input.addEventListener("keydown", function (e) {
        if (e.key === "Tab") {
            e.preventDefault();
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.substring(0, start) + "\t" + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start + 1;
            adjustHeight();
            adjustWidth();
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            renderCode(input, codeElement, true);
        } else if (e.key === "Escape") {
            e.preventDefault();
            renderCode(input, codeElement, true);
        }
    });

    input.originalCodeElement = codeElement;
    input.codeGroup = groupElement;

    const handleClickOutside = (event) => {
        if (!input.contains(event.target)) {
            renderCode(input, codeElement, true);
            document.removeEventListener('mousedown', handleClickOutside, true);
        }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    input.handleClickOutside = handleClickOutside;

    groupElement.style.display = "none";
}


function renderCode(input, codeElement, deleteIfEmpty = false) {
    if (!input || !document.body.contains(input)) {
         console.warn("RenderCode called but input textarea is already removed.");
         return;
    }

    const code = input.value || "";
    const gElement = input.codeGroup;

    if (input.handleClickOutside) {
        document.removeEventListener('mousedown', input.handleClickOutside, true);
    }

    document.body.removeChild(input);

    if (!gElement || !codeElement) {
        console.error("RenderCode cannot find original group or code element.");
        return;
    }

    if (!gElement.parentNode) {
        console.warn("RenderCode: Group element no longer attached to SVG.");
        if (selectedCodeBlock === gElement) {
             deselectCodeBlock();
        }
        return;
    }

    if (deleteIfEmpty && code.trim() === "") {
        // Find the CodeShape wrapper
        let codeShape = null;
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            codeShape = shapes.find(shape => shape.shapeName === 'code' && shape.group === gElement);
            if (codeShape) {
                const idx = shapes.indexOf(codeShape);
                if (idx !== -1) shapes.splice(idx, 1);
            }
        }

        pushDeleteActionWithAttachments({
            type: 'code',
            element: codeShape || gElement,
            shapeName: 'code'
        });

        if (typeof cleanupAttachments === 'function') {
            cleanupAttachments(gElement);
        }

        svg.removeChild(gElement);
        if (selectedCodeBlock === gElement) {
            selectedCodeBlock = null;
            removeCodeSelectionFeedback();
        }
    } else {
        // Clear existing content
        while (codeElement.firstChild) {
            codeElement.removeChild(codeElement.firstChild);
        }

        // Split into lines and create tspans with syntax highlighting
        const lines = code.split("\n");
        const x = codeElement.getAttribute("x") || 0;

        lines.forEach((line, index) => {
            if (window.hljs && line.trim()) {
                // Get syntax highlighting for the line
                const result = window.hljs.highlightAuto(line);
                createHighlightedTspans(result.value, codeElement, x, index === 0 ? "0" : "1.2em");
            } else {
                // Create plain tspan for empty lines or when hljs is not available
                let tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                tspan.setAttribute("x", x);
                tspan.setAttribute("dy", index === 0 ? "0" : "1.2em");
                tspan.textContent = line.replace(/\u00A0/g, ' ') || " ";
                codeElement.appendChild(tspan);
            }
        });

        // Update background rectangle to fit content
        updateCodeBackground(gElement, codeElement);

        gElement.style.display = 'block';

        // Update attached arrows after code content change
        updateAttachedArrows(gElement);

        if (selectedCodeBlock === gElement) {
            setTimeout(updateCodeSelectionFeedback, 0);
        }
    }

    if (selectedTool && selectedTool.classList.contains('bxs-pointer') && gElement.parentNode === svg) {
        selectCodeBlock(gElement);
    } else if (selectedCodeBlock === gElement) {
        deselectCodeBlock();
    }
}


function createHighlightedTspans(highlightedHtml, parentElement, x, dy) {
    // Create a temporary div to parse the highlighted HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = highlightedHtml;
    
    let currentTspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    currentTspan.setAttribute("x", x);
    currentTspan.setAttribute("dy", dy);
    
    // Process all nodes in the highlighted HTML
    processHighlightedNodes(tempDiv, currentTspan, parentElement, x);
    
    // If currentTspan has content, add it to parent
    if (currentTspan.textContent || currentTspan.childNodes.length > 0) {
        parentElement.appendChild(currentTspan);
    }
}

// Recursive function to process highlighted nodes
function processHighlightedNodes(node, currentTspan, parentElement, x) {
    for (let child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            // Add text content to current tspan
            if (child.textContent) {
                currentTspan.textContent += child.textContent;
            }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            // Create a new tspan for styled content
            let styledTspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            styledTspan.textContent = child.textContent;
            
            // Apply syntax highlighting colors based on class
            const className = child.className || '';
            if (className.includes('hljs-keyword')) {
                styledTspan.setAttribute("fill", "#569cd6"); 
            } else if (className.includes('hljs-string')) {
                styledTspan.setAttribute("fill", "#ce9178"); 
            } else if (className.includes('hljs-comment')) {
                styledTspan.setAttribute("fill", "#6a9955"); 
            } else if (className.includes('hljs-number')) {
                styledTspan.setAttribute("fill", "#b5cea8"); 
            } else if (className.includes('hljs-function')) {
                styledTspan.setAttribute("fill", "#dcdcaa"); 
            } else if (className.includes('hljs-variable')) {
                styledTspan.setAttribute("fill", "#9cdcfe"); 
            } else if (className.includes('hljs-type')) {
                styledTspan.setAttribute("fill", "#4ec9b0"); 
            } else if (className.includes('hljs-operator')) {
                styledTspan.setAttribute("fill", "#d4d4d4"); 
            } else {
                styledTspan.setAttribute("fill", codeTextColor); // Default color
            }
            
            // Add the styled tspan to current tspan
            currentTspan.appendChild(styledTspan);
        }
    }
}



function createCodeSelectionFeedback(groupElement) {
    if (!groupElement) return;
    removeCodeSelectionFeedback();

    const backgroundRect = groupElement.querySelector('.code-background');
    if (!backgroundRect) {
         console.warn("Cannot create selection feedback: background rect not found in group.");
         return;
    }

    // Use background rect dimensions for selection feedback
    const x = parseFloat(backgroundRect.getAttribute('x'));
    const y = parseFloat(backgroundRect.getAttribute('y'));
    const width = parseFloat(backgroundRect.getAttribute('width'));
    const height = parseFloat(backgroundRect.getAttribute('height'));

    const padding = 8;
    const handleSize = 10;
    const handleOffset = handleSize / 2;

    const selX = x - padding;
    const selY = y - padding;
    const selWidth = width + 2 * padding;
    const selHeight = height + 2 * padding;

    // Draw selection outline (polyline)
    const outlinePoints = [
        [selX, selY],
        [selX + selWidth, selY],
        [selX + selWidth, selY + selHeight],
        [selX, selY + selHeight],
        [selX, selY]
    ];
    const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
    codeSelectionBox = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    codeSelectionBox.setAttribute("class", "selection-box");
    codeSelectionBox.setAttribute("points", pointsAttr);
    codeSelectionBox.setAttribute("fill", "none");
    codeSelectionBox.setAttribute("stroke", "#5B57D1");
    codeSelectionBox.setAttribute("stroke-width", "1.5");
    codeSelectionBox.setAttribute("stroke-dasharray", "4 2");
    codeSelectionBox.setAttribute("vector-effect", "non-scaling-stroke");
    codeSelectionBox.setAttribute("pointer-events", "none");
    groupElement.appendChild(codeSelectionBox);

    // Add resize handles and rotation anchor (rest of the function remains the same)
    const handlesData = [
        { name: 'nw', x: selX, y: selY, cursor: 'nwse-resize' },
        { name: 'ne', x: selX + selWidth, y: selY, cursor: 'nesw-resize' },
        { name: 'sw', x: selX, y: selY + selHeight, cursor: 'nesw-resize' },
        { name: 'se', x: selX + selWidth, y: selY + selHeight, cursor: 'nwse-resize' }
    ];
    codeResizeHandles = {};
    handlesData.forEach(handle => {
        const handleRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        handleRect.setAttribute("class", `resize-handle resize-handle-${handle.name}`);
        handleRect.setAttribute("x", handle.x - handleOffset);
        handleRect.setAttribute("y", handle.y - handleOffset);
        handleRect.setAttribute("width", handleSize);
        handleRect.setAttribute("height", handleSize);
        handleRect.setAttribute("fill", "#121212");
        handleRect.setAttribute("stroke", "#5B57D1");
        handleRect.setAttribute("stroke-width", 2);
        handleRect.setAttribute("vector-effect", "non-scaling-stroke");
        handleRect.style.cursor = handle.cursor;
        handleRect.setAttribute("data-anchor", handle.name);
        groupElement.appendChild(handleRect);
        codeResizeHandles[handle.name] = handleRect;

        handleRect.addEventListener('mousedown', (e) => {
            if (selectedTool && selectedTool.classList.contains("bxs-pointer")) {
                e.stopPropagation();
                startCodeResize(e, handle.name);
            }
        });
    });

    // Add rotation anchor
    const rotationAnchorPos = { x: selX + selWidth / 2, y: selY - 30 };
    const rotationAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rotationAnchor.setAttribute('cx', rotationAnchorPos.x);
    rotationAnchor.setAttribute('cy', rotationAnchorPos.y);
    rotationAnchor.setAttribute('r', 8);
    rotationAnchor.setAttribute('class', 'rotate-anchor');
    rotationAnchor.setAttribute('fill', '#121212');
    rotationAnchor.setAttribute('stroke', '#5B57D1');
    rotationAnchor.setAttribute('stroke-width', 2);
    rotationAnchor.setAttribute('vector-effect', 'non-scaling-stroke');
    rotationAnchor.style.cursor = 'grab';
    rotationAnchor.setAttribute('pointer-events', 'all');
    groupElement.appendChild(rotationAnchor);

    codeResizeHandles.rotate = rotationAnchor;

    rotationAnchor.addEventListener('mousedown', (e) => {
        if (selectedTool && selectedTool.classList.contains("bxs-pointer")) {
            e.stopPropagation();
            startCodeRotation(e);
        }
    });
}


function updateCodeBackground(groupElement, codeElement) {
    const backgroundRect = groupElement.querySelector('.code-background');
    if (!backgroundRect || !codeElement) return;

    const textBBox = codeElement.getBBox();
    const padding = 10;

    // Update background dimensions to fit text content
    backgroundRect.setAttribute("x", textBBox.x - padding);
    backgroundRect.setAttribute("y", textBBox.y - padding);
    backgroundRect.setAttribute("width", textBBox.width + (padding * 2));
    backgroundRect.setAttribute("height", textBBox.height + (padding * 2));
}


function updateCodeSelectionFeedback() {
    if (!selectedCodeBlock || !codeSelectionBox) return;

    const codeElement = selectedCodeBlock.querySelector('text');
    if (!codeElement) return;

    // Temporarily set display to 'block' if it was hidden to get correct bbox
    const wasHidden = selectedCodeBlock.style.display === 'none';
    if (wasHidden) selectedCodeBlock.style.display = 'block';

    const bbox = codeElement.getBBox(); // Fix: use codeElement, not undefined foreignObject

    if (wasHidden) selectedCodeBlock.style.display = 'none';

    if (bbox.width === 0 && bbox.height === 0 && codeElement.textContent.trim() !== "") {
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
    codeSelectionBox.setAttribute("points", pointsAttr);

    const handlesData = [
        { name: 'nw', x: selX, y: selY },
        { name: 'ne', x: selX + selWidth, y: selY },
        { name: 'sw', x: selX, y: selY + selHeight },
        { name: 'se', x: selX + selWidth, y: selY + selHeight }
    ];

    handlesData.forEach(handle => {
        const handleRect = codeResizeHandles[handle.name];
        if (handleRect) {
            handleRect.setAttribute("x", handle.x - handleOffset);
            handleRect.setAttribute("y", handle.y - handleOffset);
        }
    });

    const rotationAnchor = codeResizeHandles.rotate;
    if (rotationAnchor) {
        const rotationAnchorPos = { x: selX + selWidth / 2, y: selY - 30 };
        rotationAnchor.setAttribute('cx', rotationAnchorPos.x);
        rotationAnchor.setAttribute('cy', rotationAnchorPos.y);
    }
}



function startCodeRotation(event) {
    if (!selectedCodeBlock || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    isCodeRotating = true;
    isCodeDragging = false;
    isCodeResizing = false;

    const codeElement = selectedCodeBlock.querySelector('text'); // Fix: use text element instead of foreignObject
    if (!codeElement) return;

    const bbox = codeElement.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    const mousePos = getSVGCoordinates(event);

    let centerPoint = svg.createSVGPoint();
    centerPoint.x = centerX;
    centerPoint.y = centerY;

    const groupTransform = selectedCodeBlock.transform.baseVal.consolidate();
    if (groupTransform) {
        centerPoint = centerPoint.matrixTransform(groupTransform.matrix);
    }

    codeRotationStartAngle = Math.atan2(mousePos.y - centerPoint.y, mousePos.x - centerPoint.x) * 180 / Math.PI;

    const currentTransform = selectedCodeBlock.transform.baseVal.consolidate();
    codeRotationStartTransform = currentTransform ? currentTransform.matrix : svg.createSVGMatrix();

    svg.style.cursor = 'grabbing';

    window.addEventListener('mousemove', handleCodeMouseMove); // Fix: use window instead of svg
    window.addEventListener('mouseup', handleCodeMouseUp);
}


function removeCodeSelectionFeedback() {
    if (selectedCodeBlock) {
        selectedCodeBlock.querySelectorAll(".selection-box, .resize-handle, .rotate-anchor").forEach(el => el.remove());
    }
    codeSelectionBox = null;
    codeResizeHandles = {};
}

function selectCodeBlock(groupElement) {
    if (!groupElement || !groupElement.parentNode) return;
    if (groupElement === selectedCodeBlock) return;

    deselectCodeBlock();
    selectedCodeBlock = groupElement;
    selectedCodeBlock.classList.add("selected");
    createCodeSelectionFeedback(selectedCodeBlock);
    updateSelectedElement(selectedCodeBlock);
}

function deselectCodeBlock() {
    const activeEditor = document.querySelector(".svg-code-editor[contenteditable='true']");
    if (activeEditor) {
        let groupElement = activeEditor.originalGroup;
        if (groupElement) {
            renderCode(activeEditor, true);
        } else if (document.body.contains(activeEditor)){
            activeEditor.remove();
        }
    }
    if (selectedCodeBlock) {
        removeCodeSelectionFeedback();
        selectedCodeBlock.classList.remove("selected");
        selectedCodeBlock = null;
        updateSelectedElement(null);
    }
    if (isCodeRotating) {
        isCodeRotating = false;
        codeRotationStartAngle = 0;
        codeRotationStartTransform = null;
        svg.style.cursor = 'default';
        window.removeEventListener('mousemove', handleCodeMouseMove);
        window.removeEventListener('mouseup', handleCodeMouseUp);
    }
}


function startCodeDrag(event) {
    if (!selectedCodeBlock || event.button !== 0) return;

    if (event.target.closest('.resize-handle')) {
        return;
    }

    isCodeDragging = true;
    isCodeResizing = false;
    event.preventDefault();

    const currentTransform = selectedCodeBlock.transform.baseVal.consolidate();
    const initialTranslateX = currentTransform ? currentTransform.matrix.e : 0;
    const initialTranslateY = currentTransform ? currentTransform.matrix.f : 0;

    startCodePoint = getSVGCoordinates(event);

    codeDragOffsetX = startCodePoint.x - initialTranslateX;
    codeDragOffsetY = startCodePoint.y - initialTranslateY;

    // Find the CodeShape wrapper for frame functionality
    let codeShape = null;
    if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
        codeShape = shapes.find(shape => shape.shapeName === 'code' && shape.group === selectedCodeBlock);
    }

    if (codeShape) {
        // Store initial frame state
        draggedCodeInitialFrame = codeShape.parentFrame || null;
        
        // Temporarily remove from frame clipping if dragging
        if (codeShape.parentFrame) {
            codeShape.parentFrame.temporarilyRemoveFromFrame(codeShape);
        }
    }

    svg.style.cursor = 'grabbing';

    window.addEventListener('mousemove', handleCodeMouseMove); // Fix: use window
    window.addEventListener('mouseup', handleCodeMouseUp);   // Fix: use window
}

function startCodeResize(event, anchor) {
    if (!selectedCodeBlock || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    isCodeResizing = true;
    isCodeDragging = false;
    currentCodeResizeHandle = anchor;

    
    const codeElement = selectedCodeBlock.querySelector('text');
    if (!codeElement) {
        console.error("Cannot start resize: code element not found.");
        isCodeResizing = false;
        return;
    }

    startCodeBBox = codeElement.getBBox();
    startCodeFontSize = parseFloat(codeElement.getAttribute("font-size") || 25);
    if (isNaN(startCodeFontSize)) startCodeFontSize = 25;

    startCodePoint = getSVGCoordinates(event, selectedCodeBlock);

    const currentTransform = selectedCodeBlock.transform.baseVal.consolidate();
    initialCodeGroupTx = currentTransform ? currentTransform.matrix.e : 0;
    initialCodeGroupTy = currentTransform ? currentTransform.matrix.f : 0;

    const padding = 3;
    const startX = startCodeBBox.x - padding;
    const startY = startCodeBBox.y - padding;
    const startWidth = startCodeBBox.width + 2 * padding;
    const startHeight = startCodeBBox.height + 2 * padding;

    let hx = startX;
    let hy = startY;
    if (anchor.includes('e')) { hx = startX + startWidth; }
    if (anchor.includes('s')) { hy = startY + startHeight; }
    initialCodeHandlePosRelGroup = { x: hx, y: hy };

    svg.style.cursor = codeResizeHandles[anchor]?.style.cursor || 'default';

    window.addEventListener('mousemove', handleCodeMouseMove); 
    window.addEventListener('mouseup', handleCodeMouseUp);   
}




const handleCodeMouseMove = (event) => {
    if (!selectedCodeBlock) return;
    event.preventDefault();

    // Keep lastMousePos in screen coordinates for other functions
    const svgRect = svg.getBoundingClientRect();
    lastMousePos = {
        x: event.clientX - svgRect.left, 
        y: event.clientY - svgRect.top
    };

    if (isCodeDragging) {
        const currentPoint = getSVGCoordinates(event);
        const newTranslateX = currentPoint.x - codeDragOffsetX;
        const newTranslateY = currentPoint.y - codeDragOffsetY;

        const currentTransform = selectedCodeBlock.transform.baseVal.consolidate();
        if (currentTransform) {
            const matrix = currentTransform.matrix;
            const angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;

            const codeElement = selectedCodeBlock.querySelector('text');
            if (codeElement) {
                const bbox = codeElement.getBBox();
                const centerX = bbox.x + bbox.width / 2;
                const centerY = bbox.y + bbox.height / 2;

                selectedCodeBlock.setAttribute('transform',
                    `translate(${newTranslateX}, ${newTranslateY}) rotate(${angle}, ${centerX}, ${centerY})`
                );
            } else {
                selectedCodeBlock.setAttribute('transform', `translate(${newTranslateX}, ${newTranslateY})`);
            }
        } else {
            selectedCodeBlock.setAttribute('transform', `translate(${newTranslateX}, ${newTranslateY})`);
        }

        // Update frame containment for CodeShape wrapper
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            const codeShape = shapes.find(shape => shape.shapeName === 'code' && shape.group === selectedCodeBlock);
            if (codeShape) {
                codeShape.updateFrameContainment();
            }
        }

        // Update attached arrows during dragging
        updateAttachedArrows(selectedCodeBlock);

    } else if (isCodeResizing) {
        const codeElement = selectedCodeBlock.querySelector('text');
        if (!codeElement || !startCodeBBox || startCodeFontSize === null || !startCodePoint || !initialCodeHandlePosRelGroup) return;

        const currentPoint = getSVGCoordinates(event, selectedCodeBlock);

        const startX = startCodeBBox.x;
        const startY = startCodeBBox.y;
        const startWidth = startCodeBBox.width;
        const startHeight = startCodeBBox.height;

        let anchorX, anchorY;

        switch (currentCodeResizeHandle) {
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

        const newFontSize = startCodeFontSize * clampedScale;
        const minFontSize = 5;
        const finalFontSize = Math.max(newFontSize, minFontSize);

        codeElement.setAttribute("font-size", `${finalFontSize}px`);

        const currentBBox = codeElement.getBBox();

        let newAnchorX, newAnchorY;

        switch (currentCodeResizeHandle) {
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

        const currentTransform = selectedCodeBlock.transform.baseVal.consolidate();
        if (currentTransform) {
            const matrix = currentTransform.matrix;
            const angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;

            const newGroupTx = initialCodeGroupTx + deltaX;
            const newGroupTy = initialCodeGroupTy + deltaY;

            const centerX = currentBBox.x + currentBBox.width / 2;
            const centerY = currentBBox.y + currentBBox.height / 2;

            selectedCodeBlock.setAttribute('transform',
                `translate(${newGroupTx}, ${newGroupTy}) rotate(${angle}, ${centerX}, ${centerY})`
            );
        } else {
            const newGroupTx = initialCodeGroupTx + deltaX;
            const newGroupTy = initialCodeGroupTy + deltaY;
            selectedCodeBlock.setAttribute('transform', `translate(${newGroupTx}, ${newGroupTy})`);
        }

        // Update background to fit new text size
        updateCodeBackground(selectedCodeBlock, codeElement);

        // Update attached arrows during resizing
        updateAttachedArrows(selectedCodeBlock);

        clearTimeout(selectedCodeBlock.updateFeedbackTimeout);
        selectedCodeBlock.updateFeedbackTimeout = setTimeout(() => {
            updateCodeSelectionFeedback();
            delete selectedCodeBlock.updateFeedbackTimeout;
        }, 0);

    } else if (isCodeRotating) {
        const codeElement = selectedCodeBlock.querySelector('text');
        if (!codeElement) return;

        const bbox = codeElement.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;

        const mousePos = getSVGCoordinates(event);

        let centerPoint = svg.createSVGPoint();
        centerPoint.x = centerX;
        centerPoint.y = centerY;

        const groupTransform = selectedCodeBlock.transform.baseVal.consolidate();
        if (groupTransform) {
            centerPoint = centerPoint.matrixTransform(groupTransform.matrix);
        }

        const currentAngle = Math.atan2(mousePos.y - centerPoint.y, mousePos.x - centerPoint.x) * 180 / Math.PI;

        const rotationDiff = currentAngle - codeRotationStartAngle;

        const newTransform = `translate(${codeRotationStartTransform.e}, ${codeRotationStartTransform.f}) rotate(${rotationDiff}, ${centerX}, ${centerY})`;
        selectedCodeBlock.setAttribute('transform', newTransform);

        // Update attached arrows during rotation
        updateAttachedArrows(selectedCodeBlock);

        updateCodeSelectionFeedback();
    }

    // Handle cursor changes for code tool
    if (isCodeToolActive && !isCodeDragging && !isCodeResizing && !isCodeRotating) {
        svg.style.cursor = 'text';
        
        // Frame highlighting logic for code tool
        const { x, y } = getSVGCoordinates(event);
        
        const tempCodeBounds = {
            x: x - 275, 
            y: y - 30, 
            width: 550,
            height: 60
        };
        
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            shapes.forEach(frame => {
                if (frame.shapeName === 'frame') {
                    if (frame.isShapeInFrame(tempCodeBounds)) {
                        frame.highlightFrame();
                        hoveredCodeFrame = frame;
                    } else if (hoveredCodeFrame === frame) {
                        frame.removeHighlight();
                        hoveredCodeFrame = null;
                    }
                }
            });
        }
    } else if (isSelectionToolActive && !isCodeDragging && !isCodeResizing && !isCodeRotating) {
        const targetGroup = event.target.closest('g[data-type="code-group"]');
        if (targetGroup) {
            svg.style.cursor = 'move';
        } else {
            svg.style.cursor = 'default';
        }
    }
};

// Add this complete mouse up handler
const handleCodeMouseUp = (event) => {
    if (event.button !== 0) return;

    if (isCodeDragging && selectedCodeBlock) {
        const currentTransform = selectedCodeBlock.transform.baseVal.consolidate();
        if (currentTransform) {
            const finalTranslateX = currentTransform.matrix.e;
            const finalTranslateY = currentTransform.matrix.f;

            const initialX = parseFloat(selectedCodeBlock.getAttribute("data-x")) || 0;
            const initialY = parseFloat(selectedCodeBlock.getAttribute("data-y")) || 0;

            // Find the CodeShape wrapper for frame tracking
            let codeShape = null;
            if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
                codeShape = shapes.find(shape => shape.shapeName === 'code' && shape.group === selectedCodeBlock);
            }

            // Add frame information for undo tracking
            const oldPosWithFrame = {
                x: initialX,
                y: initialY,
                rotation: extractRotationFromTransform(selectedCodeBlock) || 0,
                parentFrame: draggedCodeInitialFrame
            };
            const newPosWithFrame = {
                x: finalTranslateX,
                y: finalTranslateY,
                rotation: extractRotationFromTransform(selectedCodeBlock) || 0,
                parentFrame: codeShape ? codeShape.parentFrame : null
            };

            const stateChanged = initialX !== finalTranslateX || initialY !== finalTranslateY;
            const frameChanged = oldPosWithFrame.parentFrame !== newPosWithFrame.parentFrame;

            if (stateChanged || frameChanged) {
                pushTransformAction(
                    {
                        type: 'code',
                        element: selectedCodeBlock,
                        shapeName: 'code'
                    },
                    oldPosWithFrame,
                    newPosWithFrame
                );
            }

            // Handle frame containment changes after drag
            if (codeShape) {
                const finalFrame = hoveredCodeFrame;
                
                // If shape moved to a different frame
                if (draggedCodeInitialFrame !== finalFrame) {
                    // Remove from initial frame
                    if (draggedCodeInitialFrame) {
                        draggedCodeInitialFrame.removeShapeFromFrame(codeShape);
                    }
                    
                    // Add to new frame
                    if (finalFrame) {
                        finalFrame.addShapeToFrame(codeShape);
                    }
                    
                    // Track the frame change for undo
                    if (frameChanged) {
                        pushFrameAttachmentAction(finalFrame || draggedCodeInitialFrame, codeShape, 
                            finalFrame ? 'attach' : 'detach', draggedCodeInitialFrame);
                    }
                } else if (draggedCodeInitialFrame) {
                    // Shape stayed in same frame, restore clipping
                    draggedCodeInitialFrame.restoreToFrame(codeShape);
                }
            }

            selectedCodeBlock.setAttribute("data-x", finalTranslateX);
            selectedCodeBlock.setAttribute("data-y", finalTranslateY);
            console.log("Code Drag End - Final Pos:", finalTranslateX, finalTranslateY);
        }

        draggedCodeInitialFrame = null;

    } else if (isCodeResizing && selectedCodeBlock) {
        const codeElement = selectedCodeBlock.querySelector('text');
        if (codeElement) {
            const finalFontSize = codeElement.getAttribute("font-size");
            const initialFontSize = startCodeFontSize;

            const currentTransform = selectedCodeBlock.transform.baseVal.consolidate();
            if (currentTransform && initialFontSize !== parseFloat(finalFontSize)) {
                const finalTranslateX = currentTransform.matrix.e;
                const finalTranslateY = currentTransform.matrix.f;

                pushTransformAction(
                    {
                        type: 'code',
                        element: selectedCodeBlock,
                        shapeName: 'code'
                    },
                    {
                        x: initialCodeGroupTx,
                        y: initialCodeGroupTy,
                        fontSize: initialFontSize,
                        rotation: extractRotationFromTransform(selectedCodeBlock) || 0
                    },
                    {
                        x: finalTranslateX,
                        y: finalTranslateY,
                        fontSize: parseFloat(finalFontSize),
                        rotation: extractRotationFromTransform(selectedCodeBlock) || 0
                    }
                );

                selectedCodeBlock.setAttribute("data-x", finalTranslateX);
                selectedCodeBlock.setAttribute("data-y", finalTranslateY);
                console.log("Code Resize End - Final Font Size:", finalFontSize);
            }

            clearTimeout(selectedCodeBlock.updateFeedbackTimeout);
            updateCodeSelectionFeedback();
        }
    } else if (isCodeRotating && selectedCodeBlock) {
        const currentTransform = selectedCodeBlock.transform.baseVal.consolidate();
        if (currentTransform && codeRotationStartTransform) {
            const initialRotation = Math.atan2(codeRotationStartTransform.b, codeRotationStartTransform.a) * 180 / Math.PI;
            const finalRotation = extractRotationFromTransform(selectedCodeBlock) || 0;

            if (Math.abs(initialRotation - finalRotation) > 1) {
                pushTransformAction(
                    {
                        type: 'code',
                        element: selectedCodeBlock,
                        shapeName: 'code'
                    },
                    {
                        x: codeRotationStartTransform.e,
                        y: codeRotationStartTransform.f,
                        rotation: initialRotation
                    },
                    {
                        x: currentTransform.matrix.e,
                        y: currentTransform.matrix.f,
                        rotation: finalRotation
                    }
                );
            }

            console.log("Code Rotation End");
        }
        updateCodeSelectionFeedback();
    }

    // Clear frame highlighting
    if (hoveredCodeFrame) {
        hoveredCodeFrame.removeHighlight();
        hoveredCodeFrame = null;
    }

    // Handle code deselection when clicking outside
    if (isSelectionToolActive) {
        const targetGroup = event.target.closest('g[data-type="code-group"]');
        const isResizeHandle = event.target.closest('.resize-handle');
        const isRotateAnchor = event.target.closest('.rotate-anchor');
        
        // If we didn't click on code block or its controls, deselect
        if (!targetGroup && !isResizeHandle && !isRotateAnchor && selectedCodeBlock) {
            deselectCodeBlock();
        }
    }

    isCodeDragging = false;
    isCodeResizing = false;
    isCodeRotating = false;
    currentCodeResizeHandle = null;
    startCodePoint = null;
    startCodeBBox = null;
    startCodeFontSize = null;
    codeDragOffsetX = undefined;
    codeDragOffsetY = undefined;
    initialCodeHandlePosRelGroup = null;
    initialCodeGroupTx = 0;
    initialCodeGroupTy = 0;
    codeRotationStartAngle = 0;
    codeRotationStartTransform = null;

    svg.style.cursor = 'default';

    svg.removeEventListener('mousemove', handleCodeMouseMove);
    svg.removeEventListener('mouseup', handleCodeMouseUp);
};


function extractRotationFromTransform(element) {
    const currentTransform = element.transform.baseVal.consolidate();
    if (currentTransform) {
        const matrix = currentTransform.matrix;
        return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    }
    return 0;
}

const handleCodeMouseDown = function (e) {
    const activeEditor = document.querySelector("textarea.svg-code-editor");
    if (activeEditor && activeEditor.contains(e.target)) {
         return;
    }
    if (activeEditor && !activeEditor.contains(e.target)) {
         let codeElement = activeEditor.originalCodeElement;
         if (codeElement) {
            renderCode(activeEditor, codeElement, true);
         } else if (document.body.contains(activeEditor)){
             document.body.removeChild(activeEditor);
         }
    }

    const targetGroup = e.target.closest('g[data-type="code-group"]');

    if (isSelectionToolActive && e.button === 0) {
        if (targetGroup) {
             if (e.target.closest('.resize-handle') || e.target.closest('.rotate-anchor')) {
                 return; // Let resize/rotate handlers manage
             }
            
            // If clicking on the code block itself, select it and start drag
            if (targetGroup === selectedCodeBlock) {
                startCodeDrag(e);
            } else {
                selectCodeBlock(targetGroup);
                startCodeDrag(e);
            }
        } else {
            deselectCodeBlock();
        }

    } else if (isCodeToolActive  && e.button === 0) { 
        if (targetGroup) {
            const codeElement = targetGroup.querySelector('text');

            if (codeElement && (e.target.tagName === "text" || e.target.tagName === "tspan")) {
                console.log("Editing existing code. Group:", targetGroup);
                makeCodeEditable(codeElement, targetGroup);
                e.stopPropagation();
            } else {
                 console.warn("Could not find code element for editing, creating new code block instead.");
                 deselectCodeBlock();
                 addCodeBlock(e);
            }
        } else {
             console.log("Creating new code block.");
             deselectCodeBlock();
             addCodeBlock(e);
        }
    }
};

// 8. UPDATE updateAttachedArrows function:
function updateAttachedArrows(codeGroup) {
    // Fix: Check the data-type attribute instead of type property
    if (!codeGroup || codeGroup.getAttribute('data-type') !== 'code-group') return;
    
    // Find all arrows attached to this code block
    shapes.forEach(shape => {
        if (shape && shape.shapeName === 'arrow' && typeof shape.updateAttachments === 'function') {
            if ((shape.attachedToStart && shape.attachedToStart.shape === codeGroup) ||
                (shape.attachedToEnd && shape.attachedToEnd.shape === codeGroup)) {
                shape.updateAttachments();
            }
        }
    });
}

codeTextColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        codeTextColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        const newColor = span.getAttribute("data-id");
        const oldColor = codeTextColor;
        codeTextColor = newColor;
        console.log("Set Default Code Text Color:", codeTextColor);

        if (selectedCodeBlock) {
            const codeEditor = selectedCodeBlock.querySelector('.svg-code-editor');
            if (codeEditor) {
                const currentColor = codeEditor.style.color;

                if (currentColor !== newColor) {
                    pushOptionsChangeAction(
                        {
                            type: 'code',
                            element: selectedCodeBlock,
                            shapeName: 'code'
                        },
                        {
                            color: currentColor,
                            font: codeEditor.style.fontFamily,
                            size: codeEditor.style.fontSize,
                            align: codeEditor.style.textAlign // Although mostly 'left'
                        },
                        {
                            color: newColor,
                            font: codeEditor.style.fontFamily,
                            size: codeEditor.style.fontSize,
                            align: codeEditor.style.textAlign
                        }
                    );
                }

                codeEditor.style.color = newColor;
                updateSyntaxHighlighting(codeEditor); // Re-highlight with new color
            }
        }
    });
});

codeTextFontOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        codeTextFontOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        const newFont = span.getAttribute("data-id");
        const oldFont = codeTextFont;
        codeTextFont = newFont;
        console.log("Set Default Code Text Font:", codeTextFont);

        if (selectedCodeBlock) {
            const codeEditor = selectedCodeBlock.querySelector('.svg-code-editor');
            if (codeEditor) {
                const currentFont = codeEditor.style.fontFamily;

                if (currentFont !== newFont) {
                    pushOptionsChangeAction(
                        {
                            type: 'code',
                            element: selectedCodeBlock,
                            shapeName: 'code'
                        },
                        {
                            color: codeEditor.style.color,
                            font: currentFont,
                            size: codeEditor.style.fontSize,
                            align: codeEditor.style.textAlign
                        },
                        {
                            color: codeEditor.style.color,
                            font: newFont,
                            size: codeEditor.style.fontSize,
                            align: codeEditor.style.textAlign
                        }
                    );
                }

                codeEditor.style.fontFamily = newFont;
                updateSyntaxHighlighting(codeEditor); // Re-highlight with new font
                setTimeout(updateCodeSelectionFeedback, 0);
            }
        }
    });
});

codeTextSizeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        codeTextSizeOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        const newSize = span.getAttribute("data-id") + "px";
        const oldSize = codeTextSize;
        codeTextSize = newSize;
        console.log("Set Default Code Text Size:", codeTextSize);

        if (selectedCodeBlock) {
            const codeEditor = selectedCodeBlock.querySelector('.svg-code-editor');
            if (codeEditor) {
                const currentSize = codeEditor.style.fontSize;

                if (currentSize !== newSize) {
                    pushOptionsChangeAction(
                        {
                            type: 'code',
                            element: selectedCodeBlock,
                            shapeName: 'code'
                        },
                        {
                            color: codeEditor.style.color,
                            font: codeEditor.style.fontFamily,
                            size: currentSize,
                            align: codeEditor.style.textAlign
                        },
                        {
                            color: codeEditor.style.color,
                            font: codeEditor.style.fontFamily,
                            size: newSize,
                            align: codeEditor.style.textAlign
                        }
                    );
                }

                codeEditor.style.fontSize = newSize;
                adjustCodeEditorSize(codeEditor); // Adjust container size as font size changes
                updateSyntaxHighlighting(codeEditor); // Re-highlight with new size
                setTimeout(updateCodeSelectionFeedback, 0);
            }
        }
    });
});

codeTextAlignOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        codeTextAlignOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        const newAlign = span.getAttribute("data-id");
        const oldAlign = codeTextAlign;
        codeTextAlign = newAlign;
        console.log("Set Default Code Text Align:", codeTextAlign);

        if (selectedCodeBlock) {
            const codeEditor = selectedCodeBlock.querySelector('.svg-code-editor');
            if (codeEditor) {
                const currentAlign = codeEditor.style.textAlign;

                if (currentAlign !== newAlign) {
                    pushOptionsChangeAction(
                        {
                            type: 'code',
                            element: selectedCodeBlock,
                            shapeName: 'code'
                        },
                        {
                            color: codeEditor.style.color,
                            font: codeEditor.style.fontFamily,
                            size: codeEditor.style.fontSize,
                            align: currentAlign
                        },
                        {
                            color: codeEditor.style.color,
                            font: codeEditor.style.fontFamily,
                            size: codeEditor.style.fontSize,
                            align: newAlign
                        }
                    );
                }
                // Code is typically left-aligned, but if user forces, apply it.
                // Note: Highlight.js might override some text-alignment styles on its own.
                codeEditor.style.textAlign = newAlign; 
                setTimeout(updateCodeSelectionFeedback, 0);
            }
        }
    });
});


export { handleCodeMouseDown, handleCodeMouseMove, handleCodeMouseUp };