

// --- State Variables ---
let strokeColor = "#fff";
let strokeThickness = 2;
let selectedTool = document.querySelector(".bxs-pointer");
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


//for the zoom effect 
let currentZoom = 1;
const minScale = 0.4;
const maxScale = 30; 
const minZoom = 0.4;
const maxZoom = 30; 
let currentTranslation = { x: 0, y: 0 }; 
const freehandCanvas = document.getElementById("freehand-canvas");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const zoomPercentSpan = document.getElementById("zoomPercent");
let currentMatrix = new DOMMatrix();
let container  = document.querySelector(".container");
let isPanning = false;
let panStart = null;
let startCanvasX, startCanvasY;
let currentViewBox = {
  x: 0,
  y: 0,
  width: window.innerWidth,
  height: window.innerHeight
};


//for paint brush 
const strokeColors = document.querySelectorAll(".strokeColors span");
const strokeThicknesses = document.querySelectorAll(".strokeThickness span");

//for square 
let squareStrokecolor = "#fff";
let squareBackgroundColor = "#fff";
let squareFillStyleValue = "hachure";
let squareStrokeThicknes = 2;
let squareOutlineStyle = "solid";

let SquarecolorOptions = document.querySelectorAll(".squareStrokeSpan");
let backgroundColorOptionsSquare = document.querySelectorAll(".squareBackgroundSpan");
let fillStyleOptions = document.querySelectorAll(".squareFillStyleSpan");
let squareStrokeThicknessValue = document.querySelectorAll(".squareStrokeThickSpan");
let squareOutlineStyleValue = document.querySelectorAll(".squareOutlineStyle");

//for circle 
let isCircleToolActive = false;
let circleStartX, circleStartY;
let circleElement = null;

let circleStrokeColor = "#fff";
let circleFillColor = "#fff";
let circleFillStyle = "hachure";
let circleStrokeThickness = 2;
let circleOutlineStyle = "solid"; // Options: "solid", "dashed", "dotted"

let circleColorOptions = document.querySelectorAll(".circleStrokeSpan");
let circleFillColorOptions = document.querySelectorAll(".circleBackgroundSpan");
let circleFillStyleOptions = document.querySelectorAll(".circleFillStyleSpan");
let circleStrokeThicknessValue = document.querySelectorAll(".circleStrokeThickSpan");
let circleOutlineStyleValue = document.querySelectorAll(".circleOutlineStyle");


//for arrow 
let shapeEndpoints = []; // Store the endpoints of shapes for snapping
let highlightCircle = null; // Highlight indicator for snapping
let isArrowToolActive = false;
let arrowStartX, arrowStartY;
let arrowElementGroup = null;


let arrowStrokeColor = "#fff";
let arrowStrokeThickness = 2;
let arrowOutlineStyle = "solid"; 
let arrowCurved = false;         
let arrowCurveAmount = 20;       
let arrowHeadLength = 10;        
let arrowHeadAngleDeg = 30;      
let arrowPoints = [];   
let arrowHeadStyle = "default";


let arrowStrokeColorOptions = document.querySelectorAll(".arrowStrokeSpan");
let arrowStrokeThicknessValue = document.querySelectorAll(".arrowStrokeThickSpan");
let arrowOutlineStyleValue = document.querySelectorAll(".arrowOutlineStyle");
let arrowTypeStyleValue = document.querySelectorAll(".arrowTypeStyle");
let arrowHeadStyleValue = document.querySelectorAll(".arrowHeadStyleSpan");

//for the text tool 
let isTextToolActive = false;
let textElements = [];
let textSize = "30px";
let textFont = "lixFont";
let textColor = "#fff";
let textAlign = "left";

let textColorOptions  = document.querySelectorAll(".textColorSpan");
let textFontOptions = document.querySelectorAll(".textFontSpan");
let textSizeOptions = document.querySelectorAll(".textSizeSpan");
let textAlignOptions = document.querySelectorAll(".textAlignSpan");


//selection tool 




//for the laser tool
let isLaserToolActive = false;


//for line tool 

let isDrawingLine = false; // State variable to track if the line drawing is in progress
let lineStartX = 0;       // Starting X coordinate of the line
let lineStartY = 0;       // Starting Y coordinate of the line
let currentLine = null;    // Reference to the current line element being drawn
let isLineToolSelected = false;


//Eraser Tool

let isEraserToolActive  = false;


//for image tool
let isImageToolActive = false;


//utils controls 
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");
const paintBrushSideBar = document.getElementById("paintBrushSideBar");
const squareSideBar = document.getElementById("squareSideBar");
const circleSideBar = document.getElementById("circleSideBar");
const arrowSideBar = document.getElementById("arrowSideBar");
const textSideBar = document.getElementById("textSideBar");

