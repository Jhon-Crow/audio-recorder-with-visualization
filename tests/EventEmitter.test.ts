import { EventEmitter } from '../src/core/EventEmitter';

type TestEvents = {
  'test': string;
  'data': { value: number };
  'empty': void;
  [key: string]: unknown;
};

describe('EventEmitter', () => {
  let emitter: EventEmitter<TestEvents>;

  beforeEach(() => {
    emitter = new (class extends EventEmitter<TestEvents> {
      public testEmit<E extends keyof TestEvents>(event: E, data: TestEvents[E]): void {
        this.emit(event, data);
      }
    })();
  });

  test('should register and call event handlers', () => {
    const handler = jest.fn();
    emitter.on('test', handler);

    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'hello');

    expect(handler).toHaveBeenCalledWith('hello');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('should unsubscribe using returned function', () => {
    const handler = jest.fn();
    const unsubscribe = emitter.on('test', handler);

    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'first');
    unsubscribe();
    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  test('should unsubscribe using off method', () => {
    const handler = jest.fn();
    emitter.on('test', handler);

    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'first');
    emitter.off('test', handler);
    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('should call once handler only once', () => {
    const handler = jest.fn();
    emitter.once('test', handler);

    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'first');
    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  test('should support multiple handlers for same event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    emitter.on('test', handler1);
    emitter.on('test', handler2);

    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'data');

    expect(handler1).toHaveBeenCalledWith('data');
    expect(handler2).toHaveBeenCalledWith('data');
  });

  test('should handle object data', () => {
    const handler = jest.fn();
    emitter.on('data', handler);

    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'data', data: { value: number }) => void }).testEmit('data', { value: 42 });

    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  test('should remove all listeners for specific event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    emitter.on('test', handler1);
    emitter.on('test', handler2);

    emitter.removeAllListeners('test');

    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'data');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  test('should remove all listeners when called without arguments', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    emitter.on('test', handler1);
    emitter.on('data', handler2);

    emitter.removeAllListeners();

    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'data');
    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'data', data: { value: number }) => void }).testEmit('data', { value: 1 });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  test('should handle errors in handlers gracefully', () => {
    const errorHandler = jest.fn(() => {
      throw new Error('Handler error');
    });
    const normalHandler = jest.fn();

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    emitter.on('test', errorHandler);
    emitter.on('test', normalHandler);

    (emitter as EventEmitter<TestEvents> & { testEmit: (event: 'test', data: string) => void }).testEmit('test', 'data');

    expect(errorHandler).toHaveBeenCalled();
    expect(normalHandler).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
