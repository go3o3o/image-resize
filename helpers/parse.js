const axios = require("axios");
const path = require("path");
const { parse } = require("querystring");

const { getObject } = require("./libs/s3");
const { HttpStatusCode } = require("../enums/response.enum");

const SUPPORTED_FORMAT = ["jpeg", "png", "webp", "tiff", "svg"];

module.exports.parseRequest = async (request) => {
  const { uri, querystring, origin } = request;

  const { domainName } = origin.s3;
  const params = parse(querystring);

  const Bucket = /(.*).s3/.exec(domainName)[1];
  const keyExp = /\/(public|private)\/(.*)/.exec(uri);

  if (!keyExp) return { params };

  const Key = keyExp[2];
  return { params, Bucket, Key };
};

module.exports.checkFormat = async (fileName, Key) => {
  const extension = fileName
    ? path.extname(fileName).substring(1)
    : path.extname(Key).substring(1);
  const originalFormat = extension === "jpg" ? "jpeg" : extension;

  const isSupportedFormat = SUPPORTED_FORMAT.some(
    (type) => type == originalFormat,
  );

  if (!isSupportedFormat) {
    throw {
      status: HttpStatusCode.BAD_REQUEST,
      message: `'${originalFormat}' is Unsupported extension.`,
      format: originalFormat,
    };
  }
  return { originalFormat };
};

module.exports.getS3BodyData = async (params) => {
  const {
    ContentLength,
    Body,
    Metadata,
    message: errorMessage,
  } = await getObject(params);

  if (!Body || !ContentLength || ContentLength === 0) {
    throw {
      status: HttpStatusCode.NOT_FOUND,
      message: `Image does not exist in s3. ${errorMessage}`,
    };
  }

  const fileName = Metadata.filename
    ? Buffer.from(Metadata.filename, "base64").toString()
    : undefined;

  return { Body, fileName };
};

module.exports.getUrlBodyData = async (url) => {
  let body;
  if (/^data:/.test(url)) {
    const data = url.replace(/^data:image\/\w+;base64,/, "");
    body = Buffer.from(data, "base64");
  } else {
    const data = await axios.get(url, {
      responseType: "arraybuffer",
    });
    body = Buffer.from(data.data, "base64");
  }
  return body;
};

module.exports.flattenSvg = (svg) => {
  const images = svg.match(/<image [^>]+>/g);
  if (!images || images.length < 1) {
    return svg;
  }

  var result = svg;
  images.forEach((image) => {
    const [, data] =
      image.match(/ xlink:href="data:image\/svg\+xml;base64,([^"]+)"/) || [];
    if (!data) {
      return;
    }

    const innerSVG = Buffer.from(data, "base64").toString();
    const [, width] = image.match(/ width="([^"]+)"/) || [];
    const [, height] = image.match(/ height="([^"]+)"/) || [];
    const [, opacity] = image.match(/ opacity="([^"]+)"/) || [];
    const [, x] = image.match(/ x="([^"]+)"/) || [];
    const [, y] = image.match(/ y="([^"]+)"/) || [];
    const [header] = (innerSVG && innerSVG.match(/<svg[^>]+>/)) || [];
    const fixedHeader = header
      .replace(/ (x|y|width|height)="([^"]+)"/g, "")
      .replace(
        "<svg",
        `<svg x="${x}" y="${y}" width="${width}" height="${height}" opacity="${
          opacity || 1.0
        }"`,
      );
    const replacement = innerSVG && innerSVG.replace(header, fixedHeader);
    result = result.replace(image, replacement);
  });

  return result;
};
