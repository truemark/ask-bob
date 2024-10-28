import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';

/**
 * Properties for the GraphStack.
 */
export interface GraphStackProps extends ExtendedStackProps {
  /**
   * The route53 zone to use.
   */
  readonly zone: string;
}

/**
 * Deploys GraphQL for use by the user interface in interacting with the agent.
 */
export class GraphStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: GraphStackProps) {
    super(scope, id, props);
  }
}
