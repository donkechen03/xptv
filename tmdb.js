/* XPTV TMDB 影视发现 V1.0 - 仅影视资料，不提供正片播放。
 * 在 XPTV -> 本源配置 -> 自定义配置填写：{"api_key":"YOUR_TMDB_V3_KEY"}
 * 或 {"token":"YOUR_TMDB_V4_READ_ACCESS_TOKEN"}。不要将密钥提交到公共仓库。
 */
const TMDB_BASE = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const GENRES = [
  ['全部', 'all'], ['动作', '28'], ['冒险', '12'], ['动画', '16'],
  ['喜剧', '35'], ['犯罪', '80'], ['纪录', '99'], ['剧情', '18'],
  ['家庭', '10751'], ['奇幻', '14'], ['恐怖', '27'], ['悬疑', '9648'],
  ['爱情', '10749'], ['科幻', '878'], ['惊悚', '53'], ['战争', '10752']
];
const TV_GENRES = [
  ['全部', 'all'], ['动作冒险', '10759'], ['动画', '16'], ['喜剧', '35'],
  ['犯罪', '80'], ['纪录', '99'], ['剧情', '18'], ['家庭', '10751'],
  ['悬疑', '9648'], ['科幻奇幻', '10765'], ['战争政治', '10768']
];
const REGIONS = [['全部', 'all'], ['美国', 'US'], ['英国', 'GB'], ['中国', 'CN'], ['韩国', 'KR'], ['日本', 'JP'], ['西班牙', 'ES'], ['法国', 'FR']];
const TABS = [
  { name: '即将上映电影', ext: { id: 'movie_upcoming' } },
  { name: '全球期待电影', ext: { id: 'movie_anticipated' } },
  { name: '本月新电影', ext: { id: 'movie_this_month' } },
  { name: '下月新电影', ext: { id: 'movie_next_month' } },
  { name: '即将开播新剧', ext: { id: 'tv_upcoming' } },
  { name: '近期新剧', ext: { id: 'tv_recent' } },
  { name: '热门剧集', ext: { id: 'tv_popular' } },
  { name: '2027年电影', ext: { id: 'movie_year_2027' } },
  { name: '2028年电影', ext: { id: 'movie_year_2028' } }
];
function safeParse(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v !== 'string' || !v.trim()) return {};
  try { return JSON.parse(v); } catch (_) {
    try { return typeof argsify === 'function' ? argsify(v) || {} : {}; } catch (__) { return {}; }
  }
}
function config() {
  let cfg = {};
  try { cfg = safeParse(typeof $config_str === 'undefined' ? '' : $config_str); } catch (_) {}
  return cfg || {};
}
function fmt(d) { return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); }
function plusDays(date, n) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + n); return fmt(d); }
function monthRange(delta) {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const end = new Date(d.getFullYear(), d.getMonth() + delta + 1, 0);
  return [fmt(start), fmt(end)];
}
function params(obj) { return Object.keys(obj).filter(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(obj[k]))).join('&'); }
async function tmdb(path, query) {
  const c = config();
  const apiKey = c.api_key || c.apiKey || '';
  const token = c.token || c.access_token || '';
  if (!apiKey && !token) throw Error('尚未配置 TMDB API Key。请在影视源自定义配置中填写 {"api_key":"你的V3密钥"}');
  const url = TMDB_BASE + path + '?' + params(Object.assign({ language: 'zh-CN' }, query || {}, apiKey ? { api_key: apiKey } : {}));
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await $fetch.get(url, { headers });
  let result = safeParse(response && response.data !== undefined ? response.data : response);
  if (result && result.success === false) throw Error(result.status_message || 'TMDB 请求失败');
  return result;
}
function filterSpec(isTV, includeSort) {
  const filters = [
    { key: 'genre', name: '类型', init: 'all', value: (isTV ? TV_GENRES : GENRES).map(x => ({ n: x[0], v: x[1] })) },
    { key: 'region', name: '制作地区', init: 'all', value: REGIONS.map(x => ({ n: x[0], v: x[1] })) }
  ];
  if (includeSort) filters.push({ key: 'order', name: '排序', init: 'popularity.desc', value: [
    { n: '热度优先', v: 'popularity.desc' },
    { n: '日期从近到远', v: isTV ? 'first_air_date.asc' : 'primary_release_date.asc' },
    { n: '日期从远到近', v: isTV ? 'first_air_date.desc' : 'primary_release_date.desc' }
  ] });
  return filters;
}
function card(item, isTV) {
  const title = (isTV ? item.name || item.original_name : item.title || item.original_title) || '未命名';
  const date = isTV ? item.first_air_date : item.release_date;
  return {
    vod_id: (isTV ? 'tv:' : 'movie:') + item.id,
    vod_name: title,
    vod_pic: item.poster_path ? POSTER_BASE + item.poster_path : '',
    vod_remarks: date || '尚未定档',
    ext: { id: String(item.id), media_type: isTV ? 'tv' : 'movie' }
  };
}
async function getConfig() {
  return jsonify({ ver: 1, title: 'TMDB 影视发现 · 仅资讯', site: 'https://www.themoviedb.org', tabs: TABS });
}
async function getCards(ext) {
  const e = safeParse(ext);
  const id = String(e.id || 'movie_upcoming');
  const isTV = id.startsWith('tv_');
  const filters = e.filters || {};
  const page = Math.max(1, Math.min(500, Number(e.page) || 1));
  const now = new Date();
  const today = fmt(now);
  const query = { page, include_adult: false, sort_by: 'popularity.desc' };
  let start, end;
  if (id === 'movie_upcoming') { start = today; end = plusDays(now, 90); }
  else if (id === 'movie_anticipated') { start = today; end = plusDays(now, 730); }
  else if (id === 'movie_this_month') { [start, end] = monthRange(0); }
  else if (id === 'movie_next_month') { [start, end] = monthRange(1); }
  else if (id === 'tv_upcoming') { start = today; end = plusDays(now, 90); }
  else if (id === 'tv_recent') { start = plusDays(now, -30); end = today; }
  else if (id === 'movie_year_2027') { start = '2027-01-01'; end = '2027-12-31'; }
  else if (id === 'movie_year_2028') { start = '2028-01-01'; end = '2028-12-31'; }
  if (start && end) {
    if (isTV) { query['first_air_date.gte'] = start; query['first_air_date.lte'] = end; }
    else { query['primary_release_date.gte'] = start; query['primary_release_date.lte'] = end; }
  }
  if (isTV && id !== 'tv_popular') query['with_status'] = '0'; // 0: Returning Series; avoid overly restrictive future statuses below
  delete query.with_status;
  if (isTV && id !== 'tv_popular') query['with_type'] = '2'; // Scripted; exclude reality/news (TMDB TV type 2 = Scripted)
  if (filters.genre && filters.genre !== 'all' && (isTV ? TV_GENRES : GENRES).some(x => x[1] === filters.genre)) query.with_genres = filters.genre;
  if (filters.region && filters.region !== 'all' && REGIONS.some(x => x[1] === filters.region)) query.with_origin_country = filters.region;
  if (filters.order && ['popularity.desc', isTV ? 'first_air_date.asc' : 'primary_release_date.asc', isTV ? 'first_air_date.desc' : 'primary_release_date.desc'].includes(filters.order)) query.sort_by = filters.order;
  if (!start) query.sort_by = 'popularity.desc';
  try {
    const data = await tmdb(isTV ? '/discover/tv' : '/discover/movie', query);
    return jsonify({ list: (Array.isArray(data.results) ? data.results : []).map(x => card(x, isTV)), filter: filterSpec(isTV, Boolean(start)) });
  } catch (err) {
    try { $print('[TMDB] getCards: ' + String(err)); } catch (_) {}
    try { $utils.toastError(String(err.message || err)); } catch (_) {}
    return jsonify({ list: [], filter: filterSpec(isTV, Boolean(start)) });
  }
}
async function getTracks(ext) {
  const e = safeParse(ext);
  const type = e.media_type === 'tv' ? 'tv' : 'movie';
  const id = String(e.id || '').replace(/[^0-9]/g, '');
  if (!id) return jsonify({ list: [] });
  try {
    const data = await tmdb('/' + type + '/' + id, { append_to_response: 'credits,videos' });
    const year = (data.release_date || data.first_air_date || '').slice(0, 10) || '未定档';
    const genres = (data.genres || []).map(x => x.name).join('/');
    const actors = ((data.credits && data.credits.cast) || []).slice(0, 5).map(x => x.name).join('、');
    const overview = data.overview || '暂无中文简介';
    const info = [year, genres, actors ? '主演：' + actors : '', overview].filter(Boolean).join(' · ');
    // XPTV 文档仅明确规定 getTracks 返回播放列表；作为资讯源不伪造播放地址。
    // XPTV 是否在详情界面读取下列 vod_* 元数据需实际验证。
    return jsonify({
      vod_id: type + ':' + id,
      vod_name: data.title || data.name || data.original_title || data.original_name || '',
      vod_pic: data.poster_path ? POSTER_BASE + data.poster_path : '',
      vod_remarks: year,
      vod_content: overview,
      vod_actor: actors,
      vod_class: genres,
      vod_year: year.slice(0, 4),
      list: [],
      info: info
    });
  } catch (err) {
    try { $print('[TMDB] getTracks: ' + String(err)); } catch (_) {}
    return jsonify({ list: [] });
  }
}
async function getPlayinfo(_ext) { return jsonify({ urls: [] }); }
async function search(ext) {
  const e = safeParse(ext);
  const keyword = String(e.keyword || e.wd || e.text || e.query || e.name || '').trim();
  if (!keyword) return jsonify({ list: [] });
  try {
    const data = await tmdb('/search/multi', { query: keyword, page: Math.max(1, Number(e.page) || 1), include_adult: false });
    return jsonify({ list: (data.results || []).filter(x => x.media_type === 'movie' || x.media_type === 'tv').map(x => card(x, x.media_type === 'tv')) });
  } catch (err) {
    try { $print('[TMDB] search: ' + String(err)); } catch (_) {}
    return jsonify({ list: [] });
  }
}
