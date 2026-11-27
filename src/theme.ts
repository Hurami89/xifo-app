// Looks. TH is filled in once at start (App.tsx reads the saved choice before any screen loads), so every screen's
// styles are made with the chosen look. Changing it takes effect the next time the app opens.
// (2026-11-26) A look is colours, lettering and pictures only: the layout is the same in all four (src/Desktop.tsx).
//   vanadiel  Final Fantasy XI's own menus: navy glass, silver edges, gold
//   aero      the launcher's Aero theme: mid-2000s Frutiger Aero glass, sky and bubbles
//   online    a dark 2003 online-service look, charcoal, beveled buttons, buddy-list yellow, over darkened art
//   dark      the default (2026-11-25, the user: "i want the theme of the app to be dark fantasy"): black and dusk-violet
//             stone, old-gold edges and Cinzel lettering, under a pale moon (Tetra Master's own colours)
export type ThemeName = 'dark' | 'online' | 'vanadiel' | 'aero';

const aero = {
  name: 'aero' as ThemeName,
  label: 'Frutiger Aero',
  titleFont: 'Selawik-Bold', btnFont: 'Selawik-Semibold',
  statusBar: 'light' as 'light' | 'dark',
  wallpaper: require('../assets/art/wallpaper.jpg'),
  logo: require('../assets/art/logo_tile.png'),
  banners: [require('../assets/art/banner_1.jpg'), require('../assets/art/banner_2.jpg'), require('../assets/art/banner_3.jpg'),
    require('../assets/art/banner_4.jpg'), require('../assets/art/banner_5.jpg')],
  ink: '#0B2A44', dim: '#4A6B84', link: '#0A5FC2', accent: '#155AA8', onWall: '#FFFFFF', onWallShadow: '#0B3D91',
  me: '#B4235A', other: '#0A5FC2', system: '#6C8396', enter: '#2E8B1E', hardcore: '#7A1FA2', err: '#B3261E',
  winBg: '#EEF6FD', winOuter: '#1D6EDB',
  titleGrad: ['#A8DBFF', '#3D97EE', '#1567D9', '#1D74E2'], titleText: '#FFFFFF', titleTextShadow: '#08306E',
  paneBg: '#FFFFFF', paneEdge: '#7F9DB9', rowLine: '#EEF3F8', rowPressed: '#DCEBFA', stripText: '#155AA8',
  btnGrad: ['#FFFFFF', '#F1F6FB', '#D9E7F5'], btnBorder: '#2C5F99', btnText: '#0B2A44', btnShine: 0.35, btnRadius: 4,
  primaryGrad: ['#C9F2A8', '#5DC03A', '#2E9A18', '#45B32A'], primaryBorder: '#1D6A10', primaryText: '#FFFFFF', primaryShadow: '#145A0A', primaryRadius: 14,
  disabledGrad: ['#F4F4F4', '#DADADA'], disabledText: '#9AA5AE',
  fieldBg: '#FFFFFF', fieldEdge: '#7F9DB9', fieldText: '#0B2A44', placeholder: '#8FA6B8',
  taskGrad: ['#5FA2F7', '#2E6DE0', '#2457CF', '#1E4DBA'], taskEdge: '#0C3A9C',
  // (2026-11-26) the bottom bar's five tabs: an icon's colour when it rests and when it is the open one, the patch behind
  // the open one; cardShade: how dark the shadow under a section is
  // segOn / segOnText: the chosen game in the top bar's switch (on Aero's blue bar: white, the others their gold)
  barIcon: 'rgba(255,255,255,0.74)', barOn: '#FFFFFF', barOnBg: 'rgba(8,40,110,0.42)', cardShade: 0.22,
  segOn: '#FFFFFF', segOnText: '#155AA8',
  chipBg: 'rgba(255,255,255,0.85)', chipEdge: '#7F9DB9', chipOn: '#2E7FE6', chipOnEdge: '#0B3D91', chipText: '#0B2A44', chipOnText: '#FFFFFF',
  noteBg: '#FFFFE1', noteEdge: '#C9B864', noteText: '#4D4300', hcBg: '#F6EEFB', hcEdge: '#D9C2EA',
  gilBg: '#FFF8D8', gilEdge: '#D7B13B', gilText: '#6B4E00', maxBg: '#FFF2B8', maxEdge: '#D7B13B', boxBg: '#FFFFFF', boxEdge: '#B9D5EC',
  barBg: '#E3EEF9', barFill: '#45B32A', dotOn: '#2FBF3A', dotOff: '#8FB0D8', statBg: 'rgba(255,255,255,0.9)',
  heroEdge: '#0B3D91', menuBg: '#FFFFFF',
  menuText: '#0B2A44', menuSub: '#4A6B84',
  fightShade: 'rgba(6,30,70,0.55)', meterBg: '#FFFFFF', staminaGrad: ['#FF8A7A', '#D9341C'], timeGrad: ['#A8DBFF', '#1D74E2'],
  arrowBox: ['#1A5FB4', '#0B3D91'], arrow: '#FFFFFF', arrowGold: '#F2B600', bigGrad: ['#C9F2A8', '#5DC03A', '#2E9A18'], bigBorder: '#1D6A10',
  chatMode: 'msn' as 'msn' | 'ffxi' | 'online', chatSay: '#0B2A44', feedGood: '#2E8B1E', feedBad: '#AA3333', feedSkill: '#155AA8', feedInfo: '#6B4E00',
  line: '#B9D5EC', red: '#CC3333', green: '#24963A', gold: '#C98A00', panel: '#EEF6FD', pane: '#FFFFFF',
};

