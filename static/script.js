// static/script.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const themeToggle = document.getElementById('theme-toggle');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('ebook-upload');
    const fileName = document.getElementById('file-name');
    const libraryViewBtn = document.getElementById('library-view-btn');
    const readerViewBtn = document.getElementById('reader-view-btn');
    const libraryView = document.getElementById('library-view');
    const readerView = document.getElementById('reader-view');
    const bookInfo = document.getElementById('book-info');
    const bookTitle = document.getElementById('book-title');
    const reader = document.getElementById('reader');
    const epubReader = document.getElementById('epub-reader');
    const pdfReader = document.getElementById('pdf-reader');
    const content = document.getElementById('content');
    const pdfCanvas = document.getElementById('pdf-canvas');
    const epubControls = document.getElementById('epub-controls');
    const pdfControls = document.getElementById('pdf-controls');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const fitWidthBtn = document.getElementById('fit-width');
    const pageInfo = document.getElementById('page-info');
    const pdfPageInfo = document.getElementById('pdf-page-info');
    const welcomeMessage = document.getElementById('welcome-message');
    const booksGrid = document.getElementById('books-grid');
    
    // State variables
    let currentBook = null;
    let currentChapter = 0;
    let darkMode = localStorage.getItem('darkMode') === 'true';
    
    // PDF.js variables
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.2;
    let canvasContext = pdfCanvas.getContext('2d');
    
    // Initialize theme
    if (darkMode) {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    // Initialize PDF.js
    pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    
    // Event Listeners
    themeToggle.addEventListener('click', toggleDarkMode);
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    libraryViewBtn.addEventListener('click', () => switchView('library'));
    readerViewBtn.addEventListener('click', () => switchView('reader'));
    prevBtn.addEventListener('click', goToPreviousChapter);
    nextBtn.addEventListener('click', goToNextChapter);
    prevPageBtn.addEventListener('click', onPrevPage);
    nextPageBtn.addEventListener('click', onNextPage);
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);
    fitWidthBtn.addEventListener('click', fitToWidth);
    
    // Add event listeners to book cards
    document.addEventListener('click', function(e) {
        const bookCard = e.target.closest('.book-card');
        if (bookCard) {
            const filename = bookCard.dataset.filename;
            const type = bookCard.dataset.type;
            loadBook(filename, type);
            switchView('reader');
        }
    });
    
    // Functions
    function toggleDarkMode() {
        darkMode = !darkMode;
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', darkMode);
        
        if (darkMode) {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }
    
    function switchView(view) {
        if (view === 'library') {
            libraryViewBtn.classList.add('active');
            readerViewBtn.classList.remove('active');
            libraryView.classList.remove('hidden');
            readerView.classList.add('hidden');
            refreshLibrary();
        } else {
            libraryViewBtn.classList.remove('active');
            readerViewBtn.classList.add('active');
            libraryView.classList.add('hidden');
            readerView.classList.remove('hidden');
        }
    }
    
    function handleFileUpload() {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileName.textContent = file.name;
            uploadBook(file);
        }
    }
    
    function uploadBook(file) {
        const formData = new FormData();
        formData.append('ebook', file);
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }
            
            currentBook = data;
            
            // Update UI based on book type
            bookTitle.textContent = data.title;
            bookInfo.classList.remove('hidden');
            reader.classList.remove('hidden');
            welcomeMessage.classList.add('hidden');
            
            if (data.type === 'epub') {
                currentChapter = 0;
                showEpubReader();
                displayChapter();
            } else {
                showPdfReader();
                loadPdf(`/file/uploads/${data.filename}`);
            }
            
            // Refresh library to show the new book
            refreshLibrary();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error uploading file');
        });
    }
    
    function loadBook(filepath, type) {
        fetch(`/read/${filepath}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Error: ' + data.error);
                    return;
                }
                
                // Create a book object
                const pathParts = filepath.split('/');
                const filename = pathParts[pathParts.length - 1];
                const title = filename.split('.')[0];
                
                currentBook = {
                    title: title,
                    filename: filename,
                    type: type,
                    path: filepath
                };
                
                // Update UI
                bookTitle.textContent = title;
                bookInfo.classList.remove('hidden');
                reader.classList.remove('hidden');
                welcomeMessage.classList.add('hidden');
                
                if (type === 'epub') {
                    currentChapter = 0;
                    showEpubReader();
                    // For EPUBs, we need to load the actual content
                    loadEpubContent(filepath);
                } else {
                    showPdfReader();
                    loadPdf(`/file/${filepath}`);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error loading book');
            });
    }
    
    function loadEpubContent(filepath) {
        fetch(`/read/${filepath}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Error: ' + data.error);
                    return;
                }
                
                currentBook.chapters = data.chapters;
                currentChapter = 0;
                displayChapter();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error loading EPUB content');
            });
    }
    
    function showEpubReader() {
        epubReader.classList.remove('hidden');
        pdfReader.classList.add('hidden');
        epubControls.classList.remove('hidden');
        pdfControls.classList.add('hidden');
    }
    
    function showPdfReader() {
        epubReader.classList.add('hidden');
        pdfReader.classList.remove('hidden');
        epubControls.classList.add('hidden');
        pdfControls.classList.remove('hidden');
    }
    
    function displayChapter() {
        if (!currentBook || !currentBook.chapters) return;
        
        const chapter = currentBook.chapters[currentChapter];
        content.innerHTML = `<h3>${chapter.title || `Chapter ${currentChapter + 1}`}</h3>
                            <p>${chapter.content}</p>`;
        
        // Update page info
        pageInfo.textContent = `Chapter ${currentChapter + 1} of ${currentBook.chapters.length}`;
        
        // Update button states
        prevBtn.disabled = currentChapter === 0;
        nextBtn.disabled = currentChapter === currentBook.chapters.length - 1;
    }
    
    function goToPreviousChapter() {
        if (currentBook && currentBook.chapters && currentChapter > 0) {
            currentChapter--;
            displayChapter();
        }
    }
    
    function goToNextChapter() {
        if (currentBook && currentBook.chapters && currentChapter < currentBook.chapters.length - 1) {
            currentChapter++;
            displayChapter();
        }
    }
    
    // PDF.js functions
    function loadPdf(url) {
        pdfjsLib.getDocument(url).promise.then(function(pdf) {
            pdfDoc = pdf;
            pdfPageInfo.textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
            
            // Render the first page
            renderPage(pageNum);
        }).catch(function(error) {
            alert('Error loading PDF: ' + error.message);
        });
    }
    
    function renderPage(num) {
        pageRendering = true;
        
        pdfDoc.getPage(num).then(function(page) {
            const viewport = page.getViewport({ scale: scale });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: canvasContext,
                viewport: viewport
            };
            
            const renderTask = page.render(renderContext);
            
            renderTask.promise.then(function() {
                pageRendering = false;
                
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
                
                pdfPageInfo.textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
                prevPageBtn.disabled = pageNum <= 1;
                nextPageBtn.disabled = pageNum >= pdfDoc.numPages;
            });
        });
    }
    
    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }
    
    function onPrevPage() {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    }
    
    function onNextPage() {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    }
    
    function zoomIn() {
        scale += 0.2;
        queueRenderPage(pageNum);
    }
    
    function zoomOut() {
        if (scale > 0.4) {
            scale -= 0.2;
            queueRenderPage(pageNum);
        }
    }
    
    function fitToWidth() {
        // This would need the container width to calculate proper scale
        // For now, just reset to default scale
        scale = 1.2;
        queueRenderPage(pageNum);
    }
    
    function refreshLibrary() {
        fetch('/library')
            .then(response => response.json())
            .then(library => {
                if (library.length === 0) {
                    booksGrid.innerHTML = `
                        <div class="empty-library">
                            <i class="fas fa-inbox"></i>
                            <p>Your library is empty</p>
                            <p>Upload books to get started</p>
                        </div>
                    `;
                    return;
                }
                
                booksGrid.innerHTML = library.map(book => `
                    <div class="book-card" data-filename="${book.path}" data-type="${book.type}">
                        <div class="book-cover">
                            <i class="fas fa-book-open"></i>
                            <span class="book-format">${book.type.toUpperCase()}</span>
                        </div>
                        <div class="book-info">
                            <h3>${book.title}</h3>
                            <p class="book-filename">${book.filename}</p>
                        </div>
                    </div>
                `).join('');
            })
            .catch(error => {
                console.error('Error fetching library:', error);
            });
    }
    
    // Initial library refresh
    refreshLibrary();
});