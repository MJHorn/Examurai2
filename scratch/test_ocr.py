import fitz
import sys

pdf_path = "/Users/transfer/Downloads/2025-NHT-specialistmaths1.pdf"
try:
    doc = fitz.open(pdf_path)
    page = doc[0]
    # Let's try page.get_textpage_ocr() or page.get_text(..., flags=...) or check OCR
    print("Testing PyMuPDF OCR...")
    try:
        tp = page.get_textpage_ocr(flags=3, language="eng")
        text = tp.extractText()
        print(f"OCR success! Character count: {len(text)}")
        print(f"Snippet:\n{text[:500]}")
    except Exception as ex:
        print(f"PyMuPDF get_textpage_ocr failed: {ex}")
except Exception as e:
    print(f"Error: {e}")
