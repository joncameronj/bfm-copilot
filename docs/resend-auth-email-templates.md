# Copilot Resend Auth Templates

These are the Paper-derived auth email templates for Resend. Create one published Resend Template per section, paste the HTML body, set the subject/preheader shown, and then copy the published template ID into the matching `RESEND_TEMPLATE_AUTH_*` secret.

All templates use the same variables sent by `supabase/functions/send-auth-email`:

- `{{{action_url}}}`
- `{{otp_code}}`
- `{{support_email}}`
- `{{product_name}}`
- `{{recipient_email}}`
- `{{{logo_url}}}`

Use `{{{action_url}}}` and `{{{logo_url}}}` in URL positions so Resend does not HTML-escape the URL. Disable Resend click/open tracking for auth emails so Supabase verification links are not rewritten.

## Recovery / Password Setup

Environment variable: `RESEND_TEMPLATE_AUTH_RECOVERY`

Subject: `Set or reset your Copilot password`

Preheader: `Use this secure link to set or reset your Copilot password.`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Set or reset your password</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Use this secure link to set or reset your Copilot password.
    </div>
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background:#ffffff;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="width:100%;max-width:650px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;"
          >
            <tr>
              <td align="center" style="padding:28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <img
                        src="{{{logo_url}}}"
                        width="180"
                        height="44"
                        alt="{{product_name}}"
                        style="display:block;width:180px;max-width:70%;height:auto;border:0;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        style="width:100%;max-width:560px;background:#f5f5f5;border-radius:18px;"
                      >
                        <tr>
                          <td style="padding:38px 32px;text-align:center;">
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                            >
                              <tr>
                                <td
                                  style="font-family:Arial,sans-serif;font-size:26px;line-height:32px;font-weight:400;color:#171717;text-align:center;"
                                >
                                  Set or reset your password
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:14px;font-family:Arial,sans-serif;font-size:16px;line-height:25px;color:#525252;text-align:center;"
                                >
                                  Use the secure button below to set a new
                                  password for your Copilot account.
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:28px 0 0;">
                                  <a
                                    href="{{{action_url}}}"
                                    style="display:inline-block;background:#171717;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:400;text-decoration:none;padding:14px 26px;border-radius:8px;"
                                    >Set password</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding:22px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#737373;text-align:center;"
                                >
                                  If the button does not work, copy and paste
                                  this link into your browser:<br /><a
                                    href="{{{action_url}}}"
                                    style="color:#1E42FC;word-break:break-all;text-decoration:none;"
                                    >{{{action_url}}}</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#737373;text-align:center;"
                                >
                                  If you did not request this email, you can
                                  ignore it. Your account remains protected.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="center"
                      style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#737373;text-align:center;"
                    >
                      Sent to {{recipient_email}}<br />Need help?
                      <a
                        href="mailto:{{support_email}}"
                        style="color:#1E42FC;text-decoration:none;"
                        >{{support_email}}</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Magic Link Login

Environment variable: `RESEND_TEMPLATE_AUTH_MAGIC_LINK`

Subject: `Log in to Copilot`

Preheader: `Use this secure link to log in to Copilot.`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Log in to Copilot</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Use this secure link to log in to Copilot.
    </div>
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background:#ffffff;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="width:100%;max-width:650px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;"
          >
            <tr>
              <td align="center" style="padding:28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <img
                        src="{{{logo_url}}}"
                        width="180"
                        height="44"
                        alt="{{product_name}}"
                        style="display:block;width:180px;max-width:70%;height:auto;border:0;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        style="width:100%;max-width:560px;background:#f5f5f5;border-radius:18px;"
                      >
                        <tr>
                          <td style="padding:38px 32px;text-align:center;">
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                            >
                              <tr>
                                <td
                                  style="font-family:Arial,sans-serif;font-size:26px;line-height:32px;font-weight:400;color:#171717;text-align:center;"
                                >
                                  Log in to Copilot
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:14px;font-family:Arial,sans-serif;font-size:16px;line-height:25px;color:#525252;text-align:center;"
                                >
                                  Use the secure button below to finish signing
                                  in to your Copilot account.
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:28px 0 0;">
                                  <a
                                    href="{{{action_url}}}"
                                    style="display:inline-block;background:#171717;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:400;text-decoration:none;padding:14px 26px;border-radius:8px;"
                                    >Log in</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding:22px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#737373;text-align:center;"
                                >
                                  If the button does not work, copy and paste
                                  this link into your browser:<br /><a
                                    href="{{{action_url}}}"
                                    style="color:#1E42FC;word-break:break-all;text-decoration:none;"
                                    >{{{action_url}}}</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#737373;text-align:center;"
                                >
                                  This link is unique to you and should not be
                                  forwarded.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="center"
                      style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#737373;text-align:center;"
                    >
                      Sent to {{recipient_email}}<br />Need help?
                      <a
                        href="mailto:{{support_email}}"
                        style="color:#1E42FC;text-decoration:none;"
                        >{{support_email}}</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Signup Verification

