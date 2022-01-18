import Utils, { HttpCheckResult } from '../../src/utils/Utils';

describe('Formatting strings', () => {
  test('Simple strings', () => {
    expect(Utils.formatStr('Hello {0}', ['World']))
        .toBe('Hello World');

    expect(Utils.formatStr('{1} {0}', ['World', 'Hello']))
        .toBe('Hello World');
  });

  test('With fallback string defined', () => {
    expect(Utils.formatStr('Hello {0}', ['World'], '!'))
        .toBe('Hello World');

    expect(Utils.formatStr('Hello {0}{5}', ['World'], '!'))
        .toBe('Hello World!');
  });

  test('Use same index twice, an undefined one and escape one', () => {
    expect(Utils.formatStr('{0} ({0}) is {{0}} **{2}** using {1}!', ['Sprax', 'TypeScript']))
        .toBe('Sprax (Sprax) is {0} **undefined** using TypeScript!');
  });
});


describe('Check if strings are numeric', () => {
  test('Integers', () => {
    expect(Utils.isNumeric('0'))
        .toBe(true);
    expect(Utils.isNumeric('010'))
        .toBe(true);

    expect(Utils.isNumeric('-0'))
        .toBe(false);
    expect(Utils.isNumeric('-10'))
        .toBe(false);
  });

  test('Floats', () => {
    expect(Utils.isNumeric('0.0'))
        .toBe(false);
    expect(Utils.isNumeric('100.5'))
        .toBe(false);
  });
});

describe('Check if strings look like valid HTTP(s)-URLs', () => {
  const valid: HttpCheckResult = {valid: true};

  test('Test protocols', () => {
    expect(Utils.looksLikeHttpUrl('htt' + 'p://example.com/'))
        .toStrictEqual(valid);
    expect(Utils.looksLikeHttpUrl('https://www.example.com/'))
        .toStrictEqual(valid);

    expect(Utils.looksLikeHttpUrl('sftp://www.example.com/'))
        .toStrictEqual({valid: false, issue: 'protocol'});

    expect(Utils.looksLikeHttpUrl('example.com/'))
        .toStrictEqual({valid: false, issue: 'protocol'});
  });

  test('Test Hostnames (+ localhost, IPv4, punycode)', () => {
    expect(Utils.looksLikeHttpUrl('https://www.example.com/'))
        .toStrictEqual(valid);
    expect(Utils.looksLikeHttpUrl('https://example.com/'))
        .toStrictEqual(valid);
    expect(Utils.looksLikeHttpUrl('https://localhost/'))
        .toStrictEqual(valid);

    expect(Utils.looksLikeHttpUrl('https://1.1.1.1/'))
        .toStrictEqual(valid);

    expect(Utils.looksLikeHttpUrl('https://xn--xmpl-loa1ab.com/'))
        .toStrictEqual(valid);
    expect(Utils.looksLikeHttpUrl('https://éxämplè.com/'))
        .toStrictEqual({valid: false, issue: 'hostname'});
  });

  test('Test ports', () => {
    expect(Utils.looksLikeHttpUrl('https://www.example.com:8080/'))
        .toStrictEqual(valid);

    expect(Utils.looksLikeHttpUrl('https://www.example.com:99999/'))
        .toStrictEqual({valid: false, issue: 'port'});
    expect(Utils.looksLikeHttpUrl('https://www.example.com:abc/'))
        .toStrictEqual({valid: false, issue: 'port'});
  });

  test('With path and query parameters', () => {
    expect(Utils.looksLikeHttpUrl('https://example.com/Hellû'))
        .toStrictEqual(valid);
    expect(Utils.looksLikeHttpUrl('https://example.com/Hell%C3%BB?foo=bar'))
        .toStrictEqual(valid);
  });
});

describe('Check if strings look like valid email addresses', () => {
  const validAddresses = [
    '0123456789@example.com', 'foo@bar.example.com', 'foobar@1.1.1.1', 'foobar@localhost', 'foobar@xn--xmpl-loa1ab.com',
    'foo+bar@example.com', 'foo.bar@example.com', '_!*-?%~@example.com', '"foo"."bar"@example.com'
  ];
  const invalidAddresses = ['foobar@example,com', 'foo@example..com', 'example.com', 'foo@', 'foo@.com'];

  it.each(validAddresses)('Valid address: %s', (address) => {
    expect(Utils.looksLikeValidEmail(address))
        .toBe(true);
  });
  it.each(invalidAddresses)('Invalid address: %s', (address) => {
    expect(Utils.looksLikeValidEmail(address))
        .toBe(false);
  });
});

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
