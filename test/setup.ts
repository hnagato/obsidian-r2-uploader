import { allCustomMatcher } from 'aws-sdk-client-mock-vitest';
import { expect } from 'vitest';

// Register all custom matchers for aws-sdk-client-mock with Vitest
expect.extend(allCustomMatcher);
