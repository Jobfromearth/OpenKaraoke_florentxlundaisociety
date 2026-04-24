import type { PhoneticLang } from './types'

export type UILang = 'zh' | 'en' | 'sv'

export interface Translations {
  appTitle: string
  appSubtitle: string
  songLanguageLabel: string
  phoneticLanguageLabel: string
  uiLanguageLabel: string
  loadingLyrics: string
  errorLyricsNotFound: string
  errorLoadFailed: string
  errorPhoneticsFailed: string
  searchPlaceholder: string
  searchButton: string
  searchingButton: string
  searchError: string
  backToHome: string
  loading: string
  songLoadError: string
  showPhonetic: string
  hidePhonetic: string
  showPhoneticLabel: string
  hidePhoneticLabel: string
  showTranslation: string
  hideTranslation: string
  loopLabel: string
  exitLoop: string
  phoneticLangs: Record<PhoneticLang, string>
  songLanguages: Record<string, string>
  mixer: string
  mixerHeadphone: string
  mixerMicSection: string
  mixerMicVolume: string
  mixerReverb: string
  mixerEcho: string
  mixerMonitorOn: string
  mixerMonitorOff: string
  mixerTrend: string
  mixerRecordSection: string
  mixerRecordNote: string
  mixerStartRecording: string
  mixerStopRecording: string
  mixerDownload: string
}

