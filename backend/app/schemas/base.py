from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        extra="forbid",
        json_schema_serialization_defaults_required=True,
    )


class ErrorBody(ApiModel):
    code: str
    message: str


class ErrorResponse(ApiModel):
    detail: ErrorBody
