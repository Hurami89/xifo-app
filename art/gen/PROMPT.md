# Sprite sheets for the Ventures squad mates

`art/gen_mates.py` cuts the sheets in this folder into the app's Ventures mates (`assets/ventures/gm/<JOB>_<1..8>.png`, a
file for each race look, and
`src/ventures/gen_art.ts`). One sheet per job: 8 rows (the game's race looks in order: Hume m, Hume f, Elvaan m,
Elvaan f, Tarutaru m, Tarutaru f, Mithra, Galka) of 12 frames (3 idle, 3 walking, 3 attacking, 2 of the job's ability,
1 hit), everybody facing right, transparent background. A sheet is found by the job in its file name: the job's
letters (`DRK.png`) or its name (`monk.png`, `White Mage Race Sprite Sheet-1.png`). Of two sheets for one job the
newer file is used.

All 18 jobs have a sheet since app 1.5.0 (Hurami, 2026-11-26: the Warrior sheet first, the other 17 after it). The raw
sheets are about 3 MB each, so they stay on the PC and are not in the repository (`.gitignore`): keep a copy of this
folder somewhere safe, a sheet cannot be made the same way twice.

## Adding or replacing a sheet

1. Save the picture here under the job's letters, for example `SAM.png`.
2. Run

       python art/gen_mates.py SAM --preview art/gen/_preview

   and look at `art/gen/_preview/SAM_frames.png` and `SAM.gif`. The output names what it had to repair: frames that
   touched and were pulled apart, a frame that did not fit its cell, a pet borrowed from another row.
3. Try it in the app (`npx expo start`), then commit `assets/ventures/gm` and `src/ventures/gen_art.ts`.

Needs Python with Pillow, numpy and scipy (`python -m pip install pillow numpy scipy`).

## What the cutter copes with, and what a sheet should avoid

- Sizes: the picture may have any size, and the races and jobs may be drawn at different sizes. Every row is scaled
  so that its standing figure has the same height. A job with tall headgear has a factor in `TALLER` (at the top of
  the script), so the body under the hat is as big as the same person's in the other jobs.
- Pets: a pet belongs to the figure it stands in front of. Best is a pet in all 12 frames that touches nothing
  (the Beastmaster sheet). A pet that is only in the attack and ability frames is copied into the other frames
  (`COMPANION`: a wyvern goes over its master's head, a pet on the ground to its master's feet), and a pet that touches
  its master or the next frame is cut off it first (`LIFT`).
- A sheet with fewer than 12 frames a row needs a line in `PICK` (Beastmaster has two walking frames, not three).
- Frames should not touch each other. Two that do are pulled apart along the line where they touch, which usually
  works; `CUTS` sets the cut by hand when it does not.
- The background must really be transparent, and every figure of a row must stand on the same line.
- One hair colour per row: these sheets cannot show a mate's own hair colour (Kaza's sprites, which they replaced in
  Ventures, could).

## The prompt

For a whole new set in one go: start a new chat in the image tool, attach `Warrior Race Sprite Sheet-1.png`, paste the
prompt once (it makes Monk), then say `next` for each further job.

