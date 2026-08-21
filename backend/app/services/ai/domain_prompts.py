"""
Domain-aware prompt templates for multi-topic lesson generation.
Auto-detects domain from topic + context, applies domain-specific style.
"""

import unicodedata
from typing import Literal

DomainType = Literal[
    "tech_programming",
    "science_engineering",
    "business_finance",
    "history_politics_law",
    "arts_culture_language",
    "health_medicine_psychology",
    "general_life_skills",
]

# ─── Domain Definitions ─────────────────────────────────────────────────────

DOMAIN_KEYWORDS = {
    "tech_programming": [
        "lập trình", "programming", "code", "coding", "python", "javascript", "java",
        "react", "vue", "angular", "node", "api", "database", "sql", "nosql",
        "docker", "kubernetes", "aws", "cloud", "devops", "ci/cd", "git",
        "frontend", "backend", "fullstack", "mobile", "android", "ios", "flutter",
        "machine learning", "ai", "deep learning", "tensorflow", "pytorch",
        "algorithm", "data structure", "system design", "microservice",
        "công nghệ", "thuật toán", "cấu trúc dữ liệu", "hệ thống",
    ],
    "science_engineering": [
        "vật lý", "physics", "hóa học", "chemistry", "sinh học", "biology",
        "toán học", "mathematics", "calculus", "linear algebra", "statistics",
        "kỹ thuật", "engineering", "cơ khí", "mechanical", "điện", "electrical",
        "điện tử", "electronics", "robotics", "automation", "control system",
        "material science", "thermodynamics", "quantum", "relativity",
        "khoa học", "kỹ thuật", "thí nghiệm", "công thức", "định luật",
    ],
    "business_finance": [
        "kinh doanh", "business", "doanh nghiệp", "startup", "entrepreneurship",
        "marketing", "sales", "bán hàng", "branding", "quản trị", "management",
        "tài chính", "finance", "đầu tư", "investment", "stock", "chứng khoán",
        "crypto", "bitcoin", "blockchain", "defi", "banking", "ngân hàng",
        "accounting", "kế toán", "tax", "thuế", "valuation", "m&a", "ipo",
        "strategy", "chiến lược", "competitive analysis", "market research",
    ],
    "history_politics_law": [
        "lịch sử", "history", "chiến tranh", "war", "cách mạng", "revolution",
        "chính trị", "politics", "chính sách", "policy", "government", "chính phủ",
        "pháp luật", "law", "legal", "constitution", "hiến pháp", "human rights",
        "international relations", "quan hệ quốc tế", "geopolitics", "địa chính trị",
        "triết học", "philosophy", "ethics", "đạo đức", "logic", "argumentation",
        "lich su", "history", "chien tranh", "war", "cach mang", "revolution",
        "chinh tri", "politics", "chinh sach", "policy", "government", "chinh phu",
        "phap luat", "law", "legal", "constitution", "hien phap", "human rights",
        "quan he quoc te", "geopolitics", "dia chinh tri", "triet hoc", "philosophy",
        "dao duc", "logic", "argumentation",
    ],
"arts_culture_language": [
        "nghệ thuật", "art", "văn học", "literature", "thơ", "poetry", "tiểu thuyết",
        "novel", "văn hóa", "culture", "di sản", "heritage", "bảo tàng", "museum",
        "âm nhạc", "music", "hòa nhạc", "composition", "hát", "singing", "múa",
        "dance", "điện ảnh", "film", "cinema", "photography", "nhiếp ảnh",
        "ngôn ngữ", "language", "tiếng anh", "english", "ielts", "toefl",
        "writing", "viết", "creative writing", "biography", "tiểu sử",
        "nghe thuat", "van hoc", "tho", "tieu thuyet", "van hoa", "di san",
        "bao tang", "am nhac", "hoa nhac", "hat", "mua", "dien anh", "phim",
        "photography", "nhiep anh", "ngon ngu", "tieng anh", "viet", "creative writing",
        "tieu su", "van hoc", "nghe thuat", "am nhac", "hoa nhac",
    ],
    "health_medicine_psychology": [
        "y học", "medicine", "y khoa", "bệnh", "disease", "bệnh viện", "hospital",
        "bác sĩ", "doctor", "dược", "pharmacy", "thuốc", "drug", "vaccine",
        "sức khỏe", "health", "dinh dưỡng", "nutrition", "fitness", "gym",
        "tâm lý", "psychology", "mental health", "stress", "anxiety", "depression",
        "therapy", "trị liệu", "counseling", "mindfulness", "thiền", "yoga",
        "first aid", "cấp cứu", "public health", "dịch tễ học", "epidemiology",
    ],
    "general_life_skills": [
        "kỹ năng", "skill", "soft skill", "communication", "giao tiếp",
        "presentation", "thuyết trình", "public speaking", "negotiation", "đàm phán",
        "time management", "quản trị thời gian", "productivity", "năng suất",
        "personal finance", "tài chính cá nhân", "budgeting", "saving", "tiết kiệm",
        "cooking", "nấu ăn", "recipe", "công thức nấu ăn", "gardening", "trồng trọt",
        "diy", "self-improvement", "cải thiện bản thân", "habit", "thói quen",
        "goal setting", "đặt mục tiêu", "decision making", "ra quyết định",
        "critical thinking", "tư duy phản biện", "problem solving", "giải quyết vấn đề",
    ],
}

