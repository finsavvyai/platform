import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReveal } from './useReveal'

const configs: Record<string, { file: string; lines: string[] }> = {
  'GitHub Actions': {
    file: '.github/workflows/ci.yml',
    lines: [
      'name: CI',
      'on: [push, pull_request]',
      'jobs:',
      '  build:',
      '    runs-on: ubuntu-latest',
      '    strategy:',
      '      matrix:',
      '        node-version: [18.x, 20.x]',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - uses: actions/setup-node@v4',
      '        with:',
      '          node-version: ${{ matrix.node }}',
      '      - run: npm ci',
      '      - run: npm test',
      '      - run: npm run build',
      '      - uses: actions/upload-artifact@v4',
      '      - name: Deploy',
      '        run: ./deploy.sh',
      '        env:',
      '          TOKEN: ${{ secrets.DEPLOY }}',
    ],
  },
  'GitLab CI': {
    file: '.gitlab-ci.yml',
    lines: [
      'stages:',
      '  - test',
      '  - build',
      '  - deploy',
      '',
      'test:',
      '  stage: test',
      '  image: node:20',
      '  script:',
      '    - npm ci',
      '    - npm test',
      '',
      'build:',
      '  stage: build',
      '  image: node:20',
      '  script:',
      '    - npm run build',
      '  artifacts:',
      '    paths:',
      '      - dist/',
      '',
      'deploy:',
      '  stage: deploy',
      '  script:',
      '    - ./deploy.sh',
    ],
  },
  'CircleCI': {
    file: '.circleci/config.yml',
    lines: [
      'version: 2.1',
      'jobs:',
      '  build:',
      '    docker:',
      '      - image: cimg/node:20.0',
      '    steps:',
      '      - checkout',
      '      - run: npm ci',
      '      - run: npm test',
      '      - run: npm run build',
      'workflows:',
      '  main:',
      '    jobs:',
      '      - build',
    ],
  },
  'Jenkinsfile': {
    file: 'Jenkinsfile',
    lines: [
      'pipeline {',
      '    agent any',
      '    stages {',
      '        stage("Install") {',
      '            steps {',
      '                sh "npm ci"',
      '            }',
      '        }',
      '        stage("Test") {',
      '            steps {',
      '                sh "npm test"',
      '            }',
      '        }',
      '        stage("Build") {',
      '            steps {',
      '                sh "npm run build"',
      '            }',
      '        }',
      '    }',
      '}',
    ],
  },
}

const configNames = Object.keys(configs)

export function YAMLKiller() {
  const ref = useReveal()
  const [active, setActive] = useState('GitHub Actions')
  const config = configs[active]

  return (
    <section ref={ref} className="reveal py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <div className="max-w-lg">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-t1">
            {config.lines.length} lines of config,<br />
            <span className="text-t3">or one command.</span>
          </h2>
          <p className="mt-4 text-t2 leading-relaxed">
            Every CI tool asks you to write a config file. PushCI reads your code instead.
          </p>
          <Link
            to="/vs/github-actions"
            className="mt-6 inline-block text-body text-t2 hover:text-t1 transition-colors duration-200 underline underline-offset-4 decoration-border-base"
          >
            See the full comparison
          </Link>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 items-start">
          {/* Before */}
          <div className="rounded-lg border border-border-base bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-base/60 px-4 py-2.5">
              <span className="text-caption font-mono text-t3">{config.file}</span>
              <div className="flex items-center gap-1">
                {configNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActive(name)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors duration-150 ${
                      active === name
                        ? 'bg-raised text-t2'
                        : 'text-t3 hover:text-t2'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <pre className="p-4 text-[12px] leading-5 text-t3 font-mono overflow-x-auto max-h-[400px] overflow-y-auto">
              {config.lines.map((line, i) => (
                <div key={`${active}-${i}`}>
                  <span className="text-border-base select-none mr-3 inline-block w-4 text-right">{i + 1}</span>
                  {line}
                </div>
              ))}
            </pre>
          </div>

          {/* After */}
          <div className="rounded-lg border border-border-base bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-base/60 px-4 py-2.5">
              <span className="text-caption font-mono text-t3">terminal</span>
              <span className="text-[10px] text-accent/80 bg-accent/10 px-2 py-0.5 rounded">1 command</span>
            </div>
            <div className="p-4 flex flex-col justify-center min-h-[300px] sm:min-h-[380px]">
              <div className="font-mono text-base text-t1 mb-8">
                <span className="text-t3">$</span> npx pushci init
              </div>
              <div className="space-y-4 text-body text-t2">
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 mt-0.5 text-accent shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <div>
                    <div className="text-t2">Stack detected</div>
                    <div className="text-[12px] text-t3">Next.js, TypeScript, PostgreSQL, Jest</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 mt-0.5 text-accent shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <div>
                    <div className="text-t2">Pipeline generated</div>
                    <div className="text-[12px] text-t3">{'build > test > lint > deploy'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 mt-0.5 text-accent shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <div>
                    <div className="text-t2">Git hooks installed</div>
                    <div className="text-[12px] text-t3">Tests run on every push automatically</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 mt-0.5 text-accent shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <div>
                    <div className="text-t2">Deploy configured</div>
                    <div className="text-[12px] text-t3">Vercel, detected from vercel.json</div>
                  </div>
                </div>
              </div>
              <div className="mt-8 text-[12px] text-t3 font-mono">
                Done in 28s.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
