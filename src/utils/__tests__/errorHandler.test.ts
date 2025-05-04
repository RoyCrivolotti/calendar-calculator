import { 
  BaseError, 
  DatabaseError, 
  ValidationError, 
  handleError, 
  withErrorHandling,
  formatErrorResponse
} from '../errorHandler';
import { getLogger } from '../logger';

// Mock the logger
jest.mock('../logger', () => ({
  getLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('Error Handler', () => {
  let mockLogger: { error: jest.Mock };
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = getLogger('errors') as unknown as { error: jest.Mock };
  });
  
  test('BaseError should capture error properties', () => {
    const error = new BaseError('Test error', 'TEST_ERROR', 400);
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('BaseError');
    expect(error.stack).toBeDefined();
    expect(error.timestamp).toBeInstanceOf(Date);
  });
  
  test('Specialized error classes should inherit from BaseError', () => {
    const dbError = new DatabaseError('Database error');
    const validationError = new ValidationError('Validation error');
    
    expect(dbError).toBeInstanceOf(BaseError);
    expect(validationError).toBeInstanceOf(BaseError);
    
    expect(dbError.code).toBe('DATABASE_ERROR');
    expect(validationError.code).toBe('VALIDATION_ERROR');
    
    expect(dbError.statusCode).toBe(500);
    expect(validationError.statusCode).toBe(400);
  });
  
  test('BaseError.toJSON should return formatted error details', () => {
    const originalError = new Error('Original error');
    const context = { userId: '123' };
    const error = new BaseError('Test error', 'TEST_ERROR', 400, originalError, context);
    
    const json = error.toJSON();
    
    expect(json.name).toBe('BaseError');
    expect(json.message).toBe('Test error');
    expect(json.code).toBe('TEST_ERROR');
    expect(json.statusCode).toBe(400);
    expect(json.context).toEqual(context);
    expect(json.originalError).toBeDefined();
    expect(json.originalError.name).toBe('Error');
    expect(json.originalError.message).toBe('Original error');
  });
  
  test('handleError should log errors with context', () => {
    const error = new BaseError('Test error', 'TEST_ERROR', 400);
    const context = { userId: '123' };
    
    handleError(error, context);
    
    expect(mockLogger.error).toHaveBeenCalled();
    const logArgs = mockLogger.error.mock.calls[0];
    expect(logArgs[0]).toContain('TEST_ERROR');
    expect(logArgs[0]).toContain('Test error');
  });
  
  test('handleError should convert regular errors to BaseError', () => {
    const error = new Error('Regular error');
    
    handleError(error);
    
    expect(mockLogger.error).toHaveBeenCalled();
    const logArgs = mockLogger.error.mock.calls[0];
    expect(logArgs[0]).toContain('UNKNOWN_ERROR');
    expect(logArgs[0]).toContain('Regular error');
  });
  
  test('withErrorHandling should handle errors in async functions', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Async error'));
    
    await expect(withErrorHandling(mockFn, 'Operation failed')).rejects.toThrow('Async error');
    
    expect(mockLogger.error).toHaveBeenCalled();
  });
  
  test('formatErrorResponse should format error for API responses', () => {
    const error = new ValidationError('Invalid input', 'INVALID_INPUT', 422);
    
    const response = formatErrorResponse(error);
    
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe('INVALID_INPUT');
    expect(response.error.message).toBe('Invalid input');
    expect(response.error.statusCode).toBe(422);
  });
  
  test('formatErrorResponse should handle regular errors', () => {
    const error = new Error('Regular error');
    
    const response = formatErrorResponse(error);
    
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe('INTERNAL_ERROR');
    expect(response.error.message).toBe('Regular error');
    expect(response.error.statusCode).toBe(500);
  });
}); 