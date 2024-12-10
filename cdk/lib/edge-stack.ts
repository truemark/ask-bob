import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {HttpOrigin} from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  AllowedMethods,
  CachePolicy,
  LambdaEdgeEventType,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  OriginSslPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import {Duration} from 'aws-cdk-lib';
import {DomainName} from 'truemark-cdk-lib/aws-route53';
import {CloudFrontTarget} from 'aws-cdk-lib/aws-route53-targets';
import {RecordTarget} from 'aws-cdk-lib/aws-route53';
import {
  DistributionBuilder,
  Invalidation,
  RobotsBehavior,
} from 'truemark-cdk-lib/aws-cloudfront';
import {BestOriginFunction} from './best-origin-function';

/**
 * Properties for the EdgeStack.
 */
export interface EdgeStackProps extends ExtendedStackProps {
  /**
   * The route53 zone to use.
   */
  readonly zone: string;
  /**
   * The behavior for the /robots.txt file. Default is 'Disallow'.
   */
  readonly robotsBehavior?: RobotsBehavior;
  /**
   * Whether to invalidate the CloudFront distribution. Default is `false`.
   */
  readonly invalidate?: boolean;
}

/**
 * Deploys edge resources like CloudFront.
 */
export class EdgeStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: EdgeStackProps) {
    super(scope, id, props);

    const rootDomainName = new DomainName({
      prefix: 'ask-bob',
      zone: props.zone,
    });
    const altDomainName = new DomainName({
      prefix: 'askbob',
      zone: props.zone,
    });

    const certificate = rootDomainName.createCertificate(this, {
      subjectAlternativeNames: [altDomainName.toString()],
    });

    const bestOriginFunction = new BestOriginFunction(
      this,
      'BestOriginFunction',
    );

    const appOrigin = new HttpOrigin(`ask-bob-app-origin.${props.zone}`, {
      protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
      originSslProtocols: [OriginSslPolicy.TLS_V1_2],
      readTimeout: Duration.seconds(59),
      keepaliveTimeout: Duration.seconds(60),
    });

    const appContentOrigin = new HttpOrigin(
      `ask-bob-app-content-origin.${props.zone}`,
      {
        protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
      },
    );

    // Create the CloudFront distribution
    const builder = new DistributionBuilder(this, 'Default')
      .domainName(rootDomainName)
      .domainName(altDomainName)
      .certificate(certificate)
      .behavior(appOrigin)
      .apiDefaults(['X-Qrl']) // headers used by QwikJS RPC
      .redirectFunction({
        apexDomain: rootDomainName, // Redirect to the root domain from www
        indexFile: '', // Not a static website so we don't want to forward to an index file
        trailingSlashBehavior: 'None', // Not applicable since this is not a static website
        noFileExtensionBehavior: 'None', // Not applicable since this is not a static website
        robotsBehavior: props.robotsBehavior ?? 'Disallow', // Apply the /robots.txt behavior so we don't index outside of production
      })
      .edgeLambdas([
        {
          eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          functionVersion: bestOriginFunction.currentVersion,
        },
      ])
      .behavior(
        new HttpOrigin(`ask-bob-graph-origin.${props.zone}`),
        '/graphql',
      )
      .allowedMethods(AllowedMethods.ALLOW_ALL)
      .cachePolicy(CachePolicy.CACHING_DISABLED)
      .originRequestPolicy(OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER)
      .viewerProtocolPolicy(ViewerProtocolPolicy.HTTPS_ONLY)
      .edgeLambdas([
        {
          eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          functionVersion: bestOriginFunction.currentVersion,
        },
      ]);
    for (const path of [
      'build/*',
      'images/*',
      'assets/*',
      'favicon*',
      'android-*',
      'apple-*',
      '404.html',
      'service-worker.js',
      'qwik-prefetch-service-worker.js',
      'q-manifest.json',
      'manifest.json',
      'sitemap.xml',
    ]) {
      builder
        .behavior(appContentOrigin, path)
        .edgeLambdas([
          {
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
            functionVersion: bestOriginFunction.currentVersion,
          },
        ])
        .s3Defaults();
    }

    const distribution = builder.toDistribution();

    // Point DNS to the CloudFront distribution
    const target = new CloudFrontTarget(distribution);
    rootDomainName.createARecord(this, RecordTarget.fromAlias(target));
    altDomainName.createARecord(this, RecordTarget.fromAlias(target));

    this.outputParameter('Endpoint', `https://${rootDomainName.toString()}`);

    if (props.invalidate ?? false) {
      // Typically invalidation should not be necessary.
      // Content should have CDN friendly hashes in the name and proper cache headers should be used on responses.
      new Invalidation(this, 'Invalidation', {
        distributionId: distribution.distributionId,
        paths: ['/*'],
      });
    }
  }
}
