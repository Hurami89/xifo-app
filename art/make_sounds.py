"""Original chiptune sounds for the XIFO app (2026-11-25): short effects for portable fishing and Ventures, and two
looping music tracks. Everything is synthesised here from scratch (square / triangle / noise voices), so it is ours.

Usage:  python art/make_sounds.py          (needs numpy; ffmpeg for the .mp3 music)
Writes assets/sounds/sfx/*.wav (22,050 Hz mono, 16-bit) and assets/sounds/bgm/{fishing,ventures}.mp3."""
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 22050
HERE = os.path.dirname(os.path.abspath(__file__))
SFX = os.path.join(HERE, '..', 'assets', 'sounds', 'sfx')
BGM = os.path.join(HERE, '..', 'assets', 'sounds', 'bgm')
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def hz(name):
    """'A4' -> 440.0"""
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o - 4) - 9) / 12)


def t(sec):
    return np.arange(int(SR * sec)) / SR


def square(f, sec, duty=0.5):
    ph = (t(sec) * f) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def tri(f, sec):
    ph = (t(sec) * f) % 1.0
    return 4 * np.abs(ph - 0.5) - 1


def noise(sec, seed=1):
    return np.random.default_rng(seed).uniform(-1, 1, int(SR * sec))


def env(x, a=0.005, d=0.05, s=0.6, r=0.08):
    n = len(x)
    e = np.ones(n) * s
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    ai, di = min(ai, n), min(di, max(0, n - ai))
    e[:ai] = np.linspace(0, 1, ai, endpoint=False) if ai else e[:ai]
    e[ai:ai + di] = np.linspace(1, s, di, endpoint=False) if di else e[ai:ai + di]
    if ri and n > ri:
        e[-ri:] *= np.linspace(1, 0, ri)
    return x * e


def sweep(f0, f1, sec, voice='square', duty=0.5):
    f = np.linspace(f0, f1, int(SR * sec))
    ph = np.cumsum(f) / SR % 1.0
    if voice == 'tri':
        return 4 * np.abs(ph - 0.5) - 1
    return np.where(ph < duty, 1.0, -1.0)


def seq(notes, step, voice='square', duty=0.5, vol=0.5, s=0.5, r=0.04):
    """notes: list of names or None (rest); each lasts `step` seconds"""
    out = []
    for nm in notes:
        if nm is None:
            out.append(np.zeros(int(SR * step)))
            continue
        x = tri(hz(nm), step) if voice == 'tri' else square(hz(nm), step, duty)
        out.append(env(x, d=step * 0.4, s=s, r=min(r, step * 0.5)) * vol)
    return np.concatenate(out)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def lowpass(x, k=6):
    return np.convolve(x, np.ones(k) / k, mode='same')


