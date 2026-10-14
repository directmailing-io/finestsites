#!/bin/bash
# Automatisches ElevenLabs-Dubbing der deutschen Tonspur (Stimme geklont, Musik bleibt; ElevenLabs übersetzt selbst,
# eine eigene Übersetzung per CSV wird vom Dubbing ignoriert, geprüft 13.10.2026). Je Sprache entsteht
# preview_01_{lang}.mp4 mit der Original-Bildspur sowie dub_{lang}.srt (Transkript zum Prüfen).
# Danach: prep_review.py (Whisper-Abgleich) und Zahlen per ASR gegenprüfen: Hindi-TTS spricht Ziffern falsch
# ("1993" wurde 1983), am 14.10.2026 per TTS mit ausgeschriebener Zahl im Mix ersetzt.
# Aufruf: ELEVENLABS_API_KEY=… ./dub_auto.sh <workdir mit biz_de.mp3 + preview_01.mp4> [langs…]
set -u
WD=$1; shift; LANGS=${@:-"it ru uk pl bg hi"}
K=$ELEVENLABS_API_KEY
cd "$WD" || exit 1
for L in $LANGS; do
  if [ -s "dub_$L.id" ]; then echo "$L: vorhandene ID $(cat dub_$L.id)"; continue; fi
  R=$(curl -s -m 300 -X POST https://api.elevenlabs.io/v1/dubbing -H "xi-api-key: $K" \
      -F "file=@biz_de.mp3;type=audio/mpeg" -F "name=Wellpreneur Business $L (automatisch)" \
      -F "source_lang=de" -F "target_lang=$L" -F "num_speakers=1")
  ID=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin).get('dubbing_id',''))")
  [ -z "$ID" ] && { echo "$L: FEHLER $R"; continue; }
  echo "$ID" > "dub_$L.id"; echo "$L: gestartet $ID"
done
for L in $LANGS; do
  [ -s "dub_$L.id" ] || continue; ID=$(cat "dub_$L.id")
  n=0
  until [ $n -ge 60 ]; do
    S=$(curl -s "https://api.elevenlabs.io/v1/dubbing/$ID" -H "xi-api-key: $K" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('status'), d.get('error') or '')")
    case "$S" in dubbed*|failed*) break;; esac
    n=$((n+1)); perl -e 'select(undef,undef,undef,15)'
  done
  echo "$L: $S"
  case "$S" in dubbed*) ;; *) continue;; esac
  curl -s -o "dub_$L.mp3" -w "$L audio: %{http_code} %{size_download}B\n" "https://api.elevenlabs.io/v1/dubbing/$ID/audio/$L" -H "xi-api-key: $K"
  curl -s "https://api.elevenlabs.io/v1/dubbing/$ID/transcript/$L?format_type=srt" -H "xi-api-key: $K" > "dub_$L.srt"
  ffmpeg -y -v error -i preview_01.mp4 -i "dub_$L.mp3" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -movflags +faststart -shortest "preview_01_$L.mp4" && echo "$L: preview_01_$L.mp4 $(ffprobe -v error -show_entries format=duration -of csv=p=0 preview_01_$L.mp4)s"
done
