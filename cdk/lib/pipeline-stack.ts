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
import {AppStack} from './app-stack';
import {EdgeStack} from './edge-stack';
import {BedrockStack} from './bedrock-stack';
import {GraphSupportStack} from './graph-support-stack';

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

    const stageBedrock = new SingleStackStage(this, `${id}-StageBedrock`, {
      id: 'Bedrock',
      cls: BedrockStack,
      props: {
        dataStackParameterExportOptions: stageData.stack.parameterExportOptions,
        crawlerSeedUrls: ['https://truemark.io'],
        crawlerInclusionFilters: ['.*truemark\\.io.*'],
      },
      env: {account: AwsAccount.Stage, region: AwsRegion.Oregon},
    });
    pipeline.addStage(stageBedrock);

    const stageGraphSupportStack = new SingleStackStage(
      this,
      `${id}-StageGraphSupport`,
      {
        id: 'GraphSupport',
        cls: GraphSupportStack,
        props: {
          zone: 'stage.truemark.io',
        },
        env: {account: AwsAccount.Stage, region: AwsRegion.Virginia},
      },
    );
    pipeline.addStage(stageGraphSupportStack);

    const stageGraphStack = new SingleStackStage(this, `${id}-StageGraph`, {
      id: 'Graph',
      cls: GraphStack,
      props: {
        zone: 'stage.truemark.io',
        graphApiName: 'AskBobStage',
        graphSupportStackParameterExportOptions:
          stageGraphSupportStack.stack.parameterExportOptions,
      },
      env: {account: AwsAccount.Stage, region: AwsRegion.Oregon},
    });
    pipeline.addStage(stageGraphStack);

    const stageApp = new SingleStackStage(this, `${id}-StageApp`, {
      id: 'App',
      cls: AppStack,
      props: {
        zone: Route53Zone.Stage,
        logLevel: 'debug',
        dataStackParameterExportOptions: stageData.stack.parameterExportOptions,
        bedrockStackParameterExportOptions:
          stageBedrock.stack.parameterExportOptions,
      },
      env: {account: AwsAccount.Stage, region: AwsRegion.Oregon},
    });
    pipeline.addStage(stageApp);

    const stageEdge = new SingleStackStage(this, `${id}-StageEdge`, {
      id: 'Edge',
      cls: EdgeStack,
      props: {
        zone: Route53Zone.Stage,
        appStackParameterExportOptions: stageApp.stack.parameterExportOptions,
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

    const prodBedrock = new SingleStackStage(this, `${id}-ProdBedrock`, {
      id: 'Bedrock',
      cls: BedrockStack,
      props: {
        dataStackParameterExportOptions: prodData.stack.parameterExportOptions,
        crawlerSeedUrls: ['https://truemark.io'],
        crawlerInclusionFilters: ['.*truemark\\.io.*'],
      },
      env: {account: AwsAccount.Prod, region: AwsRegion.Oregon},
    });
    pipeline.addStage(prodBedrock);

    const prodGraphSupportStack = new SingleStackStage(
      this,
      `${id}-ProdGraphSupport`,
      {
        id: 'GraphSupport',
        cls: GraphSupportStack,
        props: {
          zone: 'truemark.io',
        },
        env: {account: AwsAccount.Prod, region: AwsRegion.Virginia},
      },
    );
    pipeline.addStage(prodGraphSupportStack);

    const prodGraphStack = new SingleStackStage(this, `${id}-ProdGraph`, {
      id: 'Graph',
      cls: GraphStack,
      props: {
        zone: 'truemark.io',
        graphApiName: 'AskBobProd',
        graphSupportStackParameterExportOptions:
          prodGraphSupportStack.stack.parameterExportOptions,
      },
      env: {account: AwsAccount.Prod, region: AwsRegion.Oregon},
    });
    pipeline.addStage(prodGraphStack);

    const prodApp = new SingleStackStage(
      this,
      `${id}-ProdApp
    `,
      {
        id: 'App',
        cls: AppStack,
        props: {
          zone: Route53Zone.Prod,
          logLevel: 'info',
          dataStackParameterExportOptions:
            prodData.stack.parameterExportOptions,
          bedrockStackParameterExportOptions:
            prodBedrock.stack.parameterExportOptions,
        },
        env: {account: AwsAccount.Prod, region: AwsRegion.Oregon},
      },
    );
    pipeline.addStage(prodApp);

    const prodEdge = new SingleStackStage(this, `${id}-ProdEdge`, {
      id: 'Edge',
      cls: EdgeStack,
      props: {
        zone: Route53Zone.Prod,
        appStackParameterExportOptions: prodApp.stack.parameterExportOptions,
      },
      env: {account: AwsAccount.Prod, region: AwsRegion.Virginia},
    });
    pipeline.addStage(prodEdge);
  }
}
