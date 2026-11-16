from fastapi import APIRouter

from app.api.v1.endpoints import evaluations, pools, resumes, search

api_router = APIRouter()

api_router.include_router(pools.router, prefix="/pools", tags=["Talent Pools"])
api_router.include_router(resumes.router, prefix="/pools", tags=["Resumes & Ingestion"])
api_router.include_router(search.router, prefix="/pools", tags=["Semantic Search"])
api_router.include_router(evaluations.router, prefix="/pools", tags=["Comparative Evaluations"])
