import 'vitest';
import type { CustomMatcher } from 'aws-sdk-client-mock-vitest';

declare module 'vitest' {
  interface Assertion<T> extends CustomMatcher<T> {}
  interface AsymmetricMatchersContaining extends CustomMatcher {}
}
