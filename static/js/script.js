document.addEventListener("DOMContentLoaded", function () {
  // Initialize with default size from frame size selector
  let canvasWidth = 800;
  let canvasHeight = 600;

  // Add page refresh/leave alert
  window.addEventListener("beforeunload", function (e) {
    e.preventDefault();
    // Chrome requires returnValue to be set
    e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
    // Message shown to user (modern browsers use their own standard message)
    return "You have unsaved changes. Are you sure you want to leave?";
  });

  // Initialize canvas with proper interactive settings
  let canvas = new fabric.Canvas("editor-canvas", {
    width: canvasWidth,
    height: canvasHeight,
    selection: true,
    preserveObjectStacking: true,
    allowTouchScrolling: false,
    interactive: true,
    moveCursor: "move",
    hoverCursor: "move",
    defaultCursor: "default",
    freeDrawingCursor: "crosshair",
    targetFindTolerance: 5,
    perPixelTargetFind: true,
  });

  // Global state variables
  let currentTextColor = "#000000";
  let currentDrawColor = "#000000";
  let currentShadowColor = "#000000";
  let currentBorderColor = "#000000";
  let currentZoom = 1;
  let isDrawing = false;
  let cropRect = null;
  let croppingImage = null;

  // History management
  const history = {
    states: [],
    currentStateIndex: -1,
    maxStates: 30,
    saveState() {
      const json = JSON.stringify(canvas.toJSON());
      if (this.currentStateIndex < this.states.length - 1) {
        this.states = this.states.slice(0, this.currentStateIndex + 1);
      }
      this.states.push(json);
      this.currentStateIndex = this.states.length - 1;
      if (this.states.length > this.maxStates) {
        this.states.shift();
        this.currentStateIndex--;
      }
      this.updateButtons();
    },
    undo() {
      if (this.currentStateIndex > 0) {
        this.currentStateIndex--;
        this.loadState(this.currentStateIndex);
        this.updateButtons();
      }
    },
    redo() {
      if (this.currentStateIndex < this.states.length - 1) {
        this.currentStateIndex++;
        this.loadState(this.currentStateIndex);
        this.updateButtons();
      }
    },
    loadState(index) {
      if (index >= 0 && index < this.states.length) {
        canvas.loadFromJSON(this.states[index], () => {
          // Re-enable interaction for all objects after loading
          canvas.forEachObject(function (obj) {
            obj.set({
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
            });
          });
          canvas.renderAll();
          setupCanvasEventHandlers();
          updateLayersList();
        });
      }
    },
    updateButtons() {
      document
        .getElementById("btn-undo")
        .classList.toggle("disabled", this.currentStateIndex <= 0);
      document
        .getElementById("btn-redo")
        .classList.toggle(
          "disabled",
          this.currentStateIndex >= this.states.length - 1
        );
    },
    init() {
      this.saveState();
      this.updateButtons();
    },
  };

  // Layer management
  const layerManager = {
    layers: [],

    // Generate layer data from canvas objects
    generateLayers() {
      this.layers = [];
      const objects = canvas.getObjects();

      objects.forEach((obj, index) => {
        const layer = {
          id: obj.id || `layer_${Date.now()}_${index}`,
          name: this.getLayerName(obj),
          type: obj.type,
          visible: obj.visible !== false,
          locked: obj.selectable === false,
          object: obj,
          index: index,
        };

        // Set ID if not exists
        if (!obj.id) {
          obj.id = layer.id;
        }

        this.layers.push(layer);
      });

      // Reverse to show top layers first
      this.layers.reverse();
    },

    // Get appropriate name for layer based on object type
    getLayerName(obj) {
      switch (obj.type) {
        case "textbox":
        case "text":
          return obj.text
            ? `Text: ${obj.text.substring(0, 15)}${
                obj.text.length > 15 ? "..." : ""
              }`
            : "Text Layer";
        case "image":
          return "Image Layer";
        case "rect":
          return "Rectangle";
        case "circle":
          return "Circle";
        case "triangle":
          return "Triangle";
        case "line":
          return "Line";
        case "polygon":
          return "Polygon";
        case "path":
          return "Drawing";
        case "group":
          return "Group";
        default:
          return `${obj.type} Layer`;
      }
    },

    // Get icon for layer type
    getLayerIcon(type) {
      const icons = {
        textbox: "T",
        text: "T",
        image:
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6 17h12l-3.75-5l-3 4L9 13zm-3 4V3h18v18zm2-2h14V5H5zm0 0V5z"/></svg>',
        rect: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M2 20V4h20v16zm2-2h16V6H4zm0 0V6z"/></svg>',
        circle:
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"/></svg>',
        triangle: "🔺",
        line: "📏",
        polygon: "⬟",
        path: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M4 24q-.825 0-1.412-.587T2 22t.588-1.412T4 20h16q.825 0 1.413.588T22 22t-.587 1.413T20 24zm2-8h1.4l7.8-7.775l-.725-.725l-.7-.7L6 14.6zm-2 1v-2.825q0-.2.075-.387t.225-.338L15.2 2.575q.275-.275.638-.425T16.6 2t.775.15t.675.45L19.425 4q.3.275.437.65t.138.775q0 .375-.138.738t-.437.662L8.55 17.7q-.15.15-.337.225T7.825 18H5q-.425 0-.712-.288T4 17M18 5.4L16.6 4zm-2.8 2.825l-.725-.725l-.7-.7z"/></svg>',
        group:
          "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path fill='currentColor' d='M8 18q-.825 0-1.412-.587T6 16V4q0-.825.588-1.412T8 2h12q.825 0 1.413.588T22 4v12q0 .825-.587 1.413T20 18zm0-2h12V8h-7V4H8zm-4 6q-.825 0-1.412-.587T2 20V6h2v14h14v2zM8 4v12z'/></svg>",
      };
      return icons[type] || "◯";
    },

    // Render layers in sidebar
    renderLayers() {
      this.generateLayers();
      const container = document.getElementById("layers-list");

      container.innerHTML = "";

      this.layers.forEach((layer, visualIndex) => {
        const layerElement = this.createLayerElement(layer, visualIndex);
        container.appendChild(layerElement);
      });
    },

    // Create individual layer element
    createLayerElement(layer, visualIndex) {
      const div = document.createElement("div");
      div.className = `layer-item ${
        layer.object === canvas.getActiveObject() ? "active" : ""
      }`;
      div.draggable = true;
      div.dataset.layerId = layer.id;
      div.dataset.index = visualIndex;

      div.innerHTML = `
      <div class="layer-content">
        <span class="drag-handle">⋮⋮</span>
        <span class="layer-icon">${this.getLayerIcon(layer.type)}</span>
        <span class="layer-name">${layer.name}</span>
      </div>
      <div class="layer-controls">
        <button class="layer-visibility ${
          layer.visible ? "" : "hidden"
        }" title="Toggle Visibility">
          ${
            layer.visible
              ? "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path fill='currentColor' d='M1 23v-5h2v3h3v2zm17 0v-2h3v-3h2v5zm-6-4.5q-3 0-5.437-1.775T3 12q1.125-2.95 3.563-4.725T12 5.5t5.438 1.775T21 12q-1.125 2.95-3.562 4.725T12 18.5m0-2q2.2 0 4.025-1.2t2.8-3.3q-.975-2.1-2.8-3.3T12 7.5T7.975 8.7t-2.8 3.3q.975 2.1 2.8 3.3T12 16.5m0-1q1.45 0 2.475-1.025T15.5 12t-1.025-2.475T12 8.5T9.525 9.525T8.5 12t1.025 2.475T12 15.5m0-2q-.625 0-1.063-.437T10.5 12t.438-1.062T12 10.5t1.063.438T13.5 12t-.437 1.063T12 13.5M1 6V1h5v2H3v3zm20 0V3h-3V1h5v5zm-9 6'/></svg>"
              : "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path fill='#ff0707' d='M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q1.35 0 2.6-.437t2.3-1.263L5.7 7.1q-.825 1.05-1.263 2.3T4 12q0 3.35 2.325 5.675T12 20m6.3-3.1q.825-1.05 1.263-2.3T20 12q0-3.35-2.325-5.675T12 4q-1.35 0-2.6.437T7.1 5.7z'/></svg>"
          }
        </button>
        <button class="layer-lock ${
          layer.locked ? "locked" : ""
        }" title="Toggle Lock">
          ${
            layer.locked
              ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6 22q-.825 0-1.412-.587T4 20V10q0-.825.588-1.412T6 8h1V6q0-2.075 1.463-3.537T12 1t3.538 1.463T17 6v2h1q.825 0 1.413.588T20 10v10q0 .825-.587 1.413T18 22zm0-2h12V10H6zm6-3q.825 0 1.413-.587T14 15t-.587-1.412T12 13t-1.412.588T10 15t.588 1.413T12 17M9 8h6V6q0-1.25-.875-2.125T12 3t-2.125.875T9 6zM6 20V10z"/></svg>'
              : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6 22q-.825 0-1.412-.587T4 20V10q0-.825.588-1.412T6 8h9V6q0-1.25-.875-2.125T12 3q-1.05 0-1.838.638T9.1 5.225q-.1.35-.413.563T8 6q-.425 0-.712-.275t-.213-.65q.35-1.725 1.725-2.9T12 1q2.075 0 3.538 1.462T17 6v2h1q.825 0 1.413.588T20 10v10q0 .825-.587 1.413T18 22zm0-2h12V10H6zm6-3q.825 0 1.413-.587T14 15t-.587-1.412T12 13t-1.412.588T10 15t.588 1.413T12 17m-6 3V10z"/></svg>'
          }
        </button>
        <button class="remove-layer" title="Delete Layer"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6q-.425 0-.712-.288T4 5t.288-.712T5 4h4q0-.425.288-.712T10 3h4q.425 0 .713.288T15 4h4q.425 0 .713.288T20 5t-.288.713T19 6v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zm-7 11q.425 0 .713-.288T11 16V9q0-.425-.288-.712T10 8t-.712.288T9 9v7q0 .425.288.713T10 17m4 0q.425 0 .713-.288T14 16V9q0-.425-.288-.712T13 8t-.712.288T12 9v7q0 .425.288.713T13 17M7 6v13z"/></svg></button>
      </div>
    `;

      this.attachLayerEventListeners(div, layer);
      return div;
    },

    // Attach event listeners to layer element
    attachLayerEventListeners(element, layer) {
      // Click to select layer
      element.addEventListener("click", (e) => {
        if (!e.target.closest(".layer-controls")) {
          canvas.setActiveObject(layer.object);
          canvas.requestRenderAll();
          this.renderLayers();
        }
      });

      // Visibility toggle
      const visibilityBtn = element.querySelector(".layer-visibility");
      visibilityBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        layer.object.set("visible", !layer.object.visible);
        layer.visible = layer.object.visible;
        canvas.requestRenderAll();
        this.renderLayers();
      });

      // Lock toggle
      const lockBtn = element.querySelector(".layer-lock");
      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isLocked = !layer.object.selectable;
        layer.object.set({
          selectable: isLocked,
          evented: isLocked,
          hasControls: isLocked,
          hasBorders: isLocked,
        });
        layer.locked = !isLocked;
        canvas.requestRenderAll();
        this.renderLayers();
      });

      // Delete layer
      const deleteBtn = element.querySelector(".remove-layer");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Delete this layer?")) {
          canvas.remove(layer.object);
          canvas.requestRenderAll();
          this.renderLayers();
          history.saveState();
        }
      });

      // Drag and drop functionality
      this.attachDragListeners(element, layer);
    },

    // Attach drag and drop listeners
    attachDragListeners(element, layer) {
      element.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", layer.id);
        e.dataTransfer.effectAllowed = "move";
        element.classList.add("dragging");

        // Create a custom drag image
        const dragImage = element.cloneNode(true);
        dragImage.style.transform = "rotate(5deg)";
        dragImage.style.opacity = "0.8";
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
      });

      element.addEventListener("dragend", () => {
        element.classList.remove("dragging");
        this.clearDropIndicators();
      });

      element.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        const rect = element.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isTop = e.clientY < midpoint;

        this.clearDropIndicators();

        if (isTop) {
          element.style.borderTop = "2px solid #4285f4";
        } else {
          element.style.borderBottom = "2px solid #4285f4";
        }
      });

      element.addEventListener("dragleave", () => {
        element.style.borderTop = "";
        element.style.borderBottom = "";
      });

      element.addEventListener("drop", (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("text/plain");
        const targetIndex = parseInt(element.dataset.index);

        const rect = element.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isTop = e.clientY < midpoint;

        this.reorderLayer(draggedId, targetIndex, isTop);
        this.clearDropIndicators();
      });
    },

    // Clear all drop indicators
    clearDropIndicators() {
      document.querySelectorAll(".layer-item").forEach((item) => {
        item.style.borderTop = "";
        item.style.borderBottom = "";
      });
    },

    // Reorder layers
    reorderLayer(draggedId, targetIndex, insertBefore) {
      const draggedLayer = this.layers.find((l) => l.id === draggedId);
      if (!draggedLayer) return;

      const currentIndex = this.layers.indexOf(draggedLayer);
      let newIndex = insertBefore ? targetIndex : targetIndex + 1;

      // Adjust for the removal of the dragged item
      if (currentIndex < newIndex) {
        newIndex--;
      }

      // Remove from current position
      this.layers.splice(currentIndex, 1);

      // Insert at new position
      this.layers.splice(newIndex, 0, draggedLayer);

      // Update canvas object order (reverse because layers are shown reversed)
      const objects = this.layers
        .slice()
        .reverse()
        .map((l) => l.object);

      // Clear and re-add objects in new order
      canvas.clear();
      objects.forEach((obj) => canvas.add(obj));

      // Restore active selection if any
      if (draggedLayer.object === canvas.getActiveObject()) {
        canvas.setActiveObject(draggedLayer.object);
      }

      canvas.requestRenderAll();
      this.renderLayers();
      history.saveState();
    },
  };

  // Color palette functionality
  function showColorPalette(buttonElement, callback) {
    const palette = document.getElementById("color-palette");
    const rect = buttonElement.getBoundingClientRect();

    // Position palette near the button
    palette.style.position = "fixed";
    palette.style.left = rect.left - 100 + "px";
    palette.style.top = rect.top + 50 + "px";
    palette.style.display = "block";
    palette.style.zIndex = "1000";

    // Remove any existing event listeners
    palette.onclick = null;

    // Add color selection handler
    palette.onclick = function (e) {
      if (e.target.classList.contains("color-btn")) {
        const color = e.target.dataset.color;
        callback(color);
        hideColorPalette();
      }
    };

    // Custom color input handler
    const customColorInput = document.getElementById("custom-color-input");
    customColorInput.onchange = function () {
      callback(this.value);
      hideColorPalette();
    };

    // Close palette when clicking outside
    setTimeout(() => {
      document.addEventListener("click", closeColorPaletteOutside);
    }, 100);
  }

  function hideColorPalette() {
    document.getElementById("color-palette").style.display = "none";
    document.removeEventListener("click", closeColorPaletteOutside);
  }

  function closeColorPaletteOutside(e) {
    const palette = document.getElementById("color-palette");
    if (!palette.contains(e.target) && !e.target.closest(".tool-button")) {
      hideColorPalette();
    }
  }

  // Call centerCanvas after canvas size changes
  function resizeCanvas(width, height) {
    canvasWidth = width;
    canvasHeight = height;

    // Dispose old canvas
    canvas.dispose();

    // Create new canvas
    canvas = new fabric.Canvas("editor-canvas", {
      width: canvasWidth,
      height: canvasHeight,
      selection: true,
      preserveObjectStacking: true,
      allowTouchScrolling: false,
      interactive: true,
      moveCursor: "move",
      hoverCursor: "move",
      defaultCursor: "default",
      freeDrawingCursor: "crosshair",
      targetFindTolerance: 5,
      perPixelTargetFind: true,
    });

    canvas.setBackgroundColor("#ffffff", canvas.renderAll.bind(canvas));
    // Reattach all event handlers
    setupCanvasEventHandlers();
    updateButtonStates();
  }

  // Update layers list in sidebar
  function updateLayersList() {
    layerManager.renderLayers();
  }

  // Update button states based on selection/mode
  function updateButtonStates() {
    // Update tool button states based on current mode
    document
      .getElementById("btn-selection")
      .classList.toggle("active", !canvas.isDrawingMode);
    document
      .getElementById("btn-draw")
      .classList.toggle("active", canvas.isDrawingMode);

    // Update text formatting buttons based on selection
    const obj = canvas.getActiveObject();
    if (obj && obj.type && obj.type.includes("text")) {
      document
        .getElementById("btn-bold")
        .classList.toggle("active", obj.fontWeight === "bold");
      document
        .getElementById("btn-italic")
        .classList.toggle("active", obj.fontStyle === "italic");
      document
        .getElementById("btn-underline")
        .classList.toggle("active", obj.underline);
    } else {
      // Reset text formatting buttons when no text is selected
      document.getElementById("btn-bold").classList.remove("active");
      document.getElementById("btn-italic").classList.remove("active");
      document.getElementById("btn-underline").classList.remove("active");
    }
  }

  function updateControlsFromSelection() {
    const obj = canvas.getActiveObject();
    if (!obj) return;

    // Update text controls if text is selected
    if (obj.type && obj.type.includes("text")) {
      document.getElementById("font-size").value = obj.fontSize || 30;
      document.getElementById("font-select").value =
        obj.fontFamily || "Arial, sans-serif";

      // Update text formatting buttons
      document
        .getElementById("btn-bold")
        .classList.toggle("active", obj.fontWeight === "bold");
      document
        .getElementById("btn-italic")
        .classList.toggle("active", obj.fontStyle === "italic");
      document
        .getElementById("btn-underline")
        .classList.toggle("active", obj.underline);
    }

    // Update general controls for all objects
    if (obj.stroke) {
      document.getElementById("border-width").value = obj.strokeWidth || 0;
    }

    if (obj.shadow) {
      document.getElementById("shadow-blur").value = obj.shadow.blur || 0;
    }
  }

  function clearControlsSelection() {
    // Reset all controls to default state
    document.getElementById("font-size").value = 30;
    document.getElementById("font-select").value = "Arial, sans-serif";
    document.getElementById("border-width").value = 0;
    document.getElementById("shadow-blur").value = 0;

    // Reset formatting buttons
    document.getElementById("btn-bold").classList.remove("active");
    document.getElementById("btn-italic").classList.remove("active");
    document.getElementById("btn-underline").classList.remove("active");
  }

  // CANVAS EVENT HANDLERS
  // --------------------

  function setupCanvasEventHandlers() {
    // Clear any existing handlers
    canvas.off();

    // Selection events
    canvas.on("selection:created", function (e) {
      console.log("Object selected:", e.target);
      updateControlsFromSelection();
      updateLayersList();
    });

    canvas.on("selection:updated", function (e) {
      console.log("Selection updated:", e.target);
      updateControlsFromSelection();
      updateLayersList();
    });

    canvas.on("selection:cleared", function () {
      console.log("Selection cleared");
      clearControlsSelection();
      updateLayersList();
    });

    // Object events
    canvas.on("object:added", function (e) {
      const obj = e.target;
      if (obj && !obj._isLoadingFromJSON) {
        // Ensure object is interactive
        obj.set({
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockMovementX: false,
          lockMovementY: false,
          lockRotation: false,
          lockScalingX: false,
          lockScalingY: false,
        });
        console.log("Object added:", obj.type);
        history.saveState();
      }
      updateLayersList();
    });

    canvas.on("object:removed", function () {
      updateLayersList();
      history.saveState();
    });

    canvas.on("object:modified", function () {
      updateLayersList();
      history.saveState();
    });

    // Mouse events for debugging
    canvas.on("mouse:down", function (options) {
      console.log("Mouse down on canvas");
      if (options.target) {
        console.log("Clicked on object:", options.target.type);
      }
    });

    // Double-click to edit text
    canvas.on("mouse:dblclick", function (options) {
      if (
        options.target &&
        (options.target.type === "textbox" || options.target.type === "text")
      ) {
        const textObj = options.target;
        canvas.setActiveObject(textObj);
        if (textObj.enterEditing) {
          textObj.enterEditing();
          textObj.selectAll();
        }
        console.log("Entering text edit mode");
      }
    });

    // Text editing events
    canvas.on("text:editing:entered", function () {
      console.log("Text editing started");
    });

    canvas.on("text:editing:exited", function () {
      console.log("Text editing ended");
      canvas.requestRenderAll();
      history.saveState();
    });
  }

  // SETUP FUNCTIONS
  // --------------

  // EVENT HANDLERS
  // -------------

  // History buttons
  document.getElementById("btn-undo").onclick = () => history.undo();
  document.getElementById("btn-redo").onclick = () => history.redo();

  // Selection tool
  document.getElementById("btn-selection").onclick = () => {
    console.log("Selection tool activated");
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = "default";

    // Ensure all objects are selectable
    canvas.forEachObject(function (obj) {
      obj.set({
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
      });
    });

    canvas.requestRenderAll();
    updateButtonStates();
  };

  // Add editable text
  document.getElementById("btn-addtext").onclick = () => {
    console.log("Adding text");

    // Make sure we're in selection mode
    canvas.isDrawingMode = false;
    canvas.selection = true;

    const text = new fabric.Textbox("Edit me", {
      left: 100,
      top: 100,
      fontSize: parseInt(document.getElementById("font-size").value) || 30,
      fill: currentTextColor,
      fontFamily:
        document.getElementById("font-select").value || "Arial, sans-serif",
      editable: true,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lineHeight: 1.2,
      charSpacing: 0,
      width: 200,
      splitByGrapheme: false,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();

    // Enter editing mode after a short delay
    setTimeout(() => {
      if (text.enterEditing) {
        text.enterEditing();
        text.selectAll();
      }
    }, 100);

    console.log("Text added and selected");
  };

  // Upload image functionality
  document.getElementById("upload-image-btn").onclick = () => {
    console.log("Upload image clicked");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (f) {
        fabric.Image.fromURL(
          f.target.result,
          (img) => {
            console.log("Image loaded");

            // Make sure we're in selection mode
            canvas.isDrawingMode = false;
            canvas.selection = true;

            // Scale image to fit canvas if needed
            if (img.width > canvas.width * 0.8) {
              const scale = (canvas.width * 0.8) / img.width;
              img.scale(scale);
            }

            img.set({
              left: canvas.width / 2 - (img.width * img.scaleX) / 2,
              top: canvas.height / 2 - (img.height * img.scaleY) / 2,
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
            });

            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.requestRenderAll();

            // After canvas.requestRenderAll();
            history.saveState();
            console.log("Image added to canvas");
          },
          { crossOrigin: "anonymous" }
        );
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Frame size selector
  document.getElementById("frame-size-select").onchange = function () {
    const value = this.value;
    if (value) {
      // Alert user before resizing if there are objects on the canvas
      if (canvas.getObjects().length > 0) {
        const confirmResize = confirm(
          "Changing the frame size will clear the canvas and reset your work. Are you sure you want to continue?"
        );
        if (!confirmResize) {
          // Revert the select to the previous value
          this.value = `${canvas.width},${canvas.height}`;
          return;
        }
      }
      const [width, height] = value.split(",").map(Number);
      resizeCanvas(width, height);
    }
  };

  // Free drawing mode
  document.getElementById("btn-draw").onclick = () => {
    isDrawing = !isDrawing;
    console.log("Drawing mode:", isDrawing);

    canvas.isDrawingMode = isDrawing;

    if (isDrawing) {
      canvas.selection = false;
      canvas.defaultCursor = "crosshair";
      canvas.freeDrawingBrush.width = 3;
      canvas.freeDrawingBrush.color = currentDrawColor;

      // Disable object interaction in drawing mode
      canvas.forEachObject(function (obj) {
        obj.set({
          selectable: false,
          evented: false,
        });
      });
    } else {
      canvas.selection = true;
      canvas.defaultCursor = "default";

      // Re-enable object interaction
      canvas.forEachObject(function (obj) {
        obj.set({
          selectable: true,
          evented: true,
        });
      });
    }

    canvas.requestRenderAll();
    updateButtonStates();
  };

  // Font and text controls
  document.getElementById("font-size").onchange = (e) => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      obj.set("fontSize", parseInt(e.target.value));
      canvas.requestRenderAll();
      console.log("Font size changed to:", e.target.value);
    }
  };

  document.getElementById("font-select").onchange = (e) => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      obj.set("fontFamily", e.target.value);
      canvas.requestRenderAll();
      console.log("Font family changed to:", e.target.value);
    }
  };

  // Color buttons with palette functionality
  document.getElementById("btn-text-color").onclick = function () {
    showColorPalette(this, function (color) {
      currentTextColor = color;
      const obj = canvas.getActiveObject();
      if (obj?.set && obj.type.includes("text")) {
        obj.set("fill", color);
        canvas.requestRenderAll();
      }
      console.log("Text color changed to:", color);
    });
  };

  document.getElementById("btn-draw-color").onclick = function () {
    showColorPalette(this, function (color) {
      currentDrawColor = color;
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush.color = color;
      }
      console.log("Draw color changed to:", color);
    });
  };

  document.getElementById("btn-shadow-color").onclick = function () {
    showColorPalette(this, function (color) {
      currentShadowColor = color;
      const obj = canvas.getActiveObject();
      if (obj?.set) {
        obj.set(
          "shadow",
          new fabric.Shadow({
            color: color,
            blur: parseInt(document.getElementById("shadow-blur").value) || 3,
            offsetX: 3,
            offsetY: 3,
          })
        );
        canvas.requestRenderAll();
      }
      console.log("Shadow color changed to:", color);
    });
  };

  document.getElementById("btn-border-color").onclick = function () {
    showColorPalette(this, function (color) {
      currentBorderColor = color;
      const obj = canvas.getActiveObject();
      if (obj?.set) {
        obj.set("stroke", color);
        canvas.requestRenderAll();
      }
      console.log("Border color changed to:", color);
    });
  };

  // Background fill button
  document.getElementById("btn-background-fill").onclick = function () {
    showColorPalette(this, function (color) {
      const obj = canvas.getActiveObject();
      if (obj) {
        // For shapes and images, set fill; for text, set backgroundColor
        if (obj.type === "textbox" || obj.type === "text") {
          obj.set("backgroundColor", color);
        } else if (obj.type === "image") {
          alert("Background fill for images is not supported directly.");
        } else {
          obj.set("fill", color);
        }
        canvas.requestRenderAll();
        console.log("Object background filled:", color);
      } else {
        // No object selected: set canvas background
        canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
        console.log("Canvas background filled:", color);
      }
    });
  };

  // Text formatting buttons
  document.getElementById("btn-bold").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      const newWeight = obj.fontWeight === "bold" ? "normal" : "bold";
      obj.set("fontWeight", newWeight);
      canvas.requestRenderAll();
      document
        .getElementById("btn-bold")
        .classList.toggle("active", newWeight === "bold");
      console.log("Bold toggled to:", newWeight);
    }
  };

  document.getElementById("btn-italic").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      const newStyle = obj.fontStyle === "italic" ? "normal" : "italic";
      obj.set("fontStyle", newStyle);
      canvas.requestRenderAll();
      document
        .getElementById("btn-italic")
        .classList.toggle("active", newStyle === "italic");
      console.log("Italic toggled to:", newStyle);
    }
  };

  document.getElementById("btn-underline").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      obj.set("underline", !obj.underline);
      canvas.requestRenderAll();
      document
        .getElementById("btn-underline")
        .classList.toggle("active", obj.underline);
      console.log("Underline toggled");
    }
  };

  // Superscript and subscript
  document.getElementById("btn-superscript").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && (obj.type === "textbox" || obj.type === "text")) {
      if (
        obj.selectionStart !== undefined &&
        obj.selectionEnd !== undefined &&
        obj.selectionStart !== obj.selectionEnd
      ) {
        const start = obj.selectionStart;
        const end = obj.selectionEnd;
        // Check if all selected chars are already superscript
        let allSuper = true;
        for (let i = start; i < end; i++) {
          const style = obj.getSelectionStyles(i, i + 1)[0] || {};
          if (
            style.fontSize !== obj.fontSize * 0.7 ||
            style.deltaY !== -obj.fontSize * 0.3
          ) {
            allSuper = false;
            break;
          }
        }
        for (let i = start; i < end; i++) {
          obj.setSelectionStyles(
            allSuper
              ? { fontSize: null, deltaY: null } // Remove superscript
              : { fontSize: obj.fontSize * 0.7, deltaY: -obj.fontSize * 0.3 }, // Apply superscript
            i,
            i + 1
          );
        }
        obj.dirty = true;
        canvas.requestRenderAll();
        console.log(
          allSuper
            ? "Superscript removed from selection"
            : "Superscript applied to selection"
        );
      }
    }
  };

  document.getElementById("btn-subscript").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && (obj.type === "textbox" || obj.type === "text")) {
      if (
        obj.selectionStart !== undefined &&
        obj.selectionEnd !== undefined &&
        obj.selectionStart !== obj.selectionEnd
      ) {
        const start = obj.selectionStart;
        const end = obj.selectionEnd;
        // Check if all selected chars are already subscript
        let allSub = true;
        for (let i = start; i < end; i++) {
          const style = obj.getSelectionStyles(i, i + 1)[0] || {};
          if (
            style.fontSize !== obj.fontSize * 0.7 ||
            style.deltaY !== obj.fontSize * 0.2
          ) {
            allSub = false;
            break;
          }
        }
        for (let i = start; i < end; i++) {
          obj.setSelectionStyles(
            allSub
              ? { fontSize: null, deltaY: null } // Remove subscript
              : { fontSize: obj.fontSize * 0.7, deltaY: obj.fontSize * 0.2 }, // Apply subscript
            i,
            i + 1
          );
        }
        obj.dirty = true;
        canvas.requestRenderAll();
        console.log(
          allSub
            ? "Subscript removed from selection"
            : "Subscript applied to selection"
        );
      }
    }
  };

  // Alignment buttons
  document.getElementById("btn-align-left").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      obj.set("textAlign", "left");
      canvas.requestRenderAll();
      console.log("Text aligned left");
    }
  };

  document.getElementById("btn-align-center").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      obj.set("textAlign", "center");
      canvas.requestRenderAll();
      console.log("Text aligned center");
    }
  };

  document.getElementById("btn-align-right").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      obj.set("textAlign", "right");
      canvas.requestRenderAll();
      console.log("Text aligned right");
    }
  };

  // Line spacing
  document.getElementById("btn-linespacing").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      const currentSpacing = obj.lineHeight || 1.2;
      const newSpacing =
        currentSpacing === 1.2 ? 1.5 : currentSpacing === 1.5 ? 2.0 : 1.2;
      obj.set("lineHeight", newSpacing);
      canvas.requestRenderAll();
      console.log("Line spacing changed to:", newSpacing);
    }
  };

  // Character spacing
  document.getElementById("btn-character-spacing").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj?.set && obj.type.includes("text")) {
      const currentSpacing = obj.charSpacing || 0;
      const newSpacing =
        currentSpacing === 0 ? 50 : currentSpacing === 50 ? 100 : 0;
      obj.set("charSpacing", newSpacing);
      canvas.requestRenderAll();
      console.log("Character spacing changed to:", newSpacing);
    }
  };

  // Shadow controls
  document.getElementById("shadow-blur").onchange = function () {
    const obj = canvas.getActiveObject();
    if (obj?.set && this.value !== "") {
      const blurValue = parseInt(this.value) || 0;
      if (blurValue === 0) {
        obj.set("shadow", null);
      } else {
        obj.set(
          "shadow",
          new fabric.Shadow({
            color: currentShadowColor,
            blur: blurValue,
            offsetX: 3,
            offsetY: 3,
          })
        );
      }
      canvas.requestRenderAll();
      console.log("Shadow blur changed to:", blurValue);
    }
  };

  // Border controls
  document.getElementById("border-width").onchange = function () {
    const obj = canvas.getActiveObject();
    if (obj?.set) {
      const width = parseInt(this.value) || 0;
      obj.set("strokeWidth", width);
      if (width === 0) {
        obj.set("stroke", "");
      } else if (!obj.stroke) {
        obj.set("stroke", currentBorderColor);
      }
      canvas.requestRenderAll();
      console.log("Border width changed to:", width);
    }
  };

  document.getElementById("stroke-style").onchange = function () {
    const obj = canvas.getActiveObject();
    if (obj?.set && this.value !== "Stroke") {
      switch (this.value) {
        case "Solid":
          obj.set("strokeDashArray", null);
          break;
        case "Dashed":
          obj.set("strokeDashArray", [10, 5]);
          break;
        case "Dotted":
          obj.set("strokeDashArray", [2, 2]);
          break;
      }
      canvas.requestRenderAll();
      console.log("Stroke style changed to:", this.value);
    }
  };

  // Crop tool
  document.getElementById("btn-crop-tool").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj && obj.type === "image") {
      // Remove any previous crop rect
      if (cropRect) {
        canvas.remove(cropRect);
        cropRect = null;
      }
      croppingImage = obj;

      // Create a crop rectangle on top of the image
      cropRect = new fabric.Rect({
        left: obj.left + 20,
        top: obj.top + 20,
        width: obj.width * obj.scaleX * 0.6,
        height: obj.height * obj.scaleY * 0.6,
        fill: "rgba(0,0,0,0.1)",
        stroke: "#ff0000",
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: true,
        evented: true,
        hasBorders: true,
        hasControls: true,
        lockRotation: true,
        objectCaching: false,
      });
      canvas.add(cropRect);
      canvas.setActiveObject(cropRect);
      canvas.requestRenderAll();

      // Listen for Enter key to confirm crop
      function cropHandler(e) {
        if (e.key === "Enter" && cropRect && croppingImage) {
          // Calculate crop area relative to image
          const rect = cropRect;
          const img = croppingImage;

          // Get absolute crop rectangle coordinates
          const cropLeft = (rect.left - img.left) / img.scaleX;
          const cropTop = (rect.top - img.top) / img.scaleY;
          const cropWidth = (rect.width * rect.scaleX) / img.scaleX;
          const cropHeight = (rect.height * rect.scaleY) / img.scaleY;

          // Create a temp canvas to draw the cropped image
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = cropWidth;
          tempCanvas.height = cropHeight;
          const ctx = tempCanvas.getContext("2d");

          ctx.drawImage(
            img._element,
            cropLeft,
            cropTop,
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
          );

          // Create a new Fabric image from the cropped canvas
          fabric.Image.fromURL(tempCanvas.toDataURL(), (croppedImg) => {
            croppedImg.set({
              left: img.left + cropLeft,
              top: img.top + cropTop,
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
            });
            // Remove old image and crop rect
            canvas.remove(img);
            canvas.remove(rect);
            cropRect = null;
            croppingImage = null;
            canvas.add(croppedImg);
            canvas.setActiveObject(croppedImg);
            canvas.requestRenderAll();
          });
          // Remove event listener after crop
          document.removeEventListener("keydown", cropHandler);
        }
        // ESC to cancel crop
        if (e.key === "Escape" && cropRect) {
          canvas.remove(cropRect);
          cropRect = null;
          croppingImage = null;
          canvas.requestRenderAll();
          document.removeEventListener("keydown", cropHandler);
        }
      }
      document.addEventListener("keydown", cropHandler);

      // alert(
      //   "Resize/move the red rectangle, then press Enter to crop or Esc to cancel."
      // );
    } else {
      alert("Please select an image to crop");
    }
  };

  // Zoom controls
  document.getElementById("btn-zoom-in").onclick = () => {
    currentZoom = Math.min(currentZoom * 1.2, 5);
    canvas.setZoom(currentZoom);
    canvas.requestRenderAll();
    document.getElementById("btn-zoom-reset").innerHTML = `<span>${Math.round(
      currentZoom * 100
    )}%</span>`;
    console.log("Zoomed in to:", Math.round(currentZoom * 100) + "%");
  };

  document.getElementById("btn-zoom-out").onclick = () => {
    currentZoom = Math.max(currentZoom / 1.2, 0.1);
    canvas.setZoom(currentZoom);
    canvas.requestRenderAll();
    document.getElementById("btn-zoom-reset").innerHTML = `<span>${Math.round(
      currentZoom * 100
    )}%</span>`;
    console.log("Zoomed out to:", Math.round(currentZoom * 100) + "%");
  };

  document.getElementById("btn-zoom-reset").onclick = () => {
    currentZoom = 1;
    canvas.setZoom(1);
    canvas.requestRenderAll();
    document.getElementById("btn-zoom-reset").innerHTML = `<span>100%</span>`;
    console.log("Zoom reset to 100%");
  };

  // Rotate
  document.getElementById("btn-rotate").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj) {
      const currentAngle = obj.angle || 0;
      obj.set("angle", currentAngle + 90);
      canvas.requestRenderAll();
      console.log("Object rotated");
    }
  };

  // Group functionality
  document.getElementById("group-options").onchange = function () {
    const value = this.value;
    if (value === "Group Selected") {
      const activeObject = canvas.getActiveObject();
      if (activeObject && activeObject.type === "activeSelection") {
        // Convert active selection to group (works for images, shapes, text, etc.)
        activeObject.toGroup();
        canvas.requestRenderAll();
        history.saveState();
        console.log("Objects grouped");
      }
    } else if (value === "Ungroup") {
      const obj = canvas.getActiveObject();
      if (obj && obj.type === "group") {
        obj.toActiveSelection();
        canvas.requestRenderAll();
        history.saveState();
        console.log("Group ungrouped");
      }
    }
    this.value = "Group"; // Reset dropdown
  };

  // Delete object
  document.getElementById("btn-delete").onclick = () => {
    const obj = canvas.getActiveObject();
    if (obj) {
      if (obj.type === "activeSelection") {
        obj.getObjects().forEach((o) => canvas.remove(o));
        canvas.discardActiveObject();
      } else {
        canvas.remove(obj);
      }
      canvas.requestRenderAll();
      console.log("Object deleted");
    }
  };

  // EMOJI AND SHAPE FUNCTIONALITY
  // ----------------------------

  // Toggle dropdown visibility
  document.getElementById("emoji-dropdown-btn").onclick = function (e) {
    e.stopPropagation();
    console.log("Emoji button clicked");
    const dropdown = document.querySelector(
      "#emoji-dropdown .dropdown-content-emoji"
    );
    const shapeDropdown = document.querySelector(
      "#shape-dropdown .dropdown-content-shape"
    );

    // Close shape dropdown if open
    if (shapeDropdown) {
      shapeDropdown.classList.remove("visible");
    }

    // Toggle emoji dropdown
    if (dropdown) {
      if (dropdown.classList.contains("visible")) {
        dropdown.classList.remove("visible");
      } else {
        const rect = this.getBoundingClientRect();
        // dropdown.style.left = (rect.left + 300) + "px";
        // dropdown.style.top = (rect.bottom + 5) + "px";
        dropdown.classList.add("visible");
        console.log("Showing emoji dropdown");
      }
    }
  };

  document.getElementById("shape-dropdown-btn").onclick = function (e) {
    e.stopPropagation();
    console.log("Shape button clicked");
    const dropdown = document.querySelector(
      "#shape-dropdown .dropdown-content-shape"
    );
    const emojiDropdown = document.querySelector(
      "#emoji-dropdown .dropdown-content-emoji"
    );

    // Close emoji dropdown if open
    if (emojiDropdown) {
      emojiDropdown.classList.remove("visible");
    }

    // Toggle shape dropdown
    if (dropdown) {
      if (dropdown.classList.contains("visible")) {
        dropdown.classList.remove("visible");
      } else {
        const rect = this.getBoundingClientRect();
        // dropdown.style.left = rect.left + "px";
        // dropdown.style.top = (rect.bottom + 5) + "px";
        dropdown.classList.add("visible");
        console.log("Showing shape dropdown");
      }
    }
  };

  // Update document click handler too
  document.addEventListener("click", function (e) {
    if (
      !e.target.closest("#emoji-dropdown") &&
      !e.target.closest("#shape-dropdown")
    ) {
      document
        .querySelector("#emoji-dropdown .dropdown-content-emoji")
        ?.classList.remove("visible");
      document
        .querySelector("#shape-dropdown .dropdown-content-shape")
        ?.classList.remove("visible");
    }
  });

  // Add emoji to canvas
  const emojiButtons = document.querySelectorAll(".emoji-btn");
  emojiButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const emoji = this.textContent;

      // Make sure we're in selection mode
      canvas.isDrawingMode = false;
      canvas.selection = true;

      const text = new fabric.Text(emoji, {
        left: canvas.width / 2,
        top: canvas.height / 2,
        fontSize: 50,
        originX: "center",
        originY: "center",
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
      });

      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.requestRenderAll();

      // CHANGE THIS LINE - use classList instead of style
      document
        .querySelector("#emoji-dropdown .dropdown-content-emoji")
        .classList.remove("visible");

      // Save state for undo/redo
      history.saveState();
      console.log("Emoji added:", emoji);
    });
  });

  // Create and add shapes to canvas
  const shapeButtons = document.querySelectorAll(".shape-btn");
  shapeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const shape = this.getAttribute("data-shape");
      let obj = null;

      switch (shape) {
        case "rect":
          obj = new fabric.Rect({
            width: 80,
            height: 60,
            fill: "rgba(0,0,0,0)",
            stroke: "#222",
            strokeWidth: 2,
            left: 200,
            top: 200,
          });
          break;
        case "diamond":
          obj = new fabric.Polygon(
            [
              { x: 40, y: 0 },
              { x: 80, y: 40 },
              { x: 40, y: 80 },
              { x: 0, y: 40 },
            ],
            {
              fill: "rgba(0,0,0,0)",
              stroke: "#222",
              strokeWidth: 2,
              left: 200,
              top: 200,
            }
          );
          break;
        case "small-square":
          obj = new fabric.Rect({
            width: 40,
            height: 40,
            fill: "rgba(0,0,0,0)",
            stroke: "#222",
            strokeWidth: 2,
            left: 200,
            top: 200,
          });
          break;
        case "big-square":
          obj = new fabric.Rect({
            width: 100,
            height: 60,
            fill: "rgba(0,0,0,0)",
            stroke: "#222",
            strokeWidth: 2,
            left: 200,
            top: 200,
          });
          break;
        case "circle":
          obj = new fabric.Circle({
            radius: 35,
            fill: "rgba(0,0,0,0)",
            stroke: "#222",
            strokeWidth: 2,
            left: 200,
            top: 200,
          });
          break;
        case "triangle":
          obj = new fabric.Triangle({
            width: 70,
            height: 70,
            fill: "rgba(0,0,0,0)",
            stroke: "#222",
            strokeWidth: 2,
            left: 200,
            top: 200,
          });
          break;
        case "line":
          obj = new fabric.Line([0, 0, 100, 0], {
            stroke: "#222",
            strokeWidth: 4,
            left: 200,
            top: 200,
          });
          break;
        case "polygon":
          obj = new fabric.Polygon(
            [
              { x: 50, y: 0 },
              { x: 100, y: 30 },
              { x: 82, y: 90 },
              { x: 18, y: 90 },
              { x: 0, y: 30 },
            ],
            {
              fill: "rgba(0,0,0,0)",
              stroke: "#222",
              strokeWidth: 2,
              left: 200,
              top: 200,
            }
          );
          break;
        case "hollow-star":
          obj = new fabric.Text("☆", {
            fontSize: 60,
            left: 200,
            top: 200,
            fill: "#222",
            fontFamily: "Arial",
          });
          break;
        case "hollow-heart":
          obj = new fabric.Text("♡", {
            fontSize: 60,
            left: 200,
            top: 200,
            fill: "#d22",
            fontFamily: "Arial",
          });
          break;
        case "hollow-arrow":
          obj = new fabric.Text("⇨", {
            fontSize: 60,
            left: 200,
            top: 200,
            fill: "#222",
            fontFamily: "Arial",
          });
          break;
        case "arrow":
          obj = new fabric.Text("→", {
            fontSize: 60,
            left: 200,
            top: 200,
            fill: "#222",
            fontFamily: "Arial",
          });
          break;
        case "hollow-circle-small":
          obj = new fabric.Text("◌", {
            fontSize: 60,
            left: 200,
            top: 200,
            fill: "#222",
            fontFamily: "Arial",
          });
          break;
        case "hollow-cross":
          obj = new fabric.Text("✝", {
            fontSize: 60,
            left: 200,
            top: 200,
            fill: "#222",
            fontFamily: "Arial",
          });
          break;
        case "hollow-check":
          obj = new fabric.Text("☐", {
            fontSize: 60,
            left: 200,
            top: 200,
            fill: "#222",
            fontFamily: "Arial",
          });
          break;
        default:
          return;
      }

      if (obj) {
        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        history.saveState();
      }
    });
  });

  // INITIALIZATION
  // -------------

  // Initialize the editor
  function initEditor() {
    console.log("Initializing editor");

    // Set initial canvas background
    canvas.setBackgroundColor("#ffffff", canvas.renderAll.bind(canvas));

    // Setup canvas event handlers
    setupCanvasEventHandlers();

    // Setup AI Image Generator
    setupAIImageGenerator();

    // Setup tab switching
    setupTabSwitching();

    // Initialize history
    history.init();

    // Initialize button states
    updateButtonStates();

    // Initialize layers
    updateLayersList();

    console.log("Editor initialization complete");
  }

  // Call the initialization function
  initEditor();

  // Download logic for export
  document.getElementById("btn-download").onclick = function () {
    const format = document.getElementById("export-format").value;
    let title = document.querySelector(".title-input").value.trim();
    if (!title) title = "xenzee-image";
    let fileName = `${title}.${format}`;

    if (format === "png" || format === "jpg" || format === "jpeg") {
      // For PNG/JPG/JPEG
      let mime = format === "png" ? "image/png" : "image/jpeg";
      let dataURL = canvas.toDataURL({
        format: format === "png" ? "png" : "jpeg",
        quality: 1,
      });
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === "svg") {
      // For SVG
      const svg = canvas.toSVG();
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (format === "pdf") {
      // For PDF
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "l" : "p",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      const imgData = canvas.toDataURL({ format: "png", quality: 1 });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(fileName);
    }
  };

  // Keyboard shortcuts for undo/redo
  document.addEventListener("keydown", function (e) {
    if (
      (e.ctrlKey || e.metaKey) &&
      !e.shiftKey &&
      e.key.toLowerCase() === "z"
    ) {
      e.preventDefault();
      history.undo();
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key.toLowerCase() === "y" ||
        (e.shiftKey && e.key.toLowerCase() === "z"))
    ) {
      e.preventDefault();
      history.redo();
    }
  });

  // AI Image Generator functionality
  function setupAIImageGenerator() {
    // Show modal when clicking the image generator button
    document.getElementById("image-generator-btn").onclick = function () {
      document.getElementById("ai-image-modal").style.display = "flex";
      document.getElementById("ai-image-results").innerHTML = "";

      // Make sure AI Image tab is active
      const tabButtons = document.querySelectorAll(".tab-button");
      tabButtons.forEach((button) => {
        button.classList.remove("active");
        if (button.dataset.tab === "ai-images") {
          button.classList.add("active");
        }
      });

      const tabContents = document.querySelectorAll(".tab-content");
      tabContents.forEach((content) => {
        content.classList.remove("active");
        content.style.display = "none";
      });

      document.getElementById("ai-images-content").style.display = "block";
      document.getElementById("ai-images-content").classList.add("active");
    };

    // Hide modal when clicking cancel
    document.getElementById("ai-cancel-btn").onclick = function () {
      document.getElementById("ai-image-modal").style.display = "none";
      document.getElementById("ai-image-loading").style.display = "none";
      document.getElementById("ai-image-results").innerHTML = "";
    };

    // Generate images and show in side panel
    document.getElementById("ai-generate-btn").onclick = async function () {
      const keywords = document
        .getElementById("ai-keywords")
        .value.split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const size = document.getElementById("ai-size").value;
      const num_images =
        parseInt(document.getElementById("ai-num-images").value) || 1;

      if (num_images > 2) {
        alert("Can only generate up to 4 images at a time.");
        return;
      }
      if (!keywords.length) {
        alert("Please enter at least one keyword.");
        return;
      }

      document.getElementById("ai-image-loading").style.display = "block";
      document.getElementById("ai-image-results").innerHTML = "";

      try {
        const res = await fetch("v1/generate_images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords, size, num_images }),
        });

        const data = await res.json();
        document.getElementById("ai-image-loading").style.display = "none";

        // Display images in the AI Images tab
        const sideList = document.getElementById("ai-image-sidepanel-list");
        sideList.innerHTML = "";

        if (data.images && data.images.length) {
          data.images.forEach((url) => {
            const imgContainer = document.createElement("div");
            imgContainer.className = "ai-image-item";
            imgContainer.style.position = "relative"; // Add position relative for absolute positioning of the download icon

            const img = document.createElement("img");
            img.src = url;
            img.style.cursor = "pointer";
            img.title = "Click to add to canvas";
            img.onclick = function () {
              // Create a proxied URL
              const proxiedUrl = `proxy-image?url=${encodeURIComponent(url)}`;

              fabric.Image.fromURL(
                proxiedUrl,
                function (fabImg) {
                  // Scale the image to fit in canvas while maintaining aspect ratio
                  const canvasWidth = canvas.width;
                  const canvasHeight = canvas.height;

                  // Calculate scaling to maintain aspect ratio
                  const scaleFactor =
                    Math.min(
                      canvasWidth / fabImg.width,
                      canvasHeight / fabImg.height
                    ) * 0.9; // 90% of canvas size

                  // Position in center
                  fabImg.set({
                    left: (canvasWidth - fabImg.width * scaleFactor) / 2,
                    top: (canvasHeight - fabImg.height * scaleFactor) / 2,
                    originX: "left",
                    originY: "top",
                    scaleX: scaleFactor,
                    scaleY: scaleFactor,
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                    lockUniScaling: false,
                  });

                  // Make sure the canvas is in selection mode
                  canvas.isDrawingMode = false;

                  // Add the image to canvas
                  canvas.add(fabImg);

                  // Force selection of the new image
                  canvas.setActiveObject(fabImg);
                  canvas.requestRenderAll();

                  // Log success for debugging
                  console.log("Image added successfully:", fabImg);

                  // Save state in history
                  history.saveState();
                },
                { crossOrigin: "anonymous" }
              );
            };

            // Create download button
            const downloadBtn = document.createElement("div");
            downloadBtn.className = "ai-image-download-btn";
            downloadBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 15.575q-.2 0-.375-.062T11.3 15.3l-3.6-3.6q-.3-.3-.288-.7t.288-.7q.3-.3.713-.312t.712.287L11 12.15V5q0-.425.288-.712T12 4t.713.288T13 5v7.15l1.875-1.875q.3-.3.713-.288t.712.313q.275.3.288.7t-.288.7l-3.6 3.6q-.15.15-.325.213t-.375.062M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20z"/></svg>
            `;
            downloadBtn.title = "Download image";
            downloadBtn.onclick = function (e) {
              e.stopPropagation(); // Prevent the image click event from firing

              // Use the proxied URL like you do when adding to canvas
              const proxiedUrl = `proxy-image?url=${encodeURIComponent(url)}`;

              // Fetch the image from the proxy and convert to blob for download
              fetch(proxiedUrl)
                .then((response) => response.blob())
                .then((blob) => {
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = blobUrl;
                  a.download = "ai-generated-image.png";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  // Clean up by revoking the blob URL
                  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                })
                .catch((err) => {
                  console.error("Error downloading image:", err);
                  alert("Failed to download image. Please try again.");
                });
            };

            imgContainer.appendChild(img);
            imgContainer.appendChild(downloadBtn);
            sideList.appendChild(imgContainer);
          });
        } else {
          sideList.innerHTML =
            "<div style='padding: 20px; text-align: center;'>No images generated.</div>";
        }

        // Hide modal after generation
        document.getElementById("ai-image-modal").style.display = "none";
      } catch (err) {
        console.error("Error generating images:", err);
        document.getElementById("ai-image-loading").style.display = "none";
        document.getElementById("ai-image-results").innerHTML =
          "<div style='color:red; text-align: center;'>Error generating images.</div>";
      }
    };

    // Place this near the end of DOMContentLoaded or inside setupAIImageGenerator()

    // 1. Define your art styles array
    const ART_STYLES = [
      "realistic",
      "photorealistic",
      "digital painting",
      "oil painting",
      "watercolor",
      "pencil sketch",
      "charcoal drawing",
      "ink drawing",
      "line art",
      "vector art",
      "cartoon",
      "comic book style",
      "anime",
      "manga",
      "pixel art",
      "3D render",
      "low poly",
      "isometric",
      "cyberpunk",
      "steampunk",
      "vaporwave",
      "synthwave",
      "noir",
      "surrealism",
      "abstract",
      "cubism",
      "pop art",
      "minimalist",
      "flat design",
      "concept art",
      "futurism",
      "baroque",
      "renaissance",
      "gothic",
      "expressionism",
      "impressionism",
      "modernism",
      "art nouveau",
      "street art",
      "graffiti",
      "collage",
      "paper cut",
      "chalk art",
      "mixed media",
      "claymation",
      "stop motion",
      "sculpture",
      "motion graphics",
      "silhouette",
      "fantasy style",
      "sci-fi style",
      "storybook illustration",
      "children’s book style",
    ];

    // 2. Shuffle helper
    function shuffleArray(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    // 3. Render 8 random styles
    function renderArtStyles() {
      const container = document.getElementById("ai-style-suggestions");
      container.innerHTML = "";
      // Shuffle and pick 8
      const shuffled = shuffleArray(ART_STYLES);
      const stylesToShow = shuffled.slice(0, 8);
      stylesToShow.forEach((style) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ai-style-btn";
        btn.dataset.style = style;
        btn.textContent = style;
        btn.onclick = function () {
          const input = document.getElementById("ai-keywords");
          let current = input.value.trim();
          if (!current.toLowerCase().includes(style.toLowerCase())) {
            if (current && !current.endsWith(",")) current += ", ";
            input.value = current + style;
            input.focus();
          }
        };
        container.appendChild(btn);
      });
    }

    // 4. Refresh button handler
    document.getElementById("ai-style-refresh-btn").onclick = renderArtStyles;

    // 5. Initial render on modal open
    const origShowModal = document.getElementById(
      "image-generator-btn"
    ).onclick;
    document.getElementById("image-generator-btn").onclick = function () {
      if (typeof origShowModal === "function") origShowModal();
      renderArtStyles();
      // ...rest of your modal open logic...
    };

    // If modal can be opened other ways, also call renderArtStyles() there.
  }

  // Add tab switching functionality
  function setupTabSwitching() {
    const tabButtons = document.querySelectorAll(".tab-button");

    tabButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const tabId = this.dataset.tab;

        // Update active tab button
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        this.classList.add("active");

        // Show relevant content
        const tabContents = document.querySelectorAll(".tab-content");
        tabContents.forEach((content) => {
          content.classList.remove("active");
          content.style.display = "none";
        });

        const activeContent = document.getElementById(`${tabId}-content`);
        if (activeContent) {
          activeContent.style.display = "block";
          activeContent.classList.add("active");
        }
      });
    });
  }

  // Add this after DOMContentLoaded
  // document.querySelectorAll('.ai-style-btn').forEach(btn => {
  //   btn.addEventListener('click', function () {
  //     const style = this.dataset.style;
  //     const input = document.getElementById('ai-keywords');
  //     let current = input.value.trim();
  //     // Avoid duplicate styles
  //     if (!current.toLowerCase().includes(style.toLowerCase())) {
  //       if (current && !current.endsWith(',')) current += ', ';
  //       input.value = current + style;
  //       input.focus();
  //     }
  //   });
  // });
});
