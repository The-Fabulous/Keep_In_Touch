import { Globe } from './globe.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const interests = { 'Путешествия': '↗', 'Фотография': '◉', 'Музыка': '♫', 'Искусство': '✳', 'Кофе': '☕', 'Кино': '▷', 'Книги': '▤', 'Дизайн': '◈', 'Прогулки': '☀' };
const people = [
  { id: 1, name: 'Амина', age: 24, city: 'Алматы, Казахстан', lat: 43.24, lon: 76.89, interests: ['Фотография', 'Путешествия'], online: true, bio: 'Ловлю свет в горах и хорошие моменты на плёнку. Покажу любимые места Алматы и всегда поддержу идею маленького путешествия.' },
  { id: 2, name: 'Софи', age: 23, city: 'Париж, Франция', lat: 48.85, lon: 2.35, interests: ['Искусство', 'Кофе'], online: true, bio: 'Могу часами гулять по музеям, а потом обсуждать всё за чашкой кофе. Ищу людей, с которыми интересно замечать детали.' },
  { id: 3, name: 'Лео', age: 26, city: 'Лиссабон, Португалия', lat: 38.72, lon: -9.14, interests: ['Музыка', 'Путешествия'], online: false, bio: 'Океан, винил и вечерние прогулки. Собираю плейлисты для каждого города и люблю слушать чужие истории.' },
  { id: 4, name: 'Юки', age: 22, city: 'Токио, Япония', lat: 35.68, lon: 139.69, interests: ['Дизайн', 'Фотография'], online: true, bio: 'Вдохновляюсь городом, снимаю повседневность и рисую маленькие миры. Обменяемся фотографиями наших любимых улиц?' },
  { id: 5, name: 'Матео', age: 25, city: 'Буэнос-Айрес, Аргентина', lat: -34.6, lon: -58.38, interests: ['Кино', 'Музыка'], online: false, bio: 'Фильмы на языке оригинала, концерты маленьких групп и длинные разговоры. Всегда рад новой музыкальной рекомендации.' },
  { id: 6, name: 'Нора', age: 24, city: 'Копенгаген, Дания', lat: 55.68, lon: 12.57, interests: ['Книги', 'Прогулки'], online: true, bio: 'Книга в рюкзаке, велосипед у двери. Люблю уютные места и людей, с которыми можно и поговорить, и помолчать.' }
].map(person => ({ ...person, avatar: `./assets/avatar-${person.id}.svg` }));

const defaultProfile = { name: 'Алекс', city: 'Алматы, Казахстан', bio: 'Собираю моменты, а не вещи. Люблю спонтанные прогулки, плёночные фотографии и разговоры, после которых забываешь про время. Давай найдём что-то общее?', interests: ['Путешествия', 'Фотография', 'Музыка', 'Кофе'] };
let profile = { ...defaultProfile, interests: [...defaultProfile.interests] };
let liked = new Set();
try {
  const saved = JSON.parse(localStorage.getItem('kit-profile'));
  if (saved && typeof saved.name === 'string' && saved.name.trim() && typeof saved.city === 'string' && saved.city.trim() && typeof saved.bio === 'string' && Array.isArray(saved.interests)) {
    profile = { name: saved.name.slice(0, 40), city: saved.city.slice(0, 70), bio: saved.bio.slice(0, 400), interests: saved.interests.filter(i => Object.hasOwn(interests, i)) };
  }
  const savedLikes = JSON.parse(localStorage.getItem('kit-likes'));
  if (Array.isArray(savedLikes)) liked = new Set(savedLikes.filter(id => people.some(p => p.id === id)));
} catch { /* Private browsing and invalid storage fall back to demo defaults. */ }

let filter = 'all';
let selectedPerson = people[0];
let toastTimer;
let activeRoute;
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4000);
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

const hero = new Globe($('#hero-globe'), { decorative: true });
const globe = new Globe($('#world-globe'), {
  onSelect: person => { selectPerson(person, false); openPerson(person); },
  onRotate: (lat, lon) => { $('#map-coordinates').textContent = `${Math.abs(Math.round(lat))}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(Math.round(lon))}° ${lon < 0 ? 'W' : 'E'}`; }
});
Promise.all([hero.load(), globe.load()]).catch(() => toast('Не удалось загрузить карту. Попробуй обновить страницу.'));

