# Yearly renewal reminders

Workers who tick **Remind me next year when my fit test is due** on the card
form get one email about 30 days before their yearly fit test is due, with the
Manhattan and Brooklyn booking links.

- Form: the box is under **Optional** in the consent section, unchecked by
  default, and saved on the fit test as `renewalReminderOptIn: true/false`.
  Drafts keep it. It cannot be changed after the record is saved, and it is
  not copied to the public verify or resend records.
- Job: `.github/workflows/renewal-reminders.yml` runs
  `scripts/send-renewal-reminders.js` every day at 09:00 UTC.
- Who gets an email: `renewalReminderOptIn == true`, test date (`issueDate`)
  335 to 365 days ago, result Pass, a recipient email, the e-card was sent
  (`emailSentAt` set), not soft deleted (`deletedAt` empty), and no later fit
  test on file for the same email. One email per address per run.
- No repeats: before each send, a Firestore transaction verifies
  `renewalReminderSentFor` is not already set for the due year and stamps
  `renewalReminderSentFor` and `renewalReminderSentAt` first. If the email send
  fails after the transaction commits, that year's reminder is skipped rather
  than duplicated.
- Quota: at most 50 emails per run, about one per second. Extras wait for the
  next day. The EmailJS free plan is 200 requests a month **shared with e-card
  emails**, so watch the EmailJS usage page in busy months; Personal ($9/month)
  is 2,000.
- Staging safety: with the staging service account the job only emails
  `@example.com` addresses, like the staging app.

**Scheduling caveat:** GitHub only runs scheduled workflows from the default
branch (`main`), and the Run workflow button only shows once the file is on
`main`. Nothing runs from `staging`. The daily job starts after this is merged
to `main`. Until the secrets below exist, each run logs which secrets are
missing and exits without doing anything.

## Setup (Sam)

### 1. New EmailJS template (existing templates stay untouched)

EmailJS dashboard → **Email Templates** → **Create New Template**. Do not edit
the e-card template (`template_n6pvpvf`).

- To Email: `{{to_email}}`
- From Name: `Secure Fit LLC`
- Reply To: `SecureFit2024@gmail.com`
- Subject: `Your N95 fit test is due {{due_date}}`
- Body (suggested):

```
Hi {{to_name}},

Your last fit test was on {{test_date}}, so your yearly test is due by {{due_date}}.

On file: {{test_type}} {{respirator_make}} {{respirator_model}}, size {{respirator_size}}, {{respirator_style}}

Book a $75 fit test (cash or Zelle; N95 mask $10 if you need one):
Manhattan: {{booking_manhattan}}
Brooklyn: {{booking_brooklyn}}

You are getting this one email because you asked for a renewal reminder when you were tested.
Questions? Reply to this email.

Secure Fit LLC
```

Save it and copy its **Template ID** (`template_...`).

Template parameters the job sends: `to_email`, `to_name`, `test_date`,
`due_date`, `test_type`, `respirator_make`, `respirator_model`,
`respirator_size`, `respirator_style`, `booking_manhattan`, `booking_brooklyn`.

### 2. Allow server sends in EmailJS

EmailJS → **Account** → **Security**:

- Turn on **Allow EmailJS API for non-browser applications**. Without it every
  send from GitHub Actions is refused with a 403.
- Copy the **Private Key** from Account → General (API keys). It is sent as
  `accessToken`; it is required if "Use Private Key" (strict mode) is on, and
  recommended anyway.

### 3. Production service account

Firebase console → project `fit-test-result-e-card-2026` → Project settings →
**Service accounts** → **Generate new private key**. It downloads a JSON file.
That key can read and write Firestore. Do not commit it or share it in chat;
delete the local file after step 4.

### 4. GitHub secrets

Repo → Settings → Secrets and variables → **Actions** → New repository secret:

| Secret | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | the whole JSON file contents from step 3 |
| `EMAILJS_SERVICE_ID` | the existing service ID (`service_u84chaq`, same as `src/services/emailService.js`) |
| `EMAILJS_RENEWAL_TEMPLATE_ID` | the new template ID from step 1 |
| `EMAILJS_PUBLIC_KEY` | the existing public key (same as `src/services/emailService.js`) |
| `EMAILJS_PRIVATE_KEY` | the private key from step 2 (optional, recommended) |

### 5. Dry run, then go live

After the PR is merged to `main`: Actions → **Renewal reminders** → **Run
workflow**. **Dry run** is ticked by default: the log shows how many tests are
opted in, why others were skipped, and masked addresses (`j***@e***.com`)
that would be emailed. Nothing is sent or written. Untick it to send for real;
from then on the 09:00 UTC daily run sends on its own.

Run by hand from a computer instead:

```
export FIREBASE_SERVICE_ACCOUNT="$(cat /absolute/path/to/service-account.json)"
node scripts/send-renewal-reminders.js --dry-run
```

To stop reminders, disable the workflow in the Actions tab or delete the
`EMAILJS_RENEWAL_TEMPLATE_ID` secret.

Records saved before this change have no opt-in, so they never get a reminder.
