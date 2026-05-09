/* ============================================
   宝宝辅食计划 - 主应用
   ============================================ */

// ============ 全局状态 ============
let state = Storage.emptyState();
let currentTab = 'plan'; // plan | foods | allergy | tips
let selectedMonth = null; // 当前查看的月龄
let selectedDay = null; // 当前查看的星期：周一~周日 / 'all'(看一周)
let viewOnlyMode = false; // 仅查看模式（不写入本地）
let savedLocalState = null; // 仅查看模式下，保存原本地数据用于退出

// ============ 工具函数 ============
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(s) {
  if (!s) return null;
  const parts = s.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDate(d) {
  if (!d) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// 计算月龄（按完整月数，向下取整）
function calcMonthAge(birthday) {
  if (!birthday) return null;
  const b = parseDate(birthday);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  return Math.max(0, months);
}

// 月龄阶段：6,7,8,9,10,11,12
function getStageMonth(monthAge) {
  if (monthAge == null) return 9;
  if (monthAge < 6) return 6;
  if (monthAge >= 12) return 12;
  return monthAge;
}

// 根据出生日期算每个阶段的开始日
function stageStartDate(birthday, month) {
  if (!birthday) return null;
  const b = parseDate(birthday);
  const d = new Date(b.getFullYear(), b.getMonth() + month, b.getDate());
  return d;
}

// Toast 提示
let toastTimer = null;
function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ============ 保存 + 重渲染 ============
function persist() {
  if (viewOnlyMode) return; // 仅查看模式：不写入
  Storage.saveLocal(state);
}
function commit() {
  persist();
  render();
}

// ============ Modal 系统 ============
function openModal(html, onMount) {
  const overlay = $('#modal-overlay');
  $('#modal-content').innerHTML = html;
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  if (typeof onMount === 'function') onMount();
}
function closeModal() {
  $('#modal-overlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ============ 页面渲染 ============
function render() {
  renderBabyBar();
  renderTabs();
  renderMain();
}

// ---------- 顶部宝宝信息条 ----------
function renderBabyBar() {
  const bar = $('#baby-bar');
  if (!state.baby) {
    bar.className = 'baby-bar empty';
    bar.innerHTML = `
      <span class="text">+ 添加宝宝信息，获取专属辅食计划</span>
    `;
    bar.onclick = openBabyForm;
    return;
  }
  const age = calcMonthAge(state.baby.birthday);
  const ageStr = age != null ? `${age} 个月` : '';
  const genderStr = state.baby.gender === 'boy' ? '👦' : state.baby.gender === 'girl' ? '👧' : '👶';
  const feedingStr = {
    breast: '母乳', formula: '配方奶', mixed: '混合喂养'
  }[state.baby.feeding] || '';
  bar.className = 'baby-bar';
  bar.innerHTML = `
    <div class="avatar">${genderStr}</div>
    <div class="info">
      <div class="name">${escapeHtml(state.baby.name || '宝贝')}</div>
      <div class="meta">${ageStr} · ${feedingStr} · 已尝试 ${state.triedFoods.length} 种食材</div>
    </div>
    <div class="edit-icon">✎</div>
  `;
  bar.onclick = openBabyForm;
}

// ---------- Tab 导航 ----------
function renderTabs() {
  const tabs = $('#tabs');
  const items = [
    { key: 'plan', label: '辅食计划' },
    { key: 'foods', label: '已吃食材' },
    { key: 'allergy', label: '过敏观察' },
    { key: 'tips', label: '提醒' },
  ];
  tabs.innerHTML = items.map(it => `
    <button class="tab ${currentTab === it.key ? 'active' : ''}" data-tab="${it.key}">${it.label}</button>
  `).join('');
  $$('#tabs .tab').forEach(b => {
    b.onclick = () => { currentTab = b.dataset.tab; render(); };
  });
}

// ---------- 主区域路由 ----------
function renderMain() {
  const main = $('#main');
  if (currentTab === 'plan') main.innerHTML = renderPlan();
  else if (currentTab === 'foods') main.innerHTML = renderFoods();
  else if (currentTab === 'allergy') main.innerHTML = renderAllergy();
  else if (currentTab === 'tips') main.innerHTML = renderTips();
  attachMainEvents();
}

// ============================================
//  Tab: 辅食计划
// ============================================
function renderPlan() {
  const age = calcMonthAge(state.baby?.birthday);
  const currentStage = getStageMonth(age);
  // 首次进入：默认看当前月龄
  if (selectedMonth == null) selectedMonth = currentStage;
  if (selectedDay == null) selectedDay = 'all';

  const stage = FOOD_DATA.stages[selectedMonth];
  const months = [6, 7, 8, 9, 10, 11, 12];

  // 月龄选择
  let html = '';
  html += `
    <div class="section">
      <div class="section-title"><span class="icon-dot"></span>月龄阶段</div>
      <div class="stage-pills">
        ${months.map(m => {
          const isActive = m === selectedMonth;
          const isCurrent = m === currentStage && state.baby;
          return `<button class="stage-pill ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}" data-month="${m}">${m} 月${isCurrent ? ' · 现在' : ''}</button>`;
        }).join('')}
      </div>

      <div class="stage-header">
        <span class="stage-month">${stage.title}</span>
        ${state.baby ? `<span class="stage-period">${formatDate(stageStartDate(state.baby.birthday, selectedMonth))} 起</span>` : ''}
        <span class="stage-tag">${stage.name}</span>
      </div>
      <div class="stage-summary">
        <strong>目标：</strong>${stage.summary}
      </div>

      <div class="info-grid">
        <div class="info-item"><div class="label">奶量</div><div class="value">${stage.milkVolume}</div></div>
        <div class="info-item"><div class="label">辅食次数</div><div class="value">${stage.mealCount}</div></div>
        <div class="info-item"><div class="label">质地</div><div class="value" style="font-size:12px">${stage.texture}</div></div>
        <div class="info-item"><div class="label">阶段</div><div class="value">${stage.name}</div></div>
      </div>

      <div class="food-section">
        <div class="food-block-title">食材质地</div>
        <p style="font-size:13px; color:var(--text-soft); line-height:1.7;">${stage.textureDetail}</p>
      </div>

      <div class="food-section">
        <div class="food-block-title">本月新食材推荐</div>
        <div class="food-tags">
          ${FOOD_DATA.foods.filter(f => f.firstMonth === selectedMonth).map(f => {
            const tried = state.triedFoods.includes(f.name);
            return `<span class="food-tag new ${tried ? 'tried' : ''}" data-food="${escapeHtml(f.name)}" data-action="toggle-food">${escapeHtml(f.name)}</span>`;
          }).join('')}
        </div>
        <div class="tip-text">💡 ${stage.tip}</div>
      </div>

      <div class="food-section">
        <div class="food-block-title">建议的每日安排</div>
        <div class="schedule">
          ${stage.meals.map(m => `
            <div class="schedule-row">
              <div class="schedule-time"><span class="dot"></span>${escapeHtml(m.time)}</div>
              <div class="schedule-content">
                <span class="meal">${escapeHtml(m.name)}</span>
                <span class="detail">${escapeHtml(m.detail)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // 一周食谱
  const menu = FOOD_DATA.weeklyMenus[selectedMonth] || [];
  const days = ['all', ...menu.map(m => m.day)];

  html += `
    <div class="section">
      <div class="section-title"><span class="icon-dot"></span>一周食谱</div>
      <div class="day-selector">
        ${days.map(d => `
          <button class="day-pill ${selectedDay === d ? 'active' : ''}" data-day="${d}">${d === 'all' ? '一周' : d}</button>
        `).join('')}
      </div>
      <div class="week-grid">
        ${(selectedDay === 'all' ? menu : menu.filter(m => m.day === selectedDay)).map(m => `
          <div class="menu-day-card">
            <div class="day-label">${escapeHtml(m.day)}</div>
            ${m.breakfast ? `<div class="menu-meal"><span class="meal-label">早</span><span class="meal-content">${escapeHtml(m.breakfast)}</span></div>` : ''}
            ${m.lunch ? `<div class="menu-meal"><span class="meal-label">午</span><span class="meal-content">${escapeHtml(m.lunch)}</span></div>` : ''}
            ${m.dinner ? `<div class="menu-meal"><span class="meal-label">晚/加餐</span><span class="meal-content">${escapeHtml(m.dinner)}</span></div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 食物量参考
  html += `
    <div class="section">
      <div class="section-title"><span class="icon-dot"></span>每日食物量参考</div>
      <table class="quantity-table">
        <thead>
          <tr><th>食物类别</th><th>6-8 月</th><th>9-10 月</th><th>11-12 月</th></tr>
        </thead>
        <tbody>
          ${FOOD_DATA.quantityRef.map(r => `
            <tr><td>${r.item}</td><td>${r['6-8月']}</td><td>${r['9-10月']}</td><td>${r['11-12月']}</td></tr>
          `).join('')}
        </tbody>
      </table>
      <p style="font-size:11px; color:var(--text-mute); margin-top:10px; line-height:1.6;">
        参考《中国居民膳食指南》及国家卫健委《婴幼儿营养喂养评估服务指南》。
        实际量按宝宝胃口调整，重点在于<strong>种类丰富</strong>而非严格克数。
      </p>
    </div>
  `;

  return html;
}

// ============================================
//  Tab: 已吃食材管理
// ============================================
function renderFoods() {
  const allFoods = FOOD_DATA.foods;
  const grouped = {};
  Object.keys(CATEGORY_NAMES).forEach(c => grouped[c] = []);
  allFoods.forEach(f => {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  });

  let html = `
    <div class="section">
      <div class="section-title"><span class="icon-dot"></span>已尝试食材</div>
      <div class="section-subtitle">点食材标签即可标记 / 取消（共 ${allFoods.length} 种，已尝试 ${state.triedFoods.length} 种）</div>
  `;

  Object.keys(CATEGORY_NAMES).forEach(cat => {
    const list = grouped[cat] || [];
    if (list.length === 0) return;
    const triedCount = list.filter(f => state.triedFoods.includes(f.name)).length;
    html += `
      <div class="category-block">
        <div class="category-header">
          <span class="category-name">${CATEGORY_NAMES[cat]}</span>
          <span class="category-count">${triedCount} / ${list.length}</span>
        </div>
        <div class="food-tags">
          ${list.map(f => {
            const tried = state.triedFoods.includes(f.name);
            return `<span class="food-tag ${tried ? 'tried' : ''}" data-food="${escapeHtml(f.name)}" data-action="toggle-food" title="${escapeHtml(f.note || '')}">${escapeHtml(f.name)}<span style="opacity:0.5; font-size:10px; margin-left:4px;">${f.firstMonth}m+</span></span>`;
          }).join('')}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

// ============================================
//  Tab: 过敏观察
// ============================================
function renderAllergy() {
  const today = todayStr();

  let html = `
    <div class="section">
      <div class="section-title"><span class="icon-dot"></span>新食材过敏观察</div>
      <div class="section-subtitle">每加一种新食材，连续观察 2-3 天，确认无皮疹/腹泻/呕吐再加新的</div>
      <button class="btn btn-primary btn-block" data-action="add-observation">+ 开始观察一种新食材</button>
  `;

  // 分组：观察中、已完成、过敏
  const observing = state.observations.filter(o => !isObservationComplete(o) && !hasBadDay(o));
  const completed = state.observations.filter(o => isObservationComplete(o) && !hasBadDay(o));
  const warned = state.observations.filter(o => hasBadDay(o));

  if (state.observations.length === 0) {
    html += `
      <div class="empty-state">
        <div class="icon">🌱</div>
        <div class="text">还没有观察记录<br>新食材一定要观察 2-3 天哦</div>
      </div>
    `;
  }

  if (observing.length > 0) {
    html += `<div style="margin-top:18px; font-size:13px; font-weight:600; color:var(--accent-deep);">观察中（${observing.length}）</div>`;
    observing.forEach(o => html += renderObservationCard(o, today));
  }
  if (warned.length > 0) {
    html += `<div style="margin-top:18px; font-size:13px; font-weight:600; color:var(--red);">出现疑似过敏（${warned.length}）</div>`;
    warned.forEach(o => html += renderObservationCard(o, today));
  }
  if (completed.length > 0) {
    html += `<div style="margin-top:18px; font-size:13px; font-weight:600; color:var(--text-soft);">已完成（${completed.length}）</div>`;
    completed.forEach(o => html += renderObservationCard(o, today));
  }

  html += `</div>`;

  // 说明
  html += `
    <div class="section">
      <div class="section-title"><span class="icon-dot"></span>过敏反应识别</div>
      <ul class="tips-list">
        <li>常见反应：皮疹、湿疹加重、嘴周发红、眼睛肿、流涕</li>
        <li>消化反应：呕吐、腹泻、便血、严重肚胀</li>
        <li class="warn">紧急：呼吸困难、面部肿胀、嗜睡 → <strong>立即就医</strong></li>
        <li>大部分轻微反应停食后 1-2 天恢复，3-6 个月后可再尝试</li>
        <li>过敏家族史的宝宝，鸡蛋、鱼虾、坚果、芒果、猕猴桃等先少量试</li>
      </ul>
    </div>
  `;

  return html;
}

function isObservationComplete(o) {
  // 3天都标了 ok
  return o.days.filter(d => d === 'ok').length >= 3;
}
function hasBadDay(o) {
  return o.days.includes('bad');
}

function renderObservationCard(o, today) {
  const start = parseDate(o.startDate);
  const days = [0, 1, 2].map(i => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const isFuture = ds > today;
    const status = o.days[i] || null; // 'ok' | 'bad' | null
    return { idx: i, dateStr: `${d.getMonth() + 1}/${d.getDate()}`, isFuture, status };
  });

  const complete = isObservationComplete(o);
  const warned = hasBadDay(o);
  const cls = warned ? 'warn' : complete ? 'completed' : 'observing';
  const statusText = warned ? '疑似过敏' : complete ? '安全 ✓' : `第 ${o.days.filter(Boolean).length + 1} 天`;

  return `
    <div class="allergy-card ${cls}">
      <div class="allergy-header">
        <span class="allergy-food">${escapeHtml(o.food)}</span>
        <span class="allergy-status">${statusText}</span>
      </div>
      <div class="allergy-progress">
        ${days.map(d => `
          <div class="allergy-day ${d.status || ''} ${d.isFuture && !d.status ? 'future' : ''}"
               data-action="set-day" data-food="${escapeHtml(o.food)}" data-idx="${d.idx}">
            ${d.dateStr}<br>
            <span style="font-size:13px;">${d.status === 'ok' ? '✓' : d.status === 'bad' ? '✗' : '·'}</span>
          </div>
        `).join('')}
      </div>
      <div class="allergy-actions">
        <span>每天点一下：✓ 无反应 / ✗ 有反应</span>
        <span style="margin-left:auto;" class="link" data-action="del-observation" data-food="${escapeHtml(o.food)}">删除</span>
      </div>
    </div>
  `;
}

// ============================================
//  Tab: 提醒
// ============================================
function renderTips() {
  let html = `
    <div class="section">
      <div class="section-title"><span class="icon-dot"></span>添加辅食的总原则</div>
      <ul class="tips-list">
        ${FOOD_DATA.tips.filter(t => t.type === 'do').map(t => `<li>${t.text}</li>`).join('')}
      </ul>
    </div>
    <div class="section">
      <div class="section-title"><span class="icon-dot"></span>不要做的事</div>
      <ul class="tips-list">
        ${FOOD_DATA.tips.filter(t => t.type === 'dont').map(t => `<li class="warn">${t.text}</li>`).join('')}
      </ul>
    </div>
    <div class="section">
      <div class="section-title"><span class="icon-dot"></span>分享 / 同步</div>
      <p style="font-size:13px; color:var(--text-soft); margin-bottom:12px;">把宝宝的辅食计划分享给家人或朋友，他们打开链接就能看到当前的食材清单和过敏记录。</p>
      <button class="btn btn-primary btn-block" data-action="share">📤 生成分享链接</button>
      <button class="btn btn-secondary btn-block" data-action="reset" style="margin-top:8px;">重置所有数据</button>
    </div>
  `;
  return html;
}

// ============================================
//  事件绑定（事件委托）
// ============================================
function attachMainEvents() {
  const main = $('#main');

  // 月龄切换
  $$('.stage-pill', main).forEach(b => {
    b.onclick = () => {
      selectedMonth = parseInt(b.dataset.month);
      render();
    };
  });

  // 周几切换
  $$('.day-pill', main).forEach(b => {
    b.onclick = () => {
      selectedDay = b.dataset.day;
      render();
    };
  });
  // 注意：data-action 的事件委托在 init() 里绑定一次到 #main，
  // 这里不再每次渲染都加监听器（避免重复绑定）
}

function handleMainClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'toggle-food') {
    toggleFood(target.dataset.food);
  } else if (action === 'add-observation') {
    openObservationForm();
  } else if (action === 'set-day') {
    cycleObservationDay(target.dataset.food, parseInt(target.dataset.idx));
  } else if (action === 'del-observation') {
    if (confirm(`删除「${target.dataset.food}」的观察记录？`)) {
      state.observations = state.observations.filter(o => o.food !== target.dataset.food);
      commit();
    }
  } else if (action === 'share') {
    openShareDialog();
  } else if (action === 'reset') {
    if (confirm('确定清除所有数据？此操作无法撤销。')) {
      state = Storage.emptyState();
      Storage.clearURLData();
      commit();
      toast('已重置');
    }
  }
}

// ============================================
//  数据操作
// ============================================
function toggleFood(name) {
  if (!name) return;
  const idx = state.triedFoods.indexOf(name);
  if (idx >= 0) {
    state.triedFoods.splice(idx, 1);
    toast(`「${name}」已取消`);
  } else {
    state.triedFoods.push(name);
    toast(`「${name}」已标记为已尝试 ✓`);
  }
  commit();
}

function cycleObservationDay(food, idx) {
  const o = state.observations.find(x => x.food === food);
  if (!o) return;
  const cur = o.days[idx] || null;
  // 循环： null → ok → bad → null
  const next = cur === null ? 'ok' : cur === 'ok' ? 'bad' : null;
  o.days[idx] = next;
  commit();
}

// ============================================
//  弹窗：宝宝信息表单
// ============================================
function openBabyForm() {
  const b = state.baby || { name: '', birthday: '', gender: '', feeding: '' };
  const html = `
    <div class="modal-handle"></div>
    <div class="modal-header">
      <span class="modal-title">${state.baby ? '编辑' : '添加'}宝宝信息</span>
      <button class="modal-close" data-close>关闭</button>
    </div>

    <div class="form-group">
      <label class="form-label">宝宝小名</label>
      <input type="text" class="form-input" id="baby-name" value="${escapeHtml(b.name)}" placeholder="例如：小馒头" maxlength="20">
    </div>

    <div class="form-group">
      <label class="form-label">出生年月日</label>
      <input type="date" class="form-input" id="baby-birthday" value="${b.birthday}">
      <div class="form-help">用于自动计算月龄、推荐对应阶段</div>
    </div>

    <div class="form-group">
      <label class="form-label">性别</label>
      <div class="radio-group" id="baby-gender">
        <div class="radio-option ${b.gender === 'boy' ? 'selected' : ''}" data-value="boy">👦 男宝</div>
        <div class="radio-option ${b.gender === 'girl' ? 'selected' : ''}" data-value="girl">👧 女宝</div>
        <div class="radio-option ${!b.gender ? 'selected' : ''}" data-value="">不填</div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">喂养方式</label>
      <div class="radio-group" id="baby-feeding">
        <div class="radio-option ${b.feeding === 'breast' ? 'selected' : ''}" data-value="breast">母乳</div>
        <div class="radio-option ${b.feeding === 'mixed' ? 'selected' : ''}" data-value="mixed">混合</div>
        <div class="radio-option ${b.feeding === 'formula' ? 'selected' : ''}" data-value="formula">配方奶</div>
      </div>
    </div>

    <button class="btn btn-primary btn-block" id="baby-save">保存</button>
    ${state.baby ? `<button class="btn btn-secondary btn-block" id="baby-clear" style="margin-top:8px;">清除宝宝信息</button>` : ''}
  `;

  openModal(html, () => {
    // radio
    ['baby-gender', 'baby-feeding'].forEach(id => {
      const root = document.getElementById(id);
      $$('.radio-option', root).forEach(opt => {
        opt.onclick = () => {
          $$('.radio-option', root).forEach(x => x.classList.remove('selected'));
          opt.classList.add('selected');
        };
      });
    });

    $('#baby-save').onclick = () => {
      const name = $('#baby-name').value.trim();
      const birthday = $('#baby-birthday').value;
      const gender = $('#baby-gender .radio-option.selected')?.dataset.value || '';
      const feeding = $('#baby-feeding .radio-option.selected')?.dataset.value || '';

      if (!birthday) {
        toast('请填写出生日期');
        return;
      }
      state.baby = { name: name || '宝贝', birthday, gender, feeding };
      // 默认重置选择月龄到当前
      selectedMonth = null;
      commit();
      closeModal();
      toast('已保存 ✓');
    };

    const clearBtn = $('#baby-clear');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm('确定清除宝宝信息？已尝试食材和观察记录会保留。')) {
          state.baby = null;
          selectedMonth = null;
          commit();
          closeModal();
        }
      };
    }
  });
}

// ============================================
//  弹窗：添加过敏观察
// ============================================
function openObservationForm() {
  // 列出还没观察过的、且月龄合适的食材
  const age = calcMonthAge(state.baby?.birthday);
  const stage = getStageMonth(age);
  const observed = new Set(state.observations.map(o => o.food));

  // 优先：当前月龄 + 之前月龄的、且未观察过的
  const candidates = FOOD_DATA.foods
    .filter(f => f.firstMonth <= stage + 1 && !observed.has(f.name))
    .sort((a, b) => b.firstMonth - a.firstMonth);

  const grouped = {};
  candidates.forEach(f => {
    if (!grouped[f.firstMonth]) grouped[f.firstMonth] = [];
    grouped[f.firstMonth].push(f);
  });
  const months = Object.keys(grouped).sort((a, b) => b - a);

  const html = `
    <div class="modal-handle"></div>
    <div class="modal-header">
      <span class="modal-title">开始观察新食材</span>
      <button class="modal-close" data-close>关闭</button>
    </div>

    <div class="form-group">
      <label class="form-label">食材名称（可自定义）</label>
      <input type="text" class="form-input" id="obs-food" placeholder="点下方推荐或手动输入" maxlength="20">
    </div>

    <div class="form-group">
      <label class="form-label">开始日期</label>
      <input type="date" class="form-input" id="obs-date" value="${todayStr()}">
    </div>

    <div class="form-group">
      <label class="form-label">推荐尝试（按月龄）</label>
      ${months.map(m => `
        <div style="margin-bottom:10px;">
          <div style="font-size:12px; color:var(--text-mute); margin-bottom:6px;">${m} 月龄起</div>
          <div class="food-tags">
            ${grouped[m].map(f => `<span class="food-tag" data-pick-food="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>`).join('')}
          </div>
        </div>
      `).join('')}
      ${months.length === 0 ? '<p style="font-size:13px; color:var(--text-mute);">所有食材都已观察过啦 🎉</p>' : ''}
    </div>

    <button class="btn btn-primary btn-block" id="obs-save">开始观察（连续 3 天）</button>
  `;

  openModal(html, () => {
    $$('[data-pick-food]').forEach(t => {
      t.onclick = () => {
        $('#obs-food').value = t.dataset.pickFood;
      };
    });
    $('#obs-save').onclick = () => {
      const food = $('#obs-food').value.trim();
      const startDate = $('#obs-date').value;
      if (!food) { toast('请选择或输入食材'); return; }
      if (!startDate) { toast('请选择开始日期'); return; }
      if (state.observations.some(o => o.food === food)) {
        toast(`「${food}」已在观察列表`);
        return;
      }
      state.observations.unshift({ food, startDate, days: [null, null, null] });
      commit();
      closeModal();
      toast('开始观察 ✓');
    };
  });
}

// ============================================
//  弹窗：分享
// ============================================
function openShareDialog() {
  if (!state.baby) {
    toast('请先添加宝宝信息');
    return;
  }
  const url = Storage.generateShareURL(state);
  const html = `
    <div class="modal-handle"></div>
    <div class="modal-header">
      <span class="modal-title">分享给家人 / 朋友</span>
      <button class="modal-close" data-close>关闭</button>
    </div>

    <p style="font-size:13px; color:var(--text-soft); line-height:1.7;">
      把下面的链接发到微信，对方打开就能看到 <strong>${escapeHtml(state.baby.name)}</strong> 的辅食计划，包括已尝试的 ${state.triedFoods.length} 种食材和 ${state.observations.length} 条观察记录。
    </p>

    <div class="share-link-box" id="share-url">${escapeHtml(url)}</div>

    <button class="btn btn-primary btn-block" id="copy-btn">📋 复制链接</button>
    <button class="btn btn-secondary btn-block" id="copy-text-btn" style="margin-top:8px;">📤 复制带说明的文字</button>

    <p style="font-size:12px; color:var(--text-mute); margin-top:14px; line-height:1.6;">
      💡 数据存在链接里，无需登录。对方打开后会询问是否查看你的数据。<br>
      💡 链接较长是正常的，微信里直接发送即可。
    </p>
  `;

  openModal(html, () => {
    $('#copy-btn').onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        toast('链接已复制 ✓');
      } catch (e) {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('链接已复制 ✓');
      }
    };
    $('#copy-text-btn').onclick = async () => {
      const age = calcMonthAge(state.baby.birthday);
      const text = `【${state.baby.name}的辅食计划】当前 ${age} 个月，已尝试 ${state.triedFoods.length} 种食材。点开链接查看完整计划：\n${url}`;
      try {
        await navigator.clipboard.writeText(text);
        toast('已复制 ✓');
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('已复制 ✓');
      }
    };
  });
}

