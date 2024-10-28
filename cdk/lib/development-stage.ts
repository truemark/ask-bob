import {ExtendedStage, ExtendedStageProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {DataStack} from './data-stack';
import {RemovalPolicy} from 'aws-cdk-lib';
import {GraphStack} from './graph-stack';
import {FrontendStack} from './frontend-stack';
import {LogLevel} from './globals';
import {CodeExtractStack} from './code-extract-stack';
import {ParameterStoreOptions} from 'truemark-cdk-lib/aws-ssm';

/**
 * Properties for the DevelopmentStage.
 */
export interface DevelopmentStageProps extends ExtendedStageProps {
  readonly zone: string;
  readonly logLevel: LogLevel;
}

/**
 * Used to deploy all stacks to a development or sandbox AWS account. Used only for development.
 */
export class DevelopmentStage extends ExtendedStage {
  readonly dataStackParameterExportOptions: ParameterStoreOptions;
  constructor(scope: Construct, id: string, props: DevelopmentStageProps) {
    super(scope, id, props);

    const dataStack = new DataStack(this, 'Data', {
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.dataStackParameterExportOptions = dataStack.parameterExportOptions;

    new GraphStack(this, 'Graph', {
      zone: props.zone,
    });

    new FrontendStack(this, 'Frontend', {
      zone: props.zone,
      logLevel: props.logLevel,
      dataStackParameterExportOptions: dataStack.parameterExportOptions,
    });

    new CodeExtractStack(this, 'CodeExtract', {});
  }
}