def write(name, x, gain=0.6):
    x = np.asarray(x, dtype=float)
    peak = np.max(np.abs(x)) or 1.0
    y = np.clip(x / peak * gain, -1, 1)
    path = os.path.join(SFX, name + '.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((y * 32767).astype('<i2').tobytes())
    return path


# ------------------------------------------------------------------------------------------- fishing effects
def fishing_sfx():
    whoosh = lowpass(noise(0.35, 3), 4) * np.linspace(0.2, 1, int(SR * 0.35)) ** 2 * np.linspace(1, 0, int(SR * 0.35))
    plop = env(sweep(520, 140, 0.12, 'tri'), d=0.05, s=0.3, r=0.05)
    write('cast', np.concatenate([whoosh, np.zeros(int(SR * 0.05)), plop]), 0.5)
    bloop = env(sweep(300, 900, 0.10, 'tri'), s=0.7, r=0.03)
    write('bite', np.concatenate([bloop, seq(['E6', 'B6'], 0.07, duty=0.25, vol=0.5)]), 0.55)
    write('hit', env(sweep(700, 1300, 0.06, duty=0.25), s=0.8, r=0.02), 0.4)
    write('miss', env(square(110, 0.14, 0.5) * 0.6 + lowpass(noise(0.14, 5), 3) * 0.3, s=0.7, r=0.04), 0.4)
    write('gold', seq(['E6', 'G#6', 'B6', 'E7'], 0.045, duty=0.125, vol=0.5, s=0.6), 0.45)
    lead = seq(['C5', 'E5', 'G5', 'C6', None, 'G5', 'C6'], 0.09, duty=0.25, vol=0.5)
    bass = seq(['C3', 'C3', 'G3', 'G3', None, 'C3', 'C3'], 0.09, voice='tri', vol=0.6)
    write('catch', mix(lead, bass), 0.6)
    write('lost', seq(['G4', 'E4', 'C4', 'G3'], 0.11, duty=0.5, vol=0.5, s=0.5), 0.45)
    write('skill', seq(['C6', 'G6', 'C7'], 0.06, duty=0.125, vol=0.5, s=0.7), 0.4)
    reel = np.concatenate([env(lowpass(noise(0.012, 9), 2), a=0.001, d=0.005, s=0.2, r=0.004), np.zeros(int(SR * 0.03))])
    write('reel', np.tile(reel, 3), 0.25)


# ------------------------------------------------------------------------------------------- ventures effects
def ventures_sfx():
    write('select', env(square(880, 0.04, 0.25), s=0.6, r=0.01), 0.3)
    lead = seq(['G4', 'C5', 'E5', 'G5', 'C6'], 0.07, duty=0.25, vol=0.5)
    drum = env(lowpass(noise(0.35, 7), 2), d=0.02, s=0.1, r=0.1) * 0.4
    write('depart', mix(lead, drum), 0.55)
    lead = seq(['C5', 'C5', 'C5', 'C5', None, 'G#4', None, 'A#4', None, 'C5', None, 'A#4', 'C5'],
               0.085, duty=0.25, vol=0.5)
    bass = seq(['C3', None, 'C3', None, None, 'G#2', None, 'A#2', None, 'C3', None, 'G3', 'C3'], 0.085, voice='tri', vol=0.6)
    write('home', mix(lead, bass), 0.6)
    write('levelup', seq(['G5', 'A5', 'B5', 'D6', 'G6'], 0.06, duty=0.125, vol=0.5, s=0.7), 0.45)


# ------------------------------------------------------------------------------------------- music loops
def song(bpm, bars, chords, melody, lead_duty=0.25, swing=0.0):
    """chords: one root note per bar (bass plays root/fifth eighths); melody: list of (note|None, beats)"""
    beat = 60.0 / bpm
    total = bars * 4 * beat
    n = int(SR * total)
    out = np.zeros(n)
    # bass: triangle, root and fifth in eighth notes
    for b, root in enumerate(chords):
        r = hz(root)
        for k in range(8):
            f = r * (1.5 if k % 4 == 2 else 1.0)
            start = int(SR * (b * 4 * beat + k * beat / 2))
            x = env(tri(f, beat / 2), d=beat * 0.2, s=0.6, r=0.02) * 0.45
            out[start:start + len(x)] += x[:n - start]
    # melody: square lead
    pos = 0.0
    for nm, beats in melody:
        dur = beats * beat
        if nm is not None:
            x = env(square(hz(nm), dur, lead_duty), d=dur * 0.3, s=0.55, r=min(0.05, dur * 0.4)) * 0.28
            # a little vibrato-free echo
            start = int(SR * pos)
            out[start:start + len(x)] += x[:n - start]
            e = int(SR * beat * 0.75)
            if start + e < n:
                out[start + e:start + e + len(x)] += x[:n - start - e] * 0.25
        pos += dur
    # soft hat on the off-beats
    hat = env(lowpass(noise(0.03, 11), 2), a=0.001, d=0.01, s=0.1, r=0.01) * 0.12
    for k in range(int(bars * 8)):
        if k % 2:
            s0 = int(SR * k * beat / 2)
            out[s0:s0 + len(hat)] += hat[:n - s0]
    return out


def music():
    # fishing: easy-going, F major, 84 bpm, 16 bars
    chords = ['F2', 'C3', 'D3', 'A#2'] * 4
    mel = []
    phrase_a = [('A4', 1), ('C5', 1), ('D5', 0.5), ('C5', 0.5), ('A4', 1), ('G4', 2), (None, 1), ('A4', 0.5), ('G4', 0.5),
                ('F4', 1), ('D4', 1), ('F4', 1), ('G4', 1), ('A4', 3), (None, 1)]
    phrase_b = [('C5', 1), ('D5', 1), ('F5', 1.5), ('E5', 0.5), ('D5', 2), ('C5', 1), ('A4', 1), ('A#4', 1), ('A4', 0.5),
                ('G4', 0.5), ('F4', 2), ('G4', 1), ('A4', 1), ('F4', 3), (None, 1)]
    mel = phrase_a + phrase_b + phrase_a + phrase_b
    fish = song(84, 16, chords, mel, lead_duty=0.5)
    # ventures: marching, D minor -> F, 118 bpm, 16 bars
    chords = ['D3', 'D3', 'A#2', 'C3', 'D3', 'D3', 'A#2', 'A2'] * 2
    phrase_a = [('D5', 0.5), ('D5', 0.5), ('A4', 1), ('D5', 1), ('F5', 1), ('E5', 0.5), ('D5', 0.5), ('C5', 1), ('A4', 2),
                ('A#4', 1), ('C5', 1), ('D5', 1), ('A#4', 1), ('C5', 1.5), ('A4', 0.5), ('G4', 2),
                ('D5', 0.5), ('D5', 0.5), ('A4', 1), ('D5', 1), ('F5', 1), ('G5', 1), ('F5', 0.5), ('E5', 0.5), ('D5', 2),
                ('A#4', 1), ('D5', 1), ('C5', 1), ('E5', 1), ('D5', 3), (None, 1)]
    mel = phrase_a + phrase_a
    vent = song(118, 16, chords, mel, lead_duty=0.25)
    for name, x in (('fishing', fish), ('ventures', vent)):
        wav = os.path.join(tempfile.gettempdir(), 'xifo-' + name + '.wav')
        peak = np.max(np.abs(x)) or 1
        y = np.clip(x / peak * 0.55, -1, 1)
        with wave.open(wav, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((y * 32767).astype('<i2').tobytes())
        mp3 = os.path.join(BGM, name + '.mp3')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '64k', mp3], check=True)
        os.remove(wav)


if __name__ == '__main__':
    os.makedirs(SFX, exist_ok=True)
    os.makedirs(BGM, exist_ok=True)
    fishing_sfx()
    ventures_sfx()
    music()
    for d in (SFX, BGM):
        for f in sorted(os.listdir(d)):
            print(os.path.join(os.path.basename(d), f), os.path.getsize(os.path.join(d, f)))