// ============================================
//  导入分享数据询问
// ============================================
function askImport(sharedState) {
  const sharedBabyName = sharedState.baby?.name || '宝贝';
  const hasLocal = state.baby !== null;

  const html = `
    <div class="modal-handle"></div>
    <div class="modal-header">
      <span class="modal-title">收到分享</span>
    </div>
    <p style="font-size:14px; color:var(--text); line-height:1.7; margin-bottom:14px;">
      朋友分享了 <strong>${escapeHtml(sharedBabyName)}</strong> 的辅食计划。
      ${hasLocal ? `你本地已有 <strong>${escapeHtml(state.baby.name)}</strong> 的数据。` : ''}
    </p>
    <p style="font-size:13px; color:var(--text-soft); line-height:1.7; margin-bottom:18px;">
      要怎么处理？
    </p>

    <button class="btn btn-secondary btn-block" id="import-view" style="margin-bottom:8px;">👀 仅查看（不保存到本地）</button>
    ${hasLocal ? `
      <button class="btn btn-secondary btn-block" id="import-keep" style="margin-bottom:8px;">🔒 保留我自己的数据</button>
    ` : ''}
    <button class="btn btn-primary btn-block" id="import-replace">${hasLocal ? '⚠️ 替换为' : '✅ 导入'} ${escapeHtml(sharedBabyName)} 的数据</button>
  `;

  openModal(html, () => {
    $('#import-view').onclick = () => {
      // 仅查看：临时用 sharedState，不保存到本地
      savedLocalState = Storage.loadLocal(); // 保存原数据
      viewOnlyMode = true;
      state = sharedState;
      Storage.clearURLData();
      closeModal();
      render();
      showViewOnlyBanner(sharedBabyName);
      toast(`正在查看 ${sharedBabyName}（未保存到本地）`);
    };
    const keepBtn = $('#import-keep');
    if (keepBtn) {
      keepBtn.onclick = () => {
        Storage.clearURLData();
        closeModal();
        render();
      };
    }
    $('#import-replace').onclick = () => {
      state = sharedState;
      viewOnlyMode = false;
      Storage.saveLocal(state);
      Storage.clearURLData();
      closeModal();
      render();
      toast('已导入 ✓');
    };
  });
}

