// --- Existing Code ---
let textElements = []; // Note: This array isn't actively used in the provided selection/edit logic, but kept for context.
let textSize = "30px"; // Keep as string for initial setting
let textFont = "lixFont";
let textColor = "#fff";
let textAlign = "left";

let textColorOptions = document.querySelectorAll(".textColorSpan");
let textFontOptions = document.querySelectorAll(".textFontSpan");
let textSizeOptions = document.querySelectorAll(".textSizeSpan");
let textAlignOptions = document.querySelectorAll(".textAlignSpan");

// --- State Variables ---
let selectedElement = null; // Holds the selected <g> element
let selectionBox = null;    // Holds the <rect> for selection border
let resizeHandles = {};     // Holds the <rect> elements for resize handles {nw: rect, ne: rect, ...}
let dragOffsetX, dragOffsetY;
let isDragging = false;
let isResizing = false;
let currentResizeHandle = null; // e.g., 'nw', 'ne', 'sw', 'se'
let startBBox = null;         // BBox at the start of resize
let startFontSize = null;     // Font size at the start of resize
let startPoint = null;        // Mouse coords at start of drag/resize

let initialHandlePosRelGroup = null; // {x, y} position of the handle relative to group origin at start
let initialGroupTx = 0;
let initialGroupTy = 0; 

function getSVGCoordinates(event, element = svg) { // Added element param for specific transforms
    if (!svg || !svg.createSVGPoint) {
        console.error("SVG element or createSVGPoint method not available.");
        return { x: 0, y: 0 }; // Return default coords
    }
    let pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;

    try {
        // Use the element's screen CTM if provided and valid, otherwise SVG's
        let screenCTM = (element && typeof element.getScreenCTM === 'function' && element.getScreenCTM()) || svg.getScreenCTM();
        if (!screenCTM) {
            console.error("Could not get Screen CTM.");
            return { x: event.clientX, y: event.clientY }; // Fallback to client coords
        }
        let svgPoint = pt.matrixTransform(screenCTM.inverse());
        return {
            x: svgPoint.x,
            y: svgPoint.y,
        };
    } catch (error) {
         console.error("Error getting SVG coordinates:", error);
         return { x: event.clientX, y: event.clientY }; // Fallback
    }
}

// Function to add text wrapped in a group
function addText(event) {
    // Ensure text tool is active (this check might be redundant if handleTextMousedown handles it)
    // if (!isTextToolActive || event.button !== 0) return; // Left click only

    let { x, y } = getSVGCoordinates(event);

    // Create a group element to hold the text and transformations
    let gElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gElement.setAttribute("data-type", "text-group"); // Marker for easy identification
    gElement.setAttribute("transform", `translate(${x}, ${y})`); // Use transform for positioning

    let textElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
    );
    let textAlignElement = "start";
    if (textAlign === "center") textAlignElement = "middle";
    else if (textAlign === "right") textAlignElement = "end";

    // Text position relative to the group is (0, 0)
    textElement.setAttribute("x", 0);
    textElement.setAttribute("y", 0);
    textElement.setAttribute("fill", textColor);
    textElement.setAttribute("font-size", textSize); // Use the current global textSize
    textElement.setAttribute("font-family", textFont); // Use the current global textFont
    textElement.setAttribute("text-anchor", textAlignElement);
    textElement.setAttribute("cursor", "text");
    textElement.setAttribute("white-space", "pre"); // Important for newline handling
    textElement.setAttribute("dominant-baseline", "hanging"); // Better vertical alignment start for top-left positioning
    textElement.textContent = ""; // Start empty, user types

    // Store initial data for reference (size, font etc. on text, position on group)
    gElement.setAttribute("data-x", x); // Store original logical X
    gElement.setAttribute("data-y", y); // Store original logical Y
    textElement.setAttribute("data-initial-size", textSize);
    textElement.setAttribute("data-initial-font", textFont);
    textElement.setAttribute("data-initial-color", textColor);
    textElement.setAttribute("data-initial-align", textAlign);

    // Append text to group, then group to SVG
    gElement.appendChild(textElement);
    svg.appendChild(gElement);

    // Immediately make the new text element editable
    // Pass the group element for context and positioning
    makeTextEditable(textElement, gElement);
}

