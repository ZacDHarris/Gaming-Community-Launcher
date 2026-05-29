import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────────────────────
//  FREE DATA SOURCES (zero API keys required)
//  1. Reddit  → https://www.reddit.com/r/{sub}/hot.json   (public, no auth)
//  2. Steam   → https://store.steampowered.com/api/appreviews/{appid}  (no key)
//  3. Steam   → https://store.steampowered.com/api/appdetails/{appid}  (no key)
//  4. Wikipedia→ https://en.wikipedia.org/api/rest_v1/page/summary/{title} (no key)
//  5. All art  → steamcdn-a.akamaihd.net  (Steam's free public CDN)
// ─────────────────────────────────────────────────────────────────────────────

const STEAM_HEADER = (id) => `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`;
const STEAM_REVIEWS = (id) => `https://store.steampowered.com/api/appreviews/${id}?json=1&language=english&review_type=all&purchase_type=all&num_per_page=6&cursor=*&filter=recent`;
const STEAM_DETAILS = (id) => `https://store.steampowered.com/api/appdetails?appids=${id}&l=english`;
const REDDIT_HOT   = (sub, n=8) => `https://www.reddit.com/r/${sub}/hot.json?limit=${n}`;
const WIKI_SUMMARY = (title) => `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

// ─── Patch notes: direct links to official sources (free, no scraping needed) ─
const PATCH_LINKS = {
  730:     { label:"CS2 Patch Notes",         url:"https://www.counter-strike.net/news/updates",          site:"counter-strike.net" },
  1245620: { label:"Elden Ring Patches",       url:"https://en.bandainamcoent.eu/elden-ring/news",         site:"bandainamco.eu" },
  1091500: { label:"Cyberpunk 2077 Updates",   url:"https://www.cyberpunk.net/en/news",                    site:"cyberpunk.net" },
  1086940: { label:"BG3 Patch Notes",          url:"https://baldursgate3.game/news",                       site:"baldursgate3.game" },
  570:     { label:"Dota 2 Changelog",         url:"https://www.dota2.com/patches",                        site:"dota2.com" },
  546560:  { label:"HL: Alyx Updates",         url:"https://store.steampowered.com/news/app/546560",       site:"steampowered.com" },
  620:     { label:"Portal 2 Updates",         url:"https://store.steampowered.com/news/app/620",          site:"steampowered.com" },
  1145360: { label:"Hades Patch Notes",        url:"https://store.steampowered.com/news/app/1145360",      site:"steampowered.com" },
  548430:  { label:"DRG Update Notes",         url:"https://store.steampowered.com/news/app/548430",       site:"steampowered.com" },
  413150:  { label:"Stardew Updates",          url:"https://www.stardewvalley.net/category/updates/",      site:"stardewvalley.net" },
  367520:  { label:"Hollow Knight Updates",    url:"https://store.steampowered.com/news/app/367520",       site:"steampowered.com" },
  1623730: { label:"Palworld Patches",         url:"https://store.steampowered.com/news/app/1623730",      site:"steampowered.com" },
  105600:  { label:"Terraria Changelog",       url:"https://terraria.wiki.gg/wiki/Version_history",        site:"terraria.wiki.gg" },
  2358720: { label:"Black Myth Patches",       url:"https://store.steampowered.com/news/app/2358720",      site:"steampowered.com" },
  292030:  { label:"Witcher 3 Updates",        url:"https://store.steampowered.com/news/app/292030",       site:"steampowered.com" },
  435150:  { label:"Divinity Updates",         url:"https://store.steampowered.com/news/app/435150",       site:"steampowered.com" },
  219990:  { label:"Grim Dawn Updates",        url:"https://store.steampowered.com/news/app/219990",       site:"steampowered.com" },
};

// ─── Platform shop URLs (open each launcher's store) ─────────────────────────
const PLATFORM_SHOPS = {
  steam:      'steam://store',
  epic:       'com.epicgames.launcher://store/browse',
  blizzard:   'battlenet://',
  ea:         'origin://store',
  ubisoft:    'uplay://store',

  valorant:   'riotclient://store',
  minecraft:  'https://www.minecraft.net/en-us/marketplace',
  curseforge: 'https://www.curseforge.com/minecraft',
};

// ─── Launch URL builder ───────────────────────────────────────────────────────
function getLaunchUrl(game, platform) {
  if (platform.id === 'steam'    && game.appId)         return `steam://rungameid/${game.appId}`;
  if (platform.id === 'blizzard' && game.battlenetId)   return `battlenet://${game.battlenetId}`;
  if (platform.id === 'valorant' && game.riotProductId) return `riotclient://launch-product?product=${game.riotProductId}`;
  if (platform.id === 'epic'     && game.epicAppName)   return `com.epicgames.launcher://apps/${game.epicAppName}?action=launch`;
  if (platform.id === 'ubisoft'  && game.ubisoftId && !game.ubisoftId.startsWith('ubi_dir')) return `uplay://launch/${game.ubisoftId}/0`;
  const defaults = { epic:'com.epicgames.launcher://', ea:'origin://', ubisoft:'uplay://', minecraft:'minecraft://', curseforge:'curseforge://' };
  return defaults[platform.id] || null;
}

// ─── Platform definitions ─────────────────────────────────────────────────────
const PLATFORMS = [
  { id:"steam",      name:"Steam",           color:"#1b2838", accent:"#66c0f4", bg:"#171a21" },
  { id:"epic",       name:"Epic Games",      color:"#0d1117", accent:"#c0c0c0", bg:"#0d1117" },
  { id:"blizzard",   name:"Battle.net",      color:"#003087", accent:"#00aaff", bg:"#001b4f" },
  { id:"ea",         name:"EA App",          color:"#111",    accent:"#f56c2d", bg:"#0d0d0d" },
  { id:"ubisoft",    name:"Ubisoft Connect", color:"#0a0a0a", accent:"#2685d6", bg:"#050519" },

  { id:"valorant",   name:"Riot Client",     color:"#0f1923", accent:"#ff4655", bg:"#0f1923" },
  { id:"minecraft",  name:"Minecraft",       color:"#1e3a1e", accent:"#62b547", bg:"#0f1f0f" },
  { id:"curseforge", name:"CurseForge",      color:"#1a0a00", accent:"#f16436", bg:"#120800" },
  { id:"custom",     name:"Custom",          color:"#1a1a2e", accent:"#a78bfa", bg:"#0f0f1a" },
];

// ─── Game libraries ───────────────────────────────────────────────────────────
const LIBRARIES = {
  steam: [
    { id:"s1",  name:"Counter-Strike 2",     genre:"FPS",          downloaded:true,  size:"28",  hours:420,  rating:9.1, appId:730,     subreddit:"GlobalOffensive", wiki:"Counter-Strike_2"         },
    { id:"s2",  name:"Elden Ring",           genre:"Action RPG",   downloaded:true,  size:"44",  hours:180,  rating:9.6, appId:1245620, subreddit:"Eldenring",        wiki:"Elden_Ring"               },
    { id:"s3",  name:"Cyberpunk 2077",       genre:"RPG",          downloaded:true,  size:"70",  hours:95,   rating:8.8, appId:1091500, subreddit:"cyberpunkgame",    wiki:"Cyberpunk_2077"           },
    { id:"s4",  name:"Baldur's Gate 3",      genre:"RPG",          downloaded:false, size:"122", hours:0,    rating:9.8, appId:1086940, subreddit:"BaldursGate3",     wiki:"Baldur%27s_Gate_3"        },
    { id:"s5",  name:"Dota 2",               genre:"MOBA",         downloaded:true,  size:"32",  hours:1240, rating:7.9, appId:570,     subreddit:"DotA2",            wiki:"Dota_2"                   },
    { id:"s6",  name:"Half-Life: Alyx",      genre:"VR Shooter",   downloaded:false, size:"67",  hours:0,    rating:9.5, appId:546560,  subreddit:"HalfLife",         wiki:"Half-Life:_Alyx"          },
    { id:"s7",  name:"Portal 2",             genre:"Puzzle",       downloaded:true,  size:"8",   hours:22,   rating:9.7, appId:620,     subreddit:"Portal",           wiki:"Portal_2"                 },
    { id:"s8",  name:"Hades",                genre:"Roguelike",    downloaded:false, size:"9",   hours:0,    rating:9.4, appId:1145360, subreddit:"HadesTheGame",     wiki:"Hades_(video_game)"       },
    { id:"s9",  name:"Deep Rock Galactic",   genre:"Co-op",        downloaded:true,  size:"10",  hours:310,  rating:9.3, appId:548430,  subreddit:"DeepRockGalactic", wiki:"Deep_Rock_Galactic"       },
    { id:"s10", name:"Stardew Valley",       genre:"Simulation",   downloaded:false, size:"1",   hours:0,    rating:9.5, appId:413150,  subreddit:"StardewValley",    wiki:"Stardew_Valley"           },
    { id:"s11", name:"Hollow Knight",        genre:"Metroidvania", downloaded:true,  size:"9",   hours:58,   rating:9.4, appId:367520,  subreddit:"HollowKnight",     wiki:"Hollow_Knight"            },
    { id:"s12", name:"Palworld",             genre:"Survival",     downloaded:true,  size:"20",  hours:88,   rating:7.8, appId:1623730, subreddit:"Palworld",         wiki:"Palworld"                 },
    { id:"s13", name:"Terraria",             genre:"Sandbox",      downloaded:true,  size:"1",   hours:450,  rating:9.6, appId:105600,  subreddit:"Terraria",         wiki:"Terraria"                 },
    { id:"s14", name:"Black Myth: Wukong",   genre:"Action RPG",   downloaded:false, size:"130", hours:0,    rating:8.9, appId:2358720, subreddit:"BlackMythWukong",  wiki:"Black_Myth:_Wukong"       },
  ],
  epic: [
    { id:"e1",  name:"Fortnite",             genre:"Battle Royale",downloaded:true,  size:"30",  hours:200,  rating:7.5, img:"https://cdn2.unrealengine.com/en-fn-og-c1s8-40-10-egs-launcher-keyart-carousel-pdp-2560x1440-logo-2560x1440-f03e1471746a.jpg", subreddit:"FortNiteBR",       wiki:"Fortnite",                 patchUrl:"https://www.fortnite.com/news",              patchLabel:"Fortnite Patch Notes"      },
    { id:"e2",  name:"Rocket League",        genre:"Sports",       downloaded:true,  size:"20",  hours:380,  rating:8.7, appId:252950, img:"https://cdn.akamai.steamstatic.com/steam/apps/252950/header.jpg", subreddit:"RocketLeague",        wiki:"Rocket_League",            patchUrl:"https://www.rocketleague.com/news",          patchLabel:"Rocket League Updates"     },
    { id:"e3",  name:"Fall Guys",            genre:"Party",        downloaded:false, size:"10",  hours:0,    rating:7.8, appId:1097150,                subreddit:"FallGuysGame",        wiki:"Fall_Guys",                patchUrl:"https://www.fallguys.com/en-US/news",        patchLabel:"Fall Guys News"            },
    { id:"e4",  name:"Alan Wake 2",          genre:"Horror",       downloaded:false, size:"90",  hours:0,    rating:9.1, appId:1903790,                subreddit:"alanwake",            wiki:"Alan_Wake_2",              patchUrl:"https://www.remedygames.com/games/alan-wake-2", patchLabel:"Alan Wake 2 News"       },
    { id:"e5",  name:"Satisfactory",         genre:"Factory",      downloaded:true,  size:"15",  hours:120,  rating:9.3, appId:526870,                 subreddit:"SatisfactoryGame",    wiki:"Satisfactory_(video_game)" },
    { id:"e6",  name:"Control",              genre:"Action",       downloaded:true,  size:"30",  hours:28,   rating:8.7, appId:870780,                 subreddit:"controlgame",         wiki:"Control_(video_game)"      },
    { id:"e7",  name:"Sifu",                 genre:"Beat Em Up",   downloaded:true,  size:"16",  hours:41,   rating:8.5, appId:1371640,                subreddit:"Sifu_game",           wiki:"Sifu_(video_game)"         },
  ],
  blizzard: [
    { id:"b1",  name:"World of Warcraft",    genre:"MMORPG",    downloaded:true,  size:"100", hours:2400, rating:8.2, battlenetId:"WoW",  subreddit:"wow",         wiki:"World_of_Warcraft",       patchUrl:"https://worldofwarcraft.blizzard.com/en-us/news/patch-notes",           patchLabel:"WoW Patch Notes"            },
    { id:"b2",  name:"Overwatch 2",          genre:"FPS",       downloaded:true,  size:"50",  hours:340,  rating:7.4, battlenetId:"Pro",  subreddit:"Overwatch",   wiki:"Overwatch_2",             patchUrl:"https://overwatch.blizzard.com/en-us/news/patch-notes",                 patchLabel:"Overwatch 2 Patch Notes"    },
    { id:"b3",  name:"Diablo IV",            genre:"ARPG",      downloaded:true,  size:"90",  hours:210,  rating:8.5, battlenetId:"D4",   subreddit:"diablo4",     wiki:"Diablo_IV",               patchUrl:"https://diablo4.blizzard.com/en-us/news",                               patchLabel:"Diablo IV News"             },
    { id:"b4",  name:"Hearthstone",          genre:"Card Game", downloaded:false, size:"5",   hours:0,    rating:7.7, battlenetId:"WTCG", subreddit:"hearthstone", wiki:"Hearthstone",             patchUrl:"https://hearthstone.blizzard.com/en-us/news",                           patchLabel:"Hearthstone Patch Notes"    },
    { id:"b5",  name:"StarCraft II",         genre:"RTS",       downloaded:false, size:"35",  hours:0,    rating:9.0, battlenetId:"S2",   subreddit:"starcraft",   wiki:"StarCraft_II",            patchUrl:"https://starcraft2.blizzard.com/en-us/news",                            patchLabel:"StarCraft II News"          },
    { id:"b6",  name:"Diablo II Resurrected",genre:"ARPG",      downloaded:true,  size:"30",  hours:88,   rating:9.1, battlenetId:"OSI",  subreddit:"Diablo",      wiki:"Diablo_II:_Resurrected",  patchUrl:"https://diablo2.blizzard.com/en-us/news",                               patchLabel:"Diablo II Updates"          },
  ],
  ea: [
    { id:"ea1", name:"Apex Legends",          genre:"Battle Royale",downloaded:true,  size:"75",  hours:520,  rating:8.3, appId:1172470, subreddit:"apexlegends",  wiki:"Apex_Legends"                   },
    { id:"ea2", name:"It Takes Two",           genre:"Co-op",        downloaded:true,  size:"50",  hours:16,   rating:9.4, appId:1426210, subreddit:"ItTakesTwo",   wiki:"It_Takes_Two_(video_game)"      },
    { id:"ea3", name:"Mass Effect Legendary",  genre:"RPG",          downloaded:true,  size:"120", hours:140,  rating:9.5, appId:1328670, subreddit:"masseffect",   wiki:"Mass_Effect_Legendary_Edition"  },
    { id:"ea4", name:"Dead Space",             genre:"Horror",       downloaded:false, size:"50",  hours:0,    rating:9.0, appId:1693980, subreddit:"deadspace",    wiki:"Dead_Space_(2023_video_game)"   },
    { id:"ea5", name:"Star Wars Jedi Survivor",genre:"Action",       downloaded:false, size:"155", hours:0,    rating:8.6, subreddit:"StarWarsJedi", wiki:"Star_Wars_Jedi:_Survivor", patchUrl:"https://www.ea.com/games/starwars/jedi/jedi-survivor/news", patchLabel:"Jedi Survivor News" },
  ],
  ubisoft: [
    { id:"u1",  name:"Assassin's Creed Mirage",genre:"Action",     downloaded:true,  size:"40",  hours:32,   rating:8.0, appId:2161700, subreddit:"assassinscreed", wiki:"Assassin%27s_Creed_Mirage",             patchUrl:"https://www.ubisoft.com/en-us/game/assassins-creed/mirage/news", patchLabel:"AC Mirage News"          },
    { id:"u2",  name:"Rainbow Six Siege",      genre:"Tactical",   downloaded:true,  size:"55",  hours:890,  rating:8.5, appId:359550,  subreddit:"Rainbow6",       wiki:"Tom_Clancy%27s_Rainbow_Six_Siege"                                                                                                              },
    { id:"u3",  name:"The Crew Motorfest",     genre:"Racing",     downloaded:false, size:"65",  hours:0,    rating:7.9,                subreddit:"thecrewgame",    wiki:"The_Crew_Motorfest",                    patchUrl:"https://www.ubisoft.com/en-us/game/the-crew/motorfest/news",     patchLabel:"The Crew Motorfest News" },
    { id:"u4",  name:"For Honor",              genre:"Fighting",   downloaded:false, size:"30",  hours:0,    rating:8.0, appId:304390,  subreddit:"forhonor",       wiki:"For_Honor"                                                                                                                                     },
  ],
  valorant: [
    { id:"v1",  name:"Valorant",              genre:"Tactical FPS",downloaded:true,  size:"22",  hours:640,  rating:8.5, riotProductId:"valorant",          subreddit:"VALORANT",          wiki:"Valorant",             patchUrl:"https://playvalorant.com/en-us/news/game-updates/",                         patchLabel:"Valorant Patch Notes"        },
    { id:"v2",  name:"League of Legends",     genre:"MOBA",        downloaded:false, size:"24",  hours:0,    rating:7.8, riotProductId:"league_of_legends", subreddit:"leagueoflegends",   wiki:"League_of_Legends",    patchUrl:"https://www.leagueoflegends.com/en-us/news/game-updates/",                  patchLabel:"LoL Patch Notes"             },
    { id:"v3",  name:"Teamfight Tactics",     genre:"Auto Battler",downloaded:true,  size:"9",   hours:280,  rating:8.0, riotProductId:"league_of_legends", subreddit:"TeamfightTactics",  wiki:"Teamfight_Tactics",    patchUrl:"https://teamfighttactics.leagueoflegends.com/en-us/news/",                  patchLabel:"TFT Patch Notes"             },
    { id:"v4",  name:"Legends of Runeterra",  genre:"Card Game",   downloaded:false, size:"6",   hours:0,    rating:8.2, riotProductId:"bacon",             subreddit:"LegendsOfRuneterra", wiki:"Legends_of_Runeterra", patchUrl:"https://playruneterra.com/en-us/news/",                                      patchLabel:"Runeterra Updates"           },
  ],
  minecraft: [
    { id:"mc1", name:"Minecraft Java Edition",genre:"Sandbox",     downloaded:true,  size:"1",   hours:1200, rating:9.8, img:"https://www.minecraft.net/content/dam/games/minecraft/key-art/MC-Vanilla_Block-Image_1200x628.jpg", subreddit:"Minecraft", wiki:"Minecraft" },
    { id:"mc2", name:"Minecraft Bedrock",     genre:"Sandbox",     downloaded:true,  size:"1",   hours:400,  rating:9.5, img:null, subreddit:"Minecraft",       wiki:"Minecraft" },
    { id:"mc3", name:"Minecraft Dungeons",    genre:"Dungeon Crawler",downloaded:false,size:"6", hours:0,    rating:7.8, img:null, subreddit:"MinecraftDungeons", wiki:"Minecraft_Dungeons" },
  ],
  curseforge: [
    { id:"cf1", name:"All the Mods 9",        genre:"Modpack",     downloaded:true,  size:"8",   hours:130,  rating:9.1, img:null, subreddit:"feedthebeast", wiki:"Minecraft" },
    { id:"cf2", name:"RLCraft",               genre:"Modpack",     downloaded:false, size:"4",   hours:0,    rating:8.8, img:null, subreddit:"RLCraft",      wiki:"Minecraft" },
    { id:"cf3", name:"SkyFactory 4",          genre:"Modpack",     downloaded:true,  size:"5",   hours:88,   rating:8.5, img:null, subreddit:"feedthebeast", wiki:"Minecraft" },
    { id:"cf4", name:"Better MC",             genre:"Modpack",     downloaded:false, size:"3",   hours:0,    rating:8.3, img:null, subreddit:"feedthebeast", wiki:"Minecraft" },
    { id:"cf5", name:"Valhelsia 6",           genre:"Modpack",     downloaded:false, size:"6",   hours:0,    rating:8.0, img:null, subreddit:"feedthebeast", wiki:"Minecraft" },
  ],
  custom: [],
};

