import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {DomainName} from 'truemark-cdk-lib/aws-route53';
import {ParameterStore, ParameterStoreOptions} from 'truemark-cdk-lib/aws-ssm';
import {Certificate, ICertificate} from 'aws-cdk-lib/aws-certificatemanager';

export enum GraphSupportStackParameterExport {
  CertificateArn = 'CertificateArn',
}

export interface GraphSupportStackProps extends ExtendedStackProps {
  readonly zone: string;
}

export class GraphSupportStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: GraphSupportStackProps) {
    super(scope, id, props);

    const domainName = new DomainName({
      prefix: 'ask-bob-graph',
      zone: props.zone,
    });

    const certificate = domainName.createCertificate(this);
    this.exportParameter(
      GraphSupportStackParameterExport.CertificateArn,
      certificate.certificateArn,
    );
  }
}

export interface GraphSupportStackParameters {
  readonly store: ParameterStore;
  readonly certificate: ICertificate;
}

export function getGraphSupportStackParameters(
  scope: Construct,
  options: ParameterStoreOptions,
): GraphSupportStackParameters {
  const store = new ParameterStore(scope, 'GraphSupportParameters', options);
  const certificateArn = store.read(
    GraphSupportStackParameterExport.CertificateArn,
  );
  const certificate = Certificate.fromCertificateArn(
    scope,
    'Certificate',
    certificateArn,
  );
  return {
    store,
    certificate,
  };
}
