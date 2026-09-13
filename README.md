# Paranormal by Kevin 🔦
PWA/APK d'investigation paranormale : caméra arrière IA + thermique NOYAFA NF-582 (USB-C) +
rendu LiDAR (profondeur IA) + EVP audio + journal d'anomalies + photo/vidéo expert, 100 % hors ligne.

## Modes de rendu
CAM IA · CAM+TH · CAM+TH+LiDAR · LiDAR seul · TH seul (LiDAR déconnectable/reconnectable à chaud).

## Détection d'anomalies
Score PARA 0-100 : cold spots / pics thermiques, anomalies magnétiques, pics EVP (clip 6 s),
mouvements inexpliqués, approches LiDAR. Journal + instantanés + alertes.
> ⚠️ Outil de mesure et de debunking : causes naturelles fréquentes ; aucune entité « prouvée ».

## Déploiement
1. Push GitHub → 2. Netlify (netlify.toml fournit publish=".") → 3. PWABuilder → APK/AAB.
Icônes : ouvrir tools/gen-icons.html → 3 PNG → dossier icons/.

## NF-582
3 modes : UVC (webcam USB), WebUSB vendor (magic/fmt/scale configurables), démo.
Case « Flux déjà coloré » pour les capteurs qui streament une palette vidéo.

## Autodiagnostic
Taper le badge SRC (ou ?diag=1) : liste ✅/❌ du démarrage. Toute erreur s'affiche en bandeau rouge.
