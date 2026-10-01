"""
Trích xuất (crawl) toàn bộ nội dung text từ file người dùng tải lên.
Hỗ trợ: .pdf (pypdf), .docx (python-docx), .txt (plain text).
"""

import io
from typing import Optional

from pypdf import PdfReader
from pypdf.errors import PdfReadError, PdfStreamError
from docx import Document
from docx.opc.exceptions import PackageNotFoundError
from docx.oxml.exceptions import InvalidXmlError

# Các định dạng file được phép upload
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

# Giới hạn dung lượng file (mặc định 20MB) để tránh crawl file quá nặng
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024


class UnsupportedFileTypeError(Exception):
    """File có phần mở rộng không được hỗ trợ."""


class EmptyFileContentError(Exception):
    """Không trích xuất được nội dung text nào từ file."""


def get_file_extension(filename: str) -> str:
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Crawl toàn bộ text từ file PDF bằng pypdf."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except (PdfReadError, PdfStreamError) as e:
        raise EmptyFileContentError(
            "File PDF bị lỗi hoặc bị hỏng, không thể đọc được."
        ) from e
    
    pages_text = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages_text.append(text.strip())
    return "\n\n".join(pages_text)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Crawl toàn bộ text từ file Word (.docx) bằng python-docx."""
    try:
        document = Document(io.BytesIO(file_bytes))
    except (PackageNotFoundError, InvalidXmlError) as e:
        raise EmptyFileContentError(
            "File Word (.docx) bị lỗi hoặc bị hỏng, không thể đọc được."
        ) from e

    parts = []

    # Text trong các đoạn văn (paragraphs)
    for paragraph in document.paragraphs:
        if paragraph.text.strip():
            parts.append(paragraph.text.strip())

    # Text trong bảng (tables) - nếu có
    for table in document.tables:
        for row in table.rows:
            row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_text:
                parts.append(" | ".join(row_text))

    return "\n".join(parts)


def extract_text_from_txt(file_bytes: bytes) -> str:
    """Crawl text từ file .txt thuần, thử vài encoding phổ biến."""
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return file_bytes.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    # Fallback: bỏ qua các byte không decode được thay vì lỗi hẳn
    return file_bytes.decode("utf-8", errors="ignore").strip()


def extract_text(filename: str, file_bytes: bytes) -> str:
    """
    Điểm vào chung: nhận tên file + nội dung bytes, tự động chọn đúng
    hàm crawl text theo phần mở rộng.

    Raises:
        UnsupportedFileTypeError: nếu phần mở rộng không nằm trong ALLOWED_EXTENSIONS
        EmptyFileContentError: nếu crawl xong nhưng không có nội dung text nào
    """
    extension = get_file_extension(filename)

    if extension not in ALLOWED_EXTENSIONS:
        raise UnsupportedFileTypeError(
            f"Định dạng file '{extension or 'không xác định'}' không được hỗ trợ. "
            f"Chỉ chấp nhận: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    if extension == ".pdf":
        content = extract_text_from_pdf(file_bytes)
    elif extension == ".docx":
        content = extract_text_from_docx(file_bytes)
    else:  # .txt
        content = extract_text_from_txt(file_bytes)

    if not content or not content.strip():
        raise EmptyFileContentError(
            "Không trích xuất được nội dung text nào từ file này "
            "(file có thể là ảnh scan, rỗng, hoặc bị lỗi)."
        )

    return content