# ─── Domain Style Guides ────────────────────────────────────────────────────

DOMAIN_STYLE_GUIDES = {
    "tech_programming": """
PHONG CÁCH: Technical Documentation / Developer Tutorial (MDN, W3Schools, Official Docs)
- Ngôn ngữ: Chính xác, súc tích, thuật ngữ chuẩn ngành
- Cấu trúc: Concept → Syntax/Code → Example → Best Practices → Common Pitfalls
- Bắt buộc có: Code snippets (có syntax highlighting), bảng tham số, workflow diagram
- Tone: Professional, instructional, "show don't just tell"
- Ví dụ: function signatures, config objects, CLI commands, API responses
""",
    "science_engineering": """
PHONG CÁCH: Academic Textbook / Khan Academy / Technical Paper
- Ngôn ngữ: Chính xác khoa học, định nghĩa rõ ràng, đơn vị đo lường chuẩn SI
- Cấu trúc: Theory → Principles/Laws → Derivation/Proof → Applications → Problems
- Bắt buộc có: Công thức (LaTeX), đơn vị, biểu đồ mô tả, ví dụ số thực tế
- Tone: Objective, rigorous, step-by-step logical reasoning
- Ví dụ: Free-body diagrams, circuit schematics, reaction equations, dimensional analysis
""",
    "business_finance": """
PHONG CÁCH: HBR / The Economist / Business Textbook / Case Study Method
- Ngôn ngữ: Professional, data-driven, framework-oriented
- Cấu trúc: Framework/Model → Context/Market → Analysis → Decision Criteria → Implementation
- Bắt buộc có: Biểu đồ/ma trận (SWOT, Porter, BCG), financial models, KPIs, case study thực tế
- Tone: Strategic, analytical, actionable, risk-aware
- Ví dụ: DCF valuation, unit economics, cohort analysis, go-to-market strategy
""",
    "history_politics_law": """
PHONG CÁCH: Academic History / Political Science Textbook / Legal Commentary
- Ngôn ngữ: Objective, evidence-based, nuanced, trích dẫn nguồn
- Cấu trúc: Context → Key Events/Actors → Causality → Multiple Perspectives → Significance
- Bắt buộc có: Timeline, primary sources, conflicting interpretations, legal precedent
- Tone: Balanced, critical thinking, avoids presentism
- Ví dụ: Primary source excerpts, treaty articles, court holdings, historiography debates
""",
    "arts_culture_language": """
PHONG CÁCH: Museum Guide / Literary Criticism / Cultural Encyclopedia
- Ngôn ngữ: Descriptive, interpretive, contextual, vocabulary-rich
- Cấu trúc: Context/Period → Work Analysis → Technique/Style → Influence/Legacy → Comparative
- Bắt buộc có: Visual/formal analysis, historical context, terminology, comparative examples
- Tone: Appreciative but critical, culturally sensitive
- Ví dụ: Formal analysis (color, composition), literary devices, etymology, comparative works
""",
    "health_medicine_psychology": """
PHONG CÁCH: Medical Textbook / Clinical Guideline / Psychoeducation
- Ngôn ngữ: Evidence-based, precise terminology, patient-centered, disclaimer-aware
- Cấu trúc: Pathophysiology/Mechanism → Diagnosis/Criteria → Treatment Options → Monitoring → Prevention
- Bắt buộc có: Diagnostic criteria (DSM/ICD), treatment algorithms, dosage, contraindications, red flags
- Tone: Empathetic, authoritative but accessible, safety-first
- Ví dụ: Diagnostic flowcharts, medication tables, CBT thought records, screening tools
""",
    "general_life_skills": """
PHONG CÁCH: Practical Guide / How-To / Self-Help Bestseller (Atomic Habits, Deep Work style)
- Ngôn ngữ: Actionable, relatable, encouraging, jargon-free
- Cấu trúc: Why it matters → Core Principle → Step-by-Step → Common Obstacles → Practice Exercise
- Bắt buộc có: Checklist, template, 30-day challenge, reflection prompts, habit tracker
- Tone: Encouraging, practical, "start small", habit-focused
- Ví dụ: Morning routine template, negotiation script, budget spreadsheet, habit tracker
""",
}

