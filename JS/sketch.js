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
const svg = document.querySelector('svg');
const tools = document.querySelectorAll(".toolbar i");
const strokeColors = document.querySelectorAll(".strokeColors span");
const strokeThicknesses = document.querySelectorAll(".strokeThickness span");
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");
const paintBrushSideBar = document.getElementById("paintBrushSideBar");

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
        stroke: strokeColor,
        strokeWidth: strokeThickness,
        fill: strokeColor,  // Fill color
        fillStyle: "zigzag", // Change this to hachure, zigzag, dots, etc.
        hachureAngle: 60, // Angle of the hachure lines
        hachureGap: 10 // Space between hachure lines
    });

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

function toolExtraPopup() {
    if (selectedTool.classList.contains("bxs-paint")) {
        paintBrushSideBar.classList.remove("hidden");
    }
    else if (selectedTool.classList.contains("bx-square")) {
        isSquareToolActive = true;
    }
    else {
        paintBrushSideBar.classList.add("hidden"); // Hide when not paintbrush
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