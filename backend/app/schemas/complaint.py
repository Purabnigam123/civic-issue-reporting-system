from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.complaint import ComplaintCategory, ComplaintStatus, ComplaintPriority

class ComplaintResponse(BaseModel):
    id: str
    complaintId: str
    category: ComplaintCategory
    status: ComplaintStatus
    priority: ComplaintPriority
    department: str
    address: str
    description: str
    images: List[str] = []
    voiceNote: Optional[str] = None
    createdAt: datetime
    updatedAt: Optional[datetime] = None
    
class PublicStatsResponse(BaseModel):
    totalComplaints: int
    resolvedComplaints: int
    inProgressComplaints: int
    submittedComplaints: int
    resolutionRate: int
    categoryStats: List[Dict[str, Any]]
    statusStats: List[Dict[str, Any]]
    departmentStats: List[Dict[str, Any]]