# ─── Common Lesson Structure (All Domains) ──────────────────────────────────

COMMON_LESSON_STRUCTURE = """
==================================================
CẤU TRÚC BÀI HỌC BẮT BUỘC (Độ dài: 1.500 - 3.000 từ)
==================================================

[MINDMAP_NODE: id="root" | label="[Tên Bài Học]" | parent_id="" | type="main"]
# [Tên Bài Học]

---

## 1. 🎯 Tổng quan & Mục tiêu học tập
[MINDMAP_NODE: id="sec_1" | label="Tổng quan & Mục tiêu" | parent_id="root" | type="main"]

- **Câu hỏi cốt lõi:** Bài học này giải quyết vấn đề gì? Tại sao quan trọng?
- **Kết quả học tập:** Sau bài này, người học sẽ làm được gì? (Bloom's taxonomy)
- **Điều kiện tiên quyết:** Kiến thức/công cụ cần có trước khi bắt đầu.

[MINDMAP_NODE: id="sec_1_objectives" | label="Kết quả học tập" | parent_id="sec_1" | type="sub"]

---

## 2. 📚 Kiến thức nền tảng & Khái niệm cốt lõi
[MINDMAP_NODE: id="sec_2" | label="Kiến thức nền tảng" | parent_id="root" | type="main"]

- **Định nghĩa & Bản chất:** Giải thích chính xác các khái niệm then chốt.
- **Nguyên lý/Cơ chế:** Giải thích "tại sao" và "như thế nào" (first principles).
- **Sơ đồ/Mô hình:** Biểu diễn trực quan (bản đồ tư duy, flowchart, mô hình khái niệm).
[MINDMAP_NODE: id="sec_2_concepts" | label="Các khái niệm then chốt" | parent_id="sec_2" | type="sub"]

---

## 3. 🛠️ Quy trình / Phương pháp / Framework cốt lõi
[MINDMAP_NODE: id="sec_3" | label="Quy trình & Framework" | parent_id="root" | type="main"]

- **Quy trình từng bước (Step-by-step):** 1 → 2 → 3... có checkpoint.
- **Framework/Model áp dụng:** (nếu có) ví dụ: PDCA, SMART, FIRST, DRY, SOLID, v.v.
- **Bảng tham số/Quy tắc quyết định:** (nếu có) ngưỡng, ngân sách, ngưỡng rủi ro.
[MINDMAP_NODE: id="sec_3_steps" | label="Các bước thực hiện" | parent_id="sec_3" | type="sub"]

---

## 4. 💡 Ví dụ minh họa / Case Study thực tế
[MINDMAP_NODE: id="sec_4" | label="Ví dụ thực tế" | parent_id="root" | type="main"]

- **Bối cảnh:** Mô tả tình huống thực tế, ràng buộc, mục tiêu.
- **Áp dụng:** Cách dùng kiến thức/framework ở trên để giải quyết.
- **Kết quả & Phân tích:** Đầu ra là gì? Tại sao thành công/thất bại? Lesson learned.
[MINDMAP_NODE: id="sec_4_case" | label="Phân tích Case Study" | parent_id="sec_4" | type="sub"]

---

## 5. ⚠️ Sai lầm thường gặp & Best Practices
[MINDMAP_NODE: id="sec_5" | label="Sai lầm & Best Practices" | parent_id="root" | type="main"]

- **3-5 Sai lầm phổ biến:** Mô tả sai lầm → Nguyên nhân → Cách khắc phục.
[MINDMAP_NODE: id="sec_5_pitfalls" | label="Sai lầm thường gặp" | parent_id="sec_5" | type="sub"]
- **Best Practices / Quy chuẩn:** Checklist, quy tắc vàng, tips từ chuyên gia.
[MINDMAP_NODE: id="sec_5_best" | label="Best Practices" | parent_id="sec_5" | type="sub"]

---

## 6. 🧪 Bài tập thực hành & Tự đánh giá
[MINDMAP_NODE: id="sec_6" | label="Bài tập thực hành" | parent_id="root" | type="main"]

- **Bài tập 1 (Áp dụng cơ bản):** Yêu cầu cụ thể + Output kỳ vọng + Gợi ý giải.
[MINDMAP_NODE: id="sec_6_basic" | label="Bài tập cơ bản" | parent_id="sec_6" | type="sub"]
- **Bài tập 2 (Mở rộng/Tư duy phản biện):** Open-ended, what-if, design challenge.
[MINDMAP_NODE: id="sec_6_advanced" | label="Bài tập nâng cao" | parent_id="sec_6" | type="sub"]
- **Tự đánh giá:** 3-5 câu hỏi kiểm tra hiểu biết (multiple choice / short answer).

---

YÊU CẦU CHUNG:
- Trả về Markdown thuần, KHÔNG bao bọc trong code block.
- Giữ nguyên các thẻ [MINDMAP_NODE:...] đúng vị trí.
- Độ dài: 1.500 - 3.000 từ.
- Ngôn ngữ: Tiếng Việt (hoặc ngôn ngữ của topic).
- KHÔNG thêm lời dẫn/mô tả ngoài nội dung bài học.
"""

