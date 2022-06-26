import nodemailer from 'nodemailer';
import { MailUtils } from '../../src/utils/MailUtils';

jest.mock('nodemailer');

describe('Send mails [Mocked]', () => {
  const sendMailResult = {
    messageId: '<messageId>'
  };
  let mockSendMail: jest.Mock;
  let mailUtils: MailUtils;

  beforeEach(() => {
    mockSendMail = jest.fn().mockResolvedValue(sendMailResult);
    (nodemailer.createTransport as any).mockReturnValue({
      sendMail: mockSendMail
    });

    mailUtils = new MailUtils({
      host: 'localhost',
      port: 465,
      secure: true,
      auth: {
        username: '',
        password: ''
      }
    });
  });

  test('Call send method directly', async () => {
    await expect(mailUtils.send('SpraxDev', 'SpraxDev@localhost', 'Test Subject', '<p>Test Body</p>', 'Test Body'))
        .resolves
        .toStrictEqual(sendMailResult);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith({
      html: '<p>Test Body</p>',
      text: 'Test Body',
      subject: 'Test Subject',
      to: 'SpraxDev <SpraxDev@localhost>'
    });
  });

  test('Call send method directly causing error', async () => {
    const error = new Error('Test Error');
    mockSendMail.mockRejectedValue(error);

    await expect(mailUtils.send('', '', '', ''))
        .rejects
        .toStrictEqual(error);
  });

  test('Send confirm email', async () => {
    await expect(mailUtils.sendConfirmEmail({id: '<id>', name: 'SpraxDev'} as any, 'SpraxDev@new', 'en'))
        .resolves
        .toStrictEqual(sendMailResult);

    expect(mockSendMail).toHaveBeenCalledTimes(1);

    expect(mockSendMail.mock.calls[0][0].to).toBe('SpraxDev <SpraxDev@new>');
    expect(mockSendMail.mock.calls[0][0].subject).toBe('Confirm your email address');
    expect(mockSendMail.mock.calls[0][0].html.startsWith('<!DOCTYPE html')).toBeTruthy();
    expect(mockSendMail.mock.calls[0][0].html.includes('SpraxDev')).toBeTruthy();
    expect(mockSendMail.mock.calls[0][0].text.includes('SpraxDev')).toBeTruthy();
  });
});
