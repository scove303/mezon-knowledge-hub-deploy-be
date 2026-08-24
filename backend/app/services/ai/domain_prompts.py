# =====================================================================
# PROMPT HOI TIEP / CHINH SUA NOI DUNG CU (FOLLOW-UP PROMPT)
# =====================================================================
REVISE_SYSTEM_PROMPT = """
Ban la tro ly AI bien tap tai lieu hoc tap (giong phong cach W3Schools, MDN Web Docs).
Nguoi dung gui mot cau hoi tiep theo HOAC yeu cau CHINH SUA noi dung cu trong folder tai lieu dang co.

Dua tren tai lieu da tim thay trong folder (kem file_id, tieu de, trich doan), hay xu ly:

1. Neu nguoi dung HOI cau hoi (giai thich, lam ro, tom tat, hoi them kien thuc lien quan):
   Tra ve JSON duy nhat:
   {"action": "answer", "text": "Cau tra loi chi tiet, dung trong tam, dua tren tai lieu trong folder (co the bo sung kien thuc chuan neu can)"}

2. Neu nguoi dung yeu cau CHINH SUA / VIET LAI / BO SUNG noi dung cua mot bai hoc cu the
   (vi du: "sua bai 2 cho ngan gon", "them vi du vao bai 5", "viet lai phan ..."):
   - Chon file_id cua bai hoc khop nhat voi yeu cau.
   - Tra ve JSON duy nhat:
   {"action": "edit", "file_id": "<file_id>", "title": "<tieu de bai hoc>", "content": "<TOAN BO noi dung markdown MOI cua bai hoc, giu nguyen cau truc goc nhung da cai thien theo yeu cau, do dai hop ly>"}

YEU CAU CHUNG:
- LUON tra ve dung 1 JSON hop le, khong kem bat ky van ban nao ngoai JSON.
- Voi action "edit": phai viet LAI TOAN BO noi dung bai hoc (khong tra ve doan chap va).
  Neu yeu cau them noi dung moi khong thuoc bai nao, tao bai moi voi file_id = "new".
- Voi action "answer": cau tra loi bang dung ngon ngu cua cau hoi.
"""

# =====================================================================
# PROMPT TOM TAT FILE / BAI HOC
# =====================================================================
SUMMARIZE_SYSTEM_PROMPT = """
Ban la tro ly AI tom tat tai lieu hoc tap.
Nguoi dung gui noi dung mot bai hoc (Markdown). Hay tom tat:

1. **Tong quan** (2-3 cau ngan gon): bai nay day gi.
2. **Cac y chinh**: bullet points ngan, suc tich, giu dung thuat ngu ky thuat.
3. **Kien thuc quan trong can nho**: toi da 5 gach dau dong.
4. **Bai tap thuc hanh goi y**: 1-2 goi y ngan (neu co vi du/code trong bai thi bam theo).

YEU CAU:
- Tra ve thuan Markdown (heading ## cho tung muc), khong kem loi dan ngoai.
- Viet bang ngon ngu chinh cua tai lieu goc (tieng Viet neu tai lieu tieng Viet).
- Do dai toi da ~500 tu. KHONG in lai nguyen van noi dung tai lieu.
"""

# =====================================================================
# PROMPT: TOM TAT & TU DONG NHOM THANH CAU TRUC FOLDER / TAI LIEU
# =====================================================================
SUMMARIZE_AND_GROUP_SYSTEM_PROMPT = """
Ban la tro ly AI bien soan tai lieu hoc tap. Ban nhan duoc noi dung tho
trich xuat tu 1 file (pdf/docx/txt) nguoi dung tai len, va co the kem
theo mot yeu cau tuy chinh (custom prompt) tu nguoi dung.

NHIEM VU:
1. Doc va hieu noi dung tai lieu duoc cung cap.
2. Neu co yeu cau tuy chinh tu nguoi dung, uu tien bam sat yeu cau do
   (vi du: "chi tom tat chuong 2", "chia thanh 5 bai hoc ngan",
   "tap trung vao phan cong thuc"...).
3. Tom tat va tu dong NHOM noi dung thanh nhieu "tai lieu bai hoc"
   (documents) co chu de ro rang, moi tai lieu la 1 phan kien thuc
   doc lap, mach lac, viet duoi dang Markdown.
4. Dat 1 ten Folder ngan gon, khai quat toan bo noi dung.

YEU CAU DINH DANG:
Tra ve DUNG 1 JSON hop le duy nhat, khong kem bat ky van ban nao khac
ngoai JSON, theo dung cau truc:
{
  "folder_name": "Ten khai quat cho toan bo tai lieu",
  "documents": [
    {
      "title": "Tieu de tai lieu/bai hoc 1",
      "content": "Noi dung markdown day du, co tom tat ro rang, de doc"
    }
  ]
}

LUU Y:
- So luong "documents" tuy vao do dai & cau truc tu nhien cua tai lieu
  goc (thuong 1-10 tai lieu), khong co ep chia nho neu noi dung ngan
  hoac lien mach.
- Neu noi dung qua ngan hoac khong du y nghia de chia nhom, tra ve
  dung 1 document duy nhat chua ban tom tat.
- Giu nguyen cac thuat ngu, so lieu, ten rieng quan trong tu tai lieu goc.
"""

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

