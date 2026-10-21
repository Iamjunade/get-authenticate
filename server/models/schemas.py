from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ChallengeRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="Optional user ID for 1:1 verification, or omitted for 1:N identification")

class ChallengeResponse(BaseModel):
    session_id: str
    challenge_type: str = Field(..., description="e.g., BLINK_TWICE, TURN_HEAD_RIGHT_10, TURN_HEAD_LEFT_10")
    challenge_prompt: str
    nonce: str
    expires_at: datetime

class EncryptedBiometricPayload(BaseModel):
    session_id: str
    ciphertext_b64: str = Field(..., description="Base64 AES-256-GCM encrypted payload")
    iv_b64: str = Field(..., description="Initialization vector (12 bytes base64)")
    tag_b64: str = Field(..., description="Authentication tag (16 bytes base64)")
    rolling_timestamp: int = Field(..., description="Client epoch timestamp (ms) for rolling token validation")

class DecryptedBiometricVector(BaseModel):
    user_id: Optional[str] = None
    face_embedding: List[float] = Field(..., description="512-dimension face embedding array")
    fingerprint_minutiae: List[float] = Field(..., description="Feature vector representation of minutiae points")
    liveness_evidence: Dict[str, Any] = Field(..., description="Active challenge verification telemetry + passive score")

class EnrollmentResponse(BaseModel):
    status: str
    user_id: str
    vector_id: str
    registered_at: datetime
    message: str

class VerificationResult(BaseModel):
    status: str # SUCCESS, REJECTED, SPOOF_DETECTED
    user_id: Optional[str]
    confidence_score: float = Field(..., description="Cosine similarity score (0.0 - 1.0)")
    face_similarity: float
    fingerprint_similarity: float
    liveness_verified: bool
    latency_ms: float
    timestamp: datetime