// --- Rough.js Initialization ---
const roughCanvas = window.rough.svg(svg);
const roughGenerator = roughCanvas.generator;



//click event listener 

document.addEventListener("click", function(event) {
  const menuIcon = document.getElementById("menuIcon");
  const menu = document.querySelector(".menu");

  if (event.target === menuIcon) {
    menu.classList.toggle("hidden");
  } else {
    menu.classList.add("hidden");
  }
});


function toolExtraPopup() {
    if (selectedTool.classList.contains("bxs-paint")) {

        disableAllTools();
        svg.style.cursor = "crosshair"
        paintBrushSideBar.classList.remove("hidden");
        squareSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
    }
    else if (selectedTool.classList.contains("bx-square")) {

        disableAllTools();
        svg.style.cursor = "crosshair"
        isSquareToolActive = true;
        squareSideBar.classList.remove("hidden");
        paintBrushSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
    }
    else if(selectedTool.classList.contains("bx-circle"))
    {

        disableAllTools();
        svg.style.cursor = "crosshair"
        isCircleToolActive = true;
        squareSideBar.classList.add("hidden");
        paintBrushSideBar.classList.add("hidden");
        circleSideBar.classList.remove("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
        
    }
    else if(selectedTool.classList.contains("bx-right-arrow-alt"))
    {
        disableAllTools();
        isArrowToolActive = true;
        squareSideBar.classList.add("hidden");
        paintBrushSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.remove("hidden");
        textSideBar.classList.add("hidden");
    }
    else if(selectedTool.classList.contains("bxs-pointer"))
    {
        disableAllTools();
        isSelectionToolActive = true;
        svg.style.cursor = "all-scroll";
        squareSideBar.classList.add("hidden");
        paintBrushSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
    }
    else if(selectedTool.classList.contains("bxs-hand"))
    {
        disableAllTools();
        svg.style.cursor = "grab";
        squareSideBar.classList.add("hidden");
        paintBrushSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
    }
    else if(selectedTool.classList.contains("bx-text"))
    {
        disableAllTools();
      isTextToolActive = true;
      svg.style.cursor = "text";
      squareSideBar.classList.add("hidden");
      paintBrushSideBar.classList.add("hidden");
      circleSideBar.classList.add("hidden");
      arrowSideBar.classList.add("hidden");
      textSideBar.classList.remove("hidden");

    }
    else if(selectedTool.classList.contains("bxs-magic-wand"))
    {
        disableAllTools();
        svg.style.cursor = "crosshair";
        isLaserToolActive = true;
        paintBrushSideBar.classList.add("hidden");
        squareSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
    }
    else if(selectedTool.classList.contains("bx-dots-horizontal-rounded"))
    {
        disableAllTools();
        svg.style.cursor = "crosshair";
        isLineToolSelected = true;
        paintBrushSideBar.classList.add("hidden");
        squareSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
    }
    else if(selectedTool.classList.contains("bxs-eraser"))
    {
        disableAllTools();
        isEraserToolActive  = true;
        paintBrushSideBar.classList.add("hidden");
        squareSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
    }
    else if(selectedTool.classList.contains("bx-image-alt"))
    {
        disableAllTools();
        svg.style.cursor = "crosshair"
        isImageToolActive = true;
        paintBrushSideBar.classList.add("hidden");
        squareSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
    }
    else {
        disableAllTools();
        svg.style.cursor = "crosshair"
        paintBrushSideBar.classList.add("hidden");
        squareSideBar.classList.add("hidden");
        circleSideBar.classList.add("hidden");
        arrowSideBar.classList.add("hidden");
        textSideBar.classList.add("hidden");
    }
    

}

function disableAllTools() 
{
  isSquareToolActive = false;
  isCircleToolActive = false;
  isArrowToolActive = false;
  isTextToolActive = false;
  isLaserToolActive = false;
  isLineToolSelected = false;
  isEraserToolActive  = false;
  isSelectionToolActive = false;
  isImageToolActive = false;
}

document.addEventListener("keydown", function(event) {
  if (event.ctrlKey && event.key === 'z') {
    event.preventDefault();
    undo();
  }
});

document.addEventListener("keydown", function(event) {
  if (event.ctrlKey && event.key === 'y') {
    event.preventDefault();
    redo();
  }
});


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

tools.forEach(tool => tool.addEventListener("click", handleToolSelection));
function handleToolSelection(event) {
  tools.forEach(t => t.classList.remove("selected"));
  const tool = event.target;
  tool.classList.add("selected");
  selectedTool = tool;
  toolExtraPopup();
}


undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);



window.onload = () => {
  toolExtraPopup();
  updateUndoRedoButtons();
  resizeCanvas();

};

 



