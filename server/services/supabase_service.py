import os
from datetime import datetime
from typing import Optional, Dict, Any

class SupabaseMetadataService:
    """
    Manages non-biometric metadata, audit events, and user registry.
    Strictly forbids storing raw images, video frames, or plain biometric templates.
    """
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL", "")
        self.supabase_key = os.getenv("SUPABASE_KEY", "")
        # In-memory mock/fallback when Supabase environment variables are not configured
        self._mock_users = {}
        self._audit_logs = []

    def register_user_metadata(self, user_id: str, vector_id: str, metadata: Dict[str, Any]):
        record = {
            "user_id": user_id,
            "vector_id": vector_id,
            "status": "ACTIVE",
            "enrolled_at": datetime.utcnow().isoformat(),
            "last_authenticated": None,
            "device_info": metadata.get("device_model", "generic")
        }
        self._mock_users[user_id] = record
        self.log_audit_event(user_id, "USER_ENROLLED", {"vector_id": vector_id})
        return record

    def log_audit_event(self, user_id: Optional[str], event_type: str, details: Dict[str, Any]):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "event_type": event_type,
            "details": details
        }
        self._audit_logs.append(log_entry)
        # Production would perform:
        # supabase.table("biometric_audit_logs").insert(log_entry).execute()
        return log_entry
