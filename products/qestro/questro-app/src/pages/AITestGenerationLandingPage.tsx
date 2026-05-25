import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Code2, 
  CheckCircle, 
  ArrowRight, 
  FileCode,
  Zap,
  Target,
  Lightbulb,
  Layers,
  GitBranch,
  Cpu
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export default function AITestGenerationLandingPage() {
  useSEO({
    title: 'AI Test Generation | Intelligent Unit Test Creation from Code Analysis',
    description: 'Revolutionary AI-powered unit test generation. Upload your code and get comprehensive test suites instantly. Supports TypeScript, Python, Java, C#, and more with intelligent mock generation.',
    keywords: 'AI test generation, unit test generation, automated testing, code analysis, test automation, AI unit tests, intelligent testing, mock generation, test coverage',
    canonical: 'https://questro.io/ai-test-generation'
  });

  const supportedLanguages = [
    { name: "TypeScript", extension: ".ts", icon: "🔷", tests: "47 tests" },
    { name: "JavaScript", extension: ".js", icon: "🟨", tests: "32 tests" },
    { name: "Python", extension: ".py", icon: "🐍", tests: "38 tests" },
    { name: "Java", extension: ".java", icon: "☕", tests: "52 tests" },
    { name: "C#", extension: ".cs", icon: "#️⃣", tests: "41 tests" },
    { name: "Go", extension: ".go", icon: "🐹", tests: "29 tests" }
  ];

  const aiFeatures = [
    {
      icon: Brain,
      title: "Deep Code Analysis",
      description: "AI analyzes your code structure, dependencies, and complexity to generate comprehensive test coverage"
    },
    {
      icon: Target,
      title: "Edge Case Detection",
      description: "Intelligent identification of edge cases and boundary conditions that humans often miss"
    },
    {
      icon: Lightbulb,
      title: "Smart Mock Generation",
      description: "Automatically generates intelligent mocks for dependencies and external services"
    },
    {
      icon: Layers,
      title: "Framework Integration",
      description: "Generates tests in your preferred framework - Jest, PyTest, JUnit, NUnit, and more"
    }
  ];

  const codeExample = {
    input: `class UserService {
  constructor(private db: Database) {}
  
  async createUser(userData: UserData): Promise<User> {
    if (!userData.email) {
      throw new Error('Email required');
    }
    return await this.db.users.create(userData);
  }
}`,
    output: `describe('UserService', () => {
  let userService: UserService;
  let mockDatabase: jest.Mocked<Database>;

  beforeEach(() => {
    mockDatabase = createMockDatabase();
    userService = new UserService(mockDatabase);
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const userData = { email: 'test@example.com', name: 'John' };
      const expectedUser = { id: 1, ...userData };
      
      mockDatabase.users.create.mockResolvedValue(expectedUser);
      
      const result = await userService.createUser(userData);
      
      expect(result).toEqual(expectedUser);
      expect(mockDatabase.users.create).toHaveBeenCalledWith(userData);
    });

    it('should throw error when email is missing', async () => {
      const userData = { name: 'John' };
      
      await expect(userService.createUser(userData))
        .rejects.toThrow('Email required');
    });

    it('should handle database errors gracefully', async () => {
      const userData = { email: 'test@example.com' };
      mockDatabase.users.create.mockRejectedValue(new Error('DB Error'));
      
      await expect(userService.createUser(userData))
        .rejects.toThrow('DB Error');
    });
  });
});`
  };

  const stats = [
    { number: "95%", label: "Test Coverage", description: "Average coverage achieved" },
    { number: "< 30s", label: "Generation Time", description: "From code to tests" },
    { number: "15+", label: "Languages", description: "Supported languages" },
    { number: "10M+", label: "Tests Generated", description: "Across all projects" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white py-24">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8"
            >
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium">
                <Brain className="w-4 h-4 mr-2" />
                🧠 AI-Powered Test Generation Platform
              </div>
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              <span className="block">Intelligent</span>
              <span className="block bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Test Generation
              </span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
              Upload your code and get comprehensive unit tests in seconds. 
              AI analyzes your codebase and generates intelligent test suites with mocks, edge cases, and full coverage.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
            >
              <button className="group bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 hover:shadow-2xl">
                Generate Tests Now
                <ArrowRight className="inline-block w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="group border-2 border-white/30 hover:border-white/50 px-8 py-4 rounded-xl font-semibold text-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                <Code2 className="inline-block w-5 h-5 mr-2" />
                View Code Examples
              </button>
            </motion.div>

            {/* Quick Demo */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="max-w-5xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <div className="flex items-center space-x-4 mb-6">
                  <FileCode className="w-8 h-8 text-cyan-400" />
                  <div>
                    <h3 className="text-xl font-semibold">UserService.ts Analysis</h3>
                    <p className="text-cyan-200">AI generating comprehensive test suite...</p>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="text-sm text-gray-300 mb-1">Classes Found</div>
                    <div className="text-2xl font-bold text-white">3</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="text-sm text-gray-300 mb-1">Methods Analyzed</div>
                    <div className="text-2xl font-bold text-white">18</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="text-sm text-gray-300 mb-1">Tests Generated</div>
                    <div className="text-2xl font-bold text-green-300">47</div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-green-500/20 rounded-lg border border-green-500/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <Zap className="w-5 h-5 text-green-400" />
                    <span className="font-semibold text-green-400">Generation Complete</span>
                  </div>
                  <p className="text-sm text-green-200">
                    Generated 47 tests with 95% coverage in 23 seconds. Includes edge cases, mocks, and integration tests.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Supported Languages */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
              Multi-Language Support
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              AI understands syntax, patterns, and best practices across multiple programming languages
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {supportedLanguages.map((lang, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center"
              >
                <div className="text-4xl mb-4">{lang.icon}</div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">{lang.name}</h3>
                <p className="text-gray-500 text-sm mb-3">{lang.extension}</p>
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {lang.tests}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              From Code to Tests in Seconds
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See how AI transforms your source code into comprehensive test suites
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Code2 className="w-6 h-6 mr-2 text-blue-600" />
                Your Code
              </h3>
              <div className="bg-gray-900 rounded-xl p-6 text-green-400 font-mono text-sm overflow-x-auto">
                <pre>{codeExample.input}</pre>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Brain className="w-6 h-6 mr-2 text-purple-600" />
                AI Generated Tests
              </h3>
              <div className="bg-gray-900 rounded-xl p-6 text-green-400 font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap">{codeExample.output}</pre>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8">
              <h4 className="text-xl font-bold text-gray-900 mb-4">What AI Generated:</h4>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-gray-900">Smart Mocks</h5>
                    <p className="text-gray-600 text-sm">Database dependency mocked intelligently</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-gray-900">Edge Cases</h5>
                    <p className="text-gray-600 text-sm">Error conditions and boundary testing</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-gray-900">Best Practices</h5>
                    <p className="text-gray-600 text-sm">Jest patterns and proper assertions</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* AI Features */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Advanced AI Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our AI goes beyond simple code analysis to create intelligent, comprehensive test suites
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {aiFeatures.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className={`flex items-start space-x-4 ${index % 2 === 1 ? 'md:flex-row-reverse md:space-x-reverse md:text-right' : ''}`}
              >
                <div className={`bg-gradient-to-r from-blue-500 to-purple-500 p-4 rounded-2xl ${index % 2 === 1 ? 'md:order-2' : ''}`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <div className={`flex-1 ${index % 2 === 1 ? 'md:order-1' : ''}`}>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 text-lg">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Proven Results
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Thousands of developers trust our AI to generate high-quality tests
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2">{stat.number}</div>
                <div className="text-lg font-semibold text-gray-900 mb-1">{stat.label}</div>
                <div className="text-gray-600">{stat.description}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Options */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Multiple Integration Options
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Generate tests from various sources and integrate with your existing workflow
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg text-center"
            >
              <FileCode className="w-12 h-12 text-blue-600 mx-auto mb-6" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">File Upload</h3>
              <p className="text-gray-600 mb-4">
                Upload individual files or entire codebases for comprehensive test generation
              </p>
              <div className="text-sm text-gray-500">
                Supports: .ts, .js, .py, .java, .cs, .go
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-lg text-center"
            >
              <GitBranch className="w-12 h-12 text-purple-600 mx-auto mb-6" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">GitHub Integration</h3>
              <p className="text-gray-600 mb-4">
                Connect your GitHub repository for automated test generation on commits
              </p>
              <div className="text-sm text-gray-500">
                Works with: Public & private repos
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-8 shadow-lg text-center"
            >
              <Cpu className="w-12 h-12 text-green-600 mx-auto mb-6" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">API Integration</h3>
              <p className="text-gray-600 mb-4">
                Integrate test generation directly into your CI/CD pipeline
              </p>
              <div className="text-sm text-gray-500">
                REST API & CLI tools available
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Generate Intelligent Tests Today
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Upload your code and get comprehensive test suites in seconds. 
              Start improving your code quality with AI-powered testing.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center justify-center">
                Start Generating Tests
                <Brain className="w-5 h-5 ml-2" />
              </button>
              <button className="border-2 border-white hover:bg-white hover:text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                View Code Examples
              </button>
            </div>
            <p className="text-sm mt-6 opacity-75">
              Free test generation included • All languages supported • 14-day free trial
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}