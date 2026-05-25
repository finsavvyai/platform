import { vi } from 'vitest';

/**
 * Create a mock Drizzle DB that returns controlled data.
 *
 * The mock is chainable AND thenable to match Drizzle's query builder API:
 *   db.select().from(table).where(condition).orderBy(...).limit(n)
 *   db.select({...}).from(table).innerJoin(...).where(condition)
 *   db.insert(table).values(data)
 *   db.update(table).set(data).where(condition)
 *
 * Use _setSelectResult(data) to control what queries return.
 * Use _setSelectResults([data1, data2]) for multiple sequential queries.
 */
export function createMockDb() {
  let selectResults: unknown[][] = [[]];
  let selectCallIndex = 0;

  const consumeResult = () => {
    const result = selectResults[selectCallIndex] || [];
    selectCallIndex++;
    return result;
  };

  const makeThenable = (): any => {
    const obj: any = {};

    obj.from = vi.fn(() => makeThenable());
    obj.where = vi.fn(() => makeThenable());
    obj.groupBy = vi.fn(() => makeThenable());
    obj.orderBy = vi.fn(() => makeThenable());
    obj.limit = vi.fn(() => makeThenable());
    obj.offset = vi.fn(() => makeThenable());
    obj.innerJoin = vi.fn(() => makeThenable());
    obj.$dynamic = vi.fn(() => makeThenable());

    obj.then = (resolve: any, reject?: any) => {
      return Promise.resolve().then(() => {
        try {
          return resolve(consumeResult());
        } catch (err) {
          if (reject) return reject(err);
          throw err;
        }
      });
    };

    return obj;
  };

  const insertChain = {
    values: vi.fn().mockResolvedValue(undefined),
  };

  const updateSetChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };

  const updateChain = {
    set: vi.fn().mockReturnValue(updateSetChain),
  };

  const deleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };

  return {
    select: vi.fn(() => makeThenable()),
    selectDistinct: vi.fn(() => makeThenable()),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    delete: vi.fn().mockReturnValue(deleteChain),
    batch: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    _insertChain: insertChain,
    _updateChain: updateChain,
    _updateSetChain: updateSetChain,
    _deleteChain: deleteChain,
    _setSelectResult: (data: unknown[]) => {
      selectResults = [data];
      selectCallIndex = 0;
    },
    _setSelectResults: (results: unknown[][]) => {
      selectResults = results;
      selectCallIndex = 0;
    },
    _reset: () => {
      selectResults = [[]];
      selectCallIndex = 0;
      vi.clearAllMocks();
    },
  };
}
