/**
 * Basic Jest Test
 * Simple test to verify Jest configuration is working
 */

describe('Basic Jest Configuration', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toBe('hello');
    expect(true).toBe(true);
  });

  it('should support async tests', async () => {
    const asyncFunction = async () => {
      return Promise.resolve('async result');
    };

    const result = await asyncFunction();
    expect(result).toBe('async result');
  });

  it('should support TypeScript', () => {
    interface TestInterface {
      name: string;
      value: number;
    }

    const testObject: TestInterface = {
      name: 'test',
      value: 42
    };

    expect(testObject.name).toBe('test');
    expect(testObject.value).toBe(42);
  });

  it('should support ES modules', () => {
    const testArray = [1, 2, 3, 4, 5];
    const doubled = testArray.map(x => x * 2);
    
    expect(doubled).toEqual([2, 4, 6, 8, 10]);
  });
});