export type Theme = typeof aero;

const vanadiel: Theme = {
  ...aero,
  name: 'vanadiel',
  label: "Vana'diel 2006",
  wallpaper: require('../assets/art/v_wallpaper.jpg'),
  logo: require('../assets/art/v_logo_tile.png'),
  banners: [require('../assets/art/v_banner_1.jpg'), require('../assets/art/v_banner_2.jpg'), require('../assets/art/v_banner_3.jpg'),
    require('../assets/art/v_banner_4.jpg'), require('../assets/art/v_banner_5.jpg')],
  ink: '#E9ECF7', dim: '#9DA8CC', link: '#A9D6FF', accent: '#EBCB7C', onWall: '#F4E6B8', onWallShadow: '#000000',
  me: '#FFD27A', other: '#A9D6FF', system: '#B8BED6', enter: '#9BD69B', hardcore: '#D9A6FF', err: '#FF9A8E',
  winBg: 'rgba(12,18,44,0.93)', winOuter: '#1A2350',
  titleGrad: ['#45569A', '#26336E', '#1A2454'], titleText: '#F4E6B8', titleTextShadow: '#000000',
  paneBg: 'rgba(3,6,20,0.55)', paneEdge: '#4C5C98', rowLine: 'rgba(140,150,200,0.16)', rowPressed: 'rgba(120,140,220,0.25)',
  stripText: '#EBCB7C',
  btnGrad: ['#4A599E', '#2C3872', '#1F295A'], btnBorder: '#A3ACD6', btnText: '#F0F2FA', btnShine: 0.1, btnRadius: 3,
  primaryGrad: ['#ECD58E', '#C9A048', '#8E6C24'], primaryBorder: '#F3E2A6', primaryText: '#241800', primaryShadow: '#F8EDC2', primaryRadius: 3,
  disabledGrad: ['#2A3050', '#20263E'], disabledText: '#6C7496',
  fieldBg: '#080E2A', fieldEdge: '#5D6DAA', fieldText: '#F0F2FA', placeholder: '#6E7AA8',
  taskGrad: ['#2A3A7A', '#1E2A60', '#182250', '#121A40'], taskEdge: '#8E97C2',
  barIcon: '#9DA8CC', barOn: '#F4E6B8', barOnBg: 'rgba(235,203,124,0.14)', cardShade: 0.4,
  segOn: '#C9A048', segOnText: '#241800',
  chipBg: 'rgba(12,18,44,0.88)', chipEdge: '#8E97C2', chipOn: '#C9A048', chipOnEdge: '#F3E2A6', chipText: '#E9ECF7', chipOnText: '#241800',
  noteBg: 'rgba(80,64,14,0.55)', noteEdge: '#C9A84A', noteText: '#F3E2A6', hcBg: 'rgba(90,40,120,0.35)', hcEdge: '#9A6AC0',
  gilBg: 'rgba(120,90,20,0.45)', gilEdge: '#C9A84A', gilText: '#F7E4A0', maxBg: 'rgba(201,160,72,0.35)', maxEdge: '#E0BE62',
  boxBg: 'rgba(3,6,20,0.45)', boxEdge: '#4C5C98',
  barBg: 'rgba(0,0,0,0.4)', barFill: '#7FC86A', dotOn: '#4FE05A', dotOff: '#6C7496', statBg: 'rgba(12,18,44,0.9)',
  heroEdge: '#8E97C2', menuBg: '#10183C', menuText: '#E9ECF7', menuSub: '#9DA8CC',
  fightShade: 'rgba(0,0,10,0.6)', meterBg: '#080E2A', staminaGrad: ['#FF9A7A', '#C8301C'], timeGrad: ['#A9D6FF', '#2E6FE0'],
  arrowBox: ['#1A2350', '#080E2A'], arrow: '#FFFFFF', arrowGold: '#F2C640', bigGrad: ['#4A599E', '#2C3872', '#1F295A'], bigBorder: '#C9CFEA',
  chatMode: 'ffxi', chatSay: '#9EF59E', feedGood: '#9BD69B', feedBad: '#FF9A8E', feedSkill: '#A9D6FF', feedInfo: '#EBCB7C',
  line: '#4C5C98', red: '#E06050', green: '#4FBF5A', gold: '#EBCB7C', panel: 'rgba(12,18,44,0.93)', pane: 'rgba(3,6,20,0.55)',
};

