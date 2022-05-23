"use strict";

const { streamToBuffer } = require("./libs/s3");
const { HttpStatusCode } = require("./enums/response.enum");
const {
  parseRequest,
  getS3BodyData,
  checkFormat,
  getUrlBodyData,
  flattenSvg,
} = require("./helpers/parse");

const TTL = 60 * 60 * 24 * 30 * 6;

module.exports.handler = async (event, context, callback) => {
  console.log(` =====> event: ${JSON.stringify(event)}`);
  const { request, response } = event.Records[0].cf;

  const newResponse = updateResponse({ response, callback });

  const { params, Bucket, Key } = await parseRequest(request);
  const { w, h, t = "cover", q = 80, f = "png", s } = params;

  try {
    const width = parseInt(w, 10);
    const height = parseInt(h, 10);
    const type = t === "crop" ? "cover" : t;
    const quality = parseInt(q, 10);
    let format = f;

    let body;
    if (Bucket && Key) {
      const { Body, fileName } = await getS3BodyData({ Bucket, Key });
      const { originalFormat } = await checkFormat(fileName, Key);
      if (originalFormat) format = originalFormat;
      body = originalFormat.includes("svg")
        ? await flattenSvg(Body)
        : await streamToBuffer(Body);
    } else if (s) {
      body = await getUrlBodyData(s);
    } else {
      throw {
        status: HttpStatusCode.BAD_REQUEST,
        message: `URL 을 확인해 주세요.`,
      };
    }
    const resizedImage = await resize({
      body,
      width,
      height,
      type,
      quality,
      format,
    });
    return newResponse({
      status: HttpStatusCode.OK,
      body: resizedImage.toString("base64"),
      contentType: `image/${format}`,
      cacheControl: `max-age=${TTL}`,
      bodyEncoding: "base64",
    });
  } catch (err) {
    const { status = HttpStatusCode.FOUND, message } = err;
    if (Bucket && Key) {
      const stage = /(develop|stage)/.exec(Bucket);
      let cloudFrontDomainName = stage
        ? `https://domain.${stage[0]}.com/${Key}`
        : `https://domain.com/${Key}`;
      return newResponse({
        status,
        headers: {
          location: [{ key: "Location", value: cloudFrontDomainName }],
        },
        body: message,
      });
    }
    if (s) {
      return newResponse({
        status,
        headers: { location: [{ key: "Location", value: s }] },
      });
    }
    return {
      statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
      body: JSON.stringify(err),
    };
  }
};

const updateResponse =
  ({ response, callback }) =>
  ({
    status,
    contentType = "text/plain",
    headers = {},
    body,
    bodyEncoding,
    cacheControl,
  }) => {
    headers["content-type"] = [
      {
        key: "Content-Type",
        value: contentType,
      },
    ];

    if (cacheControl) {
      headers["cache-control"] = [
        {
          key: "cache-control",
          value: cacheControl,
        },
      ];
    }
    response = {
      status,
      body,
      bodyEncoding,
      headers,
    };

    return callback(null, response);
  };
