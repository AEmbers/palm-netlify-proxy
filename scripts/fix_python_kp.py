#!/usr/bin/env python3
"""Fix: extract MIT Python 6 knowledge points and add to the quiz data."""

import re
import json
import html as html_mod

HTML_FILE = "/workspace/学习中心-完整版.html"

with open(HTML_FILE, "r", encoding="utf-8") as f:
    html = f.read()

# Find MIT Python 6 course page
python_match = re.search(
    r'<div class="course-page" id="page-mit-python-6">(.*?)(?=<div class="course-page" id="page-|<script>\s*/\* =====)',
    html, re.DOTALL
)

if not python_match:
    print("ERROR: MIT Python 6 page not found")
    exit(1)

python_html = python_match.group(1)
python_lessons = []

# Split by lesson-header
lesson_splits = re.split(r'(?=<div class="lesson-header">)', python_html)

for section in lesson_splits[1:]:
    # The h3 may contain nested spans
    lesson_match = re.search(
        r'<div class="lesson-header"><h3>(.*?)</h3><span class="count">(\d+)',
        section, re.DOTALL
    )
    if lesson_match:
        raw_title = lesson_match.group(1)
        lesson_title = re.sub(r'<[^>]+>', '', raw_title).strip()
        
        next_lesson = section.find('<div class="lesson-header">', 10)
        if next_lesson > 0:
            section = section[:next_lesson]
        
        kp_list = []
        for li_match in re.finditer(r'<li>(.*?)(?=</li>)', section, re.DOTALL):
            kp_html_content = li_match.group(1)
            tag_match = re.search(r'tag-(\w+)">([^<]+)</span>', kp_html_content)
            kp_text = re.sub(r'<[^>]+>', '', kp_html_content).strip()
            kp_text = html_mod.unescape(kp_text)
            if kp_text and len(kp_text) > 5:
                kp_list.append({
                    'text': kp_text,
                    'tag': tag_match.group(1) if tag_match else 'concept',
                    'tag_label': tag_match.group(2) if tag_match else '概念'
                })
        
        if kp_list:
            python_lessons.append({
                'title': lesson_title,
                'kp_count': len(kp_list),
                'knowledge_points': kp_list
            })

if python_lessons:
    total_kp = sum(len(l['knowledge_points']) for l in python_lessons)
    print(f"MIT Python 6: {len(python_lessons)} lessons, {total_kp} kp")
    for l in python_lessons[:3]:
        print(f"  {l['title']}: {len(l['knowledge_points'])} kp")
    
    # Now update the injected quiz data
    # Read current JS injection
    data_match = re.search(r'window\.__QUIZ_KP_DATA__\s*=\s*(\[.*?\]);\s*</script>', html, re.DOTALL)
    if data_match:
        kp_data = json.loads(data_match.group(1))
        
        # Check if Python already there
        python_exists = any(c['id'] == 'mit-python-6' for c in kp_data)
        if python_exists:
            # Remove old entry
            kp_data = [c for c in kp_data if c['id'] != 'mit-python-6']
        
        kp_data.append({
            'id': 'mit-python-6',
            'title': 'MIT 6.0001 / 6.0002 Python 计算机科学',
            'total_kp': total_kp,
            'lessons': python_lessons,
            'extracted_kp': total_kp
        })
        
        new_kp_json = json.dumps(kp_data, ensure_ascii=False)
        html = html[:data_match.start(1)] + new_kp_json + html[data_match.end(1):]
        
        with open(HTML_FILE, "w", encoding="utf-8") as f:
            f.write(html)
        
        print(f"\n✓ Updated! Now {len(kp_data)} courses, {sum(c['extracted_kp'] for c in kp_data)} total kp")
        print(f"  File size: {len(html)} bytes ({len(html)/1024:.0f} KB)")
    else:
        print("ERROR: Could not find quiz data in HTML")
else:
    print("ERROR: No Python lessons found")
