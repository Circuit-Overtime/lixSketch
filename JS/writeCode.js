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
let codeTextFont = "lixCode"; // Assuming a monospaced font for code
let codeTextColor = "#fff";
let codeTextAlign = "left"; // Code is typically left-aligned

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
        const codeBlockContainer = this.group.querySelector('foreignObject');
        if (codeBlockContainer) {
            return parseFloat(codeBlockContainer.getAttribute('width')) || codeBlockContainer.getBBox().width;
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
        const codeBlockContainer = this.group.querySelector('foreignObject');
        if (codeBlockContainer) {
            return parseFloat(codeBlockContainer.getAttribute('height')) || codeBlockContainer.getBBox().height;
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
        const codeBlockContainer = this.group.querySelector('foreignObject');
        if (!codeBlockContainer) return false;
        
        const bbox = codeBlockContainer.getBBox();
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

    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', '0');
    foreignObject.setAttribute('y', '0');
    foreignObject.setAttribute('width', '550'); 
    foreignObject.setAttribute('height', '60');  
    foreignObject.setAttribute("data-initial-width", '550'); 
    foreignObject.setAttribute("data-initial-height", '60');  

    const codeContainer = document.createElement('div');
    codeContainer.className = 'svg-code-container';
    codeContainer.style.width = '100%';
    codeContainer.style.height = '100%';
    codeContainer.style.padding = '10px';
    codeContainer.style.borderRadius = '8px';
    codeContainer.style.backgroundColor = '#242424'; // Dark background
    codeContainer.style.border = '2px solid #666';
    codeContainer.style.boxSizing = 'border-box';
    codeContainer.style.display = 'flex';
    codeContainer.style.flexDirection = 'column';
    codeContainer.style.minWidth = '550px';
    codeContainer.style.minHeight = '60px';
    codeContainer.style.position = 'relative'; 


    const codeEditor = document.createElement('pre'); // Use pre for code formatting
    codeEditor.className = 'svg-code-editor';
    codeEditor.contentEditable = 'true';
    codeEditor.spellcheck = 'false';
    codeEditor.setAttribute('data-placeholder', 'Start typing code...');
    codeEditor.setAttribute("data-gramm", "false"); 
    codeEditor.setAttribute("data-enable-grammarly", "false"); 
    codeEditor.style.outline = 'none';
    codeEditor.style.border = 'none';
    codeEditor.style.backgroundColor = 'transparent';
    codeEditor.style.color = codeTextColor;
    codeEditor.style.fontSize = codeTextSize;
    codeEditor.style.fontFamily = codeTextFont;
    codeEditor.style.lineHeight = '1.2em';
    codeEditor.style.overflow = 'auto'; // Enable scrolling for code
    codeEditor.style.whiteSpace = 'pre-wrap';
    codeEditor.style.wordWrap = 'break-word';
    codeEditor.style.tabSize = '4';
    codeEditor.style.flexGrow = '1';
    codeEditor.style.margin = '0'; // Remove default pre margin
    codeEditor.style.padding = '0';

    codeContainer.appendChild(codeEditor);
    foreignObject.appendChild(codeContainer);
    gElement.appendChild(foreignObject);
    svg.appendChild(gElement);
    
    // Attach ID to both group and foreignObject
    const shapeID = `code-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;
    gElement.setAttribute('id', shapeID);
    foreignObject.setAttribute('id', `${shapeID}-foreignObject`);
    
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

    makeCodeEditable(codeEditor, gElement, foreignObject);
}

// Function to initialize highlight.js
function initializeHighlighter(element) {
    if (window.hljs) {
        window.hljs.highlightElement(element);
    } else {
        console.warn("highlight.js not loaded. Syntax highlighting will not work.");
    }
}

// Function to update highlight.js on content change
function updateSyntaxHighlighting(editor) {
    if (window.hljs) {
        window.hljs.highlightElement(editor);
    }
}

function adjustCodeEditorSize(editor) {
    // Get the foreignObject and its container
    const foreignObject = editor.closest('foreignObject');
    const codeContainer = editor.closest('.svg-code-container');

    if (!foreignObject || !codeContainer) return;

    // Temporarily set overflow to auto to get scrollHeight
    editor.style.overflow = 'auto';
    editor.style.height = 'auto';
    editor.style.width = 'auto';

    // Calculate minimum content width/height
    let minContentWidth = editor.scrollWidth + codeContainer.paddingLeft + codeContainer.paddingRight;
    let minContentHeight = editor.scrollHeight + codeContainer.paddingTop + codeContainer.paddingBottom;

    // Set foreignObject dimensions based on content
    // We need to ensure foreignObject's width/height is at least its content
    let newWidth = Math.max(minContentWidth, parseFloat(foreignObject.getAttribute('width')) || 300);
    let newHeight = Math.max(minContentHeight, parseFloat(foreignObject.getAttribute('height')) || 100);
    
    foreignObject.setAttribute('width', newWidth);
    foreignObject.setAttribute('height', newHeight);

    // Apply the determined dimensions to the internal editor for scrolling
    editor.style.width = `${newWidth - (parseFloat(codeContainer.style.paddingLeft) || 0) - (parseFloat(codeContainer.style.paddingRight) || 0)}px`;
    editor.style.height = `${newHeight - (parseFloat(codeContainer.style.paddingTop) || 0) - (parseFloat(codeContainer.style.paddingBottom) || 0)}px`;

    // Reset overflow based on content vs container size
    if (editor.scrollHeight > editor.clientHeight || editor.scrollWidth > editor.clientWidth) {
        editor.style.overflow = 'auto';
    } else {
        editor.style.overflow = 'hidden';
    }

    // Update the visual selection feedback
    if (selectedCodeBlock && selectedCodeBlock.contains(foreignObject)) {
        updateCodeSelectionFeedback();
    }
}


function makeCodeEditable(codeEditor, groupElement, foreignObject) {
    console.log("Making code editable");

    if (document.querySelector(".svg-code-editor[contenteditable='true']")) {
        console.log("Already editing another code block.");
        return;
    }

    if (selectedCodeBlock) {
        deselectCodeBlock();
    }

    // Hide the selection feedback for the element being edited
    removeCodeSelectionFeedback();

    codeEditor.focus();
    // Select all content
    const range = document.createRange();
    range.selectNodeContents(codeEditor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Initial highlight
    initializeHighlighter(codeEditor);

    // Adjust size initially
    adjustCodeEditorSize(codeEditor);

    // Event listeners for resizing while typing
    codeEditor.addEventListener('input', () => {
        updateSyntaxHighlighting(codeEditor);
        adjustCodeEditorSize(codeEditor);
        updateAttachedArrows(groupElement); // Update arrows on content change
    });
    codeEditor.addEventListener('keydown', (e) => {
        // Allow tab for indentation, prevent default behavior
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeEditor.selectionStart;
            const end = codeEditor.selectionEnd;

            const originalText = codeEditor.textContent;
            codeEditor.textContent = originalText.substring(0, start) + '\t' + originalText.substring(end);

            // Restore cursor position
            codeEditor.selectionStart = codeEditor.selectionEnd = start + 1;
            
            updateSyntaxHighlighting(codeEditor);
            adjustCodeEditorSize(codeEditor);
        }
    });

    codeEditor.originalGroup = groupElement;
    codeEditor.originalForeignObject = foreignObject;

    const handleClickOutside = (event) => {
        if (!foreignObject.contains(event.target) && event.target !== codeEditor) {
            renderCode(codeEditor, true);
            document.removeEventListener('mousedown', handleClickOutside, true);
        }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    codeEditor.handleClickOutside = handleClickOutside;

    // Prevent pointer events on the group itself while editing
    groupElement.style.pointerEvents = 'none';
    foreignObject.style.pointerEvents = 'all'; // Re-enable pointer events for the foreignObject
}

function renderCode(editor, deleteIfEmpty = false) {
    if (!editor || !editor.parentNode) {
         console.warn("RenderCode called but editor is already removed.");
         return;
    }

    const groupElement = editor.originalGroup;
    const foreignObject = editor.originalForeignObject;

    if (editor.handleClickOutside) {
        document.removeEventListener('mousedown', editor.handleClickOutside, true);
    }

    if (!groupElement || !foreignObject) {
        console.error("RenderCode cannot find original group or foreignObject.");
        return;
    }

    const codeContent = editor.textContent;

    if (deleteIfEmpty && codeContent.trim() === "") {
        // Find the CodeShape wrapper
        let codeShape = null;
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            codeShape = shapes.find(shape => shape.shapeName === 'code' && shape.group === groupElement);
            if (codeShape) {
                const idx = shapes.indexOf(codeShape);
                if (idx !== -1) shapes.splice(idx, 1);
            }
        }

        pushDeleteActionWithAttachments({
            type: 'code',
            element: codeShape || groupElement,
            shapeName: 'code'
        });

        if (typeof cleanupAttachments === 'function') {
            cleanupAttachments(groupElement);
        }

        svg.removeChild(groupElement);
        if (selectedCodeBlock === groupElement) {
            selectedCodeBlock = null;
            removeCodeSelectionFeedback();
        }
    } else {
        // Re-enable pointer events on the group after editing
        groupElement.style.pointerEvents = 'all';
        foreignObject.style.pointerEvents = 'all';

        // Re-apply highlight to the final content
        updateSyntaxHighlighting(editor);
        adjustCodeEditorSize(editor);

        // Update attached arrows after code content change
        updateAttachedArrows(groupElement);

        if (selectedCodeBlock === groupElement) {
            setTimeout(updateCodeSelectionFeedback, 0);
        }
    }

    if (selectedTool && selectedTool.classList.contains('bxs-pointer') && groupElement.parentNode === svg) {
        selectCodeBlock(groupElement);
    } else if (selectedCodeBlock === groupElement) {
        deselectCodeBlock();
    }
}


function createCodeSelectionFeedback(groupElement) {
    if (!groupElement) return;
    removeCodeSelectionFeedback();

    const foreignObject = groupElement.querySelector('foreignObject');
    if (!foreignObject) return;

    const bbox = foreignObject.getBBox();
    const padding = 8;
    const handleSize = 10;
    const handleOffset = handleSize / 2;

    const selX = bbox.x - padding;
    const selY = bbox.y - padding;
    const selWidth = bbox.width + 2 * padding;
    const selHeight = bbox.height + 2 * padding;

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

    // Add 4 resize anchors (rects)
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

    // Add rotation anchor (circle)
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

    rotationAnchor.addEventListener('mouseover', function() {
        if (!isCodeResizing && !isCodeDragging) {
            this.style.cursor = 'grab';
        }
    });

    rotationAnchor.addEventListener('mouseout', function() {
        if (!isCodeResizing && !isCodeDragging) {
            this.style.cursor = 'default';
        }
    });
}


function updateCodeSelectionFeedback() {
    if (!selectedCodeBlock || !codeSelectionBox) return;

    const foreignObject = selectedCodeBlock.querySelector('foreignObject');
    if (!foreignObject) return;

    // Temporarily set display to 'block' if it was hidden to get correct bbox
    const wasHidden = selectedCodeBlock.style.display === 'none';
    if (wasHidden) selectedCodeBlock.style.display = 'block';

    const bbox = foreignObject.getBBox();

    if (wasHidden) selectedCodeBlock.style.display = 'none';

    if (bbox.width === 0 && bbox.height === 0 && foreignObject.querySelector('.svg-code-editor')?.textContent.trim() !== "") {
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

    const foreignObject = selectedCodeBlock.querySelector('foreignObject');
    if (!foreignObject) return;

    const bbox = foreignObject.getBBox();
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

    window.addEventListener('mousemove', handleCodeMouseMove);
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
            draggedCodeInitialFrame.temporarilyRemoveFromFrame(codeShape);
        }
    }

    svg.style.cursor = 'grabbing';

    svg.addEventListener('mousemove', handleCodeMouseMove);
    svg.addEventListener('mouseup', handleCodeMouseUp);
}

function startCodeResize(event, anchor) {
  if (!selectedCodeBlock || event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  isCodeResizing = true;
  isCodeDragging = false;
  currentCodeResizeHandle = anchor;

  const foreignObject = selectedCodeBlock.querySelector('foreignObject');
  const codeEditor = foreignObject.querySelector('.svg-code-editor');

  if (!foreignObject || !codeEditor) {
       console.error("Cannot start resize: foreignObject or code editor not found.");
       isCodeResizing = false;
       return;
  }

  startCodeBBox = foreignObject.getBBox(); // BBox of the foreignObject
  startCodeFontSize = parseFloat(codeEditor.style.fontSize) || 30;
  if (isNaN(startCodeFontSize)) startCodeFontSize = 30;

  startCodePoint = getSVGCoordinates(event, selectedCodeBlock);

  const currentTransform = selectedCodeBlock.transform.baseVal.consolidate();
  initialCodeGroupTx = currentTransform ? currentTransform.matrix.e : 0;
  initialCodeGroupTy = currentTransform ? currentTransform.matrix.f : 0;

  const padding = 3; // Padding for selection handles relative to BBox
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

  svg.addEventListener('mousemove', handleCodeMouseMove);
  svg.addEventListener('mouseup', handleCodeMouseUp);
}



const handleCodeMouseMove = function (e) {
    // Keep lastMousePos in screen coordinates for other functions
    const svgRect = svg.getBoundingClientRect();
    lastMousePos = {
        x: e.clientX - svgRect.left, 
        y: e.clientY - svgRect.top
    };

    // Handle cursor changes for code tool
    if (isCodeToolActive) {
        svg.style.cursor = 'text';
    } else if (isSelectionToolActive) {
        const targetGroup = e.target.closest('g[data-type="code-group"]');
        if (targetGroup) {
            svg.style.cursor = 'move';
        } else {
            svg.style.cursor = 'default';
        }
    }

    // Frame highlighting logic for code tool (similar to writeText)
    if (isCodeToolActive && !isCodeDragging && !isCodeResizing && !isCodeRotating) {
        const { x, y } = getSVGCoordinates(e);
        
        const tempCodeBounds = {
            x: x - 275, // Half of 550px width
            y: y - 30,  // Half of 60px height
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
    }
};


const handleCodeMouseUp = function (e) {
    // Handle code deselection when clicking outside
    if (isSelectionToolActive) {
        const targetGroup = e.target.closest('g[data-type="code-group"]');
        const isResizeHandle = e.target.closest('.resize-handle');
        const isRotateAnchor = e.target.closest('.rotate-anchor');
        
        // If we didn't click on code block or its controls, deselect
        if (!targetGroup && !isResizeHandle && !isRotateAnchor && selectedCodeBlock) {
            deselectCodeBlock();
        }
    }

    // Clear frame highlighting when done with code tool operations
    if (hoveredCodeFrame) {
        hoveredCodeFrame.removeHighlight();
        hoveredCodeFrame = null;
    }
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
const handleCodeMouseDown = function (e) {
    const activeEditor = document.querySelector(".svg-code-editor[contenteditable='true']");
    if (activeEditor && (activeEditor.contains(e.target) || activeEditor.originalForeignObject.contains(e.target))) {
         return;
    }
    if (activeEditor && !activeEditor.contains(e.target)) {
         let groupElement = activeEditor.originalGroup;
         if (groupElement) {
            renderCode(activeEditor, true);
         } else if (document.body.contains(activeEditor)){
             activeEditor.remove();
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
            const foreignObject = targetGroup.querySelector('foreignObject');
            const codeEditor = foreignObject.querySelector('.svg-code-editor');

            if (codeEditor && foreignObject) {
                console.log("Editing existing code. Group:", targetGroup);
                makeCodeEditable(codeEditor, targetGroup, foreignObject);
                e.stopPropagation();
            } else {
                 console.warn("Could not find code editor or foreignObject for editing, creating new code block instead.");
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