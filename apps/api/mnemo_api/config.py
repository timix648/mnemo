from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://mnemo_user:mnemo_password@localhost:5432/mnemo_db"
    sidecar_url: str = "http://localhost:3001"

    proxy_base_url: str = "http://localhost:8080"
    cors_allowed_origins: str = "http://localhost:3000"

    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"

    enoki_audience: str = ""

    # --- Enoki sponsorship (inheritance transactions) ---
    enoki_secret_key: str = ""
    enoki_network: str = "testnet"
    mnemo_package_id: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()