export const translations: Record<UILang, Translations> = {
  zh: {
    appTitle: 'OpenKaraoke',
    appSubtitle: '搜索歌曲，查看歌词音译，单句循环练习',
    songLanguageLabel: '歌曲语言',
    phoneticLanguageLabel: '音译语言',
    phoneticLangs: { zh: '中文', en: '英语', ja: '日语', sv: '瑞典语' },
    uiLanguageLabel: '界面语言',
    loadingLyrics: '正在获取歌词并生成音译，请稍候（约10-30秒）...',
    errorLyricsNotFound: '未找到该歌曲的歌词，请尝试其他版本',
    errorLoadFailed: '加载失败，请重试',
    errorPhoneticsFailed: '音译生成失败（结果为空），请重试或换一首歌',
    searchPlaceholder: '搜索歌曲名 / 歌手...',
    searchButton: '搜索',
    searchingButton: '搜索中...',
    searchError: '搜索失败，请重试',
    backToHome: '返回首页',
    loading: '加载中...',
    songLoadError: '歌曲加载失败',
    showPhonetic: '显示音译',
    hidePhonetic: '隐藏音译',
    showPhoneticLabel: '显示音译',
    hidePhoneticLabel: '隐藏音译',
    showTranslation: '显示翻译',
    hideTranslation: '隐藏翻译',
    loopLabel: '单句循环：',
    exitLoop: '退出循环',
    songLanguages: { en: '英语', ja: '日语', ko: '韩语', es: '西班牙语', sv: '瑞典语', zh: '中文' },
    mixer: '调音台',
    mixerHeadphone: '建议戴耳机',
    mixerMicSection: '麦克风',
    mixerMicVolume: '麦克风音量',
    mixerReverb: '混响',
    mixerEcho: '回声',
    mixerMonitorOn: '监听：开',
    mixerMonitorOff: '监听：关',
    mixerTrend: '实时走势',
    mixerRecordSection: '录音',
    mixerRecordNote: '需选择"共享标签页音频"',
    mixerStartRecording: '开始录音',
    mixerStopRecording: '停止录音',
    mixerDownload: '下载录音',
  },
  en: {
    appTitle: 'OpenKaraoke',
    appSubtitle: 'Search songs, view phonetic lyrics, practise line by line',
    songLanguageLabel: 'Song language',
    phoneticLanguageLabel: 'Phonetics',
    phoneticLangs: { zh: 'Chinese', en: 'English', ja: 'Japanese', sv: 'Swedish' },
    uiLanguageLabel: 'Language',
    loadingLyrics: 'Fetching lyrics and generating phonetics, please wait (~10–30s)…',
    errorLyricsNotFound: 'No lyrics found for this song, try another version',
    errorLoadFailed: 'Failed to load, please try again',
    errorPhoneticsFailed: 'Phonetics generation returned empty results, please retry or try another song',
    searchPlaceholder: 'Search song / artist…',
    searchButton: 'Search',
    searchingButton: 'Searching…',
    searchError: 'Search failed, please try again',
    backToHome: 'Back to Home',
    loading: 'Loading…',
    songLoadError: 'Failed to load song',
    showPhonetic: 'Show phonetics',
    hidePhonetic: 'Hide phonetics',
    showPhoneticLabel: 'Show phonetics',
    hidePhoneticLabel: 'Hide phonetics',
    showTranslation: 'Show translation',
    hideTranslation: 'Hide translation',
    loopLabel: 'Loop: ',
    exitLoop: 'Exit loop',
    songLanguages: { en: 'English', ja: 'Japanese', ko: 'Korean', es: 'Spanish', sv: 'Swedish', zh: 'Chinese' },
    mixer: 'Mixer',
    mixerHeadphone: 'Wear headphones',
    mixerMicSection: 'Microphone',
    mixerMicVolume: 'Mic volume',
    mixerReverb: 'Reverb',
    mixerEcho: 'Echo',
    mixerMonitorOn: 'Monitor: On',
    mixerMonitorOff: 'Monitor: Off',
    mixerTrend: 'Live pitch',
    mixerRecordSection: 'Recording',
    mixerRecordNote: 'Select "Share tab audio"',
    mixerStartRecording: 'Start recording',
    mixerStopRecording: 'Stop recording',
    mixerDownload: 'Download',
  },
  sv: {
    appTitle: 'OpenKaraoke',
    appSubtitle: 'Sök låtar, visa fonetik, öva rad för rad',
    songLanguageLabel: 'Låtspråk',
    phoneticLanguageLabel: 'Fonetik',
    phoneticLangs: { zh: 'Kinesiska', en: 'Engelska', ja: 'Japanska', sv: 'Svenska' },
    uiLanguageLabel: 'Språk',
    loadingLyrics: 'Hämtar texter och genererar fonetik, vänta (~10–30s)…',
    errorLyricsNotFound: 'Inga texter hittades för denna låt, prova en annan version',
    errorLoadFailed: 'Det gick inte att ladda, försök igen',
    errorPhoneticsFailed: 'Fonetikgenerering returnerade tomma resultat, försök igen eller välj en annan låt',
    searchPlaceholder: 'Sök låt / artist…',
    searchButton: 'Sök',
    searchingButton: 'Söker…',
    searchError: 'Sökning misslyckades, försök igen',
    backToHome: 'Tillbaka till startsidan',
    loading: 'Laddar…',
    songLoadError: 'Det gick inte att ladda låten',
    showPhonetic: 'Visa fonetik',
    hidePhonetic: 'Dölj fonetik',
    showPhoneticLabel: 'Visa fonetik',
    hidePhoneticLabel: 'Dölj fonetik',
    showTranslation: 'Visa översättning',
    hideTranslation: 'Dölj översättning',
    loopLabel: 'Slinga: ',
    exitLoop: 'Avsluta slinga',
    songLanguages: { en: 'Engelska', ja: 'Japanska', ko: 'Koreanska', es: 'Spanska', sv: 'Svenska', zh: 'Kinesiska' },
    mixer: 'Mixer',
    mixerHeadphone: 'Använd hörlurar',
    mixerMicSection: 'Mikrofon',
    mixerMicVolume: 'Mikvolym',
    mixerReverb: 'Reverb',
    mixerEcho: 'Eko',
    mixerMonitorOn: 'Monitor: På',
    mixerMonitorOff: 'Monitor: Av',
    mixerTrend: 'Tonhöjd live',
    mixerRecordSection: 'Inspelning',
    mixerRecordNote: 'Välj "Dela flik-ljud"',
    mixerStartRecording: 'Starta inspelning',
    mixerStopRecording: 'Stoppa inspelning',
    mixerDownload: 'Ladda ner',
  },
}
