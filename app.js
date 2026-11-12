(function () {
"use strict";
var BASE_URL = "https://vegamovies10.co.in/";
var WORKER_LIST = ["https://restless-glitter-f6c4.dktczn.workers.dev/?url=","https://dry-bush-87cf.umair92n.workers.dev/?url="];
var currentPage = 1, currentCategory = "", isLoading = false, hasMore = true;
var originalMetaTags = {}, loadedUrls = new Set(), totalLoaded = 0;
var moviesGrid = document.getElementById("moviesGrid");
var loader = document.getElementById("loadingIndicator");
var tabs = document.querySelectorAll(".tab");
var modal = document.getElementById("movieModal");
var modalTitle = document.getElementById("modalTitle");
var modalContent = document.getElementById("modalContent");
var preloader = document.getElementById("preloader");
var breadcrumb = document.getElementById("breadcrumb");
var pageTitle = document.getElementById("pageTitle");

// PRELOADER KILL SWITCH
function killPreloader(){
  if(preloader && preloader.style.display !== "none"){
    preloader.style.opacity = "0";
    preloader.style.display = "none";
  }
}
killPreloader();
setTimeout(killPreloader, 500);
setTimeout(killPreloader, 1000);
setTimeout(killPreloader, 2000);

async function fetchHtmlThroughWorker(targetUrl) {
  var lastErr;
  for (var i = 0; i < WORKER_LIST.length; i++) {
    var base = WORKER_LIST[i];
    try {
      var url = base + encodeURIComponent(targetUrl);
      var res = await fetch(url, { headers: { "Accept": "text/html,application/json,*/*" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var text = await res.text();
      if (!text || text.length < 30) throw new Error("Empty response");
      try { var json = JSON.parse(text); if (json.html) return json.html; if (json.body) return json.body; if (json.content) return json.content; } catch (_) {}
      return text;
    } catch (err) { lastErr = err; console.warn("[worker failed]", base, err.message); }
  }
  throw lastErr || new Error("All workers failed");
}

function storeOriginalMetaTags() {
  originalMetaTags = {
    title: document.title,
    description: (document.querySelector('meta[name="description"]')||{}).content,
    ogTitle: (document.querySelector('meta[property="og:title"]')||{}).content,
    ogDescription: (document.querySelector('meta[property="og:description"]')||{}).content,
    ogUrl: (document.querySelector('meta[property="og:url"]')||{}).content,
    ogImage: (document.querySelector('meta[property="og:image"]')||{}).content
  };
}
function restoreOriginalMetaTags() {
  if (!originalMetaTags.title) return;
  document.title = originalMetaTags.title;
  var set = function(sel,val){ var el=document.querySelector(sel); if(el&&val) el.content=val; };
  set('meta[name="description"]', originalMetaTags.description);
  set('meta[property="og:title"]', originalMetaTags.ogTitle);
  set('meta[property="og:description"]', originalMetaTags.ogDescription);
  set('meta[property="og:url"]', originalMetaTags.ogUrl);
  set('meta[property="og:image"]', originalMetaTags.ogImage);
}
function updateMetaTags(data) {
  if (data.title) document.title = data.title;
  var set = function(sel,val){ var el=document.querySelector(sel); if(el&&val) el.content=val; };
  set('meta[name="description"]', data.description);
  set('meta[property="og:title"]', data.ogTitle || data.title);
  set('meta[property="og:description"]', data.ogDescription || data.description);
  set('meta[property="og:url"]', data.ogUrl);
  set('meta[property="og:image"]', data.ogImage);
}
function extractMetaData(doc) {
  var meta = { title: doc.title };
  var m = function(p){ var el=doc.querySelector('meta[property="'+p+'"]'); return el?el.content:null; };
  meta.ogTitle = m("og:title") || meta.title;
  meta.ogDescription = m("og:description");
  meta.ogImage = m("og:image");
  meta.ogUrl = m("og:url");
  var d = doc.querySelector('meta[name="description"]');
  meta.description = d ? d.content : null;
  return meta;
}

function updatePageTitle(title) { if(!pageTitle) return; var h1=pageTitle.querySelector("h1"); if(h1) h1.textContent=title||"Latest Releases"; }
function updateBreadcrumb(cat) {
  if(!breadcrumb) return;
  if(cat) breadcrumb.innerHTML = '<a href="?">Home</a> <span>›</span> <span>'+cat.replace(/-/g," ")+'</span>';
  else breadcrumb.innerHTML = '<a href="?">Home</a>';
}
function renderSkeletons(count) {
  if(!moviesGrid) return;
  moviesGrid.innerHTML = "";
  for(var i=0;i<count;i++){ var s=document.createElement("div"); s.className="skeleton"; moviesGrid.appendChild(s); }
}
function updateURLParams(key, val) {
  var url = new URL(window.location);
  url.searchParams.delete("category");
  if(val) url.searchParams.set("category", val);
  window.history.replaceState({}, "", url);
}
function buildPageUrl(page, category) {
  var base = BASE_URL.replace(/\/$/, "");
  if(category) return page<=1 ? base+"/"+category+"/" : base+"/"+category+"/page/"+page+"/";
  return page<=1 ? base+"/" : base+"/page/"+page+"/";
}

function createCard(item) {
  try {
    var titleAnchor = item.querySelector("a[title]") || item.querySelector("h2 a") || item.querySelector("a");
    if(!titleAnchor) return null;
    var link = titleAnchor.getAttribute("href") || "";
    if(!link) return null;
    if(loadedUrls.has(link)) return null;
    loadedUrls.add(link);
    var title = (titleAnchor.getAttribute("title") || titleAnchor.textContent || "").trim();
    var img = item.querySelector("img");
    var poster = img ? (img.getAttribute("data-src") || img.getAttribute("src") || "") : "";
    if(poster.indexOf("//")===0) poster="https:"+poster;
    else if(poster.indexOf("/")===0) poster=BASE_URL.replace(/\/$/,"")+poster;
    if(!poster) poster="https://via.placeholder.com/300x450/111/333?text=No+Poster";
    var metaSpan = item.querySelector(".entry-meta .date") || item.querySelector(".date") || item.querySelector("time");
    var dateText = metaSpan ? metaSpan.textContent.trim() : "Recently Added";
    if(link.indexOf("/")===0) link=BASE_URL.replace(/\/$/,"")+link;
    var card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = '<div class="poster-box"><img src="'+poster+'" alt="'+title.replace(/"/g,"&quot;")+'" loading="lazy" /><div class="play-btn"><i class="fas fa-play"></i></div><div class="card-overlay"><div class="movie-date"><i class="fas fa-calendar-alt"></i> '+dateText+'</div><div class="movie-title">'+title+'</div></div></div>';
    card.addEventListener("click", function(){ if(link) openModal(link, title); });
    return card;
  } catch(e) { console.error("[createCard]",e); return null; }
}

function extractItems(doc) {
  var patterns = [".post.entry","article.post",".entry-card",".grid article",".movies-grid article",".movie-item",".item",".post","article"];
  for(var i=0;i<patterns.length;i++){ var items=doc.querySelectorAll(patterns[i]); if(items.length>0) return items; }
  return [];
}

async function loadMovies() {
  if(isLoading || !hasMore) return;
  isLoading = true;
  if(loader) loader.style.display="block";
  try {
    var target = buildPageUrl(currentPage, currentCategory);
    console.log("[load]", target);
    var html = await fetchHtmlThroughWorker(target);
    var doc = new DOMParser().parseFromString(html,"text/html");
    var items = extractItems(doc);
    if(currentPage===1) moviesGrid.innerHTML="";
    if(items.length===0){
      hasMore=false;
      if(currentPage===1){ moviesGrid.innerHTML="<p style='color:#ff6b6b;text-align:center;grid-column:1/-1;padding:30px'>No content found on page 1. Source or worker may be down.</p>"; }
      else { var end=document.createElement("div"); end.style.cssText="grid-column:1/-1;padding:20px;text-align:center;color:#666;font-size:13px"; end.textContent="— End of list —"; moviesGrid.appendChild(end); }
      return;
    }
    var added=0;
    items.forEach(function(item){ var card=createCard(item); if(card){ moviesGrid.appendChild(card); added++; totalLoaded++; } });
    console.log("[load] page", currentPage, "→", added, "cards added,", totalLoaded, "total");
    if(added===0 && currentPage>1){
      hasMore=false;
      var end2=document.createElement("div"); end2.style.cssText="grid-column:1/-1;padding:20px;text-align:center;color:#666;font-size:13px"; end2.textContent="— End of list —"; moviesGrid.appendChild(end2);
      return;
    }
    currentPage++;
  } catch(err) {
    console.error("[loadMovies]", err);
    if(currentPage>1) hasMore=false;
    if(currentPage===1 && moviesGrid){
      moviesGrid.innerHTML="<div style='grid-column:1/-1;padding:30px;text-align:center;color:#ff6b6b;font-size:14px'>❌ Failed to fetch content.<br><small style='color:#aaa'>"+(
      err.message||"Unknown error")+"</small></div>";
    }
  } finally {
    isLoading = false;
    if(loader) loader.style.display="none";
  }
}

function resetAndLoad() {
  currentPage = 1;
  hasMore = true;
  totalLoaded = 0;
  loadedUrls.clear();
  moviesGrid.innerHTML = "";
  renderSkeletons(8);
  loadMovies();
}

async function openModal(targetUrl, title) {
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
  modalTitle.textContent = title || "Loading...";
  modalContent.innerHTML = "<p style='color:#aaa'>Loading details...</p>";
  try {
    var html = await fetchHtmlThroughWorker(targetUrl);
    var doc = new DOMParser().parseFromString(html,"text/html");
    var meta = extractMetaData(doc);
    updateMetaTags(meta);
    var contentEl = doc.querySelector(".entry-content") || doc.querySelector(".post-content") || doc.querySelector("article .content") || doc.querySelector("article") || doc.querySelector("main");
    var bodyHtml = contentEl ? contentEl.innerHTML : "<p>No content available.</p>";
    var container = document.createElement("div");
    container.innerHTML = bodyHtml;
    container.querySelectorAll("img").forEach(function(img){
      var s = img.getAttribute("src") || img.getAttribute("data-src") || "";
      if(s.indexOf("//")===0) img.src="https:"+s;
      else if(s.indexOf("/")===0) img.src=BASE_URL.replace(/\/$/,"")+s;
    });
    container.querySelectorAll("a").forEach(function(a){
      try {
        var href = a.getAttribute("href") || "";
        if(!href) return;
        var isInternal = href.indexOf(BASE_URL)===0 || href.indexOf("/")===0 || href.indexOf("veqamovies")!==-1;
        if(!isInternal){ a.target="_blank"; a.rel="noopener noreferrer"; return; }
        if(href.indexOf("nexdrive")!==-1){
          a.classList.add("nx-download-btn");
          a.setAttribute("data-url", href);
          a.removeAttribute("target");
          a.removeAttribute("rel");
          a.href = "javascript:void(0)";
        } else {
          a.removeAttribute("target");
          a.removeAttribute("rel");
        }
      } catch(_){}
    });
    modalContent.innerHTML = container.innerHTML;
    modalContent.querySelectorAll("a.nx-download-btn").forEach(function(a){
      a.addEventListener("click", function(e){
        e.preventDefault();
        openNexdrivePopup(a.dataset.url);
      });
    });
  } catch(err) {
    console.error("[openModal]", err);
    modalContent.innerHTML = "<p style='color:#ff6b6b'>Failed to load details. " + (err.message||"") + "</p>";
  }
}

function closeModal() {
  modal.classList.remove("show");
  document.body.style.overflow = "";
  restoreOriginalMetaTags();
}

function setupEvents() {
  tabs.forEach(function(tab){
    tab.addEventListener("click", function(){
      tabs.forEach(function(t){ t.classList.remove("active"); });
      this.classList.add("active");
      currentCategory = this.dataset.category || "";
      updatePageTitle(this.textContent.trim());
      updateBreadcrumb(currentCategory);
      updateURLParams("category", currentCategory);
      resetAndLoad();
    });
  });
  var closeBtn = document.getElementById("closeModal");
  if(closeBtn) closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function(e){ if(e.target===modal) closeModal(); });
  window.addEventListener("keydown", function(e){
    if(e.key==="Escape" && modal.classList.contains("show")) closeModal();
  });
  var closeDirect = document.getElementById("closeDirectPost");
  if(closeDirect) closeDirect.addEventListener("click", function(){
    var view = document.getElementById("directPostView");
    if(view) view.classList.remove("active");
  });
}

function setupInfiniteScroll() {
  var ticking = false;
  window.addEventListener("scroll", function(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var winHeight = window.innerHeight;
      var docHeight = document.documentElement.scrollHeight;
      if(docHeight - (scrollTop + winHeight) < 600){
        if(!isLoading && hasMore) loadMovies();
      }
      ticking = false;
    });
  }, { passive: true });
  if(loader && "IntersectionObserver" in window){
    var observer = new IntersectionObserver(function(entries){
      if(entries[0].isIntersecting && !isLoading && hasMore) loadMovies();
    }, { rootMargin: "400px" });
    observer.observe(loader);
  }
}

function handleURLParams() {
  if(window.location.search.indexOf("m=1")!==-1){
    var clean = window.location.href.split("?")[0];
    window.history.replaceState({}, "", clean);
  }
  var params = new URLSearchParams(window.location.search);
  var cat = params.get("category");
  if(cat){
    currentCategory = cat;
    tabs.forEach(function(t){
      t.classList.remove("active");
      if(t.dataset.category===cat) t.classList.add("active");
    });
    updatePageTitle(cat.replace(/-/g," "));
    updateBreadcrumb(cat);
  }
  renderSkeletons(8);
  loadMovies();
}

document.addEventListener("DOMContentLoaded", function(){
  setTimeout(killPreloader, 600);
  storeOriginalMetaTags();
  setupEvents();
  handleURLParams();
  setupInfiniteScroll();
});

function replaceVegamoviesText() {
  var siteName = 'My Movies Pro';
  var contentAreas = ['.entry-content', '#modalContent', '#directPostContent', '.modal-body'];
  contentAreas.forEach(function(selector){
    document.querySelectorAll(selector).forEach(function(area){
      area.querySelectorAll('span, p, div, li, td, strong, b, i, em').forEach(function(el){ replaceTextInNode(el, siteName); });
    });
  });
}
function replaceTextInNode(element, siteName) {
  var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  var node;
  while(node = walker.nextNode()){
    var newText = node.textContent;
    newText = newText.replace(/My Movies Pro\.select/gi, siteName);
    newText = newText.replace(/vegamovies\.select/gi, siteName);
    newText = newText.replace(/https:\/\/vegamovies\.select/gi, siteName);
    newText = newText.replace(/https:\/\/My Movies Pro\.select/gi, siteName);
    newText = newText.replace(/\bvegamovies\b/gi, siteName);
    if(newText !== node.textContent) node.textContent = newText;
  }
}
new MutationObserver(function(){ setTimeout(replaceVegamoviesText, 500); }).observe(document.body, { childList: true, subtree: true });
window.replaceVegamovies = replaceVegamoviesText;
document.addEventListener('DOMContentLoaded', replaceVegamoviesText);
setTimeout(replaceVegamoviesText, 300);

function closeNx(){
  document.getElementById("nxPopup").classList.add("hidden");
  document.getElementById("nxContent").innerHTML = "Loading...";
}
async function openNexdrivePopup(url){
  try {
    var popup = document.getElementById("nxPopup");
    var contentBox = document.getElementById("nxContent");
    popup.classList.remove("hidden");
    contentBox.innerHTML = "Loading download links...";
    var api = "https://dry-bush-87cf.umair92n.workers.dev/?url=" + encodeURIComponent(url);
    var res = await fetch(api);
    var raw = await res.text();
    var data;
    try { data = JSON.parse(raw); } catch(e) { data = { html: raw }; }
    if(!data.html) throw new Error("No HTML returned");
    var temp = document.createElement("div");
    temp.innerHTML = data.html;
    var content = temp.querySelector(".card") || temp.querySelector(".entry-content") || temp;
    content.querySelectorAll("a").forEach(function(a){
      if(a.href && a.href.indexOf("fast-dl")!==-1){
        a.href = "https://dry-bush-87cf.umair92n.workers.dev/?url=" + encodeURIComponent(a.href);
        a.target = "_blank";
      } else {
        a.remove();
      }
    });
    contentBox.innerHTML = content.innerHTML || "No links found.";
  } catch(err) {
    console.error("[openNexdrivePopup]", err);
    document.getElementById("nxContent").innerText = "❌ Download links load nahi ho paye — " + (err.message||"");
  }
}
})();
