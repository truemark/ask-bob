import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  IBucket,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import {RemovalPolicy} from 'aws-cdk-lib';
import {ParameterStore, ParameterStoreOptions} from 'truemark-cdk-lib/aws-ssm';
import {StandardTableV2} from 'truemark-cdk-lib/aws-dynamodb';
import {ITableV2} from 'aws-cdk-lib/aws-dynamodb';

/**
 * Parameters exported by the stack. Set as an enum to prevent typos.
 */
export enum DataStackParameterExport {
  KnowledgeBaseBucketName = 'KnowledgeBaseBucketName',
  DataTableName = 'DataTableName',
}

/**
 * Properties for the DataStack.
 */
export interface DataStackProps extends ExtendedStackProps {
  /**
   * The removal policy to apply to resources in the stack. Default is RemovalPolicy.RETAIN.
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * Creates non-ephemeral data storage resources separate from more ephemeral stacks.
 */
export class DataStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // Create the bucket to store knowledge base files.
    // Prefixes are used to separate data for different knowledge bases.
    const bucket = new Bucket(this, 'KnowledgeBaseBucket', {
      // Do not allow public access
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,

      // Disables ACLs on the bucket and policies are used to define access
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,

      // Encrypt using S3 keys
      encryption: BucketEncryption.S3_MANAGED,

      // Force the use of SSL
      enforceSSL: true,

      // Allow the bucket to be removed or objects to be automatically purged based on pass parameter
      removalPolicy: props.removalPolicy,
      autoDeleteObjects: props.removalPolicy === RemovalPolicy.DESTROY,
    });

    // Export the bucket name for use in other stacks
    this.exportParameter(
      DataStackParameterExport.KnowledgeBaseBucketName,
      bucket.bucketName,
    );

    // Create a DynamoDB V2 Table
    const table = new StandardTableV2(this, 'Data', {
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
      deletionProtection: props.removalPolicy !== RemovalPolicy.DESTROY,
      globalSecondaryIndexes: 1,
    });

    // Export the table name for use in other stacks
    this.exportParameter(
      DataStackParameterExport.DataTableName,
      table.tableName,
    );
  }
}

/**
 * References exported by the stack.
 */
export interface DataStackParameters {
  readonly store: ParameterStore;
  readonly knowledgeBaseBucket: IBucket;
  readonly dataTable: ITableV2;
}

/**
 * Helper method to pull the stack parameters from the parameter store.
 *
 * @param scope the scope to create constructs in
 * @param options the parameter store options
 */
export function getDataStackParameters(
  scope: Construct,
  options: ParameterStoreOptions,
): DataStackParameters {
  const store = new ParameterStore(scope, 'DataStackParameters', options);
  const knowledgeBaseBucket = Bucket.fromBucketAttributes(
    scope,
    'KnowledgeBaseBucket',
    {
      bucketName: store.read(DataStackParameterExport.KnowledgeBaseBucketName),
      region: store.region,
    },
  );
  const dataTable = StandardTableV2.fromTableAttributes(scope, 'DataTable', {
    tableName: store.read(DataStackParameterExport.DataTableName),
    globalIndexes: ['Gs1'],
  });
  return {store, knowledgeBaseBucket, dataTable};
}
