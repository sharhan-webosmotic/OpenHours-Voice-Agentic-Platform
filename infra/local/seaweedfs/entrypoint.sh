#!/bin/sh
# Generates the SeaweedFS S3 identity file from the environment, then starts the server.
# The file is generated rather than committed because it holds the local access keys.
#
# Privacy is enforced by construction: exactly one identity exists and it requires
# credentials. There is no "anonymous" identity, so unsigned requests are rejected.
# This mirrors the production S3 bucket, which blocks all public access.
set -eu

: "${AWS_ACCESS_KEY_ID:?must be set}"
: "${AWS_SECRET_ACCESS_KEY:?must be set}"

CONFIG=/tmp/s3-identities.json
cat > "$CONFIG" <<JSON
{
  "identities": [
    {
      "name": "openhours-local",
      "credentials": [
        {
          "accessKey": "${AWS_ACCESS_KEY_ID}",
          "secretKey": "${AWS_SECRET_ACCESS_KEY}"
        }
      ],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
JSON

exec weed server \
  -dir=/data \
  -ip=0.0.0.0 \
  -master.volumeSizeLimitMB=256 \
  -s3 \
  -s3.port=8333 \
  -s3.config="$CONFIG"
