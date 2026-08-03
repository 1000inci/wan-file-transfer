#!/usr/bin/env bash
# Yeni WAN Dosya Transfer kullanicisi ekler.
# Kullanim: ./add_user.sh <kullanici> <sifre> <eposta>
U="$1"; P="$2"; E="$3"
if [ -z "$U" ] || [ -z "$P" ] || [ -z "$E" ]; then
  echo "Kullanim: ./add_user.sh <kullanici> <sifre> <eposta>"; exit 1
fi
SECRET=$(grep -oP "ADMIN_SECRET=\K.*" /etc/systemd/system/wan-backend.service)
RESP=$(curl -s -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Content-Type: application/json" -H "x-admin-secret: $SECRET" \
  -d "{\"username\":\"$U\",\"password\":\"$P\",\"email\":\"$E\"}")
echo "$RESP"
case "$RESP" in
  *Success*) echo "✓ Kullanici eklendi: $U ($E)" ;;
  *Exists*)  echo "! Bu kullanici zaten var" ;;
  *)         echo "! Eklenemedi" ;;
esac
