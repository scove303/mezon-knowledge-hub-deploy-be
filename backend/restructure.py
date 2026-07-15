import os
import shutil

BASE_DIR = r"D:\Projects\mezon_knowledge_hub\backend"

# Files/Directories to delete
to_delete = [
    "main.py",
    "app/api/mezon",
    "app/services/ai_agent.py",
    "app/services/db_manager.py",
    "app/services/dp_manager.py",
    "app/services/scapers.py",
    "app/services/scrapers.py",
    "app/services/search_engine.py",
]

for path in to_delete:
    full_path = os.path.join(BASE_DIR, path)
    if os.path.exists(full_path):
        if os.path.isdir(full_path):
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)

# Rename alembic.toml to alembic.ini if exists
alembic_toml = os.path.join(BASE_DIR, "alembic.toml")
alembic_ini = os.path.join(BASE_DIR, "alembic.ini")
if os.path.exists(alembic_toml):
    os.rename(alembic_toml, alembic_ini)

# Structure to create
structure = {
    "scripts": ["prestart.sh", "seed.py"],
    "tests": ["conftest.py"],
    "tests/api": ["test_health.py", "test_auth.py", "test_folders.py", "test_files.py"],
    "tests/services": ["test_youtube_pipeline.py"],
    "app/core": ["logging.py"],
    "app/models": ["processing_job.py"],
    "app/schemas": ["job.py", "ai.py"],
    "app/crud": ["job.py"],
    "app/services/ai": ["client.py", "prompts.py", "__init__.py"],
    "app/services/search": ["tavily.py", "__init__.py"],
    "app/services/document": ["parser.py", "chunker.py", "__init__.py"],
    "app/services/video": ["transcript.py", "__init__.py"],
    "app/services/storage": ["file_storage.py", "__init__.py"],
    "app/services/knowledge": ["roadmap.py", "digest.py", "youtube.py", "__init__.py"],
    "app/workers": ["runner.py", "__init__.py"],
    "app/workers/tasks": ["roadmap_task.py", "digest_task.py", "youtube_task.py", "__init__.py"],
    "app/bot": ["client.py", "runner.py", "__init__.py"],
    "app/bot/commands": ["roadmap.py", "digest.py", "youtube.py", "dashboard.py", "help.py", "__init__.py"],
    "app/bot/handlers": ["messages.py", "attachments.py", "__init__.py"],
    "app/api/v1/endpoints": ["jobs.py", "health.py"],
    "alembic/versions": ["001_initial_schema.py"],
}

for folder, files in structure.items():
    folder_path = os.path.join(BASE_DIR, folder)
    os.makedirs(folder_path, exist_ok=True)
    for file in files:
        file_path = os.path.join(folder_path, file)
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                if file.endswith(".py") and file != "__init__.py":
                    f.write("# TODO: Implement\n")
                elif file == "prestart.sh":
                    f.write("#!/bin/bash\n# Wait for DB and run migrations\n")
                else:
                    f.write("")

# Ensure __init__.py exists in packages
packages = ["app/schemas", "app/crud", "app/services", "app/api/v1/endpoints"]
for pkg in packages:
    init_path = os.path.join(BASE_DIR, pkg, "__init__.py")
    if not os.path.exists(init_path):
        with open(init_path, "w") as f:
            f.write("")

print("Restructure complete!")
