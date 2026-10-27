# Mock API Server — Python FastAPI Template

> **Applies to**: Python, FastAPI, Pydantic

## Implementation Strategy

### 1. Mock Router Module
Create a FastAPI router dedicated to mock endpoints, intercepting traffic for local development.

**File**: `src/api/mock_router.py`

**Logic Flow**:
- Include this router conditionally in `main.py` if `ENV == 'testing'` or `USE_MOCK == 'true'`.
- Define a catch-all endpoint using `{full_path:path}`.

**Example**:
```python
from fastapi import APIRouter, Request, HTTPException
import json
import os

router = APIRouter(prefix="/api/mock")
MOCK_DIR = "AI_DOCS/design/mockdata/"

@router.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def handle_mock(request: Request, full_path: str):
    entity = full_path.split("/")[0]
    file_path = os.path.join(MOCK_DIR, f"{entity}.json")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Mock entity not found")
        
    with open(file_path, "r") as f:
        data = json.load(f)
        
    if request.method == "GET":
        return data
        
    # Handle POST/PUT/DELETE
    if request.method in ["POST", "PUT"]:
        body = await request.json()
        # Ensure validation via Pydantic model lookup based on entity
        data['data'].append(body)
        
        with open(file_path, "w") as f:
            json.dump(data, f, indent=2)
            
        return body
```

### 2. Frontend Connection
Inform the frontend to point `API_BASE_URL` to `/api/mock/` instead of the production API layer during development.
