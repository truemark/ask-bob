import {CloudFrontRequestHandler} from 'aws-lambda';
import * as dns from 'dns';

let bestOrigin: string = 'error';
let expires = 0;
const ttl = 1;

function getBestOrigin(host: string): Promise<string> {
  const now = Date.now();
  if (now < expires) return Promise.resolve(bestOrigin);
  return new Promise((resolve) => {
    dns.resolveCname(host, (err, addr) => {
      bestOrigin = addr[0];
      expires = now + ttl;
      resolve(bestOrigin);
    });
  });
}

export const handler: CloudFrontRequestHandler = async (event) => {
  const request = event.Records[0].cf.request;
  const host = request.headers['host'][0].value;
  const bestOrigin = await getBestOrigin(host);
  request.headers['host'] = [
    {
      key: 'host',
      value: bestOrigin,
    },
  ];
  if (request.origin?.custom?.domainName) {
    request.origin.custom.domainName = bestOrigin;
    return request;
  }
  throw new Error('Origin not found on request');
};
