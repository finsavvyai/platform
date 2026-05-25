import { relations } from 'drizzle-orm';
import { users, subscriptions, apiKeys, auditLog } from './tables';

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLog),
}));

export const subscriptionsRelations = relations(
  subscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [subscriptions.userId],
      references: [users.id],
    }),
  })
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));
