# Messaging: why email-only for v1, and how to add chat apps later

For v1 this app sends notifications and reminders by **email only**. Two other options
came up and are worth recording:

- **Telegram** — free, no approval process. A bot can message anyone who has clicked a
  one-time link to your bot (`t.me/<your_bot>?start=<token>`), which is how you'd link
  each player's account to their Telegram chat ID. Straightforward to bolt on later:
  add a `telegramChatId` field to `User`, a webhook route for the bot's `/start`
  command, and call the Telegram Bot API's `sendMessage` from the same place
  `sendEmail` is called today in `src/lib/reminders.ts` and the event-creation route.
- **WhatsApp** — requires Meta's WhatsApp Business Platform, business verification, and
  (outside a free tier of user-initiated conversations) per-message cost. It also can't
  freely message someone who hasn't messaged your business number first within a
  rolling window, unless you use pre-approved "template" messages. More setup and
  ongoing cost for not much benefit over Telegram for a small club.

If you want push notifications on players' phones later, Telegram is the easy next
step; WhatsApp is possible but has real setup/approval overhead.
