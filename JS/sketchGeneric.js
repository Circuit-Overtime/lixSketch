

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

//helper function for arrowsnap 

function getSnapPoint(x, y) {
    const snapThreshold = 10; // If within 10px, snap to endpoint
    for (let pt of shapeEndpoints) {
      const dx = pt.x - x;
      const dy = pt.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= snapThreshold) {
        return { x: pt.x, y: pt.y };
      }
    }
    return { x, y };
  }


  function getNearbyEndpoint(x, y) {
    for (let pt of shapeEndpoints) {
      const dx = pt.x - x;
      const dy = pt.y - y;
      if (Math.hypot(dx, dy) <= snapThreshold) {
        return pt;
      }
    }
    return null;
  }

  function showHighlight(x, y) {
    if (!highlightCircle) {
      highlightCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      highlightCircle.setAttribute("r", 6);
      highlightCircle.setAttribute("fill", "rgba(255,0,0,0.3)"); // semi-transparent red
      svg.appendChild(highlightCircle);
    }
    highlightCircle.setAttribute("cx", x);
    highlightCircle.setAttribute("cy", y);
  }
  
  // --- Helper: Remove the Highlight Indicator ---
  function removeHighlight() {
    if (highlightCircle) {
      svg.removeChild(highlightCircle);
      highlightCircle = null;
    }
  }


  function getSmoothPath(points) {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y} `;
  
    // If only two points, just draw a line.
    if (points.length === 2) {
      d += `L ${points[1].x} ${points[1].y}`;
      return d;
    }
  
    // Convert the Catmull-Rom spline to cubic Bezier segments.
    for (let i = 0; i < points.length - 1; i++) {
      // Define p0, p1, p2, p3 with boundary conditions.
      let p0 = i === 0 ? points[i] : points[i - 1];
      let p1 = points[i];
      let p2 = points[i + 1];
      let p3 = i + 2 < points.length ? points[i + 2] : p2;
  
      // Catmull-Rom to Cubic Bezier conversion matrix:
      let cp1x = p1.x + (p2.x - p0.x) / 12;
      let cp1y = p1.y + (p2.y - p0.y) / 12;
      let cp2x = p2.x - (p3.x - p1.x) / 12;
      let cp2y = p2.y - (p3.y - p1.y) / 12;
  
      d += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y} `;
    }
    return d;
  }
  

  function createArrowHead(tipX, tipY, angle) {
    const rc = rough.svg(svg);
    const arrowHeadAngle = arrowHeadAngleDeg * Math.PI / 180;
    let points;
    
    if (arrowHeadStyle === "default") {
      // Default V-shaped arrowhead.
      points = [
        [tipX, tipY],
        [tipX - arrowHeadLength * Math.cos(angle - arrowHeadAngle), tipY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)],
        [tipX - arrowHeadLength * Math.cos(angle + arrowHeadAngle), tipY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)]
      ];
    } 
    
    else if (arrowHeadStyle === "square") {
      // Create a square arrow head (proper square end) that is filled.
      // We'll treat arrowHeadLength as the side-length of the square.
      const L = arrowHeadLength;
      // v: unit vector along the arrow's direction.
      const v = { x: Math.cos(angle), y: Math.sin(angle) };
      // w: unit vector perpendicular to the arrow's direction.
      const w = { x: -Math.sin(angle), y: Math.cos(angle) };
    
      // Define the square so that its left side is flush with the arrow tip.
      // The arrow tip (tipX, tipY) will be the midpoint of the left side.
      // Left side endpoints:
      const A = [ tipX + (L/2) * w.x, tipY + (L/2) * w.y ]; // top-left
      const B = [ tipX - (L/2) * w.x, tipY - (L/2) * w.y ]; // bottom-left
      // Right side endpoints:
      const D = [ tipX + L * v.x + (L/2) * w.x, tipY + L * v.y + (L/2) * w.y ]; // top-right
      const C = [ tipX + L * v.x - (L/2) * w.x, tipY + L * v.y - (L/2) * w.y ]; // bottom-right
      
      // Build the points array in order.
      const points = [ A, B, C, D ];
    
      // Create a filled polygon using Rough.js with a solid fill.
      const rc = rough.svg(svg);
      const arrowHeadElement = rc.polygon(points, {
          fill: arrowStrokeColor,
          stroke: arrowStrokeColor,
          fillStyle: 'solid', // Ensures a solid fill.
          strokeWidth: arrowStrokeThickness,
      });
      
      // Optionally, apply dash styles if needed.
      if (arrowOutlineStyle === "dashed") {
        arrowHeadElement.setAttribute("stroke-dasharray", "10,10");
      } else if (arrowOutlineStyle === "dotted") {
        arrowHeadElement.setAttribute("stroke-dasharray", "2,8");
      }
      
      return arrowHeadElement;
    }
    
    
    
    else if (arrowHeadStyle === "solid") {
      // Create a circular filled arrow head.
      // Here, we treat arrowHeadLength as the radius of the circle.
      const rc = rough.svg(svg);
      // rough.js circle takes the diameter as the size parameter.
      const diameter = arrowHeadLength * 1;
      const arrowHeadElement = rc.circle(tipX, tipY, diameter, {
        fill: arrowStrokeColor,
        stroke: arrowStrokeColor,
        fillStyle: 'solid',
        strokeWidth: 0.8,

      });
      
      return arrowHeadElement;
    }

    
    
    else if (arrowHeadStyle === "outline") {
      // Create a circular filled arrow head.
      // Here, we treat arrowHeadLength as the radius of the circle.
      const rc = rough.svg(svg);
      // rough.js circle takes the diameter as the size parameter.
      const diameter = arrowHeadLength * 1.2;
      const arrowHeadElement = rc.circle(tipX, tipY, diameter, {
        fill: arrowStrokeColor,
        stroke: arrowStrokeColor,
        fillStyle: 'none',
        strokeWidth: 0.2,

      });
      
      return arrowHeadElement;
    }
    
    const arrowHeadElement = rc.polygon(points, {
      fill: arrowStrokeColor,
      stroke: arrowStrokeColor,
      strokeWidth: arrowStrokeThickness,
    });
    
    if (arrowOutlineStyle === "dashed") {
      arrowHeadElement.setAttribute("stroke-dasharray", "10,10");
    } else if (arrowOutlineStyle === "dotted") {
      arrowHeadElement.setAttribute("stroke-dasharray", "2,8");
    }
    
    return arrowHeadElement;
  }

// ===============================================================================================================
//for selection tool 
let isSelectionToolActive = false;



undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);