const online: Theme = {
  ...aero,
  name: 'online',
  label: 'Online 2003',
  statusBar: 'light',
  wallpaper: require('../assets/art/o_wallpaper.jpg'),
  logo: require('../assets/art/v_logo_tile.png'),
  banners: [require('../assets/art/o_banner_1.jpg'), require('../assets/art/o_banner_2.jpg'), require('../assets/art/o_banner_3.jpg'),
    require('../assets/art/o_banner_4.jpg'), require('../assets/art/o_banner_5.jpg')],
  ink: '#E4E8F2', dim: '#8E98B4', link: '#7FB8FF', accent: '#FFD447', onWall: '#FFE680', onWallShadow: '#000000',
  me: '#FF6A5A', other: '#7FB8FF', system: '#98A2BC', enter: '#86D486', hardcore: '#D29BFF', err: '#FF8A80',
  winBg: '#171A22', winOuter: '#0C0E13',
  titleGrad: ['#3A5488', '#24386A', '#162550', '#101B3C'], titleText: '#FFFFFF', titleTextShadow: '#000000',
  paneBg: '#0E1016', paneEdge: '#3A4256', rowLine: 'rgba(130,145,185,0.14)', rowPressed: 'rgba(90,130,230,0.26)',
  stripText: '#FFD447',
  btnGrad: ['#5C6580', '#3C4460', '#2A3148'], btnBorder: '#000000', btnText: '#EEF1FA', btnShine: 0.12, btnRadius: 2,
  primaryGrad: ['#FFEA8A', '#FFD02E', '#E2A81A', '#F0BA22'], primaryBorder: '#5A4200', primaryText: '#1E1400', primaryShadow: '#FFF6C8', primaryRadius: 3,
  disabledGrad: ['#2A2E38', '#20232C'], disabledText: '#5E6680',
  fieldBg: '#07080C', fieldEdge: '#4A5470', fieldText: '#EEF1FA', placeholder: '#5E6888',
  taskGrad: ['#2A2E3A', '#1C1F28', '#15171E', '#111318'], taskEdge: '#000000',
  barIcon: '#8E98B4', barOn: '#FFD447', barOnBg: 'rgba(255,212,71,0.12)', cardShade: 0.45,
  segOn: '#FFD02E', segOnText: '#1E1400',
  chipBg: 'rgba(14,16,22,0.9)', chipEdge: '#4A5470', chipOn: '#FFD02E', chipOnEdge: '#5A4200', chipText: '#E4E8F2', chipOnText: '#1E1400',
  noteBg: 'rgba(90,70,10,0.45)', noteEdge: '#B8902A', noteText: '#FFE89A', hcBg: 'rgba(80,40,110,0.35)', hcEdge: '#8A5AB0',
  gilBg: 'rgba(110,84,16,0.45)', gilEdge: '#C9A040', gilText: '#FFE48A', maxBg: 'rgba(201,160,72,0.3)', maxEdge: '#E0BE62',
  boxBg: 'rgba(0,0,0,0.35)', boxEdge: '#3A4256',
  barBg: 'rgba(0,0,0,0.45)', barFill: '#FFD02E', dotOn: '#FFD02E', dotOff: '#5E6680', statBg: 'rgba(14,16,22,0.92)',
  heroEdge: '#3A4256', menuBg: '#1A1D26',
  menuText: '#E8ECF8', menuSub: '#8E98B4',
  fightShade: 'rgba(0,0,8,0.6)', meterBg: '#07080C', staminaGrad: ['#FF9A7A', '#C8301C'], timeGrad: ['#9CC8FF', '#2E5FD0'],
  arrowBox: ['#24386A', '#101B3C'], arrow: '#FFFFFF', arrowGold: '#FFD02E', bigGrad: ['#5C6580', '#3C4460', '#2A3148'], bigBorder: '#B8C0D8',
  chatMode: 'online', chatSay: '#E4E8F2', feedGood: '#86D486', feedBad: '#FF8A80', feedSkill: '#7FB8FF', feedInfo: '#FFD447',
  line: '#3A4256', red: '#E06050', green: '#5FC86A', gold: '#FFD447', panel: '#171A22', pane: '#0E1016',
};

