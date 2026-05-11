from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelCaseModel(BaseModel):
    # allow field population by both its name and its alias
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