// Function to make text editable using an overlay textarea
function makeTextEditable(textElement, groupElement) { // Removed unused params
    console.log("Making text editable");

    // If already editing, return to prevent multiple textareas
    if (document.querySelector("textarea.svg-text-editor")) {
        console.log("Already editing.");
        // Optionally focus the existing editor
        // document.querySelector("textarea.svg-text-editor").focus();
        return;
    }

    // Deselect any currently selected element (important when switching from pointer to text edit)
    if (selectedElement) {
        deselectElement();
    }

    let input = document.createElement("textarea");
    input.className = "svg-text-editor"; // Add class for easier selection and styling

    // Extract and reconstruct text with newlines from tspans
    let textContent = "";
    const tspans = textElement.querySelectorAll('tspan');
    if (tspans.length > 0) {
        tspans.forEach((tspan, index) => {
            textContent += tspan.textContent.replace(/ /g, '\u00A0'); // Replace spaces with non-breaking spaces for pre-wrap
            if (index < tspans.length - 1) {
                textContent += "\n";
            }
        });
    } else {
        // Handle case where text might just be simple text content (no tspans yet)
        textContent = textElement.textContent.replace(/ /g, '\u00A0');
    }


    input.value = textContent;
    input.style.position = "absolute";
    input.style.outline = "none";
    input.style.padding = "1px"; // Minimal padding
    input.style.margin = "0";
    input.style.boxSizing = "border-box";
    input.style.overflow = "hidden"; // Hide scrollbars initially
    input.style.resize = "none"; // Disable manual resize
    input.style.whiteSpace = "pre-wrap"; // Wrap text like SVG 'pre', handles newlines
    input.style.minHeight = "1.2em"; // Minimum height based on line height
    input.style.zIndex = "10000"; // Ensure it's on top

    // --- Positioning and Sizing ---
    const svgRect = svg.getBoundingClientRect();

    // --- FIX: Handle potentially null transform ---
    let groupTransformMatrix = svg.createSVGMatrix(); // Start with identity matrix
    if (groupElement && groupElement.transform && groupElement.transform.baseVal) {
        const transformList = groupElement.transform.baseVal;
        if (transformList.numberOfItems > 0) {
            const consolidatedTransform = transformList.consolidate();
            if (consolidatedTransform) { // Check if consolidation was successful
                groupTransformMatrix = consolidatedTransform.matrix;
            } else {
                console.warn("Could not consolidate transform for group:", groupElement);
                // Attempt to get the first transform if consolidation failed (basic fallback)
                try {
                    if (transformList.length > 0) { // SVGAnimatedTransformList uses length
                       groupTransformMatrix = transformList.getItem(0).matrix;
                    }
                } catch (err) {
                    console.error("Failed to get any transform matrix.", err);
                    // Stick with identity matrix if all else fails
                }
            }
        } else {
            // No transform items, use identity (element is at 0,0 relative to parent)
            // This case might happen if transform attribute was removed or never set properly
            console.warn("Group element transform list is empty:", groupElement);
        }
    } else {
         console.warn("Group element, transform, or baseVal is missing or invalid:", groupElement);
         // Use identity matrix (element treated as if at 0,0 relative to SVG origin)
    }
    // --- End FIX ---

    // Get BBox *after* potential text content change might have occurred (less critical here, but good practice)
    const textBBox = textElement.getBBox(); // BBox in group's coordinate system

    // Calculate top-left corner in screen coordinates using the group's transform
    let pt = svg.createSVGPoint();
    // Use textBBox coords relative to the group's origin (which is 0,0 for the text element itself if positioned correctly)
    // Assuming dominant-baseline="hanging", the textBBox.y should be close to 0 or slightly negative.
    pt.x = textBBox.x;
    pt.y = textBBox.y;

    // Apply the group's transformation matrix and the SVG's screen CTM
    let screenPt = pt.matrixTransform(groupTransformMatrix.multiply(svg.getScreenCTM()));

    input.style.left = `${screenPt.x + svgRect.left}px`;
    input.style.top = `${screenPt.y + svgRect.top}px`;

    // Approximate width/height based on bbox - give it some extra width for typing
    const svgZoomFactor = svg.getScreenCTM() ? svg.getScreenCTM().a : 1; // Get current zoom factor from matrix 'a' component
    const screenWidth = textBBox.width * svgZoomFactor;
    //const screenHeight = textBBox.height * svgZoomFactor; // Height will be auto

    input.style.width = `${Math.max(screenWidth + 30, 100)}px`; // Add buffer, min width 100px
    input.style.height = "auto"; // Start with auto height

    // Set font properties from the SVG text element
    const currentFontSize = textElement.getAttribute("font-size") || "30px";
    const currentFontFamily = textElement.getAttribute("font-family") || "lixFont";
    const currentFill = textElement.getAttribute("fill") || "#fff";
    const currentAnchor = textElement.getAttribute("text-anchor") || "start";
    input.style.width = "auto"; // Allow input to grow horizontally
    input.style.height = "auto"; // Allow input to grow vertically
    input.style.overflow = "visible"; // Ensure no scrollbars
    input.style.whiteSpace = "nowrap"; // Prevent wrapping
    input.style.fontSize = currentFontSize;
    input.style.fontFamily = currentFontFamily;
    input.style.color = currentFill; // Use fill for text color
    input.style.lineHeight = "1.2em"; // Should match tspan dy for consistency
    // input.style.backgroundColor = "rgba(40, 40, 40, 0.9)"; // Darker semi-transparent background
    input.style.textAlign = currentAnchor === "middle" ? "center" : currentAnchor === "end" ? "right" : "left";

    document.body.appendChild(input);

    // Auto-adjust height after adding to DOM and applying styles
    const adjustHeight = () => {
        input.style.height = 'auto'; // Reset height
        input.style.height = input.scrollHeight + 'px'; // Set to scroll height
        // Optional: Add max-height constraint if needed
        // const maxHeight = svgRect.height - (screenPt.y); // Example max height
        // if (input.scrollHeight > maxHeight) {
        //     input.style.height = maxHeight + 'px';
        //     input.style.overflowY = 'auto';
        // } else {
        //     input.style.overflowY = 'hidden';
        // }
    };
    adjustHeight(); // Initial adjustment


    // Delay focus slightly to ensure element is ready
    setTimeout(() => {
        input.focus();
        input.select(); // Select existing text
    }, 50);


    // Adjust height dynamically on input
    input.addEventListener('input', adjustHeight);


    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { // Enter finishes editing
            e.preventDefault();
            renderText(input, textElement, true); // Finish editing
        } else if (e.key === "Escape") { // Escape cancels editing (or finishes)
            e.preventDefault();
            renderText(input, textElement, true); // Finish editing (consider adding cancel logic if needed)
        }
        // Allow Shift+Enter for newlines implicitly via textarea default behavior
    });

    // Store references
    input.originalTextElement = textElement;
    input.textGroup = groupElement;

    // --- FIX for click outside ---
    // Use a named function for the listener so it can be removed correctly.
    const handleClickOutside = (event) => {
        // Check if the click target is the input itself or within it
        if (!input.contains(event.target)) {
            renderText(input, textElement, true); // Finish editing
            document.removeEventListener('mousedown', handleClickOutside, true); // Clean up listener using the named function
        }
    };
    // Use capture phase for the outside click listener
    document.addEventListener('mousedown', handleClickOutside, true);
    input.handleClickOutside = handleClickOutside; // Store reference for potential manual removal in renderText

    // Hide the SVG text group while editing
    groupElement.style.display = "none";
}

