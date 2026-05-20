from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    proxy_host: str = "0.0.0.0"
    proxy_port: int = 8080
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://mnemo_user:mnemo_password@localhost:5432/mnemo_db"
    redis_url: str = "redis://localhost:6380/0"
    sidecar_url: str = "http://localhost:3001"

    openai_base_url: str = "https://api.openai.com"
    anthropic_base_url: str = "https://api.anthropic.com"

    capture_enabled: bool = True

    # Week 1 dev only
    dev_openai_key: str = ""
    dev_anthropic_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()
