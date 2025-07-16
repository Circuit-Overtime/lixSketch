import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction } from './undoAndRedo.js';
let isDrawingCircle = false;
let isDraggingShapeCircle = false;
let isResizingShapeCircle = false;
let isRotatingShapeCircle = false;
let resizingAnchorIndexCirecle = null;