// Function to render the text from textarea back to SVG tspans
function renderText(input, textElement, deleteIfEmpty = false) {
    if (!input || !document.body.contains(input)) {
         console.warn("RenderText called but input textarea is already removed.");
         return; // Already removed or cleaned up
    }

    const text = input.value || "";
    const gElement = input.textGroup; // Get the group from the input reference

    // Cleanup the outside click listener associated with THIS input
    if (input.handleClickOutside) {
        document.removeEventListener('mousedown', input.handleClickOutside, true); // Ensure listener removal
    }

    // Remove the textarea from the document *before* manipulating SVG sometimes helps prevent focus issues
    document.body.removeChild(input);


    if (!gElement || !textElement) {
        console.error("RenderText cannot find original group or text element.");
        return; // Critical elements missing
    }

    // Ensure the group is still part of the SVG
    if (!gElement.parentNode) {
        console.warn("RenderText: Group element no longer attached to SVG.");
        // If this was the selected element, ensure it's fully deselected
        if (selectedElement === gElement) {
             deselectElement();
        }
        return; // Nothing to render back to
    }


    if (deleteIfEmpty && text.trim() === "") {
        svg.removeChild(gElement);
        // If this was the selected element, clear selection state
        if (selectedElement === gElement) {
            selectedElement = null; // Clear reference, feedback is already gone or will be removed by deselect if needed
            removeSelectionFeedback(); // Explicitly remove feedback just in case
        }
    } else {
        // Clear any existing tspans/text content
        while (textElement.firstChild) {
            textElement.removeChild(textElement.firstChild);
        }

        // Split text by newline and create tspans
        const lines = text.split("\n");
        const x = textElement.getAttribute("x") || 0; // Base x for all tspans (usually 0 relative to group)

        lines.forEach((line, index) => {
            let tspan = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "tspan"
            );
            tspan.setAttribute("x", x);
            tspan.setAttribute("dy", index === 0 ? "0" : "1.2em"); // Line height based on font size via 'em'
            // Handle empty lines: use a non-breaking space to maintain line height
            tspan.textContent = line.replace(/\u00A0/g, ' ') || " "; // Convert back non-breaking spaces, use space for empty lines
            textElement.appendChild(tspan);
        });

        // Make the text group visible again *after* updating content
        gElement.style.display = 'block';

        // Update selection box if the element was selected (after text reflow)
        if (selectedElement === gElement) {
             // Use setTimeout to allow browser rendering engine to recalculate bbox
            setTimeout(updateSelectionFeedback, 0);
        }
    }

    // Check if the element we just finished editing should be selected (if pointer tool active)
    // Check parentNode again, as it might have been removed if empty
    if (selectedTool && selectedTool.classList.contains('bxs-pointer') && gElement.parentNode === svg) {
        selectElement(gElement); // Select the element after editing is done
    } else if (selectedElement === gElement) {
        // If the pointer tool isn't active, but we were editing the selected element, deselect it.
        deselectElement();
    }
}


