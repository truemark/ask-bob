import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export class DataSettings {
  private txTableName?: string;
  private dataTableName?: string;
  private dynamoDBClient?: DynamoDBClient;
  private dynamoDBDocumentClient?: DynamoDBDocumentClient;

  getDataTableName(): string {
    if (!this.dataTableName) {
      this.dataTableName = getEnv('DATA_TABLE_NAME');
    }
    return this.dataTableName;
  }

  getTxTableName(): string {
    if (!this.txTableName) {
      this.txTableName = getEnv('TX_TABLE_NAME');
    }
    return this.txTableName;
  }

  getDynamoDBClient(): DynamoDBClient {
    if (!this.dynamoDBClient) {
      this.dynamoDBClient = new DynamoDBClient({});
    }
    return this.dynamoDBClient;
  }

  getDynamoDBDocumentClient(): DynamoDBDocumentClient {
    if (!this.dynamoDBDocumentClient) {
      this.dynamoDBDocumentClient = DynamoDBDocumentClient.from(
        this.getDynamoDBClient(),
        {
          marshallOptions: {
            removeUndefinedValues: true,
          },
        },
      );
    }
    return this.dynamoDBDocumentClient;
  }
}
