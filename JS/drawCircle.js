import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction } from './undoAndRedo.js';
let isDrawingCircle = false;
let isDraggingShapeCircle = false;
let isResizingShapeCircle = false;
let isRotatingShapeCircle = false;
let resizingAnchorIndexCirecle = null;

let startRotationMouseAngleCircle = null;
let startShapeRotationSquare = null;
const rc = rough.svg(svg);
let startX, startY;


let circleStrokecolor = "#fff";
let circleBackgroundColor = "transparent";
let circleFillStyleValue = "none";
let circleStrokeThicknes = 2;
let circleOutlineStyle = "solid";

let dragOldPosCircle = null;

let colorOptionsCircle = document.querySelectorAll(".circleStrokeSpan");
let backgroundColorOptionsCircle = document.querySelectorAll(".circleBackgroundSpan");
let fillStyleOptionsCircle = document.querySelectorAll(".circleFillStyleSpan");
let strokeThicknessValueCircle = document.querySelectorAll(".circleStrokeThickSpan");
let outlineStyleValueCircle = document.querySelectorAll(".circleOutlineStyle");

class Circle {
    constructor(x, y, radius, options = {}) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.options = {
            roughness: 1.5,
            stroke: circleStrokecolor,
            strokeWidth: circleStrokeThicknes,
            fill: circleBackgroundColor,
            fillStyle: circleFillStyleValue,
            strokeDasharray: circleOutlineStyle === "dashed" ? "5,5" : (circleOutlineStyle === "dotted" ? "2,8" : ""),
            ...options
        };
        this.element = null;
        this.isSelected = false;
        this.rotation = 0;
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.anchors = [];
        this.rotationAnchor = null;
        this.selectionPadding = 8;
        this.selectionOutline = null;
        this.shapeName = "circle";
        if(!this.group.parentNode) {
            svg.appendChild(this.group);
        }
        this._lastDrawn = {
            width: null,
            height: null,
            options: null
        };
        this.draw();
    }
    draw() {
        const childrenToRemove = [];
        for (let i = 0; i < this.group.children.length; i++) {
            const child = this.group.children[i];
            if (child !== this.element) { 
                 childrenToRemove.push(child);
            }
        }
    }
}