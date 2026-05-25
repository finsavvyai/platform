// Project Structure Generation Example
import { ProjectStructureGenerator } from '../../backend/src/services/ProjectStructureGenerator.js';

const structureGenerator = new ProjectStructureGenerator();
const structure = await structureGenerator.generateProjectStructure(configuration);

console.log('📁 Generated Project Structure:');
console.log(`- Total Files: ${structure.metadata.totalFiles}`);
console.log(`- Directories: ${structure.metadata.totalDirectories}`);
console.log(`- Estimated Size: ${structure.metadata.estimatedSize}MB`);