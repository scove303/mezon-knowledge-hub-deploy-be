MODEL_AVAILABLE = False
_model = None

try:
    from sentence_transformers import SentenceTransformer

    # Load a fast, lightweight embedding model once at startup
    _model = SentenceTransformer("all-MiniLM-L6-v2")
    MODEL_AVAILABLE = True
except Exception as e:
    print(f"⚠️ [similarity_checker] sentence-transformers không khả dụng, bỏ qua semantic cache: {e}")


def get_embedding(text: str) -> list[float]:
    """Converts a prompt string into a vector embedding."""
    if not MODEL_AVAILABLE or _model is None:
        return []
    return _model.encode(text).tolist()


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Calculates cosine similarity score between two vector embeddings (0.0 to 1.0)."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(x * y for x, y in zip(vec1, vec2))
    norm1 = sum(x * x for x in vec1) ** 0.5
    norm2 = sum(y * y for y in vec2) ** 0.5
    if not norm1 or not norm2:
        return 0.0
    return float(dot / (norm1 * norm2))
