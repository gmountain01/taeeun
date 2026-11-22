/* 개발자 메뉴: 운영 화면과 분리된 선택 기능. 실제 방문자에게는 안 보인다(Alt+1 또는 주소에 ?dev가 있을 때만 켜짐).
   원본 window.DATA는 절대 바꾸지 않고(복제본만 만들어 바꿔치기), localStorage 등 저장도 하지 않는다 — 새로고침하면 원래 데이터로 돌아온다. */
(function () {
  var ORIGINAL = window.DATA;
  var aside = null;
  var mode = "real";

  function cloneSeries(series) {
    return JSON.parse(JSON.stringify(series));
  }

  // 작품 많을 때(웹툰5·음악3·시화4·영상1·그림1): 기존 작품 이미지를 그대로 재사용한 가짜 작품을 더한다.
  function buildMany() {
    var series = cloneSeries(ORIGINAL.series);
    var byType = {};
    Object.keys(ORIGINAL.series).forEach(function (id) {
      var w = ORIGINAL.series[id];
      if (!byType[w.type]) byType[w.type] = w;
    });
    var n = 0;

    function addComic(title, date) {
      n++;
      var ref = byType.comic;
      series["dev_comic" + n] = {
        type: "comic",
        title: title,
        summary: "예시 소개 글이에요(개발자 메뉴 · 작품 많을 때).",
        updated: date,
        cover: ref ? ref.cover : "",
        coverAlt: "",
        characters: ref ? ref.characters.slice(0, 2) : [],
        episodes: [
          { n: 1, title: "예시 1화", cuts: ["예시 컷"] },
          { n: 2, title: "예시 2화", cuts: ["예시 컷"] },
        ],
      };
    }
    function addMusic(title, date) {
      n++;
      var ref = byType.music;
      series["dev_music" + n] = {
        type: "music",
        title: title,
        summary: "예시 음악 소개입니다.",
        updated: date,
        poster: ref ? ref.poster : "",
        src: ref ? ref.src : "",
        duration: "1:30",
        transcript: "[Verse]\n\n예시 가사 첫 줄\n예시 가사 둘째 줄",
      };
    }
    function addPoem(title, date) {
      n++;
      var ref = byType.poem;
      series["dev_poem" + n] = {
        type: "poem",
        title: title,
        updated: date,
        image: ref ? ref.image : { src: "", w: 1, h: 1 },
        imageAlt: "예시 시화 그림 설명. 시는 아래 글과 같아요",
        poem: "예시 첫 줄\n예시 둘째 줄\n\n예시 셋째 줄\n예시 넷째 줄",
      };
    }

    addComic("예시 웹툰 2", "2026-10-11");
    addComic("예시 웹툰 3", "2026-10-12");
    addComic("예시 웹툰 4", "2026-10-13");
    addComic("예시 웹툰 5", "2026-10-14");
    addMusic("예시 음악 2", "2026-10-15");
    addMusic("예시 음악 3", "2026-10-16");
    addPoem("예시 시화 2", "2026-10-17");
    addPoem("예시 시화 3", "2026-10-18");
    addPoem("예시 시화 4", "2026-10-19");
    var musicRef = byType.music;
    var poemRef = byType.poem;
    series["dev_video1"] = {
      type: "video", title: "예시 영상", summary: "예시 영상 소개입니다.", updated: "2026-10-20",
      poster: musicRef ? musicRef.poster : "", src: musicRef ? musicRef.src : "", duration: "3:12",
    };
    series["dev_art1"] = {
      type: "art", title: "예시 그림", summary: "예시 그림 소개입니다.", updated: "2026-10-21",
      images: poemRef && poemRef.image ? [{ src: poemRef.image.src, alt: "", w: poemRef.image.w, h: poemRef.image.h }] : [],
    };
    return { siteName: ORIGINAL.siteName, author: ORIGINAL.author, series: series };
  }

  function buildEmpty() {
    return { siteName: ORIGINAL.siteName, author: ORIGINAL.author, series: {} };
  }

  function apply(newMode) {
    mode = newMode;
    var next = newMode === "real" ? ORIGINAL : newMode === "many" ? buildMany() : buildEmpty();
    window.DATA = next; // 참고용으로 window에도 반영(콘솔 확인 등)
    if (typeof window.__setData === "function") window.__setData(next); // app.js 안의 지역 DATA까지 실제로 바꾸는 것은 이 호출
    if (typeof window.__rerender === "function") window.__rerender();
    updateButtons();
  }

  function updateButtons() {
    if (!aside) return;
    [].forEach.call(aside.querySelectorAll("button[data-mode]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode));
    });
  }

  function build() {
    aside = document.createElement("aside");
    aside.setAttribute("aria-label", "개발자 메뉴");
    aside.style.cssText =
      "position:fixed;right:var(--s-4);bottom:var(--s-4);z-index:20;" +
      "background:var(--bg);border:1px solid var(--line);border-radius:var(--r-md);" +
      "padding:var(--s-3);box-shadow:0 4px 16px rgba(0,0,0,.18);width:240px;" +
      "font:var(--w-reg) var(--t-sm)/var(--lh-body) var(--font-body);color:var(--ink);";
    var note = document.createElement("p");
    note.style.cssText = "margin:0 0 var(--s-2);color:var(--ink-muted)";
    note.textContent = "개발자 메뉴 · 예시 데이터는 이 화면에서만 보여요";
    var list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:var(--s-1)";
    [["real", "지금 데이터"], ["many", "작품 많을 때"], ["empty", "작품 없음"]].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.mode = pair[0];
      b.setAttribute("aria-pressed", String(pair[0] === mode));
      b.textContent = pair[1];
      b.style.cssText = "min-height:var(--tap);border:1px solid var(--line);background:var(--surface);border-radius:var(--r-sm);font:inherit;color:inherit;cursor:pointer;";
      list.appendChild(b);
    });
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "닫기";
    closeBtn.style.cssText = "min-height:var(--tap);margin-top:var(--s-2);border:1px solid var(--line);background:none;border-radius:var(--r-sm);font:inherit;color:inherit;cursor:pointer;width:100%;";
    closeBtn.addEventListener("click", close);
    aside.appendChild(note);
    aside.appendChild(list);
    aside.appendChild(closeBtn);
    list.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-mode]");
      if (b) apply(b.dataset.mode);
    });
    document.body.appendChild(aside);
  }

  function open() {
    if (!aside) build();
    aside.hidden = false;
  }
  function close() {
    if (aside) aside.hidden = true;
  }
  function isOpen() {
    return !!aside && !aside.hidden;
  }
  function toggle() {
    if (isOpen()) close();
    else open();
  }

  function isTyping(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  document.addEventListener("keydown", function (e) {
    if (isTyping(document.activeElement)) return;
    if (e.altKey && e.code === "Digit1") {
      e.preventDefault();
      toggle();
      return;
    }
    // Ctrl+1은 크롬·엣지가 탭 전환으로 먼저 가져가 페이지에서 못 받는다. 리스너는 걸어 두되(Firefox 등에서는 받을 수 있음) 주 단축키로 의존하지 않는다(Alt+1이 주).
    if (e.ctrlKey && !e.altKey && (e.key === "1" || e.code === "Digit1")) {
      toggle();
    }
  });

  if (/(?:^|[?&])dev(?:=|&|$)/.test(location.search)) open();
})();
