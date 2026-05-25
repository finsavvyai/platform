import { schema } from '../../lib/db';

type DeliveryRow = typeof schema.webhookDeliveries.$inferSelect;

export function buildDeliveryStats(allDeliveries: DeliveryRow[]) {
	return {
		total: allDeliveries.length,
		successful: allDeliveries.filter((delivery) => delivery.status === 'delivered').length,
		failed: allDeliveries.filter((delivery) => delivery.status === 'failed').length,
		pending: allDeliveries.filter((delivery) => delivery.status === 'pending' || delivery.status === 'retrying').length,
		averageAttempts: allDeliveries.length > 0
			? allDeliveries.reduce((sum, delivery) => sum + (delivery.attempts || 0), 0) / allDeliveries.length
			: 0,
		last24h: allDeliveries.filter((delivery) => {
			const createdAt = delivery.createdAt ? new Date(delivery.createdAt) : new Date(0);
			const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
			return createdAt > oneDayAgo;
		}).length,
	};
}
