const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Extracts all entry IDs from a Google Form
 * @param {string} formUrl URL of the Google Form
 * @returns {Promise<Object>} Object mapping field names to entry IDs
 */
async function extractEntryIds(formUrl) {
  try {
    const { data: html } = await axios.get(formUrl);
    
    // First attempt: Try to extract from FB_PUBLIC_LOAD_DATA_
    const dataRegex = /FB_PUBLIC_LOAD_DATA_ = (.+?);<\/script>/s;
    const dataMatch = dataRegex.exec(html);
    
    if (dataMatch) {
      try {
        const formData = JSON.parse(dataMatch[1]);
        // Form fields are in the second item of the second array
        const formFields = formData[1][1];
        
        const entryIds = {};
        
        formFields.forEach(field => {
          const fieldName = field[1]; // Field name
          
          // Check if field has entry data
          if (field[4] && field[4][0]) {
            const entryId = field[4][0][0]; // Entry ID
            entryIds[fieldName] = `entry.${entryId}`;
          }
        });
        
        console.log("Successfully extracted entry IDs from form data");
        return entryIds;
      } catch (e) {
        console.error("Error parsing form data:", e.message);
        // If parsing fails, continue to the fallback approach
      }
    }

    // Fallback approach: Use DOM parsing with Cheerio
    console.log("Using fallback HTML parsing approach");
    const $ = cheerio.load(html);
    const entryIds = {};

    // Find form elements with entry ID patterns
    $('div[role="listitem"]').each((i, elem) => {
      // Find the question text/label
      let questionText = $(elem).find('.M7eMe').text().trim();
      
      if (!questionText) {
        // Try alternative selectors
        questionText = $(elem).find('.z6Bz3d').text().trim();
      }
      
      // Remove any HTML tags from question text
      questionText = questionText.replace(/<[^>]*>/g, '');
      
      // Skip if no question text found
      if (!questionText) return;
      
      // Find input elements with entry IDs
      let entryIdMatch = null;
      
      // Look for various form element types
      $(elem).find('input, textarea, select, [name*="entry."]').each((j, input) => {
        const nameAttr = $(input).attr('name');
        if (nameAttr && nameAttr.match(/entry\.\d+/)) {
          entryIdMatch = nameAttr.match(/entry\.\d+/)[0];
        }
      });
      
      // For checkbox/radio groups
      $(elem).find('input[type="hidden"][name*="entry."]').each((j, input) => {
        const nameAttr = $(input).attr('name');
        if (nameAttr && nameAttr.match(/entry\.\d+/)) {
          entryIdMatch = nameAttr.match(/entry\.\d+/)[0];
        }
      });
      
      // If we found an entry ID for this question
      if (entryIdMatch) {
        entryIds[questionText] = entryIdMatch;
      }
    });

    return entryIds;
  } catch (error) {
    console.error("Error fetching or parsing the form:", error.message);
    return {};
  }
}

module.exports = extractEntryIds;

// Example usage
if (require.main === module) {
  (async () => {
    // Replace with your Google Form URL
    const formUrl = 'https://docs.google.com/forms/d/1pAjCKEIjxavLQgQteqLhSoEIUtqvC-js8wUMvqow8o4/preview';
    console.log("Fetching Google Form entry IDs...");
    const result = await extractEntryIds(formUrl);
    console.log("Extracted Entry IDs:", JSON.stringify(result, null, 2));
  })();
}