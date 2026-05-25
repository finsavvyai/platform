import { WorkflowsClient } from './WorkflowsClient';

export const metadata = { title: 'SOAR Workflows' };

export default function WorkflowsPage(): React.ReactElement {
  return <WorkflowsClient />;
}
