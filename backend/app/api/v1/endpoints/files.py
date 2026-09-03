from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlmodel import Session, select

from app.core.database import get_session
from app.api.deps import CurrentActor
from app.crud import file as file_crud
from app.crud import folder as folder_crud
from app.models.folder import Folder
from app.schemas.common import error_response, success_response
from app.schemas.file import FileCreate, FileMove, FileRename, FileUpdate
from app.services.document.extractor import (
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE_BYTES,
    EmptyFileContentError,
    UnsupportedFileTypeError,
    extract_text,
)
from app.services.knowledge.summarize import (
    SummarizeGenerationError,
    summarize_and_group,
)

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB


@router.post("", status_code=201)
async def upload_file(
    folder_id: Annotated[str, Form()],
    file: Annotated[UploadFile, File(...)],
    session: SessionDep,
    current_user: CurrentActor,
):
    """Tạo file thủ công (upload .md/.txt) vào folder của user hiện tại."""
    folder = session.exec(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == current_user.id)
    ).first()
    if not folder:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy thư mục")
        )

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=error_response("File quá lớn (tối đa 5MB)"),
        )

    name = (file.filename or "document.md").strip() or "document.md"
    if not name.lower().endswith((".md", ".markdown", ".txt")):
        name += ".md"

    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("utf-8", errors="replace")

    created = file_crud.create_file(
        session, folder_id, FileCreate(name=name, content=content)
    )
    return success_response(
        message="Đã tải lên tài liệu",
        data={
            "id": created.id,
            "name": created.name,
            "folder_id": created.folder_id,
            "updated_at": created.updated_at,
        },
    )


@router.get("/{file_id}/revisions")
def list_file_revisions(
    file_id: str, session: SessionDep, current_user: CurrentActor
):
    file = file_crud.get_file(session, file_id, current_user.id)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    revisions = file_crud.list_revisions(session, file_id, current_user.id)
    return success_response(
        message="Lấy lịch sử phiên bản thành công",
        data=[
            {
                "id": rev.id,
                "created_at": rev.created_at,
                "content": rev.content,
            }
            for rev in revisions
        ],
    )


@router.post("/{file_id}/revisions/{revision_id}/restore")
def restore_file_revision(
    file_id: str, revision_id: str, session: SessionDep, current_user: CurrentActor
):
    file = file_crud.restore_revision(session, file_id, revision_id, current_user.id)
    if not file:
        raise HTTPException(
            status_code=404,
            detail=error_response("Không tìm thấy file hoặc phiên bản"),
        )
    return success_response(
        message="Đã khôi phục phiên bản",
        data={
            "id": file.id,
            "updated_at": file.updated_at,
            "content": file.markdown_content,
        },
    )


