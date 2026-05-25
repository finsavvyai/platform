export function getCronTemplate(): string {
  return `import { Hono } from 'hono';
import { getD1, getKV } from '@finsavvyai/cf-stack';

const app = new Hono();

export default {
  async fetch(request, env) {
    return app.fetch(request, env);
  },
  async scheduled(event, env) {
    console.log('Cron job triggered:', new Date().toISOString());

    const db = getD1({ env } as any, 'DB');
    const kv = getKV({ env } as any, 'KV');

    try {
      const result = await db
        .prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?')
        .bind('pending')
        .first();

      const pendingCount = (result as any)?.count || 0;
      console.log('Pending tasks:', pendingCount);

      await kv.put('cron:last_run', JSON.stringify({
        timestamp: new Date().toISOString(),
        pendingTasks: pendingCount,
      }), { expirationTtl: 86400 });

      if (pendingCount > 0) {
        await db
          .prepare(\`
            UPDATE tasks
            SET status = 'processing', updated_at = datetime('now')
            WHERE status = 'pending' LIMIT 10
          \`)
          .run();
      }

      event.waitUntil(
        Promise.resolve()
          .then(() => console.log('Cron job completed'))
      );
    } catch (error) {
      console.error('Cron job error:', error);
      throw error;
    }
  },
};
`;
}
