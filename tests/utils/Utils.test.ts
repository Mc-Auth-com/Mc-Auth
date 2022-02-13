import Utils from '../../src/utils/Utils';

describe('Whitespace character normalization', () => {
  test('Test trim and replacement', () => {
    expect(Utils.normalizeWhitespaceChars('\n\r\t\v\f'))
        .toBe('');
    expect(Utils.normalizeWhitespaceChars('Hello    World!'))
        .toBe('Hello World!');
    expect(Utils.normalizeWhitespaceChars('  Hello\n\r\t\v\fWorld! '))
        .toBe('Hello World!');
  });

  test('Do not remove single line feeds', () => {
    expect(Utils.normalizeWhitespaceChars('Hello\nWorld!'))
        .toBe('Hello\nWorld!');
  });
});