// --- Selection and Interaction Functions ---

function createSelectionFeedback(groupElement) {
    if (!groupElement) return;
    removeSelectionFeedback(); // Remove any existing feedback first

    const textElement = groupElement.querySelector('text');
    if (!textElement) {
         console.warn("Cannot create selection feedback: text element not found in group.");
         return;
    }

    // Use getBBox which is in the element's coordinate system (before transforms).
    const bbox = textElement.getBBox();

    // Adjust bbox slightly for padding around text
    const padding = 3; // Increase padding slightly
    const handleSize = 8;
    const handleOffset = handleSize / 2;

    const selX = bbox.x - padding;
    const selY = bbox.y - padding; // Assumes dominant-baseline="hanging" makes y near 0
    const selWidth = bbox.width + 2 * padding;
    const selHeight = bbox.height + 2 * padding;


    // Create selection rectangle (append to the group so it inherits transforms)
    selectionBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    selectionBox.setAttribute("class", "selection-box"); // Add class for styling
    selectionBox.setAttribute("x", selX);
    selectionBox.setAttribute("y", selY);
    selectionBox.setAttribute("width", selWidth);
    selectionBox.setAttribute("height", selHeight);
    selectionBox.setAttribute("fill", "none");
    selectionBox.setAttribute("stroke", "#007bff");
    selectionBox.setAttribute("stroke-width", "1");
    selectionBox.setAttribute("stroke-dasharray", "4,2"); // Adjusted dash array
    selectionBox.setAttribute("vector-effect", "non-scaling-stroke"); // Keep stroke width constant on zoom
    selectionBox.setAttribute("pointer-events", "none"); // Click through the box itself
    groupElement.appendChild(selectionBox);

    // Create resize handles (append to the group)
    const handlesData = [
        { name: 'nw', x: selX, y: selY, cursor: 'nwse-resize' },
        { name: 'ne', x: selX + selWidth, y: selY, cursor: 'nesw-resize' },
        { name: 'sw', x: selX, y: selY + selHeight, cursor: 'nesw-resize' },
        { name: 'se', x: selX + selWidth, y: selY + selHeight, cursor: 'nwse-resize' }
    ];

    resizeHandles = {}; // Clear old handles object before creating new ones
    handlesData.forEach(handle => {
        const handleRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        handleRect.setAttribute("class", `resize-handle resize-handle-${handle.name}`); // Add classes
        handleRect.setAttribute("x", handle.x - handleOffset);
        handleRect.setAttribute("y", handle.y - handleOffset);
        handleRect.setAttribute("width", handleSize);
        handleRect.setAttribute("height", handleSize);
        handleRect.setAttribute("fill", "#fff");
        handleRect.setAttribute("stroke", "#007bff");
        handleRect.setAttribute("stroke-width", "1");
         handleRect.setAttribute("vector-effect", "non-scaling-stroke"); // Keep handle stroke constant
        handleRect.style.cursor = handle.cursor; // Use style for cursor
        handleRect.setAttribute("data-anchor", handle.name); // Store anchor name
        groupElement.appendChild(handleRect);
        resizeHandles[handle.name] = handleRect; // Store reference

         // Add mousedown listener directly to handles
        handleRect.addEventListener('mousedown', (e) => {
             if (selectedTool && selectedTool.classList.contains("bxs-pointer")) {
                e.stopPropagation(); // Prevent group's drag listener
                startResize(e, handle.name);
             }
        });
    });
}

