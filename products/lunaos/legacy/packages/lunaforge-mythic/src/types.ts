export interface MythicStory {
  title: string;
  text: string;
}

export interface MythicModelOutputFile {
  path: string;
  content: string;
}

export interface MythicModelOutput {
  architecture: string;
  diagram: string;
  files: MythicModelOutputFile[];
}
