const request = require(`request`);
const requestPromise = require(`request-promise-native`);
const AWS = require(`aws-sdk`);
const {
  accessKeyId,
  secretAccessKey,
  assetsDirectory,
  bucketName,
  assetsServerUri,
  assetsManifests,
  cacheControl
} = require(`./config`);

const s3 = new AWS.S3({
  accessKeyId,
  secretAccessKey
});

const calculateNewAssets = (assetsPathFromManifest, existsAssetsMap) => {
  return assetsPathFromManifest.filter(name => !existsAssetsMap.includes(name));
};

async function getListOfFiles({ continuationToken, directory }) {
  const stripDirectoryReg = new RegExp(`^${directory}/`);
  return await s3
    .listObjectsV2({
      Bucket: bucketName,
      Prefix: directory,
      ...(continuationToken ? { ContinuationToken: continuationToken } : {})
    })
    .promise()
    .then(
      ({ Contents: items, NextContinuationToken: nextContinuationToken }) => {
        return {
          items: items.map(({ Key: assetName }) =>
            assetName.replace(stripDirectoryReg, ``)
          ),
          nextContinuationToken
        };
      }
    );
}

async function getExistAssetsMap({ directory }) {
  const assetsMap = [];
  const firstRes = await getListOfFiles({ directory });
  assetsMap.push(...firstRes.items);
  let nextContinuationToken = firstRes.nextContinuationToken;
  while (true) {
    if (!nextContinuationToken) {
      return assetsMap;
    }
    // eslint-disable-next-line no-await-in-loop
    const res = await getListOfFiles({
      continuationToken: nextContinuationToken,
      directory
    });
    assetsMap.push(...res.items);
    nextContinuationToken = res.nextContinuationToken;
  }
}

async function uploadAsset({ assetName, stream, ContentType }) {
  return s3
    .upload({
      Bucket: bucketName,
      ContentType,
      Key: `${assetsDirectory}/${assetName}`,
      Body: stream,
      CacheControl: cacheControl
    })
    .promise();
}

async function uploadAssetsFromRemoteService({ assets, serviceUri, logger }) {
  logger.log(`${assets.length} assets will be uploaded to S3`);
  for (const assetName of assets) {
    logger.log(`start upload ${assetName}`);
    await new Promise((resolve, reject) => {
      request
        .get(`${serviceUri}/${assetName}`)
        .on(`response`, function(response) {
          if (response.statusCode === 200) {
            resolve(
              uploadAsset({
                stream: response,
                assetName,
                ContentType: response.headers[`content-type`]
              })
            );
          } else {
            reject(
              new Error(
                `Received status ${response.statusCode} for ${assetName}`
              )
            );
          }
        })
        .on(`error`, function(err) {
          reject(err);
        });
    });
    logger.log(`finish upload ${assetName}`);
  }
  return `${assets.length} assets were uploaded to S3`;
}

async function upload() {
  const assetsPathFromManifest = await Promise.all(
    assetsManifests.map(manifestPath =>
      requestPromise(`${assetsServerUri}/${manifestPath}`, { json: true }).then(
        result => result
      )
    )
  ).then(results =>
    results.reduce((flatted, item) => flatted.concat(item), [])
  );
  const existsAssetsMap = await getExistAssetsMap({
    directory: assetsDirectory
  });
  const assets = calculateNewAssets(assetsPathFromManifest, existsAssetsMap);
  return uploadAssetsFromRemoteService({
    assets,
    serviceUri: assetsServerUri,
    logger: console
  });
}

upload()
  .then(data => {
    console.log(data);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
