import os
import re
import json
import fitz

def extract_questions_from_pdf(pdf_path, exam_id, output_img_dir):
    """
    Parses a VCE Exam PDF, extracts Section A & B questions,
    renders page images, and returns a dictionary of the exam structure.
    """
    doc = fitz.open(pdf_path)
    num_pages = len(doc)
    
    # Ensure output image directory exists
    os.makedirs(output_img_dir, exist_ok=True)
    
    questions = []
    
    # Phase 1: Scan pages to find which questions start on which pages
    # Maps page_num (1-indexed) -> list of questions starting on it
    # Format of a question start: {"section": "Section A"/"Section B", "number": int, "marks": int}
    sec_a_starts = {} # page_num -> list of int (question numbers)
    sec_b_starts = {} # page_num -> list of (q_num, marks)
    
    for idx in range(num_pages):
        page_num = idx + 1
        page = doc[idx]
        text = page.get_text()
        
        # Render high-resolution page image
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_filename = f"page_{page_num}.png"
        pix.save(os.path.join(output_img_dir, img_filename))
        
        # Determine section context
        is_sec_a = False
        is_sec_b = False
        
        if "Section A" in text or (page_num >= 2 and page_num <= 10):
            is_sec_a = True
        elif "Section B" in text or (page_num >= 12 and page_num <= 24):
            is_sec_b = True
            
        if is_sec_a:
            # Look for Question X
            matches = re.finditer(r'Question\s+(\d+)\b', text)
            q_numbers = []
            for m in matches:
                q_num = int(m.group(1))
                if q_num <= 20 and q_num not in q_numbers:
                    q_numbers.append(q_num)
            if q_numbers:
                sec_a_starts[page_num] = q_numbers
                
        elif is_sec_b:
            # Look for Question X (Y marks)
            matches = re.finditer(r'Question\s+(\d+)\s*\((\d+)\s+marks\)', text)
            q_list = []
            for m in matches:
                q_num = int(m.group(1))
                marks = int(m.group(2))
                q_list.append((q_num, marks))
            if q_list:
                sec_b_starts[page_num] = q_list

    # Phase 2: Build Section A Questions
    # In Section A, a question is usually on a single page, but multiple questions are on the same page.
    # We will split text of a page by question headings.
    for page_num in sorted(sec_a_starts.keys()):
        q_nums = sec_a_starts[page_num]
        page_idx = page_num - 1
        page_text = doc[page_idx].get_text()
        
        # Find positions of "Question X"
        positions = []
        for q_num in q_nums:
            pattern = rf'Question\s+{q_num}\b'
            match = re.search(pattern, page_text)
            if match:
                positions.append((q_num, match.start()))
        
        # Sort by occurrence order on the page
        positions.sort(key=lambda x: x[1])
        
        # Segment page text for each question
        for i, (q_num, pos) in enumerate(positions):
            start_pos = pos
            end_pos = positions[i+1][1] if i + 1 < len(positions) else len(page_text)
            q_text = page_text[start_pos:end_pos].strip()
            
            # Clean up VCAA boilerplate at the end of page text
            boilerplate_pattern = r'\d+\s+VCE\s+Specialist\s+Mathematics\s+Examination.*|Do\s+not\s+write\s+in\s+this\s+area.*'
            q_text = re.sub(boilerplate_pattern, '', q_text, flags=re.IGNORECASE).strip()
            
            questions.append({
                "id": f"{exam_id}_a_q{q_num}",
                "section": "Section A",
                "number": q_num,
                "pages": [page_num],
                "marks": 1,
                "text": q_text,
                "tags": []
            })
            
    # Phase 3: Build Section B Questions
    # In Section B, questions span multiple pages.
    # Example: Q1 starts at page 12, Q2 starts at page 14. Thus, Q1 spans [12, 13].
    b_q_pages = sorted(sec_b_starts.keys())
    for idx, page_num in enumerate(b_q_pages):
        q_list = sec_b_starts[page_num]
        q_num, marks = q_list[0] # Usually one long question starts per page
        
        # Determine page range
        start_page = page_num
        # If there is a next question, it ends right before the next question's start page.
        # Otherwise, it ends at page 23 or the last page containing actual content before formula sheet.
        if idx + 1 < len(b_q_pages):
            end_page = b_q_pages[idx + 1] - 1
        else:
            end_page = 23 # Safe default for VCE Specialist Exam 2
            
        page_range = list(range(start_page, end_page + 1))
        
        # Aggregate text across all its pages
        q_texts = []
        for p in page_range:
            p_text = doc[p-1].get_text()
            # Clean boilerplate
            p_text = re.sub(r'\d+\s+VCE\s+Specialist\s+Mathematics\s+Examination.*|Do\s+not\s+write\s+in\s+this\s+area.*', '', p_text, flags=re.IGNORECASE)
            q_texts.append(p_text.strip())
            
        full_text = "\n\n--- Page {} ---\n\n".join(q_texts)
        # Format the join nicely
        full_text = ""
        for i, p in enumerate(page_range):
            if i > 0:
                full_text += f"\n\n[Page {p}]\n\n"
            full_text += q_texts[i]
            
        questions.append({
            "id": f"{exam_id}_b_q{q_num}",
            "section": "Section B",
            "number": q_num,
            "pages": page_range,
            "marks": marks,
            "text": full_text,
            "tags": []
        })
        
    # Sort questions by Section, then Number
    questions.sort(key=lambda x: (x["section"], x["number"]))
    
    return {
        "id": exam_id,
        "title": f"VCE {exam_id.replace('_', ' ').title()}",
        "num_pages": num_pages,
        "questions": questions
    }

# Quick test if run directly
if __name__ == "__main__":
    pdf_path = "/Users/transfer/Downloads/2025-SpecialistMaths2.pdf"
    if os.path.exists(pdf_path):
        print("Testing parser.py with Specialist Mathematics 2025 Exam...")
        result = extract_questions_from_pdf(pdf_path, "2025_specialist_maths_2", "static/images/2025_specialist_maths_2")
        print(f"Parsed {len(result['questions'])} questions successfully!")
        for q in result['questions'][:5]:
            print(f"- {q['section']} Q{q['number']} ({q['marks']} marks), Pages: {q['pages']}")
    else:
        print("Test PDF not found at /Users/transfer/Downloads/2025-SpecialistMaths2.pdf")
