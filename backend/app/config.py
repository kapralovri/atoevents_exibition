from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://exhibitor:exhibitor_secret@localhost:5432/exhibitor_portal"
    secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    s3_endpoint_url: str = "http://localhost:9000"
    s3_public_endpoint_url: Optional[str] = None
    s3_bucket: str = "exhibitor-uploads"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin_secret"
    s3_region: str = "us-east-1"

    cors_origins: str = "http://localhost:3000"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@atocomm.eu"
    admin_notify_email: str = "admin@atocomm.eu"

    max_upload_bytes: int = 500 * 1024 * 1024
    preview_max_bytes: int = 1024 * 1024

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