function updateSelectionFeedback() {
    if (!selectedElement || !selectionBox) return;

    const textElement = selectedElement.querySelector('text');
    if (!textElement) return;

    // Ensure group is visible before getting BBox, otherwise bbox might be 0
    const كان_مخفيا = selectedElement.style.display === 'none';
    if (كان_مخفيا) selectedElement.style.display = 'block';

    const bbox = textElement.getBBox();

    if (كان_مخفيا) selectedElement.style.display = 'none'; // Hide again if it was hidden

    // Check for valid bbox dimensions
     if (bbox.width === 0 && bbox.height === 0 && textElement.textContent.trim() !== "") {
         console.warn("BBox calculation resulted in zero dimensions. Feedback may be incorrect.");
         // Might need a redraw or slight delay if this happens often
     }


    const padding = 3;
    const handleSize = 8;
    const handleOffset = handleSize / 2;

    const selX = bbox.x - padding;
    const selY = bbox.y - padding;
    const selWidth = Math.max(bbox.width + 2 * padding, handleSize); // Ensure min width/height for handles
    const selHeight = Math.max(bbox.height + 2 * padding, handleSize);

    // Update selection box
    selectionBox.setAttribute("x", selX);
    selectionBox.setAttribute("y", selY);
    selectionBox.setAttribute("width", selWidth);
    selectionBox.setAttribute("height", selHeight);

    // Update handles using the stored references
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
}


function removeSelectionFeedback() {
    // Use class selector for robustness
    if (selectedElement) {
        const box = selectedElement.querySelector(".selection-box");
        if (box) box.remove();
        selectedElement.querySelectorAll(".resize-handle").forEach(handle => handle.remove());
    }
    // Clear references even if elements were already removed
    selectionBox = null;
    resizeHandles = {};
}

function selectElement(groupElement) {
    if (!groupElement || !groupElement.parentNode) { // Ensure element is in the DOM
         console.warn("Attempted to select an invalid or detached group element.");
         return;
    }
    if (groupElement === selectedElement) return; // Already selected

    deselectElement(); // Deselect previous first
    selectedElement = groupElement;
    selectedElement.classList.add("selected"); // Optional: add class for CSS styling
    createSelectionFeedback(selectedElement);
    console.log("Selected:", selectedElement);

    // Bring selected element to front (optional, can cause issues with layering)
    // svg.appendChild(selectedElement);
}

function deselectElement() {
    // If an editor is active, finish editing first
    const activeEditor = document.querySelector("textarea.svg-text-editor");
    if (activeEditor) {
         let textElement = activeEditor.originalTextElement;
         if (textElement) {
            renderText(activeEditor, textElement, true); // delete if empty
         } else if (document.body.contains(activeEditor)) {
             document.body.removeChild(activeEditor); // Failsafe removal
         }
    }


    if (selectedElement) {
        removeSelectionFeedback();
        selectedElement.classList.remove("selected"); // Optional class removal
        console.log("Deselected:", selectedElement);
        selectedElement = null;
    }
}


// --- Dragging and Resizing Logic ---

function startDrag(event) {
    if (!selectedElement || event.button !== 0) return;

    // Prevent drag start if clicking on a handle
     if (event.target.closest('.resize-handle')) {
         return;
     }

    isDragging = true;
    isResizing = false; // Ensure not resizing
    // Prevent text selection browser behavior during drag
    event.preventDefault();

    // Get initial transform matrix
    const currentTransform = selectedElement.transform.baseVal.consolidate();
    const initialTranslateX = currentTransform ? currentTransform.matrix.e : 0;
    const initialTranslateY = currentTransform ? currentTransform.matrix.f : 0;

    // Get mouse position in SVG coordinates
    startPoint = getSVGCoordinates(event);

    // Calculate offset relative to the group's translation
    dragOffsetX = startPoint.x - initialTranslateX;
    dragOffsetY = startPoint.y - initialTranslateY;

    svg.style.cursor = 'grabbing'; // Change cursor for SVG area

    // Add move/up listeners to window to capture mouse outside SVG
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
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

  // Store starting mouse position RELATIVE TO THE GROUP
  startPoint = getSVGCoordinates(event, selectedElement);

  // --- NEW: Store initial group transform ---
  const currentTransform = selectedElement.transform.baseVal.consolidate();
  initialGroupTx = currentTransform ? currentTransform.matrix.e : 0;
  initialGroupTy = currentTransform ? currentTransform.matrix.f : 0;

  // --- NEW: Store initial relative position of the dragged handle ---
  const padding = 3; // Match feedback padding
  const startX = startBBox.x - padding;
  const startY = startBBox.y - padding;
  const startWidth = startBBox.width + 2 * padding;
  const startHeight = startBBox.height + 2 * padding;

  let hx = startX; // Default NW
  let hy = startY;
  if (anchor.includes('e')) { hx = startX + startWidth; }
  if (anchor.includes('s')) { hy = startY + startHeight; }
  initialHandlePosRelGroup = { x: hx, y: hy };
  // --- End NEW ---


  svg.style.cursor = resizeHandles[anchor]?.style.cursor || 'default';

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}

