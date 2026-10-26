# Güvenlik

Bu belge `wan-file-transfer` için güvenlik durumunu, 2026-10-26 tarihli denetimde
bulunan sorunları ve yapılan düzeltmeleri özetler.

## Zafiyet bildirimi

Bir güvenlik açığı bulduysanız herkese açık issue açmayın; depo sahibine
(1000inci@gmail.com) doğrudan e-posta ile bildirin.

## Mimari özeti

- Backend: Node.js / Express (`backend/server.js`), systemd servisi `wan-backend`, port 8000
- Frontend: ayrı servis (`wan-frontend`), port 3001
- Dış erişim: Cloudflare Tunnel (`transfer.1000inci.com`, `transferapi.1000inci.com`)
- Veri: `backend/users.json`, `backend/metadata.json`, `backend/uploads/` (git dışı)

## 2026-10-26 denetimi: bulgular ve düzeltmeler

| # | Bulgu | Önem | Durum |
|---|-------|------|-------|
| 1 | Parolalar tuzsuz SHA-256 ile saklanıyordu | Yüksek | Düzeltildi: scrypt + kullanıcı başına rastgele salt. Eski kayıtlar ilk başarılı girişte otomatik yükseltilir |
| 2 | Login / forgot / reset uçlarında rate limit yoktu | Yüksek | Düzeltildi: IP başına 15 dk'da 10 deneme, aşılırsa HTTP 429 |
| 3 | Oturum token'ları süresizdi, logout yoktu | Yüksek | Düzeltildi: 12 saat TTL, `POST /api/auth/logout` eklendi |
| 4 | Dosyalarda sahiplik kontrolü yoktu (herhangi bir giriş yapmış kullanıcı başkasının dosyasını listeleyebilir, indirebilir, silebilirdi) | Yüksek | Düzeltildi: yeni yüklemeler `owner` alanıyla kaydedilir; yalnızca sahibi ve adminler erişir |
| 5 | CORS tüm origin'lere açıktı | Orta | Düzeltildi: `ALLOWED_ORIGINS` ortam değişkeni (varsayılan: transfer ve transferapi alan adları) |
| 6 | Güvenlik header'ları yoktu | Orta | Düzeltildi: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS; `x-powered-by` kapatıldı |

Düzeltmeler canlıda doğrulandı: kimliksiz erişim 401, yabancı origin engelli,
11. yanlış login denemesinden itibaren 429, scrypt ve eski hash doğrulaması çalışıyor.

## Altyapı sertleştirmesi (sunucu, 2026-10-26)

Uygulama dışındaki düzeltmeler sunucuda yapılmıştır; depoda kod karşılığı yoktur.

| Konu | Önceki durum | Güncel durum |
|------|--------------|--------------|
| SSH root girişi | `PermitRootLogin without-password` (anahtarla root girişi açık) | `PermitRootLogin no` |
| SSH X11 / deneme sınırı | `X11Forwarding yes`, `MaxAuthTries 6` | `X11Forwarding no`, `MaxAuthTries 3` |
| SSH brute-force koruması | fail2ban yoktu | fail2ban `sshd` jail'i: 10 dk'da 5 hata → 1 saat ban; kendi IP'miz, Tailscale (`100.64.0.0/10`) ve localhost muaf |
| `vault.1000inci.com` | Cloudflare Access dışında, doğrudan erişilebilir | Cloudflare Access (e-posta politikası) arkasında; `nvr`, `sys`, `indir` ile aynı koruma |

SSH ayarları `/etc/ssh/sshd_config.d/01-hardening.conf` dosyasındadır; parola ile giriş
zaten kapalıdır (`PasswordAuthentication no`). fail2ban ayarları `/etc/fail2ban/jail.local`
dosyasındadır.

**Ubuntu 24.04 notu:** fail2ban'ın varsayılan `sshd` filtresi journal'da `sshd.service`
birimini arar, oysa 24.04'te birim `ssh.service` adındadır; bu yüzden hiçbir deneme
yakalanmaz. Jail bu nedenle `backend = auto` ve `logpath = /var/log/auth.log` ile
çalıştırılır. Doğrulama: `sudo fail2ban-regex /var/log/auth.log sshd` komutu geçmiş
kayıtları eşleştirmelidir.

## Bilinen kısıtlar ve yapılacaklar

- `mini.1000inci.com` (yerel port 8099) Cloudflare Access dışındadır; içeriği gözden
  geçirilmeli, hassassa Access'e eklenmelidir.
- Internete açık RustDesk relay portları (21115-21117/tcp, 21116/udp) bilinçli olarak
  açıktır; `rustdesk/rustdesk-server:latest` imajı düzenli güncellenmelidir.
- `rpcbind` (111) tüm arayüzlerde dinler; iptables dışarıdan erişimi engeller, kullanılmıyorsa
  kapatılması önerilir.

- **Sahibi olmayan eski dosyalar** geriye uyum için hâlâ tüm giriş yapmış kullanıcılara
  açıktır. İstenirse yalnızca adminlere kısıtlanabilir.
- Oturum token'ları bellekte tutulur; servis yeniden başladığında herkes tekrar giriş yapar.
- Rate limiter bellek içidir ve tek süreç için tasarlanmıştır. Birden fazla süreçle
  çalıştırılırsa paylaşımlı bir depoya (örn. Redis) taşınmalıdır.
- Yüklenen dosya türü / boyutu sunucu tarafında sınırlandırılmamıştır.
- Şifre sıfırlama token'ları bellekte tutulur ve 1 saat geçerlidir.

## Çalıştırma gereksinimleri

Ortam değişkenleri (`.env` git dışıdır): `ADMIN_SECRET`, `PUBLIC_URL`, `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, isteğe bağlı `ALLOWED_ORIGINS`
(virgülle ayrılmış). Sırlar depoya asla commit edilmemelidir.
