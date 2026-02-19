import { prisma } from '@/lib/prisma';

type AuditInput = {
  userId?: string | null;
  tradeId?: string | null;
  action: string;
  reason?: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function createAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      tradeId: input.tradeId,
      action: input.action,
      reason: input.reason,
      oldValueJson: input.oldValue ? JSON.stringify(input.oldValue) : null,
      newValueJson: input.newValue ? JSON.stringify(input.newValue) : null,
    },
  });
}