const THEMES = [
  { id:"midnight", label:"Midnight", bg:"#07070e", surface:"#0e0e1a", card:"#13132a", border:"#1c1c38", accent:"#7c3aed", text:"#e2e8f0", sub:"#64748b" },
  { id:"ember",    label:"Ember",    bg:"#0e0500", surface:"#190b00", card:"#241000", border:"#3a1e00", accent:"#f97316", text:"#fef3c7", sub:"#92400e" },
  { id:"arctic",   label:"Arctic",   bg:"#020c18", surface:"#041628", card:"#071e38", border:"#0c2e5a", accent:"#38bdf8", text:"#e0f2fe", sub:"#0369a1" },
  { id:"forest",   label:"Forest",   bg:"#020e04", surface:"#041808", card:"#072410", border:"#0b3a18", accent:"#22c55e", text:"#dcfce7", sub:"#166534" },
  { id:"crimson",  label:"Crimson",  bg:"#0e0204", surface:"#180408", card:"#240510", border:"#3a0a18", accent:"#f43f5e", text:"#ffe4e6", sub:"#9f1239" },
  { id:"gold",     label:"Gold",     bg:"#0e0c00", surface:"#181600", card:"#242000", border:"#3a3600", accent:"#eab308", text:"#fefce8", sub:"#854d0e" },
];

// ─── Particles ─────────────────────────────────────────────────────────────────
let _pid = 0;
function useParticles() {
  const [particles, setParticles] = useState([]);
  const fire = useCallback((x, y, color) => {
    const id = ++_pid;
    setParticles(p => [...p, { id, x, y, color }]);
    setTimeout(() => setParticles(p => p.filter(p => p.id !== id)), 900);
  }, []);
  return [particles, fire];
}
function Particles({ particles }) {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9990 }}>
      {particles.map(p => (
        <div key={p.id} style={{ position:"absolute", left:p.x, top:p.y }}>
          {[...Array(12)].map((_, i) => {
            const a = (i / 12) * Math.PI * 2, d = 28 + (i % 3) * 16;
            return <div key={i} style={{ position:"absolute", width:5+i%3*2, height:5+i%3*2, borderRadius:"50%", background:p.color, left:-3, top:-3, "--tx":`${Math.cos(a)*d}px`, "--ty":`${Math.sin(a)*d}px`, animation:`burst 0.7s cubic-bezier(0,0.9,0.57,1) forwards`, animationDelay:`${i*8}ms` }} />;
          })}
          <div style={{ position:"absolute", width:58, height:58, borderRadius:"50%", left:-29, top:-29, border:`2px solid ${p.color}`, animation:"ring 0.6s ease-out forwards" }} />
          <div style={{ position:"absolute", width:22, height:22, borderRadius:"50%", left:-11, top:-11, background:`radial-gradient(circle, ${p.color}cc, transparent)`, animation:"flash 0.3s ease-out forwards" }} />
        </div>
      ))}
    </div>
  );
}

// ─── Ripple ─────────────────────────────────────────────────────────────────
let _rid = 0;
function useRipple() {
  const [ripples, setRipples] = useState([]);
  const add = (e, color) => {
    const rect = e.currentTarget.getBoundingClientRect(), id = ++_rid;
    setRipples(r => [...r, { id, x: e.clientX-rect.left, y: e.clientY-rect.top, color }]);
    setTimeout(() => setRipples(r => r.filter(r => r.id !== id)), 700);
  };
  return [ripples, add];
}

// ─── SVG Platform logos — tries ./logos/{pid}.png first, falls back to SVG ───
const _LOGO_VER = Date.now();
function PlatLogo({ pid, size=20, style={} }) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeScale = pid === 'epic' ? 1.9 : pid === 'custom' ? 1.7 : 1;
  const effectiveSize = Math.round(size * sizeScale);
  const s = { width:effectiveSize, height:effectiveSize, ...style };
  if (!imgFailed) {
    const fileMap = { valorant:'riot', steam:'Steam', epic:'Epic', ubisoft:'Ubisoft' };
    const file = fileMap[pid] || pid;
    return <img src={`./logos/${file}.png?v=${_LOGO_VER}`} alt="" style={{ width:effectiveSize, height:effectiveSize, objectFit:'contain', display:'block', ...style }} onError={() => setImgFailed(true)} />;
  }
  // SVG fallback
  const logos = {
    // Steam — official blue gear/controller style
    steam: <svg viewBox="0 0 256 256" {...s}>
      <circle cx="128" cy="128" r="128" fill="#1b2838"/>
      <path d="M128 32C75.2 32 32 75.2 32 128c0 44.8 29.4 83.0 70.2 96.4l-20.4-44.6c-6.6-2.8-11.4-9.2-11.4-16.8 0-10 8.2-18.2 18.2-18.2 2.8 0 5.4.6 7.8 1.8l23 10.2c0-.4 0-.8 0-1.2 0-28.6 23.2-51.8 51.8-51.8 28.6 0 51.8 23.2 51.8 51.8 0 28.6-23.2 51.8-51.8 51.8-1 0-2 0-2.8-.02l-43.2 22.8c2.6.2 5.2.4 7.8.4 53 0 96-42.8 96-96s-42.8-96-96-96zm-39.8 120.6c7 0 12.6 5.6 12.6 12.6 0 7-5.6 12.6-12.6 12.6-7 0-12.6-5.6-12.6-12.6 0-7 5.6-12.6 12.6-12.6zm87.8-20.2c-19 0-34.4-15.4-34.4-34.4 0-19 15.4-34.4 34.4-34.4 19 0 34.4 15.4 34.4 34.4 0 19-15.4 34.4-34.4 34.4zm0-10.8c13.2 0 23.6-10.6 23.6-23.6s-10.6-23.6-23.6-23.6-23.6 10.6-23.6 23.6 10.6 23.6 23.6 23.6z" fill="#66c0f4"/>
    </svg>,
    // Epic Games — bold stylized "E" mark on dark background
    epic: <svg viewBox="0 0 256 256" {...s}>
      <rect width="256" height="256" rx="24" fill="#0d1117"/>
      <path d="M60 44h136v36H100v28h84v32h-84v28h96v36H60z" fill="white"/>
    </svg>,
    // Battle.net — blue starburst / asterisk
    blizzard: <svg viewBox="0 0 256 256" {...s}>
      <circle cx="128" cy="128" r="128" fill="#003087"/>
      <g fill="#148eff" strokeLinecap="round">
        <ellipse cx="128" cy="128" rx="18" ry="62" fill="#148eff"/>
        <ellipse cx="128" cy="128" rx="18" ry="62" fill="#148eff" transform="rotate(60 128 128)"/>
        <ellipse cx="128" cy="128" rx="18" ry="62" fill="#148eff" transform="rotate(120 128 128)"/>
        <circle cx="128" cy="128" r="24" fill="#148eff"/>
      </g>
      <g fill="#0050cc">
        <ellipse cx="128" cy="128" rx="9" ry="55" transform="rotate(30 128 128)"/>
        <ellipse cx="128" cy="128" rx="9" ry="55" transform="rotate(90 128 128)"/>
        <ellipse cx="128" cy="128" rx="9" ry="55" transform="rotate(150 128 128)"/>
      </g>
    </svg>,
    // EA — orange EA logotype on black
    ea: <svg viewBox="0 0 256 256" {...s}>
      <rect width="256" height="256" rx="24" fill="#111"/>
      <path d="M52 92h80v20H74v16h48v18H74v20h60v20H52z" fill="#f56c2d"/>
      <path d="M148 92h56v20h-34v16h26v18h-26v20h34v20h-56z" fill="#f56c2d"/>
    </svg>,
    // Ubisoft — iconic spiral/flower logo
    ubisoft: <svg viewBox="0 0 256 256" {...s}>
      <circle cx="128" cy="128" r="128" fill="#0a0a0a"/>
      <g fill="none" stroke="#2685d6" strokeWidth="14" strokeLinecap="round">
        <circle cx="128" cy="94" r="36"/>
        <path d="M128 58 C180 58 210 100 200 148 C192 184 160 206 128 206 C90 206 54 176 52 136" strokeWidth="18"/>
        <circle cx="128" cy="82" r="10" fill="#2685d6" stroke="none"/>
      </g>
    </svg>,
    // Riot Client — stylized angular "R" on dark background
    valorant: <svg viewBox="0 0 256 256" {...s}>
      <rect width="256" height="256" fill="#0f1923"/>
      <path d="M56 44h80c28 0 48 18 48 44 0 20-12 36-30 42l34 82h-44l-30-76H96v76H56z" fill="#ff4655"/>
      <path d="M96 84v40h36c12 0 20-8 20-20s-8-20-20-20z" fill="#0f1923"/>
    </svg>,
    // Minecraft — grass block face (iconic green top, dirt sides, face)
    minecraft: <svg viewBox="0 0 256 256" {...s}>
      <rect width="256" height="256" fill="#8b5a2b"/>
      <rect x="0" y="0" width="256" height="80" fill="#5a9e32"/>
      <rect x="0" y="60" width="256" height="24" fill="#7ab83a"/>
      <rect x="58" y="98" width="46" height="42" rx="4" fill="#1a1a1a"/>
      <rect x="152" y="98" width="46" height="42" rx="4" fill="#1a1a1a"/>
      <rect x="70" y="106" width="22" height="22" rx="2" fill="#ffffff" opacity="0.15"/>
      <rect x="164" y="106" width="22" height="22" rx="2" fill="#ffffff" opacity="0.15"/>
      <rect x="94" y="168" width="68" height="16" rx="3" fill="#1a1a1a"/>
      <rect x="76" y="184" width="104" height="12" rx="3" fill="#1a1a1a"/>
    </svg>,
    // CurseForge — orange flame shape
    curseforge: <svg viewBox="0 0 256 256" {...s}>
      <rect width="256" height="256" rx="24" fill="#1a0a00"/>
      <path d="M128 28 C128 28 172 72 172 112 C172 132 162 148 148 158 C152 144 148 128 136 118 C136 138 122 152 108 162 C102 150 100 136 106 122 C94 134 86 152 88 172 C78 162 72 146 72 130 C72 84 128 28 128 28z" fill="#f16436"/>
      <path d="M128 80 C128 80 152 108 150 136 C148 152 138 164 124 170 C130 158 128 144 118 134 C120 148 112 162 100 170 C96 160 96 148 102 138 C96 146 92 158 94 170 C86 160 84 148 88 134 C88 100 128 80 128 80z" fill="#ff8c42"/>
      <circle cx="128" cy="178" r="18" fill="#ffb347"/>
    </svg>,
  };
  return logos[pid] || <svg viewBox="0 0 256 256" {...s}><rect width="256" height="256" rx="28" fill="#333"/><text x="50%" y="57%" dominantBaseline="middle" textAnchor="middle" fontSize="160" fill="white">🎮</text></svg>;
}

// ─── Game image helper ────────────────────────────────────────────────────────
function gameImg(g) {
  if (g.appId) return STEAM_HEADER(g.appId);
  if (g.img)   return g.img;
  return null;
}

// ─── Auto-fetch art: Steam search → Wikipedia thumbnail fallback ─────────────
const steamArtCache = new Map();
function useGameArt(game) {
  const [art, setArt] = useState(() => gameImg(game));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (game.appId) return; // Steam CDN via STEAM_HEADER handles this
    if (art && !failed) return;

    const name = game.name;

    function tryWiki() {
      if (!game.wiki) return;
      fetch(WIKI_SUMMARY(game.wiki))
        .then(r => r.json())
        .then(d => { if (d.thumbnail?.source) setArt(d.thumbnail.source); })
        .catch(() => {});
    }

    if (steamArtCache.has(name)) {
      const id = steamArtCache.get(name);
      if (id) setArt(STEAM_HEADER(id));
      else tryWiki();
      return;
    }
    fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=english&cc=US`)
      .then(r => r.json())
      .then(d => {
        const id = d.items?.[0]?.id ?? null;
        steamArtCache.set(name, id);
        if (id) setArt(STEAM_HEADER(id));
        else tryWiki();
      })
      .catch(() => { steamArtCache.set(name, null); tryWiki(); });
  }, [game.name, game.appId, game.wiki, failed]);

  return [art, () => setFailed(true)];
}

// ─── Free data fetchers ───────────────────────────────────────────────────────
async function fetchRedditPosts(subreddit) {
  try {
    const r = await fetch(REDDIT_HOT(subreddit, 8), { headers:{"User-Agent":"GamingCommunityLauncher/2.0 (free open source)"} });
    if (!r.ok) throw new Error("blocked");
    const d = await r.json();
    return d.data.children.map(c => ({
      title:    c.data.title,
      score:    c.data.score,
      comments: c.data.num_comments,
      url:      `https://reddit.com${c.data.permalink}`,
      flair:    c.data.link_flair_text || "",
      author:   c.data.author,
      created:  new Date(c.data.created_utc * 1000).toLocaleDateString(),
      thumbnail: c.data.thumbnail?.startsWith("http") ? c.data.thumbnail : null,
    }));
  } catch { return null; }
}

async function fetchSteamReviews(appId) {
  try {
    const r = await fetch(STEAM_REVIEWS(appId));
    if (!r.ok) throw new Error("no reviews");
    const d = await r.json();
    if (!d.success) throw new Error("api error");
    const summary = d.query_summary;
    const reviews = (d.reviews || []).slice(0, 5).map(rv => ({
      text:       rv.review?.slice(0, 280) + (rv.review?.length > 280 ? "…" : ""),
      voted_up:   rv.voted_up,
      votes_up:   rv.votes_up_count,
      hours:      Math.floor((rv.author?.playtime_forever || 0) / 60),
      date:       new Date(rv.timestamp_created * 1000).toLocaleDateString(),
    }));
    return { summary, reviews };
  } catch { return null; }
}

