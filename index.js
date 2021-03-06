const got = require(`got`);
const { S3 } = require(`@aws-sdk/client-s3-node/S3`);

const {
  accessKeyId,
  secretAccessKey,
  assetsDirectory,
  bucketName,
  assetsServerUri,
  assetsManifests,
  cacheControl,
  region,
} = require(`./config`);

const s3 = new S3({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const calculateNewAssets = (assetsPathFromManifest, existsAssetsMap) => {
  return assetsPathFromManifest.filter(
    (name) => !existsAssetsMap.includes(name)
  );
};

async function getListOfFiles({ continuationToken, directory }) {
  const stripDirectoryReg = new RegExp(`^${directory}/`);
  return await s3
    .listObjectsV2({
      Bucket: bucketName,
      Prefix: directory,
      ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
    })
    .then(
      ({ Contents: items, NextContinuationToken: nextContinuationToken }) => {
        return {
          items: items.map(({ Key: assetName }) =>
            assetName.replace(stripDirectoryReg, ``)
          ),
          nextContinuationToken,
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
      directory,
    });
    assetsMap.push(...res.items);
    nextContinuationToken = res.nextContinuationToken;
  }
}

async function uploadAsset({ assetName, stream, ContentType, ContentLength }) {
  return s3.putObject({
    Bucket: bucketName,
    ContentType,
    Key: `${assetsDirectory}/${assetName}`,
    Body: stream,
    CacheControl: cacheControl,
    ContentLength,
  });
}

async function uploadAssetsFromRemoteService({ assets, serviceUri, logger }) {
  logger.log(`${assets.length} assets will be uploaded to S3`);
  for (const assetName of assets) {
    logger.log(`start upload ${assetName}`);

    const assetUrl = `${serviceUri}/${assetName}`;
    const info = await got(assetUrl, { method: `HEAD` });
    await uploadAsset({
      stream: got.stream(assetUrl),
      assetName,
      ContentType: info.headers[`content-type`],
      ContentLength: info.headers[`content-length`],
    });
    logger.log(`finish upload ${assetName}`);
  }
  return `${assets.length} assets were uploaded to S3`;
}

async function upload() {
  const assetsPathFromManifest = await Promise.all(
    assetsManifests.map((manifestPath) =>
      got(`${assetsServerUri}/${manifestPath}`, {
        responseType: `json`,
        resolveBodyOnly: true,
      })
    )
  ).then((results) =>
    results.reduce((flatted, item) => flatted.concat(item), [])
  );
  const existsAssetsMap = await getExistAssetsMap({
    directory: assetsDirectory,
  });
  const assets = calculateNewAssets(assetsPathFromManifest, existsAssetsMap);
  return uploadAssetsFromRemoteService({
    assets,
    serviceUri: assetsServerUri,
    logger: console,
  });
}

upload()
  .then((data) => {
    console.log(data);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
