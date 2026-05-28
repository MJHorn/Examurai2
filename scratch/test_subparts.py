import fitz, re

doc = fitz.open("C:\\Users\\MHR\\Downloads\\2025-SpecialistMaths2-report.pdf")
full_text = ""
for i, page in enumerate(doc):
    full_text += f"\n--- PAGE {i+1} ---\n" + page.get_text()

# Find subparts
pattern = re.compile(r'Question\s+(\d+)([a-z](?:\.[a-z0-9.]+)?)\b', re.IGNORECASE)
matches = list(pattern.finditer(full_text))

for idx, m in enumerate(matches):
    q_num = int(m.group(1))
    part = m.group(2)
    start_pos = m.end()
    end_pos = matches[idx+1].start() if idx+1 < len(matches) else len(full_text)
    
    sub_text = full_text[start_pos:end_pos]
    
    # Extract marks scale between Mark and Average
    mark_match = re.search(r'Mark\s+(.*?)\s+Average', sub_text, re.DOTALL | re.IGNORECASE)
    if mark_match:
        marks_scale = [int(x) for x in re.findall(r'\b\d+\b', mark_match.group(1))]
        if marks_scale:
            max_mark = marks_scale[-1]
            
            # Find all numbers after 'Average'
            avg_text = sub_text[sub_text.find('Average'):]
            numbers = [float(x) for x in re.findall(r'\b\d+\.\d+|\b\d+\b', avg_text)]
            if len(numbers) >= max_mark + 2:
                # The first M+1 numbers are percentages, the last one is the average
                percentages = numbers[:max_mark+1]
                average = numbers[max_mark+1]
                print(f"Q{q_num}{part}: Max Mark: {max_mark}, Average: {average}, Percentages: {percentages}")
