document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewZone = document.getElementById('previewZone');
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const maxWidthInput = document.getElementById('maxWidth');
    const outputFormat = document.getElementById('outputFormat');
    const removeMetadata = document.getElementById('removeMetadata');
    const autoOptimize = document.getElementById('autoOptimize');
    const optimizeAll = document.getElementById('optimizeAll');
    const downloadAll = document.getElementById('downloadAll');
    const clearAll = document.getElementById('clearAll');
    const processedCount = document.getElementById('processedCount');
    const savedSpace = document.getElementById('savedSpace');
    const presetBtn = document.getElementById('presetBtn');
    const presetModal = document.getElementById('presetModal');
    const closeModal = document.querySelector('.close-modal');
    const presets = document.querySelectorAll('.preset');

    let totalSaved = 0;
    let processedImages = 0;
    const processedFiles = new Map();
    const optimizedImages = new Map();

    presetBtn.addEventListener('click', () => {
        presetModal.style.display = 'flex';
    });

    closeModal.addEventListener('click', () => {
        presetModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === presetModal) {
            presetModal.style.display = 'none';
        }
    });

    presets.forEach(preset => {
        preset.addEventListener('click', () => {
            const quality = preset.dataset.quality;
            const width = preset.dataset.width;
            qualitySlider.value = quality;
            maxWidthInput.value = width;
            qualityValue.textContent = quality + '%';
            presetModal.style.display = 'none';
            
            if (processedFiles.size > 0) {
                processedFiles.forEach((file, id) => {
                    processImage(file, id);
                });
            }
        });
    });

    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = `${e.target.value}%`;
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    optimizeAll.addEventListener('click', () => {
        if (processedFiles.size === 0) {
            showNotification('Aucune image à optimiser.', 'info');
            return;
        }
        
        totalSaved = 0;
        processedFiles.forEach((file, id) => {
            processImage(file, id);
        });
        showNotification('Toutes les images ont été réoptimisées.', 'success');
    });

    downloadAll.addEventListener('click', () => {
        if (optimizedImages.size === 0) {
            showNotification('Aucune image à télécharger.', 'info');
            return;
        }

        const zip = new JSZip();
        optimizedImages.forEach((data, id) => {
            // Convertir le Data URL en Blob
            const imageBlob = dataURLtoBlob(data.url);
            zip.file(data.filename, imageBlob);
        });

        zip.generateAsync({type: 'blob'}).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'images_optimisees.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
        
        showNotification('Téléchargement des images lancé.', 'success');
    });

    clearAll.addEventListener('click', () => {
        if (processedFiles.size === 0) {
            showNotification('Aucune image à effacer.', 'info');
            return;
        }

        previewZone.innerHTML = '';
        processedImages = 0;
        totalSaved = 0;
        processedFiles.clear();
        optimizedImages.clear();
        updateStats();
        showNotification('Toutes les images ont été effacées.', 'success');
    });

    function handleFiles(files) {
        if (files.length === 0) return;

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                showNotification('Veuillez sélectionner uniquement des images.', 'error');
                return;
            }
            const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            processedFiles.set(id, file);
            processImage(file, id);
        });
    }

    function processImage(file, id) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                const maxWidth = parseInt(maxWidthInput.value);
                
                if (width > maxWidth) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height = height * ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                if (file.type === 'image/png') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                }
                
                ctx.drawImage(img, 0, 0, width, height);
                
                const quality = parseInt(qualitySlider.value) / 100;
                const format = outputFormat.value === 'auto' ? 
                    (file.type === 'image/png' ? 'image/png' : 'image/jpeg') : 
                    `image/${outputFormat.value}`;
                
                const compressedDataUrl = canvas.toDataURL(format, quality);
                
                const fileExt = outputFormat.value === 'auto' ? 
                    (file.type === 'image/png' ? 'png' : 'jpg') : 
                    outputFormat.value;
                
                optimizedImages.set(id, {
                    url: compressedDataUrl,
                    filename: `${file.name.split('.')[0]}_optimized.${fileExt}`
                });
                
                // Calculer la taille compressée à partir du Blob
                const blob = dataURLtoBlob(compressedDataUrl);
                displayResult(file, compressedDataUrl, id, blob.size);
                
                if (!document.getElementById(id)) {
                    processedImages++;
                }
                updateStats();
            };
        };
    }

    function displayResult(originalFile, compressedDataUrl, id, compressedSize) {
        let div = document.getElementById(id);
        const isNew = !div;
        
        if (isNew) {
            div = document.createElement('div');
            div.id = id;
            div.className = 'preview-item';
        }
        
        const originalSize = originalFile.size;
        const savedSize = originalSize - compressedSize;
        
        if (isNew) {
            totalSaved += savedSize;
        } else {
            const oldSavedSpace = parseInt(div.dataset.savedSpace || '0');
            totalSaved = totalSaved - oldSavedSpace + savedSize;
        }
        
        div.dataset.savedSpace = savedSize;
        
        const compressionRatio = Math.round((1 - (compressedSize / originalSize)) * 100);
        
        div.innerHTML = `
            <img src="${compressedDataUrl}" alt="Image compressée">
            <div class="image-info">
                <p><strong>${originalFile.name}</strong></p>
                <p>Taille originale: ${formatBytes(originalSize)}</p>
                <p>Taille compressée: ${formatBytes(compressedSize)}</p>
                <p>Réduction: ${compressionRatio}%</p>
                <p>Espace économisé: ${formatBytes(savedSize)}</p>
            </div>
            <button class="download-btn" data-id="${id}">Télécharger</button>
        `;
        
        div.querySelector('.download-btn').addEventListener('click', () => {
            const imageData = optimizedImages.get(id);
            if (imageData) {
                const link = document.createElement('a');
                const blob = dataURLtoBlob(imageData.url);
                link.href = URL.createObjectURL(blob);
                link.download = imageData.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }
        });
        
        if (isNew) {
            previewZone.insertBefore(div, previewZone.firstChild);
        }
        
        updateStats();
    }

    function dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type: mime});
    }

    function updateStats() {
        processedCount.textContent = processedImages;
        savedSpace.textContent = formatBytes(totalSaved);
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
});