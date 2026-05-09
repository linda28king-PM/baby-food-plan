/* ============================================
   Storage & Share
   状态管理：本地存储 + URL 分享编码
   ============================================ */

const STORAGE_KEY = 'baby_food_data_v1';

// ============ 默认数据结构 ============
function emptyState() {
  return {
    baby: null, // { name, birthday: 'YYYY-MM-DD', gender: 'boy'|'girl'|'', feeding: 'breast'|'formula'|'mixed' }
    triedFoods: [], // 食材名数组
    observations: [], // [{ food, startDate: 'YYYY-MM-DD', days: ['ok'|'bad'|null, ...] }]
  };
}

// ============ 本地存储 ============
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    return Object.assign(emptyState(), data);
  } catch (e) {
    return emptyState();
  }
}

function saveLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('保存失败', e);
  }
}

// ============ URL 编码（用于分享） ============
// 用一个简单的 base64 编码：UTF-8 → base64
function encodeState(state) {
  try {
    const json = JSON.stringify(state);
    // UTF-8 安全的 base64
    const utf8 = unescape(encodeURIComponent(json));
    const b64 = btoa(utf8);
    // URL 安全：替换 +/= 
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    return '';
  }
}

function decodeState(encoded) {
  try {
    // 还原 URL 安全字符
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // 补齐 =
    while (b64.length % 4) b64 += '=';
    const utf8 = atob(b64);
    const json = decodeURIComponent(escape(utf8));
    const data = JSON.parse(json);
    return Object.assign(emptyState(), data);
  } catch (e) {
    console.warn('解码失败', e);
    return null;
  }
}

// ============ 从 URL 加载（如果有分享数据） ============
function loadFromURL() {
  const hash = window.location.hash;
  const search = window.location.search;
  let encoded = null;

  // 优先 hash（不会被服务器记录）
  if (hash.startsWith('#d=')) {
    encoded = hash.slice(3);
  } else if (search.includes('d=')) {
    const params = new URLSearchParams(search);
    encoded = params.get('d');
  }

  if (!encoded) return null;
  return decodeState(encoded);
}

// ============ 生成分享链接 ============
function generateShareURL(state) {
  const encoded = encodeState(state);
  const base = window.location.origin + window.location.pathname;
  return base + '#d=' + encoded;
}

// ============ 清除 URL 中的数据参数 ============
function clearURLData() {
  const url = window.location.origin + window.location.pathname;
  window.history.replaceState({}, '', url);
}

// 导出
window.Storage = {
  emptyState,
  loadLocal,
  saveLocal,
  loadFromURL,
  generateShareURL,
  encodeState,
  decodeState,
  clearURLData,
};
