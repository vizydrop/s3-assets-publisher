# s3-assets-publisher

Write assets to s3 by manifest files

## How to run

Please specify next env variable

```env
ENV_S3_ACCESS_KEY_ID=<your AWS access key ID>
ENV_S3_SECRET_ACCESS_KEY=<your AWS secret access key>
ENV_S3_DEFAULT_REGION=<AWS region>
ENV_S3_BUCKET_NAME=<your S3 backet name>
ENV_ASSETS_DIRECTORY=<name directory, e.g. vizydrop>
ENV_ASSETS_SERVICE_URI=https://example/assets/
ENV_ASSETS_MANIFESTS=application-assets-manifest.json,assets-manifest.json
```

## How it works

App makes request to remote
assets service https://example/assets/application-assets-manifest.json
and receives list of files, which is upload to s3.
