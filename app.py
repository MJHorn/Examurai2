import os
import json
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from parser import extract_questions_from_pdf

app = Flask(__name__, static_folder='static', static_url_path='')

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
UPLOAD_FOLDER = os.path.join(DATA_DIR, 'uploads')
DB_PATH = os.path.join(DATA_DIR, 'db.json')
STATIC_IMAGES_DIR = os.path.join(os.path.dirname(__file__), 'static', 'images')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(STATIC_IMAGES_DIR, exist_ok=True)

# Helper to read/write JSON DB
def load_db():
    if not os.path.exists(DB_PATH):
        return {"exams": {}}
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {"exams": {}}

def save_db(data):
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Bootstrap database with preloaded 2025 specialist maths exam if it exists
def bootstrap_db():
    db = load_db()
    default_exam_id = "2025_specialist_maths_2"
    
    if default_exam_id not in db["exams"]:
        default_pdf = "/Users/transfer/Downloads/2025-SpecialistMaths2.pdf"
        if os.path.exists(default_pdf):
            print(f"Bootstrapping DB with preloaded exam from {default_pdf}...")
            try:
                # Copy PDF to uploads folder for consistency
                dest_pdf_path = os.path.join(UPLOAD_FOLDER, f"{default_exam_id}.pdf")
                import shutil
                shutil.copy(default_pdf, dest_pdf_path)
                
                # Extract and parse
                img_dir = os.path.join(STATIC_IMAGES_DIR, default_exam_id)
                exam_data = extract_questions_from_pdf(dest_pdf_path, default_exam_id, img_dir)
                
                db["exams"][default_exam_id] = exam_data
                save_db(db)
                print("DB Bootstrapped successfully!")
            except Exception as e:
                print(f"Error bootstrapping DB: {e}")

bootstrap_db()

# Serve Frontend
@app.route('/')
def index():
    return app.send_static_file('index.html')

# API Endpoints
@app.route('/api/exams', methods=['GET'])
def get_exams():
    db = load_db()
    exams_list = []
    for exam_id, exam in db["exams"].items():
        exams_list.append({
            "id": exam_id,
            "title": exam["title"],
            "num_pages": exam["num_pages"],
            "num_questions": len(exam["questions"])
        })
    return jsonify(exams_list)

@app.route('/api/exams/<exam_id>/questions', methods=['GET'])
def get_questions(exam_id):
    db = load_db()
    exam = db["exams"].get(exam_id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
    return jsonify(exam)

@app.route('/api/import', methods=['POST'])
def import_exam():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are allowed"}), 400
        
    filename = secure_filename(file.filename)
    exam_id = filename.lower().replace('.pdf', '').replace('-', '_').replace(' ', '_')
    
    # Save uploaded file
    pdf_path = os.path.join(UPLOAD_FOLDER, f"{exam_id}.pdf")
    file.save(pdf_path)
    
    # Process PDF and render images
    try:
        img_dir = os.path.join(STATIC_IMAGES_DIR, exam_id)
        exam_data = extract_questions_from_pdf(pdf_path, exam_id, img_dir)
        
        # Merge existing tags if exam was imported before
        db = load_db()
        if exam_id in db["exams"]:
            existing_tags = {}
            for q in db["exams"][exam_id]["questions"]:
                existing_tags[q["id"]] = q.get("tags", [])
            for q in exam_data["questions"]:
                if q["id"] in existing_tags:
                    q["tags"] = existing_tags[q["id"]]
                    
        db["exams"][exam_id] = exam_data
        save_db(db)
        return jsonify({
            "success": True, 
            "exam": {
                "id": exam_id,
                "title": exam_data["title"],
                "num_pages": exam_data["num_pages"],
                "num_questions": len(exam_data["questions"])
            }
        })
    except Exception as e:
        return jsonify({"error": f"Failed to parse PDF: {str(e)}"}), 500

@app.route('/api/questions/<exam_id>/<q_id>/tags', methods=['POST'])
def update_tags(exam_id, q_id):
    data = request.json
    if not data or 'tags' not in data:
        return jsonify({"error": "Missing 'tags' parameter"}), 400
        
    db = load_db()
    exam = db["exams"].get(exam_id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
        
    updated = False
    for q in exam["questions"]:
        if q["id"] == q_id:
            q["tags"] = [t.strip().lower() for t in data["tags"] if t.strip()]
            updated = True
            break
            
    if not updated:
        return jsonify({"error": "Question not found"}), 404
        
    save_db(db)
    return jsonify({"success": True})

@app.route('/api/questions/<exam_id>/<q_id>/adjust', methods=['POST'])
def adjust_question(exam_id, q_id):
    data = request.json
    if not data:
        return jsonify({"error": "Missing modification parameters"}), 400
        
    db = load_db()
    exam = db["exams"].get(exam_id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
        
    updated = False
    for q in exam["questions"]:
        if q["id"] == q_id:
            if 'section' in data:
                q['section'] = data['section']
            if 'number' in data:
                try:
                    q['number'] = int(data['number'])
                except ValueError:
                    pass
            if 'pages' in data:
                try:
                    q['pages'] = [int(p) for p in data['pages']]
                except (ValueError, TypeError):
                    pass
            if 'marks' in data:
                try:
                    q['marks'] = int(data['marks'])
                except ValueError:
                    pass
            if 'text' in data:
                q['text'] = data['text']
            updated = True
            break
            
    if not updated:
        return jsonify({"error": "Question not found"}), 404
        
    save_db(db)
    return jsonify({"success": True})

@app.route('/api/search', methods=['GET'])
def search_questions():
    query = request.args.get('q', '').strip().lower()
    tag_filter = request.args.get('tag', '').strip().lower()
    
    db = load_db()
    results = []
    
    for exam_id, exam in db["exams"].items():
        for q in exam["questions"]:
            # Check tag filter if present
            if tag_filter and tag_filter not in [t.lower() for t in q.get("tags", [])]:
                continue
                
            # Check search query (matches tags, section, number, text)
            if query:
                text_match = query in q.get("text", "").lower()
                tag_match = any(query in t.lower() for t in q.get("tags", []))
                section_match = query in q.get("section", "").lower()
                num_match = query == str(q.get("number", ""))
                
                if not (text_match or tag_match or section_match or num_match):
                    continue
            
            results.append({
                "exam_id": exam_id,
                "exam_title": exam["title"],
                "question": q
            })
            
    return jsonify(results)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True)
