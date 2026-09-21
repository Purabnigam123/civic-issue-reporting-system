from fastapi.responses import JSONResponse
from typing import Any, Optional

def success_response(data: Any = None, message: str = "Success", status_code: int = 200) -> JSONResponse:
    content = {
        "success": True,
        "message": message,
    }
    if data is not None:
        if isinstance(data, dict):
            content.update(data)
            content["data"] = data
        else:
            content["data"] = data
    return JSONResponse(status_code=status_code, content=content)

def error_response(message: str = "Error", status_code: int = 400, errors: Optional[Any] = None) -> JSONResponse:
    content = {
        "success": False,
        "message": message,
    }
    if errors is not None:
        content["errors"] = errors
    return JSONResponse(status_code=status_code, content=content)
