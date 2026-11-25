const KONFIG = {
  radiusRevealDesktop: 46, // Radius lensa reveal saat mouse bergerak di laptop/PC (px)
  radiusRevealMobile: 38, // Radius lensa reveal saat jari mengusap di smartphone (px)
  durasiJejakMs: 250, // Durasi surut halus jejak setelah berhenti bergerak (ms)
  durasiLepasMs: 170, // Kecepatan lensa menutup saat jari diangkat atau mouse keluar (ms)
  kelancaranLensa: 0.32, // Faktor interpolasi kehalusan gerak lensa
  penyelarasanBelakang: {
    skala: 1.045, // Skala agar ukuran wajah foto petani tepat sejajar foto depan
    pusatX: 0.507, // Titik pusat wajah (rasio lebar)
    pusatY: 0.278, // Titik pusat wajah (rasio tinggi)
    geserX: -0.012, // Geser horizontal (rasio lebar)
    geserY: 0.098, // Geser vertikal (rasio tinggi)
  },
  durasiScrollLenis: 1.15, // Durasi kehalusan smooth scroll Lenis (detik)
  tinggiHeader: 86, // Offset tinggi navbar pil mengambang (px)
};

let lenisInstance = null;
let aktifkanTabPortfolio = null;

document.addEventListener("DOMContentLoaded", () => {
  initSmoothScroll();
  initInteractiveReveal();
  initNavigation();
  initScrollAnimations();
  initFoldersAndPortfolio();
  initModalAndCV();
  initContactForm();
  initFooterYear();
});

window.addEventListener("load", () => {
  segarkanScroll();
});

// ==================== 1. LENIS + SINKRONISASI GSAP ==================== //
function initSmoothScroll() {
  const kurangiGerakan = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const adaGSAP = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  const adaLenis = typeof Lenis !== "undefined";

  if (adaGSAP) {
    gsap.registerPlugin(ScrollTrigger);
  }

  if (!adaLenis || kurangiGerakan) {
    return;
  }

  lenisInstance = new Lenis({
    autoRaf: !adaGSAP, // Loop diatur gsap.ticker agar 100% sinkron dengan ScrollTrigger
    duration: KONFIG.durasiScrollLenis,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false, // Biarkan gulir jari smartphone alami & tidak bentrok dengan reveal foto
  });

  if (adaGSAP) {
    lenisInstance.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenisInstance.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  }
}

function segarkanScroll() {
  if (lenisInstance) {
    lenisInstance.resize();
  }
  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.refresh();
  }
}