# ─── Helper Functions ───────────────────────────────────────────────────────


import unicodedata

def _normalize_text(text: str) -> str:
    """Remove diacritics and normalize for keyword matching."""
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return text.lower()


def detect_domain(topic: str, context: str = "") -> DomainType:
    """
    Auto-detect domain from topic + tavily context using keyword matching.
    Returns the domain with highest keyword match score.
    """
    # Normalize both topic and context (remove diacritics)
    normalized_topic = _normalize_text(topic)
    normalized_context = _normalize_text(context)
    text = f"{normalized_topic} {normalized_context}"
    
    # Also normalize keywords for matching
    scores = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = sum(1 for kw in keywords if _normalize_text(kw) in text)
        scores[domain] = score
    
    if not scores or max(scores.values()) == 0:
        return "general_life_skills"
    
    return max(scores, key=scores.get)


def get_domain_style_guide(domain: DomainType) -> str:
    """Get the domain-specific style guide."""
    return DOMAIN_STYLE_GUIDES.get(domain, DOMAIN_STYLE_GUIDES["general_life_skills"])


def build_lesson_prompt(
    topic: str,
    lesson_title: str,
    lesson_summary: str,
    tavily_context: str,
    domain: DomainType = None,
) -> str:
    """
    Build the complete prompt for generating a single lesson.
    Auto-detects domain if not provided.
    """
    if domain is None:
        domain = detect_domain(topic, tavily_context)
    
    style_guide = get_domain_style_guide(domain)
    
    prompt = f"""
{style_guide}

{COMMON_LESSON_STRUCTURE}

---
THÔNG TIN BÀI HỌC CẦN VIẾT:
- Chủ đề tổng thể: {topic}
- Tên bài học: {lesson_title}
- Mục tiêu tóm tắt: {lesson_summary}

NGỮ CẢNH THAM KHẢO (Tavily):
{tavily_context}

---
HÃY SOẠN THẢO BÀI HỌC THEO ĐÚNG CẤU TRÚC VÀ PHONG CÁCH TRÊN.
"""
    return prompt


def build_outline_prompt(topic: str, tavily_context: str) -> str:
    """Build prompt for generating course outline (domain-agnostic)."""
    return f"""
Bạn là Kiến trúc sư Chương trình Giảng dạy (Curriculum Architect).
Dựa trên thông tin ngữ cảnh thu thập, hãy thiết kế một Cây Lộ Trình Học Tập 
từ cơ bản đến nâng cao cho chủ đề được yêu cầu.

YÊU CẦU:
1. Tạo danh sách BẮT BUỘC từ 10 đến 12 Bài học theo thứ tự logic.
2. Mỗi bài học có title rõ ràng, summary 1-2 câu.
3. Trả về đúng định dạng JSON:
{{
  "folder_name": "Tên Lộ trình Học tập Toàn diện",
  "lessons": [
    {{"title": "Bài 1: [Tên bài học]", "summary": "Tóm tắt 1-2 câu..."}},
    {{"title": "Bài 2: [Tên bài học]", "summary": "Tóm tắt 1-2 câu..."}}
  ]
}}

Chủ đề: {topic}
Ngữ cảnh Tavily:
{tavily_context}
"""