// --- Combined Mouse Move Handler ---
const handleMouseMove = (event) => {
  if (!selectedElement) return;
   event.preventDefault();

  if (isDragging) {
      // --- Dragging Logic (remains the same) ---
      const currentPoint = getSVGCoordinates(event);
      const newTranslateX = currentPoint.x - dragOffsetX;
      const newTranslateY = currentPoint.y - dragOffsetY;
      selectedElement.setAttribute('transform', `translate(${newTranslateX}, ${newTranslateY})`);
      // --- End Dragging Logic ---

  } else if (isResizing) {
      // --- RESIZE LOGIC (Modified for Handle Origin) ---
      const textElement = selectedElement.querySelector('text');
      if (!textElement || !startBBox || startFontSize === null || !startPoint || !initialHandlePosRelGroup) return; // Need start state

      const currentPoint = getSVGCoordinates(event, selectedElement); // Mouse coords relative to group

      // --- Step 1: Calculate Scale Factor (based on opposite corner) ---
      const startX = startBBox.x;
      const startY = startBBox.y;
      const startWidth = startBBox.width;
      const startHeight = startBBox.height;

      let fixedX, fixedY; // Opposite corner coords relative to group origin
      if (currentResizeHandle.includes('e')) { fixedX = startX; } else { fixedX = startX + startWidth; }
      if (currentResizeHandle.includes('s')) { fixedY = startY; } else { fixedY = startY + startHeight; }

      let targetWidth = Math.abs(currentPoint.x - fixedX);
      let targetHeight = Math.abs(currentPoint.y - fixedY);
      const minDimension = 5;
      targetWidth = Math.max(targetWidth, minDimension);
      targetHeight = Math.max(targetHeight, minDimension);

      let scaleY = 1;
      if (startHeight > 1) { scaleY = targetHeight / startHeight; }
      let chosenScale = scaleY; // Use height scale for font size

      const minScale = 0.1;
      const maxScale = 10.0;
      chosenScale = Math.max(minScale, Math.min(chosenScale, maxScale));

      const newFontSize = startFontSize * chosenScale;
      const minFontSize = 5;
      const finalFontSize = Math.max(newFontSize, minFontSize);

      // --- Step 2: Apply Font Size Change ---
      textElement.setAttribute("font-size", `${finalFontSize}px`);

      // --- Step 3: Get New BBox (Potential Reflow Issue Here) ---
      // Force redraw/reflow before getting bbox (might not be necessary/work consistently)
      // textElement.getBoundingClientRect(); // Read a layout property to potentially trigger reflow
      const currentBBox = textElement.getBBox(); // Get bbox AFTER font size change

      // --- Step 4: Calculate New Relative Handle Position ---
      const padding = 3; // Match feedback padding
      const currentSelX = currentBBox.x - padding;
      const currentSelY = currentBBox.y - padding;
      const currentSelWidth = currentBBox.width + 2 * padding;
      const currentSelHeight = currentBBox.height + 2 * padding;

      let newHx = currentSelX; // Default NW
      let newHy = currentSelY;
      if (currentResizeHandle.includes('e')) { newHx = currentSelX + currentSelWidth; }
      if (currentResizeHandle.includes('s')) { newHy = currentSelY + currentSelHeight; }
      const newHandlePosRelGroup = { x: newHx, y: newHy };

      // --- Step 5: Calculate Relative Shift ---
      // How much the handle position *within the group* changed due to scaling
      const deltaXRel = newHandlePosRelGroup.x - initialHandlePosRelGroup.x;
      const deltaYRel = newHandlePosRelGroup.y - initialHandlePosRelGroup.y;

      // --- Step 6: Calculate New Group Translation ---
      // Adjust the initial translation by the *opposite* of the relative handle shift
      const newGroupTx = initialGroupTx - deltaXRel;
      const newGroupTy = initialGroupTy - deltaYRel;

      // --- Step 7: Apply New Transform ---
      selectedElement.setAttribute('transform', `translate(${newGroupTx}, ${newGroupTy})`);

      // --- Step 8: Update Feedback ---
      // Use setTimeout to potentially improve visual smoothness and allow reflow before feedback update
      clearTimeout(selectedElement.updateFeedbackTimeout);
      selectedElement.updateFeedbackTimeout = setTimeout(() => {
           updateSelectionFeedback();
           delete selectedElement.updateFeedbackTimeout;
      }, 0);

  } // End of isResizing block
};


