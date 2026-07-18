# Google Calendar one-way sync

## Confirmed scope

Work Board is the source of truth. A user may opt individual dated memos into one-way synchronization with Google Calendar.

Included:

- Connect and disconnect a Google account in the Work Board header
- Select `Google Calendarへ反映` when creating or editing a dated memo
- Create a Google Calendar event after the Work Board memo is saved
- Update the linked Google Calendar event when the Work Board memo is edited
- Ask separately whether to delete the linked Google event when deleting a memo
- Show `未同期`, `同期中`, `同期済み`, or `同期エラー`
- Retry synchronization from each memo card
- Open the linked event in Google Calendar

Not included:

- Google Calendar to Work Board synchronization
- Outlook integration
- Multiple Google accounts or multiple destination calendars
- Recurring events, guests, Meet links, or attachments

## Safety rules

- Work Board saves locally even when Google synchronization fails.
- The Google access token remains in memory and is not stored in localStorage.
- No Google client secret is used in the browser or committed to GitHub.
- `googleEventId` prevents duplicate event creation and enables update/delete operations.

## Required configuration

Set the following environment variable in Vercel and local development:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Google OAuth Web client ID>
```

The Google Cloud OAuth client must allow the production and Vercel preview origins used by Work Board.

## Preview verification

Use the newest Vercel deployment for the pull request. Older deployment URLs remain accessible and may show the pre-UI foundation build. The current UI build is identifiable by both of the following:

- The header shows `Google Calendarに接続` or `Google設定待ち`.
- The dated memo form shows the `Google Calendarへ反映` checkbox.

## Validation

- Vercel Preview production build succeeded on commit `3eb0a81`.
- TypeScript and Next.js production compilation passed.
- Actual OAuth consent and Google Calendar event creation remain dependent on configuring the Google Cloud OAuth client ID.
