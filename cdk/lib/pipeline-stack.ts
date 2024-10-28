import {
  ExtendedStack,
  ExtendedStackProps,
  SingleStackStage,
} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {
  CdkPipeline,
  NodePackageManager,
  NodeVersion,
} from 'truemark-cdk-lib/aws-codepipeline';
import {
  AwsAccount,
  AwsRegion,
  Connection,
  KmsKey,
  Route53Zone,
  SlackChannel,
} from './globals';
import {ComputeType} from 'aws-cdk-lib/aws-codebuild';
import {DataStack} from './data-stack';
import {GraphStack} from './graph-stack';
import {FrontendStack} from './frontend-stack';
import {CodeExtractStack} from './code-extract-stack';
import {EdgeStack} from './edge-stack';

/**
 * Properties for the PipelineStack.
 */
export type PipelineStackProps = ExtendedStackProps;

/**
 * Sets up and configures the AWS CodePipeline to deploy to Stage and Prod environments.
 */
export class PipelineStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const pipeline = new CdkPipeline(this, 'Pipeline', {
      cdkDirectory: 'cdk',
      pipelineName: 'AskBob',
      selfMutation: true,
      keyArn: KmsKey.Cdk,
      connectionArn: Connection.GitHub,
      repository: 'truemark/ask-bob',
      branch: 'main',
      accountIds: [AwsAccount.Prod, AwsAccount.Stage],
      packageManager: NodePackageManager.PNPM,
      nodeVersion: NodeVersion.NODE_22,
      slackChannelConfigurationArn: SlackChannel.Automation,
      preBuildCommands: [
        'cd ../ && pnpm i --frozen-lockfile && pnpm build && pnpm test && cd cdk',
      ],
      computeType: ComputeType.MEDIUM,
    });

    ///////////////////////////////////////////////////////////////////////////
    // Stage
    ///////////////////////////////////////////////////////////////////////////
    const stageData = new SingleStackStage(this, `${id}-StageData`, {
      id: 'Data',
      cls: DataStack,
      props: {},
      env: {account: AwsAccount.Stage, region: AwsRegion.Oregon},
    });
    pipeline.addStage(stageData);

    // TODO Add graph support

    const stageWave = pipeline.addWave('StageWave');

    const stageGraphStack = new SingleStackStage(this, `${id}-StageGraph`, {
      id: 'Graph',
      cls: GraphStack,
      props: {
        zone: 'stage.truemark.io',
      },
      env: {account: AwsAccount.Stage, region: AwsRegion.Oregon},
    });
    stageWave.addStage(stageGraphStack);

    const stageFrontend = new SingleStackStage(this, `${id}-StageFrontend`, {
      id: 'Frontend',
      cls: FrontendStack,
      props: {
        zone: Route53Zone.Stage,
        logLevel: 'debug',
        dataStackParameterExportOptions: stageData.stack.parameterExportOptions,
      },
      env: {account: AwsAccount.Stage, region: AwsRegion.Oregon},
    });
    stageWave.addStage(stageFrontend);

    const stageCodeExtract = new SingleStackStage(
      this,
      `${id}-StageCodeExtract`,
      {
        id: 'CodeExtract',
        cls: CodeExtractStack,
        props: {},
        env: {account: AwsAccount.Stage, region: AwsRegion.Oregon},
      },
    );
    stageWave.addStage(stageCodeExtract);

    const stageEdge = new SingleStackStage(this, `${id}-StageEdge`, {
      id: 'Edge',
      cls: EdgeStack,
      props: {
        zone: Route53Zone.Stage,
        frontendStackParameterExportOptions:
          stageFrontend.stack.parameterExportOptions,
      },
      env: {account: AwsAccount.Stage, region: AwsRegion.Virginia},
    });
    pipeline.addStage(stageEdge);

    ///////////////////////////////////////////////////////////////////////////
    // Prod
    ///////////////////////////////////////////////////////////////////////////
    const prodData = new SingleStackStage(this, `${id}-ProdData`, {
      id: 'Data',
      cls: DataStack,
      props: {},
      env: {account: AwsAccount.Prod, region: AwsRegion.Oregon},
    });
    pipeline.addStage(prodData);

    // TODO Add graph support

    const prodWave = pipeline.addWave('ProdWave');

    const prodGraphStack = new SingleStackStage(this, `${id}-ProdGraph`, {
      id: 'Graph',
      cls: GraphStack,
      props: {
        zone: 'truemark.io',
      },
      env: {account: AwsAccount.Prod, region: AwsRegion.Oregon},
    });
    prodWave.addStage(prodGraphStack);

    const prodFrontend = new SingleStackStage(this, `${id}-ProdFrontend`, {
      id: 'Frontend',
      cls: FrontendStack,
      props: {
        zone: Route53Zone.Prod,
        logLevel: 'info',
        dataStackParameterExportOptions: prodData.stack.parameterExportOptions,
      },
      env: {account: AwsAccount.Prod, region: AwsRegion.Oregon},
    });
    prodWave.addStage(prodFrontend);

    const prodCodeExtract = new SingleStackStage(
      this,
      `${id}-ProdCodeExtract`,
      {
        id: 'CodeExtract',
        cls: CodeExtractStack,
        props: {},
        env: {account: AwsAccount.Prod, region: AwsRegion.Oregon},
      },
    );
    prodWave.addStage(prodCodeExtract);

    const prodEdge = new SingleStackStage(this, `${id}-ProdEdge`, {
      id: 'Edge',
      cls: EdgeStack,
      props: {
        zone: Route53Zone.Prod,
        frontendStackParameterExportOptions:
          prodFrontend.stack.parameterExportOptions,
      },
      env: {account: AwsAccount.Prod, region: AwsRegion.Virginia},
    });
    pipeline.addStage(prodEdge);
  }
}
