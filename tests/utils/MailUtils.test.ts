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
    await expect(mailUtils.send('Sprax2013', 'sprax2013@localhost', 'Test Subject', '<p>Test Body</p>', 'Test Body'))
        .resolves
        .toStrictEqual(sendMailResult);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith({
      html: '<p>Test Body</p>',
      text: 'Test Body',
      subject: 'Test Subject',
      to: 'Sprax2013 <sprax2013@localhost>'
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
    await expect(mailUtils.sendConfirmEmail({id: '<id>', name: 'Sprax2013'} as any, 'sprax2013@new', 'en'))
        .resolves
        .toStrictEqual(sendMailResult);

    expect(mockSendMail).toHaveBeenCalledTimes(1);

    expect(mockSendMail.mock.calls[0][0].to).toBe('Sprax2013 <sprax2013@new>');
    expect(mockSendMail.mock.calls[0][0].subject).toBe('Confirm your email address');
    expect(mockSendMail.mock.calls[0][0].html.startsWith('<!DOCTYPE html')).toBeTruthy();
    expect(mockSendMail.mock.calls[0][0].html.includes('Sprax2013')).toBeTruthy();
    expect(mockSendMail.mock.calls[0][0].text.includes('Sprax2013')).toBeTruthy();
  });
});
