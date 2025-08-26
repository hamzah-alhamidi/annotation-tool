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
        this.editingAnnotation = null;
        
        this.setupEventListeners();
        this.updateCanvas();
    }

    setupEventListeners() {
        // Image upload
        document.getElementById('imageInput').addEventListener('change', (e) => {
            this.loadImage(e.target.files[0]);
        });

        // JSON import
        document.getElementById('jsonInput').addEventListener('change', (e) => {
            this.importJSON(e.target.files[0]);
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

        // Edit buttons
        document.getElementById('editSectionBtn').addEventListener('click', () => this.updateAnnotation());
        document.getElementById('editLabelBtn').addEventListener('click', () => this.updateAnnotation());
        document.getElementById('editInputBtn').addEventListener('click', () => this.updateAnnotation());
        document.getElementById('cancelEditBtn').addEventListener('click', () => this.clearEditMode());
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

    importJSON(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                this.loadFromJSON(jsonData);
            } catch (error) {
                alert('Error reading JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    loadFromJSON(jsonData) {
        // Clear existing annotations
        this.annotations = { sections: [], labels: [], inputs: [] };
        
        // Set form properties
        document.getElementById('formType').value = jsonData.formType || '';
        document.getElementById('pageNumber').value = jsonData.pageNumber || 1;
        
        // Process fields and recreate the hierarchical structure
        if (jsonData.fields) {
            const sectionMap = new Map();
            const labelMap = new Map();
            
            jsonData.fields.forEach(field => {
                // Create or find section
                let section = Array.from(sectionMap.values()).find(s => s.name === field.section);
                if (!section) {
                    // Use section coordinates if available, otherwise default
                    const sectionBoundingBox = field.sectionBoundingBox || [[0, 0], [100, 100]];
                    
                    section = {
                        id: this.generateId(),
                        name: field.section,
                        boundingBox: sectionBoundingBox
                    };
                    this.annotations.sections.push(section);
                    sectionMap.set(section.name, section);
                }
                
                // Create label
                const label = {
                    id: this.generateId(),
                    parentSectionId: section.id,
                    text: field.label,
                    boundingBox: field.boundingBox
                };
                this.annotations.labels.push(label);
                labelMap.set(field.label, label);
                
                // Create inputs
                if (field.inputs) {
                    field.inputs.forEach(input => {
                        const inputAnnotation = {
                            id: this.generateId(),
                            parentLabelId: label.id,
                            name: input.name,
                            type: input.type || 'text',
                            lang: input.lang || null, // Add language support
                            value: input.value,
                            position: input.position
                        };
                        this.annotations.inputs.push(inputAnnotation);
                    });
                }
            });
        }
        
        this.updateCanvas();
        this.updateAnnotationsList();
        this.updateDropdowns();
        this.clearEditMode();
    }

    setMode(mode) {
        // Don't clear edit mode if we're switching to edit a different type
        const wasEditing = this.editingAnnotation;
        
        this.currentMode = mode;
        
        // Only clear edit mode if not currently editing
        if (!wasEditing) {
            this.clearEditMode();
        }
        
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
        
        // If we're in edit mode, update the bounding box
        if (this.editingAnnotation) {
            this.updateAnnotationBoundingBox(bbox);
        } else {
            this.createAnnotation(bbox);
        }
        
        this.updateCanvas();
        this.updateAnnotationsList();
        this.updateDropdowns();
    }

    createAnnotation(bbox) {
        if (this.editingAnnotation) {
            // This should not happen anymore since we handle it in stopDrawing
            return;
        }

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
                const inputType = document.getElementById('inputType').value;
                const inputLang = document.getElementById('inputLang').value;
                const inputValue = document.getElementById('inputValue').value.trim();
                if (!parentLabel || !inputName) {
                    alert('Please select a parent label and enter input name');
                    return;
                }
                this.annotations.inputs.push({
                    id: this.generateId(),
                    parentLabelId: parentLabel,
                    name: inputName,
                    type: inputType,
                    lang: inputLang || null,
                    value: inputValue || null,
                    position: bbox
                });
                document.getElementById('inputName').value = '';
                document.getElementById('inputType').value = 'text';
                document.getElementById('inputLang').value = '';
                document.getElementById('inputValue').value = '';
                break;
        }
    }

    updateAnnotationBoundingBox(bbox) {
        if (!this.editingAnnotation) {
            console.log('No annotation being edited');
            return;
        }

        console.log('Updating bounding box for:', this.editingAnnotation);
        const annotation = this.findAnnotationById(this.editingAnnotation);
        if (annotation) {
            console.log('Found annotation:', annotation);
            if (annotation.boundingBox) {
                console.log('Updating boundingBox from:', annotation.boundingBox, 'to:', bbox);
                annotation.boundingBox = bbox;
            } else if (annotation.position) {
                console.log('Updating position from:', annotation.position, 'to:', bbox);
                annotation.position = bbox;
            }
            this.updateCanvas();
            this.updateAnnotationsList();
            this.clearEditMode();
        } else {
            console.log('Annotation not found!');
        }
    }

    findAnnotationById(id) {
        return [...this.annotations.sections, ...this.annotations.labels, ...this.annotations.inputs]
            .find(item => item.id === id);
    }

    editAnnotation(id) {
        const annotation = this.findAnnotationById(id);
        if (!annotation) return;

        this.editingAnnotation = id;
        this.selectedAnnotation = id;
        
        // Determine annotation type and switch to appropriate mode
        let mode;
        if (this.annotations.sections.find(s => s.id === id)) {
            mode = 'section';
            document.getElementById('sectionName').value = annotation.name;
            document.getElementById('editSectionBtn').style.display = 'block';
            document.getElementById('cancelEditBtn').style.display = 'block';
        } else if (this.annotations.labels.find(l => l.id === id)) {
            mode = 'label';
            document.getElementById('parentSection').value = annotation.parentSectionId;
            document.getElementById('labelText').value = annotation.text;
            document.getElementById('editLabelBtn').style.display = 'block';
        } else if (this.annotations.inputs.find(i => i.id === id)) {
            mode = 'input';
            document.getElementById('parentLabel').value = annotation.parentLabelId;
            document.getElementById('inputName').value = annotation.name;
            document.getElementById('inputType').value = annotation.type || 'text';
            document.getElementById('inputLang').value = annotation.lang || '';
            document.getElementById('inputValue').value = annotation.value || '';
            document.getElementById('editInputBtn').style.display = 'block';
        }
        
        this.setMode(mode);
        this.canvas.style.cursor = 'crosshair';
        this.updateCanvas();
        this.updateAnnotationsList();
        
        // Show edit status
        this.showStatusMessage(`Editing ${type}: ${annotation.name || annotation.text}. Draw new bounding box or click Update.`);
        
        console.log('Edit mode activated for:', id, 'Type:', mode);
    }

    showStatusMessage(message) {
        const statusDiv = document.getElementById('statusMessage');
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
    }

    hideStatusMessage() {
        const statusDiv = document.getElementById('statusMessage');
        statusDiv.style.display = 'none';
    }

    updateAnnotation() {
        if (!this.editingAnnotation) return;

        const annotation = this.findAnnotationById(this.editingAnnotation);
        if (!annotation) return;

        if (this.annotations.sections.find(s => s.id === this.editingAnnotation)) {
            const newName = document.getElementById('sectionName').value.trim();
            if (newName) {
                annotation.name = newName;
                document.getElementById('sectionName').value = '';
            }
        } else if (this.annotations.labels.find(l => l.id === this.editingAnnotation)) {
            const newText = document.getElementById('labelText').value.trim();
            const newParentSection = document.getElementById('parentSection').value;
            if (newText && newParentSection) {
                annotation.text = newText;
                annotation.parentSectionId = newParentSection;
                document.getElementById('labelText').value = '';
            }
        } else if (this.annotations.inputs.find(i => i.id === this.editingAnnotation)) {
            const newName = document.getElementById('inputName').value.trim();
            const newType = document.getElementById('inputType').value;
            const newLang = document.getElementById('inputLang').value;
            const newValue = document.getElementById('inputValue').value.trim();
            const newParentLabel = document.getElementById('parentLabel').value;
            if (newName && newParentLabel) {
                annotation.name = newName;
                annotation.type = newType;
                annotation.lang = newLang || null;
                annotation.value = newValue || null;
                annotation.parentLabelId = newParentLabel;
                document.getElementById('inputName').value = '';
                document.getElementById('inputType').value = 'text';
                document.getElementById('inputLang').value = '';
                document.getElementById('inputValue').value = '';
            }
        }

        this.updateAnnotationsList();
        this.updateDropdowns();
        this.clearEditMode();
    }

    clearEditMode() {
        this.editingAnnotation = null;
        this.selectedAnnotation = null;
        document.getElementById('editSectionBtn').style.display = 'none';
        document.getElementById('editLabelBtn').style.display = 'none';
        document.getElementById('editInputBtn').style.display = 'none';
        document.getElementById('cancelEditBtn').style.display = 'none';
        
        // Clear form fields
        document.getElementById('sectionName').value = '';
        document.getElementById('labelText').value = '';
        document.getElementById('inputName').value = '';
        document.getElementById('inputType').value = 'text';
        document.getElementById('inputLang').value = '';
        document.getElementById('inputValue').value = '';
        
        // Reset parent dropdowns to default
        document.getElementById('parentSection').value = '';
        document.getElementById('parentLabel').value = '';
        
        // Update visual state
        document.querySelectorAll('.annotation-item').forEach(item => {
            item.classList.remove('selected');
            item.classList.remove('editing');
        });
        this.updateCanvas();
        this.hideStatusMessage();
        
        console.log('Edit mode cleared');
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getTypeDisplayName(type) {
        const typeMap = {
            'text': 'Text',
            'textarea': 'Text Area',
            'address': 'Address',
            'name': 'Name',
            'number': 'Number',
            'date': 'Date',
            'email': 'Email',
            'phone': 'Phone',
            'checkbox': 'Checkbox',
            'radio': 'Radio',
            'select': 'Select',
            'currency': 'Currency',
            'percentage': 'Percentage',
            'id': 'ID',
            'signature': 'Signature'
        };
        return typeMap[type] || type;
    }

    getLangDisplayName(lang) {
        const langMap = {
            'en': 'EN',
            'ar': 'عر'
        };
        return langMap[lang] || '';
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
            const isArabic = input.lang === 'ar';
            const isEnglish = input.lang === 'en';
            let className = 'input-box';
            
            if (isArabic) {
                className += '-arabic';
            } else if (isEnglish) {
                className += '-english';
            }
            
            this.drawRect(input.position, className, input.id === this.selectedAnnotation);
        });
        
        // Add editing indicator
        if (this.editingAnnotation) {
            const editingAnnotation = this.findAnnotationById(this.editingAnnotation);
            if (editingAnnotation) {
                const bbox = editingAnnotation.boundingBox || editingAnnotation.position;
                this.drawEditingIndicator(bbox);
            }
        }
    }

    drawEditingIndicator(bbox) {
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        
        const x = bbox[0][0];
        const y = bbox[0][1];
        const width = bbox[1][0] - bbox[0][0];
        const height = bbox[1][1] - bbox[0][1];
        
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);
    }

    drawRect(bbox, className, isSelected) {
        const styles = {
            'section-box': { stroke: '#ff6b35', fill: 'rgba(255, 107, 53, 0.1)', width: 3 },
            'label-box': { stroke: '#4ecdc4', fill: 'rgba(78, 205, 196, 0.1)', width: 2 },
            'input-box': { stroke: '#45b7d1', fill: 'rgba(69, 183, 209, 0.1)', width: 2 },
            'input-box-arabic': { stroke: '#28a745', fill: 'rgba(40, 167, 69, 0.1)', width: 2 },
            'input-box-english': { stroke: '#dc3545', fill: 'rgba(220, 53, 69, 0.1)', width: 2 }
        };
        
        const style = styles[className] || styles['input-box'];
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
        
        // Add language indicator for text fields
        if (className.includes('arabic') || className.includes('english')) {
            const indicator = className.includes('arabic') ? 'عر' : 'EN';
            this.ctx.fillStyle = style.stroke;
            this.ctx.font = '12px Arial';
            this.ctx.fillText(indicator, x + 2, y + 14);
        }
    }

    updateAnnotationsList() {
        const container = document.getElementById('annotationsList');
        container.innerHTML = '';
        
        // Add sections
        this.annotations.sections.forEach(section => {
            const item = this.createAnnotationListItem('Section', section.name, section.boundingBox, section.id);
            if (this.editingAnnotation === section.id) {
                item.classList.add('editing');
            }
            container.appendChild(item);
        });
        
        // Add labels
        this.annotations.labels.forEach(label => {
            const section = this.annotations.sections.find(s => s.id === label.parentSectionId);
            const item = this.createAnnotationListItem('Label', `${label.text} (${section?.name || 'Unknown'})`, label.boundingBox, label.id);
            if (this.editingAnnotation === label.id) {
                item.classList.add('editing');
            }
            container.appendChild(item);
        });
        
        // Add inputs
        this.annotations.inputs.forEach(input => {
            const label = this.annotations.labels.find(l => l.id === input.parentLabelId);
            const typeDisplay = this.getTypeDisplayName(input.type || 'text');
            const langDisplay = input.lang ? ` (${this.getLangDisplayName(input.lang)})` : '';
            const displayName = `${input.name} (${typeDisplay}${langDisplay}) - ${label?.text || 'Unknown'}`;
            const item = this.createAnnotationListItem('Input', displayName, input.position, input.id);
            if (this.editingAnnotation === input.id) {
                item.classList.add('editing');
            }
            
            // Add language-specific styling
            if (input.lang === 'ar') {
                item.querySelector('.type').classList.add('arabic');
            } else if (input.lang === 'en') {
                item.querySelector('.type').classList.add('english');
            }
            
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
            <button class="delete-btn" data-id="${id}">×</button>
            <button class="edit-item-btn" data-id="${id}">Edit</button>
        `;
        
        // Add event listeners for the buttons
        const deleteBtn = item.querySelector('.delete-btn');
        const editBtn = item.querySelector('.edit-item-btn');
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteAnnotation(id);
        });
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editAnnotation(id);
        });
        
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-btn') && !e.target.classList.contains('edit-item-btn')) {
                this.selectAnnotation(id);
            }
        });
        
        return item;
    }

    selectAnnotation(id) {
        // Don't change selection when in edit mode
        if (this.editingAnnotation) return;
        
        this.selectedAnnotation = this.selectedAnnotation === id ? null : id;
        
        // Update visual selection
        document.querySelectorAll('.annotation-item').forEach(item => item.classList.remove('selected'));
        if (this.selectedAnnotation && event && event.target) {
            const targetItem = event.target.closest('.annotation-item');
            if (targetItem) {
                targetItem.classList.add('selected');
            }
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
                    sectionBoundingBox: section.boundingBox, // Preserve section coordinates
                    label: label.text,
                    boundingBox: label.boundingBox,
                    inputs: labelInputs.map(input => ({
                        name: input.name,
                        type: input.type,
                        lang: input.lang,
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
            this.clearEditMode();
            this.updateCanvas();
            this.updateAnnotationsList();
            this.updateDropdowns();
        }
    }
}

// Initialize the tool
const tool = new AnnotationTool();
