import { getStroke } from "https://cdn.skypack.dev/perfect-freehand";
import rough from "https://cdn.skypack.dev/roughjs@latest";

// --- State Variables ---
let strokeColor = "#fff";
let strokeThickness = 2;
let selectedTool = document.querySelector(".bx-square");
let currentPath = null;
let points = [];
let history = [];
let redoStack = [];
let isSquareToolActive = false;
let startX, startY;
let squareElement = null; // Store the drawn square element

// --- DOM Elements ---
const svg = document.querySelector('#freehand-canvas');
const tools = document.querySelectorAll(".toolbar i");

//for paint brush 
const strokeColors = document.querySelectorAll(".strokeColors span");
const strokeThicknesses = document.querySelectorAll(".strokeThickness span");

//for square 
let squareStrokecolor = "#fff";
let squareBackgroundColor = "#fff";
let squareFillStyleValue = "hachure";
let squareStrokeThicknes = 2;
let squareOutlineStyle = "solid";

const colorOptions = document.querySelectorAll(".squareStrokeSpan");
const backgroundColorOptions = document.querySelectorAll(".squareBackgroundSpan");
const fillStyleOptions = document.querySelectorAll(".squareFillStyleSpan");
const squareStrokeThicknessValue = document.querySelectorAll(".squareStrokeThickSpan");
const squareOutlineStyleValue = document.querySelectorAll(".squareOutlineStyle");


//utils controls 
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");
const paintBrushSideBar = document.getElementById("paintBrushSideBar");
const squareSideBar = document.getElementById("squareSideBar");

// --- Rough.js Initialization ---
const roughCanvas = rough.svg(svg);
const roughGenerator = roughCanvas.generator;


// --- Utility Functions ---

function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return '';
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[i + 1] || arr[i];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ['M', ...stroke[0], 'Q']
    );
    d.push('Z');
    return d.join(' ');
}

function createNewPathElement() {
    const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    newPath.setAttribute("stroke", strokeColor);
    newPath.setAttribute("fill", "none"); //Important: fill none so it doesnt fill the drawn stroke
    newPath.setAttribute("stroke-width", strokeThickness);
    newPath.setAttribute("stroke-linecap", "round");
    newPath.setAttribute("stroke-linejoin", "round");
    return newPath;
}

function renderStroke() {
    if (!currentPath) return;
    const stroke = getStroke(points, {
        size: strokeThickness,
        thinning: 0.5,
        smoothing: 0.8,
        streamline: 0.2,
        easing: (t) => t,
        start: {
            taper: 0,
            easing: (t) => t,
            cap: true
        },
        end: {
            taper: 0,
            easing: (t) => t,
            cap: true
        },
        simulatePressure: false
    });
    currentPath.setAttribute('d', getSvgPathFromStroke(stroke));
}

function drawSquare(x, y, width, height) {
    // Remove old square element if it exists
    if (squareElement) {
        svg.removeChild(squareElement);
        squareElement = null;
    }

    const rc = rough.svg(svg);
    const element = rc.rectangle(x, y, width, height, {
        stroke: squareStrokecolor,
        strokeWidth: squareStrokeThicknes,
        fill: squareBackgroundColor,  // Fill color
        fillStyle: squareFillStyleValue, // Change this to hachure, zigzag, dots, etc.
        hachureAngle: 60, // Angle of the hachure lines
        hachureGap: 10 // Space between hachure lines
    });

    if (squareOutlineStyle === "dashed") {
        element.setAttribute("stroke-dasharray", "10,10");
    } else if (squareOutlineStyle === "dotted") {
        element.setAttribute("stroke-dasharray", "2,8");
    }

    squareElement = element;
    svg.appendChild(element);

}


function updateUndoRedoButtons() {
    undoButton.classList.toggle("disabled", history.length === 0);
    redoButton.classList.toggle("disabled", redoStack.length === 0);
}

// --- Event Handlers ---

function handleStrokeColorSelection(event) {
    strokeColors.forEach(s => s.classList.remove("selected"));
    event.target.classList.add("selected");
    strokeColor = event.target.getAttribute("data-id");
    console.log("Selected Color:", strokeColor);
}

function handleStrokeThicknessSelection(event) {
    strokeThicknesses.forEach(t => t.classList.remove("selected"));
    event.target.classList.add("selected");
    strokeThickness = parseInt(event.target.getAttribute("data-id"));
    console.log("Selected Thickness:", strokeThickness);
}