# ─── Revise / Follow-up Prompt (Domain-Aware) ───────────────────────────────

def build_revise_prompt(
    topic: str,
    folder_name: str,
    user_query: str,
    relevant_docs: list[dict],
    domain: DomainType = None,
) -> str:
    """Build prompt for follow-up / revision requests."""
    if domain is None:
        domain = detect_domain(topic, " ".join(d.get("excerpt", "") for d in relevant_docs))
    
    style_guide = get_domain_style_guide(domain)
    
    doc_block = "\n\n".join(
        f"--- FILE: {d['title']} (file_id: {d['file_id']}) ---\n{d['excerpt']}"
        for d in relevant_docs
    )
    
    return f"""
{style_guide}

Bạn là Trợ lý AI Biên tập Tài liệu Học tập.
Người dùng đưa ra yêu cầu tiếp theo HOẶC yêu cầu CHỈNH SỬA nội dung cũ trong folder tài liệu hiện có.

Folder: {folder_name}
Chủ đề: {topic}
Yêu cầu của người dùng: {user_query}

Tài liệu tìm thấy trong folder:
{doc_block}

Hãy xử lý và trả về JSON duy nhất:

1. Nếu người dùng HỎI CÂU HỎI (giải thích, làm rõ, tóm tắt, hỏi thêm kiến thức liên quan):
   {{"action": "answer", "text": "Câu trả lời chi tiết, dựa trên tài liệu trong folder"}}

2. Nếu người dùng yêu cầu CHỈNH SỬA / VIẾT LẠI / BỔ SUNG nội dung bài học cụ thể:
   - Chọn file_id khớp nhất.
   - Trả về TOÀN BỘ nội dung markdown MỚI của bài học (giữ cấu trúc, đã cải thiện theo yêu cầu).
   {{"action": "edit", "file_id": "<file_id>", "title": "<tiêu đề>", "content": "<TOÀN BỘ markdown mới>"}}

3. Nếu yêu cầu tạo nội dung MỚI không thuộc bài nào:
   {{"action": "edit", "file_id": "new", "title": "<tiêu đề mới>", "content": "<markdown mới>"}}

YÊU CẦU:
- LUÔN trả về JSON hợp lệ, không văn bản ngoài JSON.
- Với action "edit": content phải là TOÀN BỘ bài học mới, không phải đoạn vởn vẹn.
"""


# ─── Summarize Prompt (Domain-Aware) ────────────────────────────────────────

def build_summarize_prompt(content: str, domain: DomainType = None) -> str:
    if domain is None:
        domain = detect_domain(content)
    
    style_guide = get_domain_style_guide(domain)
    
    return f"""
{style_guide}

Bạn là Trợ lý AI Tóm tắt Tài liệu Học tập.
Hãy tóm tắt nội dung bài học sau theo cấu trúc:

1. **Tổng quan** (2-3 câu): Bài học này về gì?
2. **Các ý chính** (bullet points): Ngắn gọn, từ khóa chuyên ngành.
3. **Kiến thức quan trọng cần nhớ** (tối đa 5 gạch đầu dòng).
4. **Bài tập thực hành gợi ý** (1-2 ý ngắn, nếu có ví dụ/code thì bám theo).

YÊU CẦU:
- Trả về Markdown (heading ## cho từng mục).
- Không lặp lại nguyên văn.
- Độ dài tối đa ~500 từ.
- Ngôn ngữ: Tiếng Việt (hoặc ngôn ngữ của tài liệu gốc).

NỘI DUNG CẦN TÓM TẮT:
{content}
"""


# ─── Export ─────────────────────────────────────────────────────────────────

__all__ = [
    "DomainType",
    "detect_domain",
    "get_domain_style_guide",
    "build_lesson_prompt",
    "build_outline_prompt",
    "build_revise_prompt",
    "build_summarize_prompt",
    "COMMON_LESSON_STRUCTURE",
    "DOMAIN_STYLE_GUIDES",
    "DOMAIN_KEYWORDS",
]