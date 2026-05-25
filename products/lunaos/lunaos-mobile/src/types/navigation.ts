/**
 * Navigation type definitions for type-safe routing.
 */

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Agents: undefined;
  History: undefined;
  Settings: undefined;
};

export type AgentsStackParamList = {
  AgentList: undefined;
  AgentExecute: { slug: string; name: string; category: string };
};