// ==================== 2. INTERACTIVE IMAGE REVEAL (JS MURNI) ==================== //
function initInteractiveReveal() {
  const container = document.getElementById("reveal-container");
  const fotoProfil = document.getElementById("foto-profil");
  const fotoKarakter = document.getElementById("foto-karakter");
  const canvas = document.getElementById("reveal-canvas");

  if (!container || !fotoProfil || !canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const sourceProfilCanvas = document.createElement("canvas");
  const sourceProfilCtx = sourceProfilCanvas.getContext("2d");

  const sourceKarakterCanvas = document.createElement("canvas");
  const sourceKarakterCtx = sourceKarakterCanvas.getContext("2d");

  const revealMaskCanvas = document.createElement("canvas");
  const revealMaskCtx = revealMaskCanvas.getContext("2d");

  let lebarCss = 0;
  let tinggiCss = 0;
  let sedangMenyentuh = false;
  let posisiTerakhir = null;
  let rafId = null;

  let targetX = 0;
  let targetY = 0;
  let lensaX = 0;
  let lensaY = 0;
  let radiusTarget = KONFIG.radiusRevealDesktop;
  let waktuGerakTerakhir = 0;
  let kekuatanLensa = 0;
  let lensaAktif = false;
  let jejak = [];
  const MAKS_JEJAK = 34;

  function gambarDenganCover(targetCtx, img, lebar, tinggi, penyelarasan = null) {
    const rasioGambar = img.naturalWidth / img.naturalHeight;
    const rasioWadah = lebar / tinggi;

    let lebarGambar = lebar;
    let tinggiGambar = tinggi;
    let offsetX = 0;
    let offsetY = 0;

    if (rasioGambar > rasioWadah) {
      tinggiGambar = tinggi;
      lebarGambar = tinggi * rasioGambar;
      offsetX = (lebar - lebarGambar) / 2;
    } else {
      lebarGambar = lebar;
      tinggiGambar = lebar / rasioGambar;
      offsetY = tinggi - tinggiGambar;
    }

    targetCtx.save();
    targetCtx.clearRect(0, 0, lebar, tinggi);

    if (penyelarasan) {
      const cx = offsetX + lebarGambar * penyelarasan.pusatX;
      const cy = offsetY + tinggiGambar * penyelarasan.pusatY;
      const tx = lebarGambar * penyelarasan.geserX;
      const ty = tinggiGambar * penyelarasan.geserY;
      targetCtx.translate(cx + tx, cy + ty);
      targetCtx.scale(penyelarasan.skala, penyelarasan.skala);
      targetCtx.translate(-cx, -cy);
    }

    targetCtx.drawImage(img, offsetX, offsetY, lebarGambar, tinggiGambar);
    targetCtx.restore();
  }

  function gambarCadanganProfil(targetCtx, lebar, tinggi) {
    const grad = targetCtx.createLinearGradient(0, 0, 0, tinggi);
    grad.addColorStop(0, "#14161c");
    grad.addColorStop(1, "#050608");
    targetCtx.fillStyle = grad;
    targetCtx.fillRect(0, 0, lebar, tinggi);

    targetCtx.fillStyle = "#f5f7fa";
    targetCtx.font = "700 18px 'Plus Jakarta Sans', sans-serif";
    targetCtx.textAlign = "center";
    targetCtx.fillText("Foto Profil Utama", lebar / 2, tinggi / 2 - 10);

    targetCtx.fillStyle = "#9ca3af";
    targetCtx.font = "500 13px 'Plus Jakarta Sans', sans-serif";
    targetCtx.fillText("Tambahkan gambar/profil.png", lebar / 2, tinggi / 2 + 16);
  }

  function gambarLapisanPertamaPenuh() {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, lebarCss, tinggiCss);
    ctx.drawImage(sourceProfilCanvas, 0, 0, lebarCss, tinggiCss);
    ctx.restore();
  }

  function siapkanKanvas() {
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    hentikanLoop();
    lebarCss = rect.width;
    tinggiCss = rect.height;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lebarFisik = Math.round(lebarCss * dpr);
    const tinggiFisik = Math.round(tinggiCss * dpr);

    [canvas, sourceProfilCanvas, sourceKarakterCanvas, revealMaskCanvas].forEach((c) => {
      c.width = lebarFisik;
      c.height = tinggiFisik;
    });

    [ctx, sourceProfilCtx, sourceKarakterCtx, revealMaskCtx].forEach((cCtx) => {
      cCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });

    if (fotoProfil.complete && fotoProfil.naturalWidth > 0) {
      gambarDenganCover(sourceProfilCtx, fotoProfil, lebarCss, tinggiCss);
    } else {
      gambarCadanganProfil(sourceProfilCtx, lebarCss, tinggiCss);
    }

    if (fotoKarakter && fotoKarakter.complete && fotoKarakter.naturalWidth > 0) {
      gambarDenganCover(
        sourceKarakterCtx,
        fotoKarakter,
        lebarCss,
        tinggiCss,
        KONFIG.penyelarasanBelakang
      );
    } else {
      sourceKarakterCtx.clearRect(0, 0, lebarCss, tinggiCss);
    }

    jejak = [];
    lensaAktif = false;
    kekuatanLensa = 0;
    posisiTerakhir = null;
    gambarLapisanPertamaPenuh();
    container.classList.remove("revealing");
    container.classList.add("canvas-ready");
  }

  function ambilKoordinat(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function gerakkanLensa(x, y, tipePointer) {
    const sekarang = performance.now();
    radiusTarget =
      tipePointer === "touch" ? KONFIG.radiusRevealMobile : KONFIG.radiusRevealDesktop;

    if (!lensaAktif || !posisiTerakhir) {
      lensaX = x;
      lensaY = y;
    } else {
      const jarak = Math.hypot(x - posisiTerakhir.x, y - posisiTerakhir.y);
      if (jarak < 1) return;

      const langkah = Math.max(5, radiusTarget * 0.24);
      const jumlah = Math.min(14, Math.max(1, Math.ceil(jarak / langkah)));
      for (let i = 1; i <= jumlah; i++) {
        const t = i / jumlah;
        jejak.push({
          x: posisiTerakhir.x + (x - posisiTerakhir.x) * t,
          y: posisiTerakhir.y + (y - posisiTerakhir.y) * t,
          radius: radiusTarget * 0.72,
          lahir: sekarang,
          masaHidup: KONFIG.durasiJejakMs,
        });
      }
      if (jejak.length > MAKS_JEJAK) {
        jejak = jejak.slice(jejak.length - MAKS_JEJAK);
      }
    }

    targetX = x;
    targetY = y;
    posisiTerakhir = { x, y };
    waktuGerakTerakhir = sekarang;
    lensaAktif = true;

    container.classList.add("revealing");
    mulaiLoop();
  }

  function gambarLingkaranMasker(targetCtx, x, y, radius, alpha) {
    if (radius <= 1 || alpha <= 0.01) return;

    const gradien = targetCtx.createRadialGradient(x, y, radius * 0.48, x, y, radius);
    gradien.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradien.addColorStop(0.7, `rgba(255, 255, 255, ${(alpha * 0.88).toFixed(3)})`);
    gradien.addColorStop(1, "rgba(255, 255, 255, 0)");

    targetCtx.fillStyle = gradien;
    targetCtx.beginPath();
    targetCtx.arc(x, y, radius, 0, Math.PI * 2);
    targetCtx.fill();
  }

  function renderFrame(waktuSekarang) {
    const diamMs = waktuSekarang - waktuGerakTerakhir;
    const sedangBergerak = lensaAktif && diamMs < KONFIG.durasiJejakMs;

    if (sedangBergerak) {
      kekuatanLensa = Math.min(1, kekuatanLensa + 0.22);
      lensaX += (targetX - lensaX) * KONFIG.kelancaranLensa;
      lensaY += (targetY - lensaY) * KONFIG.kelancaranLensa;
    } else {
      lensaAktif = false;
      kekuatanLensa = Math.max(0, kekuatanLensa - 0.14);
    }

    jejak = jejak.filter((titik) => waktuSekarang - titik.lahir < titik.masaHidup);

    gambarLapisanPertamaPenuh();

    if (kekuatanLensa > 0.01 || jejak.length > 0) {
      revealMaskCtx.save();
      revealMaskCtx.globalCompositeOperation = "source-over";
      revealMaskCtx.clearRect(0, 0, lebarCss, tinggiCss);

      for (let i = 0; i < jejak.length; i++) {
        const titik = jejak[i];
        const progres = (waktuSekarang - titik.lahir) / titik.masaHidup;
        const alpha = Math.pow(1 - progres, 1.8) * 0.85;
        const r = titik.radius * (0.55 + 0.45 * (1 - progres));
        gambarLingkaranMasker(revealMaskCtx, titik.x, titik.y, r, alpha);
      }

      if (kekuatanLensa > 0.01) {
        const radiusLensa = radiusTarget * (0.5 + 0.5 * kekuatanLensa);
        gambarLingkaranMasker(revealMaskCtx, lensaX, lensaY, radiusLensa, kekuatanLensa);
      }

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(revealMaskCanvas, 0, 0, lebarCss, tinggiCss);
      ctx.restore();

      revealMaskCtx.globalCompositeOperation = "source-in";
      revealMaskCtx.drawImage(sourceKarakterCanvas, 0, 0, lebarCss, tinggiCss);
      revealMaskCtx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(revealMaskCanvas, 0, 0, lebarCss, tinggiCss);
      ctx.restore();

      rafId = requestAnimationFrame(renderFrame);
    } else {
      container.classList.remove("revealing");
      rafId = null;
    }
  }

  function mulaiLoop() {
    if (rafId === null) {
      rafId = requestAnimationFrame(renderFrame);
    }
  }

  function hentikanLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  canvas.addEventListener("pointerenter", () => {
    posisiTerakhir = null;
  });

  canvas.addEventListener("pointerdown", (e) => {
    posisiTerakhir = null;

    if (e.pointerType !== "mouse") {
      sedangMenyentuh = true;
      try {
        if (canvas.setPointerCapture) {
          canvas.setPointerCapture(e.pointerId);
        }
      } catch (_) {
      }
    }

    const titik = ambilKoordinat(e);
    gerakkanLensa(titik.x, titik.y, e.pointerType);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" || sedangMenyentuh) {
      const titik = ambilKoordinat(e);
      gerakkanLensa(titik.x, titik.y, e.pointerType);
    }
  });

  function akhiriInteraksi() {
    sedangMenyentuh = false;
    lensaAktif = false;
    posisiTerakhir = null;

    const sekarang = performance.now();
    for (let i = 0; i < jejak.length; i++) {
      const sisa = jejak[i].lahir + jejak[i].masaHidup - sekarang;
      if (sisa > KONFIG.durasiLepasMs) {
        jejak[i].lahir = sekarang;
        jejak[i].masaHidup = KONFIG.durasiLepasMs;
      }
    }
  }

  canvas.addEventListener("pointerup", akhiriInteraksi);
  canvas.addEventListener("pointercancel", akhiriInteraksi);
  canvas.addEventListener("pointerleave", akhiriInteraksi);

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  const cekDanSiapkan = () => siapkanKanvas();
  if (fotoProfil.complete) {
    siapkanKanvas();
  } else {
    fotoProfil.addEventListener("load", cekDanSiapkan, { once: true });
    fotoProfil.addEventListener("error", cekDanSiapkan, { once: true });
  }
  if (fotoKarakter) {
    if (fotoKarakter.complete) {
      siapkanKanvas();
    } else {
      fotoKarakter.addEventListener("load", cekDanSiapkan, { once: true });
      fotoKarakter.addEventListener("error", cekDanSiapkan, { once: true });
    }
  }

  let timerResize = null;
  window.addEventListener("resize", () => {
    clearTimeout(timerResize);
    timerResize = setTimeout(() => {
      const lebarBaru = container.getBoundingClientRect().width;
      if (Math.abs(lebarBaru - lebarCss) > 2) {
        siapkanKanvas();
      }
    }, 180);
  });
}

