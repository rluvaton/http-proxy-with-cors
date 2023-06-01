// ts-ignore as I get:
// File '<folder>/node_modules/jest-extended/types/index.d.ts' is not a module.
// https://github.com/jest-community/jest-extended/issues/367
//
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as matchers from 'jest-extended';

expect.extend(matchers);
