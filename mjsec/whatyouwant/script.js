// API 키는 서버(app.py)에만 있고, 브라우저는 /api/* 만 호출한다.
// Go Live(5500)로 열어도 동작하도록, Flask 서버가 아닌 곳에서 열리면 5001 서버로 요청한다.
const API = location.port === "5001" ? "/api" : "http://127.0.0.1:5001/api";
const IMG = "https://image.tmdb.org/t/p/";
const NO_IMG = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="100%" height="100%" fill="#2a2a2a"/>' +
  '<text x="50%" y="50%" fill="#888" font-family="sans-serif" font-size="40" text-anchor="middle">No Image</text></svg>');
const $ = id => document.getElementById(id);

let popular = [], results = null, query = "", hero = null, favorites = [];
try { favorites = JSON.parse(localStorage.getItem("favorites")) ?? []; } catch {} // 에러①: 깨진 저장값

// 에러②: 서버 꺼짐 / 에러③: HTTP 오류 응답(키 오류, TMDB 장애)
async function getMovies(url) {
  const res = await fetch(url).catch(() => { throw new Error("서버에 연결할 수 없습니다. 터미널에서 python app.py 를 실행하세요."); });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (HTTP ${res.status})`);
  return data.results || [];
}

function showError(err) {
  $("status").textContent = err.message;
  $("status").hidden = false;
}

const isFav = id => favorites.some(f => f.id === id);
const mark = id => (isFav(id) ? "✓" : "+");

// 제목 등 외부 데이터는 textContent 로만 넣어 XSS 를 막는다.
function card(m) {
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `<img loading="lazy"><h3></h3><div class="meta"><span>★ ${Number(m.vote_average || 0).toFixed(1)}</span><button class="fav"></button></div>`;
  const [img, h3, btn] = el.querySelectorAll("img, h3, button");
  img.src = m.poster_path ? IMG + "w500" + m.poster_path : NO_IMG;
  img.onerror = () => { img.onerror = null; img.src = NO_IMG; };
  img.alt = h3.textContent = m.title;
  btn.textContent = mark(m.id);
  btn.classList.toggle("on", isFav(m.id));
  btn.onclick = () => toggleFavorite(m);
  return el;
}

function fill(box, movies, emptyText) {
  const empty = Object.assign(document.createElement("p"), { className: "empty", textContent: emptyText });
  const x = box.scrollLeft; // 다시 그려도 가로 스크롤 위치가 처음으로 튀지 않게 유지
  box.replaceChildren(...(movies.length ? movies.map(card) : [empty]));
  box.scrollLeft = x;
}

function render() {
  fill($("popularRow"), popular, "인기 영화를 불러오지 못했습니다.");
  fill($("favoriteRow"), favorites, "아직 찜한 영화가 없습니다. 카드의 + 버튼을 눌러 추가해 보세요.");
  $("searchSection").hidden = !results;
  if (results) {
    $("searchTitle").textContent = `'${query}' 검색 결과 (${results.length})`;
    fill($("searchGrid"), results, `'${query}'에 대한 검색 결과가 없습니다.`);
  }
  if (hero) $("heroFav").textContent = `${mark(hero.id)} 내가 찜한 리스트`;
}

// 찜은 다시 요청하지 않고 현재 목록으로 다시 그리므로 검색 결과가 유지된다.
function toggleFavorite(m) {
  const { id, title, poster_path, backdrop_path, vote_average, overview } = m;
  favorites = isFav(id)
    ? favorites.filter(f => f.id !== id)
    : [...favorites, { id, title, poster_path, backdrop_path, vote_average, overview }];
  localStorage.setItem("favorites", JSON.stringify(favorites));
  render();
}

function clearSearch() {
  results = null;
  $("searchInput").value = "";
  render();
}

// form submit 이라 Enter 로도 검색된다.
$("searchForm").onsubmit = async e => {
  e.preventDefault();
  query = $("searchInput").value.trim();
  if (!query) return clearSearch();
  $("status").hidden = true;
  try {
    results = await getMovies(`${API}/search?query=${encodeURIComponent(query)}`);
    render();
    $("searchSection").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showError(err);
  }
};
$("clearBtn").onclick = clearSearch;
// 로고: 다른 주소로 이동하지 않고 이 페이지를 홈 상태로 되돌린다 (어떤 서버/포트로 열어도 동일).
$("logo").onclick = e => {
  e.preventDefault();
  $("status").hidden = true;
  clearSearch();
  scrollTo({ top: 0, behavior: "smooth" });
};
$("heroFav").onclick = () => toggleFavorite(hero);
onscroll = () => document.querySelector("header").classList.toggle("scrolled", scrollY > 50);

getMovies(`${API}/popular`).then(movies => {
  popular = movies;
  hero = movies.find(m => m.backdrop_path);
  if (!hero) return;
  $("hero").style.backgroundImage = `linear-gradient(to top, #141414, transparent 50%), url(${JSON.stringify(IMG + "original" + hero.backdrop_path)})`;
  $("heroTitle").textContent = hero.title;
  $("heroOverview").textContent = hero.overview;
  $("heroFav").hidden = false;
}).catch(showError).finally(render);