Environment variable: `RESEND_TEMPLATE_AUTH_SIGNUP`

Subject: `Verify your Copilot email`

Preheader: `Confirm your email address to finish setting up Copilot.`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Verify your email</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Confirm your email address to finish setting up Copilot.
    </div>
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background:#ffffff;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="width:100%;max-width:650px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;"
          >
            <tr>
              <td align="center" style="padding:28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <img
                        src="{{{logo_url}}}"
                        width="180"
                        height="44"
                        alt="{{product_name}}"
                        style="display:block;width:180px;max-width:70%;height:auto;border:0;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        style="width:100%;max-width:560px;background:#f5f5f5;border-radius:18px;"
                      >
                        <tr>
                          <td style="padding:38px 32px;text-align:center;">
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                            >
                              <tr>
                                <td
                                  style="font-family:Arial,sans-serif;font-size:26px;line-height:32px;font-weight:400;color:#171717;text-align:center;"
                                >
                                  Verify your email
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:14px;font-family:Arial,sans-serif;font-size:16px;line-height:25px;color:#525252;text-align:center;"
                                >
                                  Confirm this email address to finish setting
                                  up your Copilot account.
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:28px 0 0;">
                                  <a
                                    href="{{{action_url}}}"
                                    style="display:inline-block;background:#171717;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:400;text-decoration:none;padding:14px 26px;border-radius:8px;"
                                    >Verify email</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding:22px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#737373;text-align:center;"
                                >
                                  If the button does not work, copy and paste
                                  this link into your browser:<br /><a
                                    href="{{{action_url}}}"
                                    style="color:#1E42FC;word-break:break-all;text-decoration:none;"
                                    >{{{action_url}}}</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#737373;text-align:center;"
                                >
                                  If you did not create a Copilot account, you
                                  can ignore this email.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="center"
                      style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#737373;text-align:center;"
                    >
                      Sent to {{recipient_email}}<br />Need help?
                      <a
                        href="mailto:{{support_email}}"
                        style="color:#1E42FC;text-decoration:none;"
                        >{{support_email}}</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Invitation

Environment variable: `RESEND_TEMPLATE_AUTH_INVITE`

Subject: `You have been invited to Copilot`

Preheader: `Accept your Copilot invitation and finish account setup.`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Accept your invitation</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Accept your Copilot invitation and finish account setup.
    </div>
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background:#ffffff;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="width:100%;max-width:650px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;"
          >
            <tr>
              <td align="center" style="padding:28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <img
                        src="{{{logo_url}}}"
                        width="180"
                        height="44"
                        alt="{{product_name}}"
                        style="display:block;width:180px;max-width:70%;height:auto;border:0;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        style="width:100%;max-width:560px;background:#f5f5f5;border-radius:18px;"
                      >
                        <tr>
                          <td style="padding:38px 32px;text-align:center;">
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                            >
                              <tr>
                                <td
                                  style="font-family:Arial,sans-serif;font-size:26px;line-height:32px;font-weight:400;color:#171717;text-align:center;"
                                >
                                  Accept your invitation
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:14px;font-family:Arial,sans-serif;font-size:16px;line-height:25px;color:#525252;text-align:center;"
                                >
                                  You have been invited to Copilot. Use the
                                  secure button below to finish account setup.
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:28px 0 0;">
                                  <a
                                    href="{{{action_url}}}"
                                    style="display:inline-block;background:#171717;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:400;text-decoration:none;padding:14px 26px;border-radius:8px;"
                                    >Accept invitation</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding:22px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#737373;text-align:center;"
                                >
                                  If the button does not work, copy and paste
                                  this link into your browser:<br /><a
                                    href="{{{action_url}}}"
                                    style="color:#1E42FC;word-break:break-all;text-decoration:none;"
                                    >{{{action_url}}}</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#737373;text-align:center;"
                                >
                                  This invitation is intended only for the
                                  recipient of this email.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="center"
                      style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#737373;text-align:center;"
                    >
                      Sent to {{recipient_email}}<br />Need help?
                      <a
                        href="mailto:{{support_email}}"
                        style="color:#1E42FC;text-decoration:none;"
                        >{{support_email}}</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Reauthentication