```
The attached image is the finished WARRIOR sprite sheet for my Final Fantasy XI fan game. Use it as the template. I need the same sheet for 17 more jobs, one job per image.

EVERY NEW IMAGE MUST MATCH THE TEMPLATE:
- The same art style: 16-bit era console JRPG pixel art (SNES / Super Famicom), chibi proportions, crisp pixels, clean dark outline, limited colour palette, no anti-aliasing, no blur, no drop shadow.
- The same eight people, top to bottom, with the same faces, hair, skin and body sizes as in the template: row 1 Hume male (short messy brown hair), row 2 Hume female (shoulder-length brown hair), row 3 Elvaan male (long pointed ears, silver hair), row 4 Elvaan female (long pointed ears, silver ponytail), row 5 Tarutaru male (big ears, spiky blond hair), row 6 Tarutaru female (big ears, blond pigtails), row 7 Mithra female (cat ears, striped orange tail, orange bob), row 8 Galka male (huge, grey skin, no hair, short thick tail).
- The same layout: landscape image, 8 rows and 12 columns, every character seen from the side and facing RIGHT, the same sprite size as the template, feet on the same line in every frame of a row.
- Flat transparent background. No text, no labels, no numbers, no grid lines, no borders.

THE 12 FRAMES OF EVERY ROW, in the template's order:
1-3 Idle: standing ready, breathing.
4-6 Walking: a clear stride, legs alternating.
7-9 Attack: wind-up, strike, follow-through, using the job's attack below.
10-11 Ability: the job's special move below, feet still on the ground.
12 Hit: leaning back with a pained face, a small yellow "!" above the head.

RULES THAT MATTER:
- Every frame stays inside its own cell. Weapons, capes, tails and effects must NOT touch or overlap the next frame. Leave clear empty space between frames; shorten a weapon or pull an effect closer to the body if it would not fit.
- All eight rows wear the SAME job outfit in the SAME colours. Only the person changes.
- Each person keeps the same size, colours and outfit in all 12 of their frames.
- Race features stay visible in every outfit: ears poke out of hats and hoods, helmets are open-faced, tails show.
- A job with a pet has the pet in ALL 12 frames of every row, always in front of (to the right of) its master and the same size in every row. The pet never touches its master, a weapon or the next frame.

THE JOBS (outfit | attack | ability):
2. Monk: sleeveless cream and orange martial-arts gi, purple sash, white headband, cloth hand wraps | punch, punch, high kick | crouched power-up with a yellow aura.
3. White Mage: white hooded robe with red triangle trim on the hem and sleeves, wooden staff with a round head | staff bonk | staff raised with soft white healing sparkles.
4. Black Mage: wide pointed black hat with an orange band, dark blue robe with gold trim, gnarled staff | staff swing | staff raised with a fireball glowing at its tip.
5. Red Mage: red wide-brim hat with a white feather, red long coat with white trim, rapier | rapier thrust | free hand raised with red and blue magic sparks.
6. Thief: green bandana, dark green and brown leather vest, light trousers, two daggers | fast double dagger slash | low crouch, leaning back to dodge.
7. Paladin: shining silver plate armour with blue and gold trim, kite shield, sword | sword slash from behind the shield | shield raised with golden light.
8. Dark Knight: black spiked plate armour with dark red trim, horned open-faced helmet, dark red cape, big scythe | wide scythe sweep with a dark purple arc | dark purple aura around the body.
9. Beastmaster: brown fur-trimmed leather armour, bone-horned headband, one-handed axe; pet: a small blue-shelled crab on the ground | axe swing | arm stretched out calling the pet, with small musical notes.
10. Bard: green feathered cap, green and gold tunic, short cape, small harp, dagger | dagger poke | playing the harp with musical notes floating up.
11. Ranger: green feathered cap, green tunic, leather bracers, longbow and quiver | draw the bow and loose an arrow | careful aim with a glint on the arrowhead.
12. Samurai: red and black lacquered samurai armour, open-faced helmet with a crest, katana | two-handed katana slash with a white arc | katana held upright in front of the face, focusing.
13. Ninja: dark navy ninja garb, hood down, mask over the mouth only, two short swords | quick slash and a thrown shuriken | hand sign with a puff of smoke.
14. Dragoon: purple-blue dragon-scale armour, open-faced helmet with small horns, long lance; pet: a small purple-blue wyvern flying just above head height | lance thrust forward | lance raised high with a blue glow, ready to jump.
15. Summoner: white and green robe with gold ornaments, a small horn circlet on the forehead, slim staff; pet: Carbuncle, a small pale green long-eared creature with a red gem on its forehead, on the ground | staff pointed forward while Carbuncle pounces | staff raised with a glowing summoning circle at the feet.
16. Blue Mage: blue and gold turban, blue tunic with gold patterns, curved sword | curved sword slash | arm raised with swirling blue magic.
17. Corsair: black tricorn hat with a red feather, red-brown long coat with gold buttons, flintlock pistol | pistol shot with a small muzzle flash | throwing two dice into the air.
18. Puppetmaster: tall round performer's hat, cream and teal coat with a scarf, bare hands; pet: a small round-headed brass automaton on the ground | hand thrust forward while the automaton punches | the automaton spits a jet of flame.

START NOW with job 2, Monk. After each image, stop and wait. When I say "next", make the next job on the list. When I say "redo", make the same job again and follow the rules more closely.
```
