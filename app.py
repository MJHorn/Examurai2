import os
import json
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from parser import extract_questions_from_pdf, extract_report_data

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
            "num_questions": len(exam["questions"]),
            "examiner_report": exam.get("examiner_report", {"imported": False})
        })
    return jsonify(exams_list)

@app.route('/api/exams/<exam_id>/questions', methods=['GET'])
def get_questions(exam_id):
    db = load_db()
    exam = db["exams"].get(exam_id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
        
    # Dynamically compute y_offset_ratio for each question if PDF is uploaded
    pdf_path = os.path.join(UPLOAD_FOLDER, f"{exam_id}.pdf")
    if os.path.exists(pdf_path):
        try:
            import fitz
            doc = fitz.open(pdf_path)
            for q in exam.get("questions", []):
                if "y_offset_ratio" not in q:
                    if q.get("pages"):
                        page_num = q["pages"][0]
                        if page_num <= len(doc):
                            page = doc[page_num - 1]
                            q_num = q.get("number")
                            # Try searching "Question X"
                            rects = page.search_for(f"Question {q_num}")
                            if not rects:
                                # Try double space "Question  X"
                                rects = page.search_for(f"Question  {q_num}")
                            if rects:
                                y0 = rects[0].y0
                                q["y_offset_ratio"] = y0 / page.rect.height
                            else:
                                q["y_offset_ratio"] = 0.0
            doc.close()
        except Exception as e:
            print(f"Error computing dynamic y_offset: {e}")

    # Dynamically compute report_y_offset_ratio for each question if report PDF is uploaded
    report_pdf_path = os.path.join(UPLOAD_FOLDER, f"{exam_id}_report.pdf")
    if os.path.exists(report_pdf_path):
        try:
            import fitz
            doc_rep = fitz.open(report_pdf_path)
            for q in exam.get("questions", []):
                if "report_y_offset_ratio" not in q:
                    if q.get("report_pages"):
                        page_num = q["report_pages"][0]
                        if page_num <= len(doc_rep):
                            page = doc_rep[page_num - 1]
                            q_num = q.get("number")
                            # Try searching "Question X"
                            rects = page.search_for(f"Question {q_num}")
                            if not rects:
                                # Try double space "Question  X"
                                rects = page.search_for(f"Question  {q_num}")
                            if rects:
                                y0 = rects[0].y0
                                q["report_y_offset_ratio"] = y0 / page.rect.height
                            else:
                                q["report_y_offset_ratio"] = 0.0
            doc_rep.close()
        except Exception as e:
            print(f"Error computing dynamic report y_offset: {e}")
            
    return jsonify(exam)

@app.route('/api/exams/<exam_id>', methods=['DELETE'])
def delete_exam(exam_id):
    db = load_db()
    if "exams" not in db or exam_id not in db["exams"]:
        return jsonify({"error": "Exam not found"}), 404
        
    # Delete PDF file
    pdf_path = os.path.join(UPLOAD_FOLDER, f"{exam_id}.pdf")
    if os.path.exists(pdf_path):
        try:
            os.remove(pdf_path)
        except Exception as e:
            print(f"Error removing PDF: {e}")
            
    # Delete images directory
    img_dir = os.path.join(STATIC_IMAGES_DIR, exam_id)
    if os.path.exists(img_dir):
        try:
            import shutil
            shutil.rmtree(img_dir)
        except Exception as e:
            print(f"Error removing image folder: {e}")
            
    # Remove from database
    del db["exams"][exam_id]
    save_db(db)
    
    return jsonify({"success": True})

@app.route('/api/exams/<exam_id>/rename', methods=['POST'])
def rename_exam(exam_id):
    data = request.json
    if not data or 'title' not in data or not data['title'].strip():
        return jsonify({"error": "Exam title is required"}), 400
        
    db = load_db()
    if "exams" not in db or exam_id not in db["exams"]:
        return jsonify({"error": "Exam not found"}), 404
        
    db["exams"][exam_id]["title"] = data['title'].strip()
    save_db(db)
    
    return jsonify({"success": True, "title": db["exams"][exam_id]["title"]})

@app.route('/api/exams/<exam_id>/import-report', methods=['POST'])
def import_report(exam_id):
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are allowed"}), 400
        
    db = load_db()
    if "exams" not in db or exam_id not in db["exams"]:
        return jsonify({"error": "Exam not found"}), 404
        
    # Save report PDF
    report_pdf_name = f"{exam_id}_report.pdf"
    report_pdf_path = os.path.join(UPLOAD_FOLDER, report_pdf_name)
    file.save(report_pdf_path)
    
    # Process report and extract metrics/render pages
    try:
        report_img_dir = os.path.join(STATIC_IMAGES_DIR, f"{exam_id}_report")
        report_data = extract_report_data(report_pdf_path, exam_id, report_img_dir)
        
        # Populate exam questions with report page ranges and percentage difficulties
        mc_percentages = report_data.get("mc_percentages", {})
        mc_pages = report_data.get("mc_pages", {})
        sec_b_page_ranges = report_data.get("sec_b_page_ranges", {})
        sec_b_difficulties = report_data.get("sec_b_difficulties", {})
        sec_b_subparts = report_data.get("sec_b_subparts", {})
        
        exam = db["exams"][exam_id]
        
        for q in exam.get("questions", []):
            q_num = q.get("number")
            if q.get("section") == "Section A":
                q["report_pages"] = [mc_pages.get(q_num, 2)]
                q["percentage_correct"] = mc_percentages.get(q_num, 75)
            elif q.get("section") == "Section B":
                q["report_pages"] = sec_b_page_ranges.get(q_num, [])
                
                # Cache detailed subparts
                subparts = sec_b_subparts.get(q_num, [])
                q["subparts"] = subparts
                
                if subparts:
                    total_avg = sum(s["average"] for s in subparts)
                    total_marks = sum(s["max_mark"] for s in subparts)
                    if total_marks > 0:
                        pct = int((total_avg / total_marks) * 100)
                        pct = max(5, min(95, pct)) # Clamped beautifully
                        q["percentage_correct"] = pct
                    else:
                        q["percentage_correct"] = 65
                else:
                    q["percentage_correct"] = 65
                    
        # Update exam metadata
        exam["examiner_report"] = {
            "imported": True,
            "num_pages": report_data.get("num_pages", 0),
            "filename": report_pdf_name
        }
        
        save_db(db)
        return jsonify({
            "success": True,
            "examiner_report": exam["examiner_report"]
        })
    except Exception as e:
        return jsonify({"error": f"Failed to parse Examiner's Report: {str(e)}"}), 500

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

@app.route('/api/exams/<exam_id>/tags/bulk', methods=['POST'])
def bulk_update_tags(exam_id):
    data = request.json
    if not data or 'question_ids' not in data or 'tags' not in data or 'action' not in data:
        return jsonify({"error": "Missing bulk parameter ('question_ids', 'tags', 'action')"}), 400
        
    db = load_db()
    exam = db["exams"].get(exam_id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
        
    q_ids = set(data['question_ids'])
    tags_to_update = [t.strip().lower() for t in data['tags'] if t.strip()]
    action = data['action'] # 'add' or 'remove'
    
    updated_count = 0
    for q in exam["questions"]:
        if q["id"] in q_ids:
            current_tags = q.get("tags", [])
            if action == 'add':
                # Append only unique tags
                for t in tags_to_update:
                    if t not in current_tags:
                        current_tags.append(t)
            elif action == 'remove':
                current_tags = [t for t in current_tags if t not in tags_to_update]
            
            q["tags"] = current_tags
            updated_count += 1
            
    save_db(db)
    return jsonify({"success": True, "updated_count": updated_count})

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

@app.route('/api/classes', methods=['GET'])
def get_classes():
    db = load_db()
    if "classes" not in db:
        db["classes"] = {}
    return jsonify(list(db["classes"].values()))

@app.route('/api/classes', methods=['POST'])
def create_class():
    data = request.json
    if not data or 'name' not in data or not data['name'].strip():
        return jsonify({"error": "Class name is required"}), 400
        
    name = data['name'].strip()
    import re
    class_id = re.sub(r'[^a-z0-9_]', '', name.lower().replace(' ', '_'))
    if not class_id:
        return jsonify({"error": "Invalid class name"}), 400
        
    db = load_db()
    if "classes" not in db:
        db["classes"] = {}
        
    if class_id in db["classes"]:
        return jsonify({"error": "Class already exists"}), 400
        
    db["classes"][class_id] = {
        "id": class_id,
        "name": name,
        "seen_questions": []
    }
    
    save_db(db)
    return jsonify({"success": True, "class": db["classes"][class_id]})

@app.route('/api/classes/<class_id>', methods=['DELETE'])
def delete_class(class_id):
    db = load_db()
    if "classes" not in db or class_id not in db["classes"]:
        return jsonify({"error": "Class not found"}), 404
        
    del db["classes"][class_id]
    save_db(db)
    return jsonify({"success": True})

@app.route('/api/classes/<class_id>/toggle-seen', methods=['POST'])
def toggle_seen(class_id):
    data = request.json
    if not data or 'question_id' not in data:
        return jsonify({"error": "Missing 'question_id' parameter"}), 400
        
    q_id = data['question_id']
    db = load_db()
    if "classes" not in db or class_id not in db["classes"]:
        return jsonify({"error": "Class not found"}), 404
        
    seen_list = db["classes"][class_id].get("seen_questions", [])
    if q_id in seen_list:
        seen_list.remove(q_id)
        seen = False
    else:
        seen_list.append(q_id)
        seen = True
        
    db["classes"][class_id]["seen_questions"] = seen_list
    save_db(db)
    return jsonify({"success": True, "seen": seen})

@app.route('/api/builder/compile', methods=['POST'])
def compile_worksheet():
    data = request.json
    if not data or 'question_refs' not in data or not data['question_refs']:
        return jsonify({"error": "Missing or empty 'question_refs' parameter"}), 400
        
    title = data.get('title', 'Custom Worksheet').strip() or 'Custom Worksheet'
    subtitle = data.get('subtitle', '').strip()
    
    import fitz
    import datetime
    
    db = load_db()
    doc_out = fitz.open()
    
    # 1. Create cover page
    cover = doc_out.new_page(width=595, height=842) # A4
    
    # Draw custom border frame
    shape = cover.new_shape()
    shape.draw_rect(fitz.Rect(35, 35, 560, 807))
    shape.finish(color=(0.12, 0.16, 0.32), width=2)
    shape.draw_line((35, 230), (560, 230))
    shape.finish(color=(0.12, 0.16, 0.32), width=1)
    shape.commit()
    
    # Insert premium header text
    cover.insert_text((60, 90), "EXAMURAI REVISION PLATFORM", fontsize=11, fontname="Helvetica-Bold", color=(0.38, 0.4, 0.95))
    cover.insert_text((60, 135), title, fontsize=24, fontname="Helvetica-Bold", color=(0.09, 0.12, 0.23))
    if subtitle:
        cover.insert_text((60, 168), subtitle, fontsize=13, fontname="Helvetica-Oblique", color=(0.4, 0.4, 0.45))
        
    # Date & stats block
    date_str = datetime.date.today().strftime("%B %d, %Y")
    cover.insert_text((60, 205), f"Generated: {date_str}   |   Questions: {len(data['question_refs'])} Items", fontsize=10, fontname="Helvetica-Bold", color=(0.5, 0.5, 0.55))
    
    cover.insert_text((60, 270), "Worksheet Question Index Checklist", fontsize=14, fontname="Helvetica-Bold", color=(0.09, 0.12, 0.23))
    
    y_pos = 305
    total_marks = 0
    
    # Render index listing & gather pages for compilation
    compilation_pages = []
    
    for idx, ref in enumerate(data['question_refs']):
        exam_id = ref.get('exam_id')
        q_id = ref.get('q_id')
        if not exam_id or not q_id:
            continue
            
        exam = db["exams"].get(exam_id)
        if not exam:
            continue
            
        q = next((item for item in exam["questions"] if item["id"] == q_id), None)
        if not q:
            continue
            
        total_marks += q.get("marks", 0)
        text_line = f"Question {idx+1}: {exam['title']} — {q['section']} Q{q['number']} ({q['marks']} mk)"
        
        # Checkbox bullet
        cover.insert_text((60, y_pos), "[  ]", fontsize=10, fontname="Helvetica-Bold", color=(0.4, 0.4, 0.45))
        # Details text
        cover.insert_text((90, y_pos), text_line, fontsize=10, fontname="Helvetica", color=(0.15, 0.15, 0.18))
        
        y_pos += 24
        
        # Track pages to append
        pdf_path = os.path.join(UPLOAD_FOLDER, f"{exam_id}.pdf")
        if os.path.exists(pdf_path):
            compilation_pages.append({
                "pdf_path": pdf_path,
                "pages": q.get("pages", [])
            })
            
        if y_pos > 750:
            # Overlap protection
            cover.insert_text((90, y_pos), "...and more questions below.", fontsize=10, fontname="Helvetica-Oblique", color=(0.5, 0.5, 0.5))
            break
            
    # Print total marks tally
    cover.insert_text((60, 780), f"TOTAL MARKS: {total_marks} Marks Available", fontsize=11, fontname="Helvetica-Bold", color=(0.38, 0.4, 0.95))
    
    # 2. Append original vector pages
    for page_ref in compilation_pages:
        try:
            doc_src = fitz.open(page_ref["pdf_path"])
            for page_num in page_ref["pages"]:
                doc_out.insert_pdf(doc_src, from_page=page_num-1, to_page=page_num-1)
            doc_src.close()
        except Exception as e:
            print(f"Error appending pages: {e}")
            
    # 3. Save final PDF
    timestamp = int(datetime.datetime.now().timestamp())
    filename = f"worksheet_{timestamp}.pdf"
    out_path = os.path.join(UPLOAD_FOLDER, filename)
    
    doc_out.save(out_path)
    doc_out.close()
    
    return jsonify({
        "success": True,
        "filename": filename,
        "download_url": f"/api/download/{filename}"
    })

@app.route('/api/download/<filename>', methods=['GET'])
def download_compiled_worksheet(filename):
    filename = secure_filename(filename)
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True)
