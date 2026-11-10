from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, **extra: Any) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.extra = extra


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        body = {"code": exc.code, "message": exc.message, **jsonable_encoder(exc.extra)}
        return JSONResponse(status_code=exc.status, content={"detail": body})

    @app.exception_handler(RequestValidationError)
    async def schema_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"loc": list(e.get("loc", ())), "msg": e.get("msg", ""), "type": e.get("type", "")}
            for e in exc.errors()
        ]
        first = errors[0] if errors else {"loc": [], "msg": "Invalid request"}
        where = ".".join(str(p) for p in first["loc"] if p != "body")
        message = f"{where}: {first['msg']}" if where else first["msg"]
        return JSONResponse(
            status_code=422,
            content={"detail": {"code": "SCHEMA_ERROR", "message": message, "errors": errors}},
        )
