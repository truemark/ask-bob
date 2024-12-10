import {Construct} from 'constructs';
import * as path from 'path';
import {Runtime} from 'aws-cdk-lib/aws-lambda';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';

/**
 * This is an lambda@edge function that is used to determine the best origin for a request using
 * route53 latency based routing with CNAME records.
 *
 * See handlers/src/best-origin-handler.mts
 */
export class BestOriginFunction extends NodejsFunction {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      entry: path.join(
        __dirname,
        '..',
        '..',
        'handlers',
        'src',
        'best-origin-handler.mts',
      ),
      runtime: Runtime.NODEJS_22_X,
      memorySize: 128,
    });
  }
}