Environment variable: `RESEND_TEMPLATE_AUTH_REAUTHENTICATION`

Subject: `Confirm this Copilot action`

Preheader: `Use this code or secure link to confirm your Copilot action.`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Confirm this action</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Use this code or secure link to confirm your Copilot action.
    </div>
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background:#ffffff;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="width:100%;max-width:650px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;"
          >
            <tr>
              <td align="center" style="padding:28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <img
                        src="{{{logo_url}}}"
                        width="180"
                        height="44"
                        alt="{{product_name}}"
                        style="display:block;width:180px;max-width:70%;height:auto;border:0;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        style="width:100%;max-width:560px;background:#f5f5f5;border-radius:18px;"
                      >
                        <tr>
                          <td style="padding:38px 32px;text-align:center;">
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                            >
                              <tr>
                                <td
                                  style="font-family:Arial,sans-serif;font-size:26px;line-height:32px;font-weight:400;color:#171717;text-align:center;"
                                >
                                  Confirm this action
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:14px;font-family:Arial,sans-serif;font-size:16px;line-height:25px;color:#525252;text-align:center;"
                                >
                                  Use the secure button or verification code
                                  below to continue.
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:28px 0 0;">
                                  <a
                                    href="{{{action_url}}}"
                                    style="display:inline-block;background:#171717;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:400;text-decoration:none;padding:14px 26px;border-radius:8px;"
                                    >Confirm action</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:18px 0 0;">
                                  <table
                                    role="presentation"
                                    cellpadding="0"
                                    cellspacing="0"
                                    style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;"
                                  >
                                    <tr>
                                      <td
                                        style="padding:14px 18px;font-family:'Courier New',Courier,monospace;font-size:28px;line-height:34px;letter-spacing:5px;color:#171717;text-align:center;"
                                      >
                                        {{otp_code}}
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#737373;text-align:center;"
                                >
                                  This confirmation is required before Copilot
                                  can continue.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="center"
                      style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#737373;text-align:center;"
                    >
                      Sent to {{recipient_email}}<br />Need help?
                      <a
                        href="mailto:{{support_email}}"
                        style="color:#1E42FC;text-decoration:none;"
                        >{{support_email}}</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Email Change - Current Address

Environment variable: `RESEND_TEMPLATE_AUTH_EMAIL_CHANGE_CURRENT`

Subject: `Confirm your current Copilot email`

Preheader: `Confirm this email address change for your Copilot account.`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Confirm current email</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Confirm this email address change for your Copilot account.
    </div>
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background:#ffffff;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="width:100%;max-width:650px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;"
          >
            <tr>
              <td align="center" style="padding:28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <img
                        src="{{{logo_url}}}"
                        width="180"
                        height="44"
                        alt="{{product_name}}"
                        style="display:block;width:180px;max-width:70%;height:auto;border:0;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        style="width:100%;max-width:560px;background:#f5f5f5;border-radius:18px;"
                      >
                        <tr>
                          <td style="padding:38px 32px;text-align:center;">
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                            >
                              <tr>
                                <td
                                  style="font-family:Arial,sans-serif;font-size:26px;line-height:32px;font-weight:400;color:#171717;text-align:center;"
                                >
                                  Confirm current email
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:14px;font-family:Arial,sans-serif;font-size:16px;line-height:25px;color:#525252;text-align:center;"
                                >
                                  Confirm that this current email address should
                                  be changed on your Copilot account.
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:28px 0 0;">
                                  <a
                                    href="{{{action_url}}}"
                                    style="display:inline-block;background:#171717;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:400;text-decoration:none;padding:14px 26px;border-radius:8px;"
                                    >Confirm current email</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding:22px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#737373;text-align:center;"
                                >
                                  If the button does not work, copy and paste
                                  this link into your browser:<br /><a
                                    href="{{{action_url}}}"
                                    style="color:#1E42FC;word-break:break-all;text-decoration:none;"
                                    >{{{action_url}}}</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#737373;text-align:center;"
                                >
                                  If you did not request this change, contact
                                  support immediately.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="center"
                      style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#737373;text-align:center;"
                    >
                      Sent to {{recipient_email}}<br />Need help?
                      <a
                        href="mailto:{{support_email}}"
                        style="color:#1E42FC;text-decoration:none;"
                        >{{support_email}}</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Email Change - New Address