function route() {
  const requested = location.hash.slice(1);
  const page = ['discover', 'profile'].includes(requested) ? requested : 'welcome';
  const changed = page !== activeRoute;
  $('#welcome').hidden = page !== 'welcome';
  $('#application').hidden = page === 'welcome';
  $('#discover-page').hidden = page !== 'discover';
  $('#profile-page').hidden = page !== 'profile';
  $$('.nav-link').forEach(link => {
    const active = link.dataset.route === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#breadcrumb').innerHTML = page === 'profile' ? 'Пространство / <strong>Мой профиль</strong>' : 'Мир / <strong>Поиск друзей</strong>';
  document.title = `${page === 'profile' ? 'Мой профиль' : page === 'discover' ? 'Поиск друзей' : 'Ближе, чем кажется'} — Keep in Touch`;
  if (changed) {
    $$('dialog[open]').forEach(dialog => dialog.close());
    window.scrollTo(0, 0);
    if (activeRoute && page !== 'welcome') $(`#${page}-title`).focus({ preventScroll: true });
  }
  activeRoute = page;
}
window.addEventListener('hashchange', route);
$('#skip-login').addEventListener('click', () => { $('#login-form').reset(); location.hash = 'discover'; });
$('#sidebar-profile').addEventListener('click', () => { location.hash = 'profile'; });
$('#sign-out').addEventListener('click', () => { location.hash = 'welcome'; });
$('#login-form').addEventListener('submit', event => {
  event.preventDefault();
  $('#login-note').textContent = 'Вход пока не подключён. Нажми «Пропустить и исследовать мир».';
  $('#skip-login').focus();
});
$('#toggle-password').addEventListener('click', () => {
  const visible = $('#password').type === 'password';
  $('#password').type = visible ? 'text' : 'password';
  $('#toggle-password').setAttribute('aria-pressed', String(visible));
  $('#toggle-password').setAttribute('aria-label', visible ? 'Скрыть пароль' : 'Показать пароль');
});

function selectPerson(person, focus = true) {
  selectedPerson = person;
  globe.selected = person.id;
  globe.invalidate();
  $('#map-selected').innerHTML = `<button class="map-person" aria-label="Открыть профиль: ${escapeHtml(person.name)}"><img src="${person.avatar}" alt=""><span><strong>${escapeHtml(person.name)}, ${person.age}</strong><small>${escapeHtml(person.city)}</small></span>${icon('arrow')}</button>`;
  $('#map-selected button').addEventListener('click', () => openPerson(person));
  if (focus) globe.focus(person);
}

function visiblePeople() {
  const query = $('#people-search').value.trim().toLocaleLowerCase('ru');
  return people.filter(person => {
    const matchesQuery = `${person.name} ${person.city} ${person.interests.join(' ')}`.toLocaleLowerCase('ru').includes(query);
    return matchesQuery && (filter !== 'online' || person.online) && (filter !== 'shared' || person.interests.some(i => profile.interests.includes(i)));
  });
}

function renderPeople() {
  const visible = visiblePeople();
  $('#people-count').textContent = String(visible.length).padStart(2, '0');
  $('#people-list').innerHTML = visible.length ? visible.map(person => `<article class="person-card"><div class="person-avatar"><img src="${person.avatar}" alt="">${person.online ? '<span class="status-dot" title="В сети"></span>' : ''}</div><div class="person-info"><button class="person-name" data-person="${person.id}">${person.name}, ${person.age}</button><div class="person-place">${icon('pin')}${person.city}</div><div class="person-tags">${person.interests.map(i => `<span class="${profile.interests.includes(i) ? 'match' : ''}">${i}</span>`).join('')}</div></div><button class="like-button ${liked.has(person.id) ? 'liked' : ''}" data-like="${person.id}" aria-label="${liked.has(person.id) ? 'Убрать симпатию' : 'Отметить симпатию'}: ${person.name}" aria-pressed="${liked.has(person.id)}">${icon('heart')}</button></article>`).join('') : '<div class="empty-state"><span>⌕</span>Пока никого не нашли.<br>Попробуй другой город или интерес.</div>';
  if (visible.length && !visible.some(p => p.id === selectedPerson.id)) selectPerson(visible[0]);
  $('#map-selected').hidden = !visible.length;
  globe.setPeople(visible, selectedPerson.id);
}

$('#people-list').addEventListener('click', event => {
  const personButton = event.target.closest('[data-person]');
  const likeButton = event.target.closest('[data-like]');
  if (personButton) {
    const person = people.find(p => p.id === Number(personButton.dataset.person));
    selectPerson(person);
    globe.setPeople(visiblePeople(), person.id);
    openPerson(person);
  }
  if (likeButton) toggleLike(Number(likeButton.dataset.like));
});

function toggleLike(id) {
  if (liked.has(id)) liked.delete(id); else liked.add(id);
  const persisted = save('kit-likes', [...liked]);
  const focusId = document.activeElement?.dataset?.like;
  renderPeople();
  if (focusId) $(`[data-like="${focusId}"]`)?.focus({ preventScroll: true });
  $('#connection-count').textContent = liked.size;
  toast(!persisted ? 'Симпатия обновлена на время этой сессии.' : liked.has(id) ? 'Симпатия сохранена в демо. Уведомления не отправляются.' : 'Симпатия убрана.');
}

function openPerson(person) {
  $('#person-details').innerHTML = `<div class="person-dialog-content"><button class="icon-button close-dialog" aria-label="Закрыть">${icon('close')}</button><img class="person-dialog-avatar" src="${person.avatar}" alt="Иллюстрация аватара ${person.name}"><span class="eyebrow">ЕЩЁ ОДНА ИСТОРИЯ В ЭТОМ МИРЕ</span><h2>${person.name}, ${person.age}</h2><div class="person-place">${icon('pin')}${person.city}</div><p>${person.bio}</p><div class="profile-interest-list">${person.interests.map(i => `<span class="interest-tag">${interests[i]} ${i}</span>`).join('')}</div><button class="button primary person-like">${icon('heart')}<span>${liked.has(person.id) ? 'Убрать симпатию' : 'Мне близок этот человек'}</span></button><p class="demo-explanation">Демо-профиль. Симпатия видна только тебе.</p></div>`;
  $('#person-details .close-dialog').addEventListener('click', () => $('#person-dialog').close());
  $('#person-details .person-like').addEventListener('click', () => {
    toggleLike(person.id);
    $('#person-details .person-like span').textContent = liked.has(person.id) ? 'Убрать симпатию' : 'Мне близок этот человек';
  });
  $('#person-dialog').showModal();
}

$('#people-search').addEventListener('input', renderPeople);
$$('.filter-tab').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  $$('.filter-tab').forEach(tab => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); });
  renderPeople();
}));
$('#zoom-in').addEventListener('click', () => globe.changeZoom(.12));
$('#zoom-out').addEventListener('click', () => globe.changeZoom(-.12));
$('#reset-globe').addEventListener('click', () => globe.reset());

