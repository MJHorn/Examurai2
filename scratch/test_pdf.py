import fitz
import sys

pdf_path = "/Users/transfer/Downloads/2025-NHT-specialistmaths1.pdf"
try:
    doc = fitz.open(pdf_path)
    print(f"Loaded {pdf_path}")
    print(f"Number of pages: {len(doc)}")
    for i in range(min(5, len(doc))):
        page = doc[i]
        text = page.get_text().strip()
        print(f"Page {i+1} character count: {len(text)}")
        if text:
            print(f"Snippet: {repr(text[:100])}")
except Exception as e:
    print(f"Error: {e}")
