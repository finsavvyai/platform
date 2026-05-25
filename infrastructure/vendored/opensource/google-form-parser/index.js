const extractEntryIds = require('./utils/fetchForm');
const config = require('./config');

(async () => {
    console.log("Fetching Google Form entry IDs...");
    const result = await extractEntryIds(config.formUrl, config.searchFields);
    console.log("Extracted Entry IDs:", JSON.stringify(result, null, 2));
})();