Environment variable: `RESEND_TEMPLATE_AUTH_EMAIL_CHANGE_NEW`

Subject: `Confirm your new Copilot email`

Preheader: `Confirm this new email address for your Copilot account.`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Confirm new email</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Confirm this new email address for your Copilot account.
    </div>
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background:#ffffff;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="width:100%;max-width:650px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;"
          >
            <tr>
              <td align="center" style="padding:28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <img
                        src="{{{logo_url}}}"
                        width="180"
                        height="44"
                        alt="{{product_name}}"
                        style="display:block;width:180px;max-width:70%;height:auto;border:0;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        style="width:100%;max-width:560px;background:#f5f5f5;border-radius:18px;"
                      >
                        <tr>
                          <td style="padding:38px 32px;text-align:center;">
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                            >
                              <tr>
                                <td
                                  style="font-family:Arial,sans-serif;font-size:26px;line-height:32px;font-weight:400;color:#171717;text-align:center;"
                                >
                                  Confirm new email
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:14px;font-family:Arial,sans-serif;font-size:16px;line-height:25px;color:#525252;text-align:center;"
                                >
                                  Confirm that this new email address should be
                                  used for your Copilot account.
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:28px 0 0;">
                                  <a
                                    href="{{{action_url}}}"
                                    style="display:inline-block;background:#171717;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:400;text-decoration:none;padding:14px 26px;border-radius:8px;"
                                    >Confirm new email</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding:22px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#737373;text-align:center;"
                                >
                                  If the button does not work, copy and paste
                                  this link into your browser:<br /><a
                                    href="{{{action_url}}}"
                                    style="color:#1E42FC;word-break:break-all;text-decoration:none;"
                                    >{{{action_url}}}</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#737373;text-align:center;"
                                >
                                  You must confirm both the current and new
                                  addresses before the change is complete.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="center"
                      style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#737373;text-align:center;"
                    >
                      Sent to {{recipient_email}}<br />Need help?
                      <a
                        href="mailto:{{support_email}}"
                        style="color:#1E42FC;text-decoration:none;"
                        >{{support_email}}</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Generic Fallback

Environment variable: `RESEND_TEMPLATE_AUTH_GENERIC`

Subject: `Secure Copilot access link`

Preheader: `Use this secure link to continue with Copilot.`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Continue to Copilot</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Use this secure link to continue with Copilot.
    </div>
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="background:#ffffff;"
    >
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="width:100%;max-width:650px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;"
          >
            <tr>
              <td align="center" style="padding:28px 24px;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <img
                        src="{{{logo_url}}}"
                        width="180"
                        height="44"
                        alt="{{product_name}}"
                        style="display:block;width:180px;max-width:70%;height:auto;border:0;"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <table
                        role="presentation"
                        width="100%"
                        cellpadding="0"
                        cellspacing="0"
                        style="width:100%;max-width:560px;background:#f5f5f5;border-radius:18px;"
                      >
                        <tr>
                          <td style="padding:38px 32px;text-align:center;">
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                            >
                              <tr>
                                <td
                                  style="font-family:Arial,sans-serif;font-size:26px;line-height:32px;font-weight:400;color:#171717;text-align:center;"
                                >
                                  Continue to Copilot
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:14px;font-family:Arial,sans-serif;font-size:16px;line-height:25px;color:#525252;text-align:center;"
                                >
                                  Use the secure button below to continue with
                                  your Copilot account.
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding:28px 0 0;">
                                  <a
                                    href="{{{action_url}}}"
                                    style="display:inline-block;background:#171717;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;line-height:20px;font-weight:400;text-decoration:none;padding:14px 26px;border-radius:8px;"
                                    >Continue</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding:22px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#737373;text-align:center;"
                                >
                                  If the button does not work, copy and paste
                                  this link into your browser:<br /><a
                                    href="{{{action_url}}}"
                                    style="color:#1E42FC;word-break:break-all;text-decoration:none;"
                                    >{{{action_url}}}</a
                                  >
                                </td>
                              </tr>
                              <tr>
                                <td
                                  style="padding-top:24px;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#737373;text-align:center;"
                                >
                                  If you were not expecting this email, you can
                                  ignore it.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="center"
                      style="padding:24px 12px 0;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#737373;text-align:center;"
                    >
                      Sent to {{recipient_email}}<br />Need help?
                      <a
                        href="mailto:{{support_email}}"
                        style="color:#1E42FC;text-decoration:none;"
                        >{{support_email}}</a
                      >
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```