// ==================== 3. FLOATING PILL NAVBAR + MASKOT GESER ==================== //
function initNavigation() {
  const header = document.getElementById("header");
  const navPill = document.getElementById("navbar-pill");
  const navIndicator = document.getElementById("nav-indicator");
  const navMascot = document.getElementById("nav-mascot");
  const zoneLight = document.getElementById("zone-light");
  const menuToggle = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");
  const navLinks = document.querySelectorAll(".nav-link");
  const semuaTautanAnchor = document.querySelectorAll('a[href^="#"]:not(#modal-demo)');
  const sections = document.querySelectorAll("main section[id]");

  function posisikanMaskotDanPil(linkAktif) {
    if (!navPill || !navIndicator || !navMascot || !linkAktif) return;
    if (window.innerWidth <= 640) return;

    const pillRect = navPill.getBoundingClientRect();
    const linkRect = linkAktif.getBoundingClientRect();
    const offsetKiri = linkRect.left - pillRect.left;
    const lebar = linkRect.width;

    navIndicator.style.width = `${lebar}px`;
    navIndicator.style.transform = `translateX(${offsetKiri}px)`;

    const tengahMaskot = offsetKiri + lebar / 2 - 16;
    navMascot.style.transform = `translateX(${tengahMaskot}px)`;
  }

  function setLinkAktif(hrefTarget) {
    let targetEl = null;
    navLinks.forEach((link) => {
      const cocok = link.getAttribute("href") === hrefTarget;
      link.classList.toggle("active", cocok);
      if (cocok) targetEl = link;
    });
    if (targetEl) posisikanMaskotDanPil(targetEl);
  }

  function tutupMenuMobile() {
    if (!menuToggle || !navMenu) return;
    menuToggle.classList.remove("active");
    navMenu.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      const terbuka = navMenu.classList.toggle("open");
      menuToggle.classList.toggle("active", terbuka);
      menuToggle.setAttribute("aria-expanded", String(terbuka));
    });

    document.addEventListener("click", (e) => {
      if (header && !header.contains(e.target) && navMenu.classList.contains("open")) {
        tutupMenuMobile();
      }
    });
  }

  semuaTautanAnchor.forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const elemenTarget = document.querySelector(targetId);
      if (!elemenTarget) return;

      e.preventDefault();
      tutupMenuMobile();

      if (link.classList.contains("nav-link")) {
        setLinkAktif(targetId);
      }

      if (lenisInstance) {
        lenisInstance.scrollTo(elemenTarget, { offset: targetId === "#home" ? 0 : -KONFIG.tinggiHeader });
      } else {
        elemenTarget.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  function perbaruiTemaNavbar() {
    if (!header || !zoneLight) return;
    const batas = zoneLight.getBoundingClientRect().top;
    header.classList.toggle("on-light", batas <= 70);
  }

  window.addEventListener("scroll", perbaruiTemaNavbar, { passive: true });
  perbaruiTemaNavbar();

  const linkAwal = document.querySelector(".nav-link.active");
  if (linkAwal) {
    requestAnimationFrame(() => posisikanMaskotDanPil(linkAwal));
  }

  window.addEventListener("resize", () => {
    const aktif = document.querySelector(".nav-link.active");
    if (aktif) posisikanMaskotDanPil(aktif);
  });

  const navIds = new Set(["home", "about", "portfolio", "contact"]);
  if (sections.length > 0) {
    const observerNav = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idAktif = entry.target.getAttribute("id");
          if (idAktif && navIds.has(idAktif)) {
            setLinkAktif(`#${idAktif}`);
          }
        });
      },
      { rootMargin: "-38% 0px -52% 0px" }
    );

    sections.forEach((sec) => {
      if (navIds.has(sec.id)) observerNav.observe(sec);
    });
  }
}