function renderProfile() {
  $('#profile-name').textContent = profile.name;
  $('#sidebar-name').textContent = profile.name;
  $('#profile-city').textContent = profile.city;
  $('#profile-bio').textContent = profile.bio;
  $('#connection-count').textContent = liked.size;
  $('#profile-interests').innerHTML = profile.interests.length ? profile.interests.map(i => `<span class="interest-tag">${interests[i]} ${i}</span>`).join('') : '<p>Добавь интересы в редакторе профиля.</p>';
}
$('#edit-profile').addEventListener('click', () => {
  $('#edit-name').value = profile.name;
  $('#edit-city').value = profile.city;
  $('#edit-bio').value = profile.bio;
  $('#edit-interests').innerHTML = Object.entries(interests).map(([name, emoji]) => `<label class="interest-option"><input type="checkbox" name="interests" value="${name}" ${profile.interests.includes(name) ? 'checked' : ''}><span>${emoji} ${name}</span></label>`).join('');
  $('#edit-dialog').showModal();
});
$('#edit-dialog .close-dialog').addEventListener('click', () => $('#edit-dialog').close());
$('#edit-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const next = { name: data.get('name').trim(), city: data.get('city').trim(), bio: data.get('bio').trim(), interests: data.getAll('interests') };
  if (!next.name || !next.city || !next.bio) { toast('Заполни имя, город и пару слов о себе.'); return; }
  profile = next;
  const persisted = save('kit-profile', profile);
  renderProfile();renderPeople();
  $('#edit-dialog').close();
  toast(persisted ? 'Готово! Профиль сохранён в этом браузере.' : 'Профиль обновлён на время сессии. Хранилище браузера недоступно.');
});
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));

renderProfile();selectPerson(selectedPerson, false);renderPeople();route();
