# app.py
import os
import ebooklib
import PyPDF2
from ebooklib import epub
from bs4 import BeautifulSoup
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
import glob
import json

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['BOOKS_FOLDER'] = 'books'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['BOOKS_FOLDER'], exist_ok=True)

def extract_epub_chapters(book):
    """Extract chapters from an EPUB file"""
    chapters = []
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_content(), 'html.parser')
            text = soup.get_text()
            # Clean up text
            text = ' '.join(text.split())
            if text and len(text) > 100:  # Only include substantial content
                chapters.append({
                    'title': item.get_name(),
                    'content': text
                })
    return chapters

def extract_pdf_text(filepath):
    """Extract text from a PDF file for search and metadata"""
    text = ""
    try:
        with open(filepath, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + " "
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

def get_book_metadata(filepath, file_type):
    """Get book title from metadata"""
    title = os.path.basename(filepath).split('.')[0]  # Default to filename
    
    try:
        if file_type == 'epub':
            book = epub.read_epub(filepath)
            metadata_title = book.get_metadata('DC', 'title')
            if metadata_title and len(metadata_title) > 0:
                title = metadata_title[0][0]
        # For PDFs, we'll just use the filename without extension
    except Exception as e:
        print(f"Error getting metadata: {e}")
    
    return title

def get_library_books():
    """Get all books from both uploads and books folders"""
    library = []
    
    # Check uploads folder
    for ext in ['epub', 'pdf']:
        for filepath in glob.glob(os.path.join(app.config['UPLOAD_FOLDER'], f'*.{ext}')):
            book_type = 'epub' if ext == 'epub' else 'pdf'
            library.append({
                'filename': os.path.basename(filepath),
                'title': get_book_metadata(filepath, book_type),
                'type': book_type,
                'path': f"uploads/{os.path.basename(filepath)}"
            })
    
    # Check books folder
    for ext in ['epub', 'pdf']:
        for filepath in glob.glob(os.path.join(app.config['BOOKS_FOLDER'], f'*.{ext}')):
            book_type = 'epub' if ext == 'epub' else 'pdf'
            library.append({
                'filename': os.path.basename(filepath),
                'title': get_book_metadata(filepath, book_type),
                'type': book_type,
                'path': f"books/{os.path.basename(filepath)}"
            })
    
    return library

@app.route('/')
def index():
    library = get_library_books()
    return render_template('index.html', library=library)

@app.route('/upload', methods=['POST'])
def upload_ebook():
    if 'ebook' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['ebook']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and (file.filename.endswith('.epub') or file.filename.endswith('.pdf')):
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)
        
        try:
            if file.filename.endswith('.epub'):
                book = epub.read_epub(filepath)
                title = get_book_metadata(filepath, 'epub')
                chapters = extract_epub_chapters(book)
                return jsonify({
                    'title': title,
                    'chapters': chapters,
                    'filename': file.filename,
                    'type': 'epub'
                })
            else:  # PDF
                title = get_book_metadata(filepath, 'pdf')
                # For PDFs, we don't extract chapters, we'll use a PDF viewer
                return jsonify({
                    'title': title,
                    'filename': file.filename,
                    'type': 'pdf'
                })
        except Exception as e:
            return jsonify({'error': f'Error processing book: {str(e)}'}), 500
    
    return jsonify({'error': 'Invalid file type. Please upload an EPUB or PDF file'}), 400

@app.route('/read/<path:filepath>')
def read_ebook(filepath):
    full_path = os.path.join(filepath)
    if not os.path.exists(full_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        if filepath.endswith('.epub'):
            book = epub.read_epub(full_path)
            chapters = extract_epub_chapters(book)
            return jsonify({'chapters': chapters, 'type': 'epub'})
        else:  # PDF
            # For PDFs, we'll let the frontend handle the PDF display
            return jsonify({'type': 'pdf'})
    except Exception as e:
        return jsonify({'error': f'Error reading book: {str(e)}'}), 500

@app.route('/library')
def get_library():
    library = get_library_books()
    return jsonify(library)

@app.route('/file/<path:filepath>')
def serve_file(filepath):
    return send_file(filepath)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)