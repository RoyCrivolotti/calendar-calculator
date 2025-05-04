import { Logger, LogLevel } from '../logger';

// Mock console methods
const originalConsole = { ...console };
let consoleLogMock: jest.SpyInstance;
let consoleErrorMock: jest.SpyInstance;
let consoleWarnMock: jest.SpyInstance;
let consoleDebugMock: jest.SpyInstance;

describe('Logger', () => {
  beforeEach(() => {
    // Mock console methods
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation();
    consoleDebugMock = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    // Restore console methods
    consoleLogMock.mockRestore();
    consoleErrorMock.mockRestore();
    consoleWarnMock.mockRestore();
    consoleDebugMock.mockRestore();
  });

  test('should log messages at the appropriate level', () => {
    const logger = new Logger({ level: LogLevel.INFO });
    
    logger.error('Error message');
    logger.warn('Warning message');
    logger.info('Info message');
    logger.debug('Debug message'); // Should not be logged
    
    expect(consoleErrorMock).toHaveBeenCalled();
    expect(consoleWarnMock).toHaveBeenCalled();
    expect(consoleLogMock).toHaveBeenCalled();
    expect(consoleDebugMock).not.toHaveBeenCalled();
  });

  test('should respect log level configuration', () => {
    const logger = new Logger({ level: LogLevel.ERROR });
    
    logger.error('Error message');
    logger.warn('Warning message'); // Should not be logged
    logger.info('Info message');    // Should not be logged
    logger.debug('Debug message');  // Should not be logged
    
    expect(consoleErrorMock).toHaveBeenCalled();
    expect(consoleWarnMock).not.toHaveBeenCalled();
    expect(consoleLogMock).not.toHaveBeenCalled();
    expect(consoleDebugMock).not.toHaveBeenCalled();
  });

  test('should include timestamp when configured', () => {
    const logger = new Logger({
      level: LogLevel.INFO,
      includeTimestamp: true,
      timestampFormat: 'ISO'
    });
    
    logger.info('Info with timestamp');
    
    // The first argument to console.log should include a timestamp in brackets
    const call = consoleLogMock.mock.calls[0];
    expect(call[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]/);
  });

  test('should create child loggers with inherited config', () => {
    const parentLogger = new Logger({ level: LogLevel.INFO });
    const childLogger = parentLogger.child({ module: 'test-module' });
    
    childLogger.info('Child logger message');
    childLogger.debug('Should not be logged');
    
    expect(consoleLogMock).toHaveBeenCalled();
    expect(consoleDebugMock).not.toHaveBeenCalled();
  });

  test('should set and use context', () => {
    const logger = new Logger({ level: LogLevel.INFO, structured: true });
    logger.setContext({ app: 'calendar', user: 'test-user' });
    
    logger.info('Info with context');
    
    // In structured mode, context should be in the JSON string
    const jsonString = JSON.stringify(JSON.parse(consoleLogMock.mock.calls[0][0]));
    expect(jsonString).toContain('calendar');
    expect(jsonString).toContain('test-user');
  });

  test('should format structured logs as JSON', () => {
    const logger = new Logger({ 
      level: LogLevel.INFO, 
      structured: true,
      context: { app: 'calendar' }
    });
    
    logger.info('Structured log message', { data: 'test-data' });
    
    const logArg = consoleLogMock.mock.calls[0][0];
    expect(typeof logArg).toBe('string');
    
    const parsed = JSON.parse(logArg);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('level', 'INFO');
    expect(parsed).toHaveProperty('message', 'Structured log message');
    expect(parsed.context).toHaveProperty('app', 'calendar');
    expect(parsed.data[0]).toHaveProperty('data', 'test-data');
  });

  test('should update config with setConfig', () => {
    const logger = new Logger({ level: LogLevel.ERROR });
    logger.info('Should not be logged');
    
    logger.setConfig({ level: LogLevel.INFO });
    logger.info('Should be logged');
    
    expect(consoleLogMock).toHaveBeenCalledTimes(1);
  });

  test('should track request ID', () => {
    const logger = new Logger({ level: LogLevel.INFO });
    const requestId = 'req-123';
    
    logger.setRequestId(requestId);
    logger.info('Request log');
    
    const logCall = consoleLogMock.mock.calls[0];
    expect(logCall[0]).toContain(requestId);
    
    logger.clearRequestId();
    logger.info('Another log');
    
    const secondLogCall = consoleLogMock.mock.calls[1];
    expect(secondLogCall[0]).not.toContain(requestId);
  });
}); 