#!/usr/bin/env node
import 'source-map-support/register';
import {DataClassification, ExtendedApp} from 'truemark-cdk-lib/aws-cdk';
import {AwsAccount, AwsRegion} from '../lib/globals';
import {PipelineStack} from '../lib/pipeline-stack';
import {GraphSupportStack} from '../lib/graph-support-stack';
import {DataStack} from '../lib/data-stack';
import {RemovalPolicy} from 'aws-cdk-lib';
import {FrontendStack} from '../lib/frontend-stack';
import {BedrockStack} from '../lib/bedrock-stack';
import {EdgeStack} from '../lib/edge-stack';

const app = new ExtendedApp({
  standardTags: {
    automationTags: {
      id: 'ask-bob',
      url: 'https://github.com/truemark/ask-bob',
    },
    costCenterTags: {
      businessUnitName: 'r-d',
      projectName: 'ask-bob',
    },
    securityTags: {
      dataClassification: DataClassification.Public,
    },
    teamTags: {
      name: 'a-team',
    },
  },
});

if (app.account === AwsAccount.DevOps) {
  // We use code pipeline to deploy to the stage, pre and prod environments.
  // Alternatively you could use GitHub Workflows or BitBucket pipelines
  new PipelineStack(app, 'AskBob', {
    env: {
      account: app.account,
      region: AwsRegion.Ohio,
    },
  });
}

if (app.account === AwsAccount.Ejensen || app.account === AwsAccount.Dross) {
  const zonePrefix = app.account === AwsAccount.Ejensen ? 'ejensen' : 'dross';
  const dataStack = new DataStack(app, 'AskBobData', {
    removalPolicy: RemovalPolicy.DESTROY,
    env: {account: app.account, region: AwsRegion.Oregon},
  });
  new GraphSupportStack(app, 'AskBobGraphSupport', {
    zone: `${zonePrefix}.dev.truemark.io`,
    env: {account: app.account, region: AwsRegion.Virginia},
  });
  // TODO Add graph stack
  new FrontendStack(app, 'AskBobFrontend', {
    zone: `${zonePrefix}.dev.truemark.io`,
    logLevel: 'trace',
    dataStackParameterExportOptions: dataStack.parameterExportOptions,
    env: {account: app.account, region: AwsRegion.Oregon},
  });
  new BedrockStack(app, 'AskBobBedrock', {
    dataStackParameterExportOptions: dataStack.parameterExportOptions,
    crawlerSeedUrls: ['https://truemark.io'],
    crawlerInclusionFilters: ['.*truemark\\.io.*'],
  });
  new EdgeStack(app, 'AskBobEdge', {
    zone: `${zonePrefix}.dev.truemark.io`,
    frontendStackParameterExportOptions: dataStack.parameterExportOptions,
    env: {account: app.account, region: AwsRegion.Virginia},
  });
}