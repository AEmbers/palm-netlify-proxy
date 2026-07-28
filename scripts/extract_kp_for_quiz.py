#!/usr/bin/env python3
"""
Extract all knowledge points from the learning center HTML,
then generate a quiz system with question bank, adaptive algorithm,
statistics, ratings, and animation effects.
"""

import re
import json
import html as html_mod

INPUT_FILE = "/workspace/学习中心-完整版.html"

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# ===== STEP 1: Extract knowledge points from all courses =====

# Find all course pages
course_pattern = re.compile(
    r'<div class="course-page" id="page-([^"]+)">(.*?)(?=<div class="course-page" id="page-|<script>\s*/\* =====)',
    re.DOTALL
)

# Knowledge point patterns for different course formats
# Format 1: <li>text<span class="tag tag-XXX">YYY</span></li>
# Format 2: <div class="point-text">text</div> (with cat-icon)
# Format 3: <span class="kp-text">text</span>

all_courses = []

for m in course_pattern.finditer(content):
    course_id = m.group(1)
    course_html = m.group(2)
    
    # Get course title
    title_match = re.search(r'<h1>(.*?)</h1>', course_html[:2000])
    title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else course_id
    
    # Get hero stats
    total_kp = 0
    for sm in re.finditer(r'<div class="stat"><b>(\d+)</b><span>([^<]+)</span></div>', course_html[:3000]):
        if '知识点' in sm.group(2):
            total_kp = int(sm.group(1).replace(',', ''))
    
    # Extract lessons/chapters with their knowledge points
    lessons = []
    
    # Pattern 1: lesson-header + <li> tags (live-ops, mit-14-01, mit-python)
    lesson_splits = re.split(r'(?=<div class="lesson-header">)', course_html)
    
    for section in lesson_splits[1:]:
        # Get lesson title
        lesson_match = re.search(r'<div class="lesson-header"><h3>([^<]+)</h3><span class="count">(\d+)', section)
        if lesson_match:
            lesson_title = lesson_match.group(1).strip()
            lesson_kp_count = int(lesson_match.group(2))
            
            # Extract knowledge points from <li> tags
            # Stop at next lesson-header or chapter end
            next_lesson = section.find('<div class="lesson-header">', 10)
            if next_lesson > 0:
                section = section[:next_lesson]
            
            kp_list = []
            for li_match in re.finditer(r'<li>(.*?)(?=</li>)', section, re.DOTALL):
                kp_html = li_match.group(1)
                # Extract tag
                tag_match = re.search(r'tag-(\w+)">([^<]+)</span>', kp_html)
                tag_class = tag_match.group(1) if tag_match else 'concept'
                tag_label = tag_match.group(2) if tag_match else '概念'
                
                # Clean text
                kp_text = re.sub(r'<[^>]+>', '', kp_html).strip()
                kp_text = html_mod.unescape(kp_text)
                
                if kp_text and len(kp_text) > 5:
                    kp_list.append({
                        'text': kp_text,
                        'tag': tag_class,
                        'tag_label': tag_label
                    })
            
            if kp_list:
                lessons.append({
                    'title': lesson_title,
                    'kp_count': lesson_kp_count,
                    'knowledge_points': kp_list
                })
    
    # Pattern 2: lecture-group / lecture-section (data-analysis, micro-theory, etc.)
    if not lessons:
        lec_splits = re.split(r'(?=<section class="lecture)', course_html)
        
        for section in lec_splits[1:]:
            # Try different header patterns
            lec_match = re.search(
                r'<span class="(?:lecture-num|lec-badge)">([^<]+)</span>\s*<h2[^>]*>([^<]+)</h2>\s*<span class="(?:lecture-meta|lec-count)">(\d+)',
                section
            )
            
            if not lec_match:
                lec_match = re.search(
                    r'<span class="lec-badge">([^<]+)</span>\s*<h2[^>]*>([^<]+)</h2>\s*<span class="lec-count"[^>]*>(\d+)',
                    section
                )
            
            if not lec_match:
                # Try lecture-header without lec-badge
                lec_match = re.search(
                    r'<h2[^>]*>([^<]+)</h2>\s*<span class="lecture-meta">(\d+)\s*个知识点',
                    section
                )
                if lec_match:
                    lec_match = type('M', (), {'group': (1, lec_match.group(1), lec_match.group(2))})()
            
            if lec_match:
                lesson_title = f"{lec_match.group(1)} {lec_match.group(2)}".strip()
                lesson_kp_count = int(lec_match.group(3))
                
                # Extract knowledge points - pattern: point-card or kp-text or li
                kp_list = []
                
                # Try point-text
                for pt_match in re.finditer(r'<span class="point-text">(.*?)</span>', section, re.DOTALL):
                    kp_text = re.sub(r'<[^>]+>', '', pt_match.group(1)).strip()
                    kp_text = html_mod.unescape(kp_text)
                    if kp_text and len(kp_text) > 5:
                        # Try to find category
                        cat_match = re.search(r'cat-icon-(\w+)', section[:section.find(pt_match.group(0))+100] if pt_match.group(0) in section else '')
                        kp_list.append({
                            'text': kp_text,
                            'tag': cat_match.group(1) if cat_match else 'concept',
                            'tag_label': '概念'
                        })
                
                # Try kp-text
                if not kp_list:
                    for pt_match in re.finditer(r'<span class="kp-text">(.*?)</span>', section, re.DOTALL):
                        kp_text = re.sub(r'<[^>]+>', '', pt_match.group(1)).strip()
                        kp_text = html_mod.unescape(kp_text)
                        if kp_text and len(kp_text) > 5:
                            kp_list.append({
                                'text': kp_text,
                                'tag': 'concept',
                                'tag_label': '概念'
                            })
                
                # Try regular <li>
                if not kp_list:
                    for li_match in re.finditer(r'<li[^>]*>(.*?)(?=</li>)', section, re.DOTALL):
                        kp_html = li_match.group(1)
                        tag_match = re.search(r'tag-(\w+)">([^<]+)</span>', kp_html)
                        kp_text = re.sub(r'<[^>]+>', '', kp_html).strip()
                        kp_text = html_mod.unescape(kp_text)
                        if kp_text and len(kp_text) > 5:
                            kp_list.append({
                                'text': kp_text,
                                'tag': tag_match.group(1) if tag_match else 'concept',
                                'tag_label': tag_match.group(2) if tag_match else '概念'
                            })
                
                if kp_list:
                    lessons.append({
                        'title': lesson_title,
                        'kp_count': lesson_kp_count,
                        'knowledge_points': kp_list
                    })
    
    if lessons:
        total_extracted = sum(len(l['knowledge_points']) for l in lessons)
        all_courses.append({
            'id': course_id,
            'title': title,
            'total_kp': total_kp,
            'lessons': lessons,
            'extracted_kp': total_extracted
        })
        print(f"  {course_id}: {len(lessons)} lessons, {total_extracted} kp extracted (expected {total_kp})")

# Save extracted data
with open('/data/user/work/quiz_kp_data.json', 'w', encoding='utf-8') as f:
    json.dump(all_courses, f, ensure_ascii=False, indent=2)

print(f"\nTotal: {len(all_courses)} courses, {sum(c['extracted_kp'] for c in all_courses)} knowledge points")
