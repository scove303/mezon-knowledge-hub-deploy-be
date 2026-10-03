# app/core/state.py
import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

MAX_JOBS = 100
JOB_TTL_SECONDS = 3600  # 1 hour TTL for in-memory jobs
# Khóa đồng bộ cho việc kiểm tra và tạo job
job_creation_lock = asyncio.Lock()


@dataclass
class RoadmapJob:
    user_id: int
    topic: str
    folder_name: str
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    conversation_id: str = ""  # folder_id của hội thoại cũ (follow-up prompt)
    status: str = "queued"  # queued | running | done | error
    error: str = ""
    folder_id: str = ""
    files: list = field(default_factory=list)
    events: list = field(default_factory=list)
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=100))
    created_at: float = field(default_factory=time.time)

    def push(self, event: dict) -> None:
        self.events.append(event)
        try:
            self.queue.put_nowait(event)
        except asyncio.QueueFull:
            # If queue is full (client is not consuming SSE), pop oldest and insert new
            try:
                self.queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self.queue.put_nowait(event)


roadmap_jobs: dict[str, RoadmapJob] = {}


def _cleanup_stale_jobs() -> None:
    now = time.time()
    # 1. Clean jobs older than TTL (1 hour)
    stale_ids = [
        job_id for job_id, job in roadmap_jobs.items()
        if now - job.created_at > JOB_TTL_SECONDS
    ]
    for jid in stale_ids:
        roadmap_jobs.pop(jid, None)

    # 2. If still exceeds MAX_JOBS, evict oldest finished jobs
    if len(roadmap_jobs) > MAX_JOBS:
        finished = sorted(
            (j for j in roadmap_jobs.values() if j.status in ("done", "error")),
            key=lambda j: j.created_at,
        )
        for stale in finished[: len(roadmap_jobs) - MAX_JOBS]:
            roadmap_jobs.pop(stale.id, None)


def create_job(
    user_id: int,
    topic: str,
    folder_name: str,
    conversation_id: str = "",
) -> RoadmapJob:
    _cleanup_stale_jobs()
    job = RoadmapJob(
        user_id=user_id,
        topic=topic,
        folder_name=folder_name,
        conversation_id=conversation_id,
    )
    roadmap_jobs[job.id] = job
    return job


def get_job_for_user(job_id: str, user_id: int) -> Optional[RoadmapJob]:
    _cleanup_stale_jobs()
    job = roadmap_jobs.get(job_id)
    if not job or job.user_id != user_id:
        return None
    return job