@router.post("/summarize-folder")
async def summarize_folder(
    session: SessionDep,
    current_user: CurrentActor,
    folder_id: str,
    file: UploadFile = File(...),
    prompt: str | None = Form(
        default=None,
        description="Yêu cầu tùy chỉnh của người dùng, sẽ được ghép cùng nội dung file thành 1 prompt gửi cho model",
    ),
):
    """
    Task 1 + Task 2: API tiếp nhận file, parse nội dung, tóm tắt bằng AI
    và tự động nhóm thành cấu trúc Folder/Tài liệu bài học, rồi lưu vào DB.

    - Nhận 1 file (.pdf, .docx, .txt), dùng pypdf / python-docx để crawl
      toàn bộ text thô.
    - Ghép Context từ file + prompt tùy chỉnh (nếu người dùng gửi kèm)
      thành 1 prompt chuẩn, gửi cho Gemini để tóm tắt & tự nhóm thành
      nhiều tài liệu bài học.
    - Lưu các tài liệu (KnowledgeFile) sinh ra vào folder đã chỉ định.
    """
    # 1. Folder phải tồn tại và thuộc về user hiện tại
    folder = folder_crud.get_folder(session, folder_id, current_user.id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response("Không tìm thấy folder"),
        )

    # 2. Validate phần mở rộng file trước khi đọc để fail sớm, đỡ tốn I/O
    filename = file.filename or ""
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                f"Định dạng file không được hỗ trợ. Chỉ chấp nhận: "
                f"{', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    # 3. Đọc nội dung file & giới hạn dung lượng
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response("File rỗng, không có nội dung để xử lý"),
        )
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(
                f"File vượt quá dung lượng tối đa cho phép "
                f"({MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB)"
            ),
        )

    # 4. Crawl text bằng pypdf / python-docx / plain text
    try:
        extracted_text = extract_text(filename, file_bytes)
    except UnsupportedFileTypeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=error_response(str(e))
        )
    except EmptyFileContentError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response(str(e)),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(f"Lỗi khi xử lý file: {str(e)}"),
        )

    # 5. Gửi context (text đã crawl + prompt tùy chỉnh nếu có) cho Gemini
    #    để tóm tắt và tự động nhóm thành cấu trúc tài liệu
    try:
        structure = await summarize_and_group(
            extracted_text=extracted_text,
            filename=filename,
            user_prompt=prompt,
        )
    except SummarizeGenerationError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_response(f"Lỗi khi tóm tắt bằng AI: {str(e)}"),
        )

    # 6. Lưu các tài liệu (KnowledgeFile) sinh ra vào folder đã chỉ định
    created_files = [
        file_crud.create_file(
            session=session,
            folder_id=folder.id,
            data=FileCreate(name=doc["title"], content=doc["content"]),
        )
        for doc in structure["documents"]
    ]

    return success_response(
        message="Đã tiếp nhận file, tóm tắt và lưu tài liệu vào folder thành công",
        data={
            "folder_id": folder.id,
            "filename": filename,
            "file_size_bytes": len(file_bytes),
            "char_count": len(extracted_text),
            "suggested_folder_name": structure["folder_name"],
            "documents_created": [
                {"id": f.id, "name": f.name} for f in created_files
            ],
        },
    )


@router.get("/{file_id}")
def get_file(file_id: str, session: SessionDep, current_user: CurrentActor):
    file = file_crud.get_file(session, file_id, current_user.id)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    return success_response(
        message="Lấy chi tiết file thành công",
        data={
            "id": file.id,
            "name": file.name,
            "summary": getattr(file, "summary", ""),
            "content": file.markdown_content,
            "video_url": file.video_url,
            "timestamps": file.timestamps_json,
            "created_at": file.created_at,
            "updated_at": file.updated_at,
        },
    )


@router.put("/{file_id}")
def update_file(
    file_id: str, data: FileUpdate, session: SessionDep, current_user: CurrentActor
):
    file = file_crud.update_file(session, file_id, data, current_user.id)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    return success_response(
        message="Đã cập nhật nội dung tài liệu",
        data={"id": file.id, "updated_at": file.updated_at},
    )


@router.put("/{file_id}/rename")
def rename_file(
    file_id: str, data: FileRename, session: SessionDep, current_user: CurrentActor
):
    file = file_crud.rename_file(session, file_id, data.name, current_user.id)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    return success_response(
        message="Đã cập nhật tên tài liệu",
        data={"id": file.id, "name": file.name, "updated_at": file.updated_at},
    )


@router.put("/{file_id}/move")
def move_file(
    file_id: str, data: FileMove, session: SessionDep, current_user: CurrentActor
):
    file = file_crud.move_file(session, file_id, data.folder_id, current_user.id)
    if not file:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file hoặc thư mục đích")
        )
    return success_response(
        message="Đã di chuyển tài liệu",
        data={"id": file.id, "folder_id": file.folder_id},
    )


@router.delete("/{file_id}")
def delete_file(file_id: str, session: SessionDep, current_user: CurrentActor):
    deleted = file_crud.delete_file(session, file_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=404, detail=error_response("Không tìm thấy file")
        )
    return success_response(message="Xóa file thành công")