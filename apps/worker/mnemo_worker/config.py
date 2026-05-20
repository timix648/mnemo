from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    log_level: str = "INFO"
    database_url: str = "postgresql+asyncpg://mnemo_user:mnemo_password@localhost:5432/mnemo_db"
    redis_url: str = "redis://localhost:6380/0"
    sidecar_url: str = "http://localhost:3001"

    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()
