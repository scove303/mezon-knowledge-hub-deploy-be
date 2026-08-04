import numpy as np
from sentence_transformers import SentenceTransformer

# Load a fast, lightweight embedding model once at startup
model = SentenceTransformer("all-MiniLM-L6-v2")


def get_embedding(text: str) -> list[float]:
    """Converts a prompt string into a 384-dimensional vector."""
    return model.encode(text).tolist()


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Calculates cosine similarity score between two vector embeddings (0.0 to 1.0)."""
    a = np.array(vec1)
    b = np.array(vec2)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))