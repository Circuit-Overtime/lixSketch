function getSVGCoordinates(event) {
    let pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    let svgPoint = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: svgPoint.x, y: svgPoint.y };
}

// Function to add text
function addText(event) {
    if (!isTextToolActive || event.button !== 0) return; // Left click only

    let { x, y } = getSVGCoordinates(event);

    let textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textElement.setAttribute("x", x);
    textElement.setAttribute("y", y);
    textElement.setAttribute("fill", "#fff"); // Default white color
    textElement.setAttribute("font-size", "30px"); // Size 30px
    textElement.setAttribute("font-family", "lixFont"); // lixFont family
    textElement.setAttribute("cursor", "text");
    textElement.setAttribute("white-space", "pre"); // Important for newline handling
    textElement.textContent = "";

    svg.appendChild(textElement);
    history.push(textElement);
    redoStack = []; // Clear redo stack
    updateUndoRedoButtons();

    // Immediately make the new text element editable
    makeTextEditable(textElement);
}

// Function to make text editable
function makeTextEditable(textElement) {
    let input = document.createElement("textarea"); // Changed to textarea for multiline
    input.value = textElement.textContent;
    input.style.position = "absolute";

    // Convert SVG text coordinates to screen coordinates
    let pt = svg.createSVGPoint();
    pt.x = parseFloat(textElement.getAttribute("x"));
    pt.y = parseFloat(textElement.getAttribute("y"));
    let screenPoint = pt.matrixTransform(svg.getScreenCTM());
    input.style.left = screenPoint.x + "px";
    input.style.top = screenPoint.y + "px";

    input.style.fontSize = "30px"; // Size 30px
    input.style.border = "none";
    input.style.outline = "none";
    input.style.background = "transparent";
    input.style.color = "#fff"; // Default white color
    input.style.fontFamily = "lixFont"; // lixFont family
    input.style.resize = "none"; // Disable resizing
    input.style.overflow = "visible"; // Show overflow for auto width/height

    document.body.appendChild(input);
    input.focus();

    // Automatically adjust textarea height
    input.style.height = "auto";
    input.style.height = (input.scrollHeight) + "px";

    input.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            // Add a newline character instead of blurring
            e.preventDefault(); // Prevent default enter behavior
            let start = input.selectionStart;
            let end = input.selectionEnd;
            input.value = input.value.substring(0, start) + "\n" + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start + 1;

            // Adjust textarea height
            input.style.height = "auto";
            input.style.height = (input.scrollHeight) + "px";
        }
        if (e.key === "Escape") {
            renderText(input, textElement, true); // true to delete if empty
        }
    });
}

function renderText(input, textElement, deleteIfEmpty = false) {
    const text = input.value || "";

    if (deleteIfEmpty && text.trim() === "") {
        // Delete the text element if it's empty and deleteIfEmpty is true
        svg.removeChild(textElement);

        // Remove from history, redo stacks.
        const index = history.indexOf(textElement);
        if (index > -1) {
            history.splice(index, 1);
        }

        updateUndoRedoButtons(); // Update buttons after modifying history
    } else {
        // Clear existing tspans
        while (textElement.firstChild) {
            textElement.removeChild(textElement.firstChild);
        }

        // Split text by newline and create tspans
        const lines = text.split("\n");
        lines.forEach((line, index) => {
            let tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            tspan.setAttribute("x", textElement.getAttribute("x"));
            tspan.setAttribute("dy", index === 0 ? "0" : "1.2em"); // Adjust line height as needed
            tspan.textContent = line;
            textElement.appendChild(tspan);
        });
    }

    document.body.removeChild(input);
}

function findTextElementAtPosition(x, y) {
    // Iterate through all text elements and find the one whose x and y attributes
    // match the given position (within a small tolerance).  Tolerance is necessary
    // due to potential rounding errors.

    const textElements = svg.querySelectorAll('text');
    const tolerance = 5; // Adjust as needed

    for (const textElement of textElements) {
        const textX = parseFloat(textElement.getAttribute('x'));
        const textY = parseFloat(textElement.getAttribute('y'));
        if (Math.abs(textX - x) <= tolerance && Math.abs(textY - y) <= tolerance) {
            return textElement;
        }
    }

    return null; // No matching text element found
}

handleTextMousedown = function(e) {
    if (selectedTool.classList.contains("bx-text") && e.button === 0) {
        if (e.target && e.target.tagName === 'text') {
            makeTextEditable(e.target);
        } else {
            addText(e);
        }
    } else if (selectedTool.classList.contains("bxs-pointer")) {
        let input = document.querySelector("textarea");
        if (input) {
            let textElement = findTextElementAtPosition(parseFloat(input.style.left), parseFloat(input.style.top));
            if (textElement) {
                renderText(input, textElement, true); // Pass the deleteIfEmpty = true
            } else {
                document.body.removeChild(input);
            }
        }
    }
}

svg.addEventListener("mousedown", handleTextMousedown);