// 显示"仅查看"模式的横幅
function showViewOnlyBanner(name) {
  let banner = document.getElementById('view-only-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'view-only-banner';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: #fff5e0; color: #8a6d3b;
      padding: 8px 14px; font-size: 12px;
      text-align: center; border-bottom: 1px solid var(--accent-soft);
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    `;
    document.body.appendChild(banner);
    document.body.style.paddingTop = '36px';
  }
  banner.innerHTML = `
    👀 正在查看 ${escapeHtml(name)} · 修改不会保存
    <span style="margin-left:10px; text-decoration:underline; cursor:pointer;" id="exit-view-only">退出查看</span>
  `;
  document.getElementById('exit-view-only').onclick = exitViewOnly;
}

function exitViewOnly() {
  if (savedLocalState) {
    state = savedLocalState;
    savedLocalState = null;
  } else {
    state = Storage.emptyState();
  }
  viewOnlyMode = false;
  const banner = document.getElementById('view-only-banner');
  if (banner) {
    banner.remove();
    document.body.style.paddingTop = '';
  }
  render();
  toast('已退出查看模式');
}

// ============================================
//  初始化
// ============================================
function init() {
  // Modal 关闭
  $('#modal-overlay').onclick = (e) => {
    if (e.target.id === 'modal-overlay' || e.target.dataset.close !== undefined) {
      closeModal();
    }
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // 主区域事件委托（绑定一次，不会随渲染累加）
  $('#main').addEventListener('click', handleMainClick);

  // 加载本地数据
  const local = Storage.loadLocal();

  // 检查 URL 是否有分享数据
  const fromURL = Storage.loadFromURL();

  if (fromURL) {
    // 有分享数据
    state = local;
    render();
    askImport(fromURL);
  } else {
    state = local;
    render();
    // 第一次访问、没有任何数据
    if (!state.baby && state.triedFoods.length === 0 && state.observations.length === 0) {
      // 提示一下
      setTimeout(() => {
        toast('点顶部添加宝宝信息开始 →');
      }, 300);
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