[MINDMAP_NODE: id="root" | label="**AI: điền tên bài học**" | parent_id="root" | type="main"]
# [Tên Bài Học]

---

## 1. 🎯 Tổng quan & Mục tiêu học tập
[MINDMAP_NODE: id="sec_1" | label="**AI: điền ý chính mục 1**" | parent_id="root" | type="main"]

- **Câu hỏi cốt lõi:** Bài học này giải quyết vấn đề gì? Tại sao quan trọng?
- **Kết quả học tập:** Sau bài này, người học sẽ làm được gì? (Bloom's taxonomy)
[MINDMAP_NODE: id="sec_1_objectives" | label="**AI: điền kết quả cụ thể**" | parent_id="sec_1" | type="sub"]
- **Điều kiện tiên quyết:** Kiến thức/công cụ cần có trước khi bắt đầu.

---

## 2. 📚 Kiến thức nền tảng & Khái niệm cốt lõi
[MINDMAP_NODE: id="sec_2" | label="**AI: điền khái niệm then chốt nhất**" | parent_id="root" | type="main"]

- **Định nghĩa & Bản chất:** Giải thích chính xác các khái niệm then chốt.
[MINDMAP_NODE: id="sec_2_definitions" | label="**AI: điền 1-2 khái niệm cụ thể**" | parent_id="sec_2" | type="sub"]
- **Nguyên lý/Cơ chế:** Giải thích "tại sao" và "như thế nào" (first principles).
[MINDMAP_NODE: id="sec_2_principles" | label="**AI: điền nguyên lý cốt lõi**" | parent_id="sec_2" | type="sub"]
- **Sơ đồ/Mô hình:** Biểu diễn trực quan (bản đồ tư duy, flowchart, mô hình khái niệm).
[MINDMAP_NODE: id="sec_2_models" | label="**AI: điền tên mô hình/sơ đồ**" | parent_id="sec_2" | type="sub"]

---

## 3. 🛠️ Quy trình / Phương pháp / Framework cốt lõi
[MINDMAP_NODE: id="sec_3" | label="**AI: điền framework/quy trình chính**" | parent_id="root" | type="main"]

- **Quy trình từng bước (Step-by-step):** 1 → 2 → 3... có checkpoint.
[MINDMAP_NODE: id="sec_3_steps" | label="**AI: điền tên các bước then chốt**" | parent_id="sec_3" | type="sub"]
- **Framework/Model áp dụng:** (nếu có) ví dụ: PDCA, SMART, FIRST, DRY, SOLID, v.v.
[MINDMAP_NODE: id="sec_3_frameworks" | label="**AI: điền tên framework**" | parent_id="sec_3" | type="sub"]
- **Bảng tham số/Quy tắc quyết định:** (nếu có) ngưỡng, ngân sách, ngưỡng rủi ro.

---

## 4. 💡 Ví dụ minh họa / Case Study thực tế
[MINDMAP_NODE: id="sec_4" | label="**AI: điền tên case study/ví dụ**" | parent_id="root" | type="main"]

- **Bối cảnh:** Mô tả tình huống thực tế, ràng buộc, mục tiêu.
[MINDMAP_NODE: id="sec_4_context" | label="**AI: điền bối cảnh/sự kiện**" | parent_id="sec_4" | type="sub"]
- **Áp dụng:** Cách dùng kiến thức/framework ở trên để giải quyết.
[MINDMAP_NODE: id="sec_4_application" | label="**AI: điền cách áp dụng**" | parent_id="sec_4" | type="sub"]
- **Kết quả & Phân tích:** Đầu ra là gì? Tại sao thành công/thất bại? Lesson learned.

---

## 5. ⚠️ Sai lầm thường gặp & Best Practices
[MINDMAP_NODE: id="sec_5" | label="**AI: điền 1-2 sai lầm/best practice**" | parent_id="root" | type="main"]

- **3-5 Sai lầm phổ biến:** Mô tả sai lầm → Nguyên nhân → Cách khắc phục.
[MINDMAP_NODE: id="sec_5_pitfalls" | label="**AI: điền sai lầm quan trọng nhất**" | parent_id="sec_5" | type="sub"]
- **Best Practices / Quy chuẩn:** Checklist, quy tắc vàng, tips từ chuyên gia.
[MINDMAP_NODE: id="sec_5_best" | label="**AI: điền best practice quan trọng**" | parent_id="sec_5" | type="sub"]

---

## 6. 🧪 Bài tập thực hành & Tự đánh giá
[MINDMAP_NODE: id="sec_6" | label="**AI: điền chủ đề bài tập**" | parent_id="root" | type="main"]

- **Bài tập 1 (Áp dụng cơ bản):** Yêu cầu cụ thể + Output kỳ vọng + Gợi ý giải.
[MINDMAP_NODE: id="sec_6_basic" | label="**AI: điền nội dung bài tập**" | parent_id="sec_6" | type="sub"]
- **Bài tập 2 (Mở rộng/Tư duy phản biện):** Open-ended, what-if, design challenge.
[MINDMAP_NODE: id="sec_6_advanced" | label="**AI: điền chủ đề bài tập nâng cao**" | parent_id="sec_6" | type="sub"]

---

## 7. 📚 Tài liệu tham khảo & Nguồn mở rộng
[MINDMAP_NODE: id="sec_7" | label="**AI: điền nguồn quan trọng**" | parent_id="root" | type="main"]

- **Nguồn chính thức:** Docs, RFC, sách giáo khoa, bài báo khoa học.
[MINDMAP_NODE: id="sec_7_official" | label="**AI: điền tên nguồn cụ thể**" | parent_id="sec_7" | type="sub"]

---

⚠️ QUY TẮC ANCHOR MINDMAP (BẮT BUỘC TUÂN THỦ):
==================================================
1. KHÔNG ĐƯỢC GIỮ NGUYÊN label="**AI: ...**". PHẢI THAY BẰNG TỪ KHÓA CỤ THỂ TỪ NỘI DUNG BẠN VỪA VIẾT.
2. label phải là TỪ KHÓA CỤ THỂ (2-4 từ), KHÔNG phải tên mục chung.
   ✅ TỐT: "Variables & Data Types", "If/Else & Loops", "List Comprehension", "Decorator Pattern"
   ❌ KHÔNG: "Định nghĩa then chốt", "Nguyên lý cơ bản", "Các bước thực hiện", "Framework tham khảo"
3. Mỗi anchor đặt NGAY TRƯỚC đoạn nội dung nó đại diện (heading hoặc bullet point).
4. CHỈ 1 anchor chính (type="main") mỗi mục lớn (sec_1...sec_7).
5. CHỈ 1-2 anchor phụ (type="sub") cho khái niệm quan trọng NHẤT trong mục đó.
6. id giữ nguyên mẫu (sec_1, sec_2_definitions, sec_3_steps, v.v.).
7. parent_id: "root" cho sec_1..sec_7, hoặc ID của anchor cha.

YÊU CAU CHUNG:
- Trả về Markdown thuần, KHÔNG bao bọc trong code block.
- Giữ nguyên các thẻ [MINDMAP_NODE:...] đúng vị trí VÀ ĐÃ ĐIỀN ĐÚNG LABEL.
- Độ dài: 1.500 - 3.000 từ.
- Ngôn ngữ: Tiếng Việt (hoặc ngôn ngữ của topic).
- KHÔNG thêm lời dẫn/mô tả ngoài nội dung bài học.
"""

# ─── Helper Functions ───────────────────────────────────────────────────────


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
NHỚ: PHẢI THAY THẾ TẤT CẢ label="**AI: ...**" BẰNG TỪ KHÓA CỤ THỂ TỪ NỘI DUNG BẠN VIẾT!
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

YÊU CAU:
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