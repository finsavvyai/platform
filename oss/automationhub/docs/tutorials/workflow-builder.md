# Workflow Builder Tutorial

## 🎯 Learning Objectives

By the end of this tutorial, you will be able to:
- Create your first automation workflow
- Understand different node types and their purposes
- Connect nodes to build automation flows
- Test and execute workflows
- Debug common workflow issues

## 📋 Prerequisites

- UPM.Plus account (free tier is sufficient)
- Basic understanding of automation concepts
- No programming experience required

## 🚀 Tutorial: Building Your First Workflow

### Step 1: Navigate to the Workflow Builder

1. Log in to your UPM.Plus dashboard
2. Click on **"Workflows"** in the navigation menu
3. Click **"Create New Workflow"** button

### Step 2: Add a Trigger Node

Every workflow needs a starting point. Let's add a manual trigger:

1. Click the **"Add Node"** button in the toolbar
2. Select **"Trigger"** from the menu
3. Choose **"Manual Trigger"** from the trigger types
4. Double-click the trigger node to rename it to "Start Workflow"

**💡 Pro Tip**: Manual triggers are great for testing. Later you can switch to automated triggers like schedules or webhooks.

### Step 3: Add an Agent Node

Let's add a Browser Agent to perform web automation:

1. Click **"Add Node"** again
2. Select **"Agent"** → **"Browser Agent"**
3. Place the node to the right of the trigger
4. Connect the trigger to the agent by dragging from the trigger's output handle to the agent's input handle

### Step 4: Configure the Browser Agent

1. Double-click the Browser Agent node
2. Set the **Action** to "Navigate to URL"
3. Enter **https://example.com** in the URL field
4. Add a description: "Navigate to example website"

### Step 5: Add a Data Extraction Node

Let's extract information from the webpage:

1. Add another **Browser Agent** node
2. Set the **Action** to "Extract Text"
3. Enter a CSS selector in the **Target** field: `h1`
4. This will extract the main heading from the page

### Step 6: Add a Condition Node

Let's check if we successfully extracted data:

1. Click **"Add Node"** → **"Condition"**
2. Set the **Condition** to: `extracted_text is not empty`
3. This creates a branching point in our workflow

### Step 7: Add Success and Failure Paths

**Success Path** (when text is extracted):
1. Add a **Data Node** to store the extracted text
2. Configure it to save the result

**Failure Path** (when extraction fails):
1. Add an **Action Node** to send an error notification
2. Configure it with an error message

### Step 8: Connect Everything

Your workflow should look like this:

```
[Manual Trigger] → [Browser Agent: Navigate] → [Browser Agent: Extract] → [Condition]
                                                                        ↓
                                                                    [Success] → [Data Node]
                                                                        ↓
                                                                    [Failure] → [Action Node]
```

### Step 9: Test Your Workflow

1. Click the **"Test"** button in the toolbar
2. Review the workflow configuration
3. Click **"Run Test"**
4. Watch the execution in real-time
5. Check the results in the output panel

### Step 10: Execute the Workflow

1. Save your workflow by clicking **"Save"**
2. Give it a name: "My First Web Scraper"
3. Click **"Execute"** to run it for real
4. Monitor the execution in the dashboard

## 🔧 Advanced Workflow Features

### Variables and Data Flow

Workflows can pass data between nodes:

1. **Reference Previous Results**: Use `{{node_id.output}}` syntax
2. **Global Variables**: Define variables that persist across workflow executions
3. **Environment Variables**: Use system-wide configurations

### Error Handling

Make your workflows more robust:

1. **Try-Catch Blocks**: Wrap risky operations in error handling
2. **Retry Logic**: Configure automatic retries for failed operations
3. **Fallback Paths**: Define alternative execution paths

### Looping and Iteration

Process multiple items:

1. **For Each Loop**: Iterate over lists of data
2. **While Loop**: Continue until a condition is met
3. **Break Conditions**: Exit loops early when needed

## 📊 Real-World Examples

### Example 1: Daily Website Monitor

Create a workflow that:
1. Triggers every day at 9 AM
2. Visits a target website
3. Checks for specific content
4. Sends an email if content is found
5. Logs the result

### Example 2: Social Media Automation

Build a workflow that:
1. Monitors an RSS feed
2. Generates social media posts
3. Posts to multiple platforms
4. Tracks engagement metrics
5. Creates a weekly report

### Example 3: Data Processing Pipeline

Create a workflow that:
1. Watches a folder for new files
2. Processes uploaded documents
3. Extracts key information
4. Stores results in a database
5. Sends notifications

## 🛠️ Workflow Templates

Save time with pre-built templates:

### Web Scraping Template
- Navigate to website
- Handle login/authentication
- Extract data with multiple selectors
- Save to CSV/JSON
- Error handling and retries

### API Integration Template
- Authenticate with API
- Make HTTP requests
- Process response data
- Handle rate limiting
- Store results

### File Processing Template
- Watch folder for new files
- Validate file format
- Process file contents
- Generate output files
- Clean up temporary files

## 🔍 Debugging Workflows

### Common Issues and Solutions

**Issue**: Workflow gets stuck at a node
- **Solution**: Check node configuration, verify credentials, review error logs

**Issue**: Data not passing between nodes
- **Solution**: Check variable names, verify data types, ensure connections are correct

**Issue**: Workflow runs but produces no output
- **Solution**: Add logging nodes, check data transformations, verify success conditions

### Debugging Tools

1. **Execution Logs**: Detailed step-by-step execution information
2. **Variable Inspector**: View variable values at each step
3. **Performance Metrics**: Identify bottlenecks and slow operations
4. **Test Mode**: Run workflows with sample data

## 📈 Best Practices

### Workflow Design

1. **Start Simple**: Build and test small components first
2. **Modular Design**: Create reusable workflow components
3. **Clear Naming**: Use descriptive names for nodes and variables
4. **Error Handling**: Always include error handling and logging
5. **Documentation**: Add comments and descriptions for complex logic

### Performance Optimization

1. **Parallel Execution**: Use parallel processing where possible
2. **Caching**: Store frequently used data
3. **Batching**: Process multiple items together
4. **Resource Management**: Monitor and optimize resource usage

### Security Considerations

1. **Credential Management**: Use secure credential storage
2. **Input Validation**: Validate all external inputs
3. **Access Control**: Limit workflow permissions
4. **Audit Logging**: Track workflow executions

## 🎓 Next Steps

Congratulations! You've built your first workflow. Here are some next topics to explore:

1. [Advanced Node Types](advanced-nodes.md) - Learn about specialized nodes
2. [API Integration](api-integration.md) - Connect with external services
3. [Multi-Agent Workflows](multi-agent.md) - Coordinate multiple AI agents
4. [Workflow Templates](templates.md) - Use and create templates
5. [Performance Optimization](optimization.md) - Make workflows faster

## 🤝 Community and Support

- **Share Your Workflows**: Export and share workflows with the community
- **Get Help**: Join our Discord server for community support
- **Request Features**: Suggest new node types and workflow features
- **Report Issues**: Help us improve by reporting bugs

## 📚 Additional Resources

- [Video Tutorial: Building Your First Workflow](https://youtube.com/watch?v=example)
- [Workflow Examples Gallery](../examples/)
- [API Reference](../api-reference/)
- [Troubleshooting Guide](../troubleshooting.md)

---

**Ready to automate?** [Start building your workflow now](https://upmplus.ai/workflows)