// ==================== 4. ANIMASI SCROLL (GSAP + SCROLLTRIGGER) ==================== //
function initScrollAnimations() {
  const skillBars = document.querySelectorAll(".skill-progress");

  function isiSkillLangsung() {
    skillBars.forEach((bar) => {
      bar.style.width = `${bar.dataset.level || 0}%`;
    });
  }

  const kurangiGerakan = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const adaGSAP = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";

  if (!adaGSAP || kurangiGerakan) {
    isiSkillLangsung();
    return;
  }

  gsap.from("#hero-welcome", {
    y: 42,
    opacity: 0,
    duration: 1.05,
    ease: "power3.out",
    clearProps: "opacity",
  });

  gsap.to("#hero-bg-img", {
    yPercent: 14,
    scale: 1.08,
    ease: "none",
    scrollTrigger: {
      trigger: "#home",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });

  gsap.to("#hero-welcome-wrap", {
    y: -110,
    opacity: 0.15,
    ease: "none",
    scrollTrigger: {
      trigger: "#home",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });

  gsap.to("#hero-person-img", {
    y: 45,
    scale: 1.04,
    ease: "none",
    scrollTrigger: {
      trigger: "#home",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });

  gsap.from(".about-main-title", {
    y: 28,
    opacity: 0,
    duration: 0.75,
    ease: "power2.out",
    clearProps: "transform,opacity",
    scrollTrigger: { trigger: ".about-main-title", start: "top 86%", once: true },
  });

  gsap.from(".about-left, .about-center, .about-right", {
    y: 30,
    opacity: 0,
    duration: 0.8,
    stagger: 0.14,
    ease: "power3.out",
    clearProps: "transform,opacity",
    scrollTrigger: { trigger: ".about-stage", start: "top 82%", once: true },
  });

  gsap.from(".timeline-item", {
    y: 22,
    opacity: 0,
    duration: 0.6,
    stagger: 0.08,
    ease: "power2.out",
    clearProps: "transform,opacity",
    scrollTrigger: { trigger: ".timeline-grid", start: "top 84%", once: true },
  });

  ScrollTrigger.create({
    trigger: "#skills",
    start: "top 82%",
    once: true,
    onEnter: () => {
      skillBars.forEach((bar) => {
        gsap.to(bar, {
          width: `${bar.dataset.level || 0}%`,
          duration: 1.05,
          ease: "power3.out",
        });
      });
    },
  });

  gsap.from(".folder-card", {
    y: 34,
    opacity: 0,
    duration: 0.75,
    stagger: 0.14,
    ease: "power3.out",
    clearProps: "transform,opacity",
    scrollTrigger: { trigger: ".folders-grid", start: "top 85%", once: true },
  });

  const bridgeTitle = document.getElementById("bridge-title");
  if (bridgeTitle) {
    gsap.fromTo(
      bridgeTitle,
      { scale: 0.74, opacity: 0.25 },
      {
        scale: 1.18,
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: "#theme-bridge",
          start: "top 90%",
          end: "bottom 38%",
          scrub: 0.6,
        },
      }
    );
  }

  gsap.from(".white-card", {
    y: 26,
    opacity: 0,
    duration: 0.65,
    stagger: 0.12,
    ease: "power2.out",
    clearProps: "transform,opacity",
    scrollTrigger: { trigger: "#contact", start: "top 84%", once: true },
  });
}

// ==================== 5. 3D FOLDERS, TAB PORTFOLIO & CAROUSEL ==================== //
function initFoldersAndPortfolio() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const folderCards = document.querySelectorAll(".folder-card");
  const viewport = document.getElementById("carousel-viewport");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");

  function bukaTab(namaTab, scrollKePortfolio = false) {
    tabBtns.forEach((btn) => {
      const aktif = btn.dataset.tab === namaTab;
      btn.classList.toggle("active", aktif);
      btn.setAttribute("aria-selected", String(aktif));
    });

    let panelAktif = null;
    tabPanels.forEach((panel) => {
      const cocok = panel.dataset.panel === namaTab;
      panel.classList.toggle("active", cocok);
      if (cocok) panelAktif = panel;
    });

    if (viewport) {
      viewport.scrollTo({ left: 0, behavior: "smooth" });
    }

    if (typeof gsap !== "undefined" && panelAktif) {
      const cards = panelAktif.querySelectorAll(".showcase-card");
      gsap.fromTo(
        cards,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.42,
          stagger: 0.08,
          ease: "power2.out",
          clearProps: "transform,opacity",
        }
      );
    }

    if (scrollKePortfolio) {
      const portfolioEl = document.getElementById("portfolio");
      if (portfolioEl) {
        if (lenisInstance) {
          lenisInstance.scrollTo(portfolioEl, { offset: -KONFIG.tinggiHeader });
        } else {
          portfolioEl.scrollIntoView({ behavior: "smooth" });
        }
      }
    }

    segarkanScroll();
  }

  aktifkanTabPortfolio = bukaTab;

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => bukaTab(btn.dataset.tab, false));
  });

  folderCards.forEach((folder) => {
    folder.addEventListener("click", () => {
      const targetTab = folder.dataset.openTab || "projects";
      bukaTab(targetTab, true);
    });
  });

  function geserCarousel(arah) {
    if (!viewport) return;
    const jarak = Math.max(280, viewport.clientWidth * 0.72);
    viewport.scrollBy({ left: arah * jarak, behavior: "smooth" });
  }

  if (prevBtn) prevBtn.addEventListener("click", () => geserCarousel(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => geserCarousel(1));
}