// --- Mouse Up Handler ---
const handleMouseUp = (event) => {
  if (event.button !== 0) return;

  if (isDragging && selectedElement) {
      // Update the data attributes for persistence/undo (Store final calculated position)
       const currentTransform = selectedElement.transform.baseVal.consolidate();
       if (currentTransform) {
          const finalTranslateX = currentTransform.matrix.e;
          const finalTranslateY = currentTransform.matrix.f;
          selectedElement.setAttribute("data-x", finalTranslateX);
          selectedElement.setAttribute("data-y", finalTranslateY);
          console.log("Drag End - Final Pos:", finalTranslateX, finalTranslateY);
       } else {
           console.warn("Could not get final transform after dragging.");
           // Store last known good values if needed
           // selectedElement.setAttribute("data-x", initialGroupTx); // Or calculate based on last mousemove
           // selectedElement.setAttribute("data-y", initialGroupTy);
       }

  } else if (isResizing && selectedElement) {
       const textElement = selectedElement.querySelector('text');
       if (textElement) {
           const finalFontSize = textElement.getAttribute("font-size");
           console.log("Resize End - Final Font Size:", finalFontSize);

           // Store final transform position as well
           const currentTransform = selectedElement.transform.baseVal.consolidate();
           if (currentTransform) {
               const finalTranslateX = currentTransform.matrix.e;
               const finalTranslateY = currentTransform.matrix.f;
               selectedElement.setAttribute("data-x", finalTranslateX);
               selectedElement.setAttribute("data-y", finalTranslateY);
               console.log("Resize End - Final Pos:", finalTranslateX, finalTranslateY);
           }

           // Final update to feedback visuals
           clearTimeout(selectedElement.updateFeedbackTimeout); // Clear any pending update
           updateSelectionFeedback();
       }
  }

  // Reset states and remove global listeners
  isDragging = false;
  isResizing = false;
  currentResizeHandle = null;
  startPoint = null;
  startBBox = null;
  startFontSize = null;
  dragOffsetX = undefined;
  dragOffsetY = undefined;
  initialHandlePosRelGroup = null; // Reset new state variables
  initialGroupTx = 0;
  initialGroupTy = 0;


  svg.style.cursor = 'default'; // Reset SVG cursor

  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
};


// --- Mousedown Handler on SVG --- (Handles Tool Logic, Selection, Deselection)
const handleTextMousedown = function (e) {

    // Check if clicking inside an active text editor (textarea)
    const activeEditor = document.querySelector("textarea.svg-text-editor");
    if (activeEditor && activeEditor.contains(e.target)) {
         // Click is inside the editor, let its own handlers manage it (e.g., text selection)
         return;
    }
     // If an editor exists but the click is outside it, render the text first
    if (activeEditor && !activeEditor.contains(e.target)) {
         // Find the associated text element to render
         let textElement = activeEditor.originalTextElement;
         if (textElement) {
            renderText(activeEditor, textElement, true); // delete if empty
         } else if (document.body.contains(activeEditor)){ // Ensure it's still in body
             document.body.removeChild(activeEditor); // Failsafe removal
         }
         // Important: Let the mousedown event continue after closing the editor,
         // so it can potentially select another element or deselect.
    }

    // --- Pointer Tool Logic ---
    if (selectedTool && selectedTool.classList.contains("bxs-pointer") && e.button === 0) {
        const targetGroup = e.target.closest('g[data-type="text-group"]');

        if (targetGroup) {
             // Clicked on a text group or its children (text, tspan, feedback rects)

             // Check if clicking on a resize handle (handled by the handle's own listener)
             if (e.target.closest('.resize-handle')) {
                 // startResize is called by the handle's listener, do nothing here in the group listener
                 return;
             }

             // If clicking the text/tspan/group itself
            if (targetGroup === selectedElement) {
                // Already selected, initiate drag
                startDrag(e);
            } else {
                // Select the new element
                selectElement(targetGroup);
                // Immediately start drag after selecting
                startDrag(e);
            }
        } else {
            // Clicked outside any text group, deselect
            deselectElement();
        }

    // --- Text Tool Logic --- (FIXED for editing)
    } else if (selectedTool && selectedTool.classList.contains("bx-text") && e.button === 0) {
         // Find the closest text group ancestor of the clicked element
         const targetGroup = e.target.closest('g[data-type="text-group"]');

        // Check if the click was directly on text/tspan INSIDE a group
        if (targetGroup && (e.target.tagName === "text" || e.target.tagName === "tspan")) {
            let textEl = targetGroup.querySelector('text'); // Get the text element from the group

            // --- FIX: Ensure textEl and targetGroup are valid before proceeding ---
            if (textEl && targetGroup) {
                console.log("Editing existing text. Group:", targetGroup, "TextEl:", textEl);
                // Pass group for context and positioning
                makeTextEditable(textEl, targetGroup);
                // Prevent creating new text right after starting edit
                e.stopPropagation();
            } else {
                 // This case shouldn't happen often if targetGroup and text/tspan were found, but good fallback.
                 console.warn("Could not find text element or group for editing, creating new text instead.");
                 deselectElement(); // Deselect any selected element first
                 addText(e); // Fallback to creating new text
            }
            // --- End FIX ---

        } else {
             // Clicked on empty space or non-text element with text tool, create new text
             console.log("Creating new text.");
             deselectElement(); // Deselect any selected element first
             addText(e);
        }
    }
    // --- Other Tools ---
    // else if (selectedTool.classList.contains('some-other-tool')) {
    //     deselectElement(); // Often good to deselect when using other drawing tools
    // }
};

