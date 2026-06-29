import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from parser import extract_questions_from_pdf
import os
import json

pdf_path = "/Users/transfer/Downloads/2025-NHT-specialistmaths1.pdf"
exam_id = "2025_nht_specialist_maths_1"
output_img_dir = "static/images/2025_nht_specialist_maths_1"

try:
    print("Testing parser.py with 2025-NHT-specialistmaths1.pdf...")
    res = extract_questions_from_pdf(pdf_path, exam_id, output_img_dir)
    print(f"Success! Exam ID: {res['id']}")
    print(f"Title: {res['title']}")
    print(f"Number of Pages: {res['num_pages']}")
    print(f"Number of Questions Extracted: {len(res['questions'])}")
    for q in res['questions']:
        print(f"- {q['section']} Q{q['number']} ({q['marks']} marks), Pages: {q['pages']}")
        print(f"  Snippet: {repr(q['text'][:100])}")
except Exception as e:
    import traceback
    traceback.print_exc()
