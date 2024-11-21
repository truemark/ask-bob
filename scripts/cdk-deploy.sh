#!/usr/bin/env bash

set -euo pipefail
cd "$(dirname "${0}")/../cdk" || exit 1

command=${1:-deploy}

npx aws-cdk@2.x ${command} AskBobData --require-approval never
npx aws-cdk@2.x ${command} AskBobBedrock --require-approval never
npx aws-cdk@2.x ${command} AskBobGraphSupport --require-approval never
npx aws-cdk@2.x ${command} AskBobGraph --require-approval never
npx aws-cdk@2.x ${command} AskBobApp --require-approval never
npx aws-cdk@2.x ${command} AskBobEdge --require-approval never



