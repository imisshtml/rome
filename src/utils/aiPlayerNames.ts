/** Fun display names for AI seats — unique per game, stable in lobby previews. */

const AI_NAME_POOL = [
  'Maximus Deckius',
  'Agrippina the Acquisitive',
  'Brutus McBackstab',
  'Cassius the Calculating',
  'Centurion Coinclutcher',
  'Senator Grumplius',
  'Tribune Vexatious',
  'Livia the Ruthless',
  'Oracle of Overbuy',
  'Marcus Marginally Competent',
  'Flavia FastHands',
  'Gaius GalleryGoblin',
  'Pompey the Patient',
  'Scipio SortsByCost',
  'Hannibal Handsize',
  'Spartacus Shuffle',
  'Cicero the Chatterbox',
  'Aurelius the Anxious',
  'Vespasian VP Hunt',
  'Domitian Discards',
  'Belisarius Bandwagon',
  'Attila the Aggro',
  'Merlin MarketMage',
  'Morgana Mill',
  'Arthur ArenaKing',
  'Lancelot Legionnaire',
  'Guinevere Gold',
  'Mordred MainPhase',
  'Robin Hood Hand',
  'Blackbeard BlackMarket',
  'One-Eyed Olga',
  'Grunk the Grumpy',
  'Bjorn BigBuy',
  'Astrid ArenaAce',
  'Sigrid Saboteuse',
  'Alfred the Allocator',
  'Lady MacDeck',
  'Hamlet Hesitates',
  'Iago Instigator',
  'Falstaff FatStacks',
  'Joan of Arcana',
  'Saladin Silver',
  'Genghis GalleryRaid',
  'Cleopatra Counterspell',
  'Nero the Nervous',
  'Constantine the Coinflipper',
  'Vercingetorix Valor',
  'Boudica BitesBack',
  'Elagabalus Epic Hunter',
  'Pegleg Pete VP',
  'Helga Handwavy',
  'Tybalt TrashTalk',
  'Portia Playmat',
  'Shylock Silver',
  'Harold Harefoot Handsize',
  'William the Conqueror Coin',
  'Ethelred the Unready Deck',
  'Captain Redbeard Recruit',
  'Little John Junk',
  'Friar Tuck Tax',
  'Trajan Tribune',
  'Hadrian Hoarder',
  'Commodus CommitsThree',
  'Diocletian DrawsFive',
  'Septimius Saboteur',
  'Caracalla Copper',
  'Justinian JunkDeck',
  'Charlemagne Challenged',
  'Roland RecruitRush',
  'Richard Lionhearted Buy',
  'The Praetor of Pass',
  'Gladiator Glimpse',
  'Titus the Tenacious',
  'Antoninus ArenaBound',
  'Caligula Cache',
  'Boudicca Burn',
  'Ophelia Overcommits',
  'Othello Overkill',
  'Macbeth Main',
  'Astrid the Arena Ace',
  'Decimus the Doubtful',
  'Flavius FactionFlip',
  'Valeria ValorStack',
  'Quintus QuickBuy',
  'Servilia Saboteur',
  'Cornelia CopperCount',
  'Drusus DeckDoctor',
  'Fabia the Favor Hunter',
  'Horatius HandLimit',
  'Julia JunkDrawer',
  'Lucius Legion Loyalist',
  'Octavia Overbuilder',
  'Publius Pile Shuffler',
  'Regulus Recruit Rush',
  'Silvia Silver Stacker',
  'Tiberius Trash Talker',
  'Ulpia Underbuyer',
  'Vibius VP Vulture',
  'Xenia Xenial Xenophobe',
  'Yorick Yard Sale',
  'Zeno Zero Sum',
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Lobby preview — same name for a seat until the game starts. */
export function previewAiNameForSeat(gameKey: string, seatIndex: number): string {
  const key = `${gameKey || 'lobby'}:${seatIndex}`;
  const idx = hashString(key) % AI_NAME_POOL.length;
  return AI_NAME_POOL[idx];
}

/** Pick distinct AI names, avoiding human names already at the table. */
export function pickAiDisplayNames(
  count: number,
  reserved: Iterable<string> = []
): string[] {
  if (count <= 0) return [];

  const taken = new Set<string>();
  for (const name of reserved) {
    taken.add(normalizeName(name));
  }

  const available = AI_NAME_POOL.filter((name) => !taken.has(normalizeName(name)));
  const shuffled = shuffle(available);
  const picked: string[] = [];

  for (let i = 0; i < count; i++) {
    if (i < shuffled.length) {
      picked.push(shuffled[i]);
      taken.add(normalizeName(shuffled[i]));
      continue;
    }
    const fallback = `${shuffled[i % Math.max(shuffled.length, 1)] ?? 'Bot'} #${i + 1}`;
    picked.push(fallback);
    taken.add(normalizeName(fallback));
  }

  return picked;
}

export function pickOneAiDisplayName(reserved: Iterable<string> = []): string {
  return pickAiDisplayNames(1, reserved)[0] ?? AI_NAME_POOL[0];
}
