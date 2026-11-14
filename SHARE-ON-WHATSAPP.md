# Sharing the invitation on WhatsApp

## 1. The link preview (automatic)

When you paste the invitation link in WhatsApp, WhatsApp fetches the site's preview
tags and shows the couple photo card with the title "Dona & Jithin | Engagement Invitation".

The tags live at the top of `index.html` and point at:

    https://dj-engagement-invitation.vercel.app/

If the site is hosted at a different address, replace that address in every
`og:url`, `og:image`, `og:image:secure_url` and `twitter:image` tag, then rebuild
(`npm run build`) and push.

Notes
- The preview only works once the site is live on the internet (not on localhost).
- WhatsApp caches previews. If you change the photo later, append `?v=2` to the link
  when you share it so WhatsApp fetches the new one.

## 2. The photo card to attach (optional, looks best)

`public/assets/images/share/share-whatsapp.jpg` is a 1080x1080 card with the photo,
the names, the date and "Tap the link to open our invitation". To send it:

1. Send the picture in WhatsApp (as a photo).
2. Paste the link as the caption or as the next message.

## 3. Suggested message

    💍 The Engagement of Dona & Jithin
    📅 Thursday, 07 January 2027 · 5:30 PM
    ⛪ St. Stephen’s Knanaya Catholic Church, Uzhavoor, Kottayam

    Tap to open our invitation 💛
    https://dj-engagement-invitation.vercel.app/
