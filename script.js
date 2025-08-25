class AnnotationTool {
    constructor() {
        this.canvas = document.getElementById('annotationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.backgroundImage = document.getElementById('backgroundImage');
        
        this.currentMode = 'section';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentRect = null;
        
        this.annotations = {
            sections: [],
            labels: [],
            inputs: []
        };
        
        this.selectedAnnotation = null;
        
        this.setupEventListeners();
        this.updateCanvas();
    }

    setupEventListeners() {
        // Image upload
        document.getElementById('imageInput').addEventListener('change', (e) => {
            this.loadImage(e.target.files[0]);
        });

        // Mode selection
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setMode(e.target.id.replace('Mode', ''));
            });
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', (e) => this.stopDrawing(e));

        // Export and clear buttons
        document.getElementById('exportBtn').addEventListener('click', () => this.exportJSON());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAll());
    }

    loadImage(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.backgroundImage.onload = () => {
                this.canvas.width = this.backgroundImage.naturalWidth;
                this.canvas.height = this.backgroundImage.naturalHeight;
                this.updateCanvas();
            };
            this.backgroundImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    setMode(mode) {
        this.currentMode = mode;
        
        // Update active button
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(mode + 'Mode').classList.add('active');
        
        // Update active panel
        document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(mode + 'Panel').classList.add('active');
        
        // Update cursor
        this.canvas.style.cursor = 'crosshair';
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    startDrawing(e) {
        const pos = this.getMousePos(e);
        this.isDrawing = true;
        this.startX = pos.x;
        this.startY = pos.y;
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getMousePos(e);
        this.updateCanvas();
        
        // Draw current rectangle
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        
        const width = pos.x - this.startX;
        const height = pos.y - this.startY;
        
        this.ctx.fillRect(this.startX, this.startY, width, height);
        this.ctx.strokeRect(this.startX, this.startY, width, height);
        this.ctx.setLineDash([]);
    }

    stopDrawing(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        const pos = this.getMousePos(e);
        const bbox = [
            [Math.min(this.startX, pos.x), Math.min(this.startY, pos.y)],
            [Math.max(this.startX, pos.x), Math.max(this.startY, pos.y)]
        ];
        
        // Ensure minimum size
        if (Math.abs(bbox[1][0] - bbox[0][0]) < 10 || Math.abs(bbox[1][1] - bbox[0][1]) < 10) {
            this.updateCanvas();
            return;
        }
        
        this.createAnnotation(bbox);
        this.updateCanvas();
        this.updateAnnotationsList();
        this.updateDropdowns();
    }

    createAnnotation(bbox) {
        switch (this.currentMode) {
            case 'section':
                const sectionName = document.getElementById('sectionName').value.trim();
                if (!sectionName) {
                    alert('Please enter a section name');
                    return;
                }
                this.annotations.sections.push({
                    id: this.generateId(),
                    name: sectionName,
                    boundingBox: bbox
                });
                document.getElementById('sectionName').value = '';
                break;
                
            case 'label':
                const parentSection = document.getElementById('parentSection').value;
                const labelText = document.getElementById('labelText').value.trim();
                if (!parentSection || !labelText) {
                    alert('Please select a parent section and enter label text');
                    return;
                }
                this.annotations.labels.push({
                    id: this.generateId(),
                    parentSectionId: parentSection,
                    text: labelText,
                    boundingBox: bbox
                });
                document.getElementById('labelText').value = '';
                break;
                
            case 'input':
                const parentLabel = document.getElementById('parentLabel').value;
                const inputName = document.getElementById('inputName').value.trim();
                const inputValue = document.getElementById('inputValue').value.trim();
                if (!parentLabel || !inputName) {
                    alert('Please select a parent label and enter input name');
                    return;
                }
                this.annotations.inputs.push({
                    id: this.generateId(),
                    parentLabelId: parentLabel,
                    name: inputName,
                    value: inputValue || null,
                    position: bbox
                });
                document.getElementById('inputName').value = '';
                document.getElementById('inputValue').value = '';
                break;
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    updateCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background image
        if (this.backgroundImage.src) {
            this.ctx.drawImage(this.backgroundImage, 0, 0);
        }
        
        // Draw annotations
        this.drawAnnotations();
    }

    drawAnnotations() {
        // Draw sections
        this.annotations.sections.forEach(section => {
            this.drawRect(section.boundingBox, 'section-box', section.id === this.selectedAnnotation);
        });
        
        // Draw labels
        this.annotations.labels.forEach(label => {
            this.drawRect(label.boundingBox, 'label-box', label.id === this.selectedAnnotation);
        });
        
        // Draw inputs
        this.annotations.inputs.forEach(input => {
            this.drawRect(input.position, 'input-box', input.id === this.selectedAnnotation);
        });
    }

    drawRect(bbox, className, isSelected) {
        const styles = {
            'section-box': { stroke: '#ff6b35', fill: 'rgba(255, 107, 53, 0.1)', width: 3 },
            'label-box': { stroke: '#4ecdc4', fill: 'rgba(78, 205, 196, 0.1)', width: 2 },
            'input-box': { stroke: '#45b7d1', fill: 'rgba(69, 183, 209, 0.1)', width: 2 }
        };
        
        const style = styles[className];
        this.ctx.strokeStyle = style.stroke;
        this.ctx.fillStyle = style.fill;
        this.ctx.lineWidth = isSelected ? style.width + 2 : style.width;
        this.ctx.setLineDash([]);
        
        const x = bbox[0][0];
        const y = bbox[0][1];
        const width = bbox[1][0] - bbox[0][0];
        const height = bbox[1][1] - bbox[0][1];
        
        this.ctx.fillRect(x, y, width, height);
        this.ctx.strokeRect(x, y, width, height);
    }

    updateAnnotationsList() {
        const container = document.getElementById('annotationsList');
        container.innerHTML = '';
        
        // Add sections
        this.annotations.sections.forEach(section => {
            const item = this.createAnnotationListItem('Section', section.name, section.boundingBox, section.id);
            container.appendChild(item);
        });
        
        // Add labels
        this.annotations.labels.forEach(label => {
            const section = this.annotations.sections.find(s => s.id === label.parentSectionId);
            const item = this.createAnnotationListItem('Label', `${label.text} (${section?.name || 'Unknown'})`, label.boundingBox, label.id);
            container.appendChild(item);
        });
        
        // Add inputs
        this.annotations.inputs.forEach(input => {
            const label = this.annotations.labels.find(l => l.id === input.parentLabelId);
            const item = this.createAnnotationListItem('Input', `${input.name} (${label?.text || 'Unknown'})`, input.position, input.id);
            container.appendChild(item);
        });
    }

    createAnnotationListItem(type, name, bbox, id) {
        const item = document.createElement('div');
        item.className = 'annotation-item';
        item.innerHTML = `
            <div class="type">${type}</div>
            <div class="name">${name}</div>
            <div class="coords">[${Math.round(bbox[0][0])}, ${Math.round(bbox[0][1])}] → [${Math.round(bbox[1][0])}, ${Math.round(bbox[1][1])}]</div>
            <button class="delete-btn" onclick="tool.deleteAnnotation('${id}')">×</button>
        `;
        
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            this.selectAnnotation(id);
        });
        
        return item;
    }

    selectAnnotation(id) {
        this.selectedAnnotation = this.selectedAnnotation === id ? null : id;
        
        // Update visual selection
        document.querySelectorAll('.annotation-item').forEach(item => item.classList.remove('selected'));
        if (this.selectedAnnotation) {
            event.target.closest('.annotation-item').classList.add('selected');
        }
        
        this.updateCanvas();
    }

    deleteAnnotation(id) {
        // Remove from all arrays
        this.annotations.sections = this.annotations.sections.filter(s => s.id !== id);
        this.annotations.labels = this.annotations.labels.filter(l => l.id !== id && l.parentSectionId !== id);
        this.annotations.inputs = this.annotations.inputs.filter(i => i.id !== id && this.annotations.labels.some(l => l.id === i.parentLabelId));
        
        if (this.selectedAnnotation === id) {
            this.selectedAnnotation = null;
        }
        
        this.updateCanvas();
        this.updateAnnotationsList();
        this.updateDropdowns();
    }

    updateDropdowns() {
        // Update parent section dropdown
        const sectionSelect = document.getElementById('parentSection');
        sectionSelect.innerHTML = '<option value="">Select parent section</option>';
        this.annotations.sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section.id;
            option.textContent = section.name;
            sectionSelect.appendChild(option);
        });
        
        // Update parent label dropdown
        const labelSelect = document.getElementById('parentLabel');
        labelSelect.innerHTML = '<option value="">Select parent label</option>';
        this.annotations.labels.forEach(label => {
            const option = document.createElement('option');
            option.value = label.id;
            option.textContent = label.text;
            labelSelect.appendChild(option);
        });
    }

    exportJSON() {
        const formType = document.getElementById('formType').value;
        const pageNumber = parseInt(document.getElementById('pageNumber').value) || 1;
        
        // Calculate overall bounding box
        const allBoxes = [
            ...this.annotations.sections.map(s => s.boundingBox),
            ...this.annotations.labels.map(l => l.boundingBox),
            ...this.annotations.inputs.map(i => i.position)
        ];
        
        let overallBbox = [[0, 0], [0, 0]];
        if (allBoxes.length > 0) {
            const minX = Math.min(...allBoxes.map(b => b[0][0]));
            const minY = Math.min(...allBoxes.map(b => b[0][1]));
            const maxX = Math.max(...allBoxes.map(b => b[1][0]));
            const maxY = Math.max(...allBoxes.map(b => b[1][1]));
            overallBbox = [[minX, minY], [maxX, maxY]];
        }
        
        // Build fields array
        const fields = [];
        
        this.annotations.sections.forEach(section => {
            const sectionLabels = this.annotations.labels.filter(l => l.parentSectionId === section.id);
            
            sectionLabels.forEach(label => {
                const labelInputs = this.annotations.inputs.filter(i => i.parentLabelId === label.id);
                
                const field = {
                    section: section.name,
                    label: label.text,
                    boundingBox: label.boundingBox,
                    inputs: labelInputs.map(input => ({
                        name: input.name,
                        position: input.position,
                        value: input.value
                    }))
                };
                
                fields.push(field);
            });
        });
        
        const output = {
            formType: formType,
            pageNumber: pageNumber,
            boundingBox: overallBbox,
            fields: fields
        };
        
        // Download JSON file
        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotation_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    clearAll() {
        if (confirm('Are you sure you want to clear all annotations?')) {
            this.annotations = { sections: [], labels: [], inputs: [] };
            this.selectedAnnotation = null;
            this.updateCanvas();
            this.updateAnnotationsList();
            this.updateDropdowns();
        }
    }
}

// Initialize the tool
const tool = new AnnotationTool();
