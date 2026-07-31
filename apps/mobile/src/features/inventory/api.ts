import type { WriteOffInput, WriteOffSummary } from '@lotea/shared';

import { apiClient } from '../../shared/lib/api-client';

export function createWriteOff(input: WriteOffInput): Promise<WriteOffSummary> {
  return apiClient.post('/inventory/write-offs', input);
}