// --- Event Listeners ---
if (svg) {
    svg.addEventListener("mousedown", handleTextMousedown);

    // Add double-click listener for editing with pointer tool
    svg.addEventListener('dblclick', (e) => {
        if (selectedTool && selectedTool.classList.contains("bxs-pointer")) {
             const targetGroup = e.target.closest('g[data-type="text-group"]');
             // Ensure dblclick is on the text/tspan itself, not handles/box
             if (targetGroup && (e.target.tagName === "text" || e.target.tagName === "tspan")) {
                 let textEl = targetGroup.querySelector('text');
                 if (textEl) {
                     makeTextEditable(textEl, targetGroup);
                     e.stopPropagation(); // Prevent potential single click actions after dblclick
                 }
             }
        }
    });
}


// --- Tool Change Handling (Example - Adapt to your actual tool switching mechanism) ---
function handleToolChange(newToolElement) {
    if (!newToolElement) return;

    // Update global state
    selectedTool = newToolElement;
    isTextToolActive = selectedTool.classList.contains("bx-text"); // Update text tool state flag
    console.log("Tool changed to:", selectedTool.classList);

    // --- Cleanup based on new tool ---

    // Ensure any active textarea is closed when switching tools *unless* switching TO the text tool?
    // Generally safest to always close editor on tool change.
    const activeEditor = document.querySelector("textarea.svg-text-editor");
    if (activeEditor) {
         let textElement = activeEditor.originalTextElement;
         if (textElement) {
             renderText(activeEditor, textElement, true); // delete if empty
         } else if (document.body.contains(activeEditor)) {
             document.body.removeChild(activeEditor); // Failsafe removal
         }
    }

    // If the new tool is not the pointer, deselect any selected element
    if (!selectedTool.classList.contains("bxs-pointer")) {
        deselectElement();
    }

    // Update SVG cursor based on tool
    if (isTextToolActive) {
        svg.style.cursor = 'text';
    } else if (selectedTool.classList.contains("bxs-pointer")) {
        svg.style.cursor = 'default'; // Or 'grab' if you implement panning
    } else {
        svg.style.cursor = 'crosshair'; // Default for other tools
    }

    // Call your UI update function if needed
    // toolExtraPopup(); // Assuming this updates UI based on selectedTool
}

// --- Option Handlers (Color, Font, Size, Align) ---
// These now update the *selected* element if one exists

textColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent triggering svg mousedown
        textColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        textColor = span.getAttribute("data-id"); // Update global default
        console.log("Set Default Text Color:", textColor);

        // Update selected element if exists
        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                textElement.setAttribute('fill', textColor);
                // Optionally update data attribute if you store it for undo/redo
                // textElement.setAttribute("data-current-color", textColor);
            }
        }
    });
});

textFontOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        textFontOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        textFont = span.getAttribute("data-id"); // Update global default
        console.log("Set Default Text Font:", textFont);

        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                textElement.setAttribute('font-family', textFont);
                // Font change affects bbox, update feedback after reflow
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
        // Keep textSize as string 'Npx' for consistency with setAttribute
        textSize = span.getAttribute("data-id") + "px"; // Update global default
        console.log("Set Default Text Size:", textSize);

        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                textElement.setAttribute('font-size', textSize);
                 // Size change affects bbox, update feedback after reflow
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
        textAlign = span.getAttribute("data-id"); // 'left', 'center', 'right' - Update global default
        console.log("Set Default Text Align:", textAlign);

        if (selectedElement) {
            const textElement = selectedElement.querySelector('text');
            if (textElement) {
                let anchor = 'start'; // Default for left
                if (textAlign === 'center') anchor = 'middle';
                else if (textAlign === 'right') anchor = 'end';
                textElement.setAttribute('text-anchor', anchor);
                // Align change *might* affect bbox if text reflows significantly, update just in case
                setTimeout(updateSelectionFeedback, 0);
            }
        }
    });
});

// --- Helper for getting transform values (currently not used, but potentially useful) ---
function getTransformValues(element) {
    const transform = element.transform.baseVal.consolidate();
    return {
        translateX: transform ? transform.matrix.e : 0,
        translateY: transform ? transform.matrix.f : 0,
        // Note: Doesn't handle scale/rotate here, assumes only translate for this basic getter
    };
}

