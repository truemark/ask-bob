import {Context, util} from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';
import {DynamoDBItem} from './types.mjs';

// mutation MyMutation {
//   createMessage(body: "This is a test", sessionId: "1234", handle: "McTestSome") {
//     body
//     createdAt
//     handle
//     messageId
//     sessionId
//   }
// }

// {
//   "data": {
//     "createMessage": {
//       "body": "This is a test",
//       "createdAt": "2024-11-21T06:52:49.774Z",
//       "handle": "McTestSome",
//       "messageId": "01JD6QXD7ESJFXFZRE3DZ183F2",
//       "sessionId": "1234"
//     }
//   }
// }

export function request(ctx: Context) {
  let messageId = util.autoUlid();
  let now = util.time.nowISO8601();
  return ddb.put<DynamoDBItem<any>>({
    key: {
      Pk: `Session#${ctx.arguments.sessionId}`,
      Sk: `Message#${messageId}`,
    },
    item: {
      Detail: {
        messageId: messageId,
        sessionId: ctx.arguments.sessionId,
        message: ctx.arguments.body,
        createdAt: now,
        handle: ctx.arguments.handle,
        body: ctx.arguments.body,
      },
      CreatedAt: now,
      EntityType: 'Message',
    },
  });
}

export function response(ctx: Context) {
  console.log(ctx.result);
  return ctx.result.Detail;
}
