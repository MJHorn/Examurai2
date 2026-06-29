import fitz

pdf_path = "/Users/transfer/Downloads/2025-NHT-specialistmaths1.pdf"
doc = fitz.open(pdf_path)
for i in range(len(doc)):
    page_num = i + 1
    page = doc[i]
    tp = page.get_textpage_ocr(flags=3, dpi=150, language="eng")
    text = tp.extractText()
    print(f"--- Page {page_num} ---")
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    for line in lines:
        if "question" in line.lower():
            print(f"  Match: {line}")
