require("dotenv").config();

function getEnvVariable(name) {
  if (name in process.env) {
    return process.env[name];
  }

  throw new Error(`Please specified '${name}' config`);
}

function getAssetsManifest() {
  const manifestFiles = getEnvVariable(`ENV_ASSETS_MANIFESTS`).split(",");
  if (manifestFiles.length === 0) {
    throw new Error(`No manifest file passed`);
  }
  return manifestFiles;
}

module.exports = {
  accessKeyId: getEnvVariable(`ENV_S3_ACCESS_KEY_ID`),
  secretAccessKey: getEnvVariable(`ENV_S3_SECRET_ACCESS_KEY`),
  bucketName: getEnvVariable(`ENV_S3_BUCKET_NAME`),
  assetsDirectory: getEnvVariable(`ENV_ASSETS_DIRECTORY`),
  assetsServerUri: getEnvVariable(`ENV_ASSETS_SERVICE_URI`),
  cacheControl: getEnvVariable(`ENV_AWS_S3_CACHE_CONTROL`),
  assetsManifests: getAssetsManifest()
};
