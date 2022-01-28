import { ApiError } from '../../src/utils/ApiError';
import ApiErrs from '../../src/utils/ApiErrs';

describe('Create ApiError based on Error', () => {
  test('With default values (but logging disabled)', () => {
    const error = new Error('test');
    const apiError = ApiError.fromError(error, undefined, false);

    expect(apiError.httpCode).toBe(500);
    expect(apiError.message).toBe('An error occurred');
    expect(apiError.stack).toBe(error.stack);
    expect(apiError.internalDetails).toStrictEqual({message: 'test'});
  });

  test('With internal details and http code 404', () => {
    const testDate = new Date();

    const error = new Error('test');
    const apiError = ApiError.fromError(error, 404, false, {testDate});

    expect(apiError.httpCode).toBe(404);
    expect(apiError.message).toBe('An error occurred');
    expect(apiError.stack).toBe(error.stack);
    expect(apiError.internalDetails).toStrictEqual({testDate, message: 'test'});
  });

  test(`With internal details with key 'message'`, () => {
    const error = new Error('test');
    const apiError = ApiError.fromError(error, 404, false, {message: 'Hello'});

    expect(apiError.httpCode).toBe(404);
    expect(apiError.message).toBe('An error occurred');
    expect(apiError.stack).toBe(error.stack);
    expect(apiError.internalDetails).toHaveProperty('message', 'Hello');
    expect(Object.keys(apiError.internalDetails ?? {})).toHaveLength(2);
  });
});

test('Create ApiError using a template', () => {
  const testDate = new Date();

  const apiError = ApiError.create(ApiErrs.INVALID_JSON_BODY, {testDate});

  expect(apiError.httpCode).toBe(ApiErrs.INVALID_JSON_BODY.httpCode);
  expect(apiError.message).toBe(ApiErrs.INVALID_JSON_BODY.message);
  expect(apiError.internalDetails).toStrictEqual({testDate});
});
