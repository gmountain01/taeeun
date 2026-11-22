/* 해시 라우팅. 라우트 3개: #/ (홈), #/series/:id (작품 상세), #/ep/:id/:n (회차 보기) */
(function () {
  "use strict";
  var DATA = window.DATA;
  var app = document.getElementById("app");
  var barName = document.getElementById("bar-name");
  var barBack = document.getElementById("bar-back");
  var barList = document.getElementById("bar-list");
  var barEl = document.querySelector(".bar");

  var ORDER = ["comic", "music", "poem", "video", "art"];
  var CAT_NAME = { comic: "웹툰", music: "음악", poem: "시화", video: "영상", art: "그림" };

  // 글자 기호(←) 대신 쓰는 그린 아이콘(선 2px, 둥근 끝). 내용이 전부 내부 상수라 innerHTML로 만들어도 안전하다.
  var ICON_BACK = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true" style="margin-right:var(--s-2)"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function fromHTML(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.firstElementChild;
  }

  function backIcon() {
    return fromHTML(ICON_BACK);
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    (children || []).forEach(function (c) {
      if (typeof c === "string") n.appendChild(document.createTextNode(c));
      else if (c) n.appendChild(c);
    });
    return n;
  }

  function badge(text) {
    return el("span", { class: "badge" }, [text]);
  }

  // 뒤로가기 류 링크 공통(아이콘 + 글자). 주 버튼 톤이 아닌 2차 톤(.btn.btn-secondary)과 함께 쓴다.
  function backLink(href, text) {
    var a = el("a", { class: "btn btn-secondary", href: href });
    a.appendChild(backIcon());
    a.appendChild(document.createTextNode(text));
    return a;
  }

  function formatKoreanDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso || "";
    return parseInt(m[2], 10) + "월 " + parseInt(m[3], 10) + "일";
  }

  function setBar(opts) {
    // opts: { backHref, backLabel(aria-label, 아이콘만일 때), backText(글자 보이는 링크), seriesName, prevHref, nextHref, narrow }
    barEl.hidden = false; // 홈에서 숨겨 뒀을 수 있으니 다른 화면에 올 때마다 다시 보여 준다
    barBack.innerHTML = "";
    barName.textContent = "";
    barList.innerHTML = "";
    barEl.classList.toggle("bar--narrow", !!(opts && opts.narrow));
    if (opts && opts.backHref) {
      var backAttrs = { href: opts.backHref };
      if (!opts.backText) backAttrs["aria-label"] = opts.backLabel || "뒤로";
      var backA = el("a", backAttrs);
      backA.appendChild(backIcon());
      if (opts.backText) backA.appendChild(document.createTextNode(opts.backText));
      barBack.appendChild(backA);
    } else {
      barBack.appendChild(el("a", { href: "#/", class: "site-name" }, [DATA.siteName]));
    }
    if (opts && opts.seriesName) {
      barName.textContent = opts.seriesName;
      barName.className = "series-name";
    }
    if (opts && (opts.prevHref || opts.nextHref)) {
      var side = el("span", { class: "side-nav" });
      if (opts.prevHref) side.appendChild(el("a", { href: opts.prevHref }, ["이전"]));
      if (opts.nextHref) side.appendChild(el("a", { href: opts.nextHref }, ["다음"]));
      barList.appendChild(side);
    }
  }

  function epThumbSrc(seriesId, ep) {
    return "img/" + seriesId + "/ep" + ep.n + "/thumb.jpg";
  }

  // build_images.py가 실제로 저장한 이미지의 (폭, 높이)를 돌려준다(site/img-sizes.js, 없으면 null).
  // 세로가 짧은 컷이 가로로 늘어나 보이는 문제(폰·카카오톡 인앱 브라우저)를 막으려고 고정 숫자 대신 이 표를 쓴다.
  function imgSizeAttrs(path) {
    var s = window.IMG_SIZES && window.IMG_SIZES[path];
    return s ? { width: String(s[0]), height: String(s[1]) } : {};
  }

  function extend(target, src) {
    for (var k in src) target[k] = src[k];
    return target;
  }

  function workCoverSrc(w) {
    if (w.type === "video" || w.type === "music") return w.poster;
    if (w.type === "art") return w.images && w.images[0] ? w.images[0].src : "";
    if (w.type === "poem") return w.image ? w.image.src : "";
    return w.cover;
  }

  // "img/seongam/1122.jpg" -> "img/seongam/480.jpg" 식(파일명 자체가 폭). cover-200 같은 접미사 방식과 달라 따로 둔다.
  function poemVariantSrc(path, width) {
    return path.replace(/\d+(?=\.[a-z]+$)/i, width);
  }

  // "img/eokgyo/cover.jpg" -> "img/eokgyo/cover-200.jpg" 같은, build_images.py가 같이 만들어 둔 작은 사본 경로.
  function smallVariantSrc(path, width) {
    return path.replace(/(\.[a-z]+)$/i, "-" + width + "$1");
  }

  // 홈 카드(112/148px)용 srcset. 880 원본을 그 자리에서 직접 줄이면 계단짐(앨리어싱)이 생겨 작은 사본(cover-200/400, poster-160/320)을 쓴다.
  // video·art는 작은 사본이 없어 원본을 그대로 쓴다(카드가 더 크고 해당 민원이 없었음).
  function homeCoverSrcset(w, cover) {
    if (w.type === "comic") return { srcset: smallVariantSrc(cover, 200) + " 200w, " + smallVariantSrc(cover, 400) + " 400w", sizes: "(min-width: 768px) 148px, 112px" };
    if (w.type === "music") return { srcset: smallVariantSrc(cover, 160) + " 160w, " + smallVariantSrc(cover, 320) + " 320w", sizes: "(min-width: 768px) 148px, 112px" };
    if (w.type === "poem") return { srcset: poemVariantSrc(cover, 480) + " 480w, " + poemVariantSrc(cover, 800) + " 800w", sizes: "(min-width: 768px) 148px, 112px" };
    return {};
  }

  // 재생기 끝부분을 자르지 않고, 사이트에서만 지정 시각 이후가 안 보이게/안 들리게 멈춘다(끝으로 끌어도 되돌아옴).
  function attachEndAtClamp(mediaEl, endAt) {
    if (!endAt) return;
    mediaEl.addEventListener("timeupdate", function () {
      if (mediaEl.currentTime >= endAt) {
        mediaEl.currentTime = endAt;
        mediaEl.pause();
      }
    });
    mediaEl.addEventListener("seeking", function () {
      if (mediaEl.currentTime >= endAt) mediaEl.currentTime = endAt;
    });
  }

  function sortedWorks() {
    var ids = Object.keys(DATA.series).sort(function (a, b) {
      return DATA.series[b].updated.localeCompare(DATA.series[a].updated);
    });
    return ids.map(function (id) {
      return { id: id, data: DATA.series[id] };
    });
  }

  function groupWorksByCategory(works) {
    return ORDER.map(function (t) {
      return { type: t, list: works.filter(function (w) { return w.data.type === t; }) };
    }).filter(function (g) { return g.list.length; });
  }

  // 정보 줄(날짜 없이): 웹툰 "N화까지" / 음악 "노래 · 2:03" / 영상 "영상 · 2:03" / 그림 "그림 N장"
  function workMetaLine(w) {
    // v7.6: 홈 카드 정보 줄에서 "인물 N명"은 뺀다(폰·768에서 날짜가 잘렸음). 웹툰 상세 머리의 정보 줄은 그대로 인물 수를 보여 준다(별도 코드).
    if (w.type === "comic") return w.episodes ? w.episodes.length + "화까지" : "";
    if (w.type === "music") return "노래 · " + w.duration;
    if (w.type === "video") return "영상 · " + w.duration;
    if (w.type === "art") return "그림 " + (w.images ? w.images.length : 0) + "장";
    if (w.type === "poem") return "시화 · " + poemStanzas(w.poem).length + "연";
    return "";
  }

  // 시를 연(빈 줄로 구분) 단위로 나눈다. 빈 연은 버린다.
  function poemStanzas(poem) {
    return (poem || "").split("\n\n").filter(function (s) { return s.trim(); });
  }

  // 등장인물 얼굴 버튼: 홈·상세에서 같이 쓰는 항목(팝업 연결은 app 전체에 위임한 리스너 1개가 맡는다).
  function renderCastItems(characters) {
    return characters.map(function (c) {
      return el("li", {}, [
        el(
          "a",
          {
            class: "face",
            href: c.full,
            "aria-label": c.name + " 자세히 보기",
            "aria-haspopup": "dialog",
            "data-name": c.name,
            "data-sheet-alt": c.sheetAlt || c.name + " 캐릭터 시트",
          },
          [el("img", extend({ src: c.img, alt: "", loading: "lazy" }, imgSizeAttrs(c.img))), el("span", {}, [c.name])]
        ),
      ]);
    });
  }

  // 작가 원: 있으면 원형 사진, 없으면 별명 첫 글자 자리표시(--surface 바탕). 폰·768+ 크기는 CSS가 맡는다.
  function renderAvatar(author) {
    if (author.avatar) {
      return el("img", { class: "avatar", src: author.avatar, alt: "", width: "64", height: "64" });
    }
    return el("span", { class: "avatar", "aria-hidden": "true" }, [author.nickname.charAt(0)]);
  }

  function renderAuthorRow(author) {
    return el("div", { class: "author" }, [
      renderAvatar(author),
      el("div", {}, [el("b", {}, [author.nickname]), el("p", {}, [author.intro])]),
    ]);
  }

  function renderTabs(groups, totalCount) {
    var items = [{ href: "#app", label: "전체", count: totalCount }].concat(
      groups.map(function (g) {
        return { href: "#cat-" + g.type, label: CAT_NAME[g.type], count: g.list.length };
      })
    );
    return el("nav", { "aria-label": "카테고리" }, [
      el(
        "ul",
        { class: "tabs" },
        items.map(function (it) {
          return el("li", {}, [el("a", { href: it.href }, [it.label, el("span", { class: "n" }, [String(it.count)])])]);
        })
      ),
    ]);
  }

  function renderHomeHeader(groups, totalCount) {
    var brandH1 = el("h1", { class: "brand-h", tabindex: "-1" }, [el("a", { class: "brand", href: "#/" }, [DATA.siteName])]);
    var children = [brandH1];
    if (groups.length >= 2) children.push(renderTabs(groups, totalCount)); // 탭 2개 이하(전체+1종류)면 숨김
    return el("header", { class: "top" }, [el("div", { class: "wrap top-in" }, children)]);
  }

  // v7.5: 홈 카드 그림은 종류·칸 모양과 상관없이 같은 액자(.frame, 4:5, contain)에 넣는다.
  function coverImgAttrs(w) {
    // width/height는 img-sizes.js의 실제 픽셀(표지·포스터 원본 비율) — CSS aspect-ratio가 실제 보이는 크기는 따로 정한다.
    var cover = workCoverSrc(w);
    var attrs = extend({ src: cover, alt: "", loading: "lazy" }, imgSizeAttrs(cover));
    var srcsetAttrs = homeCoverSrcset(w, cover);
    if (srcsetAttrs.srcset) { attrs.srcset = srcsetAttrs.srcset; attrs.sizes = srcsetAttrs.sizes; }
    return attrs;
  }

  function homeFrame(w) {
    var cover = workCoverSrc(w);
    return el("div", { class: "frame" }, cover ? [el("img", coverImgAttrs(w))] : []);
  }

  function renderFooter() {
    return el("div", { class: "foot" }, [
      el("p", {}, ["태은이의 상상으로 시작되는 특별한 이야기"]),
      el("p", { class: "small muted" }, ["© 2026 " + DATA.siteName + ". 모든 작품의 저작권은 작가에게 있어요."]),
    ]);
  }

  function renderGridCard(id, w) {
    return el("a", { href: "#/series/" + id }, [
      homeFrame(w),
      el("h3", {}, [w.title]),
      el("p", { class: "m" }, [workMetaLine(w)]),
    ]);
  }

  // 소개가 없는 시화는 imageAlt의 그림 설명(". 시는"보다 앞부분)을 소개 자리에 대신 쓴다.
  function workSummary(w) {
    if (w.summary) return w.summary;
    if (w.type === "poem" && w.imageAlt) return w.imageAlt.split(". 시는")[0];
    return "";
  }

  // 종류마다 하이라이트 하나(정보 카드·표지 그리드 둘 다에는 안 쓰고 정보 카드에서만 쓴다): 웹툰 최신 화, 음악 첫 소절, 시화 첫 줄, 영상 길이, 그림 장수.
  function firstLyricLine(transcript) {
    var lines = (transcript || "").split("\n").filter(function (l) { return l && l[0] !== "["; });
    return lines[0] || "";
  }
  function workHighlight(w) {
    if (w.type === "comic" && w.episodes && w.episodes.length) {
      var ep = w.episodes[w.episodes.length - 1];
      return { label: "최신 " + ep.n + "화", text: ep.title };
    }
    if (w.type === "music") return { label: "첫 소절", text: firstLyricLine(w.transcript) };
    if (w.type === "poem" && w.poem) return { label: "첫 줄", text: (poemStanzas(w.poem)[0] || "").split("\n")[0] };
    if (w.type === "video") return { label: "길이", text: w.duration };
    if (w.type === "art") return { label: "그림", text: (w.images ? w.images.length : 0) + "장" };
    return null;
  }

  function renderInfoCard(id, w) {
    var textChildren = [
      el("h3", {}, [w.title]),
      el("p", { class: "m" }, [workMetaLine(w) + " · " + formatKoreanDate(w.updated)]),
    ];
    var summary = workSummary(w);
    if (summary) textChildren.push(el("p", { class: "sum" }, [summary]));
    var hl = workHighlight(w);
    if (hl) textChildren.push(el("p", { class: "hl" }, [el("span", {}, [hl.label]), " " + hl.text]));
    return el("a", { href: "#/series/" + id }, [
      homeFrame(w),
      el("div", {}, textChildren),
    ]);
  }

  // solo(혼자 남은 칸)에 작품이 1개면 768+에서 카드 옆에 두는 같은 높이의 "작품 안쪽" 미리보기. 폰에서는 CSS로 숨긴다.
  function renderInsideBox(id, w) {
    if (w.type === "comic" && w.episodes && w.episodes.length) {
      var latest = w.episodes.slice(-3).reverse();
      return el("li", { class: "inside" }, [
        el("h4", {}, ["최신 회차"]),
        el("ol", {}, latest.map(function (ep) {
          return el("li", {}, [el("a", { href: "#/ep/" + id + "/" + ep.n }, [el("span", {}, [ep.n + "화"]), el("span", {}, [ep.title])])]);
        })),
      ]);
    }
    if (w.type === "music") {
      var lyricLines = (w.transcript || "").split("\n").filter(function (l) { return l && l[0] !== "["; }).slice(0, 4).join("\n");
      return el("li", { class: "inside" }, [el("h4", {}, ["가사 첫 소절"]), el("p", { class: "lines" }, [lyricLines])]);
    }
    if (w.type === "poem" && w.poem) {
      var stanzaText = poemStanzas(w.poem).slice(0, 2).join("\n\n");
      return el("li", { class: "inside" }, [el("h4", {}, ["시 앞부분"]), el("p", { class: "lines" }, [stanzaText])]);
    }
    return el("li", { class: "inside" }, [el("h4", {}, ["소개"]), el("p", { class: "lines" }, [workSummary(w)])]);
  }

  // 1024+ 짝 맞추기: 칸 순서(웹툰·음악·영상·그림)는 바꾸지 않고, 위에서부터 보면서
  // 정보 카드 칸(2개 이하)이 바로 다음 칸도 정보 카드 칸이면 짝(pair)으로 반쪽씩, 아니면 혼자(solo)라 전체 폭.
  function classifyGroups(groups) {
    var out = [];
    var i = 0;
    while (i < groups.length) {
      var g = groups[i];
      if (g.list.length >= 3) {
        out.push({ group: g, cls: "full" });
        i += 1;
        continue;
      }
      var next = groups[i + 1];
      if (next && next.list.length <= 2) {
        // g와 next를 짝으로 묶는다(둘 다 "pair" — 둘 다 소비하고 다음으로 2칸 건너뛴다)
        out.push({ group: g, cls: "few pair" });
        out.push({ group: next, cls: "few pair" });
        i += 2;
      } else {
        out.push({ group: g, cls: "solo" });
        i += 1;
      }
    }
    return out;
  }

  function renderCategorySection(entry) {
    var g = entry.group;
    var cls = entry.cls;
    var isFull = cls.indexOf("full") !== -1;
    var cards = g.list.map(function (w) {
      return el("li", { class: "card" }, [isFull ? renderGridCard(w.id, w.data) : renderInfoCard(w.id, w.data)]);
    });
    // solo(768+ 내내 2열)나 짝(pair, 768-1023만 전체 폭 2열)이 작품 1개뿐이면 옆 칸에 "작품 안쪽" 미리보기를 붙인다(CSS가 칸 모양별로 보일 범위를 가린다).
    if (!isFull && g.list.length === 1) cards.push(renderInsideBox(g.list[0].id, g.list[0].data));
    return el("section", { class: "cat " + g.type + " " + cls, id: "cat-" + g.type, "aria-labelledby": "h-" + g.type }, [
      el("div", { class: "cat-head" }, [
        el("h2", { id: "h-" + g.type, tabindex: "-1" }, [CAT_NAME[g.type]]),
        el("span", { class: "n" }, [String(g.list.length)]),
      ]),
      el("ul", { class: "grid" }, cards),
    ]);
  }

  function renderHome() {
    barEl.hidden = true; // 홈은 자체 머리(사이트 이름+탭)를 쓰고, 공용 바는 다른 화면으로 돌아갈 때 다시 켠다
    document.title = DATA.siteName;
    app.innerHTML = "";
    var works = sortedWorks();
    var author = DATA.author || { nickname: DATA.siteName, intro: "" };
    var groups = groupWorksByCategory(works);

    app.appendChild(renderHomeHeader(groups, works.length));

    if (works.length === 0) {
      app.appendChild(
        el("div", { class: "wrap" }, [
          renderAuthorRow(author),
          el("p", { class: "empty-note" }, ["아직 올린 작품이 없어요."]),
          renderFooter(),
        ])
      );
      return;
    }

    var classified = classifyGroups(groups);
    app.appendChild(
      el("div", { class: "wrap" }, [
        renderAuthorRow(author),
        el("div", { class: "secs" }, classified.map(renderCategorySection)),
        renderFooter(),
      ])
    );
  }

  function renderSeries(id) {
    var s = DATA.series[id];
    if (!s) return renderNotFound();
    if (s.type === "music") return renderMusicSeries(id, s);
    if (s.type === "video") return renderVideoSeries(id, s);
    if (s.type === "art") return renderArtSeries(id, s);
    if (s.type === "poem") return renderPoemSeries(id, s);
    return renderComicSeries(id, s);
  }

  function renderComicSeries(id, s) {
    setBar({ backHref: "#/", backText: DATA.siteName });
    document.title = s.title + " — " + DATA.siteName;

    var firstEp = s.episodes[0];
    var metaParts = [];
    if (s.characters && s.characters.length) metaParts.push("인물 " + s.characters.length + "명");
    metaParts.push(formatKoreanDate(s.updated) + " 업데이트");

    var head = el("div", { class: "d-head" }, [
      el("a", { href: s.cover, class: "cover-open", "aria-label": s.title + " 표지 크게 보기", "aria-haspopup": "dialog", "data-name": s.title, "data-sheet-alt": s.coverAlt }, [
        el("img", extend({
          class: "im",
          src: smallVariantSrc(s.cover, 400),
          srcset: smallVariantSrc(s.cover, 200) + " 200w, " + smallVariantSrc(s.cover, 400) + " 400w",
          sizes: "(min-width: 768px) 200px, 104px",
          alt: s.coverAlt,
        }, imgSizeAttrs(s.cover))),
      ]),
      el("div", {}, [el("p", { class: "kicker" }, ["웹툰"]), el("h1", {}, [s.title]), el("p", { class: "d-meta" }, [metaParts.join(" · ")])]),
      el("div", { class: "d-more" }, [
        el("p", {}, [s.summary]),
        firstEp ? el("a", { class: "btn", href: "#/ep/" + id + "/" + firstEp.n }, ["첫 화 보기"]) : null,
      ]),
    ]);

    var bodyChildren = [];
    if (s.characters && s.characters.length) {
      bodyChildren.push(
        el("section", { class: "d-cast", "aria-labelledby": "h-cast" }, [
          el("h2", { id: "h-cast" }, ["등장인물", el("span", { class: "n" }, [String(s.characters.length)])]),
          el("ul", { class: "cast" }, renderCastItems(s.characters)),
        ])
      );
    }
    bodyChildren.push(
      el("section", { "aria-labelledby": "h-eps" }, [
        el("h2", { id: "h-eps" }, ["회차", el("span", { class: "n" }, [String(s.episodes.length)]), el("span", { class: "order" }, ["최신 화부터"])]),
        el(
          "ol",
          { class: "eps" },
          s.episodes.slice().reverse().map(function (ep) {
            return el("li", { class: "ep" }, [
              el("a", { href: "#/ep/" + id + "/" + ep.n }, [
                el("img", extend({ src: epThumbSrc(id, ep), alt: "", loading: "lazy" }, imgSizeAttrs(epThumbSrc(id, ep)))),
                el("span", {}, [badge(ep.n + "화"), el("span", { class: "t" }, [ep.title])]),
              ]),
            ]);
          })
        ),
      ])
    );

    app.innerHTML = "";
    app.appendChild(el("div", { class: "wrap" }, [head, el("div", { class: "d-body" }, bodyChildren)]));
  }

  // 영상·음악·그림 상세 공용 머리: 종류(주홍) → 제목 → 정보 줄
  function renderMediaHead(kind, title, metaLine) {
    return el("header", { class: "media-head" }, [
      el("p", { class: "kicker" }, [kind]),
      el("h1", {}, [title]),
      el("p", { class: "d-meta" }, [metaLine]),
    ]);
  }

  function renderVideoSeries(id, s) {
    setBar({ backHref: "#/", backText: DATA.siteName });
    document.title = s.title + " — " + DATA.siteName;

    var videoChildren = [el("source", { src: s.src, type: "video/mp4" })];
    if (s.captions) videoChildren.push(el("track", { kind: "captions", srclang: "ko", label: "한국어", default: "" }));
    var videoEl = el("video", { controls: "", preload: "metadata", playsinline: "", poster: s.poster }, videoChildren);
    attachEndAtClamp(videoEl, s.endAt);

    var children = [
      renderMediaHead("영상", s.title, formatKoreanDate(s.updated)),
      el("div", { class: "media-box" }, [videoEl]),
      el("p", { class: "media-summary" }, [s.summary]),
    ];
    if (s.transcript) {
      children.push(
        el("details", { class: "transcript" }, [
          el("summary", {}, [s.transcriptLabel || "영상 내용 글로 보기"]),
          el("p", {}, [s.transcript]),
        ])
      );
    }
    children.push(el("footer", { class: "media-end" }, [backLink("#/", "목록으로")]));

    app.innerHTML = "";
    app.appendChild(el("div", { class: "wrap" }, children));
  }

  function renderArtSeries(id, s) {
    setBar({ backHref: "#/", backText: DATA.siteName });
    document.title = s.title + " — " + DATA.siteName;

    var imagesList = el(
      "ol",
      { class: "art-list" },
      s.images.map(function (im, i) {
        var attrs = { src: im.src, alt: im.alt || "", width: im.w, height: im.h };
        if (i > 0) attrs.loading = "lazy";
        return el("li", {}, [el("img", attrs)]);
      })
    );

    var children = [
      renderMediaHead("그림", s.title, formatKoreanDate(s.updated)),
      imagesList,
      el("p", { class: "media-summary" }, [s.summary]),
      el("footer", { class: "media-end" }, [backLink("#/", "목록으로")]),
    ];

    app.innerHTML = "";
    app.appendChild(el("div", { class: "wrap" }, children));
  }

  function renderMusicSeries(id, s) {
    setBar({ backHref: "#/", backText: DATA.siteName });
    document.title = s.title + " — " + DATA.siteName;

    var coverChild = s.poster
      ? el("a", { href: s.poster, class: "cover-open", "aria-label": s.title + " 커버 크게 보기", "aria-haspopup": "dialog", "data-name": s.title, "data-sheet-alt": s.title + " 커버" }, [
          el("img", extend({ class: "im", src: s.poster, alt: "" }, imgSizeAttrs(s.poster))),
        ])
      : el("div", { class: "im" });
    var cover = el("div", { class: "music-cover" }, [coverChild]);

    var audioEl = el("audio", { controls: "", preload: "metadata", src: s.src }, ["이 브라우저는 소리 재생을 지원하지 않아요."]);
    attachEndAtClamp(audioEl, s.endAt);

    var info = [
      el("p", { class: "kicker" }, ["음악"]),
      el("h1", {}, [s.title]),
      el("p", { class: "d-meta" }, ["노래 · " + s.duration + " · " + formatKoreanDate(s.updated)]),
      el("p", { class: "media-summary" }, [s.summary]),
      audioEl,
    ];
    if (s.transcript) {
      info.push(
        el("details", { class: "transcript" }, [
          el("summary", {}, [s.transcriptLabel || "가사 보기"]),
          el("p", {}, [s.transcript]),
        ])
      );
    }
    info.push(el("p", { class: "back-row" }, [backLink("#/", "작품 목록으로")]));

    app.innerHTML = "";
    app.appendChild(el("div", { class: "wrap" }, [el("article", { class: "music-page" }, [cover, el("div", {}, info)])]));
  }

  function renderPoemSeries(id, s) {
    setBar({ backHref: "#/", backText: DATA.siteName });
    document.title = s.title + " — " + DATA.siteName;

    var imgEl = el("img", extend({
      class: "im",
      src: poemVariantSrc(s.image.src, 800),
      srcset: poemVariantSrc(s.image.src, 480) + " 480w, " + poemVariantSrc(s.image.src, 800) + " 800w, " + s.image.src + " 1122w",
      sizes: "(min-width: 1024px) 400px, (min-width: 768px) 280px, 100vw",
      alt: s.imageAlt,
    }, imgSizeAttrs(s.image.src)));
    var coverLink = el("a", { href: s.image.src, class: "cover-open", "aria-label": s.title + " 그림 크게 보기", "aria-haspopup": "dialog", "data-name": s.title, "data-sheet-alt": s.imageAlt }, [imgEl]);

    var poemBody = el("div", { class: "poem-body" }, poemStanzas(s.poem).map(function (stanza) {
      return el("p", {}, [stanza]);
    }));

    var children = [
      el("p", { class: "kicker" }, ["시화"]),
      el("h1", {}, [s.title]),
      el("p", { class: "d-meta" }, [formatKoreanDate(s.updated) + " 업데이트"]),
      coverLink,
      poemBody,
    ];
    if (s.summary) children.push(el("p", { class: "media-summary" }, [s.summary]));
    children.push(el("p", { class: "back-row" }, [backLink("#/", "작품 목록으로")]));

    app.innerHTML = "";
    app.appendChild(el("div", { class: "wrap" }, [el("article", { class: "poem-page" }, children)]));
  }

  function renderEpisode(id, n) {
    var s = DATA.series[id];
    if (!s || !s.episodes) return renderNotFound();
    n = parseInt(n, 10);
    var epIndex = s.episodes.findIndex(function (e) { return e.n === n; });
    var ep = s.episodes[epIndex];
    if (!ep) return renderNotFound();
    var prev = s.episodes[epIndex - 1];
    var next = s.episodes[epIndex + 1];

    setBar({
      backHref: "#/series/" + id,
      backLabel: "목록",
      seriesName: ep.n + "화 " + ep.title,
      prevHref: prev ? "#/ep/" + id + "/" + prev.n : null,
      nextHref: next ? "#/ep/" + id + "/" + next.n : null,
      narrow: true,
    });
    document.title = ep.n + "화 " + ep.title + " — " + s.title;

    var cutsList = el("ol", { class: "cuts", id: "cuts", tabindex: "-1", "aria-label": ep.n + "화 컷 " + ep.cuts.length + "장" });
    ep.cuts.forEach(function (alt, i) {
      var n2 = i + 1;
      var cutSrc = "img/" + id + "/ep" + ep.n + "/" + n2 + ".jpg";
      var imgAttrs = extend({ src: cutSrc, alt: alt }, imgSizeAttrs(cutSrc));
      if (i > 0) imgAttrs.loading = "lazy";
      cutsList.appendChild(
        el("li", {}, [el("img", imgAttrs), el("span", { class: "count", "aria-hidden": "true" }, [n2 + "/" + ep.cuts.length])])
      );
    });

    var navDiv = el("div", { class: "ep-nav" }, [
      prev
        ? el("a", { href: "#/ep/" + id + "/" + prev.n }, ["이전 화"])
        : el("span", { class: "none" }, ["첫 화예요"]),
      el("a", { href: "#/series/" + id }, ["회차 목록"]),
      next
        ? el("a", { class: "next", href: "#/ep/" + id + "/" + next.n }, ["다음 화"])
        : el("span", { class: "none" }, ["다음 화 준비 중"]),
    ]);

    var endP = next
      ? el("p", {}, [ep.n + "화 끝 · 다음 이야기: " + next.title])
      : el("p", {}, [ep.n + "화 끝"]);

    var footer = el("footer", { class: "ep-end" }, [endP, navDiv]);

    app.innerHTML = "";
    app.appendChild(
      el("div", { class: "wrap-narrow" }, [
        el("header", { class: "ep-head" }, [badge(ep.n + "화"), el("h1", {}, [ep.title])]),
        cutsList,
        footer,
      ])
    );
  }

  function renderNotFound() {
    setBar(null);
    document.title = DATA.siteName;
    app.innerHTML = "";
    app.appendChild(
      el("div", { class: "wrap notfound" }, [
        el("h1", {}, ["찾을 수 없는 페이지예요"]),
        el("p", { class: "d-meta" }, ["주소가 바뀌었거나 없는 작품이에요."]),
        el("a", { class: "btn", href: "#/" }, ["홈으로"]),
      ])
    );
  }

  // route()는 우리 라우트(#/...)를 실제로 그렸으면 true, 아니면(바로가기 #app·카테고리 #cat-* 등 밖의 해시) false를 돌려준다.
  // 최초 로드 때 생기는 "주소창에 #cat-music 등이 남아 있던 경우"는 아래 최초 로드 처리(해시를 "#/"로 바꾸고 홈을 그림)가 먼저 맡으므로,
  // route()는 hashchange(이미 홈 등 뭔가 그려진 뒤)만 신경 쓰면 된다.
  function route() {
    var raw = location.hash;
    if (raw && raw.indexOf("#/") !== 0) return false;
    var hash = raw.replace(/^#/, "") || "/";
    var parts = hash.split("/").filter(Boolean);
    if (parts.length === 0) { renderHome(); return true; }
    if (parts[0] === "series" && parts[1]) { renderSeries(parts[1]); return true; }
    if (parts[0] === "ep" && parts[1] && parts[2]) { renderEpisode(parts[1], parts[2]); return true; }
    renderNotFound();
    return true;
  }

  function onHashChange() {
    if (!route()) return; // 우리 라우트가 아니면(#app, #cat-* 등) 화면·스크롤을 건드리지 않는다
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  var skipLink = document.querySelector(".skip");
  if (skipLink) {
    skipLink.addEventListener("click", function (e) {
      e.preventDefault(); // 해시를 바꾸지 않고 초점만 본문으로 옮긴다
      app.focus();
    });
  }

  // 홈 탭([전체]·카테고리) 이동: 바로가기 링크와 같은 방식 — 해시를 바꾸지 않고(hashchange의 scrollTo(0,0)와 경쟁하지 않게)
  // 직접 scrollIntoView/scrollTo + 제목에 초점을 옮긴다. JS가 안 되면 href 기본 동작(앵커 점프)으로 대체.
  app.addEventListener("click", function (e) {
    var tabLink = e.target.closest(".tabs a");
    if (!tabLink) return;
    e.preventDefault();
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var href = tabLink.getAttribute("href");
    if (href === "#app") {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      var brandH1 = document.querySelector(".brand-h");
      if (brandH1) brandH1.focus({ preventScroll: true });
      return;
    }
    var section = document.getElementById(href.slice(1));
    if (!section) return;
    section.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    var heading = section.querySelector("h2");
    if (heading) heading.focus({ preventScroll: true });
  });

  // 인물 팝업: app은 렌더마다 innerHTML만 바뀌고 요소 자체는 유지되므로 위임 리스너 1개로 모든 화면(홈·작품 상세)을 커버한다.
  var dialog = document.getElementById("person");
  if (window.HTMLDialogElement && dialog) {
    var personName = document.getElementById("person-name");
    var personImg = document.getElementById("person-img");
    var personClose = document.getElementById("person-close");
    var personOpener = null;
    app.addEventListener("click", function (e) {
      var a = e.target.closest('a[aria-haspopup="dialog"]');
      if (!a) return;
      e.preventDefault();
      personOpener = a;
      personName.textContent = a.dataset.name;
      var hrefPath = a.getAttribute("href");
      personImg.src = hrefPath;
      personImg.alt = a.dataset.sheetAlt || a.dataset.name + " 캐릭터 시트";
      var sz = window.IMG_SIZES && window.IMG_SIZES[hrefPath];
      if (sz) { personImg.width = sz[0]; personImg.height = sz[1]; } else { personImg.removeAttribute("width"); personImg.removeAttribute("height"); }
      dialog.showModal();
      dialog.scrollTop = 0;
    });
    personClose.addEventListener("click", function () {
      dialog.close();
    });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close(); // 바깥(backdrop) 클릭
    });
    dialog.addEventListener("close", function () {
      if (personOpener) personOpener.focus();
    });
  }

  window.addEventListener("hashchange", onHashChange);

  // 최초 로드: 해시가 무엇이었든(#/series/x, #cat-*, #app, 없음 등) 항상 홈에서 시작한다("맨 처음 들어가면 홈 화면이 나와야 함").
  // 초점은 안 건드린다(바로가기 링크가 첫 Tab이 되도록) — 그 점만 빼면 onHashChange와 달리 route()를 거치지 않고 바로 홈을 그린다.
  if (window.history && "scrollRestoration" in window.history) history.scrollRestoration = "manual";
  if (location.hash && location.hash !== "#/") {
    history.replaceState(null, "", location.pathname + location.search + "#/");
  }
  renderHome();
  window.scrollTo(0, 0);

  // 개발자 메뉴(site/dev.js) 훅: DATA는 위에서 한 번 복사한 지역 변수라 window.DATA를 바꿔도 안 바뀐다.
  // dev.js가 __setData로 지역 DATA까지 바꾼 뒤 __rerender로 지금 화면을 다시 그린다. 운영 동작에는 영향 없음.
  window.__setData = function (d) { DATA = d; };
  window.__rerender = function () {
    if (location.hash && location.hash !== "#/") route();
    else renderHome();
  };
})();
