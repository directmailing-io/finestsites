#!/usr/bin/env python3
"""
Fremdsprachige Tonspur für das Business-Video aus dem geprüften Skript (video_{lang}.json):
je Segment Text-to-Speech mit der geklonten Sprecherstimme (ElevenLabs), in die Szenen-Zeitfenster
eingepasst (zu lange Segmente werden über den speed-Parameter neu erzeugt, Rest leicht gestaucht),
mit dem Musikbett des Originals (demucs no_vocals.wav) gemischt und als MP4 mit der Original-Bildspur gemuxt.
Aufruf: ELEVENLABS_API_KEY=… python3 dub.py --lang it --voice <voice_id> --video preview_01.mp4 \
        --music no_vocals.wav --out preview_01_it.mp4 [--workdir /tmp/dub]
"""
import argparse, json, os, subprocess, sys, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__))
ap=argparse.ArgumentParser(); ap.add_argument('--lang',required=True); ap.add_argument('--voice',required=True)
ap.add_argument('--video',required=True); ap.add_argument('--music',required=True); ap.add_argument('--out',required=True)
ap.add_argument('--workdir',default=None); ap.add_argument('--voice-db',type=float,default=-20.7,help='RMS-Ziel der Stimme (dBFS), wie im Original')
ap.add_argument('--model',default='eleven_multilingual_v2'); ap.add_argument('--max-speed',type=float,default=1.15); ap.add_argument('--max-tempo',type=float,default=1.12)
a=ap.parse_args()
KEY=os.environ['ELEVENLABS_API_KEY']
wd=a.workdir or os.path.join(os.environ.get('TMPDIR','/tmp'),f'dub_{a.lang}'); os.makedirs(wd,exist_ok=True)
segs=json.load(open(os.path.join(HERE,f'video_{a.lang}.json')))
def run(*cmd): subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def dur(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).decode().strip())
def rms(p):
    out=subprocess.run(['ffmpeg','-v','info','-i',p,'-af','astats=measure_overall=RMS_level:measure_perchannel=none','-f','null','-'],capture_output=True,text=True).stderr
    for line in out.splitlines():
        if 'RMS level dB' in line: return float(line.split(':')[-1])
    return -20.0
def tts(text, prev, nxt, speed, path):
    body={'text':text,'model_id':a.model,'previous_text':prev or None,'next_text':nxt or None,
          'voice_settings':{'stability':0.5,'similarity_boost':0.8,'style':0.0,'use_speaker_boost':True,'speed':round(speed,2)}}
    body={k:v for k,v in body.items() if v is not None}
    req=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{a.voice}?output_format=mp3_44100_128',data=json.dumps(body).encode(),headers={'xi-api-key':KEY,'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=120) as r: open(path,'wb').write(r.read())
total=dur(a.video)
# Zeitfenster: Segmentstart bis Start des nächsten Segments (letztes bis Videoende), kleine Atempause abgezogen
slots=[]
for i,s in enumerate(segs):
    end = segs[i+1]['start'] if i+1<len(segs) else total
    slots.append(max(0.5, end - s['start'] - 0.12))
pieces=[]; cursor=0.0; report=[]
for i,s in enumerate(segs):
    prev=segs[i-1]['text'] if i else ''; nxt=segs[i+1]['text'] if i+1<len(segs) else ''
    p=os.path.join(wd,f'seg{i:02d}.mp3')
    speed=1.0
    if not os.path.exists(p): tts(s['text'],prev,nxt,speed,p)
    d=dur(p)
    if d>slots[i]*1.02 and a.max_speed>1.0:              # zu lang: mit höherem Sprechtempo neu erzeugen
        speed=min(a.max_speed, d/slots[i]*1.03); p2=os.path.join(wd,f'seg{i:02d}_fast.mp3')
        if not os.path.exists(p2): tts(s['text'],prev,nxt,speed,p2)
        if dur(p2)<d: p,d=p2,dur(p2)
    tempo=1.0
    if d>slots[i]*1.02: tempo=min(a.max_tempo, d/slots[i])  # Rest leicht stauchen (unhörbar bis ~1.1)
    gain=a.voice_db-rms(p)
    wav=os.path.join(wd,f'seg{i:02d}.wav')
    run('ffmpeg','-y','-v','error','-i',p,'-af',f'atempo={tempo:.4f},volume={gain:.2f}dB,aresample=44100','-ac','2',wav)
    d2=dur(wav)
    start=max(s['start'], cursor)                            # nie in das vorige Segment hineinreden
    pieces.append((start,wav)); cursor=start+d2+0.12
    report.append(f"{i:02d} {s['start']:6.2f}→{start:6.2f} slot {slots[i]:5.2f} tts {d:5.2f} speed {speed:.2f} tempo {tempo:.2f} → {d2:5.2f} {'ÜBERLAUF' if start-s['start']>0.4 else ''}")
print('\n'.join(report))
drift=max(st-s['start'] for (st,_),s in zip(pieces,segs)); print(f'max. Verschiebung gegenüber Szene: {drift:.2f}s')
# Stimme zusammensetzen (adelay je Segment), Musikbett darunter, auf Videolänge
inputs=[]; fc=[]
for j,(st,wav) in enumerate(pieces):
    inputs+=['-i',wav]; ms=int(round(st*1000)); fc.append(f'[{j}:a]adelay={ms}|{ms}[v{j}]')
n=len(pieces); inputs+=['-i',a.music]
fc.append(''.join(f'[v{j}]' for j in range(n))+f'amix=inputs={n}:normalize=0:dropout_transition=0[voice]')
fc.append(f'[voice][{n}:a]amix=inputs=2:normalize=0:duration=first[mix]')
mix=os.path.join(wd,'mix.m4a')
run('ffmpeg','-y','-v','error',*inputs,'-filter_complex',';'.join(fc),'-map','[mix]','-t',f'{total:.3f}','-c:a','aac','-b:a','160k',mix)
run('ffmpeg','-y','-v','error','-i',a.video,'-i',mix,'-map','0:v','-map','1:a','-c:v','copy','-c:a','copy','-movflags','+faststart','-shortest',a.out)
print('fertig:',a.out,f'{dur(a.out):.2f}s')
