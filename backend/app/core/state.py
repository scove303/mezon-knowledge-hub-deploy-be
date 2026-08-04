# app/core/state.py
import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Callable, Optional

MAX_JOBS = 50


@dataclass
class RoadmapJob:
    user_id: int
    topic: str
    folder_name: str
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    status: str = "queued"  # queued | running | done | error
    error: str = ""
    folder_id: str = ""
    files: list = field(default_factory=list)
    events: list = field(default_factory=list)
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    created_at: float = field(default_factory=time.time)

    def push(self, event: dict) -> None:
        self.events.append(event)
        self.queue.put_nowait(event)


roadmap_jobs: dict[str, RoadmapJob] = {}


def create_job(user_id: int, topic: str, folder_name: str) -> RoadmapJob:
    job = RoadmapJob(user_id=user_id, topic=topic, folder_name=folder_name)
    roadmap_jobs[job.id] = job

    # Dọn các job cũ đã kết thúc nếu vượt giới hạn
    if len(roadmap_jobs) > MAX_JOBS:
        finished = sorted(
            (j for j in roadmap_jobs.values() if j.status in ("done", "error")),
            key=lambda j: j.created_at,
        )
        for stale in finished[: len(roadmap_jobs) - MAX_JOBS]:
            roadmap_jobs.pop(stale.id, None)

    return job


def get_job_for_user(job_id: str, user_id: int) -> Optional[RoadmapJob]:
    job = roadmap_jobs.get(job_id)
    if not job or job.user_id != user_id:
        return None
    return job


def adopt_jobs_for_user(from_user_id: int, to_user_id: int) -> int:
    """Chuyển các job đang chạy của guest sang tài khoản vừa xác thực."""
    count = 0
    for job in roadmap_jobs.values():
        if job.user_id == from_user_id:
            job.user_id = to_user_id
            count += 1
    return count
