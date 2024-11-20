import {Construct} from 'constructs';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';
import {CustomResource, Duration} from 'aws-cdk-lib';
import {Provider} from 'aws-cdk-lib/custom-resources';
import {Runtime} from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export interface CollectionIndexProps {
  readonly openSearchEndpoint: string;
  readonly indexName: string;
  readonly metadataFieldName: string;
  readonly textFieldName: string;
  readonly vectorFieldName: string;
  readonly vectorFieldDimension: number;
}

export class KnowledgeBaseCollectionIndex extends Construct {
  readonly openSearchEndpoint: string;
  readonly indexName: string;
  readonly metadataFieldName: string;
  readonly textFieldName: string;
  readonly vectorFieldName: string;
  readonly vectorFieldDimension: number;
  constructor(scope: Construct, id: string, props: CollectionIndexProps) {
    super(scope, id);

    this.openSearchEndpoint = props.openSearchEndpoint;
    this.indexName = props.indexName;
    this.metadataFieldName = props.metadataFieldName;
    this.textFieldName = props.textFieldName;
    this.vectorFieldName = props.vectorFieldName;
    this.vectorFieldDimension = props.vectorFieldDimension;

    const fn = new NodejsFunction(this, 'Function', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(
        __dirname,
        'opensearch-index-handler',
        'src',
        'index.mts',
      ),
      depsLockFilePath: path.join(
        __dirname,
        'opensearch-index-handler',
        'pnpm-lock.yaml',
      ),
      timeout: Duration.minutes(5),
      // See https://opensearch.org/docs/latest/search-plugins/knn/knn-index/
      // code: Code.fromInline(`
      //   const https = require('https');
      //   exports.handler = async (event) => {
      //     const endpoint = event.ResourceProperties.openSearchEndpoint;
      //     const indexName = event.ResourceProperties.indexName;
      //     const body = JSON.stringify({
      //       "settings": {
      //         "index": {
      //           "knn": true,
      //           "knn.algo_param.ef_search": 100
      //         }
      //       },
      //       "mappings": {
      //         "properties": {
      //            "${props.vectorFieldName}": {
      //               "type": "knn_vector",
      //               "dimension": ${props.vectorFieldDimension}
      //            },
      //            "${props.textFieldName}": {
      //               "type": "text"
      //            },
      //            "${props.metadataFieldName}": {
      //               "type": "keyword"
      //            },
      //         }
      //      }
      //     });
      //     console.log('Open Search Endpoint:', endpoint);
      //     console.log('Index Name:', indexName);
      //     const options = {
      //       protocol: 'https:',
      //       hostname: endpoint.split('//')[1],
      //       path: \`/\${indexName}\`,
      //       method: 'PUT',
      //       headers: {
      //         'Content-Type': 'application/json',
      //         'host': endpoint.split('//')[1],
      //       },
      //       body,
      //     };
      //     return new Promise((resolve, reject) => {
      //       const req = https.request(options, (res) => {
      //         let responseBody = '';
      //         res.on('data', (chunk) => {
      //           responseBody += chunk;
      //         });
      //         res.on('end', () => {
      //           console.log('Response:', JSON.stringify(responseBody, null, 2));
      //           resolve({
      //             statusCode: res.statusCode,
      //             body: responseBody,
      //           });
      //         });
      //       });
      //       req.on('error', (err) => {
      //         console.error('Error:', err);
      //         reject(err);
      //       });
      //       req.write(body);
      //       req.end();
      //     });
      //   };
      // `),
    });

    const provider = new Provider(this, 'Provider', {
      onEventHandler: fn,
    });

    new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      properties: {
        openSearchEndpoint: props.openSearchEndpoint,
        indexName: props.indexName,
        metadataFieldName: props.metadataFieldName,
        textFieldName: props.textFieldName,
        vectorFieldName: props.vectorFieldName,
        vectorFieldDimension: props.vectorFieldDimension,
        timestamp: Date.now(), // Forces re-deployment and execution of the custom resource
      },
    });
  }
}
