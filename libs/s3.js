const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");

module.exports.getObject = async (params) => {
  try {
    const client = new S3Client({
      region: "ap-northeast-2",
      credentials: defaultProvider(),
    });
    const command = new GetObjectCommand(params);
    const result = await client.send(command);

    return result;
  } catch (err) {
    console.log(`S3 getObject error`, err);
    throw err;
  }
};

module.exports.streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

module.exports.streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
