#!/usr/bin/env python3
"""
Inject the quiz system JS and knowledge point data into the learning center HTML.
"""

import json

HTML_FILE = "/workspace/学习中心-完整版.html"
JS_FILE = "/data/user/work/quiz-system.js"
KP_DATA_FILE = "/data/user/work/quiz_kp_data.json"

# Read files
with open(HTML_FILE, "r", encoding="utf-8") as f:
    html = f.read()

with open(JS_FILE, "r", encoding="utf-8") as f:
    js_code = f.read()

with open(KP_DATA_FILE, "r", encoding="utf-8") as f:
    kp_data = json.load(f)

# Also extract MIT Python 6 knowledge points from its course page
# (it wasn't captured in the JSON because it has a different HTML structure)
import re
import html as html_mod

python_course_match = re.search(
    r'<div class="course-page" id="page-mit-python-6">(.*?)(?=<div class="course-page" id="page-|<script>)',
    html, re.DOTALL
)

if python_course_match:
    python_html = python_course_match.group(1)
    python_lessons = []
    
    # MIT Python uses lesson-header pattern
    lesson_splits = re.split(r'(?=<div class="lesson-header">)', python_html)
    
    for section in lesson_splits[1:]:
        lesson_match = re.search(r'<div class="lesson-header"><h3>([^<]+)</h3><span class="count">(\d+)', section)
        if lesson_match:
            lesson_title = lesson_match.group(1).strip()
            
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
        kp_data.append({
            'id': 'mit-python-6',
            'title': 'MIT 6.0001 / 6.0002 Python 计算机科学',
            'total_kp': total_kp,
            'lessons': python_lessons,
            'extracted_kp': total_kp
        })
        print(f"Added MIT Python 6: {len(python_lessons)} lessons, {total_kp} kp")

# Prepare the injection
kp_json = json.dumps(kp_data, ensure_ascii=False)

# The JS code expects data in window.__QUIZ_KP_DATA__
injection = f'''
<!-- 测验系统 -->
<script>
window.__QUIZ_KP_DATA__ = {kp_json};
</script>
<script>
{js_code}
</script>
'''

# Find insertion point: before </body>
body_end = html.rfind('</body>')
if body_end == -1:
    print("ERROR: Could not find </body>")
    exit(1)

# Check if quiz system already injected
if 'quiz-system' in html or '__QUIZ_KP_DATA__' in html:
    print("Quiz system already injected, replacing...")
    # Remove old injection
    old_pattern = r'<!-- 测验系统 -->.*?<script>\s*window\.__QUIZ_KP_DATA__.*?</script>\s*<script>.*?</script>'
    html = re.sub(old_pattern, '', html, flags=re.DOTALL)

# Re-find body end after potential removal
body_end = html.rfind('</body>')
html = html[:body_end] + injection + '\n' + html[body_end:]

# Save
with open(HTML_FILE, "w", encoding="utf-8") as f:
    f.write(html)

print(f"✓ Quiz system injected!")
print(f"  File size: {len(html)} bytes ({len(html)/1024:.0f} KB)")
print(f"  Courses: {len(kp_data)}")
print(f"  Total KP: {sum(c['extracted_kp'] for c in kp_data)}")
