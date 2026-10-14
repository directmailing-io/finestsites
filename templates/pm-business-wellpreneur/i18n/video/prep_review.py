#!/usr/bin/env python3
"""Bereitet je Sprache die Lektorats-Datei vor: review_in_{lang}.json mit DE-Quelle (Segmente), Dub-Transkript
(aus dub_{lang}.srt zu Fließtext zusammengefügt, Zeitmarken je Untertitel-Block) und Whisper-Abschrift der Tonspur.
Aufruf: OPENAI_API_KEY=… python3 prep.py ru uk …"""
import sys, os, re, json, subprocess, urllib.request
OK=os.environ['OPENAI_API_KEY']
de=json.load(open('transcript_de.json'))
de_segs=[{'start':round(s['start'],1),'end':round(s['end'],1),'text':s['text'].strip()} for s in de['segments']]
def srt_blocks(path):
    out=[]
    for blk in re.split(r'\n\s*\n', open(path,encoding='utf-8').read().strip()):
        lines=blk.strip().split('\n')
        if len(lines)<3: continue
        m=re.match(r'(\d+):(\d+):(\d+)[,.](\d+)', lines[1])
        t=int(m[1])*3600+int(m[2])*60+int(m[3])+int(m[4])/1000
        out.append({'start':round(t,1),'text':' '.join(l.strip() for l in lines[2:])})
    return out
def whisper(lang):
    mp3=f'whisper_{lang}.mp3'; src=f'dub_{lang}.flac' if os.path.exists(f'dub_{lang}.flac') else f'dub_{lang}.mp3'
    subprocess.run(['ffmpeg','-y','-v','error','-i',src,'-ac','1','-b:a','64k',mp3],check=True)
    r=subprocess.run(['curl','-s','https://api.openai.com/v1/audio/transcriptions','-H','Authorization: Bearer '+OK,'-F','file=@'+mp3,'-F','model=whisper-1','-F','language='+lang,'-F','response_format=json'],capture_output=True,text=True,check=True)
    return json.loads(r.stdout).get('text','')
for lang in sys.argv[1:]:
    blocks=srt_blocks(f'dub_{lang}.srt')
    full=' '.join(b['text'] for b in blocks)
    w=whisper(lang); open(f'whisper_{lang}.txt','w').write(w)
    json.dump({'lang':lang,'de_full':de['text'].strip(),'de_segments':de_segs,'dub_text':full,'dub_blocks':blocks,'whisper_of_audio':w},
              open(f'review_in_{lang}.json','w'),ensure_ascii=False,indent=1)
    print(lang,'blocks',len(blocks),'chars',len(full),'whisper chars',len(w))
