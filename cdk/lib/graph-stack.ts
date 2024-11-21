import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {DomainName} from 'truemark-cdk-lib/aws-route53';
import {getGraphSupportStackParameters} from './graph-support-stack';
import {ParameterStoreOptions} from 'truemark-cdk-lib/aws-ssm';
import * as path from 'path';
import {Definition, FieldLogLevel, GraphqlApi} from 'aws-cdk-lib/aws-appsync';
import {RetentionDays} from 'aws-cdk-lib/aws-logs';

/**
 * Properties for the GraphStack.
 */
export interface GraphStackProps extends ExtendedStackProps {
  readonly graphSupportStackParameterExportOptions: ParameterStoreOptions;
  readonly zone: string;
  readonly graphApiName: string;
}

/**
 * Deploys GraphQL for use by the user interface in interacting with the agent.
 */
export class GraphStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: GraphStackProps) {
    super(scope, id, props);

    const graphSupportParameters = getGraphSupportStackParameters(
      this,
      props.graphSupportStackParameterExportOptions,
    );

    const domainName = new DomainName({
      prefix: 'ask-bob-graph',
      zone: props.zone,
    });

    const certificate = graphSupportParameters.certificate;

    const schemaPath = path.join(__dirname, '..', '..', 'schema.graphql');

    const api = new GraphqlApi(this, 'GraphqlApi', {
      name: props.graphApiName,
      definition: Definition.fromFile(schemaPath),
      domainName: {
        domainName: domainName.toString(),
        certificate,
      },
      logConfig: {
        excludeVerboseContent: true,
        fieldLogLevel: FieldLogLevel.ALL,
        retention: RetentionDays.ONE_WEEK,
      },
      // authorizationConfig: {
      //   defaultAuthorization: {
      //     authorizationType: AuthorizationType.OIDC,
      //     openIdConnectConfig: {
      //       oidcProvider: '',
      //     },
      //   },
      // },
      // environmentVariables: {
      //   AUDIENCE: props.audience,
      //   SYSTEM_CLIENT_IDS: props.systemClientIds.join(','),
      // },
    });

    domainName.createCnameRecord(this, api.appSyncDomainName, {
      region: this.region,
    });
  }
}
