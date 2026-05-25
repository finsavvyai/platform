import { z } from 'zod';

export const generateComplianceReportSchema = z.object({
  framework: z.enum(['soc2', 'iso27001', 'cis']),
});
