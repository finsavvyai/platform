import { artifactsApi } from './artifacts';
import { auditApi } from './audit';
import { billingApi } from './billing';
import { channelsApi } from './channels';
import { projectsApi } from './projects';
import { runnersApi } from './runners';
import { runsApi } from './runs';
import { usersApi } from './users';

export * from './types';
export {
  artifactsApi,
  auditApi,
  billingApi,
  channelsApi,
  projectsApi,
  runnersApi,
  runsApi,
  usersApi,
};

export const api = {
  // Runs
  getRuns: runsApi.list,
  getRun: runsApi.get,
  getRunLogs: runsApi.getLogs,
  rerun: runsApi.rerun,
  cancelRun: runsApi.cancel,
  // Projects
  getProjects: projectsApi.list,
  fetchGitHubRepos: projectsApi.listGitHubRepos,
  disconnectProject: projectsApi.disconnect,
  createProject: projectsApi.create,
  bootstrapProjectAccess: projectsApi.bootstrapAccess,
  getProjectAccess: projectsApi.getAccess,
  getProjectMemberships: projectsApi.listMemberships,
  // Runners
  getRunnerPool: runnersApi.getPool,
  getProjectRunners: runnersApi.listForProject,
  createRunnerRegistrationToken: runnersApi.createRegistrationToken,
  deleteRunner: runnersApi.remove,
  // Channels
  getChannels: channelsApi.list,
  connectChannel: channelsApi.connect,
  disconnectChannel: channelsApi.disconnect,
  testChannel: channelsApi.test,
  getChannelMessages: channelsApi.listMessages,
  // Artifacts
  getArtifactSizes: artifactsApi.listSizes,
  // Audit
  getAuditLogs: auditApi.listLogs,
};
