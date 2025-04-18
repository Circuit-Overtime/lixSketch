class SelectionManager {
    constructor(svgElement, shapesArray) {
        this.svg = svgElement;
        this.shapes = shapesArray;
        this.currentShape = null;
        this.isResizing = false;
        this.isRotating = false;
        this.isDragging = false;
        this.activeAnchor = null;
        this.startX = 0;
        this.startY = 0;
        this.rotationStartAngle = 0;
    }

    handleMouseDown(e) {
        if (!isSelectionToolActive) return; // Only process if selection tool is active

        if (e.target.classList.contains('rotate-anchor')) {
            this.isRotating = true;
            this.currentShape = this.shapes.find(shape => shape.rotationAnchor === e.target);
            if (this.currentShape) {
                const rectCenterX = this.currentShape.x + this.currentShape.width / 2;
                const rectCenterY = this.currentShape.y + this.currentShape.height / 2;
                this.rotationStartAngle = Math.atan2(e.offsetY - rectCenterY, e.offsetX - rectCenterX) * 180 / Math.PI - this.currentShape.rotation;
            }
            return;
        }

        const clickedAnchor = e.target.closest('.anchor');
        if (clickedAnchor) {
            this.startX = e.offsetX;
            this.startY = e.offsetY;
            this.isResizing = true;
            this.activeAnchor = parseInt(clickedAnchor.dataset.index);
            this.currentShape = this.shapes.find(shape => shape.anchors.includes(clickedAnchor));
            return;
        }

        const clickedShape = this.shapes.find(shape => shape.contains(e.offsetX, e.offsetY));
        this.shapes.forEach(shape => shape.isSelected = false);

        if (clickedShape) {
            clickedShape.isSelected = true;
            this.currentShape = clickedShape;
            this.isDragging = true;
            this.startX = e.offsetX;
            this.startY = e.offsetY;
        } else {
            this.currentShape = null;
        }
        this.shapes.forEach(shape => shape.draw());
    }

    handleMouseMove(e) {
        if (this.isResizing && this.currentShape) {
            this.currentShape.updatePosition(this.activeAnchor, e.offsetX, e.offsetY);
        } else if (this.isRotating && this.currentShape) {
            const rectCenterX = this.currentShape.x + this.currentShape.width / 2;
            const rectCenterY = this.currentShape.y + this.currentShape.height / 2;
            const currentAngle = Math.atan2(e.offsetY - rectCenterY, e.offsetX - rectCenterX) * 180 / Math.PI;
            this.currentShape.rotate(currentAngle - this.rotationStartAngle);
        } else if (this.isDragging && this.currentShape) {
            const dx = e.offsetX - this.startX;
            const dy = e.offsetY - this.startY;
            this.currentShape.move(dx, dy);
            this.startX = e.offsetX;
            this.startY = e.offsetY;
        }
    }

    handleMouseUp(e) {
        this.isResizing = false;
        this.isRotating = false;
        this.isDragging = false;
        this.activeAnchor = null;
    }

    // Method to set shapes array from outside if needed later
    setShapes(shapesArray) {
        this.shapes = shapesArray;
    }
}

export { SelectionManager };