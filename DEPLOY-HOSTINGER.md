# Hosting the invitation on a Hostinger VPS

This puts the invitation on your own Hostinger VPS, with the **shared wishes wall**
working: every wish any guest posts is saved on the server, and every guest sees it.

You will need:
- A Hostinger VPS running **Ubuntu** (22.04 or 24.04).
- A domain name (for example `donajithin.com`). WhatsApp previews and the padlock
  (https) need a domain; a bare IP address is not enough.

Every grey box below is a command: copy it, paste it into the VPS terminal, press Enter.
Wherever you see **YOUR-DOMAIN**, type your real domain instead (without `https://`).

---

## 1. Point your domain at the VPS

1. In **hPanel → VPS**, note your VPS **IP address** (for example `82.112.10.20`).
2. In **hPanel → Domains → your domain → DNS / Nameservers → DNS records**:
   - Edit (or add) the **A** record with name **@** → points to your **VPS IP**.
   - Edit (or add) the **A** record with name **www** → points to your **VPS IP**.
3. Wait 5–30 minutes for this to take effect.

## 2. Open the VPS terminal

In **hPanel → VPS → your server**, click **Browser terminal** (or connect with
`ssh root@YOUR-VPS-IP` from your computer).

## 3. Install Node.js, Nginx and Git (one time)

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx git
npm install -g pm2
```

Check it worked: `node --version` should print `v20...`.

## 4. Download the invitation and build it

```bash
cd /var/www
git clone https://github.com/Akshya-krishnan/dona-jithin-engagement-invitation.git invitation
cd invitation
npm install
npm run build
```

## 5. Start it (and keep it running, even after a reboot)

```bash
cd /var/www/invitation
pm2 start server/server.js --name invitation
pm2 save
pm2 startup
```

`pm2 startup` prints one more command that starts with `sudo env PATH=...`:
**copy that line, paste it and press Enter.**

Check: `curl http://127.0.0.1:3000/api/wishes` should print `[]`.

## 6. Connect your domain (Nginx)

Create the website settings file:

```bash
nano /etc/nginx/sites-available/invitation
```

Paste this in (change both **YOUR-DOMAIN**):

```nginx
server {
    listen 80;
    server_name YOUR-DOMAIN www.YOUR-DOMAIN;

    gzip on;
    gzip_types text/css application/javascript text/javascript application/json image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Range $http_range;
        client_max_body_size 16k;
    }
}
```

Save with **Ctrl+O**, Enter, then exit with **Ctrl+X**. Then switch it on:

```bash
ln -s /etc/nginx/sites-available/invitation /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

`nginx -t` must say **syntax is ok** and **test is successful**.

## 7. Turn on https (the padlock)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR-DOMAIN -d www.YOUR-DOMAIN
```

Enter your email, agree (**Y**), and choose to **redirect** to https if asked.
The certificate renews itself automatically.

## 8. Open the firewall (only if the site doesn't load)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

Also check **hPanel → VPS → Firewall**: ports **80** and **443** must be allowed.

**Done!** Open `https://YOUR-DOMAIN` on your phone.

---

## Updating the site after a change

After you push changes to GitHub, run on the VPS:

```bash
cd /var/www/invitation
git pull
npm install
npm run build
pm2 restart invitation
```

Guests' wishes are **not** affected by updates.

## The wishes

- They are saved in `/var/www/invitation/data/wishes.json` on the VPS.
- **Back them up** now and then (they are the guests' messages to you):
  ```bash
  cp /var/www/invitation/data/wishes.json ~/wishes-backup-$(date +%F).json
  ```
- To remove an unwanted wish: open the file with `nano`, delete that `{ ... }` entry
  (and the comma next to it), save, then run `pm2 restart invitation`.

## WhatsApp preview

The share tags automatically use whatever domain the site is opened on, so the
preview picture works on your new domain without any change. WhatsApp remembers
old previews for a while; the first time you share the new domain, add `?v=2` to the
end of the link to make it fetch a fresh one.

## If something goes wrong

| Problem | Try |
|---|---|
| Site doesn't open | `pm2 status` should show **invitation · online**. If not: `pm2 logs invitation` |
| "502 Bad Gateway" | The app isn't running: `pm2 restart invitation` |
| Domain doesn't open | DNS not ready yet (wait up to 30 min), or check step 1 |
| certbot fails | DNS must point to the VPS first (step 1), and port 80 must be open (step 8) |