const dark: Theme = {
  ...online,
  name: 'dark',
  label: 'Dark Fantasy',
  titleFont: 'Cinzel', btnFont: 'Cinzel',
  wallpaper: require('../assets/art/d_wallpaper.jpg'),
  logo: require('../assets/art/v_logo_tile.png'),
  banners: [require('../assets/art/d_banner_1.jpg'), require('../assets/art/d_banner_2.jpg'), require('../assets/art/d_banner_3.jpg'),
    require('../assets/art/d_banner_4.jpg'), require('../assets/art/d_banner_5.jpg')],
  ink: '#E9E2D0', dim: '#A89F8E', link: '#D9B66A', accent: '#E8C878', onWall: '#E8C878', onWallShadow: '#000000',
  me: '#E8C878', other: '#B9A3E8', system: '#9A92A8', enter: '#9BC78A', hardcore: '#C99BFF', err: '#F08070',
  winBg: 'rgba(14,9,24,0.94)', winOuter: '#0A0612',
  titleGrad: ['#2A1A3E', '#1A0F28', '#0E0818'], titleText: '#E8C878', titleTextShadow: '#000000',
  paneBg: 'rgba(5,3,10,0.6)', paneEdge: '#5A4626', rowLine: 'rgba(232,200,120,0.12)', rowPressed: 'rgba(138,106,46,0.28)',
  stripText: '#E8C878',
  btnGrad: ['#3A2350', '#2A1A3E', '#1A0F28'], btnBorder: '#8A6A2E', btnText: '#E8C878', btnShine: 0.05, btnRadius: 3,
  primaryGrad: ['#E8C878', '#B8903E', '#7A5A1E'], primaryBorder: '#F3DFA0', primaryText: '#1A0F06', primaryShadow: '#F8E8B8', primaryRadius: 3,
  disabledGrad: ['#241A2E', '#18101F'], disabledText: '#6E6478',
  fieldBg: '#07050C', fieldEdge: '#5A4626', fieldText: '#E9E2D0', placeholder: '#6E6478',
  taskGrad: ['#1A0F28', '#120A1C', '#0E0818', '#07050C'], taskEdge: '#5A4626',
  barIcon: '#A89F8E', barOn: '#E8C878', barOnBg: 'rgba(232,200,120,0.13)', cardShade: 0.45,
  segOn: '#B8903E', segOnText: '#1A0F06',
  chipBg: 'rgba(14,9,24,0.9)', chipEdge: '#5A4626', chipOn: '#B8903E', chipOnEdge: '#F3DFA0', chipText: '#E9E2D0', chipOnText: '#1A0F06',
  noteBg: 'rgba(80,58,14,0.45)', noteEdge: '#8A6A2E', noteText: '#F3DFA0', hcBg: 'rgba(80,40,110,0.35)', hcEdge: '#8A5AB0',
  gilBg: 'rgba(110,80,16,0.45)', gilEdge: '#B8903E', gilText: '#F3DFA0', maxBg: 'rgba(184,144,62,0.3)', maxEdge: '#E8C878',
  boxBg: 'rgba(0,0,0,0.4)', boxEdge: '#5A4626',
  barBg: 'rgba(0,0,0,0.5)', barFill: '#B8903E', dotOn: '#E8C878', dotOff: '#5E5468', statBg: 'rgba(14,9,24,0.92)',
  heroEdge: '#8A6A2E', menuBg: '#120C1C',
  menuText: '#E9E2D0', menuSub: '#A89F8E',
  fightShade: 'rgba(5,3,10,0.6)', meterBg: '#07050C', staminaGrad: ['#E8907A', '#A8301C'], timeGrad: ['#B9A3E8', '#5A3A9A'],
  arrowBox: ['#2A1A3E', '#0E0818'], arrow: '#E9E2D0', arrowGold: '#E8C878', bigGrad: ['#3A2350', '#2A1A3E', '#1A0F28'], bigBorder: '#8A6A2E',
  chatMode: 'ffxi', chatSay: '#9EF59E', feedGood: '#9BC78A', feedBad: '#F08070', feedSkill: '#B9A3E8', feedInfo: '#E8C878',
  line: '#5A4626', red: '#D8584A', green: '#7FC86A', gold: '#E8C878', panel: 'rgba(14,9,24,0.94)', pane: 'rgba(5,3,10,0.6)',
};

export const THEMES: Record<ThemeName, Theme> = { dark, online, vanadiel, aero };
export const DEFAULT_THEME: ThemeName = 'dark';
export const TH: Theme = { ...dark };

export function applyTheme(name: string | null | undefined) {
  Object.assign(TH, THEMES[(name as ThemeName) in THEMES ? (name as ThemeName) : DEFAULT_THEME]);
}
