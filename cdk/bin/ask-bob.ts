#!/usr/bin/env node
import 'source-map-support/register';
import {DataClassification, ExtendedApp} from 'truemark-cdk-lib/aws-cdk';
import {AwsAccount, AwsRegion} from '../lib/globals';
import {PipelineStack} from '../lib/pipeline-stack';
import {GraphSupportStack} from '../lib/graph-support-stack';
import {DataStack} from '../lib/data-stack';
import {RemovalPolicy} from 'aws-cdk-lib';
import {AppStack} from '../lib/app-stack';
import {BedrockStack} from '../lib/bedrock-stack';
import {EdgeStack} from '../lib/edge-stack';
import {GraphStack} from '../lib/graph-stack';

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
  const graphSupportStack = new GraphSupportStack(app, 'AskBobGraphSupport', {
    zone: `${zonePrefix}.dev.truemark.io`,
    env: {account: app.account, region: AwsRegion.Virginia},
  });
  const bedrockStack = new BedrockStack(app, 'AskBobBedrock', {
    dataStackParameterExportOptions: dataStack.parameterExportOptions,
    crawlerSeedUrls: ['https://truemark.io'],
    crawlerInclusionFilters: ['.*truemark\\.io.*'],
    collectionDataAccessPrincipals:
      app.account === AwsAccount.Ejensen
        ? [
            'arn:aws:iam::889335235414:role/aws-reserved/sso.amazonaws.com/us-east-2/AWSReservedSSO_Administrator_285bb2c5aa971ba3',
            'arn:aws:iam::889335235414:role/aws-reserved/sso.amazonaws.com/us-east-2/AWSReservedSSO_Developer_404fe7ee2c0f4497',
          ]
        : [
            'arn:aws:iam::529088296595:role/aws-reserved/sso.amazonaws.com/us-east-2/AWSReservedSSO_Developer_88725ea0a4e40240',
            'arn:aws:iam::529088296595:role/aws-reserved/sso.amazonaws.com/us-east-2/AWSReservedSSO_Administrator_791494459f124403',
          ],
    env: {account: app.account, region: AwsRegion.Oregon},
  });
  const graphStack = new GraphStack(app, 'AskBobGraph', {
    dataStackParameterExportOptions: dataStack.parameterExportOptions,
    graphSupportStackParameterExportOptions:
      graphSupportStack.parameterExportOptions,
    bedrockStackParameterExportOptions: bedrockStack.parameterExportOptions,
    zone: `${zonePrefix}.dev.truemark.io`,
    graphApiName: 'ask-bob',
    logLevel: 'trace',
    env: {account: app.account, region: AwsRegion.Oregon},
  });
  const appStack = new AppStack(app, 'AskBobApp', {
    zone: `${zonePrefix}.dev.truemark.io`,
    logLevel: 'trace',
    dataStackParameterExportOptions: dataStack.parameterExportOptions,
    bedrockStackParameterExportOptions: bedrockStack.parameterExportOptions,
    graphStackParameterExportOptions: graphStack.parameterExportOptions,
    env: {account: app.account, region: AwsRegion.Oregon},
  });
  new EdgeStack(app, 'AskBobEdge', {
    zone: `${zonePrefix}.dev.truemark.io`,
    appStackParameterExportOptions: appStack.parameterExportOptions,
    env: {account: app.account, region: AwsRegion.Virginia},
  });
}
