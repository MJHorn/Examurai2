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

def extract_report_data(report_pdf_path, exam_id, output_img_dir):
    """
    Parses a VCE Examiner's Report PDF:
    - Renders page images to output_img_dir
    - Extracts Section A table correct percentages
    - Extracts Section B question discussions and maps pages to questions
    """
    import os
    import re
    import fitz

    doc = fitz.open(report_pdf_path)
    num_pages = len(doc)
    
    # Ensure output image directory exists
    os.makedirs(output_img_dir, exist_ok=True)
    
    # 1. Render all report pages to images
    for idx in range(num_pages):
        page_num = idx + 1
        page = doc[idx]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_filename = f"page_{page_num}.png"
        pix.save(os.path.join(output_img_dir, img_filename))

    # 2. Extract text from all pages
    page_texts = []
    for idx in range(num_pages):
        page_texts.append(doc[idx].get_text())

    # 3. Parse Section A multiple-choice table to get percentages
    mc_percentages = {}
    mc_pages = {}
    row_pattern = re.compile(
        r'\b(\d+)\s+([A-D])\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\b',
        re.IGNORECASE
    )

    for page_idx in range(min(5, num_pages)):
        text = page_texts[page_idx]
        matches = row_pattern.findall(text)
        for m in matches:
            q_num = int(m[0])
            correct_ans = m[1].upper()
            percentages = {
                'A': int(m[2]),
                'B': int(m[3]),
                'C': int(m[4]),
                'D': int(m[5])
            }
            if correct_ans in percentages:
                mc_percentages[q_num] = percentages[correct_ans]
                mc_pages[q_num] = page_idx + 1

    # 4. Map report pages to Section B written questions
    sec_b_page_starts = {}
    for page_num in range(1, num_pages + 1):
        text = page_texts[page_num - 1]
        if page_num <= 2:
            continue
            
        matches = re.finditer(r'Question\s+(\d+)', text)
        for m in matches:
            q_num = int(m.group(1))
            if q_num <= 8:
                if q_num not in sec_b_page_starts:
                    sec_b_page_starts[q_num] = page_num

    # Construct page ranges
    sec_b_page_ranges = {}
    sorted_q_nums = sorted(sec_b_page_starts.keys())
    for i, q_num in enumerate(sorted_q_nums):
        start_page = sec_b_page_starts[q_num]
        if i + 1 < len(sorted_q_nums):
            end_page = sec_b_page_starts[sorted_q_nums[i + 1]] - 1
        else:
            end_page = num_pages
        if end_page < start_page:
            end_page = start_page
        sec_b_page_ranges[q_num] = list(range(start_page, end_page + 1))

    # 5. Extract Section B subpart statistics and average scores
    sec_b_subparts = {}
    sec_b_difficulties = {}
    subpart_pattern = re.compile(r'Question\s+(\d+)([a-z](?:\.[a-z0-9.]+)?)\b', re.IGNORECASE)
    
    for page_num in range(1, num_pages + 1):
        text = page_texts[page_num - 1]
        matches = list(subpart_pattern.finditer(text))
        for idx, m in enumerate(matches):
            q_num = int(m.group(1))
            part_label = m.group(2)
            
            # Sub-text is from this match to the next match on the same page
            start_pos = m.end()
            end_pos = matches[idx+1].start() if idx+1 < len(matches) else len(text)
            sub_text = text[start_pos:end_pos]
            
            # Find the Mark list and Average list
            mark_match = re.search(r'Mark\s+(.*?)\s+Average', sub_text, re.DOTALL | re.IGNORECASE)
            if mark_match:
                marks_scale = [int(x) for x in re.findall(r'\b\d+\b', mark_match.group(1))]
                if marks_scale:
                    max_mark = marks_scale[-1]
                    avg_index = sub_text.find('Average')
                    if avg_index != -1:
                        avg_text = sub_text[avg_index:]
                        numbers = [float(x) for x in re.findall(r'\b\d+\.\d+|\b\d+\b', avg_text)]
                        if len(numbers) >= max_mark + 2:
                            average = numbers[max_mark+1]
                            # Sanitize average if it extracts a percentage or outlier
                            if average > max_mark:
                                if average <= 100:
                                    average = (average / 100.0) * max_mark
                                else:
                                    average = max_mark
                                    
                            pct = int((average / max_mark) * 100)
                            pct = max(0, min(100, pct))
                            
                            if q_num not in sec_b_subparts:
                                sec_b_subparts[q_num] = []
                            sec_b_subparts[q_num].append({
                                "label": part_label,
                                "max_mark": max_mark,
                                "average": round(average, 2),
                                "percentage": pct
                            })

    # Also build basic difficulties mapping for fallback
    for q_num, subparts in sec_b_subparts.items():
        sec_b_difficulties[q_num] = [s["average"] for s in subparts]

    doc.close()

    return {
        "mc_percentages": mc_percentages,
        "mc_pages": mc_pages,
        "sec_b_page_ranges": sec_b_page_ranges,
        "sec_b_difficulties": sec_b_difficulties,
        "sec_b_subparts": sec_b_subparts,
        "num_pages": num_pages
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
