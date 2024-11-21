export interface DynamoDBItem<T> {
  Pk: string;
  Sk: string;
  Gs1Pk?: string;
  Gs1Sk?: string;
  Gs2Pk?: string;
  Gs2Sk?: string;
  Gs3Pk?: string;
  Gs3Sk?: string;
  Gs4Pk?: string;
  Gs4Sk?: string;
  Gs5Pk?: string;
  Gs5Sk?: string;
  Detail: Omit<T, '__typename'>;
  CreatedAt: string;
  UpdatedAt: string;
  EntityType: string;
}

// export interface Context {
//   env: Record<string, string>;
//   identity?: {
//     claims: {
//       aud: string | string[];
//       sub: string;
//       nbf: string;
//       scope: string;
//       iss: string;
//       exp: number;
//       iat: number;
//       client_id: string;
//       jti: string;
//     };
//     issuer: string;
//     sub: string;
//   };
//   result: Record<string, unknown>;
//   prev?: {
//     result?: Record<any, any> | Array<any>;
//   };
//   request: {
//     headers: Record<string, string>;
//     domainName: string;
//   };
//   info: {
//     fieldName: string;
//     parentTypeName: string;
//     variables: Record<string, unknown>;
//   };
//   error?: {
//     message: string;
//     type?: string;
//     unhandledErrorType?: unknown;
//   };
//   prv: unknown;
//   stash: Record<string, unknown>;
//   outErrors: unknown[];
//   arguments: Record<string, any>;
//   source: unknown;
// }
