from __future__ import annotations

import uuid

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import settings


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def ensure_bucket() -> None:
    c = _client()
    try:
        c.head_bucket(Bucket=settings.s3_bucket)
    except ClientError:
        c.create_bucket(Bucket=settings.s3_bucket)


def presign_put(key: str, content_type: str, max_size: int | None = None) -> dict[str, str]:
    c = _client()
    params: dict = {
        "Bucket": settings.s3_bucket,
        "Key": key,
        "ContentType": content_type,
    }
    if max_size:
        params["ContentLength"] = max_size  # not always used in presign
    url = c.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.s3_bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=3600,
    )
    return {"url": url, "key": key}


def presign_multipart_create(key: str, content_type: str) -> str:
    c = _client()
    resp = c.create_multipart_upload(
        Bucket=settings.s3_bucket,
        Key=key,
        ContentType=content_type,
    )
    return resp["UploadId"]


def presign_multipart_part(key: str, upload_id: str, part_number: int) -> str:
    c = _client()
    return c.generate_presigned_url(
        "upload_part",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": key,
            "UploadId": upload_id,
            "PartNumber": part_number,
        },
        ExpiresIn=3600,
    )


def complete_multipart_upload(key: str, upload_id: str, parts: list[dict]) -> None:
    c = _client()
    c.complete_multipart_upload(
        Bucket=settings.s3_bucket,
        Key=key,
        UploadId=upload_id,
        MultipartUpload={"Parts": sorted(parts, key=lambda p: p["PartNumber"])},
    )


def abort_multipart_upload(key: str, upload_id: str) -> None:
    c = _client()
    try:
        c.abort_multipart_upload(Bucket=settings.s3_bucket, Key=key, UploadId=upload_id)
    except ClientError:
        pass


def delete_object(key: str) -> None:
    c = _client()
    c.delete_object(Bucket=settings.s3_bucket, Key=key)


def download_to_path(key: str, path: str) -> None:
    c = _client()
    obj = c.get_object(Bucket=settings.s3_bucket, Key=key)
    with open(path, "wb") as f:
        for chunk in iter(lambda: obj["Body"].read(8 * 1024 * 1024), b""):
            if not chunk:
                break
            f.write(chunk)


def upload_bytes(key: str, data: bytes, content_type: str) -> None:
    c = _client()
    c.put_object(Bucket=settings.s3_bucket, Key=key, Body=data, ContentType=content_type)


def head_object(key: str) -> dict:
    c = _client()
    return c.head_object(Bucket=settings.s3_bucket, Key=key)


def presign_get(key: str) -> str:
    c = _client()
    return c.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=3600,
    )


def public_or_presigned_url(key: str) -> str:
    base = settings.s3_public_endpoint_url or settings.s3_endpoint_url
    return presign_get(key)


def new_upload_key(prefix: str, filename: str) -> str:
    safe = filename.replace("/", "_")[:200]
    return f"{prefix}/{uuid.uuid4().hex}_{safe}"
