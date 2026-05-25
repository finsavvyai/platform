const { Kafka, logLevel } = require('kafkajs');

async function testKafka() {
    console.log('Testing Kafka connection...');

    const kafka = new Kafka({
        clientId: 'test-client',
        brokers: ['localhost:9092'],
        logLevel: logLevel.DEBUG,
        retry: {
            initialRetryTime: 100,
            retries: 3
        },
        connectionTimeout: 10000,
        requestTimeout: 30000
    });

    try {
        const admin = kafka.admin();
        console.log('Connecting to Kafka admin...');
        await admin.connect();
        console.log('✅ Connected!');

        const topics = await admin.listTopics();
        console.log('✅ Topics:', topics);

        const cluster = await admin.describeCluster();
        console.log('✅ Cluster info:', cluster);

        await admin.disconnect();
        console.log('✅ Disconnected successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Error type:', error.constructor.name);
        if (error.cause) {
            console.error('Cause:', error.cause.message);
        }
        process.exit(1);
    }
}

testKafka();
