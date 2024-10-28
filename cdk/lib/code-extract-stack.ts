import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';

/**
 * Properties for the CodeExtractStack.
 */
export type CodeExtractStackProps = ExtendedStackProps;

/**
 * Deploys resources to extract source code from GitHub repositories, populate the knowledge base S3 bucket and
 * trigger an ingestion job to populate the knowledge base.
 */
export class CodeExtractStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: CodeExtractStackProps) {
    super(scope, id, props);
  }
}
