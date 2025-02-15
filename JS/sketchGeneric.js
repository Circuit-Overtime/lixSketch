

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

let colorOptions = document.querySelectorAll(".squareStrokeSpan");
let backgroundColorOptions = document.querySelectorAll(".squareBackgroundSpan");
let fillStyleOptions = document.querySelectorAll(".squareFillStyleSpan");
let squareStrokeThicknessValue = document.querySelectorAll(".squareStrokeThickSpan");
let squareOutlineStyleValue = document.querySelectorAll(".squareOutlineStyle");


//utils controls 
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");
const paintBrushSideBar = document.getElementById("paintBrushSideBar");
const squareSideBar = document.getElementById("squareSideBar");

// --- Rough.js Initialization ---
const roughCanvas = window.rough.svg(svg);
const roughGenerator = roughCanvas.generator;

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

function updateUndoRedoButtons() {
    undoButton.classList.toggle("disabled", history.length === 0);
    redoButton.classList.toggle("disabled", redoStack.length === 0);
}

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);