async function fetchWikiSummary(title) {
  try {
    const r = await fetch(WIKI_SUMMARY(title));
    if (!r.ok) throw new Error("no wiki");
    const d = await r.json();
    return { extract: d.extract_html || d.extract, thumbnail: d.thumbnail?.source };
  } catch { return null; }
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ color }) {
  return <div style={{ width:20, height:20, border:`2px solid ${color}33`, borderTop:`2px solid ${color}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto" }} />;
}

// ─── Splash Screen ────────────────────────────────────────────────────────────
function SplashScreen({ scanPhase, onComplete }) {
  const [exiting, setExiting]   = useState(false);
  const [flyLogo, setFlyLogo]   = useState(null); // null → {top,left,w,h,moving}
  const st     = useRef({ min: false, scan: false, out: false });
  const imgRef = useRef(null);

  function tryExit() {
    if (st.current.min && st.current.scan && !st.current.out) {
      st.current.out = true;
      setExiting(true);

      // FLIP: capture current logo position, portal it to body, animate to header
      if (imgRef.current) {
        const r = imgRef.current.getBoundingClientRect();
        setFlyLogo({ top: r.top, left: r.left, w: r.width, h: r.height, moving: false });
        requestAnimationFrame(() => requestAnimationFrame(() => {
          setFlyLogo({ top: 4, left: 18, w: 46, h: 46, moving: true });
        }));
      }

      setTimeout(onComplete, 1000);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { st.current.min = true; tryExit(); }, 5200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (scanPhase === 'done') { st.current.scan = true; tryExit(); }
  }, [scanPhase]);

  const CX = 210, CY = 210;
  const R_MAIN = 182;
  // 16 particle lines radiating from the ring edge at impact
  const sparks = [...Array(16)].map((_, i) => {
    const ang = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r1 = R_MAIN + 4, r2 = r1 + 52 + (i % 4) * 16;
    return {
      x1: CX + Math.cos(ang) * r1, y1: CY + Math.sin(ang) * r1,
      x2: CX + Math.cos(ang) * r2, y2: CY + Math.sin(ang) * r2,
      blue: i % 2 === 0,
      w: i % 4 === 0 ? 2.5 : 1.5,
      d: 1.82 + (i % 3) * 0.03,
    };
  });

  return (<>
    <div style={{
      position:'fixed', inset:0, zIndex:99999,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      fontFamily:"'Segoe UI',system-ui,sans-serif",
      overflow:'hidden',
      opacity: exiting ? 0 : 1,
      transform: exiting ? 'scale(1.05)' : 'scale(1)',
      transition: exiting ? 'opacity 1s cubic-bezier(0.4,0,0.2,1), transform 1s cubic-bezier(0.4,0,0.2,1)' : 'none',
      pointerEvents: exiting ? 'none' : 'auto',
    }}>

      {/* ── Layered background ── */}
      <div style={{ position:'absolute', inset:0, background:'#000' }} />

      {/* Generated Gojo domain expansion artwork */}
      <img src="./logos/Loading Animation Test.png" alt="" style={{
        position:'absolute', inset:0, width:'100%', height:'100%',
        objectFit:'cover', objectPosition:'center',
        opacity:0, pointerEvents:'none',
        animation:'sp-bgimg 1.8s ease 0.6s forwards',
      }} />

      {/* Dark vignette overlay so rings + text stay legible */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        background:'radial-gradient(ellipse 70% 70% at 50% 50%, #00000055 0%, #000000cc 75%, #000 100%)',
      }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        background:'radial-gradient(ellipse 40% 40% at 50% 50%, #1c083388 0%, transparent 65%)',
        animation:'sp-bg 0.9s ease 0.1s both' }} />
      {/* breathing pulse after impact */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        background:'radial-gradient(ellipse 40% 40% at 50% 50%, #1c0845 0%, transparent 60%)',
        animation:'sp-pulse 3s ease-in-out 2.5s infinite' }} />

      {/* ── Speed lines (MAPPA impact flash, appear at arc collision) ── */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        animation:'sp-speedfade 0.55s ease-out 1.82s both',
      }}>
        <svg viewBox="0 0 1400 900" width="100%" height="100%" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
          {[...Array(28)].map((_, i) => {
            const ang = (i / 28) * Math.PI * 2;
            const cx = 700, cy = 450;
            const r1 = 240, r2 = 520 + (i % 5) * 90;
            return <line key={i}
              x1={cx + Math.cos(ang) * r1} y1={cy + Math.sin(ang) * r1}
              x2={cx + Math.cos(ang) * r2} y2={cy + Math.sin(ang) * r2}
              stroke={i % 2 === 0 ? '#7c3aed' : '#0ea5e9'}
              strokeWidth={i % 3 === 0 ? 1.5 : 0.7}
              opacity={0.12 + (i % 4) * 0.04} />;
          })}
        </svg>
      </div>

      {/* ── Main ring + logo container ── */}
      <div style={{ position:'relative', width:420, height:420, flexShrink:0 }}>
        <svg viewBox="0 0 420 420" style={{ position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible' }}>
          <defs>
            <filter id="sp-gp" x="-90%" y="-90%" width="280%" height="280%">
              <feGaussianBlur stdDeviation="5" result="b1"/>
              <feGaussianBlur stdDeviation="14" in="SourceGraphic" result="b2"/>
              <feGaussianBlur stdDeviation="28" in="SourceGraphic" result="b3"/>
              <feMerge><feMergeNode in="b3"/><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="sp-gb" x="-90%" y="-90%" width="280%" height="280%">
              <feGaussianBlur stdDeviation="5" result="b1"/>
              <feGaussianBlur stdDeviation="14" in="SourceGraphic" result="b2"/>
              <feGaussianBlur stdDeviation="28" in="SourceGraphic" result="b3"/>
              <feMerge><feMergeNode in="b3"/><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="sp-gw" x="-160%" y="-160%" width="420%" height="420%">
              <feGaussianBlur stdDeviation="12"/>
            </filter>
            <filter id="sp-spark-p" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="3"/>
            </filter>
            <filter id="sp-spark-b" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="3"/>
            </filter>
            <radialGradient id="sp-impact-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="white"   stopOpacity="0.95"/>
              <stop offset="25%"  stopColor="#c4b5fd" stopOpacity="0.5"/>
              <stop offset="60%"  stopColor="#7c3aed" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
            </radialGradient>
          </defs>

          {/* ── Outer decorative dashed ring (spins after impact) ── */}
          <circle cx={CX} cy={CY} r="197" fill="none" stroke="#7c3aed33" strokeWidth="1"
            strokeDasharray="3 14"
            style={{ animation:'sp-spin-fwd 22s linear 2.6s infinite, sp-appear 0.4s ease 2.6s forwards', opacity:0 }} />

          {/* ── PURPLE ARC — sweeps clockwise from 12 o'clock ── */}
          {/* wide dark bloom */}
          <circle cx={CX} cy={CY} r={R_MAIN} fill="none" stroke="#3b0764" strokeWidth="36"
            strokeLinecap="round" strokeDasharray="0 9999"
            transform={`rotate(-90 ${CX} ${CY})`} filter="url(#sp-gp)"
            style={{ animation:'sp-arc 1.5s cubic-bezier(0.16,1,0.3,1) 0.22s forwards' }} />
          {/* mid violet */}
          <circle cx={CX} cy={CY} r={R_MAIN} fill="none" stroke="#7c3aed" strokeWidth="5"
            strokeLinecap="round" strokeDasharray="0 9999"
            transform={`rotate(-90 ${CX} ${CY})`} filter="url(#sp-gp)"
            style={{ animation:'sp-arc 1.42s cubic-bezier(0.2,1,0.3,1) 0.28s forwards' }} />
          {/* bright core line */}
          <circle cx={CX} cy={CY} r={R_MAIN} fill="none" stroke="#a78bfa" strokeWidth="2.5"
            strokeLinecap="round" strokeDasharray="0 9999"
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ animation:'sp-arc 1.38s cubic-bezier(0.2,1,0.3,1) 0.30s forwards' }} />
          {/* thin highlight */}
          <circle cx={CX} cy={CY} r={R_MAIN - 5} fill="none" stroke="#ede9fe" strokeWidth="1"
            strokeLinecap="round" strokeDasharray="0 9999"
            transform={`rotate(-88 ${CX} ${CY})`}
            style={{ animation:'sp-arc 1.3s cubic-bezier(0.2,1,0.3,1) 0.34s forwards' }} />
          {/* moving tip — small white dash that traces the leading edge */}
          <circle cx={CX} cy={CY} r={R_MAIN} fill="none" stroke="white" strokeWidth="5"
            strokeLinecap="round" strokeDasharray="12 9999"
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ animation:'sp-tip-p 1.42s cubic-bezier(0.2,1,0.3,1) 0.28s forwards', opacity:0 }} />

          {/* ── BLUE ARC — sweeps counter-clockwise from 12 o'clock ── */}
          {/* wide dark bloom */}
          <circle cx={CX} cy={CY} r={R_MAIN} fill="none" stroke="#0c4a6e" strokeWidth="36"
            strokeLinecap="round" strokeDasharray="0 9999"
            transform={`rotate(90 ${CX} ${CY})`} filter="url(#sp-gb)"
            style={{ animation:'sp-arc 1.5s cubic-bezier(0.16,1,0.3,1) 0.38s forwards' }} />
          {/* mid cyan */}
          <circle cx={CX} cy={CY} r={R_MAIN} fill="none" stroke="#0ea5e9" strokeWidth="5"
            strokeLinecap="round" strokeDasharray="0 9999"
            transform={`rotate(90 ${CX} ${CY})`} filter="url(#sp-gb)"
            style={{ animation:'sp-arc 1.42s cubic-bezier(0.2,1,0.3,1) 0.44s forwards' }} />
          {/* bright core */}
          <circle cx={CX} cy={CY} r={R_MAIN} fill="none" stroke="#38bdf8" strokeWidth="2.5"
            strokeLinecap="round" strokeDasharray="0 9999"
            transform={`rotate(90 ${CX} ${CY})`}
            style={{ animation:'sp-arc 1.38s cubic-bezier(0.2,1,0.3,1) 0.46s forwards' }} />
          {/* thin highlight */}
          <circle cx={CX} cy={CY} r={R_MAIN - 5} fill="none" stroke="#bae6fd" strokeWidth="1"
            strokeLinecap="round" strokeDasharray="0 9999"
            transform={`rotate(92 ${CX} ${CY})`}
            style={{ animation:'sp-arc 1.3s cubic-bezier(0.2,1,0.3,1) 0.50s forwards' }} />
          {/* moving tip */}
          <circle cx={CX} cy={CY} r={R_MAIN} fill="none" stroke="white" strokeWidth="5"
            strokeLinecap="round" strokeDasharray="12 9999"
            transform={`rotate(90 ${CX} ${CY})`}
            style={{ animation:'sp-tip-b 1.42s cubic-bezier(0.2,1,0.3,1) 0.44s forwards', opacity:0 }} />

          {/* ── Inner ring (counter-spin after impact) ── */}
          <circle cx={CX} cy={CY} r="145" fill="none" stroke="#7c3aed55" strokeWidth="1.5"
            strokeDasharray="6 18"
            style={{ animation:'sp-spin-rev 10s linear 2.3s infinite, sp-appear 0.3s ease 2.3s forwards', opacity:0 }} />
          <circle cx={CX} cy={CY} r="125" fill="none" stroke="#0ea5e988" strokeWidth="1"
            strokeDasharray="4 22"
            style={{ animation:'sp-spin-fwd 14s linear 2.5s infinite, sp-appear 0.3s ease 2.5s forwards', opacity:0 }} />

          {/* ── IMPACT radial flash ── */}
          <circle cx={CX} cy={CY} r="195" fill="url(#sp-impact-grad)"
            style={{ animation:'sp-impact 0.7s ease-out 1.82s both', opacity:0 }} />

          {/* ── Particle sparks radiating out at impact ── */}
          {sparks.map((s, i) => (
            <g key={i}>
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={s.blue ? '#38bdf8' : '#a78bfa'} strokeWidth={s.w} strokeLinecap="round"
                filter={`url(#sp-spark-${s.blue ? 'b' : 'p'})`}
                style={{ animation:`sp-spark 0.55s ease-out ${s.d}s both`, opacity:0 }} />
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke="white" strokeWidth={s.w * 0.5} strokeLinecap="round"
                style={{ animation:`sp-spark 0.45s ease-out ${s.d + 0.02}s both`, opacity:0 }} />
            </g>
          ))}

          {/* ── Center orb ── */}
          <circle cx={CX} cy={CY} r="40" fill="none" stroke="white" strokeWidth="1.5"
            filter="url(#sp-gw)" style={{ animation:'sp-orb 0.55s cubic-bezier(0.34,1.56,0.64,1) 2.0s both', opacity:0 }} />
          <circle cx={CX} cy={CY} r="10" fill="white" opacity="0.9"
            filter="url(#sp-gw)" style={{ animation:'sp-orb 0.4s cubic-bezier(0.34,1.56,0.64,1) 2.15s both', opacity:0 }} />
        </svg>

        {/* ── Orbiting accent dots (CW) ── */}
        <div style={{
          position:'absolute', inset:-24,
          animation:'sp-spin-fwd 14s linear 2.8s infinite, sp-appear07 0.5s ease 2.8s forwards',
          opacity:0,
        }}>
          <svg viewBox="0 0 468 468" style={{ width:'100%', height:'100%' }}>
            {[...Array(8)].map((_, i) => {
              const a = (i / 8) * Math.PI * 2;
              const cx = 234 + Math.cos(a) * 220, cy = 234 + Math.sin(a) * 220;
              const blue = i % 2 === 0;
              return <circle key={i} cx={cx} cy={cy} r={i % 4 === 0 ? 3.5 : 2.2}
                fill={blue ? '#38bdf8' : '#a78bfa'}
                style={{ filter:`drop-shadow(0 0 7px ${blue ? '#0ea5e9' : '#7c3aed'})` }} />;
            })}
          </svg>
        </div>

        {/* ── Counter-orbiting inner dots (CCW) ── */}
        <div style={{
          position:'absolute', inset:0,
          animation:'sp-spin-rev 18s linear 3.1s infinite, sp-appear05 0.5s ease 3.1s forwards',
          opacity:0,
        }}>
          <svg viewBox="0 0 420 420" style={{ width:'100%', height:'100%' }}>
            {[0,1,2,3,4].map(i => {
              const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
              const cx = 210 + Math.cos(a) * 148, cy = 210 + Math.sin(a) * 148;
              return <circle key={i} cx={cx} cy={cy} r={2}
                fill="#c4b5fd"
                style={{ filter:'drop-shadow(0 0 5px #7c3aed)' }} />;
            })}
          </svg>
        </div>

        {/* ── Logo reveal ── */}
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
          animation:'sp-logo 1.1s cubic-bezier(0.34,1.56,0.64,1) 1.95s both', opacity:0,
        }}>
          <img ref={imgRef} src="./logos/Gaming-Community-Logo - 1.png" alt=""
            style={{ width:242, height:242, objectFit:'contain', opacity: flyLogo ? 0 : 1 }}
            onError={e => { e.target.style.display='none'; }}
          />
        </div>
      </div>

      {/* ── Text area ── */}
      <div style={{ textAlign:'center', marginTop:34, position:'relative', zIndex:1 }}>
        <div style={{
          fontSize:11, fontWeight:900, letterSpacing:'7px', color:'#a78bfa',
          textTransform:'uppercase', marginBottom:20,
          animation:'sp-text 0.6s ease 2.3s both', opacity:0,
        }}>Gaming Community Launcher</div>

        {/* animated dots row */}
        <div style={{ display:'flex', justifyContent:'center', gap:7, marginBottom:18,
          animation:'sp-text 0.4s ease 2.7s both', opacity:0 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width:5, height:5, borderRadius:'50%',
              background: i % 2 === 0 ? '#7c3aed' : '#0ea5e9',
              animation:`sp-dot 1.4s ease-in-out ${2.7 + i * 0.18}s infinite`,
            }} />
          ))}
        </div>

        {/* status lines */}
        {[
          ['Initializing launcher',         2.95],
          ['Scanning Steam library',        3.30],
          ['Scanning connected platforms',  3.65],
          ['Loading game data',             4.00],
        ].map(([txt, d]) => (
          <div key={txt} style={{
            fontSize:10, color:'#475569', fontWeight:600, marginBottom:6,
            fontFamily:'monospace', letterSpacing:'0.5px',
            animation:`sp-text 0.35s ease ${d}s both`, opacity:0,
          }}>
            <span style={{ color:'#7c3aed', marginRight:7 }}>▸</span>{txt}
            <span style={{ color:'#334155', marginLeft:10, animation:`sp-blink 1s step-end ${d + 0.1}s infinite` }}>_</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes sp-bg       { from{opacity:0} to{opacity:1} }
        @keyframes sp-bgimg    { from{opacity:0} to{opacity:0.42} }
        @keyframes sp-pulse    { 0%,100%{opacity:0} 50%{opacity:0.55} }
        @keyframes sp-appear   { from{opacity:0} to{opacity:0.7} }
        @keyframes sp-appear07 { from{opacity:0} to{opacity:0.7} }
        @keyframes sp-appear05 { from{opacity:0} to{opacity:0.5} }
        @keyframes sp-arc      { from{stroke-dasharray:0 9999} to{stroke-dasharray:700 9999} }
        @keyframes sp-tip-p    {
          0%   { stroke-dashoffset:0;   opacity:1 }
          70%  { opacity:1 }
          100% { stroke-dashoffset:-700; opacity:0 }
        }
        @keyframes sp-tip-b    {
          0%   { stroke-dashoffset:0;   opacity:1 }
          70%  { opacity:1 }
          100% { stroke-dashoffset:-700; opacity:0 }
        }
        @keyframes sp-logo     { from{opacity:0;transform:scale(0.6);filter:brightness(12) blur(6px)} to{opacity:1;transform:scale(1);filter:brightness(1) drop-shadow(0 0 32px #7c3aedaa) drop-shadow(0 0 60px #0ea5e966)} }
        @keyframes sp-orb      { from{opacity:0;transform:scale(0)} to{opacity:1;transform:scale(1)} }
        @keyframes sp-impact   { 0%{opacity:0;transform:scale(0.2)} 25%{opacity:1} 100%{opacity:0;transform:scale(2.2)} }
        @keyframes sp-spark    { 0%{opacity:0;stroke-dasharray:0 300} 15%{opacity:1} 100%{opacity:0;stroke-dasharray:90 300} }
        @keyframes sp-speedfade{ 0%{opacity:0} 15%{opacity:1} 100%{opacity:0} }
        @keyframes sp-text     { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:none} }
        @keyframes sp-spin-fwd { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sp-spin-rev { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes sp-dot      { 0%,100%{transform:scaleY(1);opacity:0.35} 50%{transform:scaleY(2);opacity:1} }
        @keyframes sp-blink    { 0%,49%{opacity:1} 50%,100%{opacity:0} }
      `}</style>
    </div>

    {/* Flying logo portal — renders outside splash so parent opacity doesn't clip it */}
    {flyLogo && createPortal(
      <img
        src="./logos/Gaming-Community-Logo - 1.png" alt=""
        style={{
          position: 'fixed',
          top:    flyLogo.top,
          left:   flyLogo.left,
          width:  flyLogo.w,
          height: flyLogo.h,
          objectFit: 'contain',
          zIndex: 100002,
          pointerEvents: 'none',
          filter: 'drop-shadow(0 0 10px #7c3aedaa) drop-shadow(0 0 20px #0ea5e966)',
          transition: flyLogo.moving
            ? 'top 0.72s cubic-bezier(0.4,0,0.2,1), left 0.72s cubic-bezier(0.4,0,0.2,1), width 0.72s cubic-bezier(0.4,0,0.2,1), height 0.72s cubic-bezier(0.4,0,0.2,1)'
            : 'none',
        }}
      />,
      document.body
    )}
  </>);
}

// ─── Add Custom Game Modal ────────────────────────────────────────────────────
function AddCustomGameModal({ t, onClose, onAdd }) {
  const [name, setName]             = useState('');
  const [genre, setGenre]           = useState('');
  const [exePath, setExePath]       = useState('');
  const [foundImages, setFoundImages] = useState([]);
  const [selectedImg, setSelectedImg] = useState(null);
  const [scanning, setScanning]     = useState(false);

  const toFileUrl = (p) => `file:///${p.replace(/\\/g, '/')}`;

  const handlePickFile = async () => {
    if (!window.electronAPI) return;
    const filePath = await window.electronAPI.selectGameFile();
    if (!filePath) return;
    setExePath(filePath);
    const fileName = filePath.split(/[/\\]/).pop().replace(/\.exe$/i, '');
    setName(fileName.replace(/[_\-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    setScanning(true);
    const folder = filePath.split(/[/\\]/).slice(0, -1).join('\\');
    const images = await window.electronAPI.scanFolderForImage(folder);
    setFoundImages(images);
    setSelectedImg(images.length > 0 ? images[0] : null);
    setScanning(false);
  };

  const handleSave = () => {
    if (!name.trim() || !exePath) return;
    onAdd({
      id:         `custom_${Date.now()}`,
      name:       name.trim(),
      genre:      genre.trim() || 'Custom',
      downloaded: true,
      size:       '0',
      hours:      0,
      rating:     0,
      exePath,
      img:        selectedImg ? toFileUrl(selectedImg) : null,
    });
  };

  const inp = { background:t.card, border:`1px solid ${t.border}`, color:t.text, padding:'8px 11px', borderRadius:8, fontSize:12, outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' };

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{ position:'fixed', inset:0, background:'#000000cc', backdropFilter:'blur(10px)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.2s ease' }}>
      <div style={{ background:t.surface, border:'1px solid #a78bfa44', borderRadius:18, width:'min(520px,96vw)', display:'flex', flexDirection:'column', overflow:'hidden', animation:'modalPop 0.38s cubic-bezier(0.34,1.56,0.64,1)', boxShadow:'0 40px 100px #000000dd, 0 0 0 1px #a78bfa22' }}>

        {/* Header */}
        <div style={{ padding:'18px 20px', borderBottom:`1px solid ${t.border}`, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:'#1a1a2e', border:'1px solid #a78bfa40', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🎮</div>
          <div>
            <div style={{ fontWeight:900, fontSize:15, color:t.text }}>Add Custom Game</div>
            <div style={{ fontSize:11, color:t.sub }}>Pick an executable and artwork from your PC</div>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'transparent', border:`1px solid ${t.border}`, color:t.sub, width:28, height:28, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:14 }}>
          {/* Exe picker */}
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:t.sub, letterSpacing:'1.5px', marginBottom:6 }}>GAME EXECUTABLE</div>
            <button onClick={handlePickFile} style={{ width:'100%', background:exePath?'#a78bfa18':t.card, border:`1px solid ${exePath?'#a78bfa60':t.border}`, color:exePath?'#a78bfa':t.sub, padding:'10px 14px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:11, textAlign:'left', display:'flex', alignItems:'center', gap:9, transition:'all 0.2s' }}>
              <span style={{ fontSize:16 }}>📂</span>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{exePath ? exePath.split(/[/\\]/).pop() : 'Browse for .exe file...'}</span>
            </button>
            {exePath && <div style={{ fontSize:9, color:t.sub, marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={exePath}>{exePath}</div>}
          </div>

          {/* Name */}
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:t.sub, letterSpacing:'1.5px', marginBottom:6 }}>GAME NAME</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter game name..." style={inp} />
          </div>

          {/* Genre */}
          <div>
            <div style={{ fontSize:10, fontWeight:800, color:t.sub, letterSpacing:'1.5px', marginBottom:6 }}>GENRE</div>
            <input value={genre} onChange={e=>setGenre(e.target.value)} placeholder="e.g. RPG, FPS, Strategy..." style={inp} />
          </div>

          {/* Found images */}
          {(scanning || foundImages.length > 0) && (
            <div>
              <div style={{ fontSize:10, fontWeight:800, color:t.sub, letterSpacing:'1.5px', marginBottom:8 }}>
                SELECT ARTWORK{foundImages.length > 0 ? ` — ${foundImages.length} found` : ''}
              </div>
              {scanning ? (
                <div style={{ textAlign:'center', padding:'16px 0', color:t.sub, fontSize:12 }}>Scanning folder for images...</div>
              ) : (
                <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
                  <div onClick={()=>setSelectedImg(null)} style={{ width:80, height:54, borderRadius:7, border:`2px solid ${selectedImg===null?'#a78bfa':t.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:20, flexShrink:0, background:t.card, transition:'all 0.15s' }}>🚫</div>
                  {foundImages.map((imgPath, i) => (
                    <div key={i} onClick={()=>setSelectedImg(imgPath)} style={{ width:80, height:54, borderRadius:7, border:`2px solid ${selectedImg===imgPath?'#a78bfa':t.border}`, overflow:'hidden', cursor:'pointer', flexShrink:0, transition:'all 0.15s', boxShadow:selectedImg===imgPath?'0 0 12px #a78bfa66':'none' }}>
                      <img src={toFileUrl(imgPath)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {exePath && !scanning && foundImages.length === 0 && (
            <div style={{ fontSize:11, color:t.sub, textAlign:'center', padding:'4px 0' }}>No images found in game folder — game will use a placeholder icon</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 20px', borderTop:`1px solid ${t.border}`, display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:t.card, border:`1px solid ${t.border}`, color:t.sub, padding:'9px 18px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12 }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()||!exePath} style={{ background:name.trim()&&exePath?'#a78bfa':'#a78bfa44', color:name.trim()&&exePath?'#000':'#666', border:'none', padding:'9px 22px', borderRadius:8, cursor:name.trim()&&exePath?'pointer':'not-allowed', fontWeight:900, fontSize:12, transition:'all 0.2s' }}>Add Game</button>
        </div>
      </div>
    </div>
  );
}

// ─── Game Detail Modal ─────────────────────────────────────────────────────────
function GameModal({ game, platform, t, onClose, fire, onDownload, onRemove }) {
  const [tab, setTab] = useState("about");
  const [redditData, setRedditData] = useState(undefined);   // undefined=not loaded, null=failed
  const [steamData, setSteamData]   = useState(undefined);
  const [wikiData, setWikiData]     = useState(undefined);
  const [loading, setLoading]       = useState(false);
  const img = gameImg(game);
  const hasSteam = !!game.appId;
  const patchLink = PATCH_LINKS[game.appId] || (game.patchUrl ? { label: game.patchLabel || `${game.name} Updates`, url: game.patchUrl, site: game.patchUrl.replace(/https?:\/\//, '').split('/')[0] } : null);

  const load = useCallback(async (which) => {
    if (which === "reddit"  && redditData === undefined) { setLoading(true); setRedditData(await fetchRedditPosts(game.subreddit)); setLoading(false); }
    if (which === "reviews" && steamData  === undefined) {
      setLoading(true);
      const [steam, wiki] = await Promise.all([
        hasSteam ? fetchSteamReviews(game.appId) : Promise.resolve(null),
        fetchWikiSummary(game.wiki),
      ]);
      setSteamData(steam); setWikiData(wiki); setLoading(false);
    }
    if (which === "about"   && wikiData   === undefined) { setLoading(true); setWikiData(await fetchWikiSummary(game.wiki)); setLoading(false); }
  }, [game, redditData, steamData, wikiData, hasSteam]);

  useEffect(() => { load(tab); }, [tab]);

  const tabs = [
    { id:"about",   label:"About"        },
    { id:"reddit",  label:"Reddit"       },
    { id:"reviews", label:"Reviews"      },
    { id:"patches", label:"Patch Notes"  },
  ];

  const scoreColor = game.rating >= 9 ? "#22c55e" : game.rating >= 8 ? "#eab308" : "#f97316";

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{ position:"fixed", inset:0, background:"#000000cc", backdropFilter:"blur(10px)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.2s ease" }}>
      <div style={{ background:t.surface, border:`1px solid ${platform.accent}44`, borderRadius:18, width:"min(860px,96vw)", maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden", animation:"modalPop 0.38s cubic-bezier(0.34,1.56,0.64,1)", boxShadow:`0 40px 100px #000000dd, 0 0 0 1px ${platform.accent}22` }}>

        {/* Hero art */}
        <div style={{ position:"relative", height:210, flexShrink:0 }}>
          {img
            ? <img src={img} alt={game.name} style={{ width:"100%", height:"100%", objectFit:"cover", filter:"brightness(0.45)" }} onError={e=>e.target.style.display="none"} />
            : <div style={{ width:"100%", height:"100%", background:`linear-gradient(135deg, ${platform.color}, #000)` }} />
          }
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg,rgba(0,0,0,0.92) 0%,transparent 55%)" }} />
          <button onClick={onClose} style={{ position:"absolute", top:14, right:14, background:"#00000099", border:`1px solid #ffffff33`, color:"#fff", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)", transition:"all 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background="#ff445566"} onMouseLeave={e=>e.currentTarget.style.background="#00000099"}>×</button>

          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"14px 20px" }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:14 }}>
              <div style={{ width:46, height:46, borderRadius:11, background:platform.bg, border:`2px solid ${platform.accent}55`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 0 20px ${platform.accent}44` }}>
                <PlatLogo pid={platform.id} size={28} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:22, fontWeight:900, color:"#fff", letterSpacing:"0.5px", textShadow:"0 2px 12px #000", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{game.name}</div>
                <div style={{ display:"flex", gap:7, marginTop:5, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ fontSize:10, background:`${platform.accent}30`, color:platform.accent, padding:"2px 9px", borderRadius:99, fontWeight:700 }}>{game.genre}</span>
                  <span style={{ fontSize:10, background:game.downloaded?"#16532244":"#33333344", color:game.downloaded?"#22c55e":"#888", padding:"2px 9px", borderRadius:99, fontWeight:700 }}>{game.downloaded?"● INSTALLED":"○ NOT INSTALLED"}</span>
                  <span style={{ fontSize:12, color:"#888" }}>{game.size} GB</span>
                  {game.rating > 0 && <span style={{ fontSize:13, fontWeight:900, color:scoreColor, background:`${scoreColor}22`, padding:"2px 10px", borderRadius:99 }}>{game.rating} / 10</span>}
                </div>
              </div>
              <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
                {game.downloaded
                  ? <button onClick={e=>{const r=e.currentTarget.getBoundingClientRect();fire(r.left+r.width/2,r.top+r.height/2,platform.accent);if(platform.id==='custom'&&game.exePath){window.electronAPI?.launchExe(game.exePath);}else{const url=getLaunchUrl(game,platform);if(url)window.electronAPI?.launchGame(url);}}} style={{ background:platform.accent, color:"#000", border:"none", padding:"10px 22px", borderRadius:9, cursor:"pointer", fontWeight:900, fontSize:13, letterSpacing:"0.5px", boxShadow:`0 0 24px ${platform.accent}77`, transition:"transform 0.15s" }} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.06)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>▶ LAUNCH</button>
                  : <button onClick={()=>onDownload(game,platform)} style={{ background:`${platform.accent}22`, color:platform.accent, border:`1px solid ${platform.accent}55`, padding:"10px 22px", borderRadius:9, cursor:"pointer", fontWeight:900, fontSize:13 }}>⬇ DOWNLOAD</button>
                }
                {platform.id==='custom'&&onRemove&&<button onClick={()=>onRemove(game.id)} style={{ background:'#f43f5e22', color:'#f43f5e', border:'1px solid #f43f5e44', padding:'5px 14px', borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:10 }}>🗑 Remove</button>}
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex", borderBottom:`1px solid ${t.border}`, padding:"0 16px", flexShrink:0, background:t.surface }}>
          {tabs.map(tb => (
            <button key={tb.id} onClick={()=>setTab(tb.id)} style={{ background:"transparent", border:"none", borderBottom:`2px solid ${tab===tb.id?platform.accent:"transparent"}`, color:tab===tb.id?platform.accent:t.sub, padding:"11px 16px", cursor:"pointer", fontWeight:800, fontSize:12, letterSpacing:"0.5px", transition:"color 0.2s" }}>{tb.label}</button>
          ))}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, paddingRight:2 }}>
            <a href={`https://reddit.com/r/${game.subreddit}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:9, color:t.sub, textDecoration:"none", padding:"3px 8px", border:`1px solid ${t.border}`, borderRadius:5, fontWeight:700, letterSpacing:"0.5px" }}>r/{game.subreddit} ↗</a>
            {game.wiki && <a href={`https://en.wikipedia.org/wiki/${game.wiki}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:9, color:t.sub, textDecoration:"none", padding:"3px 8px", border:`1px solid ${t.border}`, borderRadius:5, fontWeight:700, letterSpacing:"0.5px" }}>Wikipedia ↗</a>}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>

          {/* ABOUT */}
          {tab==="about" && (
            <div>
              <div style={{ fontSize:10, color:t.sub, fontWeight:800, letterSpacing:"2px", marginBottom:12 }}>ABOUT THIS GAME</div>
              {loading && <div style={{ textAlign:"center", padding:"24px 0" }}><Spinner color={platform.accent}/><div style={{ color:t.sub, fontSize:12, marginTop:8 }}>Loading from Wikipedia...</div></div>}
              {!loading && (
                <div style={{ display:"grid", gridTemplateColumns:wikiData?.thumbnail?"1fr 180px":"1fr", gap:16 }}>
                  <div>
                    {wikiData?.extract
                      ? <div style={{ fontSize:13, color:t.text, lineHeight:1.75 }} dangerouslySetInnerHTML={{ __html: wikiData.extract }} />
                      : <div style={{ color:t.sub, fontSize:13, lineHeight:1.7 }}>No Wikipedia article found for this game. <a href={`https://en.wikipedia.org/wiki/${game.wiki}`} target="_blank" rel="noopener noreferrer" style={{ color:platform.accent }}>Search Wikipedia ↗</a></div>
                    }
                    <div style={{ display:"flex", gap:10, marginTop:14, flexWrap:"wrap" }}>
                      {[["Genre",game.genre],["Size",game.size+" GB"],game.rating>0?["Rating",game.rating+"/10"]:null].filter(Boolean).map(([k,v])=>(
                        <div key={k} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:8, padding:"9px 14px", textAlign:"center", minWidth:80 }}>
                          <div style={{ fontSize:15, fontWeight:900, color:platform.accent }}>{v}</div>
                          <div style={{ fontSize:11, color:t.sub, fontWeight:700, letterSpacing:"1px", marginTop:2 }}>{k.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {wikiData?.thumbnail && <img src={wikiData.thumbnail} alt={game.name} style={{ width:"100%", borderRadius:10, objectFit:"cover", border:`1px solid ${t.border}` }} />}
                </div>
              )}
            </div>
          )}

          {/* REDDIT */}
          {tab==="reddit" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <div style={{ fontSize:10, color:t.sub, fontWeight:800, letterSpacing:"2px" }}>HOT FROM r/{game.subreddit?.toUpperCase()}</div>
                <div style={{ marginLeft:"auto", fontSize:9, color:t.sub }}>Source: reddit.com (public JSON API, free)</div>
              </div>
              {loading && <div style={{ textAlign:"center", padding:"24px 0" }}><Spinner color={platform.accent}/><div style={{ color:t.sub, fontSize:12, marginTop:8 }}>Fetching Reddit posts...</div></div>}
              {!loading && redditData===null && (
                <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:10, padding:"20px", textAlign:"center" }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>🚫</div>
                  <div style={{ fontWeight:700, color:t.text, marginBottom:6 }}>Reddit blocked the request</div>
                  <div style={{ fontSize:12, color:t.sub, marginBottom:12 }}>Reddit sometimes blocks requests from browser-based apps. Visit the subreddit directly:</div>
                  <a href={`https://reddit.com/r/${game.subreddit}`} target="_blank" rel="noopener noreferrer" style={{ background:`#FF4500`, color:"#fff", padding:"8px 20px", borderRadius:8, textDecoration:"none", fontWeight:700, fontSize:12 }}>Open r/{game.subreddit} on Reddit ↗</a>
                </div>
              )}
              {!loading && redditData && redditData.map((post,i)=>(
                <a key={i} href={post.url} target="_blank" rel="noopener noreferrer" style={{ display:"block", textDecoration:"none", background:t.card, border:`1px solid ${t.border}`, borderRadius:10, padding:"12px 14px", marginBottom:8, transition:"all 0.18s" }}
                  onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${platform.accent}55`;e.currentTarget.style.transform="translateX(4px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${t.border}`;e.currentTarget.style.transform="none";}}>
                  <div style={{ display:"flex", gap:8, marginBottom:5, alignItems:"flex-start" }}>
                    {post.flair && <span style={{ fontSize:8, background:`${platform.accent}22`, color:platform.accent, padding:"2px 6px", borderRadius:4, fontWeight:700, flexShrink:0, marginTop:2 }}>{post.flair}</span>}
                    <div style={{ fontSize:13, fontWeight:600, color:t.text, lineHeight:1.4 }}>{post.title}</div>
                  </div>
                  <div style={{ display:"flex", gap:12, fontSize:10, color:t.sub }}>
                    <span style={{ color:"#ff4500" }}>▲ {post.score?.toLocaleString()}</span>
                    <span>💬 {post.comments?.toLocaleString()}</span>
                    <span>u/{post.author}</span>
                    <span style={{ marginLeft:"auto" }}>{post.created}</span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* REVIEWS */}
          {tab==="reviews" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <div style={{ fontSize:10, color:t.sub, fontWeight:800, letterSpacing:"2px" }}>PLAYER REVIEWS</div>
                <div style={{ marginLeft:"auto", fontSize:9, color:t.sub }}>{hasSteam?"Source: Steam Store API (free, no key)":"Source: Community ratings"}</div>
              </div>
              {loading && <div style={{ textAlign:"center", padding:"24px 0" }}><Spinner color={platform.accent}/><div style={{ color:t.sub, fontSize:12, marginTop:8 }}>Fetching reviews...</div></div>}
              {!loading && (
                <>
                  {/* Score card */}
                  <div style={{ background:`linear-gradient(135deg, ${platform.color}55, ${t.card})`, border:`1px solid ${platform.accent}44`, borderRadius:12, padding:"16px 20px", marginBottom:14, display:"flex", alignItems:"center", gap:20 }}>
                    <div style={{ textAlign:"center", minWidth:80 }}>
                      <div style={{ fontSize:44, fontWeight:900, color:scoreColor, lineHeight:1 }}>{game.rating}</div>
                      <div style={{ fontSize:9, color:t.sub, fontWeight:800, letterSpacing:"1px", marginTop:4 }}>GCL SCORE</div>
                    </div>
                    <div style={{ flex:1 }}>
                      {steamData?.summary && (
                        <div style={{ marginBottom:8 }}>
                          <div style={{ fontSize:13, fontWeight:800, color:steamData.summary.review_score_desc==="Overwhelmingly Positive"?"#22c55e":steamData.summary.review_score_desc?.includes("Positive")?"#22c55e":steamData.summary.review_score_desc?.includes("Negative")?"#f43f5e":"#eab308" }}>{steamData.summary.review_score_desc}</div>
                          <div style={{ fontSize:11, color:t.sub }}>{steamData.summary.total_reviews?.toLocaleString()} Steam reviews</div>
                        </div>
                      )}
                      <div style={{ height:6, background:t.border, borderRadius:99, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${(game.rating/10)*100}%`, background:`linear-gradient(90deg, ${scoreColor}88, ${scoreColor})`, borderRadius:99 }} />
                      </div>
                    </div>
                  </div>

                  {/* Steam reviews */}
                  {steamData?.reviews?.length > 0 ? steamData.reviews.map((rv,i)=>(
                    <div key={i} style={{ background:t.card, border:`1px solid ${rv.voted_up?"#22c55e22":t.border}`, borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
                      <div style={{ display:"flex", gap:8, marginBottom:6, alignItems:"center" }}>
                        <span style={{ fontSize:14 }}>{rv.voted_up?"👍":"👎"}</span>
                        <span style={{ fontWeight:700, fontSize:12, color:rv.voted_up?"#22c55e":"#f43f5e" }}>{rv.voted_up?"Recommended":"Not Recommended"}</span>
                        <span style={{ fontSize:10, color:t.sub, marginLeft:"auto" }}>{rv.hours}h on record · {rv.date}</span>
                      </div>
                      <div style={{ fontSize:12, color:t.text, lineHeight:1.6, fontStyle:"italic" }}>"{rv.text}"</div>
                    </div>
                  )) : !hasSteam ? (
                    <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:10, padding:"18px", textAlign:"center", color:t.sub, fontSize:13 }}>
                      Steam reviews only available for games on Steam.<br/>
                      <a href={`https://reddit.com/r/${game.subreddit}/search?q=review&sort=top`} target="_blank" rel="noopener noreferrer" style={{ color:platform.accent, fontSize:12, marginTop:8, display:"inline-block" }}>Find community reviews on Reddit ↗</a>
                    </div>
                  ) : (
                    <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:10, padding:"18px", textAlign:"center", color:t.sub, fontSize:13 }}>
                      Steam review API returned no results. <a href={`https://store.steampowered.com/app/${game.appId}#app_reviews_hash`} target="_blank" rel="noopener noreferrer" style={{ color:platform.accent }}>View on Steam ↗</a>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* PATCH NOTES */}
          {tab==="patches" && (
            <div>
              <div style={{ fontSize:10, color:t.sub, fontWeight:800, letterSpacing:"2px", marginBottom:12 }}>PATCH NOTES & UPDATES</div>
              <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:12, padding:"18px 20px", marginBottom:12 }}>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                  <span style={{ fontSize:28 }}>📋</span>
                  <div>
                    <div style={{ fontWeight:800, fontSize:14, color:t.text, marginBottom:4 }}>Official Patch Notes</div>
                    <div style={{ fontSize:12, color:t.sub, lineHeight:1.6, marginBottom:12 }}>
                      {patchLink
                        ? `Patch notes for ${game.name} are published on the official website. Click below to view the latest updates directly from the developers.`
                        : `For the latest updates, visit the game's official Steam news page or the developer's website.`
                      }
                    </div>
                    {patchLink ? (
                      <a href={patchLink.url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:8, background:platform.accent, color:"#000", padding:"9px 18px", borderRadius:8, textDecoration:"none", fontWeight:800, fontSize:12, boxShadow:`0 0 16px ${platform.accent}55`, transition:"transform 0.15s" }} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                        📋 {patchLink.label} ↗
                      </a>
                    ) : hasSteam ? (
                      <a href={`https://store.steampowered.com/news/app/${game.appId}`} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:8, background:platform.accent, color:"#000", padding:"9px 18px", borderRadius:8, textDecoration:"none", fontWeight:800, fontSize:12 }}>View on Steam ↗</a>
                    ) : (
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(game.name + ' patch notes')}`} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:8, background:platform.accent, color:"#000", padding:"9px 18px", borderRadius:8, textDecoration:"none", fontWeight:800, fontSize:12 }}>Search Patch Notes ↗</a>
                    )}
                  </div>
                </div>
              </div>
              {/* Steam news link */}
              {hasSteam && (
                <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:"#1b2838", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <PlatLogo pid="steam" size={22} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:t.text }}>Steam News Hub</div>
                    <div style={{ fontSize:11, color:t.sub }}>All announcements, patches, and developer posts</div>
                  </div>
                  <a href={`https://store.steampowered.com/news/app/${game.appId}`} target="_blank" rel="noopener noreferrer" style={{ background:`#1b2838`, border:"1px solid #66c0f444", color:"#66c0f4", padding:"7px 14px", borderRadius:7, textDecoration:"none", fontWeight:700, fontSize:11, flexShrink:0 }}>Open ↗</a>
                </div>
              )}
              {/* Reddit for patch news */}
              <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:12, marginTop:10 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:"#ff4500", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18 }}>🤖</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:t.text }}>Community Patch Discussion</div>
                  <div style={{ fontSize:11, color:t.sub }}>r/{game.subreddit} — community analysis & patch reactions</div>
                </div>
                <a href={`https://reddit.com/r/${game.subreddit}/search?q=patch+update+notes&sort=new`} target="_blank" rel="noopener noreferrer" style={{ background:"#ff4500", color:"#fff", padding:"7px 14px", borderRadius:7, textDecoration:"none", fontWeight:700, fontSize:11, flexShrink:0 }}>Reddit ↗</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Game Card ─────────────────────────────────────────────────────────────────
function GameCard({ game, platform, t, onOpen, fire, dlProg, isFavorite, onFavorite }) {
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const [ripples, addRipple] = useRipple();
  const ref = useRef();
  const [img, onArtFailed] = useGameArt(game);
  const isDownloading = dlProg !== undefined && dlProg < 100;

  const click = (e) => {
    addRipple(e, platform.accent);
    const r = ref.current.getBoundingClientRect();
    fire(r.left + r.width/2, r.top + r.height/2, platform.accent);
    setPress(true); setTimeout(()=>setPress(false), 180);
    onOpen(game, platform);
  };

  return (
    <div ref={ref} onClick={click} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:t.card, border:`1px solid ${hov?platform.accent+"80":t.border}`, borderRadius:10, overflow:"hidden", cursor:"pointer", position:"relative", transform:press?"scale(0.93)":hov?"translateY(-6px) scale(1.03)":"scale(1)", transition:"all 0.3s cubic-bezier(0.34,1.56,0.64,1)", boxShadow:hov?`0 16px 40px ${platform.accent}22`:"none" }}>
      {ripples.map(r=>(
        <div key={r.id} style={{ position:"absolute", left:r.x, top:r.y, width:260, height:260, borderRadius:"50%", background:`${r.color}28`, pointerEvents:"none", zIndex:8, transform:"translate(-50%,-50%) scale(0)", animation:"ripple 0.65s ease-out forwards" }} />
      ))}
      <div style={{ height:108, position:"relative", overflow:"hidden", background:`linear-gradient(135deg, ${platform.color}cc, #111)` }}>
        {img && !imgErr
          ? <img src={img} alt={game.name} onError={()=>{setImgErr(true);onArtFailed();}} style={{ width:"100%", height:"100%", objectFit:"cover", filter:hov?"brightness(0.38)":game.downloaded?"brightness(0.82)":"brightness(0.48) grayscale(0.3)", transition:"filter 0.3s, transform 0.4s", transform:hov?"scale(1.09)":"scale(1)" }} />
          : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><PlatLogo pid={platform.id} size={44} style={{ opacity:0.25 }} /></div>
        }
        <div style={{ position:"absolute", top:7, left:7, background:game.downloaded?"#16532299":"#00000099", backdropFilter:"blur(6px)", border:`1px solid ${game.downloaded?"#22c55e55":"#ffffff22"}`, color:game.downloaded?"#22c55e":"#aaa", fontSize:8, fontWeight:800, padding:"2px 7px", borderRadius:4, letterSpacing:"1px" }}>{game.downloaded?"● INSTALLED":"○ NOT INSTALLED"}</div>
        <div style={{ position:"absolute", top:7, right:7, background:"#000000bb", backdropFilter:"blur(6px)", border:`1px solid ${platform.accent}40`, padding:"3px 5px", borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", width:24, height:22 }}>
          <PlatLogo pid={platform.id} size={14} />
        </div>
        {isDownloading && <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3 }}><div style={{ height:"100%", width:`${dlProg}%`, background:`linear-gradient(90deg, ${platform.accent}88, ${platform.accent})`, transition:"width 0.28s", boxShadow:`0 0 6px ${platform.accent}` }} /></div>}
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", opacity:hov?1:0, transition:"opacity 0.22s" }}>
          <div style={{ background:"rgba(255,255,255,0.1)", backdropFilter:"blur(6px)", color:"#fff", fontWeight:900, fontSize:11, padding:"8px 18px", borderRadius:99, letterSpacing:"1.5px", border:"1px solid rgba(255,255,255,0.25)", transform:hov?"scale(1)":"scale(0.7)", transition:"transform 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
            🔍 VIEW DETAILS
          </div>
        </div>
      </div>
      <div style={{ padding:"9px 11px 11px" }}>
        <div style={{ fontSize:14, fontWeight:700, lineHeight:1.3, marginBottom:5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", color:t.text }}>{game.name}</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
          <span style={{ fontSize:11, background:`${platform.accent}18`, color:platform.accent, padding:"2px 7px", borderRadius:99, fontWeight:700, border:`1px solid ${platform.accent}30` }}>{game.genre}</span>
          <span style={{ fontSize:12, color:t.sub }}>{game.size} GB</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
          {game.rating > 0 && <>
            <div style={{ flex:1, height:2, background:t.border, borderRadius:99, overflow:"hidden" }}><div style={{ height:"100%", width:`${(game.rating/10)*100}%`, background:`linear-gradient(90deg, ${platform.accent}70, ${platform.accent})`, borderRadius:99 }} /></div>
            <span style={{ fontSize:11, color:platform.accent, fontWeight:800 }}>{game.rating}</span>
          </>}
          {!game.rating && <div style={{ flex:1 }} />}
          <button
            onClick={e=>{ e.stopPropagation(); onFavorite && onFavorite(game.id); }}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:15, color:isFavorite?"#f59e0b":"#444", transition:"all 0.2s", filter:isFavorite?"drop-shadow(0 0 5px #f59e0baa)":"none", padding:"0 1px", lineHeight:1, flexShrink:0 }}
          >{isFavorite ? "★" : "☆"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Discord member avatar ────────────────────────────────────────────────────
function MemberAvatar({ member, size=26, border }) {
  const s = { width:size, height:size, borderRadius:'50%', border:border||'none', flexShrink:0 };
  return member.avatar
    ? <img src={member.avatar} style={s} />
    : <div style={{ ...s, background:'#5865F2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*0.42), fontWeight:900, color:'white' }}>
        {(member.nick||member.username)[0].toUpperCase()}
      </div>;
}

// ─── Discord Panel ─────────────────────────────────────────────────────────────
const DISCORD_SVG = <svg width="14" height="11" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5 0c-.7 1.2-1.4 2.8-1.9 4a54.2 54.2 0 0 0-16.1 0C27 2.8 26.2 1.2 25.6 0A58.4 58.4 0 0 0 11 4.9C1.6 19.3-1 33.3.3 47.2a58.8 58.8 0 0 0 17.9 9.1c1.4-2 2.7-4.1 3.8-6.3a38.3 38.3 0 0 1-6-2.9l1.4-1.1a41.9 41.9 0 0 0 36 0l1.4 1.1a38.4 38.4 0 0 1-6 2.9c1.1 2.2 2.4 4.3 3.8 6.3a58.7 58.7 0 0 0 17.9-9.1c1.5-15.8-2.5-29.7-10.4-42.3zM23.7 38.7c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.3 7.2 0 4-2.8 7.2-6.3 7.2zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.3 7.2 0 4-2.8 7.2-6.3 7.2z"/></svg>;
const STATUS_COLOR = { online:'#57F287', idle:'#FAA61A', dnd:'#ED4245', offline:'#747F8D' };
const ACTIVITY_VERB = ['Playing','Streaming','Listening to','Watching','','Competing in'];

function DiscordPanel({ t, onClose, notifs, botConnected, guildData, presences, voiceStates, onBotConnect, onBotDisconnect }) {
  const saved = () => { try { return JSON.parse(localStorage.getItem('gcl-bot-config')||'{}'); } catch { return {}; } };
  const [token, setToken]   = useState(() => saved().token   || '');
  const [guildId, setGuildId] = useState(() => saved().guildId || '');
  const [showSetup, setShowSetup] = useState(false);
  const [tab, setTab] = useState('server');

  const members      = guildData?.members      || [];
  const voiceChannels = guildData?.voiceChannels || [];

  const statusOrder = { online:0, idle:1, dnd:2, offline:3 };
  const onlineMembers = [...members]
    .map(m => ({ ...m, p: presences[m.id] }))
    .filter(m => m.p && m.p.status !== 'offline')
    .sort((a,b) => (statusOrder[a.p.status]??3)-(statusOrder[b.p.status]??3));

  const voiceMap = {};
  Object.entries(voiceStates).forEach(([uid, cid]) => {
    if (!cid) return;
    if (!voiceMap[cid]) voiceMap[cid] = [];
    const m = members.find(x => x.id === uid);
    if (m) voiceMap[cid].push(m);
  });
  const activeVoice = voiceChannels.filter(c => voiceMap[c.id]?.length);

  const inp = { background:t.card, border:`1px solid ${t.border}`, color:t.text, padding:'7px 10px', borderRadius:7, fontSize:11, outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box' };

  return (
    <div style={{ position:'fixed', right:0, top:54, bottom:0, width:278, background:`${t.surface}f8`, backdropFilter:'blur(20px)', borderLeft:`1px solid ${t.border}`, zIndex:400, display:'flex', flexDirection:'column', animation:'slideRight 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>

      {/* Header */}
      <div style={{ padding:'13px 14px 10px', borderBottom:`1px solid ${t.border}`, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <div style={{ width:30, height:30, borderRadius:8, background:'#5865F2', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>{DISCORD_SVG}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:13, color:t.text }}>Discord</div>
          <div style={{ fontSize:10, fontWeight:700, color:botConnected?'#57F287':'#747F8D' }}>
            {botConnected ? `● ${guildData?.name||'Connected'}` : '○ Not connected'}
          </div>
        </div>
        <button onClick={()=>setShowSetup(s=>!s)} title="Bot settings" style={{ background:showSetup?'#5865F220':'transparent', border:`1px solid ${showSetup?'#5865F2':t.border}`, color:showSetup?'#5865F2':t.sub, cursor:'pointer', width:26, height:26, borderRadius:6, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}>⚙</button>
        <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${t.border}`, color:t.sub, cursor:'pointer', width:26, height:26, borderRadius:6, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
      </div>

      {/* Setup */}
      {showSetup && (
        <div style={{ padding:'12px 14px', borderBottom:`1px solid ${t.border}`, display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
          <div style={{ fontSize:9, fontWeight:800, color:t.sub, letterSpacing:'2px' }}>BOT SETUP</div>
          <input type="password" placeholder="Bot Token" value={token} onChange={e=>setToken(e.target.value)} style={inp} />
          <input placeholder="Server ID (leave blank = first server)" value={guildId} onChange={e=>setGuildId(e.target.value)} style={inp} />
          <div style={{ display:'flex', gap:6 }}>
            <button
              onClick={()=>{ onBotConnect(token.trim(), guildId.trim()||null); setShowSetup(false); }}
              disabled={!token.trim()}
              style={{ flex:1, background:'#5865F2', border:'none', color:'white', padding:'7px 0', borderRadius:7, cursor:token.trim()?'pointer':'not-allowed', fontSize:11, fontWeight:800, opacity:token.trim()?1:0.5 }}>
              {botConnected?'Reconnect':'Connect Bot'}
            </button>
            {botConnected&&<button onClick={()=>{ onBotDisconnect(); setShowSetup(false); }} style={{ background:t.card, border:`1px solid ${t.border}`, color:'#ED4245', padding:'7px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:800 }}>Disconnect</button>}
          </div>
          <div style={{ fontSize:9, color:t.sub, lineHeight:1.7 }}>
            1. Create bot → <b style={{ color:'#5865F2' }}>discord.com/developers</b><br/>
            2. Bot Settings → Enable <b>Server Members Intent</b> + <b>Presence Intent</b><br/>
            3. OAuth2 → invite bot to your server
          </div>
        </div>
      )}

      {/* Tabs */}
      {botConnected && !showSetup && (
        <div style={{ display:'flex', borderBottom:`1px solid ${t.border}`, flexShrink:0 }}>
          {[['server','SERVER'],['activity','ACTIVITY']].map(([v,label])=>(
            <button key={v} onClick={()=>setTab(v)} style={{ flex:1, background:'transparent', border:'none', borderBottom:`2px solid ${tab===v?'#5865F2':'transparent'}`, color:tab===v?'#5865F2':t.sub, padding:'8px 0', cursor:'pointer', fontSize:10, fontWeight:800, letterSpacing:'1px', transition:'all 0.15s' }}>{label}</button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:10, display:'flex', flexDirection:'column', gap:5 }}>

        {/* SERVER tab */}
        {botConnected && tab==='server' && !showSetup && <>
          {/* Voice channels */}
          {activeVoice.length > 0 && <div style={{ marginBottom:6 }}>
            <div style={{ fontSize:9, fontWeight:800, color:t.sub, letterSpacing:'2px', marginBottom:8 }}>🔊 IN VOICE</div>
            {activeVoice.map(ch=>(
              <div key={ch.id} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                  <span style={{ color:'#57F287', fontSize:12 }}>🔊</span>
                  <span style={{ fontSize:12, fontWeight:700, color:t.text }}>{ch.name}</span>
                  <span style={{ marginLeft:'auto', fontSize:9, color:t.sub, background:t.card, padding:'1px 6px', borderRadius:99, border:`1px solid ${t.border}` }}>{voiceMap[ch.id].length}</span>
                </div>
                {voiceMap[ch.id].map(m=>(
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 8px', borderRadius:7, background:t.card, border:`1px solid ${t.border}`, marginBottom:3 }}>
                    <MemberAvatar member={m} size={22} border="2px solid #57F287" />
                    <span style={{ fontSize:11, fontWeight:600, color:t.text }}>{m.nick||m.username}</span>
                    <span style={{ marginLeft:'auto', fontSize:12 }}>🎙</span>
                  </div>
                ))}
              </div>
            ))}
          </div>}

          {/* Online members */}
          <div style={{ fontSize:9, fontWeight:800, color:t.sub, letterSpacing:'2px', marginBottom:6 }}>
            ONLINE — {onlineMembers.length}
          </div>
          {onlineMembers.length===0
            ? <div style={{ color:t.sub, fontSize:12, textAlign:'center', padding:'24px 0' }}>No members online</div>
            : onlineMembers.map(m=>(
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8, background:t.card, border:`1px solid ${t.border}` }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <MemberAvatar member={m} size={28} />
                  <div style={{ position:'absolute', bottom:-1, right:-1, width:10, height:10, borderRadius:'50%', background:STATUS_COLOR[m.p.status]||'#747F8D', border:`2px solid ${t.surface}` }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:t.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.nick||m.username}</div>
                  {m.p.activity&&<div style={{ fontSize:10, color:t.sub, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ACTIVITY_VERB[m.p.activity.type]||''} {m.p.activity.name}</div>}
                </div>
              </div>
            ))
          }
        </>}

        {/* ACTIVITY tab / not-connected state */}
        {(!botConnected||tab==='activity') && !showSetup && <>
          <div style={{ fontSize:9, fontWeight:800, color:t.sub, letterSpacing:'2px', paddingBottom:4 }}>ACTIVITY LOG</div>
          {!botConnected&&<div style={{ background:'#5865F211', border:'1px solid #5865F230', borderRadius:8, padding:'10px 12px', marginBottom:4 }}>
            <div style={{ fontSize:11, color:'#5865F2', fontWeight:700, marginBottom:3 }}>Connect a Discord bot</div>
            <div style={{ fontSize:10, color:t.sub, lineHeight:1.5 }}>Click ⚙ above to set up your bot and see who's online + voice channels.</div>
          </div>}
          {notifs.length===0&&<div style={{ color:t.sub, fontSize:12, textAlign:'center', padding:'20px 0' }}>Click any game to explore reviews, Reddit & patch notes</div>}
          {notifs.map((n,i)=>(
            <div key={i} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:8, padding:'9px 11px', animation:`fadeUp 0.3s ease ${Math.min(i,5)*0.04}s both` }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:'#5865F2', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>{DISCORD_SVG}</div>
                <span style={{ fontWeight:800, fontSize:11, color:t.text }}>GCL Bot</span>
                <span style={{ fontSize:9, color:t.sub, marginLeft:'auto' }}>{n.time}</span>
              </div>
              <div style={{ fontSize:11, color:t.text, lineHeight:1.5 }}>{n.msg}</div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ─── Merge real scanner results into library state ────────────────────────────
function mergeRealGamesIntoLib(prevLib, platformId, realGames) {
  const next = JSON.parse(JSON.stringify(prevLib));

  if (platformId === 'curseforge') {
    next.curseforge = realGames.map(rg => ({
      id: `cf_real_${rg.id}`,
      name: rg.name,
      genre: rg.version ? `MC ${rg.version}${rg.modCount > 0 ? ` · ${rg.modCount} mods` : ''}` : 'Modpack',
      downloaded: true,
      size: '0',
      hours: 0,
      rating: 0,
      subreddit: 'feedthebeast',
      wiki: 'Minecraft',
    }));
    return next;
  }

  const existing = next[platformId] || [];
  const processedNames = new Set();

  if (platformId === 'epic') {
    const realMap = new Map(realGames.map(g => [g.name.toLowerCase(), g]));
    existing.forEach(g => {
      const real = realMap.get(g.name.toLowerCase());
      g.downloaded = !!real;
      if (real) { g.epicAppName = real.appName; if (real.sizeGB > 0) g.size = real.sizeGB.toString(); }
      processedNames.add(g.name.toLowerCase());
    });
    for (const rg of realGames) {
      if (!processedNames.has(rg.name.toLowerCase())) {
        existing.push({ id:`epic_real_${rg.appName}`, name:rg.name, genre:'Epic Game', downloaded:true, size:rg.sizeGB.toString(), hours:0, rating:0, epicAppName:rg.appName, subreddit:null, wiki:null });
      }
    }
  }

  if (platformId === 'ubisoft') {
    const realMap = new Map(realGames.map(g => [g.name.toLowerCase(), g]));
    existing.forEach(g => {
      const real = realMap.get(g.name.toLowerCase());
      g.downloaded = !!real;
      if (real) g.ubisoftId = real.id;
      processedNames.add(g.name.toLowerCase());
    });
    for (const rg of realGames) {
      if (!processedNames.has(rg.name.toLowerCase())) {
        existing.push({ id:`ubi_real_${rg.id}`, name:rg.name, genre:'Ubisoft Game', downloaded:true, size:'0', hours:0, rating:0, ubisoftId:rg.id, subreddit:null, wiki:null });
      }
    }
  }

  next[platformId] = existing;
  return next;
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function GamingLauncher() {
  const [theme, setTheme]         = useState(THEMES[0]);
  const t = theme;
  const [connected, setConnected] = useState(() => {
    const base = { steam: true };
    try {
      const saved = JSON.parse(localStorage.getItem('gcl-connected') || '{}');
      Object.assign(base, saved);
      if (JSON.parse(localStorage.getItem('gcl-custom-games') || '[]').length > 0) base.custom = true;
    } catch {}
    return base;
  });
  const [signingIn, setSigningIn] = useState(null);
  const [search, setSearch]       = useState("");
  const [tab, setTab]             = useState("library");
  const [platFilter, setPlatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showTheme, setShowTheme]   = useState(false);
  const [showDiscord, setShowDiscord] = useState(false);
  const [discordNotifs, setDiscordNotifs] = useState([]);
  const [toasts, setToasts]         = useState([]);
  const [downloading, setDownloading] = useState({});
  const [dlProg, setDlProg]           = useState({});
  const [libData, setLibData]         = useState(() => {
    const initial = JSON.parse(JSON.stringify(LIBRARIES));
    // Reset all hardcoded downloaded states — scans will set them correctly
    Object.values(initial).forEach(games => games.forEach(g => g.downloaded = false));
    try { const saved = JSON.parse(localStorage.getItem('gcl-custom-games') || '[]'); if (saved.length > 0) initial.custom = saved; } catch {}
    return initial;
  });
  const [particles, fire]             = useParticles();
  const [modal, setModal]             = useState(null);
  const [diskInfo, setDiskInfo]       = useState([]);
  const [favorites, setFavorites]     = useState(() => { try { return JSON.parse(localStorage.getItem('gcl-favorites')||'[]'); } catch { return []; } });
  const [customPaths, setCustomPaths] = useState(() => { try { return JSON.parse(localStorage.getItem('gcl-paths')||'{}'); } catch { return {}; } });
  const [needsPath, setNeedsPath]     = useState({});
  const [addGameModal, setAddGameModal] = useState(false);
  const [botConnected, setBotConnected]   = useState(false);
  const [botGuildData, setBotGuildData]   = useState(null);
  const [botPresences, setBotPresences]   = useState({});
  const [botVoiceStates, setBotVoiceStates] = useState({});
  const tidRef  = useRef(0);
  const toastRef = useRef(null);
  const [scanPhase, setScanPhase]   = useState('scanning');
  const [splashDone, setSplashDone] = useState(false);

  const toggleFavorite = useCallback((gameId) => {
    setFavorites(prev => {
      const next = prev.includes(gameId) ? prev.filter(id=>id!==gameId) : [...prev, gameId];
      localStorage.setItem('gcl-favorites', JSON.stringify(next));
      return next;
    });
  }, []);

  // Load real disk info and real Steam library on mount
  useEffect(() => {
    if (!window.electronAPI) { setScanPhase('done'); return; }
    window.electronAPI.getDiskInfo().then(drives => {
      if (drives && drives.length > 0) setDiskInfo(drives);
    });
    window.electronAPI.getSteamLibrary().then(realGames => {
      if (!realGames || realGames.length === 0) { setScanPhase('done'); return; }
      const realMap = new Map(realGames.map(g => [g.appid, g]));
      setLibData(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        const hardcoded = next.steam || [];
        const processedIds = new Set();
        hardcoded.forEach(g => {
          if (!g.appId) return;
          const real = realMap.get(g.appId);
          g.downloaded = !!real;
          if (real) g.size = real.sizeGB.toString();
          processedIds.add(g.appId);
        });
        for (const [appid, rg] of realMap) {
          if (processedIds.has(appid)) continue;
          hardcoded.push({ id:`s_real_${appid}`, name:rg.name, genre:"Steam Game", downloaded:true, size:rg.sizeGB.toString(), hours:0, rating:0, appId:appid, subreddit:null, wiki:null });
        }
        next.steam = hardcoded;
        return next;
      });
      setScanPhase('done');
    });
  }, []);

  // Persist connected platforms whenever they change
  useEffect(() => {
    localStorage.setItem('gcl-connected', JSON.stringify(connected));
  }, [connected]);

  // On mount, re-scan platforms that were connected last session
  useEffect(() => {
    if (!window.electronAPI) return;
    const savedPaths = JSON.parse(localStorage.getItem('gcl-paths') || '{}');
    const savedConnected = JSON.parse(localStorage.getItem('gcl-connected') || '{}');
    const REAL_SCAN = ['epic', 'ubisoft', 'curseforge'];
    REAL_SCAN.forEach(async (pid) => {
      if (!savedConnected[pid]) return;
      const storedPath = savedPaths[pid] || null;
      let result = null;
      if (pid === 'epic')       result = await window.electronAPI.scanEpicLibrary(storedPath);
      if (pid === 'ubisoft')    result = await window.electronAPI.scanUbisoftLibrary(storedPath);
      if (pid === 'curseforge') result = await window.electronAPI.scanCurseForgeLibrary(storedPath);
      if (result !== null) {
        setLibData(prev => mergeRealGamesIntoLib(prev, pid, result));
      } else {
        setNeedsPath(prev => ({ ...prev, [pid]: true }));
      }
    });
  }, []);

  const ts = () => new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  const toast = useCallback((msg, color) => {
    const id = ++tidRef.current;
    setToasts(x=>[...x,{id,msg,color:color||t.accent}]);
    setTimeout(()=>setToasts(x=>x.filter(t=>t.id!==id)), 3500);
  },[t.accent]);
  const discord = useCallback((msg)=>setDiscordNotifs(n=>[{msg,time:ts()},...n.slice(0,29)]),[]);
  toastRef.current = toast;

  // Discord bot IPC listeners — set up once on mount
  useEffect(() => {
    if (!window.electronAPI) return;
    const saved = (() => { try { return JSON.parse(localStorage.getItem('gcl-bot-config')||'null'); } catch { return null; } })();
    if (saved?.token) window.electronAPI.discordBotConnect(saved.token, saved.guildId||null);

    window.electronAPI.onDiscordReady(()  => setBotConnected(true));
    window.electronAPI.onDiscordGuild((d) => {
      setBotGuildData(d);
      setBotPresences(Object.fromEntries(d.presences.map(p=>[p.userId,{status:p.status,activity:p.activity}])));
      setBotVoiceStates(Object.fromEntries(d.voiceStates.map(v=>[v.userId,v.channelId])));
    });
    window.electronAPI.onDiscordPresence((u) =>
      setBotPresences(prev=>({...prev,[u.userId]:{status:u.status,activity:u.activity}})));
    window.electronAPI.onDiscordVoice((u) =>
      setBotVoiceStates(prev=>({...prev,[u.userId]:u.channelId})));
    window.electronAPI.onDiscordError((e) =>
      toastRef.current?.(`Discord: ${e.message}`, '#ED4245'));
    window.electronAPI.onDiscordDisconnect(()=> setBotConnected(false));
    return () => window.electronAPI.removeDiscordListeners?.();
  }, []);

  const handleBotConnect = useCallback((token, guildId) => {
    if (!window.electronAPI) return;
    localStorage.setItem('gcl-bot-config', JSON.stringify({ token, guildId }));
    window.electronAPI.discordBotConnect(token, guildId);
  }, []);

  const handleBotDisconnect = useCallback(() => {
    if (!window.electronAPI) return;
    localStorage.removeItem('gcl-bot-config');
    window.electronAPI.discordBotDisconnect();
    setBotConnected(false); setBotGuildData(null);
    setBotPresences({}); setBotVoiceStates({});
  }, []);

  const handleSetPath = useCallback(async (platformId) => {
    if (!window.electronAPI) return;
    const selectedPath = await window.electronAPI.selectFolder();
    if (!selectedPath) return;
    const newPaths = { ...JSON.parse(localStorage.getItem('gcl-paths')||'{}'), [platformId]: selectedPath };
    localStorage.setItem('gcl-paths', JSON.stringify(newPaths));
    setCustomPaths(newPaths);
    let result = null;
    if (platformId==='epic')       result = await window.electronAPI.scanEpicLibrary(selectedPath);
    if (platformId==='ubisoft')    result = await window.electronAPI.scanUbisoftLibrary(selectedPath);
    if (platformId==='curseforge') result = await window.electronAPI.scanCurseForgeLibrary(selectedPath);
    if (result && result.length > 0) {
      setLibData(prev => mergeRealGamesIntoLib(prev, platformId, result));
      setNeedsPath(prev => ({...prev, [platformId]: false}));
      toast(`Found ${result.length} ${platformId==='curseforge'?'modpacks':'games'}!`, '#22c55e');
    } else {
      toast('No items found — try a different folder', '#f43f5e');
    }
  }, [toast]);

  const handleAddCustomGame = useCallback((game) => {
    setConnected(c => ({ ...c, custom: true }));
    setLibData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.custom = [...(next.custom || []), game];
      localStorage.setItem('gcl-custom-games', JSON.stringify(next.custom));
      return next;
    });
    setAddGameModal(false);
    toast(`${game.name} added to library!`, '#a78bfa');
  }, [toast]);

  const handleRemoveCustomGame = useCallback((gameId) => {
    setLibData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next.custom = (next.custom || []).filter(g => g.id !== gameId);
      localStorage.setItem('gcl-custom-games', JSON.stringify(next.custom));
      return next;
    });
    setModal(null);
    toast('Game removed from library', '#f43f5e');
  }, [toast]);

  const handleConnect = useCallback((p,e)=>{
    if (p.id === 'custom') { setAddGameModal(true); return; }
    if(e){const r=e.currentTarget.getBoundingClientRect();fire(r.left+r.width/2,r.top+r.height/2,p.accent);}
    setSigningIn(p.id);
    setTimeout(async ()=>{
      setSigningIn(null);
      setConnected(c=>({...c,[p.id]:true}));
      const REAL_SCAN = ['epic','ubisoft','curseforge'];
      if (window.electronAPI && REAL_SCAN.includes(p.id)) {
        const storedPath = JSON.parse(localStorage.getItem('gcl-paths')||'{}')[p.id] || null;
        let result = null;
        if (p.id==='epic')       result = await window.electronAPI.scanEpicLibrary(storedPath);
        if (p.id==='ubisoft')    result = await window.electronAPI.scanUbisoftLibrary(storedPath);
        if (p.id==='curseforge') result = await window.electronAPI.scanCurseForgeLibrary(storedPath);
        if (result === null) {
          setNeedsPath(prev=>({...prev,[p.id]:true}));
          toast(`${p.name} connected — click 📁 to set your games folder`, '#f97316');
          discord(`⚠️ Connected to **${p.name}** — needs game path`);
          return;
        }
        // Merge even if empty — resets any hardcoded downloaded:true games to false
        setLibData(prev => mergeRealGamesIntoLib(prev, p.id, result));
        const label = p.id==='curseforge' ? 'modpacks' : 'games';
        if (result.length > 0) {
          toast(`${p.name} connected — ${result.length} ${label} found!`, '#22c55e');
          discord(`✅ Connected to **${p.name}** · ${result.length} ${label}`);
        } else {
          toast(`${p.name} connected — no ${label} found`, '#f97316');
          discord(`⚠️ Connected to **${p.name}** · no ${label} found`);
        }
        return;
      }
      toast(`${p.name} connected!`, '#22c55e');
      discord(`✅ Connected to **${p.name}**`);
    },1800);
  },[fire,toast,discord]);

  const handleDownload = useCallback((game,plat)=>{
    if(downloading[game.id]) return;
    setDownloading(d=>({...d,[game.id]:true}));
    setDlProg(d=>({...d,[game.id]:0}));
    toast(`Downloading ${game.name}...`,plat.accent);
    discord(`⬇️ Downloading **${game.name}** (${game.size} GB)`);
    const iv=setInterval(()=>{
      setDlProg(d=>{
        const cur=d[game.id]??0,nxt=cur+Math.random()*7+3;
        if(nxt>=100){
          clearInterval(iv);
          setDownloading(dd=>{const c={...dd};delete c[game.id];return c;});
          setLibData(ld=>{const c=JSON.parse(JSON.stringify(ld));const f=c[plat.id]?.find(g=>g.id===game.id);if(f)f.downloaded=true;return c;});
          toast(`${game.name} installed!`,"#22c55e");
          discord(`✅ **${game.name}** ready to play`);
          return{...d,[game.id]:100};
        }
        return{...d,[game.id]:nxt};
      });
    },280);
  },[downloading,toast,discord]);

  const handleOpen=useCallback((game,plat)=>{
    setModal({game,platform:plat});
    discord(`🔍 Viewing **${game.name}** — About, Reddit & Reviews`);
  },[discord]);

  const connectedPlats = PLATFORMS.filter(p=>connected[p.id]);
  const allGames = connectedPlats.flatMap(p=>(libData[p.id]||[]).map(g=>({...g,platform:p})));
  const installedGames = allGames.filter(g=>g.downloaded);
  const favoritedGames = allGames.filter(g=>favorites.includes(g.id));
  const totalGB = installedGames.reduce((a,g)=>a+parseFloat(g.size||0),0).toFixed(0);
  const primaryDrive = diskInfo.find(d=>d.name==='C:') || diskInfo[0];
  const diskDisplayTotal = primaryDrive ? Math.round(primaryDrive.total/1073741824) : 512;
  const diskDisplayUsed  = primaryDrive ? Math.round(primaryDrive.used/1073741824)  : parseInt(totalGB);
  const diskLabel = primaryDrive ? primaryDrive.name : 'STORAGE';
  const diskPct = Math.min((diskDisplayUsed/diskDisplayTotal)*100,100);
  const diskColor = diskPct>80?"#f43f5e":diskPct>60?"#f97316":t.accent;
  const filtered = allGames.filter(g=>{
    if(!g.name.toLowerCase().includes(search.toLowerCase())) return false;
    if(platFilter!=="all"&&g.platform.id!==platFilter) return false;
    if(statusFilter==="installed"&&!g.downloaded) return false;
    if(statusFilter==="not-installed"&&g.downloaded) return false;
    if(statusFilter==="favorites"&&!favorites.includes(g.id)) return false;
    return true;
  });

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:t.bg, color:t.text, height:"100vh", display:"flex", flexDirection:"column", position:"relative" }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:-260, left:"30%", width:540, height:540, borderRadius:"50%", background:`radial-gradient(ellipse, ${t.accent}11 0%, transparent 65%)` }} />
        <div style={{ position:"absolute", bottom:-180, right:"15%", width:340, height:340, borderRadius:"50%", background:`radial-gradient(ellipse, ${t.accent}07 0%, transparent 65%)` }} />
      </div>
      <Particles particles={particles} />

      {/* Toasts */}
      <div style={{ position:"fixed", top:14, right:showDiscord?296:14, zIndex:9999, display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end", transition:"right 0.35s" }}>
        {toasts.map(to=>(
          <div key={to.id} style={{ background:`${t.surface}f2`, backdropFilter:"blur(14px)", border:`1px solid ${to.color}45`, color:t.text, padding:"9px 15px", borderRadius:10, fontSize:12, fontWeight:700, boxShadow:`0 4px 24px ${to.color}30`, animation:"toastPop 0.4s cubic-bezier(0.34,1.56,0.64,1)", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:to.color, boxShadow:`0 0 8px ${to.color}` }} />{to.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <header style={{ background:`${t.surface}ee`, borderBottom:`1px solid ${t.border}`, padding:"0 18px", display:"flex", alignItems:"center", gap:12, height:54, position:"sticky", top:0, zIndex:100, backdropFilter:"blur(16px)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div onClick={e=>{const r=e.currentTarget.getBoundingClientRect();fire(r.left+23,r.top+23,t.accent);}} style={{ width:46, height:46, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", filter:`drop-shadow(0 0 10px ${t.accent}90)`, opacity:splashDone?1:0, transition:'opacity 0.3s ease' }}>
            <img src="./logos/Gaming-Community-Logo - 1.png" alt="" style={{ width:46, height:46, objectFit:"contain" }} />
          </div>
          <div><div style={{ fontSize:12, fontWeight:900, letterSpacing:"2px", lineHeight:1.1 }}>GAMING COMMUNITY</div><div style={{ fontSize:8, fontWeight:800, color:t.accent, letterSpacing:"3px" }}>LAUNCHER</div></div>
        </div>
        <nav style={{ display:"flex", gap:2, marginLeft:4 }}>
          {["library","platforms","store"].map(tb=>(
            <button key={tb} onClick={()=>setTab(tb)} style={{ background:tab===tb?`${t.accent}22`:"transparent", border:`1px solid ${tab===tb?t.accent+"50":"transparent"}`, color:tab===tb?t.accent:t.sub, padding:"5px 13px", borderRadius:7, cursor:"pointer", fontSize:10, fontWeight:800, letterSpacing:"1.5px", textTransform:"uppercase", transition:"all 0.2s" }}>{tb}</button>
          ))}
        </nav>
        <div style={{ flex:1 }} />
        <div style={{ minWidth:190 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, fontWeight:800, letterSpacing:"1px", color:t.sub, marginBottom:3 }}>
            <span>{diskLabel}</span><span style={{ color:diskColor }}>{diskDisplayUsed} / {diskDisplayTotal} GB</span>
          </div>
          <div style={{ height:3, background:t.border, borderRadius:99, overflow:"hidden" }}><div style={{ height:"100%", width:`${diskPct}%`, background:`linear-gradient(90deg, ${diskColor}70, ${diskColor})`, borderRadius:99, transition:"width 0.8s" }} /></div>
          <div style={{ fontSize:10, color:t.sub, marginTop:2 }}>{installedGames.length} installed · {allGames.length} total</div>
        </div>
        <button onClick={()=>setShowDiscord(!showDiscord)} style={{ background:showDiscord?"#5865F220":t.card, border:`1px solid ${showDiscord?"#5865F2":t.border}`, color:showDiscord?"#5865F2":t.sub, padding:"5px 11px", borderRadius:7, cursor:"pointer", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", gap:6, transition:"all 0.2s" }}>
          <svg width="13" height="10" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5 0c-.7 1.2-1.4 2.8-1.9 4a54.2 54.2 0 0 0-16.1 0C27 2.8 26.2 1.2 25.6 0A58.4 58.4 0 0 0 11 4.9C1.6 19.3-1 33.3.3 47.2a58.8 58.8 0 0 0 17.9 9.1c1.4-2 2.7-4.1 3.8-6.3a38.3 38.3 0 0 1-6-2.9l1.4-1.1a41.9 41.9 0 0 0 36 0l1.4 1.1a38.4 38.4 0 0 1-6 2.9c1.1 2.2 2.4 4.3 3.8 6.3a58.7 58.7 0 0 0 17.9-9.1c1.5-15.8-2.5-29.7-10.4-42.3zM23.7 38.7c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.3 7.2 0 4-2.8 7.2-6.3 7.2zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.3 7.2 0 4-2.8 7.2-6.3 7.2z"/></svg>
          DISCORD {discordNotifs.length>0&&<span style={{ background:"#f43f5e", color:"#fff", fontSize:8, fontWeight:900, minWidth:14, height:14, borderRadius:99, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px" }}>{discordNotifs.length>9?"9+":discordNotifs.length}</span>}
        </button>
        <div style={{ position:"relative" }}>
          <button onClick={()=>setShowTheme(!showTheme)} style={{ background:showTheme?`${t.accent}22`:t.card, border:`1px solid ${showTheme?t.accent:t.border}`, color:t.text, padding:"5px 11px", borderRadius:7, cursor:"pointer", fontSize:10, fontWeight:800, transition:"all 0.2s" }}>🎨 THEME</button>
          {showTheme&&(
            <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, background:t.surface, border:`1px solid ${t.border}`, borderRadius:12, padding:10, zIndex:300, boxShadow:"0 20px 60px #000000bb", minWidth:148, animation:"dropDown 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
              {THEMES.map(th=>(
                <button key={th.id} onClick={()=>{setTheme(th);setShowTheme(false);}} style={{ display:"flex", alignItems:"center", gap:9, width:"100%", background:theme.id===th.id?`${th.accent}20`:"transparent", border:`1px solid ${theme.id===th.id?th.accent+"50":"transparent"}`, color:t.text, padding:"7px 9px", borderRadius:7, cursor:"pointer", marginBottom:2, fontSize:12, fontWeight:600, textAlign:"left" }}>
                  <div style={{ width:11, height:11, borderRadius:"50%", background:th.accent, boxShadow:`0 0 8px ${th.accent}`, flexShrink:0 }} />{th.label}{theme.id===th.id&&<span style={{ marginLeft:"auto", color:th.accent }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative", zIndex:1 }}>
        {/* Sidebar */}
        <aside style={{ width:210, background:`${t.surface}cc`, borderRight:`1px solid ${t.border}`, display:"flex", flexDirection:"column", backdropFilter:"blur(8px)", flexShrink:0, overflowY:"auto" }}>
          <div style={{ padding:"14px 13px 8px", fontSize:10, fontWeight:800, color:t.sub, letterSpacing:"2.5px" }}>PLATFORMS</div>
          {PLATFORMS.map(p=>{
            const isConn=connected[p.id],loading=signingIn===p.id;
            const lib=libData[p.id]||[],inst=lib.filter(g=>g.downloaded).length;
            const active=platFilter===p.id;
            return(
              <button key={p.id} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();fire(r.right-12,r.top+r.height/2,p.accent);setPlatFilter(active?"all":p.id);if(tab!=="library")setTab("library");}} style={{ display:"flex", alignItems:"center", gap:9, width:"100%", background:active?`${p.accent}15`:"transparent", borderLeft:`3px solid ${active?p.accent:"transparent"}`, border:"none", borderRight:"none", borderTop:"none", borderBottom:"none", borderLeftStyle:"solid", borderLeftWidth:3, borderLeftColor:active?p.accent:"transparent", color:t.text, padding:"8px 13px", cursor:"pointer", textAlign:"left", transition:"all 0.2s" }}>
                <div style={{ width:22, height:22, borderRadius:5, background:p.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:`1px solid ${p.accent}30` }}><PlatLogo pid={p.id} size={14} /></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:needsPath[p.id]?"#f97316":isConn?"#22c55e":t.sub }}>{loading?"⌛ Connecting...":needsPath[p.id]?"⚠ Needs game path":isConn?`● ${inst}/${lib.length} installed`:"○ Not linked"}</div>
                </div>
                {p.id==='custom'
                  ? <button onClick={e=>{e.stopPropagation();setAddGameModal(true);}} style={{ background:p.color, border:`1px solid ${p.accent}40`, color:p.accent, fontSize:10, fontWeight:900, width:20, height:20, borderRadius:4, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>+</button>
                  : !isConn&&!loading&&<button onClick={e=>{e.stopPropagation();handleConnect(p,e);}} style={{ background:p.color, border:`1px solid ${p.accent}40`, color:p.accent, fontSize:10, fontWeight:900, width:20, height:20, borderRadius:4, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>+</button>}
              </button>
            );
          })}
          <div style={{ margin:"10px 13px", borderTop:`1px solid ${t.border}` }} />
          <div style={{ padding:"0 13px 7px", fontSize:10, fontWeight:800, color:t.sub, letterSpacing:"2.5px" }}>STATUS</div>
          {[["all","All Games",allGames.length],["installed","Installed",installedGames.length],["not-installed","Not Installed",allGames.length-installedGames.length],["favorites","★ Favorites",favorites.length]].map(([v,label,count])=>(
            <button key={v} onClick={()=>setStatusFilter(v)} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", background:statusFilter===v?`${t.accent}15`:"transparent", border:"none", color:statusFilter===v?t.accent:t.sub, padding:"6px 13px", cursor:"pointer", fontSize:13, fontWeight:700, textAlign:"left", transition:"all 0.15s" }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:statusFilter===v?t.accent:"transparent", border:`1px solid ${statusFilter===v?t.accent:t.sub}`, display:"inline-block", flexShrink:0 }} />{label}<span style={{ marginLeft:"auto", fontSize:9, color:t.sub }}>{count}</span>
            </button>
          ))}
          {diskInfo.length>0&&<>
            <div style={{ margin:"10px 13px 0", borderTop:`1px solid ${t.border}` }} />
            <div style={{ padding:"7px 13px 4px", fontSize:10, fontWeight:800, color:t.sub, letterSpacing:"2.5px" }}>DRIVES</div>
            <div style={{ padding:"0 13px 10px" }}>
              {diskInfo.map(drive=>{
                const pct=Math.round((drive.used/drive.total)*100);
                const dc=pct>85?"#f43f5e":pct>65?"#f97316":t.accent;
                const gbU=(drive.used/1073741824).toFixed(0), gbT=(drive.total/1073741824).toFixed(0);
                return<div key={drive.name} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                    <span style={{ fontWeight:800, color:t.text }}>{drive.name}</span>
                    <span style={{ color:dc, fontWeight:700 }}>{gbU}/{gbT} GB</span>
                  </div>
                  <div style={{ height:4, background:t.border, borderRadius:99, overflow:"hidden" }}><div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg, ${dc}70, ${dc})`, borderRadius:99 }} /></div>
                </div>;
              })}
            </div>
          </>}
          {Object.keys(downloading).length>0&&(
            <><div style={{ margin:"10px 13px", borderTop:`1px solid ${t.border}` }} />
            <div style={{ padding:"0 13px 7px", fontSize:10, fontWeight:800, color:t.sub, letterSpacing:"2.5px" }}>DOWNLOADING</div>
            {Object.entries(downloading).map(([gid])=>{
              const g=allGames.find(g=>g.id===gid),p=dlProg[gid]||0;
              if(!g) return null;
              return<div key={gid} style={{ padding:"5px 13px" }}>
                <div style={{ fontSize:10, fontWeight:600, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.name}</div>
                <div style={{ height:3, background:t.border, borderRadius:99, overflow:"hidden" }}><div style={{ height:"100%", width:`${p}%`, background:`linear-gradient(90deg, ${g.platform.accent}80, ${g.platform.accent})`, transition:"width 0.28s" }} /></div>
                <div style={{ fontSize:8, color:t.sub, marginTop:2 }}>{Math.floor(p)}%</div>
              </div>;
            })}</>
          )}
        </aside>

        {/* Main */}
        <main style={{ flex:1, overflowY:"auto", padding:18, paddingRight:showDiscord?296:18, transition:"padding-right 0.35s" }}>
          {tab==="library"&&(
            <>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:900, letterSpacing:"1px", lineHeight:1.1 }}>{platFilter==="all"?"ALL GAMES":PLATFORMS.find(p=>p.id===platFilter)?.name.toUpperCase()}</div>
                  <div style={{ fontSize:10, color:t.sub, marginTop:2 }}>{filtered.length} games · {filtered.filter(g=>g.downloaded).length} installed · click any game for Reddit, reviews & patch notes</div>
                </div>
                <div style={{ flex:1 }} />
                {platFilter==='custom'&&<button onClick={()=>setAddGameModal(true)} style={{ background:'#a78bfa22', border:'1px solid #a78bfa50', color:'#a78bfa', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:800, flexShrink:0, whiteSpace:'nowrap' }}>+ ADD GAME</button>}
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search library..." style={{ background:t.card, border:`1px solid ${t.border}`, color:t.text, padding:"7px 13px", borderRadius:8, fontSize:11, outline:"none", width:210, fontFamily:"inherit" }} onFocus={e=>e.target.style.borderColor=t.accent} onBlur={e=>e.target.style.borderColor=t.border} />
              </div>
              {platFilter==="all"?(
                connectedPlats.length===0?(
                  <div style={{ textAlign:"center", padding:"80px 0", color:t.sub }}>
                    <div style={{ fontSize:48, marginBottom:12 }}>🎮</div>
                    <div style={{ fontSize:15, fontWeight:700 }}>Connect a platform to see your library</div>
                    <button onClick={()=>setTab("platforms")} style={{ marginTop:16, background:`${t.accent}22`, border:`1px solid ${t.accent}50`, color:t.accent, padding:"9px 20px", borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:12 }}>VIEW PLATFORMS →</button>
                  </div>
                ):(
                  <>
                    {/* ── Favorites row ──────────────────────────────────── */}
                    {favoritedGames.length>0&&statusFilter!=="favorites"&&(
                      <div style={{ marginBottom:28 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                          <span style={{ fontSize:16 }}>★</span>
                          <span style={{ fontWeight:900, fontSize:14, color:"#f59e0b" }}>FAVORITES</span>
                          <span style={{ fontSize:11, background:"#f59e0b22", color:"#f59e0b", padding:"2px 8px", borderRadius:99, fontWeight:800, border:"1px solid #f59e0b44" }}>{favoritedGames.length}</span>
                          <div style={{ flex:1, height:1, background:`linear-gradient(90deg, #f59e0b44, transparent)` }} />
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(178px, 1fr))", gap:12 }}>
                          {favoritedGames.map(g=><GameCard key={g.id} game={g} platform={g.platform} t={t} onOpen={handleOpen} fire={fire} dlProg={dlProg[g.id]} isFavorite={true} onFavorite={toggleFavorite} />)}
                        </div>
                      </div>
                    )}
                    {/* ── Platform sections ──────────────────────────────── */}
                    {connectedPlats.map(plat=>{
                      const games=filtered.filter(g=>g.platform.id===plat.id);
                      if(games.length===0) return null;
                      return(
                        <div key={plat.id} style={{ marginBottom:28 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                            <div style={{ width:26, height:26, borderRadius:6, background:plat.bg, display:"flex", alignItems:"center", justifyContent:"center", border:`1px solid ${plat.accent}40` }}><PlatLogo pid={plat.id} size={16} /></div>
                            <span style={{ fontWeight:900, fontSize:13 }}>{plat.name}</span>
                            <span style={{ fontSize:9, background:`${plat.accent}18`, color:plat.accent, padding:"2px 8px", borderRadius:99, fontWeight:800, border:`1px solid ${plat.accent}30` }}>{games.filter(g=>g.downloaded).length}/{games.length}</span>
                            <div style={{ flex:1, height:1, background:`linear-gradient(90deg, ${t.border}, transparent)` }} />
                          </div>
                          {games.length===0?<div style={{ color:t.sub, fontSize:11, padding:"8px 0" }}>No games match</div>:(
                            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(178px, 1fr))", gap:12 }}>
                              {games.map(g=><GameCard key={g.id} game={g} platform={plat} t={t} onOpen={handleOpen} fire={fire} dlProg={dlProg[g.id]} isFavorite={favorites.includes(g.id)} onFavorite={toggleFavorite} />)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )
              ):(
                filtered.length===0&&platFilter==='custom'?(
                  <div style={{ textAlign:'center', padding:'60px 0', color:t.sub }}>
                    <div style={{ fontSize:42, marginBottom:12 }}>🎮</div>
                    <div style={{ fontSize:15, fontWeight:700, color:t.text, marginBottom:6 }}>No custom games yet</div>
                    <div style={{ fontSize:12, marginBottom:18 }}>Click "+ ADD GAME" above to add any game from your PC</div>
                    <button onClick={()=>setAddGameModal(true)} style={{ background:'#a78bfa22', border:'1px solid #a78bfa50', color:'#a78bfa', padding:'10px 22px', borderRadius:9, cursor:'pointer', fontWeight:800, fontSize:12 }}>+ Add Your First Game</button>
                  </div>
                ):(
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(178px, 1fr))", gap:12 }}>
                    {filtered.map(g=><GameCard key={g.id} game={g} platform={g.platform} t={t} onOpen={handleOpen} fire={fire} dlProg={dlProg[g.id]} isFavorite={favorites.includes(g.id)} onFavorite={toggleFavorite} />)}
                  </div>
                )
              )}
            </>
          )}

          {tab==="platforms"&&(
            <>
              <div style={{ fontSize:16, fontWeight:900, letterSpacing:"1px", marginBottom:16 }}>ALL PLATFORMS</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 }}>
                {PLATFORMS.map((p,idx)=>{
                  const isConn=connected[p.id],loading=signingIn===p.id;
                  const lib=libData[p.id]||[],inst=lib.filter(g=>g.downloaded).length;
                  const gbUsed=lib.filter(g=>g.downloaded).reduce((a,g)=>a+parseFloat(g.size),0).toFixed(0);
                  return(
                    <div key={p.id} style={{ background:isConn?`linear-gradient(145deg, ${p.color}55, ${t.card})`:t.card, border:`1px solid ${isConn?p.accent+"50":t.border}`, borderRadius:14, padding:18, boxShadow:isConn?`0 4px 28px ${p.color}30`:"none", animation:`fadeUp 0.4s ease ${idx*0.04}s both` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
                        <div style={{ width:52, height:52, borderRadius:12, background:p.bg, display:"flex", alignItems:"center", justifyContent:"center", border:`1px solid ${p.accent}40`, boxShadow:isConn?`0 0 22px ${p.color}70`:"none" }}><PlatLogo pid={p.id} size={30} /></div>
                        <div><div style={{ fontWeight:900, fontSize:15, color:t.text }}>{p.name}</div><div style={{ fontSize:11, fontWeight:700, color:isConn?"#22c55e":t.sub }}>{loading?"Connecting...":isConn?"✓ CONNECTED":"NOT LINKED"}</div></div>
                      </div>
                      {isConn&&<div style={{ marginBottom:14 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:t.sub, marginBottom:5, fontWeight:800, letterSpacing:"1px" }}><span>INSTALLED</span><span style={{ color:p.accent }}>{inst} / {lib.length}</span></div>
                        <div style={{ height:4, background:t.border, borderRadius:99, overflow:"hidden" }}><div style={{ height:"100%", width:`${lib.length>0?(inst/lib.length)*100:0}%`, background:`linear-gradient(90deg, ${p.accent}70, ${p.accent})`, borderRadius:99 }} /></div>
                        <div style={{ fontSize:9, color:t.sub, marginTop:3 }}>{gbUsed} GB used</div>
                      </div>}
                      {isConn?(
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          <button onClick={e=>{const r=e.currentTarget.getBoundingClientRect();fire(r.left+r.width/2,r.top+r.height/2,p.accent);setPlatFilter(p.id);setTab("library");}} style={{ width:"100%", background:`${p.accent}18`, border:`1px solid ${p.accent}45`, color:p.accent, padding:"9px", borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11 }}>▶ VIEW LIBRARY</button>
                          {p.id==='custom'&&<button onClick={()=>setAddGameModal(true)} style={{ width:"100%", background:'#a78bfa18', border:'1px solid #a78bfa45', color:'#a78bfa', padding:"8px", borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11 }}>+ Add Game</button>}
                          {['epic','ubisoft','curseforge'].includes(p.id) && (
                            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                              <button onClick={()=>handleSetPath(p.id)} style={{ flex:1, background:needsPath[p.id]?`${p.accent}30`:t.card, border:`1px solid ${needsPath[p.id]?p.accent+"80":t.border}`, color:needsPath[p.id]?p.accent:t.sub, padding:"7px 10px", borderRadius:7, cursor:"pointer", fontWeight:700, fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                                📁 {customPaths[p.id] ? 'Change Path' : 'Set Game Path'}
                              </button>
                              {customPaths[p.id] && <div style={{ fontSize:9, color:t.sub, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={customPaths[p.id]}>…{customPaths[p.id].split(/[/\\]/).slice(-2).join('/')}</div>}
                            </div>
                          )}
                          {needsPath[p.id] && <div style={{ fontSize:11, color:"#f97316", textAlign:"center" }}>⚠ Click "Set Game Path" to load your library</div>}
                        </div>
                      ):(
                        <button onClick={e=>handleConnect(p,e)} disabled={loading} style={{ width:"100%", background:p.bg, border:`1px solid ${p.accent}45`, color:p.accent, padding:"10px", borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:11, opacity:loading?0.6:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                          <PlatLogo pid={p.id} size={16} />{loading?"CONNECTING...":`SIGN IN TO ${p.name.toUpperCase()}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab==="store"&&(
            <>
              <div style={{ fontSize:18, fontWeight:900, letterSpacing:"1px", marginBottom:6 }}>PLATFORM STORES</div>
              <div style={{ fontSize:13, color:t.sub, marginBottom:18 }}>Click any store to open it directly in the launcher app.</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(270px, 1fr))", gap:12 }}>
                {PLATFORMS.filter(p=>PLATFORM_SHOPS[p.id]).map((p,idx)=>(
                  <button key={p.id} onClick={()=>window.electronAPI?.launchGame(PLATFORM_SHOPS[p.id])}
                    style={{ background:`linear-gradient(145deg, ${p.color}66, ${t.card})`, border:`1px solid ${connected[p.id]?p.accent+"55":t.border}`, borderRadius:14, padding:"16px 18px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:14, transition:"all 0.2s", animation:`fadeUp 0.35s ease ${idx*0.04}s both` }}
                    onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${p.accent}99`;e.currentTarget.style.transform="translateY(-3px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${connected[p.id]?p.accent+"55":t.border}`;e.currentTarget.style.transform="none";}}>
                    <div style={{ width:52, height:52, borderRadius:12, background:p.bg, display:"flex", alignItems:"center", justifyContent:"center", border:`1px solid ${p.accent}40`, flexShrink:0, boxShadow:connected[p.id]?`0 0 18px ${p.color}60`:"none" }}>
                      <PlatLogo pid={p.id} size={30} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:900, fontSize:15, color:t.text, marginBottom:3 }}>{p.name}</div>
                      <div style={{ fontSize:13, color:p.accent, fontWeight:700 }}>Open Store ↗</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </main>
        {showDiscord&&<DiscordPanel t={t} onClose={()=>setShowDiscord(false)} notifs={discordNotifs} botConnected={botConnected} guildData={botGuildData} presences={botPresences} voiceStates={botVoiceStates} onBotConnect={handleBotConnect} onBotDisconnect={handleBotDisconnect} />}
      </div>

      {modal&&<GameModal game={modal.game} platform={modal.platform} t={t} onClose={()=>setModal(null)} fire={fire} onDownload={handleDownload} onRemove={handleRemoveCustomGame} />}
      {addGameModal&&<AddCustomGameModal t={t} onClose={()=>setAddGameModal(false)} onAdd={handleAddCustomGame} />}
      {!splashDone&&<SplashScreen scanPhase={scanPhase} onComplete={()=>setSplashDone(true)} />}

      <style>{`
        @keyframes burst { to { transform:translate(var(--tx),var(--ty)) scale(0); opacity:0; } }
        @keyframes ring { to { transform:scale(5); opacity:0; } }
        @keyframes flash { to { transform:scale(3); opacity:0; } }
        @keyframes ripple { to { transform:translate(-50%,-50%) scale(1); opacity:0; } }
        @keyframes slideRight { from { transform:translateX(100%); } to { transform:none; } }
        @keyframes dropDown { from { transform:translateY(-8px) scale(0.95); opacity:0; } to { transform:none; opacity:1; } }
        @keyframes toastPop { from { transform:translateX(50px) scale(0.85); opacity:0; } to { transform:none; opacity:1; } }
        @keyframes fadeUp { from { transform:translateY(14px); opacity:0; } to { transform:none; opacity:1; } }
        @keyframes floatIcon { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-14px) rotate(2deg)} }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes modalPop { from { transform:scale(0.88) translateY(24px); opacity:0; } to { transform:none; opacity:1; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${t.border}; border-radius:99px; }
        button, input { font-family:inherit; }
        a { color:inherit; }
      `}</style>
    </div>
  );
}