function handleToolSelection(event) {
    tools.forEach(t => t.classList.remove("selected"));
    const tool = event.target;
    tool.classList.add("selected");
    selectedTool = tool;
    isSquareToolActive = tool.classList.contains("bx-square");
    toolExtraPopup();
}

// Square Stroke Color Selection
colorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        colorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareStrokecolor = span.getAttribute("data-id");
        console.log("Selected Stroke Color:", squareStrokecolor);
    });
});

// Square Background Color Selection
backgroundColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        backgroundColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareBackgroundColor = span.getAttribute("data-id");
        console.log("Selected Background Color:", squareBackgroundColor);
    });
});

// Square Fill Style Selection
fillStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        fillStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareFillStyleValue = span.getAttribute("data-id");
        console.log("Selected Fill Style:", squareFillStyleValue);
        event.stopPropagation()
    });
});

// Square Stroke Thickness Selection
squareStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        squareStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareStrokeThicknes = parseInt(span.getAttribute("data-id"));
        console.log("Selected Stroke Thickness:", squareStrokeThicknes);
        event.stopPropagation()
    });
});

// Square Outline Style Selection
squareOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        squareOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareOutlineStyle = span.getAttribute("data-id");
        console.log("Selected Outline Style:", squareOutlineStyle);
        event.stopPropagation()
    });
});


function toolExtraPopup() {
    if (selectedTool.classList.contains("bxs-paint")) {
        paintBrushSideBar.classList.remove("hidden");
        squareSideBar.classList.add("hidden");
    }
    else if (selectedTool.classList.contains("bx-square")) {
        isSquareToolActive = true;
        squareSideBar.classList.remove("hidden");
        paintBrushSideBar.classList.add("hidden");
    }
    else {
        paintBrushSideBar.classList.add("hidden");
        squareSideBar.classList.add("hidden");
    }
}

function handlePointerDown(e) {
    if (isSquareToolActive) {
        startX = e.clientX;
        startY = e.clientY;

        // Initialize squareElement to null here before drawing a new one
        squareElement = null;

        svg.addEventListener('pointermove', handlePointerMove); // Start tracking movement
    }
    else if (selectedTool.classList.contains("bxs-paint")) {
        points = [[e.clientX, e.clientY, e.pressure]];
        currentPath = createNewPathElement();
        svg.appendChild(currentPath); // Append the new path immediately
        renderStroke();
        svg.addEventListener('pointermove', handlePointerMove);
    }
}


function handlePointerMove(e) {
    if (isSquareToolActive) {
        const width = e.clientX - startX;
        const height = e.clientY - startY;
        drawSquare(startX, startY, width, height);
    }
    else if (e.buttons === 1 && selectedTool.classList.contains("bxs-paint")) {
        points.push([e.clientX, e.clientY, e.pressure]);
        renderStroke();
    }
}


function handlePointerUp() {
    svg.removeEventListener("pointermove", handlePointerMove);

    if (isSquareToolActive && squareElement) {
        history.push(squareElement); // Store the square element
        squareElement = null;       // Reset squareElement after pushing it into history
    }
    else if (currentPath) {
        history.push(currentPath);
        currentPath = null;

    }

    points = [];
    redoStack = [];
    updateUndoRedoButtons();
}

function undo() {
    if (history.length > 0) {
        const lastElement = history.pop();
        redoStack.push(lastElement);
        svg.removeChild(lastElement);
        updateUndoRedoButtons();
    }
}

function redo() {
    if (redoStack.length > 0) {
        const lastRedo = redoStack.pop();
        history.push(lastRedo);
        svg.appendChild(lastRedo);
        updateUndoRedoButtons();
    }
}

// --- Event Listeners ---
strokeColors.forEach(stroke => stroke.addEventListener("click", handleStrokeColorSelection));
strokeThicknesses.forEach(thickness => thickness.addEventListener("click", handleStrokeThicknessSelection));
tools.forEach(tool => tool.addEventListener("click", handleToolSelection));


svg.addEventListener('pointerdown', handlePointerDown);
svg.addEventListener('pointerup', handlePointerUp);

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);

// --- Initialization ---
window.onload = () => {
    toolExtraPopup();
    updateUndoRedoButtons();
};