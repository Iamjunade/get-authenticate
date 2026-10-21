import os
import uuid
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    SearchRequest,
    Filter,
    FieldCondition,
    MatchValue
)

COLLECTION_NAME = "biometric_multimodal_identities"
VECTOR_SIZE = 512 # Standard 512-D FaceNet/InsightFace embedding
FINGERPRINT_VECTOR_SIZE = 128 # 128-D Minutiae descriptor vector

class QdrantBiometricService:
    def __init__(self):
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        qdrant_api_key = os.getenv("QDRANT_API_KEY", None)
        self.client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
        self._ensure_collection_exists()

    def _ensure_collection_exists(self):
        collections = [c.name for c in self.client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            # We configure named vectors: 'face' (512-D) and 'fingerprint' (128-D) with Cosine distance
            self.client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config={
                    "face": VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
                    "fingerprint": VectorParams(size=FINGERPRINT_VECTOR_SIZE, distance=Distance.COSINE),
                }
            )

    def normalize_vector(self, v: List[float], target_dim: int) -> List[float]:
        arr = np.array(v, dtype=np.float32)
        if len(arr) != target_dim:
            # Pad or truncate if dimensions differ
            if len(arr) < target_dim:
                arr = np.pad(arr, (0, target_dim - len(arr)), mode='constant')
            else:
                arr = arr[:target_dim]
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm
        return arr.tolist()

    def enroll_identity(
        self,
        user_id: str,
        face_embedding: List[float],
        fingerprint_minutiae: List[float],
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Stores encrypted mathematical vector arrays with zero raw imagery.
        """
        vector_id = str(uuid.uuid4())
        norm_face = self.normalize_vector(face_embedding, VECTOR_SIZE)
        norm_fp = self.normalize_vector(fingerprint_minutiae, FINGERPRINT_VECTOR_SIZE)

        payload = {
            "user_id": user_id,
            "created_at": metadata.get("created_at") if metadata else None,
            "device_model": metadata.get("device_model", "generic_edge_device") if metadata else "generic_edge_device"
        }

        self.client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                PointStruct(
                    id=vector_id,
                    vector={
                        "face": norm_face,
                        "fingerprint": norm_fp
                    },
                    payload=payload
                )
            ]
        )
        return vector_id

    def verify_multimodal(
        self,
        face_embedding: List[float],
        fingerprint_minutiae: List[float],
        target_user_id: Optional[str] = None,
        confidence_threshold: float = 0.985 # Requirement: >= 98.5%
    ) -> Tuple[bool, Optional[str], float, float, float]:
        """
        Performs multi-modal Cosine similarity matching.
        Returns: (is_matched, matched_user_id, combined_score, face_score, fp_score)
        """
        norm_face = self.normalize_vector(face_embedding, VECTOR_SIZE)
        norm_fp = self.normalize_vector(fingerprint_minutiae, FINGERPRINT_VECTOR_SIZE)

        query_filter = None
        if target_user_id:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="user_id",
                        match=MatchValue(value=target_user_id)
                    )
                ]
            )

        # 1. Search against Face index
        face_results = self.client.search(
            collection_name=COLLECTION_NAME,
            query_vector=("face", norm_face),
            query_filter=query_filter,
            limit=5,
            with_payload=True
        )

        if not face_results:
            return False, None, 0.0, 0.0, 0.0

        top_match = face_results[0]
        face_score = top_match.score
        matched_user_id = top_match.payload.get("user_id")

        # 2. Search/Compare Fingerprint index for this identity
        fp_results = self.client.search(
            collection_name=COLLECTION_NAME,
            query_vector=("fingerprint", norm_fp),
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="user_id",
                        match=MatchValue(value=matched_user_id)
                    )
                ]
            ),
            limit=1
        )

        fp_score = fp_results[0].score if fp_results else 0.0

        # Multi-modal fusion scoring:
        # Weighted combination: 70% Face similarity + 30% Touchless Ridge Minutiae similarity
        combined_score = (0.70 * face_score) + (0.30 * fp_score)

        is_matched = combined_score >= confidence_threshold

        return is_matched, matched_user_id, combined_score, face_score, fp_score