// ==================== 6. MODAL DETAIL & VIEW CV ==================== //
function initModalAndCV() {
  const modal = document.getElementById("project-modal");
  const backdrop = document.getElementById("modal-backdrop");
  const closeBtn = document.getElementById("modal-close");
  const modalImg = document.getElementById("modal-img");
  const modalTitle = document.getElementById("modal-title");
  const modalDesc = document.getElementById("modal-desc");
  const modalTech = document.getElementById("modal-tech");
  const modalActions = document.getElementById("modal-actions");
  const modalDemo = document.getElementById("modal-demo");
  const modalKode = document.getElementById("modal-kode");
  const tombolDetailList = document.querySelectorAll(".btn-detail");
  const btnViewCV = document.getElementById("btn-view-cv");

  if (!modal) return;

  function bukaModalUmum({ imgSrc, imgAlt, judul, deskripsi, meta, linkDemo, linkKode, tampilkanAksi }) {
    if (imgSrc) {
      modalImg.src = imgSrc;
      modalImg.alt = imgAlt || judul;
      modalImg.hidden = false;
    } else {
      modalImg.removeAttribute("src");
      modalImg.hidden = true;
    }

    modalTitle.textContent = judul || "Detail";
    modalDesc.textContent = deskripsi || "";
    modalTech.textContent = meta || "-";

    if (modalActions) {
      modalActions.style.display = tampilkanAksi ? "flex" : "none";
    }

    if (tampilkanAksi && modalDemo && modalKode) {
      const demoKosong = !linkDemo || linkDemo === "#";
      modalDemo.href = demoKosong ? "#" : linkDemo;
      modalDemo.classList.toggle("is-disabled", demoKosong);
      modalDemo.setAttribute("aria-disabled", String(demoKosong));
      modalDemo.textContent = demoKosong ? "Demo Belum Tersedia" : "Lihat Demo";

      if (demoKosong || linkDemo.startsWith("#")) {
        modalDemo.removeAttribute("target");
      } else {
        modalDemo.setAttribute("target", "_blank");
      }

      const kodeKosong = !linkKode || linkKode === "#";
      modalKode.style.display = kodeKosong ? "none" : "inline-flex";
      modalKode.href = kodeKosong ? "#" : linkKode;
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    if (lenisInstance) lenisInstance.stop();
    document.body.style.overflow = "hidden";
  }

  function tutupModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");

    if (lenisInstance) lenisInstance.start();
    document.body.style.overflow = "";
  }

  tombolDetailList.forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".showcase-card");
      if (!card) return;
      const gambar = card.querySelector("img");
      const imgValid = gambar && gambar.complete && gambar.naturalWidth > 0 ? gambar.src : "";
      const isCert = card.classList.contains("cert-card");

      bukaModalUmum({
        imgSrc: imgValid,
        imgAlt: gambar ? gambar.alt : card.dataset.judul,
        judul: card.dataset.judul,
        deskripsi: card.dataset.deskripsi,
        meta: card.dataset.meta,
        linkDemo: (card.dataset.demo || "").trim(),
        linkKode: (card.dataset.kode || "").trim(),
        tampilkanAksi: !isCert,
      });
    });
  });

  if (btnViewCV) {
    btnViewCV.addEventListener("click", () => {
      bukaModalUmum({
        imgSrc: "",
        judul: "Ringkasan CV — Habibi",
        deskripsi:
          "Pribadi mandiri dan pekerja keras yang terbiasa membagi waktu antara pekerjaan dan kuliah. Tertarik pada perancangan antarmuka, pengembangan website, dan pengelolaan database, serta terus mengembangkan kemampuan lewat praktik dan proyek nyata.",
        meta: "Fokus: Web Design, Website Development, Database & System Design • Pendidikan: Universitas Annuqayah (2024 – Present).",
        tampilkanAksi: false,
      });
    });
  }

  if (closeBtn) closeBtn.addEventListener("click", tutupModal);
  if (backdrop) backdrop.addEventListener("click", tutupModal);

  if (modalDemo) {
    modalDemo.addEventListener("click", (e) => {
      const href = modalDemo.getAttribute("href") || "";

      if (modalDemo.classList.contains("is-disabled") || href === "#") {
        e.preventDefault();
        return;
      }

      if (href.startsWith("#")) {
        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        tutupModal();

        if (lenisInstance) {
          lenisInstance.scrollTo(target, { offset: -KONFIG.tinggiHeader });
        } else {
          target.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) {
      tutupModal();
    }
  });
}

// ==================== 7. FORM HUBUNGI (VALIDASI JUJUR) ==================== //
function initContactForm() {
  const form = document.getElementById("contact-form");
  const inputNama = document.getElementById("nama");
  const inputEmail = document.getElementById("email");
  const inputPesan = document.getElementById("pesan");
  const errorNama = document.getElementById("error-nama");
  const errorEmail = document.getElementById("error-email");
  const errorPesan = document.getElementById("error-pesan");
  const formStatus = document.getElementById("form-status");

  if (!form) return;

  const polaEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(input, elemenError, pesan) {
    input.classList.toggle("input-error", Boolean(pesan));
    elemenError.textContent = pesan;
  }

  function validasiNama() {
    const nilai = inputNama.value.trim();
    if (nilai.length < 2) {
      setError(inputNama, errorNama, "Nama minimal 2 karakter.");
      return false;
    }
    setError(inputNama, errorNama, "");
    return true;
  }

  function validasiEmail() {
    const nilai = inputEmail.value.trim();
    if (!polaEmail.test(nilai)) {
      setError(inputEmail, errorEmail, "Masukkan format alamat email yang valid.");
      return false;
    }
    setError(inputEmail, errorEmail, "");
    return true;
  }

  function validasiPesan() {
    const nilai = inputPesan.value.trim();
    if (nilai.length < 10) {
      setError(inputPesan, errorPesan, "Pesan minimal 10 karakter.");
      return false;
    }
    setError(inputPesan, errorPesan, "");
    return true;
  }

  inputNama.addEventListener("input", validasiNama);
  inputEmail.addEventListener("input", validasiEmail);
  inputPesan.addEventListener("input", validasiPesan);

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const okNama = validasiNama();
    const okEmail = validasiEmail();
    const okPesan = validasiPesan();

    if (!okNama || !okEmail || !okPesan) {
      formStatus.textContent = "Mohon lengkapi isian yang masih kurang tepat.";
      formStatus.className = "form-status error";
      return;
    }

    const pengirim = inputNama.value.trim();
    formStatus.textContent = `Validasi berhasil, ${pengirim}. Formulir ini belum terhubung ke layanan email/backend, jadi pesan belum terkirim otomatis. Silakan hubungi langsung melalui Find Me di bawah.`;
    formStatus.className = "form-status info";
  });
}

// ==================== 8. TAHUN OTOMATIS FOOTER ==================== //
function initFooterYear() {
  const elemenTahun = document.getElementById("tahun-sekarang");
  if (elemenTahun) {
    elemenTahun.textContent = String(new Date().getFullYear());
  }
}
