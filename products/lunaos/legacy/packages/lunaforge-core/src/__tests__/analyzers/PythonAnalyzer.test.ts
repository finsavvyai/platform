/**
 * Tests for PythonAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PythonAnalyzer } from '../../analyzers/PythonAnalyzer';
import type { FileContent, FileAnalysisResult } from '../../types';

describe('PythonAnalyzer', () => {
  let analyzer: PythonAnalyzer;

  beforeEach(() => {
    analyzer = new PythonAnalyzer({
      includeBuiltins: false,
      followTypeImports: true
    });
  });

  describe('Language Support', () => {
    it('should support Python extensions', () => {
      expect(analyzer.getSupportedExtensions()).toContain('.py');
      expect(analyzer.getSupportedExtensions()).toContain('.pyi');
    });

    it('should report correct language name', () => {
      expect(analyzer.getLanguageName()).toBe('python');
    });

    it('should analyze supported files', () => {
      expect(analyzer.canAnalyze('file.py')).toBe(true);
      expect(analyzer.canAnalyze('file.pyi')).toBe(true);
      expect(analyzer.canAnalyze('module.py')).toBe(true);
    });

    it('should reject unsupported files', () => {
      expect(analyzer.canAnalyze('file.ts')).toBe(false);
      expect(analyzer.canAnalyze('file.js')).toBe(false);
      expect(analyzer.canAnalyze('file.txt')).toBe(false);
      expect(analyzer.canAnalyze('script.sh')).toBe(false);
    });
  });

  describe('Import Analysis', () => {
    it('should extract standard library imports', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          import os
          import sys
          import json
          from datetime import datetime, date
          from typing import Optional, List, Dict
        `,
        lastModified: Date.now(),
        size: 120,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies.length).toBeGreaterThan(0);

      const depPaths = result.dependencies.map(d => d.path);
      expect(depPaths).toContain('os');
      expect(depPaths).toContain('sys');
      expect(depPaths).toContain('json');
      expect(depPaths).toContain('datetime');
      expect(depPaths).toContain('typing');
    });

    it('should extract third-party imports', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          import numpy as np
          import pandas as pd
          import requests
          from flask import Flask, request
          from django.db import models
        `,
        lastModified: Date.now(),
        size: 100,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies.length).toBeGreaterThan(0);

      const depPaths = result.dependencies.map(d => d.path);
      expect(depPaths).toContain('numpy');
      expect(depPaths).toContain('pandas');
      expect(depPaths).toContain('requests');
      expect(depPaths).toContain('flask');
      expect(depPaths).toContain('django');
    });

    it('should extract local module imports', async () => {
      const content: FileContent = {
        path: '/test/src/main.py',
        content: `
          import local_module
          from . import utils
          from ..config import settings
          from package.submodule import helper
          import relative.module
        `,
        lastModified: Date.now(),
        size: 100,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies.length).toBeGreaterThan(0);

      // Should detect relative imports
      const localDeps = result.dependencies.filter(d =>
        d.path.startsWith('.') || d.path.includes('local_module')
      );
      expect(localDeps.length).toBeGreaterThan(0);
    });

    it('should handle alias imports', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          import numpy as np
          import pandas as pd
          from datetime import datetime as dt
          from typing import Dict as D
          import very.long.module.name as short_name
        `,
        lastModified: Date.now(),
        size: 120,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies.length).toBeGreaterThan(0);

      const depPaths = result.dependencies.map(d => d.path);
      expect(depPaths).toContain('numpy');
      expect(depPaths).toContain('pandas');
      expect(depPaths).toContain('datetime');
      expect(depPaths).toContain('typing');
      expect(depPaths).toContain('very.long.module.name');
    });

    it('should extract type hints', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          from typing import List, Dict, Optional, Union
          from dataclasses import dataclass
          from enum import Enum

          def process_items(items: List[str]) -> Dict[str, int]:
              return {}

          def get_user(user_id: int) -> Optional[User]:
              return None

          class MyClass:
              def method(self, param: Union[str, int]) -> bool:
                  return True
        `,
        lastModified: Date.now(),
        size: 200,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.typeHints.length).toBeGreaterThan(0);

      // Should detect various type hints
      expect(result.typeHints.some(th => th.includes('List'))).toBe(true);
      expect(result.typeHints.some(th => th.includes('Dict'))).toBe(true);
      expect(result.typeHints.some(th => th.includes('Optional'))).toBe(true);
      expect(result.typeHints.some(th => th.includes('Union'))).toBe(true);
    });
  });

  describe('Class and Function Analysis', () => {
    it('should extract class declarations', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          class UserService:
              def __init__(self):
                  self.users = []

          class OrderService:
              def process_order(self, order_id: str):
                  pass

          class InternalHelper:
              @staticmethod
              def format_name(name: str) -> str:
                  return name.strip()
        `,
        lastModified: Date.now(),
        size: 180,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.classes).toHaveLength(3);
      expect(result.classes).toContain('UserService');
      expect(result.classes).toContain('OrderService');
      expect(result.classes).toContain('InternalHelper');
    });

    it('should detect inheritance relationships', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          from base import BaseService
          from users import UserService

          class AdminService(UserService):
              def admin_only_method(self):
                  pass

          class SpecializedAdmin(AdminService, BaseService):
              def specialized_method(self):
                  pass
        `,
        lastModified: Date.now(),
        size: 140,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);

      // Check inheritance relationships
      const adminServiceInheritance = result.inheritance.find(
        inh => inh.className === 'AdminService'
      );
      expect(adminServiceInheritance?.parentClass).toBe('UserService');

      const specializedAdminInheritance = result.inheritance.find(
        inh => inh.className === 'SpecializedAdmin'
      );
      expect(specializedAdminInheritance?.parentClass).toContain('AdminService');
    });

    it('should extract function definitions', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          def calculate_total(items: List[Item]) -> float:
              return sum(item.price for item in items)

          def calculate_tax(amount: float, rate: float = 0.1) -> float:
              return amount * rate

          @decorator
          def decorated_function():
              pass

          @property
          def name_property(self) -> str:
              return self._name

          lambda_func = lambda x: x * 2
        `,
        lastModified: Date.now(),
        size: 180,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.functions.length).toBeGreaterThan(0);
      expect(result.functions).toContain('calculate_total');
      expect(result.functions).toContain('calculate_tax');
      expect(result.functions).toContain('decorated_function');
      expect(result.functions).toContain('name_property');
    });
  });

  describe('Export Analysis', () => {
    it('should extract __all__ exports', async () => {
      const content: FileContent = {
        path: '/test/module.py',
        content: `
          __all__ = ['public_function', 'PublicClass', 'CONSTANT']

          def public_function():
              pass

          def _private_function():
              pass

          class PublicClass:
              pass

          class _PrivateClass:
              pass

          CONSTANT = 42
          _PRIVATE_CONSTANT = 'secret'
        `,
        lastModified: Date.now(),
        size: 150,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.exports).toContain('public_function');
      expect(result.exports).toContain('PublicClass');
      expect(result.exports).toContain('CONSTANT');
      expect(result.exports).not.toContain('_private_function');
      expect(result.exports).not.toContain('_PrivateClass');
    });

    it('should handle modules without __all__', async () => {
      const content: FileContent = {
        path: '/test/module.py',
        content: `
          def function_one():
              pass

          class ClassOne:
              pass

          CONSTANT = 42

          def _private_function():
              pass
        `,
        lastModified: Date.now(),
        size: 80,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      // Should extract public symbols (not starting with underscore)
      expect(result.exports).toContain('function_one');
      expect(result.exports).toContain('ClassOne');
      expect(result.exports).toContain('CONSTANT');
      expect(result.exports).not.toContain('_private_function');
    });
  });

  describe('Code Metrics', () => {
    it('should calculate function count', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          def function_one():
              pass

          def function_two():
              return 'hello'

          class MyClass:
              def method_one(self):
                  pass

              @staticmethod
              def static_method():
                  pass

              @property
              def prop(self):
                  return 'property'

              def __init__(self):
                  pass
        `,
        lastModified: Date.now(),
        size: 120,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.metrics.functionCount).toBe(6); // 2 functions + 4 methods (including __init__)
    });

    it('should calculate class count', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          class UserService:
              pass

          class OrderService(UserService):
              pass

          class InternalHelper:
              pass

          class _PrivateClass:
              pass
        `,
        lastModified: Date.now(),
        size: 100,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.metrics.classCount).toBe(4);
    });

    it('should calculate complexity estimate', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          def process_items(items):
              if not items:
                  return 0

              total = 0
              for item in items:
                  if item.price > 100:
                      total += item.price * 0.9
                  elif item.price > 50:
                      total += item.price * 0.95
                  else:
                      total += item.price

              if total > 1000:
                  total *= 0.95

              return total
        `,
        lastModified: Date.now(),
        size: 180,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.metrics.complexity).toBeGreaterThan(0);
    });
  });

  describe('Built-in Library Detection', () => {
    it('should identify built-in libraries when enabled', async () => {
      const analyzerWithBuiltins = new PythonAnalyzer({ includeBuiltins: true });

      const content: FileContent = {
        path: '/test/file.py',
        content: `
          import os
          import sys
          import json
          import datetime
          import collections
          import itertools
          import third_party
        `,
        lastModified: Date.now(),
        size: 100,
        hash: 'test-hash'
      };

      const result = await analyzerWithBuiltins.analyzeFile(content);

      expect(result.success).toBe(true);

      // Should include built-in modules
      const builtinDeps = result.dependencies.filter(d => d.isBuiltin);
      expect(builtinDeps.length).toBeGreaterThan(0);

      // Should not mark third-party as built-in
      const thirdPartyDep = result.dependencies.find(d => d.path === 'third_party');
      expect(thirdPartyDep?.isBuiltin).toBe(false);
    });

    it('should exclude built-in libraries when disabled', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          import os
          import sys
          import third_party
        `,
        lastModified: Date.now(),
        size: 50,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);

      // Should not include built-in modules
      const builtinDeps = result.dependencies.filter(d => d.isBuiltin);
      expect(builtinDeps.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors gracefully', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          # Malformed Python syntax
          import
          def broken_function(
              pass
        `,
        lastModified: Date.now(),
        size: 50,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      // Should still return a result but indicate failure
      expect(result.success).toBe(false);
      expect(result.dependencies).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.functions).toHaveLength(0);
    });

    it('should handle empty files', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: '',
        lastModified: Date.now(),
        size: 0,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.functions).toHaveLength(0);
    });

    it('should handle files with only comments', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          """
          This is a docstring
          Multi-line comment
          """

          # Single line comment
          '''
          Another comment block
          '''
        `,
        lastModified: Date.now(),
        size: 80,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.dependencies).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.functions).toHaveLength(0);
    });

    it('should handle complex nested structures', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          try:
              import complex_module
          except ImportError:
              import fallback_module

          class OuterClass:
              class InnerClass:
                  def nested_method(self):
                      try:
                          result = some_function()
                      except Exception as e:
                          if isinstance(e, ValueError):
                              handle_error()
                          else:
                              raise

              @staticmethod
              def static_method():
                  with open('file.txt') as f:
                      data = f.read()
                  return data

              async def async_method(self):
                  async with aiohttp.ClientSession() as session:
                      async with session.get(url) as response:
                          return await response.json()
        `,
        lastModified: Date.now(),
        size: 300,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.classes).toContain('OuterClass');
      expect(result.classes).toContain('InnerClass');
      expect(result.dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Python Features', () => {
    it('should handle async/await syntax', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          import asyncio

          async def fetch_data(url: str):
              async with aiohttp.ClientSession() as session:
                  async with session.get(url) as response:
                      return await response.json()

          async def process_items(items):
              tasks = [fetch_data(item.url) for item in items]
              results = await asyncio.gather(*tasks)
              return results
        `,
        lastModified: Date.now(),
        size: 150,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.functions).toContain('fetch_data');
      expect(result.functions).toContain('process_items');
      expect(result.dependencies).toContain('asyncio');
    });

    it('should handle context managers', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          class DatabaseConnection:
              def __enter__(self):
                  return self

              def __exit__(self, exc_type, exc_val, exc_tb):
                  self.close()

              def close(self):
                  pass

          def process_data():
              with DatabaseConnection() as conn:
                  with open('data.txt', 'r') as f:
                      data = f.read()
              return data
        `,
        lastModified: Date.now(),
        size: 120,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.classes).toContain('DatabaseConnection');
      expect(result.functions).toContain('process_data');
    });

    it('should handle decorators and annotations', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          from functools import wraps
          from typing import TypeVar, Generic

          T = TypeVar('T')

          def decorator(func):
              @wraps(func)
              def wrapper(*args, **kwargs):
                  return func(*args, **kwargs)
              return wrapper

          class GenericClass(Generic[T]):
              def __init__(self, value: T):
                  self.value = value

          @decorator
          @another_decorator(param='value')
          def decorated_function(param: str) -> bool:
              return True

          class DataClass:
              __annotations__ = {
                  'name': str,
                  'age': int,
                  'active': bool
              }
        `,
        lastModified: Date.now(),
        size: 150,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);
      expect(result.classes).toContain('GenericClass');
      expect(result.classes).toContain('DataClass');
      expect(result.functions).toContain('decorated_function');
      expect(result.dependencies).toContain('functools');
      expect(result.dependencies).toContain('typing');
    });
  });

  describe('Dependency Type Classification', () => {
    it('should classify dependencies correctly', async () => {
      const content: FileContent = {
        path: '/test/file.py',
        content: `
          import os                    # Built-in
          import numpy as np           # Third-party
          import local_module          # Local
          from .utils import helper    # Relative local
          import package.submodule     # Package (could be local or third-party)
        `,
        lastModified: Date.now(),
        size: 100,
        hash: 'test-hash'
      };

      const result = await analyzer.analyzeFile(content);

      expect(result.success).toBe(true);

      // Check dependency classifications
      const deps = result.dependencies;
      expect(deps.length).toBeGreaterThan(0);

      // All should be marked as external by default (Python doesn't distinguish like TypeScript)
      const externalDeps = deps.filter(d => d.isExternal);
      expect(externalDeps.length).toBeGreaterThan(0);
    });
  });
});